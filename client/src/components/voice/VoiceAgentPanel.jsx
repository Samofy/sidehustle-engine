import { useEffect } from 'react';
import useVoiceAgent from '../../hooks/useVoiceAgent';

export default function VoiceAgentPanel({ onClose }) {
  const voiceAgent = useVoiceAgent();

  // Auto-connect on mount
  useEffect(() => {
    voiceAgent.connect();
    return () => {
      voiceAgent.deactivate();
      voiceAgent.disconnect();
    };
  }, []);

  const handleToggleActive = () => {
    if (voiceAgent.isActive) {
      voiceAgent.deactivate();
    } else {
      voiceAgent.activate();
    }
  };

  return (
    <div className="fixed bottom-24 right-6 w-80 bg-white rounded-2xl shadow-2xl border-2 border-purple-200 z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-100">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${voiceAgent.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <h3 className="font-semibold text-surface-900">Voice Agent</h3>
        </div>
        <button
          onClick={onClose}
          className="text-surface-400 hover:text-surface-600 transition-colors"
          aria-label="Close voice agent"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Connection Status */}
        {!voiceAgent.isConnected && (
          <div className="text-center text-sm text-surface-500">
            Connecting to voice agent...
          </div>
        )}

        {voiceAgent.isConnected && (
          <>
            {/* Activation Toggle */}
            <div className="flex items-center justify-center">
              <button
                onClick={handleToggleActive}
                disabled={!voiceAgent.isConnected}
                className={`w-32 h-32 rounded-full shadow-lg transition-all ${
                  voiceAgent.isActive
                    ? 'bg-gradient-to-br from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 scale-105'
                    : 'bg-gradient-to-br from-surface-300 to-surface-400 hover:from-surface-400 hover:to-surface-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex flex-col items-center justify-center">
                  {voiceAgent.isActive ? (
                    <>
                      <svg className="w-12 h-12 text-white mb-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                      </svg>
                      <span className="text-white font-semibold text-sm">
                        {voiceAgent.isListening ? 'Listening...' : voiceAgent.isSpeaking ? 'Speaking...' : 'Active'}
                      </span>
                    </>
                  ) : (
                    <>
                      <svg className="w-12 h-12 text-white mb-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                      </svg>
                      <span className="text-white font-semibold text-sm">Activate</span>
                    </>
                  )}
                </div>
              </button>
            </div>

            {/* Push-to-Talk Controls */}
            {voiceAgent.isActive && (
              <div className="text-center">
                <p className="text-xs text-surface-500 mb-3">
                  Hold the button below to speak
                </p>
                <button
                  onMouseDown={voiceAgent.startRecording}
                  onMouseUp={voiceAgent.stopRecording}
                  onTouchStart={voiceAgent.startRecording}
                  onTouchEnd={voiceAgent.stopRecording}
                  disabled={voiceAgent.isSpeaking}
                  className={`px-6 py-3 rounded-xl font-medium transition-all ${
                    voiceAgent.isListening
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed shadow-md`}
                >
                  {voiceAgent.isListening ? '🎤 Recording...' : '🎙️ Push to Talk'}
                </button>
              </div>
            )}

            {/* Status Messages */}
            {voiceAgent.lastResponse && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-xs font-medium text-purple-700 mb-1">Last Response:</p>
                <p className="text-sm text-surface-700">{voiceAgent.lastResponse}</p>
              </div>
            )}

            {/* Error Display */}
            {voiceAgent.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-700">{voiceAgent.error}</p>
                <button
                  onClick={voiceAgent.clearError}
                  className="text-xs text-red-600 hover:text-red-700 mt-1"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Instructions */}
            {!voiceAgent.isActive && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-700">
                  💡 Tap the mic button to activate continuous voice conversation with your mentor.
                  Say "stop listening" or "deactivate" to turn it off.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
