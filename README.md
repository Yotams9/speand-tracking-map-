# Spendscape — Phase 1 completed checkpoint

Spendscape is a globe-first purchase-intelligence concept. This branch currently
implements completed Phase 1 Slices 1A–1C.1, 1D.1, 1D.2, the accepted globe
fidelity correction, bounded Slice 1D.3 synthetic Universal Scanner/Capture,
and checkpointed Slice 1D.4 material-uncertainty Smart Inbox simulation. The current foundation includes
the Next.js shell, real MapLibre globe, canonical synthetic purchase graph,
Purchases/history/detail, shared discovery state, and deterministic
Analytics/Stats and Smart Inbox. Slice 1D.5 synthetic Ask, runtime validation,
focus/history corrections and `Globe · Capture · Purchases · Stats` are
completed. Details-first synthetic Life Replay is completed with no automatic
camera travel and explicit `Show place` as its only camera-moving action. Phase
1 through Slice 1D.6 is checkpointed at
`95d865f1c255e9bfd68d9f69bbe0caf0d8b343fa`. No Phase 1 product
implementation slice is active. The bounded Phase 1E critical review passed
with no remaining Blocker or High defect and is recorded by the current local
documentation checkpoint. No later phase is active.

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

### Test from a phone on the same network

The installed Next.js 16.3.3 CLI defaults both `next dev` and `next start` to
`0.0.0.0`; the explicit mobile scripts make that LAN binding visible and
repeatable:

```bash
# Development only — includes compilation and debugging overhead.
npm run dev:mobile

# Correct local performance comparison.
npm run build
npm run start:mobile
```

Find the Mac's Wi-Fi address with `ipconfig getifaddr en0` (or read it in
System Settings → Network), then open `http://<mac-lan-ip>:3000` on the phone.
Do not use `localhost` on the phone: it refers to the phone itself. The Mac and
phone must share the same local network. VPNs, iCloud Private Relay, guest Wi-Fi
client isolation, and the macOS firewall can block the connection. Press
`Control-C` in the server terminal to stop it.

Next.js development assets are allowlisted only for loopback and standard
RFC 1918 private-network addresses, so no machine-specific IP is stored in the
repository. Do not expose the development server to the public internet.

If the shell opens but the globe does not, open
<https://tiles.openfreemap.org/styles/liberty> directly on the phone. Failure
there isolates a provider, DNS, or network-policy problem from the local
Spendscape server. Development first-request compilation is intentionally not
reported as production performance; use `start:mobile` after `build` for that
comparison.

Globe initialization loads the self-hosted RTL runtime and Liberty style in
parallel. It aborts a Liberty style request after 12 seconds, stops waiting for
RTL initialization after 8 seconds, and bounds MapLibre readiness at 18
seconds. A failure leaves Purchases, Capture, Stats, filters, and session-only
synthetic data intact and offers one explicit Retry; it never retries forever
or silently changes provider.

Verification commands:

```bash
npm run typecheck
npm test
npm run build
npm run qa:globe
npm run qa:experience
npm run qa:analytics
npm run qa:capture
npm run qa:inbox
npm run qa:ask
npm run qa:replay
npm run qa:load
```

Most Playwright commands start the configured local server when needed. Replay
QA intentionally requires an already-built `next start` production server.
Screenshots, recordings, and run output belong only in the ignored local
`artifacts/` directory.

## Accepted implementation through Slice 1D.6

- Next.js App Router + TypeScript migration with pinned runtime dependencies
- responsive desktop/mobile shell, dark-premium tokens, safe-area support,
  keyboard labels, English/Hebrew RTL, and reduced-motion behavior
- MapLibre globe with the OpenFreeMap Liberty development style, atmosphere, automatic
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
- responsive desktop Analytics and mobile Stats surfaces derived from that same
  filtered fixture graph, with headline metrics, physical/online/unresolved and
  category breakdowns, spend over time, top physical places, and explicit
  currency/evidence provenance
- analytics selections synchronize back to Globe, Purchases, shared filters,
  Timeline, and canonical place selection without remounting the MapLibre globe
- derived fixture-backed counts and illustrative fixed-FX base amounts, with
  original currency and synthetic conversion provenance preserved in details
- browser-back, close, Escape, reload restoration, responsive mobile sheets,
  keyboard navigation, Hebrew RTL, reduced motion, empty, loading, and recovery
  behavior covered by deterministic and rendered QA
- progressive globe-only loading (`?loading=1`), deterministic timeout
  (`?mapTimeout=style` / `?mapTimeout=ready`), and map-failure
  (`?mapFailure=1`) QA routes;
  search with no matches exercises the empty state
- camera-first Universal Capture overlay with desktop entry and a uniform
  four-column mobile navigation action,
  an explicit simulated-scanner label, focus trapping, Escape/Back/close, and
  no MapLibre remount
- working deterministic demos for receipt, product, barcode, document, PDF,
  CSV preview, Gmail future explanation, manual/cash, and failure/retry states
- confirm-first receipt review with nested arithmetic, place-suggestion truth
  language, fixed synthetic FX provenance, and no retained photo value
- separate in-memory session additions that update Purchases, Analytics, and
  canonical place aggregates without mutating the checked-in fixture graph;
  reload resets them and online/unresolved additions remain unpinned
- one typed material-uncertainty Smart Inbox case linked to the existing
  unresolved purchase and two existing canonical place candidates, with no
  score, GPS claim, provider fact, or second fixture source
- header badge and contextual purchase-detail entry, explicit candidate review,
  confirm/defer, calm completion, and Undo; a decision updates Purchases,
  Analytics, filters/timeline derivations, and the existing place pin while
  preserving one pin per place and one mounted MapLibre instance
- Smart Inbox decisions are intentionally in-memory only and reset to the
  unresolved canonical fixture baseline on reload
- a compact secondary Ask Spendscape surface with deterministic English/Hebrew
  parsing, canonical ID validation, exactly ten allowlisted map/UI action
  shapes, confirmation-gated multi-action plans, bounded ambiguity choices,
  explicit rejection, one-step Undo, and no model or network call
- the four equal-width mobile destinations appear in semantic, visual, and
  keyboard order as **Globe · Capture · Purchases · Stats**; Ask Spendscape
  remains a secondary row inside Globe Tools rather than a fifth destination

## Completed Slice 1D.6 — Life Replay

Open Timeline → Life Replay; on mobile use Globe Tools → Timeline. The compact
non-modal player opens paused over the same mounted globe. Play/Pause,
Previous/Next, committed scrubbing, date narrowing, and 0.5×/1×/2× presentation
speeds use the already-filtered canonical graph, including session Capture and
current Inbox decisions. Dates are inclusive UTC dates; equal timestamps use
canonical ID ordering. Amounts remain in their original currencies.

There is one story event per purchase and one pin per confirmed physical place.
Normal playback, Previous/Next, scrubbing and date changes update purchase
details and a temporary pin highlight without issuing any camera command.
Online/unresolved events never create pins or expose Show place. The single
camera-moving Replay action is an explicit Show place on a resolved physical
purchase; it pauses playback and uses the accepted place transition (immediate
under reduced motion). No routes, travel times or inferred stops exist. Direct
map interaction/backgrounding pauses playback. Close/Escape/Back restore entry
camera/query/selection/mode; Forward opens a fresh paused player at the first
event (Replay-only dates, speed and progress are intentionally ephemeral).
Temporary camera positions
do not overwrite normal persistence. Reload exits Replay; the existing in-memory
Capture/Inbox reset policy remains unchanged. Ask and Replay cannot execute
concurrently, and Ask Undo is preserved through Replay open/close.

Production QA: build, then `npm run start -- --hostname 127.0.0.1` and
`npm run qa:replay`. The Replay config requires that production server and
does not start development mode. Screenshots/results belong only in ignored
`artifacts/spendscape-slice-1d6/`. Browser emulation is not physical Safari QA.

## Intentionally not implemented

Phase 1 adds only deterministic, frontend-only simulations to the accepted
globe, purchase, analytics, Capture, Smart Inbox, Ask, and Life Replay
foundation. Real camera/file input,
barcode lookup, OCR, Gmail, product providers, real LLM/AI providers,
production Life Replay, privacy/sharing, backend, authentication, factual FX, deployment,
service accounts, production credentials, paid providers, and real user data
remain unimplemented and unauthorized.

The basemap uses OpenFreeMap only as a free development style. It needs no API
key and carries no production availability commitment in this checkpoint.

## Map RTL asset provenance

Hebrew basemap shaping uses exactly one added dependency:
`@mapbox/mapbox-gl-rtl-text@0.4.0`, pinned exactly and licensed BSD-2-Clause.
Its 133,355-byte UMD runtime is self-hosted at
`/vendor/mapbox-gl-rtl-text-0.4.0.js` and loaded once before MapLibre creates the
map; this adds no account, provider request, or runtime third-party script fetch.
The vendored license is stored beside the asset. The runtime SHA-256 is
`ca7b9d54a01e7280c3d6babd6f68e46a49af4d853ec7d4d2d74de4bd762694ff`.
The installation-time npm audit on 2026-08-30 reported zero known
vulnerabilities; this is checkpoint evidence, not a permanent security
guarantee, so later dependency updates must re-run the audit and label QA.

## Technology strategy

The reconciled candidate/provider strategy is documented in
[`docs/spendscape/TECHNOLOGY_STRATEGY.md`](docs/spendscape/TECHNOLOGY_STRATEGY.md).
It is subordinate to the product and phase gates and does not authorize a new
slice, dependency, provider, account, backend, migration, credential, paid
action, real-data use, or deployment.
