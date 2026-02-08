// Career Arc numbers (deterministic, never AI-generated)
export const CAREER_ARC = {
  YEAR_1: 70_000,
  YEAR_2: 200_000,
  YEAR_3: 800_000,
  YEAR_4: 1_200_000,
  YEAR_5: 3_000_000,
  TOTAL: 5_270_000,
  TOTAL_HOURS: 10_400,
  HOURLY_VALUE: 507, // $5,270,000 / 10,400 hours
};

// Energy levels
export const ENERGY = {
  FUMES: 1,   // Running on fumes
  OKAY: 2,    // Okay
  HIGH: 3,    // Actually have energy today
};

// Task constraints
export const TASK_LIMITS = {
  MIN_DURATION: 15,
  MAX_DURATION: 60,
  MAX_PER_DAY: 3,
};

// Plan phases
export const PHASES = {
  SETUP: 1,           // Days 1-7: Setup, outreach by day 3
  MANUAL_OUTREACH: 2, // Days 8-14: Upwork manual outreach
  DUAL_CHANNEL: 3,    // Days 14-30: Manual + automated email
  SCALE: 4,           // Day 30+: Both channels producing
};

// Conversation context types
export const CONTEXT_TYPES = {
  PATHFINDER: 'pathfinder',
  PLAN: 'plan',
  CHECKIN: 'checkin',
  MENTOR: 'mentor',
};
