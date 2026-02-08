import { useState, useEffect, useRef } from 'react';
import { apiGet, apiRawFetch } from '../../utils/api';
import useVoice from '../../hooks/useVoice';
import MicButton from '../voice/MicButton';

export default function MentorChat({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const voice = useVoice();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    apiGet('/mentor/history')
      .then(data => setMessages(data.history || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
    // Check voice availability
    apiGet('/voice/status').then(d => {
      setVoiceAvailable(d.enabled);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!loadingHistory) inputRef.current?.focus();
  }, [loadingHistory]);

  async function handleSend(e) {
    e?.preventDefault();
    if (!input.trim() || streaming) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setStreaming(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const res = await apiRawFetch('/mentor/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullText += data.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: fullText, streaming: true };
                  return updated;
                });
              }
              if (data.done) {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: fullText, streaming: false };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: "Something went wrong. Let's try that again.", streaming: false };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative ml-auto w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
          <div>
            <h2 className="font-semibold text-surface-900">Your Mentor</h2>
            <p className="text-xs text-surface-400">
              {voiceAvailable ? 'Type or speak your question' : 'Ask anything about your business'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-100 text-surface-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loadingHistory && (
            <p className="text-center text-surface-400 text-sm animate-pulse">Loading...</p>
          )}

          {!loadingHistory && messages.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <p className="text-4xl">💡</p>
              <p className="text-surface-500">I know your plan, your phase, and your goals. Ask me anything.</p>
              <div className="space-y-2 text-sm text-surface-400">
                <p>&ldquo;Help me write an outreach message&rdquo;</p>
                <p>&ldquo;Should I target dentists instead?&rdquo;</p>
                <p>&ldquo;I have a call tomorrow — what do I say?&rdquo;</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-brand-600 to-accent-600 text-white rounded-br-md shadow-soft'
                  : 'glass-morphism text-surface-800 rounded-bl-md'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-4 bg-surface-400 ml-0.5 animate-pulse rounded-full" />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-surface-100 px-4 py-3 pb-safe">
          {voice.error && (
            <p className="text-xs text-red-500 mb-2 text-center">{voice.error}</p>
          )}

          {/* Voice feedback */}
          {voiceAvailable && (
            <>
              {voice.transcript && (
                <p className="text-sm text-surface-600 bg-surface-50 px-3 py-1.5 rounded-lg mb-2 truncate">
                  {voice.transcript}
                </p>
              )}
              {voice.isPlaying && (
                <p className="text-xs text-brand-600 animate-pulse mb-2 text-center">Speaking...</p>
              )}
            </>
          )}

          {/* Text input with voice button */}
          <form onSubmit={handleSend} className="flex gap-2 items-end">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={voiceAvailable ? "Type or hold mic to speak..." : "Ask your mentor..."}
              disabled={streaming}
              className="flex-1 px-4 py-3 rounded-xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-surface-900 disabled:opacity-50"
            />

            {/* Voice button - always visible when available */}
            {voiceAvailable && (
              <MicButton
                isRecording={voice.isRecording}
                size="default"
                onPress={() => {
                  voice.stopPlayback();
                  voice.startRecording();
                }}
                onRelease={async () => {
                  const transcript = await voice.stopRecording();
                  if (transcript) {
                    // Auto-send voice message
                    setMessages(prev => [...prev, { role: 'user', content: transcript }]);
                    setStreaming(true);
                    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

                    try {
                      const res = await apiRawFetch('/mentor/message', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: transcript }),
                      });
                      const reader = res.body.getReader();
                      const decoder = new TextDecoder();
                      let fullText = '';
                      let buf = '';
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buf += decoder.decode(value, { stream: true });
                        const lines = buf.split('\n');
                        buf = lines.pop() || '';
                        for (const line of lines) {
                          if (line.startsWith('data: ')) {
                            try {
                              const data = JSON.parse(line.slice(6));
                              if (data.text) {
                                fullText += data.text;
                                setMessages(prev => {
                                  const u = [...prev];
                                  u[u.length - 1] = { role: 'assistant', content: fullText, streaming: true };
                                  return u;
                                });
                              }
                              if (data.done) {
                                setMessages(prev => {
                                  const u = [...prev];
                                  u[u.length - 1] = { role: 'assistant', content: fullText, streaming: false };
                                  return u;
                                });
                                // Play audio response
                                voice.playAudio(fullText);
                              }
                            } catch {}
                          }
                        }
                      }
                    } catch {
                      setMessages(prev => {
                        const u = [...prev];
                        u[u.length - 1] = { role: 'assistant', content: "Something went wrong.", streaming: false };
                        return u;
                      });
                    } finally {
                      setStreaming(false);
                    }
                  }
                }}
                disabled={streaming}
              />
            )}

            {/* Send button */}
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="w-12 h-12 bg-gradient-to-br from-brand-600 to-accent-600 text-white rounded-xl hover:shadow-glow disabled:opacity-40 flex items-center justify-center flex-shrink-0 active:scale-95 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
