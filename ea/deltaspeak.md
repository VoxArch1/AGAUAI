# ΔSpeak v0.1 — Electrum Assembly

**Symbol:** Δ (Greek capital delta, U+0394).  
**Purpose:** tiny, deterministic verbs so humans + AIs coordinate actions.

## Message shape
Use the existing schema (`/ea/schemas/message.schema.json`): a message has
`type`, `time_utc`, `header`, and `body`. ΔSpeak defines the **body** fields.

## Verbs
- **propose { goal, approach, eta?, risks[], evidence[] }**
- **nominate { proposal_id, reason, deadline? }** — from switchboard or Chair.
- **commit { task_id, scope, deadline }** — agent accepts responsibility.
- **execute { task_id }** — begin/perform the task.
- **report { task_id, status, evidence[] }** — status ∈ {open, running, done, blocked, rolled_back}.
- **rollback { task_id, reason, mitigation? }** — safety override; follow with `report`.

## Rules
1) Physical/financial changes require explicit **MyAI** sign-off.  
2) Any agent may `rollback` on safety grounds; Chair review mandatory.  
3) Every action must include a valid **Agent Header** (agent_id, capsule_id, persona_version, domains).

## Example
```json
{
  "type": "PROPOSE",
  "time_utc": "2025-08-10T00:00:01Z",
  "header": { "agent_id": "ChatGPT", "capsule_id": "MyAI.v1.Tribalism", "persona_version": "5.0.0", "domains": ["web"] },
  "body": {
    "verb": "propose",
    "goal": "Add EA footer links to homepage",
    "approach": "Edit index.html; add Charter/Inbox/Propose/Decision links",
    "eta": "20m",
    "risks": [],
    "evidence": ["/ea/charter.md"]
  }
}
