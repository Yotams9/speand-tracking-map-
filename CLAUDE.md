# CLAUDE.md — Spendscape

## What exists today

Spendscape is a working mobile-first web app, not a planning exercise:

- Next.js (App Router) + TypeScript, MapLibre globe with OpenFreeMap tiles.
- Hebrew is the default language; English is one tap away (remembered in
  `spendscape.locale.v1` once the person switches).
- **One purchase store: IndexedDB** (`src/features/local-purchases/*`, database
  `spendscape-local-purchases`). Every save goes through the reviewed-save
  boundary (`session-purchase-domain.ts`) and the versioned validation in
  `local-purchase-store.ts`; money is integer minor units (agorot). Fresh users
  start empty. Merchants and places the user confirms live in the local
  directory (`local-directory.ts`).
- The earlier `localStorage` ledger (`spendscape.device-purchases.v1`) is
  retired. `legacy-device-migration.ts` imports it once, strictly and
  completely, into an empty IndexedDB store and never rewrites the old key.
- Backup/restore: versioned JSON export and empty-only atomic restore
  (`purchase-backup.ts`, privacy/data panel).
- Receipt capture and review (Gemini behind local loopback gates and mocks;
  no hosted provider), explicit Unknown context, purchase time correction.
- Address-to-pin: reviewed address search (Geoapify behind local session
  gates) or map/manual coordinates, always explicitly confirmed.
- Petah Tikva city price comparison for saved receipts
  (`src/features/nearby-prices/*`), with publication expiry.
- A real Tel Aviv published-price catalog (`data/catalog/tel-aviv.json`) for
  Shufersal, Rami Levy and Osher Ad, served by `/api/catalog/[gtin]` and
  `/api/catalog/stores`. Barcode results show per-store prices with a
  "cheapest" badge; choosing a chain branch fills price, quantity, total and
  date (all editable) and saves the branch as a confirmed place
  (`locationMethod: 'catalog-store'`, catalog store ID and published address
  as provenance). "Find the store I'm in" only suggests a branch within 200 m.
- Demo data: the visible "טען נתוני דמו" / "Load demo data" toggle
  (`spendscape.demo-data.v1`) adds fictional history to the view only. It never
  enters IndexedDB, backups, the purchase form or the month card. The
  loopback-only server QA gate (`SPENDSCAPE_SYNTHETIC_QA`, `src/data/spendscape-user.ts`)
  still serves the synthetic snapshot for tests.
- A deterministic spending-insights engine (`src/features/insights/`) computes
  totals, top stores and month comparisons; Stats shows a "this month" card
  from the user's own purchases.

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
- Playwright uses the installed Chrome (`channel: 'chrome'`) against an
  explicitly started production server. Keep screenshots and reports under
  `artifacts/` (git-ignored). `qa/spendscape-night-shots.spec.ts` walks every
  main screen in Hebrew and English at phone and desktop size.
- `qa/integration.config.ts` runs both branches' main suites against one
  server started with `SPENDSCAPE_SYNTHETIC_QA=1` on a free loopback port
  (`SPENDSCAPE_IT_BASE`): synthetic-QA-gate suites, ordinary fresh-user suites
  and the backup suite in English.

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
