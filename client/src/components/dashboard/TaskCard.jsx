import { useState } from 'react';

const ENERGY_BADGES = {
  low: { label: 'Low energy', color: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  high: { label: 'High energy', color: 'bg-orange-100 text-orange-700' },
};

export default function TaskCard({ task, onComplete, onAskMentor, onStartTimer }) {
  const [completing, setCompleting] = useState(false);
  const isCompleted = task.status === 'completed';
  const isSkipped = task.status === 'skipped';
  const badge = ENERGY_BADGES[task.energy_level] || ENERGY_BADGES.medium;

  async function handleComplete() {
    setCompleting(true);
    await onComplete();
    setCompleting(false);
  }

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border transition-all ${
      isCompleted ? 'border-green-200 bg-green-50/30' : 'border-surface-100'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
              {badge.label}
            </span>
            <span className="text-xs text-surface-400">{task.duration_minutes} min</span>
          </div>

          <h3 className={`font-semibold text-surface-900 ${isCompleted ? 'line-through opacity-60' : ''}`}>
            {task.title}
          </h3>

          {task.description && (
            <p className="text-sm text-surface-500 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Completion checkbox */}
        {!isCompleted && !isSkipped && (
          <button
            onClick={handleComplete}
            disabled={completing}
            className="mt-1 w-8 h-8 rounded-full border-2 border-surface-300 hover:border-brand-500 flex items-center justify-center transition-colors flex-shrink-0"
          >
            {completing && (
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            )}
          </button>
        )}

        {isCompleted && (
          <div className="mt-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!isCompleted && !isSkipped && (
        <div className="mt-3 flex gap-3">
          {onStartTimer && (
            <button
              onClick={onStartTimer}
              className="flex-1 text-sm bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              ⏱️ Start Timer
            </button>
          )}
          <button
            onClick={onAskMentor}
            className="flex-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Help with this task →
          </button>
        </div>
      )}
    </div>
  );
}
