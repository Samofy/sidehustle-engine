import { useState, useEffect, useCallback } from 'react';
import { apiPost } from '../../utils/api';

export default function TaskTimer({ task, onComplete, onCancel }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const HOURLY_RATE = 507;

  // Calculate earnings in real-time
  const earnings = (elapsedSeconds / 3600) * HOURLY_RATE;

  // Format time as HH:MM:SS
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Start the timer
  const handleStart = useCallback(async () => {
    try {
      await apiPost(`/tasks/${task.id}/start-timer`);
      setIsRunning(true);
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to start timer:', err);
    }
  }, [task.id]);

  // Pause the timer
  const handlePause = useCallback(async () => {
    try {
      await apiPost(`/tasks/${task.id}/pause-timer`);
      setIsPaused(true);
    } catch (err) {
      console.error('Failed to pause timer:', err);
    }
  }, [task.id]);

  // Resume the timer
  const handleResume = useCallback(async () => {
    try {
      await apiPost(`/tasks/${task.id}/resume-timer`);
      setIsPaused(false);
    } catch (err) {
      console.error('Failed to resume timer:', err);
    }
  }, [task.id]);

  // Complete the task
  const handleComplete = useCallback(async () => {
    if (isCompleting) return;
    setIsCompleting(true);

    try {
      // The backend will automatically calculate actual_duration_seconds
      await onComplete();
    } catch (err) {
      console.error('Failed to complete task:', err);
      setIsCompleting(false);
    }
  }, [onComplete, isCompleting]);

  // Timer tick effect
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const interval = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused]);

  // Auto-start timer on mount if task has started_at
  useEffect(() => {
    if (task.started_at && !task.completed_at) {
      setIsRunning(true);

      // Calculate elapsed time from started_at
      const startedAt = new Date(task.started_at);
      const now = new Date();
      const elapsed = Math.floor((now - startedAt) / 1000) - (task.total_paused_seconds || 0);
      setElapsedSeconds(Math.max(0, elapsed));

      // Check if paused
      if (task.paused_at) {
        setIsPaused(true);
      }
    }
  }, []);

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 shadow-lg border-2 border-purple-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-surface-900 mb-1">
            {task.title}
          </h3>
          {task.description && (
            <p className="text-sm text-surface-600 mb-3">{task.description}</p>
          )}
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-surface-400 hover:text-surface-600 transition-colors ml-4"
            aria-label="Cancel timer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Timer Display */}
      <div className="text-center mb-6">
        <div className="text-5xl font-bold text-purple-600 mb-2 font-mono">
          {formatTime(elapsedSeconds)}
        </div>
        <div className="text-2xl font-semibold text-green-600">
          ${earnings.toFixed(2)} earned
        </div>
        <div className="text-xs text-surface-500 mt-1">
          at ${HOURLY_RATE}/hour
        </div>
      </div>

      {/* Timer Controls */}
      <div className="flex gap-3">
        {!isRunning && (
          <button
            onClick={handleStart}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-xl transition-colors shadow-md"
          >
            Start Timer
          </button>
        )}

        {isRunning && !isPaused && (
          <>
            <button
              onClick={handlePause}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 px-6 rounded-xl transition-colors shadow-md"
            >
              Pause
            </button>
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-6 rounded-xl transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompleting ? 'Completing...' : 'Complete Task'}
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={handleResume}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-xl transition-colors shadow-md"
            >
              Resume
            </button>
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-6 rounded-xl transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompleting ? 'Completing...' : 'Complete Task'}
            </button>
          </>
        )}
      </div>

      {/* Progress indicator */}
      {isRunning && !isPaused && (
        <div className="mt-4 flex items-center justify-center text-sm text-purple-600">
          <div className="animate-pulse mr-2">●</div>
          Timer running...
        </div>
      )}
    </div>
  );
}
