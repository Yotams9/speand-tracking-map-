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

Scanner/Capture is implemented only as the bounded Slice 1D.3 synthetic
frontend simulation. Slice 1D.4 is authorized only for one material-uncertainty
Smart Inbox simulation and directly required local QA. AI actions, Life Replay, privacy/sharing, backend,
authentication, real camera/file handling, OCR, Gmail, provider integrations,
factual FX, accounts, deployment, and real data are not implemented or
authorized.

## Current authority

The user approved Phase 1 build/QA and then bounded implementation through
Slices 1A–1C.1, 1D.1, 1D.2, the globe-fidelity correction, and bounded Slice
1D.3. Those checkpoints are complete and accepted at `9b7aaf39`. Only bounded
Slice 1D.4 material-uncertainty Smart Inbox simulation + local QA is active; no
technology slice is active.

Do not infer AI, Supabase, Zod, any provider, real ingestion, or a later slice
from the Slice 1D.4 authorization. Require a new exact bounded authorization.

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
