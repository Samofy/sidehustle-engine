import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load prompt templates
function loadPrompt(name) {
  return fs.readFileSync(path.join(__dirname, 'prompts', `${name}.md`), 'utf-8');
}

const prompts = {
  base: loadPrompt('system-base'),
  pathfinder: loadPrompt('pathfinder'),
  planGeneration: loadPrompt('plan-generation'),
  checkIn: loadPrompt('check-in'),
  mentor: loadPrompt('mentor'),
};

/**
 * Build the system prompt for a given context type.
 */
export function buildSystemPrompt(contextType, userContext = {}) {
  let system = prompts.base + '\n\n';

  switch (contextType) {
    case 'pathfinder':
      system += prompts.pathfinder;
      break;
    case 'plan':
      system += prompts.planGeneration;
      break;
    case 'checkin':
      system += prompts.checkIn;
      break;
    case 'mentor':
      system += prompts.mentor;
      break;
  }

  // Append user context
  if (Object.keys(userContext).length > 0) {
    system += '\n\n## Current User Context\n';
    system += '```json\n' + JSON.stringify(userContext, null, 2) + '\n```';
  }

  return system;
}

/**
 * Call the Claude API. Returns full response or streams via callback.
 */
export async function callClaude({ systemPrompt, messages, onChunk, maxTokens = 2048, model = 'claude-sonnet-4-20250514' }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const body = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  };

  // Streaming mode
  if (onChunk) {
    body.stream = true;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API error: ${res.status} — ${err}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text;
              onChunk(parsed.delta.text);
            }
          } catch {}
        }
      }
    }

    return fullText;
  }

  // Non-streaming mode
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.content[0]?.text || '';
}
