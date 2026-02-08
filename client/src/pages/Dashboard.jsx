import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPatch } from '../utils/api';
import TaskCard from '../components/dashboard/TaskCard';
import CareerArcCounter from '../components/dashboard/CareerArcCounter';
import StreakDisplay from '../components/dashboard/StreakDisplay';
import EnergyRating from '../components/checkin/EnergyRating';
import CheckInFlow from '../components/checkin/CheckInFlow';
import MentorChat from '../components/chat/MentorChat';

export default function Dashboard() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [careerArc, setCareerArc] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState('');
  const [showMentor, setShowMentor] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [energy, setEnergy] = useState(null);
  const [needsEnergy, setNeedsEnergy] = useState(false);

  useEffect(() => {
    if (!user?.onboarding_complete) {
      navigate('/pathfinder');
      return;
    }
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      // Try to load existing plan
      const planData = await apiGet('/plan/current').catch(() => null);

      if (planData) {
        setPlan(planData);
        const todayData = await apiGet('/tasks/today');
        setTasks(todayData.tasks || []);
      }

      const arcData = await apiGet('/plan/career-arc').catch(() => null);
      if (arcData) setCareerArc(arcData);

      // Check if user needs energy check-in today
      const today = new Date().toISOString().split('T')[0];
      const lastCheckIn = user.last_check_in_date
        ? new Date(user.last_check_in_date).toISOString().split('T')[0]
        : null;

      if (user.total_tasks_completed > 0 && lastCheckIn !== today) {
        setNeedsEnergy(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGeneratePlan() {
    setGeneratingPlan(true);
    setPlanError('');
    try {
      await apiPost('/plan/generate');
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setPlanError(err.message || 'Something went wrong generating your plan. Please try again.');
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function handleCompleteTask(taskId) {
    try {
      await apiPatch(`/tasks/${taskId}/complete`);
      // Refresh data
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t));
      const arcData = await apiGet('/plan/career-arc').catch(() => null);
      if (arcData) setCareerArc(arcData);
      // Refresh user for streak
      setUser(prev => ({
        ...prev,
        current_streak: (prev.current_streak || 0) + 1,
        total_tasks_completed: (prev.total_tasks_completed || 0) + 1,
      }));
    } catch (err) {
      console.error(err);
    }
  }

  function handleEnergySelected(rating) {
    setEnergy(rating);
    setNeedsEnergy(false);
    // Check if they need a check-in (returning user)
    if (user?.total_tasks_completed > 0) {
      setShowCheckIn(true);
    }
  }

  async function handleAdvanceDay() {
    if (!confirm('Skip to next day? This will move your plan forward.')) return;
    try {
      await apiPost('/plan/advance-day');
      await loadDashboard(); // Reload to show new day's tasks
    } catch (err) {
      console.error(err);
      alert('Failed to advance day. Please try again.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <p className="text-surface-500 text-lg animate-pulse">Loading your dashboard...</p>
      </div>
    );
  }

  // Energy rating screen (returning users)
  if (needsEnergy && user?.total_tasks_completed > 0) {
    return (
      <EnergyRating onSelect={handleEnergySelected} userName={user?.name} />
    );
  }

  // Check-in flow
  if (showCheckIn) {
    return (
      <CheckInFlow
        energy={energy}
        onComplete={() => {
          setShowCheckIn(false);
          loadDashboard();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <div className="gradient-mesh px-6 pt-8 pb-6 shadow-soft">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900">
              {getGreeting()}{user?.name ? `, ${user.name}` : ''}
            </h1>
            {plan && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-surface-500 text-sm">
                  Phase {plan.phase} · Day {getDayNumber(plan.start_date)}
                </p>
                <button
                  onClick={handleAdvanceDay}
                  className="text-xs px-2 py-1 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 transition-colors"
                  title="Skip to next day"
                >
                  → Next Day
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="text-sm text-surface-400 hover:text-surface-600"
            >
              Settings
            </button>
            <button
              onClick={logout}
              className="text-sm text-surface-400 hover:text-surface-600"
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-24">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Career Arc */}
          {careerArc && <CareerArcCounter data={careerArc} />}

          {/* Streak */}
          <StreakDisplay streak={user?.current_streak || 0} longest={user?.longest_streak || 0} />

          {/* No plan yet */}
          {!plan && (
            <div className="premium-card text-center space-y-4">
              <h2 className="text-xl font-semibold gradient-text">Ready to build your plan?</h2>
              <p className="text-surface-500">
                Based on your Pathfinder results, I'll create a day-by-day execution plan tailored to your situation.
              </p>
              {planError && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {planError}
                </div>
              )}
              <button
                onClick={handleGeneratePlan}
                disabled={generatingPlan}
                className="premium-button w-full py-4"
              >
                {generatingPlan ? 'Building your plan...' : 'Generate my Game Plan'}
              </button>
            </div>
          )}

          {/* Today's Tasks */}
          {tasks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-surface-900">Today's Focus</h2>
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={() => handleCompleteTask(task.id)}
                  onAskMentor={() => {
                    setShowMentor(true);
                  }}
                />
              ))}
            </div>
          )}

          {/* Plan overview link */}
          {plan && (
            <button
              onClick={() => navigate('/plan')}
              className="w-full py-3 text-brand-600 bg-brand-50 rounded-xl hover:bg-brand-100 font-medium transition-colors"
            >
              View full Game Plan
            </button>
          )}
        </div>
      </div>

      {/* Mentor FAB */}
      <button
        onClick={() => setShowMentor(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-brand-600 to-accent-600 text-white rounded-full shadow-glow hover:shadow-glow-lg active:scale-95 transition-all flex items-center justify-center z-40"
        title="Talk to Mentor (Voice Enabled)"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* Mentor Chat Panel */}
      {showMentor && <MentorChat onClose={() => setShowMentor(false)} />}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDayNumber(startDate) {
  const start = new Date(startDate);
  const today = new Date();
  return Math.max(1, Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1);
}
