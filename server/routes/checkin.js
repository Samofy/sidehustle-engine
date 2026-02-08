import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { processCheckIn, getCheckInHistory } from '../services/checkInService.js';

const router = Router();

// POST /api/checkin — Submit a daily check-in
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { energyRating, taskCompleted, skipReason } = req.body;

    if (!energyRating || energyRating < 1 || energyRating > 3) {
      return res.status(400).json({ error: 'Energy rating must be 1, 2, or 3.' });
    }

    if (typeof taskCompleted !== 'boolean') {
      return res.status(400).json({ error: 'taskCompleted must be true or false.' });
    }

    const result = await processCheckIn(req.userId, { energyRating, taskCompleted, skipReason });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/checkin/history — Get check-in history
router.get('/history', authMiddleware, async (req, res, next) => {
  try {
    const history = await getCheckInHistory(req.userId);
    res.json({ history });
  } catch (err) {
    next(err);
  }
});

export default router;
