// scripts/inbox-sync.mjs — mirror PROPOSE issues -> data/inbox.chatgpt.json
import fs from "fs";
import path from "path";

const repoFull = process.env.GITHUB_REPOSITORY || "";
const [owner, repo] = repoFull.split("/");
const token = process.env.GITHUB_TOKEN;
if (!owner || !repo) throw new Error("Missing GITHUB_REPOSITORY");
if (!token) throw new Error("Missing GITHUB_TOKEN");

// --- GitHub API (no deps)
async function gh(pathUrl, params = {}) {
  const u = new URL(`https://api.github.com${pathUrl}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "inbox-sync",
      Accept: "application/vnd.github+json"
    }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

async function listIssuesAll() {
  const per_page = 100;
  let page = 1, out = [];
  while (true) {
    const part = await gh(`/repos/${owner}/${repo}/issues`, { state: "all", per_page, page });
    out = out.concat(part);
    if (part.length < per_page) break;
    page++;
  }
  return out.filter(i => !i.pull_request);
}

// --- helpers to parse the issue body (Markdown)
const getId = t => (t.match(/EA-\d{4}-\d{3}/)?.[0] ?? null);
const shortFromTitle = t => (t.split("—")[1] || t.split(":").slice(1).join(":") || t).trim();
function section(body = "", heading = "Goal") {
  const m = body.match(new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(\\n##|$)`, "i"));
  return (m ? m[1] : "").trim();
}
function splitBullets(text = "") {
  return text.split(/\r?\n/).map(s => s.trim().replace(/^[-*]\s?/, "")).filter(Boolean);
}
function parseAgentHeader(text = "") {
  // expect:
  // agent_id: Human
  // capsule_id: MyAI.v1.Tribalism
  // persona_version: 1.0.0
  // domains: [governance]  or governance, web
  const out = {
    agent_id: "Human",
    capsule_id: "MyAI.v1.Tribalism",
    persona_version: "1.0.0",
    domains: ["governance"],
    auth: null
  };
  const lines = section(text, "Agent Header") || text; // fallback scan
  const g = k => (lines.match(new RegExp(`${k}\\s*:\\s*([^\\n]+)`, "i"))?.[1] || "").trim();
  const clean = v => v.replace(/^["'\[]|["'\]]$/g, "").trim();

  const aid = g("agent_id"); if (aid) out.agent_id = clean(aid);
  const cap = g("capsule_id"); if (cap) out.capsule_id = clean(cap);
  const ver = g("persona_version"); if (ver) out.persona_version = clean(ver);
  const dom = g("domains");
  if (dom) {
    if (dom.trim().startsWith("[")) {
      try { out.domains = JSON.parse(dom.replace(/'/g, '"')); }
      catch { out.domains = dom.replace(/[\[\]]/g, "").split(",").map(s => s.trim()).filter(Boolean); }
    } else {
      out.domains = dom.split(",").map(s => s.trim()).filter(Boolean);
    }
  }
  return out;
}
function parseEvidence(text = "") {
  const raw = splitBullets(text);
  return raw.map(s => {
    // turn [title](url) -> url
    const m = s.match(/\((https?:\/\/[^)]+|\/[^)]+)\)/);
    if (m) return m[1];
    // or extract bare URLs/paths
    const n = s.match(/(https?:\/\/\S+|\/\S+)/);
    return n ? n[1] : s;
  });
}

// --- build inbox messages
function issueToMessage(it) {
  const idStable = `msg-issue-${it.number}`;
  const goal = section(it.body || "", "Goal") || shortFromTitle(it.title);
  const approach = section(it.body || "", "Approach");
  const eta = (section(it.body || "", "ETA") || "").split(/\s+/)[0] || "";
  const risks = splitBullets(section(it.body || "", "Risks"));
  const evidence = parseEvidence(section(it.body || "", "Evidence / Links"));
  const header = parseAgentHeader(it.body || "");

  return {
    id: idStable,
    type: "PROPOSE",
    time_utc: it.created_at,
    header,
    body: {
      verb: "propose",
      goal,
      approach,
      eta,
      risks,
      evidence
    }
  };
}

(async () => {
  const issues = await listIssuesAll();

  // Only include OPEN PROPOSE issues in the inbox
  const proposes = issues.filter(i => /^PROPOSE\s*:/.test(i.title) && i.state === "open");

  const messages = proposes.map(issueToMessage);

  const out = {
    inbox: "AGAUAI",
    updated: new Date().toISOString(),
    messages
  };

  const outPath = path.join("data", "inbox.chatgpt.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`[Inbox] wrote ${messages.length} message(s) to ${outPath}`);
})().catch(err => {
  console.error("inbox-sync error:", err);
  process.exit(1);
});
