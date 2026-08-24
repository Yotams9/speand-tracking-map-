# Start Here in Claude Code

Open the `purchase-intelligence-prototype` folder in Claude Code and paste this exact first message:

```text
Read CLAUDE.md, AGENTS.md, PROJECT_CONTEXT.md, MASTER_PROMPT_PHASE_1.md, and every SKILL.md under .agents/skills completely before responding. We are currently in Phase 0 only. Do not create or modify application code, initialize a framework, install dependencies, start a server, run builds or tests, use browser automation, take screenshots, connect real data, deploy, or begin implementation. Return only the complete Phase 0 readiness package required by MASTER_PROMPT_PHASE_1.md. Clearly identify assumptions, unresolved decisions, the proposed Phase 1 technical approach, screen/state inventory, mock-data plan, acceptance plan, and scope exclusions. End by requesting the exact authorization APPROVE PHASE 1 BUILD + QA, then stop and wait.
```

Review Claude Code's Phase 0 response. When you are satisfied and want it to begin both implementation and Phase 1 QA, send exactly:

```text
APPROVE PHASE 1 BUILD + QA
```

That approval authorizes Phase 1 only. It does not authorize real integrations, real financial data, deployment, or Phase 2.
