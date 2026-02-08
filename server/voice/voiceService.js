/**
 * Voice Service — Deepgram (Speech-to-Text) + ElevenLabs (Text-to-Speech)
 * 
 * This service handles WebSocket connections for voice mode.
 * Audio flows: User mic → Deepgram (transcription) → Mentor AI → ElevenLabs (speech) → User speaker
 * 
 * NOTE: Requires DEEPGRAM_API_KEY and ELEVENLABS_API_KEY in .env
 * Voice features gracefully degrade to text-only if keys are missing.
 */

import { sendMentorMessage } from '../services/mentorService.js';
import pool from '../db/pool.js';

const DEEPGRAM_URL = 'wss://api.deepgram.com/v1/listen';
const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

/**
 * Check if voice services are configured.
 */
export function isVoiceEnabled() {
  return !!(process.env.DEEPGRAM_API_KEY && process.env.ELEVENLABS_API_KEY);
}

/**
 * Transcribe audio buffer using Deepgram REST API.
 * (Simpler than WebSocket for push-to-talk)
 */
export async function transcribeAudio(audioBuffer) {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error('Deepgram API key not configured.');
  }

  const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'audio/webm',
    },
    body: audioBuffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Deepgram error: ${err}`);
  }

  const data = await res.json();
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
}

/**
 * Convert text to speech using ElevenLabs.
 * Returns audio buffer.
 */
export async function textToSpeech(text) {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured.');
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default: Sarah

  const res = await fetch(`${ELEVENLABS_URL}/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs error: ${err}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Update user voice preferences.
 */
export async function updateVoiceSettings(userId, { enabled, preference }) {
  await pool.query(
    'UPDATE users SET voice_enabled = $1, voice_preference = $2, updated_at = NOW() WHERE id = $3',
    [enabled, preference || 'text', userId]
  );
}
