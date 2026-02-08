export default function MicButton({ isRecording, onPress, onRelease, disabled, size = 'default' }) {
  const sizeClasses = size === 'large' ? 'w-20 h-20' : 'w-14 h-14';
  const iconSize = size === 'large' ? 'w-8 h-8' : 'w-6 h-6';

  return (
    <button
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onTouchStart={(e) => { e.preventDefault(); onPress(); }}
      onTouchEnd={(e) => { e.preventDefault(); onRelease(); }}
      disabled={disabled}
      className={`${sizeClasses} rounded-full flex items-center justify-center transition-all active:scale-95 ${
        isRecording
          ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse'
          : 'bg-brand-700 text-white hover:bg-brand-800 shadow-lg hover:shadow-xl animate-pulse-slow'
      } disabled:opacity-40`}
      title={isRecording ? 'Release to send' : 'Hold to speak'}
    >
      <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    </button>
  );
}
