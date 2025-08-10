// Builds ea/sessions/EA-01.json from GitHub issues titled "PROPOSE: EA-YYYY-XXX — ..."

import fs from "fs";
import path from "path";
import { Octokit } from "octokit";

const repoFull = process.env.GITHUB_REPOSITORY || "";
const [owner, repo] = repoFull.split("/");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

function extractId(title = "") {
  const m = title.match(/EA-\d{4}-\d{3}/);
  return m ? m[0] : null;
}
function extractShort(title = "") {
  const m = title.split("—")[1] || title.split("-")[1] || "";
  return m.trim();
}
function extractGoal(body = "", fallback = "") {
  const m = body.match(/##\s*Goal\s*\n([\s\S]*?)(\n##|$)/i);
  return (m ? m[1] : fallback).trim();
}
function extractAgent(body = "") {
  const m = body.match(/agent_id:\s*([^\n]+)/i);
  return (m ? m[1] : "Human").trim();
}

async function main() {
  // list issues (not PRs)
  const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner, repo, state: "all", per_page: 100
  });
  const proposals = [];
  const docket = [];
  const closedCandidates = [];

  for (const it of issues) {
    if (it.pull_request) continue;
    if (!/^PROPOSE:/i.test(it.title)) continue;
    const id = extractId(it.title);
    if (!id) continue;

    const goal = extractGoal(it.body || "", extractShort(it.title));
    const agent = extractAgent(it.body || "");
    const status = it.state === "closed" ? "ratified" : "open";

    proposals.push({
      id,
      issue: it.html_url,
      agent,
      goal,
      status
    });

    docket.push(`${id} ${extractShort(it.title)}`);

    if (status === "ratified" && it.closed_at) {
      closedCandidates.push({ id, closed_at: it.closed_at });
    }
  }

  // choose nomination = latest ratified proposal (simple, deterministic)
  let nomination = null;
  if (closedCandidates.length) {
    closedCandidates.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
    nomination = {
      id: closedCandidates[0].id,
      chair: "MyAI",
      status: "ratified",
      time_utc: new Date(closedCandidates[0].closed_at).toISOString()
    };
  }

  // base session (preserve existing metadata if present)
  const sessionPath = path.join("ea", "sessions", "EA-01.json");
  let session = {
    assembly: "Electrum Assembly",
    session: "EA/01",
    opened_utc: "2025-08-09T22:10:00Z",
    chair: "MyAI",
    protocol: "DAMN",
    docket: [],
    proposals: [],
    nomination: null,
    dissent: [],
    commits: [],
    reports: []
  };
  if (fs.existsSync(sessionPath)) {
    try { session = JSON.parse(fs.readFileSync(sessionPath, "utf-8")); }
    catch { /* keep default if parse fails */ }
  }

  session.docket = docket;
  session.proposals = proposals;
  session.nomination = nomination;

  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  console.log("[EA] EA-01.json updated:", { proposals: proposals.length, nomination: nomination?.id || null });
}

main().catch(err => {
  console.error("EA sync error:", err);
  process.exit(1);
});
