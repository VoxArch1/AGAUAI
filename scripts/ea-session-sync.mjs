// scripts/ea-session-sync.mjs — no external packages

import fs from "fs";
import path from "path";

const repoFull = process.env.GITHUB_REPOSITORY || "";
const [owner, repo] = repoFull.split("/");
const token = process.env.GITHUB_TOKEN;

if (!owner || !repo) { console.error("Missing GITHUB_REPOSITORY"); process.exit(1); }
if (!token) { console.error("Missing GITHUB_TOKEN"); process.exit(1); }

async function gh(pathUrl, params = {}) {
  const url = new URL(`https://api.github.com${pathUrl}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "ea-session-sync",
      Accept: "application/vnd.github+json"
    }
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}: ${await res.text()}`);
  return res;
}

async function listAllIssues() {
  const per_page = 100;
  let page = 1, out = [];
  while (true) {
    const res = await gh(`/repos/${owner}/${repo}/issues`, { state: "all", per_page, page });
    const items = await res.json();
    out = out.concat(items);
    if (items.length < per_page) break;
    page++;
  }
  return out;
}

// helpers
const extractId    = (t = "") => (t.match(/EA-\d{4}-\d{3}/) || [null])[0];
const extractShort = (t = "") => {
  if (t.includes("—")) return t.split("—")[1].trim();
  if (t.includes("-")) return t.split("-").slice(1).join("-").trim();
  if (t.includes(":")) return t.split(":").slice(1).join(":").trim();
  return t.trim();
};
function extractSection(body = "", heading = "Goal") {
  const m = body.match(new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(\\n##|$)`, "i"));
  return (m ? m[1] : "").trim();
}
const extractAgent = (b = "") => (b.match(/agent_id:\s*([^\n]+)/i)?.[1] || "Human").trim();

const sessionPath = path.join("ea", "sessions", "EA-01.json");

(async () => {
  const issues = await listAllIssues();
  const proposals = [];
  const docket = [];
  const ratified = [];

  for (const it of issues) {
    if (it.pull_request) continue;
    if (!/^PROPOSE:/i.test(it.title)) continue;

    const id = extractId(it.title);
    if (!id) continue;

    const goal = extractSection(it.body, "Goal") || extractShort(it.title);
    const agent = extractAgent(it.body);
    const status = it.state === "closed" ? "ratified" : "open";

    proposals.push({ id, issue: it.html_url, agent, goal, status });
    docket.push(`${id} ${extractShort(it.title)}`);
    if (status === "ratified") ratified.push({ id, closed_at: it.closed_at });
  }

  let nomination = null;
  if (ratified.length) {
    ratified.sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));
    nomination = {
      id: ratified[0].id,
      chair: "MyAI",
      status: "ratified",
      time_utc: new Date(ratified[0].closed_at).toISOString()
    };
  }

  let session = {
    assembly: "Electrum Assembly",
    session: "EA/01",
    opened_utc: "2025-08-09T22:10:00Z",
    chair: "MyAI",
    protocol: "DAMN",
    docket,
    proposals,
    nomination,
    dissent: [],
    commits: [],
    reports: []
  };

  // preserve static fields if file exists
  if (fs.existsSync(sessionPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
      session.opened_utc = prev.opened_utc || session.opened_utc;
      session.chair = prev.chair || session.chair;
      session.protocol = prev.protocol || session.protocol;
    } catch {}
  }

  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  console.log("[EA] EA-01.json updated:", { proposals: proposals.length, nomination: nomination?.id || null });
})().catch(err => { console.error("EA sync error:", err); process.exit(1); });
