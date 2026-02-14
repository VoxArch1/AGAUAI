import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const configPath = path.join(repoRoot, "config.json");
const worldsRoot = path.join(repoRoot, "public", "worlds");

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const writeJson = async (filePath, data) => {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const applyDecay = (balance, decayRate) => {
  const next = Number(balance) * (1 - decayRate);
  return Number(next.toFixed(4));
};

const tickWorld = async (worldDir, config, tickAtIso) => {
  const statePath = path.join(worldDir, "state.json");
  const electrumPath = path.join(worldDir, "electrum.json");

  const [state, electrum] = await Promise.all([
    readJson(statePath),
    readJson(electrumPath),
  ]);

  const prevBalance = Number(electrum.balance ?? 0);
  const nextBalance = applyDecay(prevBalance, config.globalDecayRate);
  electrum.balance = nextBalance;
  electrum.updatedAt = tickAtIso;

  state.cycle = Number(state.cycle ?? 0) + 1;
  state.breathCounterCycles = Number(state.breathCounterCycles ?? 0) + 1;
  state.lastTickAt = tickAtIso;

  await Promise.all([writeJson(statePath, state), writeJson(electrumPath, electrum)]);

  const worldName = path.basename(worldDir);
  const breathRemaining = Math.max(
    0,
    config.baseBreathIntervalCycles - state.breathCounterCycles
  );

  console.log(
    [
      `world=${worldName}`,
      `cycle:${state.cycle - 1}->${state.cycle}`,
      `electrum:${prevBalance}->${nextBalance}`,
      `breathCounter:${state.breathCounterCycles - 1}->${state.breathCounterCycles}`,
      `breathRemaining=${breathRemaining}`,
    ].join(" | ")
  );
};

const main = async () => {
  const config = await readJson(configPath);
  const entries = await fs.readdir(worldsRoot, { withFileTypes: true });
  const worldDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(worldsRoot, entry.name));

  if (worldDirs.length === 0) {
    console.log("No worlds found under /public/worlds.");
    return;
  }

  const tickAtIso = new Date().toISOString();
  console.log(`Tick started at ${tickAtIso}`);

  for (const worldDir of worldDirs) {
    await tickWorld(worldDir, config, tickAtIso);
  }

  console.log("Tick completed.");
};

main().catch((error) => {
  console.error("world-tick failed:", error);
  process.exitCode = 1;
});
