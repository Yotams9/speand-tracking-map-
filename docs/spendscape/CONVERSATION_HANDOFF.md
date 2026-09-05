# Spendscape — Conversation Handoff

This file transfers the relevant decisions and workspace history into a durable
form. It is a summary of user intent, not a verbatim transcript.

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
- The feature branch currently has no upstream, preventing accidental push to
  `main`; it has not been published to GitHub.
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
Bounded Phase 2A.1 is complete; no later slice is authorized. Real AI/LLM calls, production Replay,
privacy/sharing, backend,
authentication, real camera/file handling, OCR, Gmail, provider integrations,
factual FX, accounts, deployment, and real data are not implemented or
authorized.

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
`ac8801c19459c3cb4e000a3f49666ee9ee0df2e1`. No later slice is authorized.

Do not infer AI, Supabase, SQL/migrations, Zod, any provider, real ingestion,
backend resources, authentication, deployment, or a later slice from Phase
2A.1.
Require a new exact bounded authorization.

## Capability facts at handoff

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
