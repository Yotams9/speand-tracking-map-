# Spendscape — Phased Execution Plan

Every phase has a separate human gate. Later phases are context, not current
authorization.

Current completed implementation checkpoint: Phase 1 through bounded Slice
1D.3. It includes the accepted globe-fidelity correction, deterministic
Analytics/Stats, synthetic Universal Scanner/Capture simulation, bounded
loading recovery, and canonical local search. No product or technology slice
is active. Technology candidates and evaluation work nest inside these phases
as specified in `TECHNOLOGY_STRATEGY.md`; they do not create a competing roadmap
or authorize real ingestion.

## Phase 0 — readiness and decision checkpoint

Status: completed.

Objective: establish a trustworthy baseline and confirm the first build slice.

Authorized during Phase 0: read repository/durable documents, inspect public references
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

Status: completed and checkpointed.

- Record the existing baseline before modification.
- Migrate deliberately from Vite to Next.js App Router + TypeScript.
- Preserve useful fixture/derivation/i18n behavior.
- Keep globe state outside remount-prone route boundaries.
- Lock Node/package-manager versions and update run instructions.

### 1B — design system and shell

Status: completed and checkpointed.

- Rebrand Ledgerline to Spendscape.
- Implement original dark-premium tokens inspired by the reference.
- Build desktop/mobile composition from `PRODUCT_CONTEXT.md`.
- Accessibility, safe areas, RTL, keyboard, and reduced motion.

### 1C — globe fidelity spike and integration

Status: completed through the approved Slice 1C.1 visual-polish checkpoint.

- MapLibre globe with an approved development style.
- Atmosphere, auto-spin/stop, gestures, reset, fly-to, fit-bounds, clusters,
  canonical place pins, heatmap, tooltips/selection, and empty states.
- Prove one place/many purchases = one pin and online purchase = no pin.
- Measure representative performance before expanding.

### 1D — synthetic product experience

Status: bounded Slices 1D.1, 1D.2, and 1D.3 are complete and checkpointed. Search,
filters, timeline, Purchases, place/purchase detail, shared state, nested
receipts, cash/manual, multi-currency provenance, unresolved examples, and
deterministic Analytics/Stats, and the synthetic frontend Universal
Scanner/Capture simulation with session-only demo records are implemented.
Smart Inbox, AI actions, Life Replay, privacy/share,
providers, real ingestion, and backend work remain deferred.

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

Hard stop: no additional product slice, real backend, accounts, real data,
deployment, commit/push, or Phase 2 without separate authorization.

## Phase 2 — Supabase foundation and canonical data

Gate: `APPROVE SPENDSCAPE PHASE 2 BACKEND + AUTH + QA`

Implement the approved canonical backend/auth boundary, migrations, RLS,
private storage policy, and server data access using synthetic data. Supabase is
the current platform candidate. Creating or connecting a Supabase project,
selecting a region/plan, applying remote migrations, or enabling paid usage
requires a separately named provider-resource authorization. Add queues only
for a concrete approved retryable workload.

Evidence: reviewed migrations, RLS tests, isolated environments, rollback, and
threat-model update. Stop before Gmail/scanner AI/real data/deployment.

## Phase 3 — Universal Scanner and ingestion

Gate: `APPROVE SPENDSCAPE PHASE 3 INGESTION + QA`

Implement approved camera/file/PDF/CSV/manual pipelines, barcode adapters,
idempotent jobs, and product-photo deletion. Tesseract.js is an OCR benchmark
candidate; AI-assisted extraction must use an approved `AIProvider` benchmark
and adapter. Gmail is a separate consent slice and needs explicit
credential/connection confirmation.

Evidence: synthetic/adversarial fixtures, retries, schema validation, retention
audit, cost/latency, and no duplicate writes.

## Phase 4 — matching, fusion, Smart Inbox, currencies

Gate: `APPROVE SPENDSCAPE PHASE 4 MATCHING + FUSION + QA`

Implement evidence fusion/deduplication, `PlaceProvider`/GPS candidate matching,
Smart Inbox resolution, FX adapters, and correction audit. Geoapify, Google
Places, bounded Overture data, and Frankfurter remain candidates until their
approved benchmark and provider-promotion record are complete.

Evidence: deterministic evaluation set, false-merge/match analysis, reversible
decisions, GPS-never-proof tests, and provider provenance.

## Phase 5 — intelligence, privacy, sharing, replay

Gate: `APPROVE SPENDSCAPE PHASE 5 INTELLIGENCE + PRIVACY + QA`

Add advanced analytics, habits/insights, typed AI UI tools through
`AIProvider`, Life Replay, scoped sharing, export/deletion/retention, and
privacy center. Cloudflare Workers AI/Gemma is the initial benchmark candidate;
an optional OpenAI Responses adapter remains documented. Neither is selected
without the approved benchmark and privacy/provider gate.

Evidence: authorization/confirmation gates, redaction, share expiry/revocation,
reduced motion, and insight truthfulness evaluations.

## Phase 6 — production hardening and deployment

Gate: `APPROVE SPENDSCAPE PHASE 6 DEPLOYMENT + RELEASE QA`

Finalize providers, observability, rate/cost controls, security review,
backup/recovery, PWA production checks, preview, and the approved deployment
target. Vercel is a candidate; Hobby is development/private-noncommercial-demo
only unless current terms permit the intended use.

Before production, present exact target, environment, data policy, estimated
cost, security evidence, and rollback plan.

## Technology sub-gates within approved phases

An existing phase token authorizes only the work named by that phase and the
latest bounded user instruction. It does not automatically authorize:

- installing every candidate package in `TECHNOLOGY_STRATEGY.md`;
- creating provider accounts, projects, databases, buckets, OAuth clients, or
  remote migrations;
- adding payment methods, paid plans, overages, or automatic billing;
- sending private data to OCR/AI/email/place/product/FX providers;
- connecting Gmail or another external account;
- production deployment or real-user data.

Before any such action, report the exact provider, environment, data fields,
licence/attribution, quota, commercial-use terms, privacy/retention, billing
failure mode, fallback, test evidence, and rollback, then obtain the separately
required explicit authorization.

## Cross-phase ledger

Every checkpoint reports current phase/authorization, completed evidence,
remaining acceptance items, changed files/dependencies/providers, assumptions,
decisions needed, deferred work, Git status, remote/deployment state, and exact
next approval. Then stop at the phase hard stop.
