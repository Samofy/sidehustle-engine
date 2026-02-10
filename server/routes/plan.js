import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { generatePlan, getCurrentPlan, getTodaysTasks, completeTask, skipTask } from '../services/planService.js';
import { calculateEarnings } from '../utils/earningsCalculator.js';
import pool from '../db/pool.js';

const router = Router();

// POST /api/plan/generate — Generate a new plan from pathfinder data
router.post('/generate', authMiddleware, async (req, res, next) => {
  try {
    const result = await generatePlan(req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/plan/current — Get the user's active plan with all tasks
router.get('/current', authMiddleware, async (req, res, next) => {
  try {
    const plan = await getCurrentPlan(req.userId);
    if (!plan) return res.status(404).json({ error: 'No plan found. Generate one first.' });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/today — Get today's tasks
router.get('/today', authMiddleware, async (req, res, next) => {
  try {
    const energyRating = req.query.energy ? parseInt(req.query.energy) : null;
    const tasks = await getTodaysTasks(req.userId, energyRating);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/complete — Mark a task as completed
router.patch('/:id/complete', authMiddleware, async (req, res, next) => {
  try {
    const task = await completeTask(req.userId, parseInt(req.params.id));
    res.json({ task, message: 'Task completed!' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/skip — Skip a task
router.patch('/:id/skip', authMiddleware, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const task = await skipTask(req.userId, parseInt(req.params.id), reason || 'No reason given');
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// GET /api/career-arc — Get Career Arc data
router.get('/career-arc', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT total_hours_logged, total_tasks_completed FROM users WHERE id = $1',
      [req.userId]
    );
    const user = result.rows[0];
    const earnings = calculateEarnings(parseFloat(user.total_hours_logged || 0));
    res.json({ ...earnings, totalTasksCompleted: user.total_tasks_completed });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id — Update a task
router.patch('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { title, description, day_number, duration_minutes, energy_level } = req.body;

    // Validate day_number if provided
    if (day_number !== undefined && (day_number < 1 || day_number > 365)) {
      return res.status(400).json({ error: 'Day number must be between 1 and 365.' });
    }

    // Validate energy_level if provided
    const validEnergyLevels = ['low', 'medium', 'high'];
    if (energy_level && !validEnergyLevels.includes(energy_level)) {
      return res.status(400).json({ error: 'Energy level must be low, medium, or high.' });
    }

    const result = await pool.query(
      `UPDATE tasks SET
       title = COALESCE($1, title),
       description = COALESCE($2, description),
       day_number = COALESCE($3, day_number),
       duration_minutes = COALESCE($4, duration_minutes),
       energy_level = COALESCE($5, energy_level)
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [title, description, day_number, duration_minutes, energy_level, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    res.json({ task: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/plan/tasks — Create a manual task
router.post('/tasks', authMiddleware, async (req, res, next) => {
  try {
    const { title, description, day_number, duration_minutes, energy_level, phase } = req.body;

    if (!title || !day_number || !phase) {
      return res.status(400).json({ error: 'Title, day_number, and phase are required.' });
    }

    // Validate inputs
    if (day_number < 1 || day_number > 365) {
      return res.status(400).json({ error: 'Day number must be between 1 and 365.' });
    }

    const validEnergyLevels = ['low', 'medium', 'high'];
    if (energy_level && !validEnergyLevels.includes(energy_level)) {
      return res.status(400).json({ error: 'Energy level must be low, medium, or high.' });
    }

    // Get user's active plan
    const planResult = await pool.query(
      "SELECT id FROM plans WHERE user_id = $1 AND status = 'active' LIMIT 1",
      [req.userId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active plan found. Generate a plan first.' });
    }

    const planId = planResult.rows[0].id;

    // Get highest sort_order for this phase to append new task
    const sortResult = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM tasks WHERE plan_id = $1 AND phase = $2',
      [planId, phase]
    );
    const sortOrder = sortResult.rows[0].max_order + 1;

    // Create the task
    const taskResult = await pool.query(
      `INSERT INTO tasks (plan_id, user_id, title, description, phase, day_number, duration_minutes, energy_level, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        planId,
        req.userId,
        title,
        description || '',
        phase,
        day_number,
        duration_minutes || 30,
        energy_level || 'medium',
        sortOrder
      ]
    );

    res.status(201).json({ task: taskResult.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id — Delete a task
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    res.json({ message: 'Task deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/plan/advance-day — Advance to next day manually
router.post('/advance-day', authMiddleware, async (req, res, next) => {
  try {
    const planResult = await pool.query(
      "SELECT id, start_date FROM plans WHERE user_id = $1 AND status = 'active' LIMIT 1",
      [req.userId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active plan found.' });
    }

    const plan = planResult.rows[0];
    const newStart = new Date(plan.start_date);
    newStart.setDate(newStart.getDate() - 1); // Move start back = advance forward

    await pool.query(
      'UPDATE plans SET start_date = $1 WHERE id = $2',
      [newStart.toISOString().split('T')[0], plan.id]
    );

    res.json({ message: 'Advanced to next day successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/start-timer — Start timer for a task
router.post('/:id/start-timer', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE tasks SET started_at = NOW(), paused_at = NULL WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    res.json({ task: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/pause-timer — Pause timer for a task
router.post('/:id/pause-timer', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE tasks SET
         paused_at = NOW(),
         total_paused_seconds = total_paused_seconds + EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, NOW())))::INTEGER
       WHERE id = $1 AND user_id = $2 AND started_at IS NOT NULL AND paused_at IS NULL
       RETURNING *`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found, not started, or already paused.' });
    }

    res.json({ task: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/resume-timer — Resume a paused timer
router.post('/:id/resume-timer', authMiddleware, async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE tasks SET started_at = NOW(), paused_at = NULL WHERE id = $1 AND user_id = $2 AND paused_at IS NOT NULL RETURNING *',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found, not paused, or access denied.' });
    }

    res.json({ task: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
