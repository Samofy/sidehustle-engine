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

export default router;
