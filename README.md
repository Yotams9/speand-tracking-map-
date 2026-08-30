# Spendscape — Phase 1 globe checkpoint

Spendscape is a globe-first purchase-intelligence concept. This branch currently
implements only approved Phase 1 Slices 1A–1C: the Next.js foundation, the
responsive premium shell, and a real MapLibre globe fidelity spike.

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
```

## Implemented through Slice 1C

- Next.js App Router + TypeScript migration with pinned runtime dependencies
- responsive desktop/mobile shell, dark-premium tokens, safe-area support,
  keyboard labels, English/Hebrew RTL, and reduced-motion behavior
- MapLibre globe with an OpenFreeMap development style, atmosphere, automatic
  rotation with interaction interruption, zoom, fit, reset, place fly-to,
  clusters, heatmap, selection, hover details, and session camera persistence
- deterministic synthetic fixtures that aggregate many physical purchases into
  one canonical place feature while excluding online and unresolved purchases
- explicit loading (`?loading=1`) and map-failure (`?mapFailure=1`) QA routes;
  search with no matches exercises the empty state

## Intentionally not implemented

Slice 1D and later work is blocked pending the explicit globe-checkpoint gate.
That means no broader Scanner, AI control, Analytics, Purchases product flow,
Life Replay, privacy/sharing experience, backend, authentication, integrations,
deployment, service accounts, production credentials, or real data.

The basemap uses OpenFreeMap only as a free development style. It needs no API
key and carries no production availability commitment in this checkpoint.
