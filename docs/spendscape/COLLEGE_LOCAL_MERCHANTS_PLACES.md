# College local merchants and places — implementation checkpoint

Bounded selective adaptation of the assessed merchant/place capability, from local HEAD `82bfce9c90b6d5e231f95680fd38150b33eda3b0`. No merge or cherry-pick. Implementation and local QA are authorized; checkpoint review, commit, push and deployment are separate gates.

## Behavior and data boundary

- Capture retains its existing place selector and adds explicit creation of a merchant, or a branch under a selected existing merchant (including an online-first merchant with no places). Names are literal user-reviewed text in both locale slots; no inferred translation, `onlineOnly`, merchant matching or coordinates.
- Physical creation requires reviewed branch/city/country, manually entered longitude/latitude and explicit confirmation. Editing location details revokes confirmation. Unknown location uses the unresolved channel and no place/pin. Online purchases remain unpinned. Similar names, branches, coordinates or reviewed addresses require reuse or an explicit separate-entity confirmation; names never become IDs.
- `DirectoryIntent` is transient. Preparation resolves a prospective graph in memory; typing, manual Review, cancellation and failed writes create no durable entities. Receipt preparation still blocks printed net discrepancies, unresolved required facts and invalid arithmetic. Original observations/timezone/tax/barcode metadata remain transient. Reviewed address and manual-location provenance are the explicit directory metadata retained locally.
- IndexedDB remains the sole purchase authority. Envelope v3 adds `directory: { merchants, places }`, keeping native database version 1 and `state/current`. Strict validation precedes graph composition and record reconstruction; unknown versions, extra fields, malformed arrays, invalid references/coordinates and orphan directory entries fail closed. Limits remain 1,000 purchases, 1,000 entries per directory array and 2,000,000 serialized characters.
- Historical v1/v2 envelopes are validated under their original discount rules, then migrated in memory to v3 with empty directory arrays. Records, discounts, revisions, decisions, sequence and IDs remain exact; hydration never writes. The next explicit successful transaction writes v3 under the existing revision guard. No localStorage reader/writer/importer was added.
- Purchase/evidence/directory/sequence/Inbox decisions commit atomically before success and the shared eight-second Undo. IDs use the monotonically retained sequence (`local_merchant_N`, `local_place_N`, existing purchase IDs). Undo and confirmed individual deletion prune only last-reference local entities; shared entities survive. Fixture purchases cannot be deleted. Erase-all removes directory/purchases/decisions and keeps the existing revision tombstone.
- All views receive the same composed graph. Repeated visits retain one pin per place; a new confirmed place adds one pin, not one per purchase. Current-place refs support long-lived map callbacks without reconstructing MapLibre. Nearby comparison rules/data, scanners, optional VAT/barcodes, receipt-time confirmation and navigation remain in their existing boundaries.
- The privacy panel now discloses local merchant/address/coordinate retention. No GPS, geocoder, catalog lookup, OCR, provider transport, dependency or account integration was added.

## Exact checkpoint manifest — 22 files

The assessed 19-path boundary is retained. The user separately approved P1's exact-envelope-key assertion and P2C's three v3 assertions plus two legacy-fixture projections; and three asynchronous Undo assertions in Scanner E (one EN/HE parameterized assertion and one insecure-context assertion). These are the only changes in the three additional regression files. Expected results and existing expect timeouts remain unchanged.

New (5):

- src/features/local-purchases/local-directory.ts
- src/features/local-purchases/local-directory.test.ts
- src/features/capture/MerchantPlaceReview.tsx
- qa/spendscape-local-directory.spec.ts
- docs/spendscape/COLLEGE_LOCAL_MERCHANTS_PLACES.md

Existing (17):

- src/features/local-purchases/local-purchase-store.ts
- src/features/local-purchases/local-purchase-store.test.ts
- src/features/local-purchases/useLocalPurchases.ts
- src/features/local-purchases/LocalDataPanel.tsx
- src/features/capture/session-purchase-domain.ts
- src/features/capture/session-purchase-domain.test.ts
- src/features/capture/receipt-review-adapter.ts
- src/features/capture/receipt-review-adapter.test.ts
- src/features/capture/PurchaseReview.tsx
- src/features/capture/CaptureExperience.module.css
- src/features/globe/SpendscapeGlobe.tsx
- src/features/globe/SpendscapeGlobe.module.css
- qa/spendscape-receipt-review-integration.spec.ts
- docs/AI_HANDOFF.md
- qa/spendscape-college-p1.spec.ts
- qa/spendscape-college-p2c.spec.ts
- qa/spendscape-scanner-e.spec.ts

AI_HANDOFF had unrelated uncommitted status/benchmark material at entry. This slice adds a concise current-status section while preserving those bytes. Historical provider QA/docs remain outside this checkpoint. next-env.d.ts and all generated QA/build output are excluded.

## Verification and evidence limits

Final results and Git safety are recorded below. Desktop browser emulation is not physical iPhone QA; no provider extraction or real receipt was used.

Observed failures retained in `artifacts/spendscape-local-directory/`:

- Sandbox rejected the initial server/browser launch; the explicitly authorized loopback server and Chrome QA were then run with the required execution permission.
- First rendered run exposed mobile confirmation-error overflow from inherited flex direction. Corrected to a two-column checkbox label/error grid; original assertions/timeouts retained.
- Second focused run: 8/10 passed, two harness failures (ambiguous status locator; real clock advancing during the exact Undo boundary test). Corrected to the unique final status and a paused clock; subsequent 10/10 passed.
- Two composed-view probes timed out at a hidden Ask control while still on Purchases. Retained screenshots show the accepted surface visibility; the test now explicitly uses the Globe tab before Globe tools. No application navigation change or timeout increase was made for this.
- Evidence-handling deviation: the original combined QA scripts regenerated four pre-existing ignored Capture artifacts before the run was stopped: `artifacts/spendscape-slice-1d3/desktop-receipt-processing-1440x900.png`, `desktop-receipt-review-1440x900.png`, `mobile-capture-receipt-390x844.webm`, `mobile-receipt-review-390x844.png`. Their entry hashes are retained in `before.json`; no matching byte backup was found. They are UI QA artifacts, not provider responses, receipt images, freezes or locks. This deviation is not represented as successful preservation of those four files.
- Further combined output is isolated using generated copies of the 12 source specs. Only relative-import resolution and artifact destinations differ; assertions/timeouts/retries and application code are unchanged. `prepare-combined.py`, `combined-copy-manifest.json`, isolated configuration, aggregate JSON report and source hashes are retained for reproducibility. None enters the checkpoint.

Additional QA investigation:

- First complete isolated aggregate: **171/175 passed, 4 failed, 0 flaky, 0 skipped** (635.7 seconds). The new second-branch fixture reused the first branch's reviewed address: the expected duplicate-place guard blocked saving. Each fictional branch now has its own address. The other three failures read counters immediately after asynchronous durable Undo. No runtime change was necessary; separately approved assertions now poll for the same counts (42 or 1) within the unchanged expect timeout. All four focused diagnostic probes passed in 17.1 seconds. The first aggregate report, traces/screenshots and copied-spec hashes are retained under `combined-first-*`; a fresh final aggregate follows.
- Extra strict TypeScript compilation of the newly included legacy Scanner E spec exposes an existing `TS2556` at line 285 (`original(...args)` in its history probe), also present in HEAD. This optional QA-file compilation is outside the application typecheck; the approved Scanner E change remains limited to the three asynchronous assertions. The other four changed/new QA specs compiled successfully. This limitation is reported rather than silently refactored.

## Final measured results — 2026-10-05 local report

- `npm run typecheck`: passed (`typecheck-final.log`).
- `npm test`: **307/307**, 19 files (`unit-final.log`).
- `npm run build`: passed; static root and not-found routes (`build-final.log`).
- Explicit strict compilation of the four new/changed directory/receipt/P1/P2C browser specs: passed (`qa-typecheck-four-final.log`); legacy Scanner E extra-compilation limitation is recorded above.
- Fresh, complete final production-browser suite: **175/175**, 12 files, **0 skipped / 0 unexpected / 0 flaky**, 611.5 seconds, workers=1, retries=0. This is one aggregate final-state run, not a sum of focused reruns (`combined-report-isolated.json`, `combined-isolated.log`). All copied-spec original hashes and final production source hashes are retained.

| Suite | Passed |
| --- | --- |
| spendscape-ask.spec.ts | 12/12 |
| spendscape-capture.spec.ts | 5/5 |
| spendscape-college-p1.spec.ts | 18/18 |
| spendscape-college-p2c.spec.ts | 13/13 |
| spendscape-data-boundary.spec.ts | 4/4 |
| spendscape-local-directory.spec.ts | 12/12 |
| spendscape-nearby-demo.spec.ts | 10/10 |
| spendscape-receipt-review-integration.spec.ts | 17/17 |
| spendscape-replay-stationary.spec.ts | 6/6 |
| spendscape-scanner-a.spec.ts | 20/20 |
| spendscape-scanner-b.spec.ts | 33/33 |
| spendscape-scanner-e.spec.ts | 25/25 |

The 12 new directory tests cover one/15-item receipt review, rendered EN/HE phones and desktop, correction/focus, double submit, reuse/duplicate override, shared-entity Undo, new branches, online-first merchants, unresolved/online no-pins, transaction abort, cross-tab conflict, read-only v1/v2 hydration, corrupt directory, exact 7,999/8,000-ms Undo transition, manual creation, composed search/Ask/Replay, confirmed deletion/final-reference cleanup, and fully discounted lines across reload. Neighboring suites cover the retained receipt arithmetic/timezone/privacy boundaries, scanners, nearby eligibility and canonical snapshot. Baseline remains 42 purchases, 12 places/pins and ILS 6,777.38 before local additions, with one MapLibre construction/instance. No physical device or live extraction quality claim is made.

Rendered screenshots inspected: `review-360-en.png`, `review-360-he.png`, `review-390-he.png`, `review-430-en.png`, `review-1280-en.png`, `keyboard-en.png`, `keyboard-he.png`, and the Hebrew location-error state. These are representative 360×640, 390×844, 430×932, desktop 1280×844 and shortened 360×420 viewports. They show review/error/focus and sticky actions without horizontal overflow; they are browser viewport checks, not physical keyboard/iPhone measurements. All live only in ignored `artifacts/spendscape-local-directory/`.

Reproduction (from this worktree after a fresh production build and loopback start):

```sh
python3 artifacts/spendscape-local-directory/prepare-combined.py
PLAYWRIGHT_JSON_OUTPUT_FILE=artifacts/spendscape-local-directory/combined-report-isolated.json npx playwright test --config artifacts/spendscape-local-directory/combined.config.ts --reporter=line,json
```

Do not regenerate original historical artifact destinations. The ignored copy helper/config and 12 original source specs reproduce the isolation. Preserve any prior run report/output before rerunning.

## Final safety and remaining gate

- Branch `feature/spendscape-rebuild`; HEAD unchanged at `82bfce9c90b6d5e231f95680fd38150b33eda3b0`. Local upstream ref `origin/feature/spendscape-rebuild` remains `66fb4204154c88789e9e0401e317f9000b6b5e18` (ahead 8 / behind 0; not fetched in this task). Origin URL remains `https://github.com/Yotams9/speand-tracking-map-.git`.
- Protected main/origin-main remain `eee0d26b55e5061f87ac664938df0c195800b74f`. No staged changes; index is unchanged. Working tree intentionally contains this 22-file slice plus the preserved entry benchmark/docs work.
- No QA Next/Playwright process or TCP 3000 listener remains. At resume the previous process sessions had already ended. `next-env.d.ts` had generated dev-route imports; with no writer active it was restored to exact entry bytes and HEAD blob `ce4e94a6b10f160ee021fe18939af160d2927dcf`.
- Of 531 entry-snapshotted files, changes outside the approved manifest are limited to the four disclosed old ignored Capture UI artifacts. All 152 scoped provider source/evidence files checked are unchanged, including freezes, reservations and consumed locks. Package/dependency/canonical/scanner source files remain unchanged. Final application source matches the tested production-build hashes.
- Existing handoff content is retained byte-for-byte after the concise current status prefix. Generated build/QA files remain ignored and outside the 22-file checkpoint. No merge/cherry-pick, credentials, provider/network data integration, account change, commit, push or deployment occurred.
- Remaining product boundary: local-only merchant/place creation is explicit and manually confirmed; no GPS/geocoding/catalog matching or receipt-photo ingestion. Historical OCR/provider results and negative D1 recommendation are not promoted.

Stop at a separate checkpoint review: **`APPROVE SPENDSCAPE COLLEGE LOCAL MERCHANTS AND PLACES CHECKPOINT REVIEW`**. This implementation report is not checkpoint review or commit approval.
