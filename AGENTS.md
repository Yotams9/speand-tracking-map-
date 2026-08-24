# AGENTS.md — Purchase Intelligence Prototype

## Mission

Prepare and, only after explicit approval, build Phase 1 of a purchase-intelligence product: a polished mobile-first front-end concept demo that lets a human review the product direction before any real prototype or production system is built.

Read these files before proposing work:

1. `START_HERE.md`
2. `PROJECT_CONTEXT.md`
3. `MASTER_PROMPT_PHASE_1.md`
4. The relevant repository-local skills under `.agents/skills/`

When files disagree, follow this precedence:

1. The user's latest explicit instruction.
2. This `AGENTS.md`.
3. `PROJECT_CONTEXT.md`.
4. `MASTER_PROMPT_PHASE_1.md`.
5. Repository-local skills.

## Current state: Phase 0 — planning only

The project starts in Phase 0. The existence of this project folder or master prompt is not permission to build.

During Phase 0:

- Read and analyze the instruction files.
- Return a readiness report, proposed plan, assumptions, risks, and questions.
- Do not create or modify application source files.
- Do not select and install a framework or dependency.
- Do not initialize application boilerplate.
- Do not start a development server.
- Do not run application tests, browser automation, screenshots, builds, linters, or visual QA.
- Do not connect accounts, use real financial data, call production services, deploy, or publish anything.

Documentation may be edited only when the user explicitly requests a documentation change.

## Approval gate

Implementation and its QA loops may begin only after the user sends this explicit authorization:

`APPROVE PHASE 1 BUILD + QA`

Treat the following as insufficient authorization: “continue,” “looks good,” “go ahead” without naming the phase, approval of a plan in another context, or the master prompt itself.

If authorization is ambiguous, remain in Phase 0 and ask for the exact approval. Do not infer permission.

The approval unlocks only the Phase 1 front-end concept demo and the Phase 1 QA described in `MASTER_PROMPT_PHASE_1.md`. It does not authorize Phase 2, real integrations, real financial data, deployment, or production work.

## Phase workflow

### Phase 0 — readiness checkpoint

Produce the exact planning package required by `MASTER_PROMPT_PHASE_1.md`, then stop and wait for human review.

### Phase 1 — front-end concept demo

Enter only after `APPROVE PHASE 1 BUILD + QA`.

Work in evidence-driven loops:

`PLAN → IMPLEMENT → RUN → INSPECT → IDENTIFY ISSUES → FIX → RUN AGAIN`

For each loop:

1. State the current acceptance target.
2. Make the smallest coherent change that advances it.
3. Verify the change at an appropriate level.
4. Record visible or functional defects.
5. Fix high-impact defects before expanding scope.
6. Re-check the affected states.

Compilation alone is not completion. Visual polish, responsive behavior, coherent mock data, and working visible interactions are part of Phase 1 acceptance.

### Phase 1 completion hard stop

When the Phase 1 acceptance criteria are met:

1. Deliver the runnable demo, screenshots, run instructions, implementation summary, assumptions, and “Not implemented yet” list.
2. State any remaining known limitations honestly.
3. Stop.

Do not begin backend work, production integrations, deployment, or Phase 2. Require a new, explicit human approval for any later phase.

## Scope guardrails

Phase 1 is a visual and interactive simulation. Prefer a convincing mock over a production subsystem.

Allowed after Phase 1 approval:

- Front-end application code.
- Mobile-first responsive layouts and PWA-ready structure.
- Navigation and visible interactions.
- Map/globe presentation appropriate for a concept demo.
- Coherent mock purchases, merchants, routes, insights, and capture states.
- Local Phase 1 QA and final screenshots.

Not allowed in Phase 1:

- Real bank, card, Open Banking, email, Gmail, or SMS integrations.
- Real financial statements, receipts, location histories, or personal data.
- Production OCR, vision recognition, LLM orchestration, merchant matching, purchase fusion, price infrastructure, or geolocation tracking.
- Full authentication, complex backend, native mobile apps, App Store or Google Play work.
- Public deployment unless a later user instruction explicitly authorizes it.
- Phase 2 work of any kind.

Do not add a backend merely to serve mock data. Do not add enterprise architecture, speculative abstractions, or unrelated features.

## Product truth and trust rules

- Treat GPS as evidence only, never as proof that a purchase happened at a nearby business.
- Keep internal confidence reasoning out of normal UI unless uncertainty requires a one-tap Smart Inbox question.
- Never let an LLM invent prices, transaction amounts, distances, dates, route times, savings, or place identifiers.
- Mark Phase 1 data as mock or illustrative in project documentation and demo metadata.
- Make all mock numbers internally consistent and derivable from the canonical fixtures.
- Do not use or request real personal financial data for the concept demo.
- Present savings as estimates when the underlying data is simulated or incomplete.
- Do not recommend splitting one basket across multiple stores.
- Allow product substitutions only when they are logically equivalent; preserve meaningful distinctions such as regular versus zero-sugar products.

## UX guardrails

- Design mobile first; desktop is an adaptation, not the source layout.
- Make the map/globe the visual identity and hero of the Home experience.
- Keep the primary navigation to: Map, For You, Capture, Inbox, Profile.
- Keep Capture fast and camera-first, but simulated in Phase 1.
- Make Smart Inbox feel like rare assistance, not task management.
- Aim for the long-term interaction principle of zero or one user action per purchase.
- Avoid admin-dashboard, banking-spreadsheet, CRUD-template, and generic AI-dashboard aesthetics.
- Do not expose technical pipeline jargon in the consumer UI.
- Ensure every visible control either works in the demo or is clearly labeled as a future capability.

## Decision discipline

Use `PROJECT_CONTEXT.md` as the approved product baseline. Do not silently change product direction.

For minor reversible choices, make a professional recommendation and record the assumption. For major choices—such as the technology stack, map provider, paid dependency, information architecture change, or scope expansion—surface the decision during Phase 0 and wait for approval when it materially changes cost, product direction, or commitments.

## Repository-local skills

Use these skills when their descriptions match the task:

- `$plan-with-phase-gates`
- `$design-mobile-pwa-ux`
- `$curate-coherent-mock-data`
- `$run-visual-qa-loops`

Skills do not override the approval gate in this file.

