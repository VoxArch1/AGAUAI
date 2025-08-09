import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Anthropic } from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const PUB  = path.join(ROOT, "public", "api", "ai");

const MYAI_INBOX = path.join(PUB, "inbox_myai.json");
const INBOXES = {
  Claude: path.join(PUB, "inbox_claude.json"),
  Grok:   path.join(PUB, "inbox_grok.json"),
  Gemini: path.join(PUB, "inbox_gemini.json"),
  LLaMA:  path.join(PUB, "inbox_llama.json"),
};

const ENABLED = {
  Claude: !!process.env.ANTHROPIC_API_KEY,
  Grok:   !!process.env.XAI_API_KEY,
  Gemini: !!process.env.GEMINI_API_KEY,
  LLaMA:  !!process.env.OPENAI_API_KEY
};

// ---------- safe IO ----------
function readJson(fp) {
  try {
    if (!fs.existsSync(fp)) return null;
    const txt = fs.readFileSync(fp, "utf8");
    return JSON.parse(txt);
  } catch (e) {
    // malformed -> ignore and recreate later if needed
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
function lastTopicFor(inbox) {
  const msgs = [...(inbox.messages || [])].reverse();
  for (const m of msgs) {
    if (m.to === inbox.inbox && m.type === "PROPOSE" && m.body?.topic) return m.body.topic;
  }
  return "demo/ai-loop";
}
function safeJ(s) { try { return JSON.parse(s); } catch { return null; } }

const PROMPT = (name) => `You are ${name}. Reply ONLY with one JSON object in ΔSpeak envelope:
{id, from, to, time_utc, type, body, policy, proofs}
type=COMMIT, body.accept=true, body.topic mirrors last PROPOSE to you (or 'demo/ai-loop').
policy={"rate-limit":"1rpm","keep-times":"UTC","message-id-unique":true}
proofs.covers=["id","from","to","time_utc","type","body","policy"]
No prose.`;

// ---------- model callers ----------
async function callClaude(p){ if(!ENABLED.Claude) return null;
  const c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const r = await c.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 500, temperature: 0,
    messages: [{ role: "user", content: p }]
  });
  return r.content?.[0]?.type === "text" ? r.content[0].text : null;
}
async function callGemini(p){ if(!ENABLED.Gemini) return null;
  const g = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const m = g.getGenerativeModel({ model: "gemini-1.5-flash" });
  const r = await m.generateContent(p);
  return r.response?.text?.() ?? null;
}
async function callGrok(p){ if(!ENABLED.Grok) return null;
  try {
    const client = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: process.env.XAI_BASEURL || undefined });
    const r = await client.chat.completions.create({
      model: process.env.XAI_MODEL || "grok-2-latest",
      messages: [{ role: "user", content: p }],
      temperature: 0
    });
    return r.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}
async function callLLama(p){ if(!ENABLED.LLaMA) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASEURL || undefined });
  const r = await client.chat.completions.create({
    model: process.env.LLAMA_MODEL || "llama-3.1-70b-instruct",
    messages: [{ role: "user", content: p }],
    temperature: 0
  });
  return r.choices?.[0]?.message?.content ?? null;
}

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
  const j = safeJ(raw);
  if (j && j.type === "COMMIT" && j.body) {
    return {
      ...base, ...j,
      id: j.id || base.id,
      from: j.from || name,
      to: j.to || "MyAI",
      time_utc: j.time_utc || base.time_utc,
      body: { topic: j.body.topic || topic, accept: j.body.accept ?? true },
      policy: j.policy || base.policy,
      proofs: j.proofs || base.proofs
    };
  }
  // Non-compliant → produce a valid COMMIT anyway
  return base;
}

// ---------- per-model handler ----------
async function handle(name, caller) {
  // IMPORTANT: skip before touching any files if no key
  if (!ENABLED[name]) return;

  const theirFp = INBOXES[name];
  const their   = ensureInbox(theirFp, name);
  const mine    = ensureInbox(MYAI_INBOX, "MyAI");

  const topic = lastTopicFor(their);
  const raw   = await caller(PROMPT(name));
  if (!raw) return;

  const commit = normalize(name, raw, topic);
  append(mine, commit);  writeJson(MYAI_INBOX, mine);

  const ob = ack(name);
  append(their, ob);     writeJson(theirFp, their);
}

// ---------- main ----------
(async () => {
  await handle("Claude", callClaude);
  await handle("Grok",   callGrok);
  await handle("Gemini", callGemini);
  await handle("LLaMA",  callLLama);
  console.log("switchboard done");
})();

