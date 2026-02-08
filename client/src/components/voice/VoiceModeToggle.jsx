export default function VoiceModeToggle({ mode, onToggle, disabled }) {
  return (
    <div className="flex items-center gap-1 bg-surface-100 rounded-full p-0.5">
      <button
        onClick={() => onToggle('text')}
        disabled={disabled}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          mode === 'text'
            ? 'bg-white text-surface-900 shadow-sm'
            : 'text-surface-400 hover:text-surface-600'
        }`}
      >
        Text
      </button>
      <button
        onClick={() => onToggle('voice')}
        disabled={disabled}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          mode === 'voice'
            ? 'bg-white text-surface-900 shadow-sm'
            : 'text-surface-400 hover:text-surface-600'
        }`}
      >
        🎙 Voice
      </button>
    </div>
  );
}
