# Spendscape — Conversation Handoff

This file transfers the relevant decisions and workspace history into a durable
form. It is a summary of user intent, not a verbatim transcript.

## Latest gate — Scanner E Replay history correction, 2026-09-15

The user authorized `APPROVE SPENDSCAPE SCANNER E — SESSION-ONLY REVIEWED PURCHASE INTEGRATION + LOCAL QA`.
The completed working-tree slice connects Scanner B identification, demo candidates,
synthetic receipts and manual/cash/online input to explicit reviewed session
additions. One ledger feeds the existing composed graph, including Undo. No
fixture mutation, persistence, provider, OCR integration or deployment is added.
[SCANNER_E_CHECKPOINT.md](SCANNER_E_CHECKPOINT.md) records implementation and QA.
The first checkpoint review found one High provenance/FX defect and two Medium
search-persistence/insecure-context defects. The user separately authorized
`APPROVE SPENDSCAPE SCANNER E — PROVENANCE, PRIVACY AND INSECURE-CONTEXT CORRECTION + LOCAL QA`.
Those bounded corrections are complete; the fresh final-state combined production
suite passed 77/77 with no flaky results, skips or timeouts. The checkpoint
document records the focused tests and preserves the original review findings.
The following checkpoint review reproduced a remaining Medium browser-history
privacy defect: Replay retained purchase-derived search in a forward entry after
reload. The user authorized `APPROVE SPENDSCAPE SCANNER E — REPLAY HISTORY PRIVACY CORRECTION + LOCAL QA`.
Full Replay snapshots now stay in runtime memory; history contains only an opaque
session reference and navigation flags. Legacy query payloads are discarded when
visited, and obsolete sessions cannot reactivate after reload. The fresh complete
combined suite passed 81/81, including four new EN/HE history regressions.
The checkpoint document records targeted navigation QA and the legacy-history
cleanup limitation. No checkpoint review pass or commit is implied.
The next separate gate is a new `APPROVE SPENDSCAPE SCANNER E CHECKPOINT REVIEW`.
No further implementation slice is active. No commit or push is authorized. Physical iPhone Scanner E QA is pending a
separately approved deployment; the existing A/B smoke pass does not cover E.

Scanner D1's bounded numeric-evidence correction and checkpoint were separately
reviewed, committed and pushed at `96ef57d8ecd8de2d1f6a43a71a461fae662ccb3a`.
Its negative D2 recommendation and benchmark evidence remain unchanged. The D1
section below preserves the original pre-review handoff; its pending gate was
subsequently consumed by those explicit approvals.

## Historical gate — Scanner D1 benchmark, 2026-09-10

The iPhone/Vercel documentation checkpoint was committed and pushed as
`591a9e9ffe09114713040c72cf88eb09369fc335`. The user subsequently authorized
only a synthetic, local Scanner D1 OCR benchmark with Tesseract.js/core 7.0.0.
That working-tree benchmark and bounded QA are complete; checkpoint review is
pending. [SCANNER_D1_CHECKPOINT.md](SCANNER_D1_CHECKPOINT.md) records exact
assets/dependencies, measured failures, privacy limits, regressions and Git state.
The current configuration is rejected for D2 integration because clean
Hebrew/mixed accuracy and guaranteed initialization cleanup did not pass.
No consumer code, camera/gallery integration, structured receipt parser or
deployment changed. D2, D3, E, C and any internal worker adapter remain gated.
Physical iPhone OCR is untested; the earlier A/B user-reported pass is separate.
Next token: `APPROVE SPENDSCAPE SCANNER D1 CHECKPOINT REVIEW`.

## Origin

- Referenced ChatGPT conversation: `הכנת פרומפט לCodex`
- Conversation ID: `6a8b6332-3324-83eb-b60d-b5e516123aff`
- The user moved the complete Spendscape workflow into Codex Work mode and asked
  that all settled decisions continue here.

## Settled product intent

- Name: Spendscape.
- Responsive web/PWA only; no native store application.
- Premium, modern, near-black, highly interactive 3D experience.
- Globe-first UX with one pin per physical purchase place.
- Online purchases remain in history/analytics without pins.
- Receipt purchases contain nested items; product photos are not retained.
- Universal Scanner covers receipts, products, barcodes, and documents.
- Sources include PDF, CSV, Gmail, manual/cash, camera, and barcode.
- GPS assists place matching but is never proof.
- AI/LLMs carry much of extraction and semantic matching; deterministic systems
  own factual validation.
- Smart Inbox appears only for uncertain cases that materially need an answer.
- Deduplication/fusion across sources is mandatory.
- Search, filters, timeline, analytics, AI map/UI control, Life Replay,
  multi-currency, sharing, and privacy controls are required.
- Current frontend: Next.js/TypeScript with MapLibre.
- Long-term infrastructure, places, AI, OCR, email, product, FX, and deployment
  systems remain gated candidates behind provider abstractions. The reconciled
  evaluation policy is in `TECHNOLOGY_STRATEGY.md`.

## Reference decisions

- The user requires the globe and pins to feel as smooth and interactive as the
  food-map reference and attached recording.
- Public client inspection established that the benchmark uses MapLibre GL JS,
  OpenFreeMap, globe projection, sky/atmosphere, circle/heatmap layers,
  auto-spin/interaction stop, popups, fly-to, and fit-bounds.
- The user wants the Refero Origin Financial design language adapted without
  abandoning the globe-first product or copying the reference brand.
- MapLibre is therefore the current renderer for behavioral fidelity.
  Place-provider candidates remain behind `PlaceProvider`; a Google Maps JS 3D
  renderer remains a gated alternative, not silently discarded.

## Repository history

- Starter: `https://github.com/Yotams9/speand-tracking-map-.git`.
- Original repository contains a Ledgerline Vite/React/TypeScript concept demo.
- Baseline commit at worktree creation: `eee0d26b55e5061f87ac664938df0c195800b74f`.
- A permanent sibling worktree was created on
  `feature/spendscape-rebuild`.
- The local `main` checkout remained clean and unchanged.
- At worktree creation the feature branch had no upstream. After separate push
  approvals it now tracks `origin/feature/spendscape-rebuild`; this is distinct
  from a GitHub deployment integration, which was not connected.
- Planning/authority checkpoint: `7dfc330`.
- Next.js migration, globe, PWA, tests, and Slice 1C.1 checkpoint: `cee5418`.
- Canonical purchase experience through bounded Slice 1D.1: `56670045`.
- Deterministic Analytics/Stats foundation through bounded Slice 1D.2:
  `2d7d75e`.
- Accepted OpenFreeMap Liberty, RTL, trackpad, close-zoom pin, and Heatmap
  fidelity correction: `b5796c5`.
- Synthetic Capture, loading recovery, canonical local search, desktop
  selected-place positioning, and local QA through bounded Slice 1D.3:
  `9b7aaf39`.
- Material-uncertainty Smart Inbox simulation, synchronized canonical
  resolution/defer/Undo, visible keyboard focus, and local QA through bounded
  Slice 1D.4: `58a3c4b`.
- Synthetic Ask, full runtime action validation, focus/history corrections,
  and accepted mobile order through Slice 1D.5:
  `8ea8371f6863e7d40ae6fe276935926ddbadda56`.
- Details-first synthetic Life Replay, renderer-loss/history corrections,
  stationary ordinary playback, explicit `Show place`, and local QA through
  Slice 1D.6: `95d865f1c255e9bfd68d9f69bbe0caf0d8b343fa`.
- The app now uses Next.js App Router, MapLibre, one canonical synthetic fixture
  graph, Purchases/detail surfaces, and shared globe/search/filter/timeline
  state. Engineering and rendered QA were completed at the approved slice
  checkpoints.
- Generated screenshots, recordings, browser caches, and Playwright output stay
  ignored and local; they are not durable source authority.

## Current implementation assessment

The active Spendscape shell is dark, responsive, English/Hebrew/RTL-aware, and
globe-first. MapLibre renders one canonical feature per confirmed physical
place, with clusters and heatmap as renderer layers; online and unresolved
purchases do not enter the place source. Slice 1D.1 adds coherent physical,
online, cash/manual, nested receipt, multi-currency, and unresolved synthetic
stories with synchronized discovery state. Slice 1D.2 adds deterministic
desktop Analytics/mobile Stats derived from that graph. The accepted globe
correction preserves OpenFreeMap Liberty while completing RTL shaping,
trackpad/wheel behavior, top-layer close-zoom pins, and visible Heatmap density.

Scanner/Capture and the one material-uncertainty Smart Inbox case are accepted
synthetic frontend simulations. Slice 1D.5 synthetic Ask and its bounded
runtime/focus/history/navigation corrections are completed and checkpointed.
Slice 1D.6 synthetic Life Replay is also completed and checkpointed; it is
details-first, ordinary playback never moves the camera, and explicit `Show
place` is the only Replay action that does. No Phase 1 product implementation
slice is active. The final Phase 1E critical review passed with no remaining
Blocker or High defect and is recorded by the current documentation checkpoint.
Bounded Phase 2A.1 is complete. Later Scanner A/B and the bounded Vercel demo
were separately approved and completed as recorded below. Real AI/LLM calls,
production Replay, privacy/sharing, backend, application authentication, file
ingestion, OCR, Gmail, real provider integrations and factual FX remain deferred.

## Current authority

The user approved Phase 1 build/QA and then bounded implementation through
Slices 1A–1C.1, 1D.1, 1D.2, the globe-fidelity correction, and bounded Slices
1D.3–1D.6. Those checkpoints are complete and accepted at
`95d865f1c255e9bfd68d9f69bbe0caf0d8b343fa`. The final bounded Phase 1E
critical review is complete and its documentation is recorded by the
Phase 1E documentation checkpoint. Bounded Phase 2A.1 is complete:
provider-neutral local data read contract, unchanged-fixture adapter, contract
tests, and local QA. The checkpoint-review P2 Ask merchant lookup is corrected:
active features and domain operations require supplied snapshot data, and the
unchanged fixture graph is confined to the adapter and related tests. The
correction and focused review passed with no remaining Blocker or High defect;
the separate checkpoint commit approval was received on 2026-09-05 and is
consumed by this local checkpoint, based on
`ac8801c19459c3cb4e000a3f49666ee9ee0df2e1`. Later scanner and demo approvals
are recorded below; none activates a further implementation slice.

Do not infer AI, Supabase, SQL/migrations, Zod, any provider, real ingestion,
backend resources, authentication, deployment, or a later slice from Phase
2A.1.
Require a new exact bounded authorization.

## Scanner A/B and college-demo reconciliation

Recorded on 2026-09-09 under
`APPROVE SPENDSCAPE DOCUMENTATION-ONLY IPHONE SCANNER A+B AND VERCEL DEMO RECONCILIATION`.
This section records the status at that documentation checkpoint.
No implementation slice was active then; the latest Scanner E gate is above.

### Completed checkpoints and Git

- Scanner A: completed, reviewed, committed and pushed at
  `23683efcfea1151b96d940e420eafd19760626c6`.
- Scanner B, including bounded transient invalid-frame recovery: completed,
  reviewed, committed and pushed at
  `33a34afb2668f58b89431e3cb7bc5f3c292ebb8d`.
- Live local Git verification for this reconciliation: branch
  `feature/spendscape-rebuild`, upstream `origin/feature/spendscape-rebuild`,
  both refs at the Scanner B commit. Local `main` and `origin/main` remain
  `eee0d26b55e5061f87ac664938df0c195800b74f`. Index empty; the only initial
  working-tree drift was `next-env.d.ts`, preserved exactly and excluded from
  this documentation change. No remote write is part of this task.

### Physical device QA — user-reported smoke-test pass

Source: the user's explicit report in this reconciliation request, recorded
on 2026-09-09; the exact device test time was not supplied.

- Device: **iPhone 17 Pro**.
- OS: **iOS 26.6.1**; browser: **Safari on that iOS version**.
- Target: [the existing college demo](https://spendscape-college-demo.vercel.app).
- The user successfully opened Capture on the physical iPhone.
- A real product barcode scanned successfully, and the decoded digits matched
  the barcode printed on the physical product.
- Manual barcode entry worked.
- The user reported that the remaining previously requested Scanner A/B
  controls worked; no independently recorded per-control device matrix was supplied.

This is a **user-reported physical-device smoke test**, not a Codex-operated or
independently instrumented device test. No independent device logs, screenshots,
recordings, performance measurements, autofocus benchmarks, glare tolerance,
distance/rotation coverage, Android coverage or exhaustive Safari compatibility
are established by this report. Prior synthetic browser tests remain separate
evidence. The basic iPhone smoke test is no longer entirely pending; broader
physical-device and performance coverage remains unverified.

### Demo candidate behavior and deferred clarity issue

At the deployed Scanner B checkpoint, “Try Demo Product” (English label:
“Try demo product”) intentionally
loads the deterministic **Demo Oats** candidate (displayed as “Demo oats”) and
demo EAN-13 `2000000000015` without using the camera. It is a fictional catalog
example. Scanner B performs **identification only**: scanning, manual entry,
loading or editing this candidate does not create or save a purchase.

Repeatedly pressing the demo action while the same candidate is already loaded
produced no visible change at that checkpoint. It was recorded as **Low — minor UX clarity**,
not a Scanner B functional failure. Optional improvement was then deferred
to Scanner E or another separately approved UI-polish slice: rename it “Load demo product”;
disable or hide it after loading; show “Demo product loaded — review only”; and
clarify that purchase creation requires a later approved review/save flow. None
of those changes is implemented or authorized by this documentation task.
Existing manual/synthetic Capture purchase flows remained separate from Scanner B.
The later local Scanner E working tree implements the approved demo-action
clarity changes and explicit reviewed save flow. The deployed Scanner B demo
remains unchanged; Scanner E has not been deployed.

### Existing Vercel college-demo deployment

- Project: `spendscape-college-demo`; account/team: **SkDev / sk-dev3**; **Hobby**.
- Stable URL: https://spendscape-college-demo.vercel.app
- Immutable URL: https://spendscape-college-demo-7eqcwgglo-sk-dev3.vercel.app
- Deployment ID: `dpl_5Q3n79vhoHTxv6R7WYdE3FPkSQfC`.
- Deployed commit: `33a34afb2668f58b89431e3cb7bc5f3c292ebb8d`.
- Status: active; READY was verified during the separately authorized deployment.
  This documentation-only task does not repeat deployment or browser QA.
- Label: **Production**, under the explicit first-production-bootstrap approval
  because of Vercel's first-deployment behavior. Its purpose remains the bounded,
  temporary non-commercial college demonstration and physical iPhone Scanner A/B
  QA; this is not general production-release approval.

The earlier Preview-only attempt was removed after Vercel assigned it Production.
The later, separately approved Production bootstrap above is the retained demo.
Its prior verification established valid HTTPS, HTTP 200 at the stable root,
rendered Spendscape and application-origin reader WASM matching the approved
SHA-256. The immutable URL required Vercel sign-in; the stable URL was accessible
without sign-in. Platform Deployment Protection is not application authentication.
No new verification of those hosted facts is claimed in this documentation task.

The recorded deployment state has no GitHub deployment integration, configured
environment variables or real provider integration. No database, storage service,
application authentication or paid service was added. Analytics/Speed Insights
metadata remained unchanged, with no activation performed. Vercel's normal
framework hosting and automatically assigned platform domains are the existing
hosting exception, not new backend or custom-domain authority. No tokens, OIDC
values, credentials or personal IP addresses belong in durable documentation.

### Remaining gates at the documentation checkpoint

At that checkpoint, Scanner D, Scanner E, optional Scanner C, backend, database, authentication,
real providers, further accounts/resources and deployment changes remain
separately gated. No implementation slice was active. That task authorized only
documentation reconciliation and consistency checks, followed by a separate
documentation checkpoint review. It does not authorize staging, commit, push,
PR, merge, application/browser QA or any deployment/resource change.

## Capability facts at the earlier Phase 2A.1 handoff

The following inventory is historical; Scanner A/B, branch publication and the
existing Vercel demo are the later exceptions recorded above. Reverify other
capabilities when an approved task needs them.

- Git, Node 22.14.0, npm 10.9.2, Corepack, and macOS command-line tools are
  available. Current installed application versions are recorded in
  `TECHNOLOGY_STRATEGY.md` and `package.json`.
- GitHub CLI, VS Code, and Homebrew are absent but optional.
- GitHub write permission to the friend's repository has not been confirmed.
- No Supabase, Vercel, Cloudflare, Geoapify, Google, Gmail, OpenAI, barcode, OCR,
  or FX account/credential is present or assumed. OpenFreeMap is accessed only
  as the current no-key development style.
- Browser-control and visual-QA capabilities must be checked when a future
  rendered-QA slice starts; public provider facts must be reverified from
  current official documentation.
