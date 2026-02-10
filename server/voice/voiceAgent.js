/**
 * Voice Agent WebSocket Handler
 *
 * Provides continuous voice conversation mode with:
 * - Voice activity detection
 * - Real-time transcription
 * - Streaming audio responses
 */

import { WebSocketServer } from 'ws';
import { transcribeAudio, textToSpeech, isVoiceEnabled } from './voiceService.js';
import { assembleMentorContext, getConversationHistory } from '../services/mentorService.js';
import { buildSystemPrompt, callClaude } from '../ai/orchestrator.js';
import pool from '../db/pool.js';
import jwt from 'jsonwebtoken';

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const MAX_AUDIO_CHUNK_SIZE = 1024 * 1024; // 1MB

/**
 * Simple voice activity detection buffer
 */
class VoiceActivityBuffer {
  constructor() {
    this.chunks = [];
    this.isRecording = false;
    this.silenceStart = null;
    this.SILENCE_THRESHOLD = 1000; // 1 second of silence ends speech
  }

  feed(audioData) {
    this.chunks.push(audioData);
    this.isRecording = true;
    this.silenceStart = null;
  }

  markSilence() {
    if (this.isRecording && !this.silenceStart) {
      this.silenceStart = Date.now();
    }
  }

  isSpeechEnd() {
    return this.isRecording &&
           this.silenceStart &&
           (Date.now() - this.silenceStart) > this.SILENCE_THRESHOLD;
  }

  getBuffer() {
    return Buffer.concat(this.chunks);
  }

  reset() {
    this.chunks = [];
    this.isRecording = false;
    this.silenceStart = null;
  }

  hasData() {
    return this.chunks.length > 0;
  }
}

/**
 * Authenticate WebSocket connection from token in query string
 */
function authenticateWebSocket(req) {
  const url = new URL(req.url, 'ws://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    throw new Error('No authentication token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (err) {
    throw new Error('Invalid authentication token');
  }
}

/**
 * Generate mentor response for voice agent
 */
async function generateVoiceResponse(userId, transcript) {
  // Store user message
  await pool.query(
    "INSERT INTO conversations (user_id, context_type, role, content, input_mode) VALUES ($1, 'mentor', 'user', $2, 'voice')",
    [userId, transcript]
  );

  // Get user's preferred model and mentor personality
  const userResult = await pool.query(
    'SELECT preferred_model, mentor_personality FROM users WHERE id = $1',
    [userId]
  );
  const preferredModel = userResult.rows[0]?.preferred_model || 'claude-sonnet-4-20250514';
  const mentorPersonality = userResult.rows[0]?.mentor_personality || 'balanced';

  // Build context (lightweight for voice mode - no full history)
  const context = await assembleMentorContext(userId);
  context.mentorPersonality = mentorPersonality;

  const systemPrompt = buildSystemPrompt('mentor', context);

  // Get recent conversation history (only last 5 messages for voice mode)
  const history = await getConversationHistory(userId, 5);
  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: transcript }
  ];

  // Stream response
  let fullResponse = '';

  await callClaude({
    systemPrompt,
    messages,
    model: preferredModel,
    maxTokens: 1024, // Shorter responses for voice
    onChunk: (chunk) => {
      fullResponse += chunk;
    }
  });

  // Store assistant response
  await pool.query(
    "INSERT INTO conversations (user_id, context_type, role, content) VALUES ($1, 'mentor', 'assistant', $2)",
    [userId, fullResponse]
  );

  return fullResponse;
}

/**
 * Setup WebSocket server for voice agent
 */
export function setupVoiceAgent(server) {
  if (!isVoiceEnabled()) {
    console.log('⚠️  Voice agent disabled - voice services not configured');
    return;
  }

  const wss = new WebSocketServer({
    server,
    path: '/voice-agent',
    maxPayload: MAX_AUDIO_CHUNK_SIZE
  });

  wss.on('connection', async (ws, req) => {
    let userId = null;
    let isActive = false;
    let vadBuffer = new VoiceActivityBuffer();
    let idleTimer = null;

    // Authenticate connection
    try {
      userId = authenticateWebSocket(req);
      console.log(`✅ Voice agent connected: user ${userId}`);
    } catch (err) {
      console.error('Voice agent auth failed:', err.message);
      ws.close(1008, 'Authentication failed');
      return;
    }

    // Reset idle timer
    function resetIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (isActive) {
          ws.send(JSON.stringify({
            type: 'status',
            message: 'Deactivated due to inactivity'
          }));
          isActive = false;
        }
      }, IDLE_TIMEOUT);
    }

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);

        // Activation
        if (message.type === 'activate') {
          isActive = true;
          resetIdleTimer();
          ws.send(JSON.stringify({ type: 'status', active: true }));
          console.log(`🎤 Voice agent activated: user ${userId}`);
        }

        // Deactivation
        else if (message.type === 'deactivate') {
          isActive = false;
          vadBuffer.reset();
          if (idleTimer) clearTimeout(idleTimer);
          ws.send(JSON.stringify({ type: 'status', active: false }));
          console.log(`🔇 Voice agent deactivated: user ${userId}`);
        }

        // Audio chunk received
        else if (message.type === 'audio-chunk' && isActive) {
          resetIdleTimer();

          // Decode base64 audio data
          const audioData = Buffer.from(message.audioData.split(',')[1], 'base64');
          vadBuffer.feed(audioData);

          // Check if speech ended (simple timeout-based VAD)
          // In production, you'd use a proper VAD library or service
        }

        // Speech end signal from client
        else if (message.type === 'speech-end' && isActive) {
          if (!vadBuffer.hasData()) return;

          const audioBuffer = vadBuffer.getBuffer();
          vadBuffer.reset();

          // Transcribe audio
          ws.send(JSON.stringify({ type: 'transcribing' }));
          const transcript = await transcribeAudio(audioBuffer);

          if (!transcript || transcript.trim().length === 0) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Could not understand audio'
            }));
            return;
          }

          console.log(`📝 Transcribed: "${transcript}"`);

          // Check for exit commands
          const lowerTranscript = transcript.toLowerCase();
          if (lowerTranscript.includes('stop listening') ||
              lowerTranscript.includes('deactivate') ||
              lowerTranscript.includes('turn off')) {
            isActive = false;
            ws.send(JSON.stringify({ type: 'status', active: false }));
            ws.send(JSON.stringify({
              type: 'text-response',
              text: 'Voice agent deactivated.'
            }));
            return;
          }

          // Generate mentor response
          ws.send(JSON.stringify({ type: 'generating-response' }));
          const response = await generateVoiceResponse(userId, transcript);

          ws.send(JSON.stringify({
            type: 'text-response',
            text: response
          }));

          // Generate and stream audio response
          ws.send(JSON.stringify({ type: 'audio-start' }));

          try {
            const audioBuffer = await textToSpeech(response);

            // Send audio in chunks
            const chunkSize = 4096;
            for (let i = 0; i < audioBuffer.length; i += chunkSize) {
              const chunk = audioBuffer.slice(i, i + chunkSize);
              ws.send(JSON.stringify({
                type: 'audio-chunk',
                data: chunk.toString('base64'),
                isLast: i + chunkSize >= audioBuffer.length
              }));
            }

            ws.send(JSON.stringify({ type: 'audio-end' }));
          } catch (err) {
            console.error('TTS error:', err);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Could not generate audio response'
            }));
          }
        }
      } catch (err) {
        console.error('Voice agent message error:', err);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'An error occurred processing your request'
        }));
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      if (idleTimer) clearTimeout(idleTimer);
      console.log(`👋 Voice agent disconnected: user ${userId}`);
    });

    // Handle errors
    ws.on('error', (err) => {
      console.error('Voice agent WebSocket error:', err);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Voice agent ready. Send "activate" to begin.'
    }));
  });

  console.log('🎙️  Voice agent WebSocket server initialized at /voice-agent');
}
