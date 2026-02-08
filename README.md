# SideHustle Engine

Your AI-powered strategic advisor for building side income.

---

## What's Built (ALL sprints complete)

- **Sprint 0** — Project structure, database schema, dev environment
- **Sprint 1** — Registration, login, secure authentication, protected routes
- **Sprint 2** — The Pathfinder: 7-question guided onboarding → single AI recommendation
- **Sprint 3** — Game Plan generation, Dashboard with today's tasks, Career Arc ($507/hr counter), streak tracking, Plan Overview
- **Sprint 4** — Check-In system: energy rating (1-3), task completion tracking, AI responses, plan adjustment, weekly summaries
- **Sprint 5** — Mentor Chat: slide-out panel, streaming AI responses, full user context, conversation history
- **Sprint 5.5** — Voice integration: push-to-talk, Deepgram transcription, ElevenLabs text-to-speech, text/voice toggle
- **Sprint 6** — Premium UI on all screens, landing page, mobile-first design

---

## Setup (Do This Once)

### 1. Install prerequisites

You need two things installed on your computer:

- **Node.js** (version 18+) → [Download here](https://nodejs.org/) — click the big green button
- **PostgreSQL** → [Download here](https://www.postgresql.org/download/) — install, remember your password

### 2. Set up the project

Open **Terminal** (Mac) or **Command Prompt** (Windows). Run these one at a time:

```bash
# Go into the project folder
cd sidehustle-engine

# Install everything
npm run install:all

# Create your settings file (copy the template)
cp .env.example server/.env
```

### 3. Set up the database

```bash
# Create the database (use the password you set during PostgreSQL install)
createdb sidehustle_engine

# Run the database setup
npm run migrate
```

### 4. Add your API key

Open `server/.env` in any text editor. You MUST add at minimum:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get this from [console.anthropic.com](https://console.anthropic.com/)

For voice features (optional), also add:
```
DEEPGRAM_API_KEY=your-key-here
ELEVENLABS_API_KEY=your-key-here
```

### 5. Start the app

```bash
npm run dev
```

Open **http://localhost:5173** in your browser. That's it.

---

## How It Works

1. **Register** → Create your account
2. **Pathfinder** → Answer 7 questions → Get your recommended path
3. **Game Plan** → AI generates a day-by-day task plan (4 phases)
4. **Dashboard** → See today's task, complete it, track your streak
5. **Check-In** → Rate your energy daily, the plan adjusts
6. **Mentor** → Ask anything about your business, get contextual advice
7. **Voice** → Toggle voice mode in Mentor chat, hold mic button to speak

---

## Monthly Cost

| Service | Cost |
|---------|------|
| Anthropic Claude API | ~$5-20/mo depending on usage |
| Railway (backend + database) | $5/mo |
| Vercel (frontend) | Free |
| Deepgram (voice, optional) | Pay-as-you-go, ~$1-3/mo |
| ElevenLabs (voice, optional) | $5/mo starter plan |
| **Total** | **~$11-33/mo** |

---

## Deploying to Production

When ready to put this live on the internet:

```bash
# Frontend → Vercel (free)
# 1. Push code to GitHub
# 2. Connect repo to vercel.com
# 3. Set root directory to "client"

# Backend → Railway ($5/mo)  
# 1. Connect repo to railway.app
# 2. Set root directory to "server"
# 3. Add all environment variables from .env
# 4. Railway automatically provisions PostgreSQL
```
