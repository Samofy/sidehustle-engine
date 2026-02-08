import { useState } from 'react';
import { apiPost } from '../../utils/api';

const SKIP_REASONS = [
  { value: 'too_hard', label: 'Too hard' },
  { value: 'too_long', label: 'Too long' },
  { value: 'unclear', label: 'Unclear what to do' },
  { value: 'no_time', label: 'Ran out of time' },
  { value: 'motivation', label: 'Lost motivation' },
];

export default function CheckInFlow({ energy, onComplete }) {
  const [step, setStep] = useState('question'); // question | skip-reason | response
  const [skipReason, setSkipReason] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitCheckIn(completed, reason = null) {
    setLoading(true);
    try {
      const data = await apiPost('/checkin', {
        energyRating: energy,
        taskCompleted: completed,
        skipReason: reason,
      });
      setAiResponse(data.aiResponse);
      setStep('response');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'question') {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full space-y-8 text-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-surface-900">Quick check-in</h2>
            <p className="text-surface-500">Did you complete yesterday's task?</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => submitCheckIn(true)}
              disabled={loading}
              className="flex-1 py-5 bg-green-600 text-white text-lg font-semibold rounded-2xl hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? '...' : 'Yes ✓'}
            </button>
            <button
              onClick={() => setStep('skip-reason')}
              disabled={loading}
              className="flex-1 py-5 bg-surface-200 text-surface-700 text-lg font-semibold rounded-2xl hover:bg-surface-300 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Not today
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'skip-reason') {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-surface-900">No worries</h2>
            <p className="text-surface-500">What got in the way?</p>
          </div>

          <div className="space-y-3">
            {SKIP_REASONS.map((reason) => (
              <button
                key={reason.value}
                onClick={() => {
                  setSkipReason(reason.value);
                  submitCheckIn(false, reason.value);
                }}
                disabled={loading}
                className="w-full py-4 px-5 text-left bg-white border border-surface-200 rounded-2xl hover:border-brand-400 active:scale-[0.98] transition-all disabled:opacity-50 font-medium text-surface-700"
              >
                {reason.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // AI response
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-6">
      <div className="max-w-lg w-full space-y-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-surface-100">
          <p className="text-surface-800 leading-relaxed whitespace-pre-wrap">
            {aiResponse}
          </p>
        </div>

        <button
          onClick={onComplete}
          className="w-full py-4 bg-brand-700 text-white text-lg font-semibold rounded-2xl hover:bg-brand-800 active:scale-[0.98] transition-all"
        >
          Let's go →
        </button>
      </div>
    </div>
  );
}
