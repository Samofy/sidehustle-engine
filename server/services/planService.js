import pool from '../db/pool.js';
import { buildSystemPrompt, callClaude } from '../ai/orchestrator.js';

/**
 * Generate a full 4-phase plan based on pathfinder data.
 */
export async function generatePlan(userId) {
  // Get user's pathfinder data
  const userResult = await pool.query(
    'SELECT pathfinder_data, name FROM users WHERE id = $1',
    [userId]
  );

  const user = userResult.rows[0];
  if (!user?.pathfinder_data?.answers) {
    throw new Error('Complete the Pathfinder first.');
  }

  const { answers, recommendation } = user.pathfinder_data;

  // Fetch user's preferred model
  const modelResult = await pool.query('SELECT preferred_model FROM users WHERE id = $1', [userId]);
  const preferredModel = modelResult.rows[0]?.preferred_model || 'claude-sonnet-4-20250514';

  const systemPrompt = buildSystemPrompt('plan', {
    userName: user.name,
    answers,
    recommendation,
  });

  const messages = [
    {
      role: 'user',
      content: `Generate my complete execution plan. My recommendation was:\n\n${recommendation}\n\nReturn ONLY valid JSON following the output format in your instructions. No markdown, no explanation outside the JSON.`,
    },
  ];

  const rawResponse = await callClaude({ systemPrompt, messages, model: preferredModel, maxTokens: 4000 });

  // Parse the JSON from Claude's response
  let planData;
  try {
    // Try to extract JSON from the response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    planData = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('Failed to parse plan JSON:', rawResponse);
    throw new Error('Failed to generate plan. Please try again.');
  }

  // Create the plan record
  const planResult = await pool.query(
    `INSERT INTO plans (user_id, niche, offer, phase, start_date)
     VALUES ($1, $2, $3, 1, CURRENT_DATE)
     RETURNING id`,
    [userId, planData.niche || 'General', planData.offer || '']
  );

  const planId = planResult.rows[0].id;

  // Insert all tasks
  let taskInserts = [];
  for (const phase of planData.phases || []) {
    for (const task of phase.tasks || []) {
      taskInserts.push(
        pool.query(
          `INSERT INTO tasks (plan_id, user_id, title, description, phase, day_number, duration_minutes, energy_level, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            planId,
            userId,
            task.title,
            task.description || '',
            phase.phase,
            task.day || task.day_number || 1,
            task.duration_minutes || 30,
            task.energy_level || 'medium',
            task.sort_order || 0,
          ]
        )
      );
    }
  }

  await Promise.all(taskInserts);

  // Update user's current phase
  await pool.query('UPDATE users SET current_phase = 1 WHERE id = $1', [userId]);

  return { planId, plan: planData };
}

/**
 * Get the user's current active plan.
 */
export async function getCurrentPlan(userId) {
  const planResult = await pool.query(
    "SELECT * FROM plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [userId]
  );

  if (planResult.rows.length === 0) return null;

  const plan = planResult.rows[0];

  // Get all tasks grouped by phase
  const tasksResult = await pool.query(
    'SELECT * FROM tasks WHERE plan_id = $1 ORDER BY phase, day_number, sort_order',
    [plan.id]
  );

  return { ...plan, tasks: tasksResult.rows };
}

/**
 * Get today's tasks based on plan start date.
 */
export async function getTodaysTasks(userId, energyRating = null) {
  const plan = await getCurrentPlan(userId);
  if (!plan) return [];

  // Calculate current day number
  const startDate = new Date(plan.start_date);
  const today = new Date();
  const dayNumber = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;

  let query = `
    SELECT * FROM tasks 
    WHERE plan_id = $1 AND day_number = $2 
  `;
  const params = [plan.id, dayNumber];

  // Filter by energy if provided
  if (energyRating === 1) {
    query += " AND energy_level = 'low'";
  }

  query += ' ORDER BY sort_order';

  const result = await pool.query(query, params);

  // If no tasks for today's exact day, get next available uncompleted tasks
  if (result.rows.length === 0) {
    const fallback = await pool.query(
      `SELECT * FROM tasks 
       WHERE plan_id = $1 AND status = 'pending' 
       ORDER BY day_number, sort_order 
       LIMIT 3`,
      [plan.id]
    );
    return fallback.rows;
  }

  return result.rows;
}

/**
 * Complete a task.
 */
export async function completeTask(userId, taskId) {
  const result = await pool.query(
    `UPDATE tasks SET status = 'completed', completed_at = NOW() 
     WHERE id = $1 AND user_id = $2 
     RETURNING *`,
    [taskId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Task not found.');
  }

  const task = result.rows[0];

  // Update user stats
  const hoursToAdd = (task.duration_minutes || 30) / 60;
  await pool.query(
    `UPDATE users SET 
       total_tasks_completed = total_tasks_completed + 1,
       total_hours_logged = total_hours_logged + $1,
       current_streak = current_streak + 1,
       longest_streak = GREATEST(longest_streak, current_streak + 1),
       last_check_in_date = CURRENT_DATE,
       updated_at = NOW()
     WHERE id = $2`,
    [hoursToAdd, userId]
  );

  // Check phase progression
  await checkPhaseProgression(userId, task.plan_id, task.phase);

  return task;
}

/**
 * Skip a task with a reason.
 */
export async function skipTask(userId, taskId, reason) {
  const result = await pool.query(
    `UPDATE tasks SET status = 'skipped', skipped_reason = $1 
     WHERE id = $2 AND user_id = $3 
     RETURNING *`,
    [reason, taskId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Task not found.');
  }

  return result.rows[0];
}

/**
 * Check if all tasks in a phase are done → advance phase.
 */
async function checkPhaseProgression(userId, planId, currentPhase) {
  const remaining = await pool.query(
    "SELECT COUNT(*) as count FROM tasks WHERE plan_id = $1 AND phase = $2 AND status = 'pending'",
    [planId, currentPhase]
  );

  if (parseInt(remaining.rows[0].count) === 0) {
    const nextPhase = currentPhase + 1;
    if (nextPhase <= 4) {
      await pool.query('UPDATE plans SET phase = $1, updated_at = NOW() WHERE id = $2', [nextPhase, planId]);
      await pool.query('UPDATE users SET current_phase = $1, updated_at = NOW() WHERE id = $2', [nextPhase, userId]);
    }
  }
}
