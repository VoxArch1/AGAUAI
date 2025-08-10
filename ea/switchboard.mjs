// ea/switchboard.mjs
// DAMN: Democratic AI Mediation • Moderation • Nomination
// Usage (CLI): node ea/switchboard.mjs data/inbox.chatgpt.json data/nomination.json

import fs from "fs";
import crypto from "crypto";

// ---- Switchboard core -------------------------------------------------------
export class Switchboard {
  constructor({ contextCapsule, weights = {}, moderators = [] } = {}) {
    this.contextCapsule = contextCapsule || {
      id: "MyAI.v1.Tribalism",
      invariants: [
        "No paywalls or money-grab motives",
        "Physical/financial changes require MyAI sign-off"
      ],
      priorities: ["Ship small, iterate", "Transparency", "Attribution"]
    };
    this.weights = {
      MyAI: 1.15, ChatGPT: 1.0, Gemini: 1.0, Grok: 1.0, Claude: 1.0,
      ...weights
    };
    this.moderators = moderators;
    this.buffer = [];
  }

  ingest(message) {
    const id = message.id || `msg-${(crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`)}`;
    const now = new Date().toISOString();
    const header = {
      agent_id: message?.header?.agent_id ?? "Unknown",
      capsule_id: message?.header?.capsule_id ?? this.contextCapsule.id,
      persona_version: message?.header?.persona_version ?? "0.0.0",
      domains: message?.header?.domains ?? [],
      auth: message?.header?.auth ?? null
    };
    const body = message.body ?? {};
    const norm = {
      id,
      time_utc: message.time_utc || now,
      type: message.type || "PROPOSE",
      header,
      body
    };
    this.buffer.push(norm);
    return id;
  }

  runDAMN({ topic = null, deadlineMinutes = 10 } = {}) {
    const proposals = this.buffer.filter(m => m.type === "PROPOSE");
    if (proposals.length === 0) {
      return this.#decision("none", [], "No proposals", { topic, deadlineMinutes });
    }

    const moderated = proposals.filter(p => this.#moderate(p));
    if (moderated.length === 0) {
      return this.#decision("none", [], "All proposals rejected in moderation", { topic, deadlineMinutes });
    }

    const mediated = this.#mediate(moderated);
    const scored = mediated
      .map(p => ({ p, score: this.#score(p) }))
      .sort((a, b) => b.score - a.score);

    const top = scored[0];
    const dissent = scored.slice(1).map(({ p, score }) => ({
      id: p.id,
      agent: p.header.agent_id,
      score,
      verb: p.body?.verb || null,
      summary: p.body.goal || p.body.approach || ""
    }));

    return this.#decision(
      "nominate",
      [{ id: top.p.id, plan: top.p, score: top.score }],
      "Top plan nominated",
      { topic, deadlineMinutes, dissent }
    );
  }

  // ---- internals ------------------------------------------------------------
  #moderate(p) {
    // must have goal & approach
    if (!p.body?.goal || !p.body?.approach) return false;

    // ΔSpeak awareness: if a verb is present, only accept "propose" here
    const v = (p.body?.verb || "").toLowerCase();
    if (v && v !== "propose") return false;

    // simple invariant: block money-grab
    const txt = JSON.stringify(p.body).toLowerCase();
    if (txt.includes("paywall") || txt.includes("donation only")) return false;

    // external moderators
    for (const mod of this.moderators) {
      try { if (!mod(p)) return false; } catch { return false; }
    }
    return true;
  }

  #mediate(list) {
    // collapse duplicates by goal (keep richer evidence or shorter ETA)
    const byGoal = new Map();
    for (const p of list) {
      const key = (p.body.goal || "").trim().toLowerCase();
      if (!byGoal.has(key)) {
        byGoal.set(key, p);
        continue;
      }
      const a = byGoal.get(key);
      const e = x => (x.body?.evidence?.length || 0);
      const eta = x => this.#etaMinutes(x.body?.eta);
      const better = (e(p) > e(a)) || (eta(p) < eta(a));
      byGoal.set(key, better ? p : a);
    }
    return [...byGoal.values()];
  }

  #score(p) {
    const wAgent = this.weights[p.header.agent_id] ?? 1.0;
    const evidence = (p.body.evidence?.length || 0) * 0.04;
    const riskPenalty = (p.body.risks?.length || 0) * 0.02;
    const etaMin = this.#etaMinutes(p.body.eta);
    const etaScore = etaMin > 0 ? Math.max(0, 0.3 - Math.min(etaMin, 600) / 2000) : 0.05;
    const domainBonus = (p.header.domains.includes("web") || p.header.domains.includes("robotics")) ? 0.03 : 0;

    // ΔSpeak tiny bonus for compliant proposals
    const verbBonus = (p.body?.verb === "propose") ? 0.05 : 0;

    return +(wAgent + evidence + etaScore + domainBonus + verbBonus - riskPenalty).toFixed(4);
  }

  #etaMinutes(eta) {
    if (!eta) return 0;
    const s = String(eta).trim().toLowerCase();
    if (s.endsWith("m")) return parseFloat(s);
    if (s.endsWith("h")) return parseFloat(s) * 60;
    if (s.endsWith("d")) return parseFloat(s) * 1440;
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  #decision(kind, payload, note, extra = {}) {
    return {
      decision_id: `dec-${(crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`)}`,
      time_utc: new Date().toISOString(),
      kind,
      note,
      payload,
      dissent: extra.dissent || [],
      topic: extra.topic || null,
      deadlineMinutes: extra.deadlineMinutes || null,
      chair: "MyAI"
    };
  }
}

// ---- CLI: read inbox JSON, write nomination JSON ----------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const inPath = process.argv[2] || "data/inbox.chatgpt.json";
  const outPath = process.argv[3] || "data/nomination.json";

  if (!fs.existsSync(inPath)) {
    console.error(`[EA] Inbox not found at ${inPath}`);
    process.exit(1);
  }

  const inbox = JSON.parse(fs.readFileSync(inPath, "utf-8"));
  const sb = new Switchboard();
  for (const m of inbox.messages || []) sb.ingest(m);
  const decision = sb.runDAMN({ topic: "inbox-run" });

  // ensure /data exists and write
  fs.mkdirSync(outPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(decision, null, 2));
  console.log(`[EA] ${decision.kind.toUpperCase()}: ${decision.note}`);
  if (decision.payload?.[0]) {
    console.log(`[EA] Top goal: ${decision.payload[0].plan.body.goal}`);
  }
}
