import { useEffect } from 'react';
import useVoiceAgent from '../../hooks/useVoiceAgent';

export default function VoiceAgentPanel({ onClose }) {
  const va = useVoiceAgent();

  useEffect(() => {
    va.connect();
    return () => { va.deactivate(); va.disconnect(); };
  }, []);

  const statusLabel = va.isActive
    ? va.isListening ? 'Listening...'
      : va.isSpeaking ? 'Speaking...'
      : va.isProcessing ? 'Thinking...'
      : 'Active'
    : 'Activate';

  const buttonColor = va.isActive
    ? va.isListening ? 'from-green-400 to-green-600 animate-pulse'
      : va.isSpeaking ? 'from-blue-400 to-blue-600'
      : va.isProcessing ? 'from-yellow-400 to-yellow-600 animate-pulse'
      : 'from-green-400 to-green-600'
    : 'from-surface-300 to-surface-400 hover:from-surface-400 hover:to-surface-500';

  return (
    <div className="fixed bottom-24 right-6 w-80 bg-white rounded-2xl shadow-2xl border-2 border-purple-200 z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-100">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${va.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <h3 className="font-semibold text-surface-900">Voice Agent</h3>
        </div>
        <button onClick={onClose} className="text-surface-400 hover:text-surface-600 transition-colors" aria-label="Close">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {!va.isConnected && (
          <div className="text-center text-sm text-surface-500">Connecting...</div>
        )}

        {va.isConnected && (
          <>
            {/* Main button */}
            <div className="flex items-center justify-center">
              <button
                onClick={va.isActive ? va.deactivate : va.activate}
                disabled={!va.isConnected}
                className={`w-32 h-32 rounded-full shadow-lg transition-all bg-gradient-to-br ${buttonColor} ${va.isActive ? 'scale-105' : ''} disabled:opacity-50`}
              >
                <div className="flex flex-col items-center justify-center">
                  <svg className="w-12 h-12 text-white mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  <span className="text-white font-semibold text-sm">{statusLabel}</span>
                </div>
              </button>
            </div>

            {/* Streaming / last response */}
            {(va.streamingText || va.lastResponse) && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                <p className="text-sm text-surface-700">
                  {va.streamingText || va.lastResponse}
                  {va.streamingText && <span className="inline-block w-1.5 h-4 bg-surface-400 ml-0.5 animate-pulse rounded-full" />}
                </p>
              </div>
            )}

            {/* Error */}
            {va.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-700">{va.error}</p>
                <button onClick={va.clearError} className="text-xs text-red-600 hover:text-red-700 mt-1">Dismiss</button>
              </div>
            )}

            {/* Instructions */}
            {!va.isActive && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-700">
                  Tap Activate to start a hands-free conversation. Just speak naturally — your mentor will listen and respond like a phone call. Say "stop listening" to deactivate.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
