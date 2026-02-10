import pool from '../db/pool.js';
import { buildSystemPrompt, callClaude } from '../ai/orchestrator.js';

/**
 * Assemble full user context for the Mentor.
 */
export async function assembleMentorContext(userId) {
  // User profile
  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0];

  // Current plan
  const planResult = await pool.query(
    "SELECT * FROM plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  const plan = planResult.rows[0];

  // Today's tasks
  let todayTasks = [];
  if (plan) {
    const dayNum = Math.floor((new Date() - new Date(plan.start_date)) / (1000 * 60 * 60 * 24)) + 1;
    const taskResult = await pool.query(
      'SELECT title, description, status, energy_level FROM tasks WHERE plan_id = $1 AND day_number = $2',
      [plan.id, dayNum]
    );
    todayTasks = taskResult.rows;
  }

  // Recent check-ins (7 days)
  const checkIns = await pool.query(
    'SELECT energy_rating, task_completed, check_in_date FROM check_ins WHERE user_id = $1 ORDER BY created_at DESC LIMIT 7',
    [userId]
  );

  // Career Arc
  const totalHours = parseFloat(user.total_hours_logged || 0);

  return {
    userName: user.name,
    currentPhase: plan?.phase || 0,
    niche: plan?.niche || 'Not yet chosen',
    offer: plan?.offer || '',
    currentStreak: user.current_streak || 0,
    totalTasksCompleted: user.total_tasks_completed || 0,
    todayTasks,
    recentCheckIns: checkIns.rows,
    careerArc: {
      hoursLogged: totalHours,
      earned: Math.round(totalHours * 507 * 100) / 100,
    },
    onboardingData: user.pathfinder_data || {},
    mentorPersonality: user.mentor_personality || 'balanced',
  };
}

/**
 * Get conversation history for the mentor.
 */
export async function getConversationHistory(userId, limit = 15) {
  const result = await pool.query(
    "SELECT role, content FROM conversations WHERE user_id = $1 AND context_type = 'mentor' ORDER BY created_at DESC LIMIT $2",
    [userId, limit]
  );
  return result.rows.reverse(); // Oldest first
}

/**
 * Send a message to the Mentor and stream the response via SSE.
 */
export async function sendMentorMessage(userId, userMessage, res) {
  // Store user message
  await pool.query(
    "INSERT INTO conversations (user_id, context_type, role, content, input_mode) VALUES ($1, 'mentor', 'user', $2, 'text')",
    [userId, userMessage]
  );

  // Fetch user's preferred model
  const userResult = await pool.query('SELECT preferred_model FROM users WHERE id = $1', [userId]);
  const preferredModel = userResult.rows[0]?.preferred_model || 'claude-sonnet-4-20250514';

  // Assemble context
  const context = await assembleMentorContext(userId);
  const systemPrompt = buildSystemPrompt('mentor', context);

  // Get history
  const history = await getConversationHistory(userId);
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let fullResponse = '';

  try {
    fullResponse = await callClaude({
      systemPrompt,
      messages,
      model: preferredModel,
      maxTokens: 1500,
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      },
    });

    // Store AI response
    await pool.query(
      "INSERT INTO conversations (user_id, context_type, role, content) VALUES ($1, 'mentor', 'assistant', $2)",
      [userId, fullResponse]
    );

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Mentor error:', err);
    res.write(`data: ${JSON.stringify({ error: 'Something went wrong. Please try again.' })}\n\n`);
    res.end();
  }
}

/**
 * Get mentor conversation history.
 */
export async function getMentorHistory(userId) {
  const result = await pool.query(
    "SELECT role, content, input_mode, created_at FROM conversations WHERE user_id = $1 AND context_type = 'mentor' ORDER BY created_at",
    [userId]
  );
  return result.rows;
}
