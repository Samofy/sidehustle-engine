import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import pathfinderRoutes from './routes/pathfinder.js';
import planRoutes from './routes/plan.js';
import checkInRoutes from './routes/checkin.js';
import mentorRoutes from './routes/mentor.js';
import voiceRoutes from './routes/voice.js';
import settingsRoutes from './routes/settings.js';
import { errorHandler } from './middleware/errors.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(s => s.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) cb(null, true);
    else cb(null, true); // Allow all in V1 (single user)
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/voice/transcribe', express.raw({ type: 'audio/*', limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/pathfinder', pathfinderRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/tasks', planRoutes);
app.use('/api/checkin', checkInRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/settings', settingsRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 SideHustle Engine API running on port ${PORT}`);
});

export default app;
