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
      const res = await apiRawFetch('/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error('TTS failed');

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setIsPlaying(true);

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
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
