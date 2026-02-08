const ENERGY_OPTIONS = [
  {
    value: 1,
    emoji: '😴',
    label: 'Running on fumes',
    description: "Barely awake. Let's keep it light.",
    color: 'border-red-200 bg-red-50 hover:border-red-400',
  },
  {
    value: 2,
    emoji: '😐',
    label: 'Okay',
    description: 'Not great, not terrible. Can get things done.',
    color: 'border-yellow-200 bg-yellow-50 hover:border-yellow-400',
  },
  {
    value: 3,
    emoji: '⚡',
    label: 'Actually have energy',
    description: 'Good day. Ready to push.',
    color: 'border-green-200 bg-green-50 hover:border-green-400',
  },
];

export default function EnergyRating({ onSelect, userName }) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-surface-900">
            Hey{userName ? `, ${userName}` : ''} 👋
          </h1>
          <p className="text-surface-500">How are you feeling today?</p>
        </div>

        <div className="space-y-3">
          {ENERGY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className={`w-full p-5 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${opt.color}`}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">{opt.emoji}</span>
                <div>
                  <p className="font-semibold text-surface-900">{opt.label}</p>
                  <p className="text-sm text-surface-500">{opt.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
