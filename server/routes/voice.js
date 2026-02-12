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
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length < 100) {
      console.error('[transcribe] Bad body — type:', typeof audioBuffer, 'isBuffer:', Buffer.isBuffer(audioBuffer), 'length:', audioBuffer?.length);
      return res.status(400).json({ error: 'No audio data received. Hold the mic button for at least 1 second.' });
    }

    const transcript = await transcribeAudio(audioBuffer);
    res.json({ transcript: transcript || '' });
  } catch (err) {
    console.error('[transcribe] Error:', err.message);
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

// POST /api/voice/speak-stream — Stream audio chunks as they're generated
router.post('/speak-stream', authMiddleware, async (req, res, next) => {
  try {
    if (!isVoiceEnabled()) {
      return res.status(503).json({ error: 'Voice services not configured.' });
    }

    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required.' });

    // Set headers for streaming audio
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Cache-Control', 'no-cache');

    // Stream from Cartesia API if available
    if (process.env.CARTESIA_API_KEY) {
      const voiceId = process.env.CARTESIA_VOICE_ID || 'a0e99841-438c-4a64-b679-ae501e7d6091';

      const cartesiaRes = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: {
          'X-API-Key': process.env.CARTESIA_API_KEY,
          'Cartesia-Version': '2024-06-10',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: 'sonic-english',
          transcript: text,
          voice: { mode: 'id', id: voiceId },
          output_format: {
            container: 'mp3',
            encoding: 'mp3',
            sample_rate: 44100,
          },
        }),
      });

      if (!cartesiaRes.ok) {
        const err = await cartesiaRes.text();
        throw new Error(`Cartesia streaming error: ${err}`);
      }

      // Stream response directly to client
      const reader = cartesiaRes.body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } catch (streamErr) {
        console.error('Streaming error:', streamErr);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Audio streaming failed' });
        }
      }
    } else {
      // Fallback to ElevenLabs (doesn't support streaming, so just send buffer)
      const audioBuffer = await textToSpeech(text);
      res.send(audioBuffer);
    }
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
