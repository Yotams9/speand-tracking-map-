# Ledgerline — Phase 1 concept demo

A mobile-first front-end concept demo for a purchase-intelligence product.
**Every figure in it is synthetic.** Nothing is connected to a real account,
receipt, card feed, price source, or location history, and nothing here is
production code.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:5173>. Use a phone viewport (about 390 × 844) —
this is designed mobile first, and desktop is an adaptation rather than the
source layout.

Type-check without building:

```bash
npm run typecheck
```

## The 90-second walkthrough

1. **Map / Home** — three city clusters. Filter to *Groceries*; the density
   tells the habit before any text does.
2. **Zoom into Tel Aviv** — clusters resolve into places. Tap **Shuk Express**.
3. **See this place** — 14 visits, total, average, and the products that
   actually repeat. Every one of those numbers is computed from the purchase
   list below it.
4. **Tap the most recent purchase** — line items, and one quiet insight:
   a comparable basket was about ₪31 less nearby.
5. **Tap the insight** — the route-aware comparison. This is the screen that
   carries the argument: one alternative store, the extra driving subtracted,
   and the substitution the system *refused* to make.
6. **Inbox** — one ambiguous purchase in a mall where three shops match.
   One tap files it. Then the screen goes quiet.
7. **For You** — the recurring saving, a proactive prediction for Thursday
   evening, a habit, and what is likely needed soon.
8. **Capture** — simulated camera, five entry paths, and a working Quick Add
   that puts a real purchase on the map.

## How the numbers work

`src/data/fixtures.ts` is the single source of truth. No screen hard-codes a
total, an average, a visit count, a trend, or a saving — `src/data/derive.ts`
computes all of them, and `src/data/audit.ts` re-checks the arithmetic on every
dev boot and prints the result to the console.

Two things are **declared rather than derived**, because Phase 1 has no routing
engine and an LLM must never be the source of a fact:

- route distances and durations
- the per-trip transport cost

They are labelled as estimates in the UI and reported by the audit on every run.

## Layout of the code

```
src/
  data/       fixtures, derivation, and the consistency audit
  map/        Web Mercator projection, map surface, camera
  i18n/       English (default) and Hebrew, with RTL
  state/      session state — added purchases, inbox resolutions
  components/ shell, sheet, and the shared pieces
  screens/    the nine screens
  styles/     design tokens and global primitives
```

The map is deliberately self-contained: a real Web Mercator projection over
hand-authored abstract basemap geometry. No tile provider, no API key, no
network request — which is why it runs offline. Everything downstream talks to
it through lon/lat and a `project` callback, so swapping in MapLibre later
touches `src/map/MapSurface.tsx` and nothing else.

## Not implemented yet

Deliberately absent, per the Phase 1 scope:

real bank / Open Banking / card integration · real Gmail, email or SMS access ·
real OCR or receipt extraction · product recognition · barcode catalog lookup ·
Purchase Fusion Engine · Purchase Matching / Confidence Engine · LLM
orchestration · real price collection · production geolocation or background
tracking · authentication · any backend · native apps · store packaging ·
deployment · service worker and offline caching · dark mode.

## Language

English is the default. Hebrew (RTL) can be switched on from **Profile →
Preferences**; the layout mirrors through CSS logical properties rather than
per-component overrides.
