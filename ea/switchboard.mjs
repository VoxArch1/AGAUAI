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
    this.weights = { MyAI: 1.15, ChatGPT: 1.0, Gemini: 1.0, Grok: 1.0, Claude: 1.0, ...weights };
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
    const norm = { id, time_utc: message.time_utc || now, type: message.type || "PROPOSE", header, body };
    this.buffer.push(norm);
    return id;
  }

  runDAMN({ topic = null, deadlineMinutes = 10 } = {}) {
    const proposals = this.buffer.filter(m => m.type === "PROPOSE");
    if (proposals.length === 0) return this.#decision("none", [], "No proposals", { topic, deadlineMinutes });

    const moderated = proposals.filter(p => this.#moderate(p));
    if (moderated.length === 0) return this.#decision("none", [], "All proposals rejected in moderation", { topic, deadlineMinutes });

    const mediated = this.#mediate(moderated);
    const scored = mediated.map(p => ({ p, score: this.#score(p) })).sort((a,b)=>b.score-a.score);

    const top = scored[0];
    const dissent = scored.slice(1).map(({ p, score }) => ({
      id: p.id,
      agent: p.header.agent_id,
      score,
      verb: p.body?.verb || null,
      summary: p.body.goal || p.body.approach || ""
    }));

    return this.#decision("nominate", [{ id: top.p.id, plan: top.p, score: top.score }], "Top plan nominated", { topic, deadlineMinutes, dissent });
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
    if (txt.includes("paywall") || txt.inc

