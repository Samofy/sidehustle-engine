import pool from '../db/pool.js';
import { buildSystemPrompt, callClaude } from '../ai/orchestrator.js';

/**
 * Process a daily check-in.
 */
export async function processCheckIn(userId, { energyRating, taskCompleted, skipReason }) {
  // Get user context
  const userResult = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  const user = userResult.rows[0];

  // Get current plan and task
  const planResult = await pool.query(
    "SELECT * FROM plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  const plan = planResult.rows[0];

  // Get recent check-ins
  const recentCheckIns = await pool.query(
    'SELECT * FROM check_ins WHERE user_id = $1 ORDER BY created_at DESC LIMIT 7',
    [userId]
  );

  // Build AI context
  const context = {
    userName: user.name,
    energyRating,
    taskCompleted,
    skipReason: skipReason || null,
    currentStreak: user.current_streak,
    totalTasksCompleted: user.total_tasks_completed,
    currentPhase: plan?.phase || 1,
    recentCheckIns: recentCheckIns.rows.map(c => ({
      date: c.check_in_date,
      energy: c.energy_rating,
      completed: c.task_completed,
    })),
    daysIntoJourney: plan ? Math.floor((new Date() - new Date(plan.start_date)) / (1000 * 60 * 60 * 24)) + 1 : 1,
  };

  // Check if it's a weekly summary day (every 7 days)
  const isWeeklySummary = context.daysIntoJourney > 0 && context.daysIntoJourney % 7 === 0;

  const systemPrompt = buildSystemPrompt('checkin', context);
  const messages = [
    {
      role: 'user',
      content: isWeeklySummary
        ? `Energy: ${energyRating}. Task completed: ${taskCompleted}${skipReason ? `. Reason skipped: ${skipReason}` : ''}. This is day ${context.daysIntoJourney} — give me my weekly summary too.`
        : `Energy: ${energyRating}. Task completed: ${taskCompleted}${skipReason ? `. Reason skipped: ${skipReason}` : ''}.`,
    },
  ];

  const aiResponse = await callClaude({ systemPrompt, messages, maxTokens: 800 });

  // Store check-in
  await pool.query(
    `INSERT INTO check_ins (user_id, energy_rating, task_completed, skip_reason, ai_response, check_in_date)
     VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)`,
    [userId, energyRating, taskCompleted, skipReason, aiResponse]
  );

  // Update user's last check-in date and energy
  await pool.query(
    'UPDATE users SET last_check_in_date = CURRENT_DATE, updated_at = NOW() WHERE id = $1',
    [userId]
  );

  // If task was not completed, reset streak
  if (!taskCompleted) {
    await pool.query(
      'UPDATE users SET current_streak = 0, updated_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  return {
    aiResponse,
    isWeeklySummary,
    streak: taskCompleted ? (user.current_streak || 0) + 1 : 0,
  };
}

/**
 * Get check-in history.
 */
export async function getCheckInHistory(userId, limit = 30) {
  const result = await pool.query(
    'SELECT * FROM check_ins WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return result.rows;
}
