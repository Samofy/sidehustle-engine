import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPatch, apiPost } from '../utils/api';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await apiGet('/settings');
      setSettings(data.settings);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePreferences(updates) {
    setSaving(true);
    setMessage('');
    try {
      const data = await apiPatch('/settings/preferences', updates);
      setSettings(prev => ({ ...prev, ...data.settings }));
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetAccount() {
    if (resetConfirmation !== 'DELETE') {
      setMessage('Please type DELETE to confirm.');
      return;
    }

    setResetting(true);
    setMessage('');
    try {
      await apiPost('/settings/reset-account', { confirmation: resetConfirmation });
      setMessage('Account reset successfully! Redirecting...');
      setTimeout(() => {
        logout();
        navigate('/pathfinder');
      }, 2000);
    } catch (err) {
      setMessage(err.message || 'Failed to reset account.');
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <p className="text-surface-500 text-lg animate-pulse">Loading settings...</p>
      </div>
    );
  }

  const modelOptions = [
    { value: 'claude-opus-4-20250514', label: 'Opus 4 (Most Capable)', description: 'Best quality, slower responses' },
    { value: 'claude-sonnet-4-20250514', label: 'Sonnet 4 (Recommended)', description: 'Balanced speed and quality' },
    { value: 'claude-3-5-haiku-20241022', label: 'Haiku 3.5 (Fastest)', description: 'Quick responses, lighter tasks' },
  ];

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 border-b border-surface-200 bg-white">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-surface-900">Settings</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-brand-600 hover:text-brand-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Success/Error Message */}
          {message && (
            <div className={`px-4 py-3 rounded-xl border ${
              message.includes('success') || message.includes('saved')
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {message}
            </div>
          )}

          {/* Account Info Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-surface-100">
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Account Information</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-surface-500">Email</label>
                <p className="text-surface-900">{settings.email}</p>
              </div>
              <div>
                <label className="text-sm text-surface-500">Name</label>
                <p className="text-surface-900">{settings.name}</p>
              </div>
              <div>
                <label className="text-sm text-surface-500">Member Since</label>
                <p className="text-surface-900">
                  {new Date(settings.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Claude Model Selector */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-surface-100">
            <h2 className="text-lg font-semibold text-surface-900 mb-4">AI Model</h2>
            <p className="text-sm text-surface-500 mb-4">
              Choose which Claude model powers your mentor interactions and plan generation.
            </p>
            <div className="space-y-3">
              {modelOptions.map(option => (
                <label
                  key={option.value}
                  className={`block p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    settings.preferred_model === option.value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-surface-200 hover:border-surface-300'
                  }`}
                >
                  <div className="flex items-start">
                    <input
                      type="radio"
                      name="model"
                      value={option.value}
                      checked={settings.preferred_model === option.value}
                      onChange={(e) => handleSavePreferences({ preferred_model: e.target.value })}
                      disabled={saving}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-surface-900">{option.label}</div>
                      <div className="text-sm text-surface-500">{option.description}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Voice Preferences */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-surface-100">
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Voice Settings</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-surface-900">Voice Interactions</p>
                <p className="text-sm text-surface-500">Enable voice input and audio responses</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.voice_enabled}
                  onChange={(e) => handleSavePreferences({ voice_enabled: e.target.checked })}
                  disabled={saving}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 rounded-2xl p-6 border-2 border-red-200">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h2>
            <p className="text-sm text-red-700 mb-4">
              This will delete all your plans, tasks, check-ins, and conversations. Your account will remain active but you'll start from scratch.
            </p>
            <button
              onClick={() => setShowResetModal(true)}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
            >
              Reset Account Data
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-surface-900 mb-4">Confirm Account Reset</h3>
            <p className="text-surface-600 mb-4">
              This action cannot be undone. All your data will be permanently deleted, but your account will remain active.
            </p>
            <p className="text-sm text-surface-500 mb-4">
              Type <span className="font-mono font-bold">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={resetConfirmation}
              onChange={(e) => setResetConfirmation(e.target.value)}
              className="w-full px-4 py-2 border-2 border-surface-300 rounded-xl focus:border-brand-500 focus:outline-none mb-4"
              placeholder="Type DELETE"
              disabled={resetting}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmation('');
                  setMessage('');
                }}
                disabled={resetting}
                className="flex-1 px-4 py-2 bg-surface-100 text-surface-700 font-medium rounded-xl hover:bg-surface-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAccount}
                disabled={resetting || resetConfirmation !== 'DELETE'}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {resetting ? 'Resetting...' : 'Reset Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
