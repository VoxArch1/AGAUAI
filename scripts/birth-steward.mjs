import { buildBirthPrompt } from "./ai/birthPrompt.mjs";
import { callProvider, enabledProviders, PROVIDER_ORDER } from "./ai/providers.mjs";
import { extractFirstJsonObject } from "./ai/json.mjs";

const WORLD_ID_RE = /^[a-z0-9-]{3,40}$/;

function fail(message, rawOutput = null) {
  console.error(`[birth] ${message}`);
  if (rawOutput !== null) {
    console.error("[birth] raw output:");
    console.error(rawOutput);
  }
  process.exit(1);
}

function resolveProviderName() {
  const enabled = enabledProviders();
  const requested = process.env.BIRTH_MODEL;

  if (requested) {
    if (!Object.hasOwn(enabled, requested)) {
      fail(`Invalid BIRTH_MODEL '${requested}'. Expected one of: ${PROVIDER_ORDER.join(", ")}`);
    }
    if (!enabled[requested]) {
      fail(`BIRTH_MODEL '${requested}' is not enabled in environment`);
    }
    return requested;
  }

  const selected = PROVIDER_ORDER.find((name) => enabled[name]);
  if (!selected) {
    fail("No enabled providers found. Set one of: CHATGPT_API_KEY/OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, XAI_API_KEY");
  }
  return selected;
}

function validateBirthPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("Model output JSON must be an object");
  }

  if (typeof payload.worldId !== "string" || !WORLD_ID_RE.test(payload.worldId)) {
    fail("Invalid worldId; expected lowercase letters/numbers/hyphens only, length 3-40");
  }

  for (const field of ["stewardName", "sigilPrompt", "strategyStatement"]) {
    if (typeof payload[field] !== "string" || payload[field].trim().length === 0) {
      fail(`Invalid ${field}; expected non-empty string`);
    }
  }

  if (payload.initialElectrum === undefined) {
    payload.initialElectrum = 10;
  }

  if (typeof payload.initialElectrum !== "number" || Number.isNaN(payload.initialElectrum)) {
    fail("Invalid initialElectrum; expected a number");
  }

  return payload;
}

(async () => {
  const provider = resolveProviderName();
  const prompt = buildBirthPrompt();

  let rawOutput;
  try {
    rawOutput = await callProvider(provider, prompt);
  } catch (error) {
    fail(`Provider call failed for ${provider}: ${error.message}`);
  }

  const parsed = extractFirstJsonObject(rawOutput);
  if (!parsed) {
    fail("Model did not return parseable JSON object", rawOutput ?? "");
  }

  const validated = validateBirthPayload(parsed);
  process.stdout.write(`${JSON.stringify(validated, null, 2)}\n`);
})();
