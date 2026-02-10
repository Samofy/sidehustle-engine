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

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100); // Collect in 100ms chunks
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

        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach(t => t.stop());

        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Send to backend for transcription
        try {
          const res = await apiRawFetch('/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'audio/webm' },
            body: audioBlob,
          });

          const data = await res.json();
          if (data.transcript) {
            setTranscript(data.transcript);
            resolve(data.transcript);
          } else {
            setError('Could not understand audio. Try again or switch to text.');
            resolve('');
          }
        } catch (err) {
          setError('Transcription failed. Switching to text.');
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
