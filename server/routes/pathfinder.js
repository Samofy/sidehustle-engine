import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { startPathfinder, respondToPathfinder, getRecommendation } from '../services/pathfinderService.js';

const router = Router();

// POST /api/pathfinder/start — Begin the Pathfinder onboarding
router.post('/start', authMiddleware, async (req, res, next) => {
  try {
    const result = await startPathfinder(req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/pathfinder/respond — Send a response and get next question or recommendation
router.post('/respond', authMiddleware, async (req, res, next) => {
  try {
    const { response } = req.body;
    if (!response || !response.trim()) {
      return res.status(400).json({ error: 'Please provide a response.' });
    }
    const result = await respondToPathfinder(req.userId, response.trim());
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/pathfinder/recommendation — Get the saved recommendation
router.get('/recommendation', authMiddleware, async (req, res, next) => {
  try {
    const data = await getRecommendation(req.userId);
    if (!data) {
      return res.status(404).json({ error: 'No recommendation yet. Complete the Pathfinder first.' });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
