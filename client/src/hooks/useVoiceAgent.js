import { useState, useRef, useCallback, useEffect } from 'react';
import { getWsBase } from '../utils/api';

const SILENCE_THRESHOLD = 25;
const SILENCE_DURATION = 1500;
const MAX_RECORD_MS = 30000;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000];
const HEARTBEAT_MS = 25000;

export default function useVoiceAgent() {
  const [isConnected, setIsConnected] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [lastResponse, setLastResponse] = useState('');
  const [streamingText, setStreamingText] = useState('');

  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const vadRef = useRef(null);
  const isActiveRef = useRef(false);
  const speechRef = useRef(false);
  const silenceStartRef = useRef(null);
  const recordStartRef = useRef(null);

  // Audio playback queue
  const queueRef = useRef([]);
  const playingRef = useRef(null);
  const speakingRef = useRef(false);

  // Reconnection state
  const manualCloseRef = useRef(false);
  const reconnectRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const heartbeatRef = useRef(null);
  const wasActiveRef = useRef(false);
  const activateRef = useRef(null);
  const connectRef = useRef(null);

  // --- Audio playback ---
  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      playingRef.current = null;
      speakingRef.current = false;
      setIsSpeaking(false);
      return;
    }
    const b64 = queueRef.current.shift();
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    playingRef.current = audio;
    audio.onended = () => { URL.revokeObjectURL(url); playNext(); };
    audio.onerror = () => { URL.revokeObjectURL(url); playNext(); };
    audio.play().catch(() => playNext());
  }, []);

  const queueAudio = useCallback((b64) => {
    queueRef.current.push(b64);
    if (!speakingRef.current) {
      speakingRef.current = true;
      setIsSpeaking(true);
      playNext();
    }
  }, [playNext]);

  const interruptPlayback = useCallback(() => {
    if (playingRef.current) { playingRef.current.pause(); playingRef.current = null; }
    queueRef.current = [];
    speakingRef.current = false;
    setIsSpeaking(false);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
  }, []);

  // --- Send audio to server ---
  const sendAudio = useCallback((blob) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const reader = new FileReader();
    reader.onload = () => {
      wsRef.current.send(JSON.stringify({ type: 'audio-data', audioData: reader.result }));
    };
    reader.readAsDataURL(blob);
    setIsProcessing(true);
    setIsListening(false);
  }, []);

  // --- Recording segments ---
  const startSegment = useCallback(() => {
    if (!streamRef.current || !isActiveRef.current) return;

    // Verify audio track is still active
    const tracks = streamRef.current.getAudioTracks();
    if (tracks.length === 0 || tracks[0].readyState === 'ended') return;

    const chunks = [];
    let rec;
    try {
      rec = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
    } catch {
      try { rec = new MediaRecorder(streamRef.current); }
      catch { return; }
    }
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      if (chunks.length > 0 && speechRef.current) {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (blob.size > 500) sendAudio(blob);
      }
      speechRef.current = false;
      silenceStartRef.current = null;
      if (isActiveRef.current) setTimeout(() => startSegment(), 50);
    };
    rec.onerror = () => {
      if (isActiveRef.current) setTimeout(() => startSegment(), 200);
    };
    try {
      rec.start(100);
    } catch {
      if (isActiveRef.current) setTimeout(() => startSegment(), 200);
      return;
    }
    mediaRecorderRef.current = rec;
    recordStartRef.current = Date.now();
    setIsListening(true);
  }, [sendAudio]);

  // --- VAD ---
  const startVAD = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const buf = new Uint8Array(analyser.fftSize);

    vadRef.current = setInterval(() => {
      if (!isActiveRef.current) return;
      analyser.getByteTimeDomainData(buf);
      let max = 0;
      for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i] - 128));

      if (max > SILENCE_THRESHOLD) {
        if (!speechRef.current) {
          speechRef.current = true;
          if (speakingRef.current) interruptPlayback();
        }
        silenceStartRef.current = null;
      } else if (speechRef.current) {
        if (!silenceStartRef.current) silenceStartRef.current = Date.now();
        const silenceMs = Date.now() - silenceStartRef.current;
        const recordMs = Date.now() - (recordStartRef.current || Date.now());
        if (silenceMs >= SILENCE_DURATION || recordMs >= MAX_RECORD_MS) {
          if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
        }
      }
    }, 50);
  }, [interruptPlayback]);

  // --- WebSocket ---
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
    manualCloseRef.current = false;

    const token = localStorage.getItem('token');
    const ws = new WebSocket(`${getWsBase()}/voice-agent?token=${token}`);

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectRef.current = 0;

      // Heartbeat to prevent proxy timeouts
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, HEARTBEAT_MS);

      // Re-activate if was active before disconnect
      if (wasActiveRef.current) {
        wasActiveRef.current = false;
        setTimeout(() => activateRef.current?.(), 300);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'connected': break;
          case 'pong': break;
          case 'status':
            if (typeof msg.active === 'boolean') { isActiveRef.current = msg.active; setIsActive(msg.active); }
            break;
          case 'transcribing': setIsProcessing(true); break;
          case 'generating-response': setIsProcessing(true); setStreamingText(''); break;
          case 'text-chunk': setStreamingText(prev => prev + msg.text); break;
          case 'text-response':
            setLastResponse(msg.text); setStreamingText(''); setIsProcessing(false);
            break;
          case 'sentence-audio': queueAudio(msg.data); break;
          case 'audio-end': break;
          case 'listening': setIsProcessing(false); setIsListening(true); break;
          case 'error': setError(msg.message); setIsProcessing(false); break;
        }
      } catch (err) { console.error('WS parse error:', err); }
    };

    ws.onerror = () => setError('Voice connection error');

    ws.onclose = () => {
      if (wsRef.current !== ws) return; // stale close
      const wasActive = isActiveRef.current;
      setIsConnected(false); setIsActive(false); isActiveRef.current = false; setIsListening(false);
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }

      // Auto-reconnect unless manually closed
      if (!manualCloseRef.current) {
        wasActiveRef.current = wasActive;
        const attempt = reconnectRef.current;
        const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
        reconnectTimerRef.current = setTimeout(() => {
          reconnectRef.current++;
          connectRef.current?.();
        }, delay);
      }
    };

    wsRef.current = ws;
  }, [queueAudio]);

  // --- Stop everything ---
  const stopAll = useCallback(() => {
    if (vadRef.current) { clearInterval(vadRef.current); vadRef.current = null; }
    if (mediaRecorderRef.current?.state === 'recording') {
      speechRef.current = false; // prevent sending partial audio
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    analyserRef.current = null;
    if (playingRef.current) { playingRef.current.pause(); playingRef.current = null; }
    queueRef.current = [];
    speakingRef.current = false;
    setIsSpeaking(false);
    setIsListening(false);
    setIsActive(false);
    setIsProcessing(false);
    isActiveRef.current = false;
  }, []);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    stopAll();
  }, [stopAll]);

  // --- Activate / Deactivate ---
  const activate = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      wsRef.current.send(JSON.stringify({ type: 'activate' }));
      isActiveRef.current = true;
      setIsActive(true);
      setError(null);
      startSegment();
      startVAD();
    } catch {
      setError('Microphone access denied');
    }
  }, [startSegment, startVAD]);

  const deactivate = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'deactivate' }));
    }
    stopAll();
  }, [stopAll]);

  // Keep refs in sync for reconnection callbacks
  connectRef.current = connect;
  activateRef.current = activate;

  useEffect(() => {
    return () => {
      manualCloseRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      stopAll();
      if (wsRef.current) wsRef.current.close();
    };
  }, [stopAll]);

  return {
    isConnected, isActive, isListening, isSpeaking, isProcessing,
    error, lastResponse, streamingText,
    connect, disconnect, activate, deactivate,
    clearError: () => setError(null),
  };
}
