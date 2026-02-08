import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-10">
          {/* Logo mark */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-700 shadow-lg shadow-brand-200">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          {/* Value prop */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-surface-900 tracking-tight leading-tight">
              Build side income.<br />Even when you're exhausted.
            </h1>
            <p className="text-lg text-surface-500 leading-relaxed max-w-sm mx-auto">
              Your AI strategic advisor tells you exactly what to do each day. 
              No guesswork. No overwhelm. Just action.
            </p>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <Link
              to="/register"
              className="inline-block w-full py-4 px-6 bg-brand-700 text-white text-lg font-semibold rounded-2xl hover:bg-brand-800 active:scale-[0.98] transition-all shadow-lg shadow-brand-100"
            >
              Let's find your path
            </Link>

            <p className="text-surface-400 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-6 text-center">
        <p className="text-xs text-surface-300">
          Built for people with 1-2 hours a day and zero energy to waste.
        </p>
      </div>
    </div>
  );
}
