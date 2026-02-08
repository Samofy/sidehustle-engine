// Career Arc — Pure deterministic math. No AI.
const CAREER_ARC = {
  TOTAL: 5_270_000,
  TOTAL_HOURS: 10_400,
  HOURLY_VALUE: 507,
};

/**
 * Calculate Career Arc earnings based on completed task hours.
 */
export function calculateEarnings(totalHoursLogged) {
  const earned = totalHoursLogged * CAREER_ARC.HOURLY_VALUE;
  return {
    totalEarned: Math.round(earned * 100) / 100,
    hourlyValue: CAREER_ARC.HOURLY_VALUE,
    hoursLogged: totalHoursLogged,
    hoursRemaining: Math.max(0, CAREER_ARC.TOTAL_HOURS - totalHoursLogged),
    projectedTotal: CAREER_ARC.TOTAL,
    lossMessage: `Every hour you don't work, you lose $${CAREER_ARC.HOURLY_VALUE}.`,
  };
}

/**
 * Calculate hours from task duration in minutes.
 */
export function taskMinutesToHours(minutes) {
  return Math.round((minutes / 60) * 100) / 100;
}
