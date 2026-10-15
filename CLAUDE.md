# CLAUDE.md — Spendscape

## What exists today

Spendscape is a working mobile-first web app, not a planning exercise:

- Next.js (App Router) + TypeScript, MapLibre globe with OpenFreeMap tiles.
- Hebrew is the default language; English is one tap away.
- Purchases the user adds are kept on the device (`localStorage`).
- A real Tel Aviv published-price catalog (`data/catalog/tel-aviv.json`) for
  Shufersal, Rami Levy and Osher Ad, served by `/api/catalog/[gtin]` and
  `/api/catalog/stores`. Barcode scanning, "find the store I'm in" and
  published-price autofill use it.
- Synthetic demo purchases are hidden by default and can be loaded from the
  app ("טען נתוני דמו" / "Load demo data").
- A deterministic spending-insights engine (`src/features/insights/`) computes
  totals, top stores and month comparisons from the user's purchases.

Background documents (`AGENTS.md`, `PROJECT_CONTEXT.md`,
`MASTER_PROMPT_PHASE_1.md`, `docs/spendscape/*`) record earlier history and
product intent. Their phase gates and exact approval phrases are historical and
no longer block work.

## How work is authorized now

- Work happens in bounded tasks that the user gives in chat. Do what the task
  asks, verify it, report, and stop.
- The user writes in Hebrew and prefers short, plain explanations. Recommend one
  option rather than listing many.
- Ask before anything outward-facing or hard to undo: pushing to `main`,
  merging, deploying (Vercel), connecting accounts or paid services.
- Never print or commit `.env.local` or any credential.
- Free tools and free tiers only.
- Collaborators work in parallel; stay inside the files the task is about.

## Working loop

`PLAN → IMPLEMENT → typecheck → unit tests → build → run and look → fix → repeat`

- Windows + PowerShell: use `npm.cmd` / `npx.cmd`.
- `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build`.
- Playwright uses the installed Chrome (`channel: 'chrome'`) against a server
  on `127.0.0.1:3000`. Keep screenshots and reports under `artifacts/`
  (git-ignored). `qa/spendscape-night-shots.spec.ts` walks every main screen in
  Hebrew and English at phone and desktop size.
- Existing Playwright suites run with demo data on and English via
  `qa/demo-storage.ts`.

## Non-negotiable product truths

- GPS is evidence, never proof of a purchase or exact store. A location only
  suggests a store; the user confirms.
- Auto-filled values (store, date, price, category) always stay editable.
- Ask the user only when uncertainty materially affects the outcome; Smart Inbox
  should resolve meaningful ambiguity with one tap.
- Never use an LLM as the source of factual prices, amounts, dates, distances,
  route times, coordinates, or place identifiers. Numbers come from
  deterministic code over stored data.
- Compare products only by identical barcode (GTIN); substitutions only when
  logically equivalent.
- Never split a recommended basket across stores.
- Label demo data and savings as demo, illustrative, or estimated. Keep totals,
  visit counts, averages and savings internally consistent.
- Keep currencies separate; never invent exchange rates.
- Mobile first; the map/globe is the visual identity. Avoid admin-dashboard,
  banking-spreadsheet, CRUD-template, and generic AI-dashboard styling.
