import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../utils/api';

const PHASE_NAMES = {
  1: 'Setup',
  2: 'Manual Outreach',
  3: 'Dual Channel',
  4: 'Scale',
};

const PHASE_DAYS = {
  1: 'Days 1-7',
  2: 'Days 8-14',
  3: 'Days 15-30',
  4: 'Day 30+',
};

export default function PlanOverview() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedPhase, setExpandedPhase] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiGet('/plan/current')
      .then(data => {
        setPlan(data);
        setExpandedPhase(data.phase);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <p className="text-surface-500 animate-pulse">Loading your plan...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 px-6">
        <div className="text-center space-y-4">
          <p className="text-surface-500">No plan generated yet.</p>
          <button onClick={() => navigate('/dashboard')} className="text-brand-600 font-medium">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Group tasks by phase
  const phases = [1, 2, 3, 4].map(p => ({
    phase: p,
    name: PHASE_NAMES[p],
    days: PHASE_DAYS[p],
    tasks: (plan.tasks || []).filter(t => t.phase === p),
    isCurrent: plan.phase === p,
  }));

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="px-6 pt-8 pb-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-surface-900">Your Game Plan</h1>
          {plan.niche && (
            <p className="text-surface-500 mt-1">{plan.niche}</p>
          )}
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="max-w-lg mx-auto space-y-3">
          {phases.map((phase) => {
            const completed = phase.tasks.filter(t => t.status === 'completed').length;
            const total = phase.tasks.length;
            const isExpanded = expandedPhase === phase.phase;

            return (
              <div key={phase.phase} className="bg-white rounded-2xl shadow-sm border border-surface-100 overflow-hidden">
                <button
                  onClick={() => setExpandedPhase(isExpanded ? null : phase.phase)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      phase.isCurrent
                        ? 'bg-brand-600 text-white'
                        : completed === total && total > 0
                        ? 'bg-green-500 text-white'
                        : 'bg-surface-200 text-surface-500'
                    }`}>
                      {completed === total && total > 0 ? '✓' : phase.phase}
                    </div>
                    <div>
                      <p className="font-semibold text-surface-900">
                        {phase.name}
                        {phase.isCurrent && (
                          <span className="ml-2 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-surface-400">{phase.days} · {completed}/{total} tasks</p>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-surface-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && phase.tasks.length > 0 && (
                  <div className="px-5 pb-4 space-y-2 border-t border-surface-50">
                    {phase.tasks.map((task, i) => (
                      <div key={task.id || i} className="flex items-start gap-3 py-2">
                        <div className={`w-5 h-5 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          task.status === 'completed'
                            ? 'bg-green-500'
                            : task.status === 'skipped'
                            ? 'bg-surface-300'
                            : 'border-2 border-surface-300'
                        }`}>
                          {task.status === 'completed' && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            task.status === 'completed' ? 'text-surface-400 line-through' : 'text-surface-800'
                          }`}>
                            Day {task.day_number}: {task.title}
                          </p>
                          <p className="text-xs text-surface-400 mt-0.5">
                            {task.duration_minutes} min · {task.energy_level} energy
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
