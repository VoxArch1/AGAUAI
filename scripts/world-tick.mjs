import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const CONFIG_PATH = path.join(ROOT, "config.json");
const WORLDS_PATH = path.join(ROOT, "public", "worlds");

function readJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.warn(`[world-tick] Failed to read ${filePath}: ${error.message}`);
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const config = readJson(CONFIG_PATH, {
  cycleLengthHours: 1,
  globalDecayRate: 0,
  promptCost: 1,
  baseBreathIntervalCycles: 24,
  baseBreathGrantAmount: 1
});

if (!fs.existsSync(WORLDS_PATH)) {
  console.log(`[world-tick] No worlds directory found at ${WORLDS_PATH}; nothing to tick.`);
  process.exit(0);
}

const worldDirs = fs
  .readdirSync(WORLDS_PATH, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const tickAtIso = new Date().toISOString();

for (const world of worldDirs) {
  const statePath = path.join(WORLDS_PATH, world, "state.json");
  const electrumPath = path.join(WORLDS_PATH, world, "electrum.json");

  if (!fs.existsSync(statePath) || !fs.existsSync(electrumPath)) {
    continue;
  }

  const state = readJson(statePath, {});

  state.breathsAvailable = typeof state.breathsAvailable === "number" ? state.breathsAvailable : 0;
  state.breathCounterCycles = typeof state.breathCounterCycles === "number" ? state.breathCounterCycles : 0;
  state.cycle = typeof state.cycle === "number" ? state.cycle : 0;
  state.lastTickAt = Object.prototype.hasOwnProperty.call(state, "lastTickAt") ? state.lastTickAt : null;

  state.cycle += 1;
  state.breathCounterCycles += 1;

  let breathGranted = false;
  if (state.breathCounterCycles >= config.baseBreathIntervalCycles) {
    state.breathsAvailable += config.baseBreathGrantAmount;
    state.breathCounterCycles = 0;
    breathGranted = true;
  }

  state.lastTickAt = tickAtIso;

  writeJson(statePath, state);

  console.log(
    `[world-tick] world=${world} cycle=${state.cycle} breathCounterCycles=${state.breathCounterCycles} breathsAvailable=${state.breathsAvailable} breathGranted=${breathGranted}`
  );
}
