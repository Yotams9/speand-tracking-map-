# Spendscape — Phase 1 Slice 1D.1 checkpoint

Spendscape is a globe-first purchase-intelligence concept. This branch currently
implements only approved Phase 1 Slices 1A–1C.1 and the bounded Slice 1D.1
foundation: the Next.js shell, the real MapLibre globe, canonical synthetic
purchase data, Purchases history, details, and shared discovery state.

Every purchase, place, amount, coordinate, and performance story in the demo is
synthetic. The app does not connect to accounts, services, location history, or
real user data.

## Local requirements

- Node.js 22.14 or newer
- npm 10.9.2

Install and run:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

Verification commands:

```bash
npm run typecheck
npm test
npm run build
npm run qa:globe
npm run qa:experience
```

The Playwright commands start the local development server when needed and write
screenshots, recordings, and run output only to the ignored local `artifacts/`
directory.

## Implemented through bounded Slice 1D.1

- Next.js App Router + TypeScript migration with pinned runtime dependencies
- responsive desktop/mobile shell, dark-premium tokens, safe-area support,
  keyboard labels, English/Hebrew RTL, and reduced-motion behavior
- MapLibre globe with an OpenFreeMap development style, atmosphere, automatic
  rotation with interaction interruption, zoom, fit, reset, place fly-to,
  clusters, heatmap, selection, hover details, and session camera persistence
- deterministic synthetic fixtures that aggregate many physical purchases into
  one canonical place feature while excluding online and unresolved purchases
- one canonical fixture graph for merchants, physical places, purchases,
  receipt items, evidence, channels, currencies, and nullable place relations
- a persistent-globe Purchases history with physical, online, cash/manual,
  nested-receipt, multi-currency, and unresolved examples
- synchronized search, category, currency, channel, date-range, timeline, place,
  and purchase selection state across Globe and Purchases surfaces
- derived fixture-backed counts and illustrative fixed-FX base amounts, with
  original currency and synthetic conversion provenance preserved in details
- browser-back, close, Escape, reload restoration, responsive mobile sheets,
  keyboard navigation, Hebrew RTL, reduced motion, empty, loading, and recovery
  behavior covered by deterministic and rendered QA
- explicit loading (`?loading=1`) and map-failure (`?mapFailure=1`) QA routes;
  search with no matches exercises the empty state

## Intentionally not implemented

The remainder of Slice 1D and later work remains blocked behind a new explicit
approval. Analytics is navigation-only. There is no Scanner, capture workflow,
Smart Inbox, AI control or actions, Life Replay, privacy/sharing experience,
backend, authentication, API integration, factual FX feed, deployment, service
account, production credential, paid provider, or real user data.

The basemap uses OpenFreeMap only as a free development style. It needs no API
key and carries no production availability commitment in this checkpoint.
