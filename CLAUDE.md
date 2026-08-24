# CLAUDE.md — Purchase Intelligence Prototype

## Required reading order

Before proposing or performing work, read completely:

1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `MASTER_PROMPT_PHASE_1.md`
4. The four `SKILL.md` files under `.agents/skills/`
5. `CLAUDE_CODE_START_HERE.md`

Treat these files as the project's approved product and workflow baseline. If they conflict, follow the user's latest explicit instruction first, then `AGENTS.md`, then the remaining files in the order above.

## Current authorization

The project begins in **Phase 0: planning only**.

The existence of this folder, this file, or the master prompt does not authorize implementation or testing.

Until the user sends the exact phrase below, do not:

- Create or modify application source code.
- Initialize a framework or application boilerplate.
- Install packages or dependencies.
- Start a development server.
- Run builds, tests, linters, browser automation, screenshots, or visual QA.
- Connect accounts or use real personal, financial, receipt, email, bank, or location data.
- Deploy or publish anything.

Exact Phase 1 authorization:

`APPROVE PHASE 1 BUILD + QA`

Do not infer approval from “continue,” “looks good,” “go ahead,” or similar wording.

## Phase 0 task

Return only the readiness package required by section 2 of `MASTER_PROMPT_PHASE_1.md`:

1. Understanding.
2. Proposed experience.
3. Recommended technical approach and tradeoffs.
4. Screen and state inventory.
5. Mock-data plan.
6. Acceptance plan.
7. Assumptions and unresolved decisions.
8. Scope exclusions.
9. The exact approval request.

Then stop and wait.

## Phase 1 task after approval

After receiving `APPROVE PHASE 1 BUILD + QA`, build only the Phase 1 mobile-first front-end concept demo defined in `MASTER_PROMPT_PHASE_1.md`.

Use iterative loops:

`PLAN → IMPLEMENT → RUN → INSPECT → IDENTIFY ISSUES → FIX → RUN AGAIN`

Phase 1 may include front-end code, navigation, map/globe presentation, coherent synthetic mock data, simulated Capture, simulated Smart Inbox, responsive layouts, rendered visual QA, interaction QA, and final screenshots.

Phase 1 must not include real integrations, real user data, production OCR or vision, real matching or fusion engines, production price infrastructure, complex backend, authentication, native apps, public deployment, or Phase 2.

When Phase 1 acceptance passes, deliver the required handoff and stop. Do not continue into a later phase without new explicit approval.

## Non-negotiable product truths

- GPS is evidence, never proof of a purchase or exact merchant.
- Ask the user only when uncertainty materially affects the outcome.
- Smart Inbox should resolve meaningful ambiguity with one tap.
- Never use an LLM as the source of factual prices, amounts, dates, distances, route times, coordinates, or place identifiers.
- Use synthetic data only in Phase 1 and label savings as mock, illustrative, or estimated.
- Keep mock totals, visit counts, averages, routes, and savings internally consistent.
- Do not split a recommended basket across stores.
- Compare product substitutions only when logically equivalent.
- Keep Map/Home, For You, Capture, Inbox, and Profile as the five primary areas.
- Design mobile first and make the map/globe the visual identity.
- Avoid admin-dashboard, banking-spreadsheet, CRUD-template, and generic AI-dashboard styling.

