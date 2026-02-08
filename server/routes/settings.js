import { Router } from 'express';
import pool from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/settings
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT email, name, voice_enabled, voice_preference, preferred_model, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ settings: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings/preferences
router.patch('/preferences', authMiddleware, async (req, res, next) => {
  try {
    const { voice_enabled, voice_preference, preferred_model } = req.body;

    // Validate preferred_model if provided
    const validModels = [
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-5-haiku-20241022'
    ];

    if (preferred_model && !validModels.includes(preferred_model)) {
      return res.status(400).json({ error: 'Invalid model selection.' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (voice_enabled !== undefined) {
      updates.push(`voice_enabled = $${paramCount++}`);
      values.push(voice_enabled);
    }

    if (voice_preference) {
      updates.push(`voice_preference = $${paramCount++}`);
      values.push(voice_preference);
    }

    if (preferred_model) {
      updates.push(`preferred_model = $${paramCount++}`);
      values.push(preferred_model);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided.' });
    }

    values.push(req.userId);
    const query = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING voice_enabled, voice_preference, preferred_model`;

    const result = await pool.query(query, values);

    res.json({ settings: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/reset-account
router.post('/reset-account', authMiddleware, async (req, res, next) => {
  try {
    const { confirmation } = req.body;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Invalid confirmation. Type DELETE to confirm.' });
    }

    // Check rate limiting (basic check - could use Redis in production)
    const recentReset = await pool.query(
      'SELECT updated_at FROM users WHERE id = $1 AND updated_at > NOW() - INTERVAL \'1 hour\'',
      [req.userId]
    );

    if (recentReset.rows.length > 0) {
      const lastUpdate = new Date(recentReset.rows[0].updated_at);
      const waitTime = Math.ceil((3600000 - (Date.now() - lastUpdate.getTime())) / 60000);
      return res.status(429).json({ error: `Please wait ${waitTime} minutes before resetting again.` });
    }

    // Begin transaction to reset user data
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete user's plans and tasks (cascade will handle tasks)
      await client.query('DELETE FROM plans WHERE user_id = $1', [req.userId]);

      // Delete check-ins
      await client.query('DELETE FROM check_ins WHERE user_id = $1', [req.userId]);

      // Delete conversations
      await client.query('DELETE FROM conversations WHERE user_id = $1', [req.userId]);

      // Reset user stats but keep account
      await client.query(
        `UPDATE users SET
         onboarding_complete = FALSE,
         pathfinder_data = '{}',
         current_phase = 0,
         current_streak = 0,
         longest_streak = 0,
         total_tasks_completed = 0,
         total_hours_logged = 0,
         last_check_in_date = NULL,
         updated_at = NOW()
         WHERE id = $1`,
        [req.userId]
      );

      await client.query('COMMIT');

      res.json({ message: 'Account data reset successfully. You can start fresh from the Pathfinder.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

export default router;
