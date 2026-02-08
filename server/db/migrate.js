import 'dotenv/config';
import pool from './pool.js';

const migrations = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  pathfinder_data JSONB DEFAULT '{}',
  current_phase INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  total_hours_logged DECIMAL(10,2) DEFAULT 0,
  last_check_in_date DATE,
  voice_enabled BOOLEAN DEFAULT FALSE,
  voice_preference VARCHAR(50) DEFAULT 'text',
  preferred_model VARCHAR(50) DEFAULT 'claude-sonnet-4-20250514',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  niche VARCHAR(255),
  offer TEXT,
  phase INTEGER DEFAULT 1,
  phase_1_tasks JSONB DEFAULT '[]',
  phase_2_tasks JSONB DEFAULT '[]',
  phase_3_tasks JSONB DEFAULT '[]',
  phase_4_tasks JSONB DEFAULT '[]',
  start_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES plans(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  phase INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  energy_level VARCHAR(10) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  skipped_reason TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Check-ins table
CREATE TABLE IF NOT EXISTS check_ins (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  energy_rating INTEGER CHECK (energy_rating BETWEEN 1 AND 3),
  task_completed BOOLEAN,
  skip_reason TEXT,
  ai_response TEXT,
  plan_adjustment TEXT,
  check_in_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table (Mentor + Pathfinder)
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  context_type VARCHAR(20) NOT NULL,
  role VARCHAR(10) NOT NULL,
  content TEXT NOT NULL,
  input_mode VARCHAR(10) DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_day ON tasks(user_id, day_number);
CREATE INDEX IF NOT EXISTS idx_tasks_plan_phase ON tasks(plan_id, phase);
CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON check_ins(user_id, check_in_date);
CREATE INDEX IF NOT EXISTS idx_conversations_user_type ON conversations(user_id, context_type);
CREATE INDEX IF NOT EXISTS idx_plans_user_status ON plans(user_id, status);

-- Add preferred_model column for existing databases
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_model VARCHAR(50) DEFAULT 'claude-sonnet-4-20250514';
`;

async function migrate() {
  try {
    await pool.query(migrations);
    console.log('✅ Database migrations completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
