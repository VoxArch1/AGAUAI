import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const worldsDir = path.join(repoRoot, 'worlds');
const dataDir = path.join(repoRoot, 'data');
const outputPath = path.join(dataDir, 'worlds-index.json');

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function compareWorlds(a, b) {
  const aElectrum = a.currentElectrum;
  const bElectrum = b.currentElectrum;

  if (aElectrum === null && bElectrum !== null) return 1;
  if (aElectrum !== null && bElectrum === null) return -1;
  if (aElectrum !== null && bElectrum !== null && bElectrum !== aElectrum) {
    return bElectrum - aElectrum;
  }

  return a.stewardName.localeCompare(b.stewardName, undefined, { sensitivity: 'base' });
}

async function buildWorldsIndex() {
  let dirEntries = [];

  try {
    dirEntries = await fs.readdir(worldsDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.warn('[build:worlds] No /worlds directory found. Writing empty index.');
    } else {
      throw error;
    }
  }

  const worlds = [];

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;

    const worldId = entry.name;
    const worldPath = path.join(worldsDir, worldId);
    const worldJsonPath = path.join(worldPath, 'world.json');
    const electrumJsonPath = path.join(worldPath, 'electrum.json');

    let worldJson;
    try {
      worldJson = await readJsonFile(worldJsonPath);
    } catch (error) {
      console.warn(`[build:worlds] Skipping "${worldId}": invalid or missing world.json (${error.message}).`);
      continue;
    }

    const stewardName = (worldJson?.stewardName ?? worldJson?.name ?? '').toString().trim();
    if (!stewardName) {
      console.warn(`[build:worlds] Skipping "${worldId}": stewardName/name missing in world.json.`);
      continue;
    }

    let electrumJson = null;
    try {
      electrumJson = await readJsonFile(electrumJsonPath);
    } catch (error) {
      if (!(error && error.code === 'ENOENT')) {
        console.warn(`[build:worlds] "${worldId}": invalid electrum.json (${error.message}). Using null stats.`);
      }
    }

    worlds.push({
      id: worldId,
      stewardName,
      sigilPrompt: (worldJson?.sigilPrompt ?? worldJson?.sigil?.prompt ?? null) || null,
      currentElectrum: toNumberOrNull(electrumJson?.currentElectrum ?? electrumJson?.electrum),
      breathsAvailable: toNumberOrNull(electrumJson?.breathsAvailable),
      cycle: toNumberOrNull(electrumJson?.cycle ?? worldJson?.cycle)
    });
  }

  worlds.sort(compareWorlds);

  const payload = {
    generatedAt: new Date().toISOString(),
    worlds
  };

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`[build:worlds] Wrote ${worlds.length} world(s) to ${path.relative(repoRoot, outputPath)}.`);
}

buildWorldsIndex().catch((error) => {
  console.error('[build:worlds] Failed:', error);
  process.exitCode = 1;
});
