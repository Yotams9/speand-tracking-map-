# Start Here — Spendscape in Codex

Open this `spendscape-worktree` folder as the primary local project and start a
new Codex task from this directory.

Send the exact initial prompt stored in:

`docs/spendscape/PROMPT_SEQUENCE.md` → **Prompt 0 — New Codex task handoff**.

The first task is a Phase 0 readiness review only. It reads the durable project
package, verifies branch and baseline, returns the requested readiness ledger,
and stops. It does not change application code or run the app.

When the readiness report is satisfactory, the exact Phase 1 authorization is:

`APPROVE SPENDSCAPE PHASE 1 BUILD + QA`

The inherited Ledgerline instructions below are historical and must not be used
as the Spendscape task prompt.

---

# Legacy Start Here

Open this folder as a project in Codex, start a new task in the project root, and send exactly this first instruction:

```text
Read AGENTS.md, PROJECT_CONTEXT.md, MASTER_PROMPT_PHASE_1.md, and the repository-local skills under .agents/skills. We are in Phase 0 only. Do not create or modify application code, install dependencies, run a server, run tests, use browser automation, take screenshots, or begin implementation. Return only the Phase 0 readiness package required by MASTER_PROMPT_PHASE_1.md, identify assumptions and unresolved decisions, and then stop. Do not begin Phase 1 unless I later send the exact authorization: APPROVE PHASE 1 BUILD + QA.
```

After reviewing Codex's readiness package, send this only when you are ready to authorize both implementation and Phase 1 QA:

```text
APPROVE PHASE 1 BUILD + QA
```

That authorization covers Phase 1 only. It does not authorize real integrations, real financial data, deployment, or Phase 2.
