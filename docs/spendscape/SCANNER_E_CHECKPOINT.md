# Scanner E — session-only reviewed purchase integration

Date: 2026-09-13. Authorization:
`APPROVE SPENDSCAPE SCANNER E — SESSION-ONLY REVIEWED PURCHASE INTEGRATION + LOCAL QA`.

This slice connects identification to an explicitly reviewed session purchase.
It does not promote Scanner D1's OCR configuration or authorize OCR, providers,
persistence, accounts, backend resources, deployment, commit or push.

## Scope and data flow

Scanner B still identifies only. Camera, manual barcode and demo candidates
require an explicit Continue action before purchase context can be completed.
The sole camera/decoder owners and pinned ZXing worker/WASM are unchanged.
Only structured identity/name is handed off; no image, frame, URL or buffer.
Unknown valid codes remain unknown. A demo catalog match is labelled fictional,
even when the code was read by a real decoder. Loading Demo oats gives visible
review-only feedback and is disabled while that candidate is loaded. Edited
candidate names survive language changes; identifying a new code resets the name.

Capture's existing synthetic sources, receipt and manual/cash entry use one
review form and one validated save boundary. The form shows source provenance,
merchant/place or unpinned channel, explicit UTC date/time, currency, payment,
category, amount and optional/required nested items. Total-only manual purchases
have no implied item quantity or price. Product/barcode/receipt drafts require
at least one named item. Existing synthetic example values remain labelled demo
values. New user input starts with blank factual context.

The injected repository snapshot remains immutable. A single in-memory ledger
in the persistent globe owner supplies session records; allPurchases/allEvidence
continue composing the snapshot, these records and the existing Inbox decisions.
Purchases, Analytics, search, filters, timeline, Ask, Replay and map derivations
use that composition. No repository write adapter or alternate merchant lookup
is added. Reload removes additions and drafts. Browser history carries navigation
identifiers only, never review form content.

## Validation and factual provenance

- Validate in the form and again at the parent save boundary.
- Positive plain decimal money, currency-specific precision (JPY whole yen),
  bounded integer minor units; reject exponent notation, signs, NaN, Infinity,
  excess precision and malformed input without repair.
- Positive whole item counts or kg quantities with up to three decimal places;
  line totals round deterministically to the currency's minor unit. Sum of all
  line totals must equal the explicit purchase total. Maximum 50 lines.
- Real UTC calendar date/time, year 1900–2100. No silent current-time/default
  merchant/location/currency/payment inference for user-entered purchases.
- IDs must exist in the injected snapshot; confirmed physical place must belong
  to the selected merchant. No new merchants or places. Online/unknown channel
  must have null place; unknown channel remains unresolved with no map pin.
- User-entered ILS uses identity conversion. Other supported currencies require
  an explicit user-reported paid ILS amount. If unknown, the draft cannot save.
  The exact reported base amount is retained; it is not reconstructed from a
  rounded derived ratio. No FX lookup, invented rate or synthetic rate fallback.
- Legacy synthetic sources keep their fixed illustrative FX and bilingual item
  labels. User-reviewed records are separately labelled; their evidence is a
  user-reviewed manual entry, not a fabricated receipt/email/card record.
- Original scanned digits/format/equivalent GTIN and acquisition method are
  structured session identification metadata, not evidence of purchase facts.

The normal fixture-relative date-filter anchor is unchanged; new UTC months
are derived from the composed purchases. Saving does not reset active filters
or move the camera. The success state explains that filters may hide a purchase,
with explicit View purchase/Show on globe actions.

## Duplicate protection, Undo and navigation

Each draft gets a stable operation ID; the synchronous owner checks/consumes it
atomically before exposing the new ledger. The form also guards a second click.
Consumed IDs survive Undo/reset for this tab lifetime, rejecting obsolete saves.
Monotonic purchase sequence IDs are not reused after removal.

A second draft with matching merchant/place/channel/date/amount/currency/payment,
category and item details gets a warning. Only explicit Add a separate purchase
bypasses that warning. A matching barcode alone never causes merging/deduplication.

One-level Undo removes only the latest addition and its associated evidence.
It does not rewind earlier purchases, Inbox decisions or Ask Undo state. Undo
is reachable from Capture and outside it; modal/replay states retain their own
controls. Existing selection synchronization removes invalid selected records.
Reset clears additions; counters and consumed IDs remain until reload. No purchase
editing, automatic cross-source fusion or multi-level undo stack is implemented.

## Baseline and impact

Before session actions: **42 purchases, 12 places, 12 pins, ILS 6,777.38**.
A confirmed purchase at an existing physical place increases its visits/spend
without creating a place or pin. Online/unresolved additions affect history and
analytics but never enter the pin source. Undo subtracts that record's exact
contribution. The same mounted MapLibre instance receives source updates.

## Bounded correction after checkpoint review — 2026-09-14

Authorization: `APPROVE SPENDSCAPE SCANNER E — PROVENANCE, PRIVACY AND INSECURE-CONTEXT CORRECTION + LOCAL QA`.
The preceding review passed its fresh 70-test combined suite but found one High
and two Medium defects outside its existing assertions. The original local QA
record below is historical; it did not establish acceptance of these cases.

- Catalog provenance is now separate from purchase-fact provenance. Every
  camera/manual/demo identification handoff requires user-reviewed purchase
  facts. A demo catalog match remains labelled synthetic product identification,
  but does not grant permission to use fixture FX for user-entered context.
  The save boundary rejects synthetic provenance when identification metadata
  is present. Fully predefined synthetic purchase demos retain their existing
  illustrative rates and bilingual fixtures.
- Main camera start, Retry and Clear result reset acquisition method to camera.
  Tests cover demo/manual -> Clear -> the real pinned reader in both languages.
- Free-text search remains in memory only. It is blanked at experience-state
  persistence, including the Replay-entry query branch. Legacy stored search
  is ignored on load and overwritten; non-sensitive filters, locale, surface
  and camera preferences remain intact. The deliberate change is that search
  text no longer restores after reload. Normal in-session search/Ask/Replay
  behavior remains unchanged.
- Draft operation IDs use a module-lifetime monotonic sequence rather than
  secure-context-only `crypto.randomUUID`. They are local idempotency keys,
  not credentials. Capture unmount, cancellation, Undo and reset cannot reuse
  an allocated key; reload recreates both the ledger and module state.
  No camera permission is granted on insecure HTTP. Manual and demo review
  remain usable there without browser crypto support.

Correction QA on the final source state:

- `npm run typecheck`, `npm test` (180/180 in 14 files) and `npm run build`: passed.
- Seven new focused production-browser regressions: 7/7 passed in 22.4 seconds.
- One fresh complete combined Capture (5), Scanner A (20), Scanner B (33),
  data-boundary (4) and Scanner E (15) production-browser suite: **77/77 passed**
  in 229.4 seconds. No retries, flaky results, skipped tests or timeouts.
- Four neighboring Ask/Replay action, Undo, filter/reload and Capture/Inbox
  composition regressions: 4/4 passed in 22.1 seconds; no flaky results or skips.
- Both languages cover demo/manual -> Clear -> real pinned decoder acquisition,
  mandatory reported ILS, user-reviewed provenance, transient search and legacy
  stored-search removal while preserving currency filters. The native insecure
  HTTP origin has neither a secure context nor `crypto.randomUUID`; repeated
  manual saves, double-click protection, cancellation, demo review and Undo pass.
- The baseline remains 42 purchases / 12 places / 12 pins / ILS 6,777.38.
  Online/unresolved additions remain unpinned; one MapLibre instance remains.
  Synthetic camera input uses one stream and one worker; no OCR assets load.
- Current 360px English review, 430px Hebrew summary and desktop reported-ILS
  detail/Undo screenshots were inspected. Source provenance and purchase-fact
  provenance are visibly distinct; RTL and the existing fixed actions remain usable.
- No test timeout was raised and no assertion was removed to obtain a pass.
  The earlier review reproductions and historical implementation timeouts remain
  recorded. No remaining defect was observed in these bounded correction checks;
  this is correction evidence, not approval of the next checkpoint.
- QA server stopped; exact pre-correction `next-env.d.ts` bytes restored.
  `git diff --check` and intended 20-file manifest checks passed. Index empty;
  feature/main refs unchanged. Packages, lockfile, camera/decoder lifecycle engines,
  vendored assets, licenses and D1 evidence are unchanged.

Logs: `typecheck.log`, `unit.log`, `build.log`, `focused.log`, `combined.log`,
`combined-report.json`, `neighbors.log`, `neighbors-report.json`.
Physical iPhone Scanner E QA remains pending; desktop synthetic camera tests
are not a physical device pass. Next gate:
`APPROVE SPENDSCAPE SCANNER E CHECKPOINT REVIEW`.
Evidence directory: `artifacts/spendscape-scanner-e-correction/`.
The original review and reproductions remain under
`artifacts/spendscape-scanner-e-review/` and are not erased.

## Replay browser-history privacy correction — 2026-09-15

Authorization: `APPROVE SPENDSCAPE SCANNER E — REPLAY HISTORY PRIVACY CORRECTION + LOCAL QA`.
The next checkpoint review passed a fresh 77/77 combined run but reproduced one
remaining Medium defect twice: Replay embedded a purchase-derived search in
browser history, where a forward entry retained it after reload. The earlier
sessionStorage correction worked; it did not cover this separate sink.
That review remains in `artifacts/spendscape-scanner-e-rereview/REVIEW.md`.

The bounded fix keeps full Replay sessions (query, purchase IDs and restoration
state) in a runtime-only map. History receives only an opaque Replay ID plus
ordinary navigation flags. Page-origin time and a monotonic counter distinguish
new sessions from pre-reload references without secure-context crypto or a
provider. Back/Forward during the same page lifetime resolves the ID from memory
and preserves existing query, camera and navigation restoration. Reload discards
the map; obsolete IDs do not revive the player or restore search text.

Legacy history entries are projected onto navigation flags on initial load or
traversal; their query is never applied or copied into a new history write.
The browser cannot enumerate and rewrite unvisited old history entries. An old
entry is sanitized when reached; this is not a claim to erase previously written
history retroactively. Newly created entries never contain purchase search text.

Four new deterministic production-browser tests cover English and Hebrew:
reviewed save -> search -> Replay -> Back/Forward -> reload -> Forward; exact
in-session query/navigation restoration; history write/popstate payloads;
blank post-reload search and 42-purchase baseline; legacy reload and traversal.
All input is synthetic. No camera action or deployment was added.

History-correction QA on the final source state:

- `npm run typecheck`, `npm test` (180/180 in 14 files) and `npm run build`: passed.
- New EN/HE history checks plus focused desktop Replay/Ask restoration,
  filter/reload and Capture/Inbox/Ask composition: **9/9 passed**, 44.3 seconds.
- One fresh complete combined Capture (5), Scanner A (20), Scanner B (33),
  data-boundary (4), Scanner E (19) production-browser run: **81/81 passed**,
  260.6 seconds; unexpected 0, flaky 0, skipped 0. No retries or timeouts.
- Mobile focus/history at 360x640, 390x844 and Hebrew/RTL 430x932 plus
  Purchases/Stats origin and intentional destination focus: **4/4 passed**,
  37.3 seconds. No timeouts or assertion thresholds were changed.
- Baseline remains 42 purchases / 12 places / 12 pins / ILS 6,777.38.
  Tests preserve one MapLibre instance, online/unresolved pin exclusion,
  explicit save, Undo, consumed IDs and the existing camera/decoder lifecycle.
- No additional defect was observed in these bounded correction checks.
  Physical iPhone E testing remains pending; no physical camera QA was performed.
- QA server stopped and exact pre-correction next-env.d.ts bytes restored.
  Index empty; branch/HEAD/main refs unchanged; intended 20-file manifest and
  `git diff --check` passed. No staging, commit, push or deployment.

Only six existing checkpoint files changed relative to the reviewed working tree:
`src/features/globe/SpendscapeGlobe.tsx`, `qa/spendscape-scanner-e.spec.ts`,
`AGENTS.md`, `docs/spendscape/README.md`, `docs/spendscape/CONVERSATION_HANDOFF.md`,
and this checkpoint document. All other checkpoint files, dependencies,
public assets, Scanner A/B engines and D1 remain byte-identical.
Logs/JSON: `typecheck.log`, `unit.log`, `build.log`, `focused.log`,
`focused-report.json`, `combined.log`, `combined-report.json`, `origins.log`,
`origins-report.json`, `final-git-state.json`. These remain ignored QA artifacts.
Next gate: `APPROVE SPENDSCAPE SCANNER E CHECKPOINT REVIEW`.
No commit approval is requested at the correction gate.
Evidence: `artifacts/spendscape-scanner-e-history-correction/`.

## Historical implementation QA before checkpoint review

The initial implementation QA reported no remaining Blocker or High defect.
The subsequent checkpoint review found the three defects described above; its
result superseded that initial conclusion and led to this bounded correction.

- `npm run typecheck`: passed.
- `npm test`: 178 tests in 14 files passed, including 12 Scanner E domain tests.
- `npm run build`: passed; ordinary application routes remain `/` and
  `/_not-found`; no OCR/benchmark consumer route was added.
- The combined Capture (5), Scanner A (20), Scanner B (33), data-boundary (4)
  and Scanner E (8) browser run initially passed 67/70. All three failures were
  investigated: the new candidate actions pushed Clear result below the
  360×640 viewport (fixed with bounded candidate spacing); one camera-button
  action timed out; one map-readiness wait timed out before entering Capture.
  Both timeouts passed twice in isolation without implementation changes.
- Subsequent focused production run: **18/18 passed** — all 8 E scenarios,
  all 5 B responsive candidate cases, 2 Ask action/Undo cases, 2 Replay cases
  (including Capture + Inbox + Ask composition), and 1 Inbox resolution/Undo
  case. No thresholds were increased and no failed assertion was removed.
- Additional summary/success/Undo visual capture run: **5/5 passed**.
- Wording/touch-target build verification: **10/10 passed** — four EN/HE data-boundary
  regressions, B at 360×640, E's four responsive review/Undo cases and the
  foreign user-reported purchase case. This follows the final wording and
  minimum mobile Undo touch-target corrections.
- Final Capture/success-footer verification: **13/13 passed**, covering all
  eight E cases and five direct Capture regressions. Done is reachable on all
  four viewports; the 360px case also reopens the scanner after an addition and
  verifies candidate controls remain reachable above the session footer.
- `git diff --check`: passed. New text files were also checked for trailing
  whitespace/conflict markers; no staged files.

The evidence is split across focused runs; there was not a subsequent single
clean rerun of the entire 70-test suite. Original timeout failures remain
recorded rather than being erased or classified as proven product defects.
All browser inputs/media were synthetic. Physical iPhone Scanner E testing
remains pending a separately approved deployment and user testing. Prior A/B
physical smoke evidence does not prove E behavior.

### Evidence and observed corrections

Ignored local evidence directory: `artifacts/spendscape-scanner-e/`.
Logs: `typecheck.log`, `unit.log`, `build.log`, `browser-final.log` (67/70),
`retry-timeouts.log` (4/4), `final-focused.log` (18/18),
`visual-confirmation.log` (5/5), `final-build-verification.log` (10/10),
`final-capture-verification.log` (13/13).
Screenshots: `review-*`, `summary-*`, `success-*`,
`reported-purchase-undo.png`; Scanner B candidate screenshots remain under its
existing ignored artifact directory. All are QA artifacts, not commit inputs.

Visual inspection covered 360×640, 390×844, 430×932 Hebrew/RTL and 1280×800
review layouts, mobile summary/success, candidate controls and desktop Undo.
During QA, the review action footer was separated from the scroll body so it
could not cover fields; external Undo was made reachable above purchase panels
and hidden behind active modal/replay controls; the compact candidate spacing
was corrected; mobile footer controls were made at least 44px high; and the
user-reported ILS detail/currency labels were separated from illustrative FX.
The 44px footer initially covered Done on the shortest success screen; keeping
the session footer in layout flow and success content independently scrollable
removed the overlap, including when returning to the scanner after a save.

Assertions cover no save from scanning/editing alone, blank factual context,
receipt arithmetic, required foreign paid ILS amount, online/unresolved no-pin
behavior, duplicate clicks and separate-purchase confirmation, exact Undo and
reload reset. The baseline remains 42 purchases / 12 places / 12 pins /
ILS 6,777.38. A 25 ILS physical addition yields 43 / 12 / 12 and ILS 6,802.38;
Undo returns ILS 6,777.38. The foreign online example adds exactly 87.43 ILS.
Unit checks cover derived search and month updates from the composed graph.
Injected-snapshot tests cover Capture, Inbox, Ask and Replay in both languages.
The combined Replay test retains the added purchase, Inbox decisions and Ask
Undo; one MapLibre construction remains throughout.

The real pinned ZXing reader test uses a synthetic camera canvas, then explicit
review/save. It records one stream/worker, stopped/terminated before review;
no OCR asset request, image export, storage write, outgoing receipt payload or
sensitive logging. E adds no persistence, logging or network API. Camera and
barcode lifecycle engines, ZXing assets/licenses and the D1 benchmark are
byte-for-byte unchanged. No dependency/package/lockfile change.

### Exact intended checkpoint files

- `AGENTS.md`
- `docs/spendscape/README.md`
- `docs/spendscape/CONVERSATION_HANDOFF.md`
- `docs/spendscape/SCANNER_E_CHECKPOINT.md`
- `playwright.scanner-e.config.ts`
- `qa/spendscape-capture.spec.ts`
- `qa/spendscape-scanner-e.spec.ts`
- `src/data/spendscape-analytics.ts`
- `src/data/spendscape-globe.ts`
- `src/features/capture/CaptureBarcode.tsx`
- `src/features/capture/CaptureCamera.tsx`
- `src/features/capture/CaptureExperience.module.css`
- `src/features/capture/CaptureExperience.tsx`
- `src/features/capture/PurchaseReview.tsx`
- `src/features/capture/capture-domain.ts`
- `src/features/capture/session-purchase-domain.ts`
- `src/features/capture/session-purchase-domain.test.ts`
- `src/features/globe/SpendscapeAnalytics.tsx`
- `src/features/globe/SpendscapeGlobe.module.css`
- `src/features/globe/SpendscapeGlobe.tsx`

The existing `next-env.d.ts` drift is excluded, preserved separately and must
not be staged at a later checkpoint. QA servers are stopped after verification.

## Deferred and safety boundaries

No D2/D3/OCR, Scanner C, new product/FX/place provider, GPS inference, LLM, Gmail,
photo/gallery/file ingestion, database, authentication, cross-device sync,
localStorage/sessionStorage/IndexedDB purchase persistence, network payload,
new dependency, deployment or Vercel change. D1 files, asset hashes and its negative
recommendation are preserved. New merchants/places, tax/discount allocation,
post-save editing and multi-level undo remain outside this slice.

Git base: `96ef57d8ecd8de2d1f6a43a71a461fae662ccb3a`, branch
`feature/spendscape-rebuild`. Local main/origin-main must remain
`eee0d26b55e5061f87ac664938df0c195800b74f`. No staging/commit/push is authorized.
Generated screenshots, videos, logs, Next output and Playwright artifacts remain
ignored. Restore existing next-env.d.ts drift exactly after all Next commands:
SHA-256 `0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc`.

Next separate gate after successful local QA:
`APPROVE SPENDSCAPE SCANNER E CHECKPOINT REVIEW`.
