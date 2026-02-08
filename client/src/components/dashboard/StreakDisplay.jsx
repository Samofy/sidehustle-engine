export default function StreakDisplay({ streak, longest }) {
  const flame = streak > 0;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-surface-100 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{flame ? '🔥' : '💤'}</span>
        <div>
          <p className="font-semibold text-surface-900">
            {streak === 0
              ? "Let's get started"
              : streak === 1
              ? '1 day streak'
              : `${streak} day streak`}
          </p>
          {longest > 0 && (
            <p className="text-xs text-surface-400">Best: {longest} days</p>
          )}
        </div>
      </div>

      {streak >= 3 && (
        <span className="text-sm font-medium text-brand-600 bg-brand-50 px-3 py-1 rounded-full">
          {streak >= 30 ? 'Legend' : streak >= 14 ? 'On fire' : streak >= 7 ? 'Rolling' : 'Building'}
        </span>
      )}
    </div>
  );
}
