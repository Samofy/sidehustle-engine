import pool from '../db/pool.js';
import { buildSystemPrompt, callClaude } from '../ai/orchestrator.js';

const PATHFINDER_QUESTIONS = [
  "What do you do for work, and what are you naturally good at? Don't overthink this — what do people come to you for?",
  "Outside of work, what topics or activities do you find yourself spending time on — even when you're tired?",
  "How many hours a day can you realistically dedicate to this? Be honest — tired hours count.",
  "What would meaningful extra income look like for you? A number per month.",
  "Are you willing to invest a small amount upfront ($50-200) to move faster, or do you need to start at zero cost?",
  "Do you have any existing audience, network, or tools that could give you a head start? Even a small one.",
  "Is there anything you absolutely don't want to do? Sales calls, writing, video — anything off the table?"
];

/**
 * Start a new Pathfinder session. Returns the first question.
 */
export async function startPathfinder(userId) {
  // Clear any previous pathfinder conversations
  await pool.query(
    "DELETE FROM conversations WHERE user_id = $1 AND context_type = 'pathfinder'",
    [userId]
  );

  // Reset onboarding status
  await pool.query(
    "UPDATE users SET onboarding_complete = FALSE, pathfinder_data = '{}' WHERE id = $1",
    [userId]
  );

  // Store the first question as an assistant message
  const firstQuestion = PATHFINDER_QUESTIONS[0];
  await pool.query(
    "INSERT INTO conversations (user_id, context_type, role, content) VALUES ($1, 'pathfinder', 'assistant', $2)",
    [userId, firstQuestion]
  );

  return {
    questionNumber: 1,
    totalQuestions: PATHFINDER_QUESTIONS.length,
    question: firstQuestion,
    isComplete: false,
  };
}

/**
 * Process a user's response and return the next question or recommendation.
 */
export async function respondToPathfinder(userId, userResponse) {
  // Get conversation history BEFORE storing to check current state
  const history = await pool.query(
    "SELECT role, content FROM conversations WHERE user_id = $1 AND context_type = 'pathfinder' ORDER BY created_at",
    [userId]
  );

  const existingUserResponses = history.rows.filter(m => m.role === 'user');

  // Only store the response if we haven't already collected all answers
  // (prevents duplicate answers on retry after a failed recommendation generation)
  if (existingUserResponses.length < PATHFINDER_QUESTIONS.length) {
    await pool.query(
      "INSERT INTO conversations (user_id, context_type, role, content) VALUES ($1, 'pathfinder', 'user', $2)",
      [userId, userResponse]
    );
  }

  // Re-query to get updated history
  const updatedHistory = await pool.query(
    "SELECT role, content FROM conversations WHERE user_id = $1 AND context_type = 'pathfinder' ORDER BY created_at",
    [userId]
  );

  // Count user responses to determine which question we're on
  const userResponses = updatedHistory.rows.filter(m => m.role === 'user');
  const questionIndex = userResponses.length; // 0-indexed, but we've already added the current one

  // If we haven't asked all questions yet, return the next one
  if (questionIndex < PATHFINDER_QUESTIONS.length) {
    const nextQuestion = PATHFINDER_QUESTIONS[questionIndex];

    await pool.query(
      "INSERT INTO conversations (user_id, context_type, role, content) VALUES ($1, 'pathfinder', 'assistant', $2)",
      [userId, nextQuestion]
    );

    return {
      questionNumber: questionIndex + 1,
      totalQuestions: PATHFINDER_QUESTIONS.length,
      question: nextQuestion,
      isComplete: false,
    };
  }

  // All questions answered — generate recommendation via AI
  const answers = {};
  const labels = ['skills', 'interests', 'available_time', 'financial_goal', 'risk_tolerance', 'existing_assets', 'dealbreakers'];
  userResponses.forEach((r, i) => {
    if (labels[i]) answers[labels[i]] = r.content;
  });

  const systemPrompt = buildSystemPrompt('pathfinder', { answers });
  const messages = [
    {
      role: 'user',
      content: `Based on my answers, give me your single recommendation. Here are my answers:\n\n${Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nGive me ONE clear path. Follow your recommendation framework exactly.`
    }
  ];

  let recommendation;
  try {
    recommendation = await callClaude({ systemPrompt, messages, maxTokens: 1500 });
  } catch (err) {
    console.error('[Pathfinder] Claude API failed for user', userId, err.message);
    throw new Error('Failed to generate recommendation. Please try again.');
  }

  if (!recommendation) {
    throw new Error('Received empty recommendation. Please try again.');
  }

  // Store recommendation
  await pool.query(
    "INSERT INTO conversations (user_id, context_type, role, content) VALUES ($1, 'pathfinder', 'assistant', $2)",
    [userId, recommendation]
  );

  // Save pathfinder data to user
  await pool.query(
    "UPDATE users SET pathfinder_data = $1, onboarding_complete = TRUE WHERE id = $2",
    [JSON.stringify({ answers, recommendation }), userId]
  );

  return {
    questionNumber: PATHFINDER_QUESTIONS.length,
    totalQuestions: PATHFINDER_QUESTIONS.length,
    recommendation,
    isComplete: true,
  };
}

/**
 * Get the current recommendation if onboarding is complete.
 */
export async function getRecommendation(userId) {
  const result = await pool.query(
    "SELECT pathfinder_data, onboarding_complete FROM users WHERE id = $1",
    [userId]
  );

  if (!result.rows[0]?.onboarding_complete) {
    return null;
  }

  return result.rows[0].pathfinder_data;
}
