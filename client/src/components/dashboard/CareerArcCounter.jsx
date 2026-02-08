import { useState, useEffect } from 'react';

export default function CareerArcCounter({ data }) {
  const [displayValue, setDisplayValue] = useState(0);

  // Animate counter on mount
  useEffect(() => {
    const target = data.totalEarned || 0;
    if (target === 0) {
      setDisplayValue(0);
      return;
    }

    let start = 0;
    const duration = 1200;
    const startTime = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(target * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(target);
      }
    }

    animate();
  }, [data.totalEarned]);

  return (
    <div className="bg-gradient-to-br from-surface-900 to-surface-800 rounded-2xl p-6 text-white shadow-lg">
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-surface-400 uppercase tracking-wider font-medium">Career Arc</p>
          <p className="text-xs text-surface-500">${data.hourlyValue}/hr</p>
        </div>

        <div className="space-y-1">
          <p className="text-4xl font-bold tracking-tight">
            ${displayValue.toLocaleString()}
          </p>
          <p className="text-sm text-surface-400">
            earned across {data.hoursLogged?.toFixed(1) || '0'} hours logged
          </p>
        </div>

        <div className="pt-2 border-t border-surface-700">
          <p className="text-sm text-amber-400 font-medium">
            {data.lossMessage}
          </p>
        </div>
      </div>
    </div>
  );
}
