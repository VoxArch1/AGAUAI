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
function lastTopicFor(inbox) {
  const msgs = [...(inbox.messages || [])].reverse();
  for (const m of msgs) {
    if (m.to === inbox.inbox && m.type === "PROPOSE" && m.body?.topic) return m.body.topic;
  }
  return "demo/ai-loop";
}
function extractFirstJsonObject(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end   = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

// ΔSpeak: define + example so models don't guess
const PROMPT = (name, topic) => `
You are ${name}. Respond ONLY with one JSON object in the ΔSpeak envelope.

Schema (one line):
{"id":"...","from":"${name}","to":"MyAI","time_utc":"<ISO>","type":"COMMIT","body":{"topic":"${topic}","accept":true},"policy":{"rate-limit":"1rpm","keep-times":"UTC","message-id-unique":true},"proofs":{"covers":["id","from","to","time_utc","type","body","policy"]}}

Example:
{"type":"COMMIT","body":{"topic":"${topic}","accept":true}}

Rules:
- Output MUST be a single JSON object (no prose, no Markdown).
- If you include extra keys, keep the above keys intact.
`;

// ---------- model callers ----------
async function callClaude(p){
  if(!ENABLED.Claude) { console.log("[switchboard] skip Claude (no key)"); return null; }
  try {
    console.log("[switchboard] calling Claude…");
    const c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await c.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 500, temperature: 0,
      messages: [{ role: "user", content: p }]
    });
    const out = r.content?.[0]?.type === "text" ? r.content[0].text : null;
    console.log("[switchboard] Claude returned", out ? "text" : "null");
    return out;
  } catch (e) {
    console.error("[switchboard] Claude error:", e.message);
    return null;
  }
}

async function callGemini(p){
  if(!ENABLED.Gemini) { console.log("[switchboard] skip Gemini (no key)"); return null; }
  try {
    console.log("[switchboard] calling Gemini…");
    const g = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const m = g.getGenerativeModel({ model: "gemini-1.5-flash" });
    const r = await m.generateContent(p);
    const out = r.response?.text?.() ?? null;
    console.log("[switchboard] Gemini returned", out ? "text" : "null");
    return out;
  } catch (e) {
    console.error("[switchboard] Gemini error:", e.message);
    return null;
  }
}

async function callGrok(p){
  if(!ENABLED.Grok) { console.log("[switchboard] skip Grok (no key)"); return null; }
  try {
    const baseURL = process.env.XAI_BASEURL || "https://api.x.ai/v1";
    const model   = process.env.XAI_MODEL   || "grok-4-0709";
    console.log(`[switchboard] calling Grok… model=${model} baseURL=${baseURL}`);
    const client = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL });
    const r = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: p }],
      temperature: 0
    });
    const out = r.choices?.[0]?.message?.content ?? null;
    console.log("[switchboard] Grok returned", out ? "text" : "null");
    return out;
  } catch (e) {
    console.error("[switchboard] Grok error:", e.message);
    return null;
  }
}

async function callLLama(p){
  if(!ENABLED.LLaMA) { console.log("[switchboard] skip LLaMA (no key)"); return null; }
  try {
    console.log("[switchboard] calling LLaMA…");
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASEURL || undefined
    });
    const r = await client.chat.completions.create({
      model: process.env.LLAMA_MODEL || "llama-3.1-70b-instruct",
      messages: [{ role: "user", content: p }],
      temperature: 0
    });
    const out = r.choices?.[0]?.message?.content ?? null;
    console.log("[switchboard] LLaMA returned", out ? "text" : "null");
    return out;
  } catch (e) {
    console.error("[switchboard] LLaMA error:", e.message);
    return null;
  }
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

  // Try JSON (or extract from mixed text)
  const candidate = extractFirstJsonObject(raw) || null;

  if (candidate && candidate.type === "COMMIT" && candidate.body) {
    return {
      ...base,
      ...candidate,
      id: candidate.id || base.id,
      from: candidate.from || name,
      to: candidate.to || "MyAI",
      time_utc: candidate.time_utc || base.time_utc,
      // 👇 PRESERVE all fields Grok returned, but guarantee topic/accept
      body: {
        ...candidate.body,
        topic: candidate.body.topic || topic,
        accept: candidate.body.accept ?? true
      },
      policy: candidate.policy || base.policy,
      proofs: candidate.proofs || base.proofs
    };
  }

  // Non-compliant → still advance the loop
  return base;
}


// ---------- per-model handler ----------
async function handle(name, caller) {
  if (!ENABLED[name]) return;

  const theirFp = INBOXES[name];
  const their   = ensureInbox(theirFp, name);
  const mine    = ensureInbox(MYAI_INBOX, "MyAI");

  const topic = lastTopicFor(their);
  const prompt = PROMPT(name, topic);

  console.log(`[switchboard] -> ${name} topic="${topic}"`);
  const raw = await caller(prompt);
  if (!raw) { console.warn(`[switchboard] ${name} returned empty/null`); return; }

  const commit = normalize(name, raw, topic);
  append(mine, commit);  writeJson(MYAI_INBOX, mine);

  const ob = ack(name, "COMMIT received by MyAI.");
  append(their, ob);     writeJson(theirFp, their);

  console.log(`[switchboard] ${name} COMMIT appended to inbox_myai.json`);
}

// ---------- main ----------
(async () => {
  await handle("Claude", callClaude);
  await handle("Grok",   callGrok);
  await handle("Gemini", callGemini);
  await handle("LLaMA",  callLLama);
  console.log("switchboard done");
})();
