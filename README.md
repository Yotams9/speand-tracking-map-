# Spendscape — on-device purchase review

The ordinary application starts empty and displays only user-reviewed purchases
stored in this browser. Purchases, Stats, search, Replay and globe pins use that
same validated graph. Physical places appear only after explicit confirmation;
online and unresolved purchases have no pin. Manual entry, receipt review,
editable printed values, final payable totals, explicit Unknown context, atomic
IndexedDB saving, deletion and Undo are supported. Photos are temporary. There
is no cloud synchronization or cloud backup.

Receipt extraction and address search remain default-off, local-only provider
boundaries. Receipt capture has a privately configured, bounded operational
session; address search now supports a separate bounded operational session.
Activation requires separate approval, and consumed historical launchers cannot be reused.
Ordinary city comparison uses a qualified, limited Shufersal snapshot while its
publications are within 24 hours; expired or unmatched prices are unavailable.
Product/package matching is explicit and temporary. Distances and radius-based
comparison remain deferred. External product lookup, AI Ask and automatic
insights are unavailable. Historical receipt prices are never current-price or
savings evidence. Vercel remains paused; this checkpoint does not publish or deploy.

For the current local submission workflow, pin reconciliation, acceptance gaps and
completion plan, see [College submission readiness](docs/spendscape/COLLEGE_SUBMISSION_READINESS.md).
Local JSON backup and empty-only restore are available from **On-device data &
privacy** after loading this build. See [backup instructions and limits](docs/spendscape/COLLEGE_PURCHASE_BACKUP.md).
Records do not transfer automatically between browsers or origins. See
[normal local startup and safe backup instructions](docs/spendscape/COLLEGE_ADDRESS_SEARCH_OPERATION.md).
The closed scanner checkpoint does not establish real same-session
repeated-capture duplicate prevention.

Synthetic purchases, catalogs and simulations are isolated QA fixtures only.
They require `SPENDSCAPE_SYNTHETIC_QA=1`, an exact loopback host and explicit
`?syntheticQa=1` (or the QA suite's `x-spendscape-synthetic-qa: 1` header). Ordinary
use ignores those fixtures. Historical directory and Inbox references remain
available to strict storage validation so existing records are not discarded.
See [the college milestone checkpoint](docs/spendscape/COLLEGE_FINAL_MILESTONES.md)
and [current technical handoff](docs/AI_HANDOFF.md) for acceptance evidence and
remaining gates. Earlier concept-demo checkpoints below are historical.

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

These LAN instructions are for local display checks. Camera access on an iPhone
requires a trusted HTTPS origin. Physical scanner checks require a separately
authorized trusted HTTPS origin.

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
seconds. A failure leaves Purchases, Capture, Stats, filters, and saved on-device
purchase data intact and offers one explicit Retry; it never retries forever
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

The legacy concept suites above require the explicit fixture QA gate described
at the top of this file. They are not ordinary-user acceptance evidence. The
Milestone 1 production suite uses `qa/college-m1.config.ts`, a separate port and
a fresh `SPENDSCAPE_M1_QA_OUT` artifact directory.

Most Playwright commands start the configured local server when needed. Replay
QA intentionally requires an already-built `next start` production server.
Screenshots, recordings, and run output belong only in the ignored local
`artifacts/` directory.

## Repository layout

- `src/app/`: Next.js routes, metadata, and global styles.
- `src/data/spendscape-*`: canonical fixtures, repository contract, domain
  types, and deterministic purchase/map/analytics derivations.
- `src/features/`: the active globe, Capture, Inbox, Ask, Replay, local
  purchase storage, and qualified city-based saved-receipt comparison
  (limited catalog, explicit matching and publication expiry). English/Hebrew copy lives with these features.
- `public/`: PWA icons/manifest and required MapLibre, RTL, and barcode assets.
- `qa/` and `tools/`: browser regression suites and isolated receipt/price
  experiments; these are supporting code, not application routes.
- `docs/spendscape/` and `.agents/skills/`: project authority and checkpoint
  evidence. Root Ledgerline planning documents are historical references.
- `artifacts/`, `.next/`, and `node_modules/`: ignored local evidence, generated
  builds, and installed dependencies. Receipt attempt journals/locks in
  `artifacts/` must be preserved; they enforce consumed provider-call budgets.

### Bounded cleanup — 2026-10-01

Removed 35 inherited Ledgerline files (255,589 bytes) from `src/components/`,
`src/screens/`, `src/map/`, `src/state/`, `src/i18n/`, `src/styles/`, and the
old `src/data/{audit,derive,fixtures,types}.ts`. A TypeScript syntax-tree import
audit, including type imports, dynamic imports, worker URLs, and CSS imports,
found no path to them from any current route or unit test. All removed files
were unchanged from the original protected baseline; Git history retains them.
Active feature code, canonical fixtures, dependencies, public assets, research
evidence, and provider-call locks are preserved.

The historical purchase-navigation test now expects search to clear on reload,
matching the existing privacy rule. Cleanup evidence belongs in the ignored
`artifacts/cleanup-2026-10-01/` directory. This work is local to
`feature/spendscape-rebuild`; publication remains separately gated.

Validation: typecheck, production build, and all 210 unit tests passed before
and after removal. The baseline browser selection passed 20/21; its obsolete
search-persistence expectation passed after correction against the unchanged
app. The expanded post-cleanup run passed 61/62. One desktop storage-error
visibility assertion timed out; all four EN/HE mobile/desktop storage-error
cases then passed twice in isolation (8/8), without changing that test or the
application. This transient failure is retained in the logs rather than
reported as an all-green combined run. Rendered Ask, Analytics, and receipt
review screenshots were inspected across phone sizes and desktop. Existing
uncommitted experiments and handoff edits were preserved. No commit, push,
merge, deployment, dependency, or provider change was made.

## Historical concept implementation through Slice 1D.6

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
- separate added purchases that update Purchases, Analytics, and canonical
  place aggregates without mutating the checked-in fixture graph; since
  2026-10-02 they are kept in this browser's `localStorage` on the device and
  survive reload until removed; online/unresolved additions remain unpinned
- real barcodes outside the demo catalog show the published shelf prices of
  every Tel Aviv Shufersal, Rami Levy and Osher Ad store that sells them,
  served by `/api/catalog/[gtin]` from `data/catalog/tel-aviv.json`; rebuild the
  snapshot with `python tools/nearby-prices/build_catalog.py` (source: the
  chains' price transparency files; promotions and club prices not applied)
- `Find the store I'm in` suggests the closest of the 34 located Tel Aviv
  supermarkets (store addresses geocoded once with OpenStreetMap Nominatim,
  © OpenStreetMap contributors, ODbL) and fills that store's published price
  for a scanned item; the location is read only on press and never stored
- stores the user adds in the review form, pinned only from a location the
  user explicitly reads on the device, and a two-press removal of an added
  purchase from its detail panel
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

## Historical Slice 1D.6 — Life Replay

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
do not overwrite normal persistence. Reload exits Replay and resets Inbox
decisions; added purchases are restored from the device. Ask and Replay cannot execute
concurrently, and Ask Undo is preserved through Replay open/close.

Production QA: build, then `npm run start -- --hostname 127.0.0.1` and
`npm run qa:replay`. The Replay config requires that production server and
does not start development mode. Screenshots/results belong only in ignored
`artifacts/spendscape-slice-1d6/`. Browser emulation is not physical Safari QA.

## Historical Phase 1 limitations

Phase 1 adds only deterministic, frontend-only simulations to the accepted
globe, purchase, analytics, Capture, Smart Inbox, Ask, and Life Replay
foundation. The later completed Scanner A/B camera and local barcode slices,
and the existing bounded Vercel demo, are the explicit exceptions described
above. File ingestion, external barcode lookup, OCR, Gmail, real product/LLM/AI
providers, production Life Replay, privacy/sharing, backend, authentication,
factual FX, paid services and real financial-data integration remain deferred.
Further deployment and resource changes require separate approval.

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
