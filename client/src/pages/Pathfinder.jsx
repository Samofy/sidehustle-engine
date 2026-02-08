import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, apiGet } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const FRIENDLY_LOADING = [
  "Thinking about your situation...",
  "Analyzing your strengths...",
  "Mapping out possibilities...",
  "Finding the clearest path forward...",
  "Almost there...",
];

function ProgressDots({ current, total }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-500 ${
            i < current
              ? 'w-8 bg-brand-600'
              : i === current
              ? 'w-8 bg-brand-400'
              : 'w-2 bg-surface-300'
          }`}
        />
      ))}
    </div>
  );
}

function RecommendationCard({ text, onContinue }) {
  return (
    <div className="animate-fadeIn space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-surface-900">Your Path</h2>
        <p className="text-surface-500">Here's what I recommend based on everything you told me.</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-surface-100 leading-relaxed text-surface-800 whitespace-pre-wrap text-[15px]">
        {text}
      </div>

      <button
        onClick={onContinue}
        className="w-full py-4 bg-brand-700 text-white text-lg font-semibold rounded-2xl hover:bg-brand-800 active:scale-[0.98] transition-all"
      >
        Build my Game Plan
      </button>
    </div>
  );
}

export default function Pathfinder() {
  const [stage, setStage] = useState('loading');
  const [question, setQuestion] = useState('');
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(7);
  const [answer, setAnswer] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  useEffect(() => {
    if (user?.onboarding_complete) {
      apiGet('/pathfinder/recommendation')
        .then((data) => {
          setRecommendation(data.recommendation);
          setStage('already-done');
        })
        .catch(() => startFresh());
    } else {
      startFresh();
    }
  }, []);

  async function startFresh() {
    try {
      const data = await apiPost('/pathfinder/start');
      setQuestion(data.question);
      setQuestionNumber(data.questionNumber);
      setTotalQuestions(data.totalQuestions);
      setStage('question');
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (stage === 'question' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [stage, questionNumber]);

  useEffect(() => {
    if (stage !== 'thinking') return;
    let i = 0;
    setLoadingMessage(FRIENDLY_LOADING[0]);
    const interval = setInterval(() => {
      i = (i + 1) % FRIENDLY_LOADING.length;
      setLoadingMessage(FRIENDLY_LOADING[i]);
    }, 3000);
    return () => clearInterval(interval);
  }, [stage]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!answer.trim() || submitting) return;

    setSubmitting(true);
    const currentAnswer = answer;
    setAnswer('');

    try {
      if (questionNumber >= totalQuestions) {
        setStage('thinking');
      }

      const data = await apiPost('/pathfinder/respond', { response: currentAnswer });

      if (data.isComplete) {
        setRecommendation(data.recommendation);
        setStage('recommendation');
        setUser(prev => ({ ...prev, onboarding_complete: true }));
      } else {
        setQuestion(data.question);
        setQuestionNumber(data.questionNumber);
        setStage('question');
      }
    } catch (err) {
      console.error(err);
      setStage('question');
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    navigate('/dashboard');
  }

  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <p className="text-surface-500 text-lg animate-pulse">Getting ready...</p>
      </div>
    );
  }

  if (stage === 'already-done') {
    return (
      <div className="min-h-screen bg-surface-50 px-6 py-12">
        <div className="max-w-lg mx-auto">
          <RecommendationCard text={recommendation} onContinue={handleContinue} />
        </div>
      </div>
    );
  }

  if (stage === 'thinking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 px-6">
        <div className="space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
          </div>
          <p className="text-lg text-surface-600 animate-pulse">
            {loadingMessage}
          </p>
        </div>
      </div>
    );
  }

  if (stage === 'recommendation') {
    return (
      <div className="min-h-screen bg-surface-50 px-6 py-12">
        <div className="max-w-lg mx-auto">
          <RecommendationCard text={recommendation} onContinue={handleContinue} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <div className="px-6 pt-8 pb-4">
        <ProgressDots current={questionNumber - 1} total={totalQuestions} />
        <p className="text-center text-sm text-surface-400 mt-3">
          Question {questionNumber} of {totalQuestions}
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 pb-8">
        <div className="max-w-lg mx-auto w-full space-y-8">
          <h2
            key={questionNumber}
            className="text-2xl md:text-3xl font-semibold text-surface-900 leading-snug animate-fadeIn"
          >
            {question}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 animate-fadeIn">
            <textarea
              ref={inputRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer..."
              rows={3}
              className="w-full px-5 py-4 rounded-2xl border border-surface-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-surface-900 text-lg resize-none placeholder:text-surface-300"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />

            <button
              type="submit"
              disabled={!answer.trim() || submitting}
              className="w-full py-4 bg-brand-700 text-white text-lg font-semibold rounded-2xl hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            >
              {submitting ? 'Sending...' : questionNumber >= totalQuestions ? 'Get my recommendation' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
