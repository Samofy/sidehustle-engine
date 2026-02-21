import { WebSocketServer } from 'ws';
import { transcribeAudio, textToSpeech, isVoiceEnabled } from './voiceService.js';
import { assembleMentorContext, getConversationHistory } from '../services/mentorService.js';
import { buildSystemPrompt, callClaude } from '../ai/orchestrator.js';
import pool from '../db/pool.js';
import jwt from 'jsonwebtoken';

const IDLE_TIMEOUT = 5 * 60 * 1000;

function safeSend(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function authenticateWebSocket(req) {
  const url = new URL(req.url, 'ws://localhost');
  const token = url.searchParams.get('token');
  if (!token) throw new Error('No authentication token');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.userId;
}

/**
 * Process a single audio utterance: transcribe → Claude → streaming TTS
 */
async function processUtterance(ws, userId, audioBuffer) {
  let interrupted = false;

  // Listen for interrupt messages during processing
  function onInterrupt(raw) {
    try { if (JSON.parse(raw).type === 'interrupt') interrupted = true; } catch {}
  }
  ws.on('message', onInterrupt);

  try {
    // 1. Transcribe
    safeSend(ws, { type: 'transcribing' });
    const transcript = await transcribeAudio(audioBuffer);

    if (!transcript?.trim()) {
      safeSend(ws, { type: 'listening' });
      return true; // stay active
    }

    console.log(`[voice] user ${userId}: "${transcript}"`);

    // Check for deactivation commands
    const lower = transcript.toLowerCase();
    if (lower.includes('stop listening') || lower.includes('deactivate') || lower.includes('turn off')) {
      safeSend(ws, { type: 'text-response', text: 'Voice agent deactivated.' });
      safeSend(ws, { type: 'status', active: false });
      return false; // deactivate
    }

    // 2. Store user message
    await pool.query(
      "INSERT INTO conversations (user_id, context_type, role, content, input_mode) VALUES ($1, 'mentor', 'user', $2, 'voice')",
      [userId, transcript]
    );

    // 3. Build context
    const userResult = await pool.query('SELECT preferred_model, mentor_personality FROM users WHERE id = $1', [userId]);
    const preferredModel = userResult.rows[0]?.preferred_model || 'claude-sonnet-4-20250514';
    const mentorPersonality = userResult.rows[0]?.mentor_personality || 'balanced';
    const context = await assembleMentorContext(userId);
    context.mentorPersonality = mentorPersonality;
    const systemPrompt = buildSystemPrompt('mentor', context);
    const history = await getConversationHistory(userId, 5);
    const messages = [...history.map(h => ({ role: h.role, content: h.content })), { role: 'user', content: transcript }];

    // 4. Stream Claude response + sentence-level TTS
    safeSend(ws, { type: 'generating-response' });
    safeSend(ws, { type: 'audio-start' });

    let fullResponse = '';
    let sentenceBuffer = '';
    const ttsPromises = [];
    let sendIndex = 0;
    let allSentencesQueued = false;

    // Background loop: send TTS audio in order as each resolves
    const senderDone = (async () => {
      while (true) {
        if (interrupted) break;
        if (sendIndex < ttsPromises.length) {
          try {
            const audio = await ttsPromises[sendIndex];
            if (!interrupted) safeSend(ws, { type: 'sentence-audio', data: audio.toString('base64') });
          } catch (err) {
            console.error('[voice] TTS error:', err.message);
          }
          sendIndex++;
        } else if (allSentencesQueued) {
          break;
        } else {
          await new Promise(r => setTimeout(r, 30));
        }
      }
    })();

    // Stream Claude and detect sentences
    await callClaude({
      systemPrompt,
      messages,
      model: preferredModel,
      maxTokens: 1024,
      onChunk: (chunk) => {
        if (interrupted) return;
        fullResponse += chunk;
        sentenceBuffer += chunk;
        safeSend(ws, { type: 'text-chunk', text: chunk });

        // Extract all complete sentences from buffer
        while (!interrupted) {
          const idx = sentenceBuffer.search(/[.!?]\s|\n\n/);
          if (idx < 0) break;
          const sentence = sentenceBuffer.slice(0, idx + 1).trim();
          sentenceBuffer = sentenceBuffer.slice(idx + 1).trimStart();
          if (sentence.length > 3) {
            ttsPromises.push(textToSpeech(sentence));
          }
        }
      }
    });

    // Handle remaining text
    if (sentenceBuffer.trim().length > 0 && !interrupted) {
      ttsPromises.push(textToSpeech(sentenceBuffer.trim()));
    }
    allSentencesQueued = true;

    // Wait for all audio to be sent
    await senderDone;

    // Send complete text and audio-end
    safeSend(ws, { type: 'text-response', text: fullResponse });
    if (!interrupted) safeSend(ws, { type: 'audio-end' });

    // 5. Store assistant response
    await pool.query(
      "INSERT INTO conversations (user_id, context_type, role, content) VALUES ($1, 'mentor', 'assistant', $2)",
      [userId, fullResponse]
    );

    return true; // stay active

  } finally {
    ws.removeListener('message', onInterrupt);
  }
}

export function setupVoiceAgent(server) {
  if (!isVoiceEnabled()) {
    console.log('Voice agent disabled — missing API keys');
    return;
  }

  const wss = new WebSocketServer({ server, path: '/voice-agent', maxPayload: 2 * 1024 * 1024 });

  wss.on('connection', async (ws, req) => {
    let userId;
    try {
      userId = authenticateWebSocket(req);
    } catch (err) {
      ws.close(1008, 'Auth failed');
      return;
    }

    let isActive = false;
    let idleTimer = null;
    let processing = false;

    function resetIdle() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (isActive) {
          isActive = false;
          safeSend(ws, { type: 'status', active: false, message: 'Deactivated due to inactivity' });
        }
      }, IDLE_TIMEOUT);
    }

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'ping') {
        safeSend(ws, { type: 'pong' });
      }

      else if (msg.type === 'activate') {
        isActive = true;
        processing = false;
        resetIdle();
        safeSend(ws, { type: 'status', active: true });
        console.log(`[voice] activated: user ${userId}`);
      }

      else if (msg.type === 'deactivate') {
        isActive = false;
        if (idleTimer) clearTimeout(idleTimer);
        safeSend(ws, { type: 'status', active: false });
      }

      else if (msg.type === 'audio-data' && isActive && !processing) {
        resetIdle();
        processing = true;

        try {
          const audioData = Buffer.from(msg.audioData.split(',')[1], 'base64');
          const stayActive = await processUtterance(ws, userId, audioData);
          if (!stayActive) isActive = false;
        } catch (err) {
          console.error('[voice] processing error:', err);
          safeSend(ws, { type: 'error', message: 'Something went wrong. Try again.' });
        } finally {
          processing = false;
        }
      }

      // 'interrupt' is handled inside processUtterance
    });

    // Keep-alive ping to prevent proxy timeouts (Railway, etc.)
    const pingInterval = setInterval(() => {
      if (ws.readyState === 1) ws.ping();
    }, 30000);

    ws.on('close', () => {
      clearInterval(pingInterval);
      if (idleTimer) clearTimeout(idleTimer);
    });

    ws.on('error', (err) => console.error('[voice] WS error:', err.message));

    safeSend(ws, { type: 'connected', message: 'Voice agent ready' });
    console.log(`[voice] connected: user ${userId}`);
  });

  console.log('Voice agent WebSocket initialized at /voice-agent');
}
