# Claude Code Project Guide

## Architecture
- **Client**: React + Vite (deployed on Vercel from `client/`)
- **Server**: Express + WebSocket (deployed on Railway from `server/`)
- **Database**: PostgreSQL (hosted on Railway)
- **Voice**: Deepgram (STT) + Cartesia/ElevenLabs (TTS) via WebSocket agent

## Deploy
Push to `main` auto-deploys both Railway (server) and Vercel (client).

**Auto-deploy script** (build + commit + push + test):
```bash
./scripts/deploy.sh "commit message"
```

**Manual deploy**:
```bash
git push origin main
# Wait ~60-90s for Railway deploy
node scripts/test-voice-protocol.mjs --prod
```

## Testing
**Voice protocol tests** (run against deployed server):
```bash
node scripts/test-voice-protocol.mjs --prod    # production
node scripts/test-voice-protocol.mjs --local   # localhost:3001
```
Tests: auth, WS connect, auth rejection, ping/pong, activate/deactivate, reconnection, empty audio handling.

**Client build validation**:
```bash
cd client && npm run build
```

**Server syntax check**:
```bash
node --check server/index.js
```

## Key Files
- `client/src/hooks/useVoiceAgent.js` — Voice agent client (WS, VAD, MediaRecorder, reconnection)
- `server/voice/voiceAgent.js` — Voice agent server (WS handler, Deepgram, Claude, TTS)
- `server/voice/voiceService.js` — Deepgram + Cartesia/ElevenLabs service layer
- `client/src/utils/api.js` — API/WS base URL helpers

## Environment
- Local server env: `server/.env`
- Client production env: `client/.env.production` (VITE_API_URL → Railway)
- Voice keys (DEEPGRAM_API_KEY, CARTESIA_API_KEY/ELEVENLABS_API_KEY) are on Railway only
- `.env` is gitignored

## Conventions
- Server is ES modules (`"type": "module"`)
- Commit style: `Fix:` / `Feature:` prefix, brief description
- Always validate client build before deploying
- Run `node scripts/test-voice-protocol.mjs --prod` after deploy to verify
