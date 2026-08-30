# Spendscape — Phased Execution Plan

Every phase has a separate human gate. Later phases are context, not current
authorization.

## Phase 0 — readiness and decision checkpoint

Objective: establish a trustworthy baseline and confirm the first build slice.

Authorized now: read repository/durable documents, inspect public references
read-only, and return this readiness deliverable:

1. Branch/worktree and clean-state evidence.
2. Inherited-code baseline: preserve/adapt/replace.
3. Restatement of locked decisions without reopening settled questions.
4. Material risks and contradictions.
5. Recommended Phase 1 slices.
6. Globe-renderer plan and production-provider decision gate.
7. Screen/state and synthetic-data acceptance matrix.
8. Missing accounts, keys, tools, MCPs, or skills separated into needed now and
   later.
9. Explicit scope exclusions.
10. End with `APPROVE SPENDSCAPE PHASE 1 BUILD + QA` and stop.

Hard stop: no file changes, installs, app execution, tests, commit, push, or
deployment.

## Phase 1 — foundation, premium UX, real globe, synthetic story

Gate: `APPROVE SPENDSCAPE PHASE 1 BUILD + QA`

Objective: a polished local Spendscape PWA concept on the target frontend, with
a real smooth globe and complete synthetic product story. No production backend
or real user data.

### 1A — baseline and migration

- Record the existing baseline before modification.
- Migrate deliberately from Vite to Next.js App Router + TypeScript.
- Preserve useful fixture/derivation/i18n behavior.
- Keep globe state outside remount-prone route boundaries.
- Lock Node/package-manager versions and update run instructions.

### 1B — design system and shell

- Rebrand Ledgerline to Spendscape.
- Implement original dark-premium tokens inspired by the reference.
- Build desktop/mobile composition from `PRODUCT_CONTEXT.md`.
- Accessibility, safe areas, RTL, keyboard, and reduced motion.

### 1C — globe fidelity spike and integration

- MapLibre globe with an approved development style.
- Atmosphere, auto-spin/stop, gestures, reset, fly-to, fit-bounds, clusters,
  canonical place pins, heatmap, tooltips/selection, and empty states.
- Prove one place/many purchases = one pin and online purchase = no pin.
- Measure representative performance before expanding.

### 1D — synthetic product experience

- Search, filters, timeline, Analytics/Stats, Purchases, place/purchase detail.
- Universal Scanner simulation, cash/manual, nested receipt items.
- Smart Inbox, multi-currency-ready display, AI action simulation, Life Replay,
  and privacy/share concepts.
- All numbers from one coherent synthetic fixture source.

### 1E — functional and visual QA

- Appropriate type/build/unit checks.
- Every visible control exercised.
- Small, typical, large phone and desktop rendered review.
- Globe performance/interaction, RTL, keyboard, reduced motion, long copy,
  empty/loading/error, and PWA-ready states.
- Fix blockers/high defects and re-check neighboring states.

Acceptance evidence: runnable local app, run instructions, final screenshots,
functional/visual matrix, baseline-versus-final summary, dependency/provider
rationale, known limitations, and “Not implemented yet”.

Hard stop: no real backend, accounts, real data, deployment, commit/push, or
Phase 2 without separate authorization.

## Phase 2 — Supabase foundation and canonical data

Gate: `APPROVE SPENDSCAPE PHASE 2 BACKEND + AUTH + QA`

Add Supabase Auth, Postgres/PostGIS, RLS, migrations, canonical data, private
storage policy, queues foundation, and server data access. Use synthetic data.

Evidence: reviewed migrations, RLS tests, isolated environments, rollback, and
threat-model update. Stop before Gmail/scanner AI/real data/deployment.

## Phase 3 — Universal Scanner and ingestion

Gate: `APPROVE SPENDSCAPE PHASE 3 INGESTION + QA`

Implement camera/file/PDF/CSV/manual pipelines, barcode adapters, OpenAI
structured extraction, idempotent jobs, and product-photo deletion. Gmail is a
separate consent slice and needs explicit credential/connection confirmation.

Evidence: synthetic/adversarial fixtures, retries, schema validation, retention
audit, cost/latency, and no duplicate writes.

## Phase 4 — matching, fusion, Smart Inbox, currencies

Gate: `APPROVE SPENDSCAPE PHASE 4 MATCHING + FUSION + QA`

Implement evidence fusion/deduplication, Google Places/GPS candidate matching,
Smart Inbox resolution, FX adapters, and correction audit.

Evidence: deterministic evaluation set, false-merge/match analysis, reversible
decisions, GPS-never-proof tests, and provider provenance.

## Phase 5 — intelligence, privacy, sharing, replay

Gate: `APPROVE SPENDSCAPE PHASE 5 INTELLIGENCE + PRIVACY + QA`

Add advanced analytics, habits/insights, typed AI UI tools, Life Replay, scoped
sharing, export/deletion/retention, and privacy center.

Evidence: authorization/confirmation gates, redaction, share expiry/revocation,
reduced motion, and insight truthfulness evaluations.

## Phase 6 — production hardening and deployment

Gate: `APPROVE SPENDSCAPE PHASE 6 DEPLOYMENT + RELEASE QA`

Finalize providers, observability, rate/cost controls, security review,
backup/recovery, PWA production checks, preview, and approved Vercel release.

Before production, present exact target, environment, data policy, estimated
cost, security evidence, and rollback plan.

## Cross-phase ledger

Every checkpoint reports current phase/authorization, completed evidence,
remaining acceptance items, changed files/dependencies/providers, assumptions,
decisions needed, deferred work, Git status, remote/deployment state, and exact
next approval. Then stop at the phase hard stop.
