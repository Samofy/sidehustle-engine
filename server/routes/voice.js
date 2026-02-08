import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { isVoiceEnabled, transcribeAudio, textToSpeech, updateVoiceSettings } from '../voice/voiceService.js';

const router = Router();

// GET /api/voice/status — Check if voice is available
router.get('/status', authMiddleware, (req, res) => {
  res.json({ enabled: isVoiceEnabled() });
});

// POST /api/voice/transcribe — Send audio, get transcript
router.post('/transcribe', authMiddleware, async (req, res, next) => {
  try {
    if (!isVoiceEnabled()) {
      return res.status(503).json({ error: 'Voice services not configured.' });
    }

    const audioBuffer = req.body;
    if (!audioBuffer || !audioBuffer.length) {
      return res.status(400).json({ error: 'No audio data received.' });
    }

    const transcript = await transcribeAudio(audioBuffer);
    res.json({ transcript });
  } catch (err) {
    next(err);
  }
});

// POST /api/voice/speak — Send text, get audio back
router.post('/speak', authMiddleware, async (req, res, next) => {
  try {
    if (!isVoiceEnabled()) {
      return res.status(503).json({ error: 'Voice services not configured.' });
    }

    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required.' });

    const audioBuffer = await textToSpeech(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.send(audioBuffer);
  } catch (err) {
    next(err);
  }
});

// POST /api/voice/settings — Update voice preferences
router.post('/settings', authMiddleware, async (req, res, next) => {
  try {
    const { enabled, preference } = req.body;
    await updateVoiceSettings(req.userId, { enabled, preference });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
