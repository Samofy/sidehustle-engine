import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch, apiPost, apiDelete } from '../utils/api';
import TaskEditModal from '../components/plan/TaskEditModal';
import TaskCreateModal from '../components/plan/TaskCreateModal';

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
  const [editingTask, setEditingTask] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPhase, setCreatePhase] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    loadPlan();
  }, []);

  async function loadPlan() {
    try {
      const data = await apiGet('/plan/current');
      setPlan(data);
      setExpandedPhase(data.phase);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveTask(taskId, updates) {
    await apiPatch(`/tasks/${taskId}`, updates);
    await loadPlan();
  }

  async function handleCreateTask(taskData) {
    await apiPost('/plan/tasks', taskData);
    await loadPlan();
  }

  async function handleDeleteTask(taskId) {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    try {
      await apiDelete(`/tasks/${taskId}`);
      await loadPlan();
    } catch (err) {
      alert(err.message || 'Failed to delete task');
    }
  }

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
                      <div key={task.id || i} className="flex items-start gap-3 py-2 group">
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
                        {/* Edit/Delete buttons */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingTask(task)}
                            className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Edit task"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete task"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Task Button */}
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-surface-50">
                    <button
                      onClick={() => {
                        setCreatePhase(phase.phase);
                        setShowCreateModal(true);
                      }}
                      className="w-full py-2 text-sm text-brand-600 hover:text-brand-700 font-medium hover:bg-brand-50 rounded-lg transition-colors"
                    >
                      + Add Task to Phase {phase.phase}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => {
          setCreatePhase(plan.phase);
          setShowCreateModal(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-600 text-white rounded-full shadow-lg hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center z-40"
        title="Create new task"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Modals */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onSave={(updates) => handleSaveTask(editingTask.id, updates)}
          onClose={() => setEditingTask(null)}
        />
      )}

      {showCreateModal && (
        <TaskCreateModal
          phase={createPhase}
          onSave={handleCreateTask}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
