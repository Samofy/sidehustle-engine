import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { sendMentorMessage, getMentorHistory } from '../services/mentorService.js';

const router = Router();

// POST /api/mentor/message — Send a message and receive SSE stream
router.post('/message', authMiddleware, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    await sendMentorMessage(req.userId, message.trim(), res);
  } catch (err) {
    next(err);
  }
});

// GET /api/mentor/history — Get conversation history
router.get('/history', authMiddleware, async (req, res, next) => {
  try {
    const history = await getMentorHistory(req.userId);
    res.json({ history });
  } catch (err) {
    next(err);
  }
});

export default router;
