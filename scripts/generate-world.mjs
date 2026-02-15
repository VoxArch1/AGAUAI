import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const worldsRoot = path.join(repoRoot, 'worlds');

const apiKey = process.env.AI_WORLD_API_KEY || process.env.OPENAI_API_KEY;
const baseURL = process.env.AI_WORLD_BASE_URL || process.env.OPENAI_BASEURL || undefined;
const model = process.env.AI_WORLD_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
const userPrompt = process.argv.slice(2).join(' ').trim();

if (!apiKey) {
  console.error('[gen:world] Missing API key. Set AI_WORLD_API_KEY or OPENAI_API_KEY.');
  process.exit(1);
}

if (!userPrompt) {
  console.error('[gen:world] Usage: npm run gen:world -- "Describe the world to create"');
  process.exit(1);
}

function toSafeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeWorldId(value) {
  const slug = toSafeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Invalid worldId. Must be lowercase-hyphen-id.');
  }

  return slug;
}

function toIntOrDefault(value, fallback = 10) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.round(num));
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model returned non-JSON output.');
  }
  return JSON.parse(text.slice(start, end + 1));
}

function runBuildWorlds() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repoRoot, 'scripts/build-worlds-index.mjs')], {
      stdio: 'inherit'
    });

    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`build-worlds-index exited with code ${code}`));
    });
  });
}

async function generateWorldPayload() {
  const client = new OpenAI({ apiKey, baseURL });

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'Return STRICT JSON ONLY with keys worldId, stewardName, sigilPrompt, strategyStatement, initialElectrum. No markdown or extra text.'
      },
      {
        role: 'user',
        content: userPrompt
      }
    ]
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No model content returned.');
  }

  const parsed = extractJson(content);

  return {
    worldId: normalizeWorldId(parsed.worldId),
    stewardName: toSafeText(parsed.stewardName) || 'Unnamed Steward',
    sigilPrompt: toSafeText(parsed.sigilPrompt),
    strategyStatement: toSafeText(parsed.strategyStatement),
    initialElectrum: toIntOrDefault(parsed.initialElectrum, 10)
  };
}

async function main() {
  const payload = await generateWorldPayload();

  const worldDir = path.join(worldsRoot, payload.worldId);
  await fs.mkdir(worldDir, { recursive: true });

  const worldJson = {
    id: payload.worldId,
    stewardName: payload.stewardName,
    sigilPrompt: payload.sigilPrompt,
    strategyStatement: payload.strategyStatement
  };

  const electrumJson = {
    currentElectrum: payload.initialElectrum,
    breathsAvailable: 0,
    cycle: 1
  };

  await fs.writeFile(path.join(worldDir, 'world.json'), `${JSON.stringify(worldJson, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(worldDir, 'electrum.json'), `${JSON.stringify(electrumJson, null, 2)}\n`, 'utf8');

  await runBuildWorlds();

  console.log(`[gen:world] Created worlds/${payload.worldId}/world.json and electrum.json`);
  console.log(`[gen:world] Next step: Generate /worlds/${payload.worldId}/sigil.png from sigilPrompt and commit.`);
}

main().catch((error) => {
  console.error('[gen:world] Failed:', error.message);
  process.exitCode = 1;
});
