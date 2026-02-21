#!/usr/bin/env node
/**
 * Voice Agent Protocol Test Suite
 *
 * Tests the WebSocket voice agent against the deployed server.
 * Validates: auth, connect, ping/pong, activate/deactivate,
 * message protocol, error handling, and reconnection.
 *
 * Usage:
 *   node scripts/test-voice-protocol.mjs [--prod | --local]
 *
 * Env vars (optional):
 *   TEST_EMAIL    - existing account email
 *   TEST_PASSWORD - existing account password
 *   TEST_TOKEN    - skip login, use this JWT directly
 *   API_URL       - override the API base (default: production Railway)
 */

const PROD_API = 'https://sidehustle-engine-production.up.railway.app';
const LOCAL_API = 'http://localhost:3001';

const args = process.argv.slice(2);
const isLocal = args.includes('--local');
const API = process.env.API_URL || (isLocal ? LOCAL_API : PROD_API);
const WS_BASE = API.replace('https://', 'wss://').replace('http://', 'ws://');

let passed = 0;
let failed = 0;
let skipped = 0;

function log(icon, msg) { console.log(`  ${icon} ${msg}`); }
function pass(msg) { passed++; log('\x1b[32m✓\x1b[0m', msg); }
function fail(msg, err) { failed++; log('\x1b[31m✗\x1b[0m', `${msg}${err ? ': ' + err : ''}`); }
function skip(msg) { skipped++; log('\x1b[33m⊘\x1b[0m', `SKIP: ${msg}`); }
function section(title) { console.log(`\n\x1b[1m── ${title} ──\x1b[0m`); }

// ─── Auth ───────────────────────────────────────────────────────────
async function getToken() {
  if (process.env.TEST_TOKEN) return process.env.TEST_TOKEN;

  const email = process.env.TEST_EMAIL || `voicetest_${Date.now()}@test.local`;
  const password = process.env.TEST_PASSWORD || 'TestPass123!';
  const name = 'Voice Test Bot';

  // Try login first
  if (process.env.TEST_EMAIL) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.token;
    }
  }

  // Register a test account
  const res = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Auth failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.token;
}

// ─── Helpers ────────────────────────────────────────────────────────
function connectWs(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/voice-agent?token=${token}`);
    const timer = setTimeout(() => { ws.close(); reject(new Error('Connection timeout')); }, 10000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(ws); });
    ws.addEventListener('error', (e) => { clearTimeout(timer); reject(new Error('WS error')); });
  });
}

function waitForMessage(ws, type, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${type}'`)), timeoutMs);
    function handler(event) {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === type) {
          clearTimeout(timer);
          ws.removeEventListener('message', handler);
          resolve(msg);
        }
      } catch {}
    }
    ws.addEventListener('message', handler);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Tests ──────────────────────────────────────────────────────────

async function testServerHealth() {
  section('Server Health');
  try {
    const res = await fetch(`${API}/api/voice/status`, {
      headers: { Authorization: `Bearer ${globalToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      pass(`Voice status endpoint reachable (enabled: ${data.enabled})`);
      return data.enabled;
    } else {
      fail(`Voice status returned ${res.status}`);
      return false;
    }
  } catch (err) {
    fail('Cannot reach server', err.message);
    return false;
  }
}

async function testWsConnect() {
  section('WebSocket Connection');
  let ws;
  try {
    ws = await connectWs(globalToken);
    pass('WebSocket connected');

    const msg = await waitForMessage(ws, 'connected', 5000);
    pass(`Received 'connected' message: "${msg.message}"`);
  } catch (err) {
    fail('WebSocket connection', err.message);
  } finally {
    ws?.close();
  }
}

async function testWsAuthReject() {
  section('WebSocket Auth Rejection');
  try {
    const ws = new WebSocket(`${WS_BASE}/voice-agent?token=invalid-token`);
    const closed = new Promise((resolve) => {
      ws.addEventListener('close', (e) => resolve(e));
      setTimeout(() => { ws.close(); resolve({ code: 'timeout' }); }, 5000);
    });
    const result = await closed;
    if (result.code === 1008 || result.code === 1006) {
      pass(`Invalid token rejected (code: ${result.code})`);
    } else if (result.code === 'timeout') {
      fail('Server did not reject invalid token within 5s');
    } else {
      pass(`Connection closed with code ${result.code}`);
    }
  } catch (err) {
    fail('Auth rejection test', err.message);
  }
}

async function testPingPong() {
  section('Ping/Pong Heartbeat');
  let ws;
  try {
    ws = await connectWs(globalToken);
    await waitForMessage(ws, 'connected', 5000);

    ws.send(JSON.stringify({ type: 'ping' }));
    const pong = await waitForMessage(ws, 'pong', 5000);
    pass('Server responded to ping with pong');
  } catch (err) {
    fail('Ping/pong', err.message);
  } finally {
    ws?.close();
  }
}

async function testActivateDeactivate() {
  section('Activate / Deactivate');
  let ws;
  try {
    ws = await connectWs(globalToken);
    await waitForMessage(ws, 'connected', 5000);

    // Activate
    ws.send(JSON.stringify({ type: 'activate' }));
    const activated = await waitForMessage(ws, 'status', 5000);
    if (activated.active === true) {
      pass('Activated successfully');
    } else {
      fail('Activate did not return active: true');
    }

    // Deactivate
    ws.send(JSON.stringify({ type: 'deactivate' }));
    const deactivated = await waitForMessage(ws, 'status', 5000);
    if (deactivated.active === false) {
      pass('Deactivated successfully');
    } else {
      fail('Deactivate did not return active: false');
    }
  } catch (err) {
    fail('Activate/Deactivate', err.message);
  } finally {
    ws?.close();
  }
}

async function testEmptyAudio() {
  section('Empty Audio Handling');
  let ws;
  try {
    ws = await connectWs(globalToken);
    await waitForMessage(ws, 'connected', 5000);

    // Activate
    ws.send(JSON.stringify({ type: 'activate' }));
    await waitForMessage(ws, 'status', 5000);

    // Send minimal/silent audio (will likely fail transcription → should get 'listening' not 'error')
    // Create a minimal valid webm-ish data URL with silence
    const silentBytes = Buffer.alloc(1000).toString('base64');
    const dataUrl = `data:audio/webm;base64,${silentBytes}`;
    ws.send(JSON.stringify({ type: 'audio-data', audioData: dataUrl }));

    // Should get 'transcribing' then 'listening' (or 'error' for invalid audio - Deepgram may reject)
    const response = await new Promise((resolve) => {
      const msgs = [];
      const timer = setTimeout(() => resolve(msgs), 15000);
      function handler(event) {
        try {
          const msg = JSON.parse(event.data);
          msgs.push(msg);
          // Stop after we get a terminal message
          if (msg.type === 'listening' || msg.type === 'error' || msg.type === 'text-response') {
            clearTimeout(timer);
            ws.removeEventListener('message', handler);
            resolve(msgs);
          }
        } catch {}
      }
      ws.addEventListener('message', handler);
    });

    const types = response.map(m => m.type);
    if (types.includes('listening')) {
      pass('Empty/silent audio returned "listening" (no error shown to user)');
    } else if (types.includes('error')) {
      const errMsg = response.find(m => m.type === 'error')?.message;
      if (errMsg?.includes('Could not understand')) {
        fail('Server still returns "Could not understand audio" error (old behavior)');
      } else {
        // Other errors (like Deepgram rejection of invalid data) are acceptable
        pass(`Server returned error for invalid audio data: "${errMsg}" (expected for garbage data)`);
      }
    } else {
      skip(`Got unexpected response types: ${types.join(', ')}`);
    }
  } catch (err) {
    fail('Empty audio handling', err.message);
  } finally {
    ws?.close();
  }
}

async function testReconnection() {
  section('Reconnection Resilience');
  let ws;
  try {
    // Connect, then close, then reconnect
    ws = await connectWs(globalToken);
    await waitForMessage(ws, 'connected', 5000);
    ws.close();
    pass('First connection established and closed');

    await sleep(500);

    // Reconnect with same token
    ws = await connectWs(globalToken);
    const msg = await waitForMessage(ws, 'connected', 5000);
    pass('Reconnection successful after close');

    // Activate after reconnect
    ws.send(JSON.stringify({ type: 'activate' }));
    const activated = await waitForMessage(ws, 'status', 5000);
    if (activated.active === true) {
      pass('Activate works after reconnection');
    } else {
      fail('Activate failed after reconnection');
    }
  } catch (err) {
    fail('Reconnection', err.message);
  } finally {
    ws?.close();
  }
}

async function testConcurrentPings() {
  section('Sustained Connection (Multiple Pings)');
  let ws;
  try {
    ws = await connectWs(globalToken);
    await waitForMessage(ws, 'connected', 5000);

    for (let i = 0; i < 5; i++) {
      ws.send(JSON.stringify({ type: 'ping' }));
      await waitForMessage(ws, 'pong', 3000);
      await sleep(200);
    }
    pass('5 consecutive ping/pong cycles successful');
  } catch (err) {
    fail('Sustained pings', err.message);
  } finally {
    ws?.close();
  }
}

// ─── Main ───────────────────────────────────────────────────────────
let globalToken;

async function main() {
  console.log(`\n\x1b[1m🔊 Voice Agent Protocol Test Suite\x1b[0m`);
  console.log(`   Target: ${API}`);
  console.log(`   WS:     ${WS_BASE}/voice-agent\n`);

  // Authenticate
  section('Authentication');
  try {
    globalToken = await getToken();
    pass('Obtained JWT token');
  } catch (err) {
    fail('Authentication', err.message);
    console.log('\n\x1b[31mCannot proceed without auth. Set TEST_EMAIL/TEST_PASSWORD or TEST_TOKEN.\x1b[0m\n');
    process.exit(1);
  }

  // Run tests
  const voiceEnabled = await testServerHealth();
  await testWsConnect();
  await testWsAuthReject();
  await testPingPong();
  await testActivateDeactivate();
  await testConcurrentPings();
  await testReconnection();

  if (voiceEnabled) {
    await testEmptyAudio();
  } else {
    skip('Empty audio test (voice services not enabled on server)');
    skipped++;
  }

  // Summary
  console.log(`\n\x1b[1m── Summary ──\x1b[0m`);
  console.log(`  \x1b[32m${passed} passed\x1b[0m  \x1b[31m${failed} failed\x1b[0m  \x1b[33m${skipped} skipped\x1b[0m\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
