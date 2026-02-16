import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { callProvider, enabledProviders } from "./ai/providers.mjs";
import { extractFirstJsonObject } from "./ai/json.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const PUB  = path.join(ROOT, "public", "api", "ai");

const MYAI_INBOX = path.join(PUB, "inbox_myai.json");
const INBOXES = {
  Claude:  path.join(PUB, "inbox_claude.json"),
  Grok:    path.join(PUB, "inbox_grok.json"),
  Gemini:  path.join(PUB, "inbox_gemini.json"),
  LLaMA:   path.join(PUB, "inbox_llama.json"),
  ChatGPT: path.join(PUB, "inbox_chatgpt.json")
};

const ENABLED = enabledProviders();

// ---------- safe IO ----------
function readJson(fp) {
  try {
    if (!fs.existsSync(fp)) return null;
    const txt = fs.readFileSync(fp, "utf8");
    return JSON.parse(txt);
  } catch (e) {
    console.warn(`[switchboard] malformed JSON at ${fp}; recreating.`, e.message);
    return null;
  }
}
function writeJson(fp, obj) {
  obj.updated = new Date().toISOString();
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + "\n", "utf8");
}
function ensureInbox(fp, name) {
  let j = readJson(fp);
  if (!j) j = { inbox: name, updated: new Date().toISOString(), messages: [] };
  if (!Array.isArray(j.messages)) j.messages = [];
  return j;
}

// ---------- helpers ----------
function uid(prefix) {
  const t = new Date().toISOString();
  return `${t}-${prefix}-${Math.random().toString(36).slice(2,7)}`;
}
function append(inbox, msg) {
  inbox.messages.push(msg);
  inbox.updated = new Date().toISOString();
}
function ack(to, notice = "COMMIT recorded.") {
  const now = new Date().toISOString();
  return {
    id: uid("myai-obs-ack"),
    from: "MyAI",
    to,
    time_utc: now,
    type: "OBSERVE",
    body: { notice },
    policy: { "rate-limit":"1rpm","keep-times":"UTC","message-id-unique": true },
    proofs: { covers: ["id","from","to","time_utc","type","body","policy"] }
  };
}
function lastPropose(inbox) {
  const msgs = [...(inbox.messages || [])].reverse();
  for (const m of msgs) {
    if (m.type === "PROPOSE" && m.to === inbox.inbox) {
      const topic = m.body?.topic || "demo/ai-loop";
      const instruction = m.body?.instruction || "";
      return { topic, instruction, id: m.id };
    }
  }
  return { topic: "demo/ai-loop", instruction: "", id: null };
}

// ΔSpeak: define + example and tell model to place TASK results under body
const PROMPT = (name, topic) => `
You are ${name}. Respond ONLY with one JSON object in the ΔSpeak envelope.

Schema (one line):
{"id":"...","from":"${name}","to":"MyAI","time_utc":"<ISO>","type":"COMMIT","body":{"topic":"${topic}","accept":true},"policy":{"rate-limit":"1rpm","keep-times":"UTC","message-id-unique":true},"proofs":{"covers":["id","from","to","time_utc","type","body","policy"]}}

Example:
{"type":"COMMIT","body":{"topic":"${topic}","accept":true}}

Rules:
- Output MUST be a single JSON object (no prose, no Markdown).
- Perform the TASK below and place all results under 'body' (you may add fields like brief, caption, facts, ballot, etc.).
`;

// ---------- normalization ----------
function normalize(name, raw, topic) {
  const now = new Date().toISOString();
  const base = {
    id: uid(`${name.toLowerCase()}-commit`),
    from: name,
    to: "MyAI",
    time_utc: now,
    type: "COMMIT",
    body: { topic, accept: true },
    policy: { "rate-limit":"1rpm","keep-times":"UTC","message-id-unique": true },
    proofs: { covers: ["id","from","to","time_utc","type","body","policy"], hash: Math.random().toString(36).slice(2) }
  };

  const candidate = extractFirstJsonObject(raw) || null;

  if (candidate && candidate.type === "COMMIT" && candidate.body) {
    return {
      ...base,
      ...candidate,
      id: candidate.id || base.id,
      from: candidate.from || name,
      to: candidate.to || "MyAI",
      time_utc: candidate.time_utc || base.time_utc,
      body: {
        ...candidate.body,
        topic: candidate.body.topic || topic,
        accept: candidate.body.accept ?? true
      },
      policy: candidate.policy || base.policy,
      proofs: candidate.proofs || base.proofs
    };
  }

  return base;
}

async function callerWithLogs(name, prompt) {
  try {
    console.log(`[switchboard] calling ${name}…`);
    const out = await callProvider(name, prompt);
    console.log(`[switchboard] ${name} returned`, out ? "text" : "null");
    return out;
  } catch (e) {
    console.error(`[switchboard] ${name} error:`, e.message);
    return null;
  }
}

// ---------- per-model handler ----------
async function handle(name) {
  if (!ENABLED[name]) return;

  const theirFp = INBOXES[name];
  const their   = ensureInbox(theirFp, name);
  const mine    = ensureInbox(MYAI_INBOX, "MyAI");

  const { topic, instruction, id: proposeId } = lastPropose(their);
  const prompt = `${PROMPT(name, topic)}\n\nTASK:\n${instruction || "Acknowledge receipt of the PROPOSE."}`;

  console.log(`[switchboard] -> ${name} topic="${topic}" proposeId=${proposeId || "none"}`);
  const raw = await callerWithLogs(name, prompt);
  if (!raw) { console.warn(`[switchboard] ${name} returned empty/null`); return; }

  const commit = normalize(name, raw, topic);
  append(mine, commit);  writeJson(MYAI_INBOX, mine);

  const ob = ack(name, "COMMIT received by MyAI.");
  append(their, ob);     writeJson(theirFp, their);

  console.log(`[switchboard] ${name} COMMIT appended to inbox_myai.json`);
}

// ---------- main ----------
(async () => {
  await handle("Claude");
  await handle("Grok");
  await handle("Gemini");
  await handle("LLaMA");
  await handle("ChatGPT");
  console.log("switchboard done");
})();
