import { useState, useRef, useCallback } from 'react';
import { apiRawFetch } from '../utils/api';

export default function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);

  const recordStartRef = useRef(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let rec;
      try { rec = new MediaRecorder(stream, { mimeType: 'audio/webm' }); }
      catch { rec = new MediaRecorder(stream); }
      mediaRecorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.start(100);
      recordStartRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow mic access in your browser settings.');
      } else {
        setError('Could not access microphone. Falling back to text.');
      }
    }
  }, []);

  const stopRecording = useCallback(async () => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state !== 'recording') {
        resolve('');
        return;
      }

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        mediaRecorder.stream.getTracks().forEach(t => t.stop());

        // Check minimum recording duration (500ms)
        const duration = Date.now() - (recordStartRef.current || Date.now());
        if (duration < 500 || chunksRef.current.length === 0) {
          setError('Recording too short. Hold the mic button longer.');
          resolve('');
          return;
        }

        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        try {
          const res = await apiRawFetch('/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'audio/webm' },
            body: audioBlob,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            setError(errData.error || `Transcription failed (${res.status})`);
            resolve('');
            return;
          }

          const data = await res.json();
          if (data.transcript) {
            setTranscript(data.transcript);
            resolve(data.transcript);
          } else {
            setError('Could not understand audio. Try speaking louder or closer to the mic.');
            resolve('');
          }
        } catch (err) {
          console.error('Transcription error:', err);
          setError('Transcription failed. Check your connection and try again.');
          resolve('');
        }
      };

      mediaRecorder.stop();
    });
  }, []);

  const playAudio = useCallback(async (text) => {
    try {
      // Use streaming endpoint for faster response
      const res = await apiRawFetch('/voice/speak-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error('TTS failed');

      // Stop any existing playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setIsPlaying(true);

      // Read ALL chunks from stream before playing
      const reader = res.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          chunks.push(value);
        }
        if (done) break;
      }

      // Now play the complete audio
      if (chunks.length > 0) {
        const audioBlob = new Blob(chunks, { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = (err) => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          console.error('Audio playback error:', err);
        };

        await audio.play();
      } else {
        setIsPlaying(false);
      }
    } catch (err) {
      setIsPlaying(false);
      console.error('Audio playback error:', err);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  return {
    isRecording,
    isPlaying,
    transcript,
    error,
    startRecording,
    stopRecording,
    playAudio,
    stopPlayback,
    clearError: () => setError(null),
  };
}
