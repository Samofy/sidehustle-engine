import { useState, useEffect } from 'react';

export default function TaskEditModal({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [dayNumber, setDayNumber] = useState(task.day_number);
  const [durationMinutes, setDurationMinutes] = useState(task.duration_minutes);
  const [energyLevel, setEnergyLevel] = useState(task.energy_level);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        title,
        description,
        day_number: parseInt(dayNumber),
        duration_minutes: parseInt(durationMinutes),
        energy_level: energyLevel,
      });
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-surface-900 mb-4">Edit Task</h3>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border-2 border-surface-300 rounded-xl focus:border-brand-500 focus:outline-none"
              placeholder="Task title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border-2 border-surface-300 rounded-xl focus:border-brand-500 focus:outline-none resize-none"
              placeholder="Task description"
            />
          </div>

          {/* Day Number */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Day Number
            </label>
            <input
              type="number"
              value={dayNumber}
              onChange={(e) => setDayNumber(e.target.value)}
              min={1}
              max={365}
              className="w-full px-4 py-2 border-2 border-surface-300 rounded-xl focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              min={5}
              step={5}
              className="w-full px-4 py-2 border-2 border-surface-300 rounded-xl focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Energy Level */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">
              Energy Level
            </label>
            <div className="flex gap-2">
              {['low', 'medium', 'high'].map(level => (
                <button
                  key={level}
                  onClick={() => setEnergyLevel(level)}
                  className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
                    energyLevel === level
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-surface-100 text-surface-700 font-medium rounded-xl hover:bg-surface-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex-1 px-4 py-2 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
