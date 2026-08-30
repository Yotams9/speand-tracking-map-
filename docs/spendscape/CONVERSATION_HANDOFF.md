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
- Long-term recommended platform: Next.js/TypeScript, Vercel, Supabase
  Postgres/PostGIS/Auth/Storage/Queues, Google Places, OpenAI Responses API,
  Gmail API, and barcode/product provider adapters.

## Reference decisions

- The user requires the globe and pins to feel as smooth and interactive as the
  food-map reference and attached recording.
- Public client inspection established that the benchmark uses MapLibre GL JS,
  OpenFreeMap, globe projection, sky/atmosphere, circle/heatmap layers,
  auto-spin/interaction stop, popups, fly-to, and fit-bounds.
- The user wants the Refero Origin Financial design language adapted without
  abandoning the globe-first product or copying the reference brand.
- MapLibre is therefore the Phase 1 renderer recommendation for behavioral
  fidelity; Google Places remains place intelligence. Google Maps JS 3D is a
  gated alternative, not silently discarded.

## Repository history

- Starter: `https://github.com/Yotams9/speand-tracking-map-.git`.
- Original repository contains a Ledgerline Vite/React/TypeScript concept demo.
- Baseline commit at worktree creation: `eee0d26b55e5061f87ac664938df0c195800b74f`.
- A permanent sibling worktree was created on
  `feature/spendscape-rebuild`.
- The local `main` checkout remained clean and unchanged.
- The feature branch currently has no upstream, preventing accidental push to
  `main`; it has not been published to GitHub.
- No dependencies were installed and no application code/build/test was run
  during worktree setup or planning-package authoring.

## Existing demo assessment

Useful inherited elements include coherent synthetic fixtures, deterministic
derived metrics, purchase/merchant/comparison views, simulated Capture and
Smart Inbox, and English/Hebrew RTL foundations. The current map is a custom SVG
Web Mercator surface with hand-authored geometry, not a real globe/tile engine.
The existing design is light and Ledgerline-branded, data is ILS-centric, there
is no backend or real scanner/AI/Gmail/dedup, and close zoom can show purchase
markers around a place—contrary to Spendscape's one-place-one-pin rule.

## Current authority

The user asked for this Master Prompt package and a parallel Codex task. That is
authorization to create planning documentation and start a Phase 0 readiness
task—not authorization to implement the application. The task must stop and ask
for `APPROVE SPENDSCAPE PHASE 1 BUILD + QA` before code or QA begins.

## Capability facts at handoff

- Git, Node 22.14.0, npm 10.9.2, Corepack, and macOS command-line tools are
  available.
- GitHub CLI, VS Code, and Homebrew are absent but optional.
- GitHub write permission to the friend's repository has not been confirmed.
- No Supabase, Vercel, Google, Gmail, OpenAI, mapping, barcode, or FX credential
  is present or assumed.
- Browser control was unavailable during final package authoring; public source
  inspection via the web and direct public assets succeeded.
