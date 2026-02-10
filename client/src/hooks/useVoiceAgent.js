import { useState, useRef, useCallback, useEffect } from 'react';

export default function useVoiceAgent() {
  const [isConnected, setIsConnected] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Get WebSocket URL
  const getWsUrl = useCallback(() => {
    const token = localStorage.getItem('token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('http://', '').replace('https://', '')
      : 'localhost:3001';
    return `${protocol}//${host}/voice-agent?token=${token}`;
  }, []);

  // Connect to voice agent
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Already connected');
      return;
    }

    const ws = new WebSocket(getWsUrl());

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log('Voice agent connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'connected':
            console.log('Voice agent ready');
            break;

          case 'status':
            setIsActive(message.active);
            if (message.message) {
              console.log(message.message);
            }
            break;

          case 'transcribing':
            setIsListening(false);
            console.log('Transcribing audio...');
            break;

          case 'generating-response':
            console.log('Generating response...');
            break;

          case 'text-response':
            setLastResponse(message.text);
            console.log('Response:', message.text);
            break;

          case 'audio-start':
            setIsSpeaking(true);
            audioChunksRef.current = [];
            break;

          case 'audio-chunk':
            // Accumulate audio chunks
            const chunk = Uint8Array.from(atob(message.data), c => c.charCodeAt(0));
            audioChunksRef.current.push(chunk);

            if (message.isLast) {
              playAudioChunks();
            }
            break;

          case 'audio-end':
            setIsSpeaking(false);
            setIsListening(true);
            break;

          case 'error':
            setError(message.message);
            console.error('Voice agent error:', message.message);
            break;

          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error occurred');
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsActive(false);
      setIsListening(false);
      console.log('Voice agent disconnected');
    };

    wsRef.current = ws;
  }, [getWsUrl]);

  // Disconnect from voice agent
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsConnected(false);
    setIsActive(false);
    setIsListening(false);
  }, []);

  // Play accumulated audio chunks
  const playAudioChunks = useCallback(async () => {
    try {
      if (audioChunksRef.current.length === 0) return;

      // Combine all chunks into single buffer
      const totalLength = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunksRef.current) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Create blob and play
      const audioBlob = new Blob([combinedBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err) {
      console.error('Error playing audio:', err);
      setError('Could not play audio response');
    }
  }, []);

  // Activate voice agent
  const activate = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to voice agent');
      return;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      let audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      // Send audio when recorder stops
      mediaRecorder.onstop = async () => {
        if (audioChunks.length === 0) return;

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();

        reader.onload = () => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'audio-chunk',
              audioData: reader.result
            }));

            // Signal speech end
            wsRef.current.send(JSON.stringify({
              type: 'speech-end'
            }));
          }
        };

        reader.readAsDataURL(audioBlob);
        audioChunks = [];
      };

      mediaRecorderRef.current = mediaRecorder;

      // Activate voice agent
      wsRef.current.send(JSON.stringify({ type: 'activate' }));
      setIsListening(true);
      setError(null);

      console.log('Voice agent activated');
    } catch (err) {
      console.error('Error activating voice agent:', err);
      setError('Microphone access denied or not available');
    }
  }, []);

  // Deactivate voice agent
  const deactivate = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'deactivate' }));
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }

    setIsListening(false);
    setIsActive(false);
  }, []);

  // Start recording (push-to-talk style)
  const startRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'recording') return;

    mediaRecorderRef.current.start();
    setIsListening(true);
    console.log('Started recording');
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state !== 'recording') return;

    mediaRecorderRef.current.stop();
    setIsListening(false);
    console.log('Stopped recording');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isActive,
    isListening,
    isSpeaking,
    error,
    lastTranscript,
    lastResponse,
    connect,
    disconnect,
    activate,
    deactivate,
    startRecording,
    stopRecording,
    clearError: () => setError(null),
  };
}
