# College P1 — local purchase persistence and privacy

Date: 2026-09-25. Authority:
`APPROVE SPENDSCAPE COLLEGE P1 — LOCAL PURCHASE PERSISTENCE + PRIVACY + LOCAL QA`.
Implementation and local QA only. Separate checkpoint review is next.
No commit, push, account connection, provider, dependency or deployment change.

## Result and boundary

Explicitly reviewed purchases and canonical Smart Inbox decisions persist in
native browser IndexedDB. They restore into the existing composed purchase
graph, with the fixture repository unchanged. Purchases, Analytics, search,
timeline, Globe, Ask and Replay use that graph, not a second purchase source.
Scanner B still identifies only; review/save is the persistence boundary.
The fixture baseline remains 42 purchases, 12 places/pins and ILS 6,777.38.

Database `spendscape-local-purchases`, IDB version 1, object store `state`,
key `current`: envelope `{version:1, revision, records, nextSequence, decisions}`.
Records retain structured reviewed purchase/items, provenance, validated barcode
identification where supplied, and the existing structured evidence label.
They do not retain photographs, frames, drafts, search, browser navigation,
Undo deadlines, comparison eligibility or consumed operation lists. Existing
internal session IDs/provenance keys remain compatible; visible copy now says
on-device/local purchase. Foreign user additions retain the explicitly reported
ILS amount, never a fixture FX substitution.

Every read and write validates the envelope and rebuilds records through the
existing reviewed-purchase boundary. Exact structural equality rejects extra
fields, forged arithmetic/evidence, invalid identities and malformed nested
labels. Decisions must identify unique material canonical Inbox cases and
valid candidate places. Limits are 1,000 records and 2,000,000 serialized JSON
characters; this is a bounded college store, not an unlimited archive. Unknown
versions/corruption fail closed and remain untouched until explicit deletion.
No migration from a prior persistent purchase schema is needed: none existed.
Unsupported future versions are not silently migrated.

A readwrite transaction checks the previous revision before writing the next
complete envelope, preventing lost updates from stale tabs. BroadcastChannel
sends only a change notification; focus checks and transactional revision
checks remain when that API is absent. Other tabs must reload on conflict;
automatic merging is intentionally absent. Open/transaction waits are bounded
to five seconds. Handles close after each operation or version change.

The UI acknowledges success only after transaction completion. A synchronous
write lock and the existing operation-ID boundary prevent double confirmation.
Quota/abort failures keep the draft and the previous durable graph; retry is
explicit. Unavailable initial storage blocks use rather than silently falling
back to a temporary save. No financial data is logged in error messages.

Undo starts for eight seconds after successful commit. Removal itself commits
before success; expiry retains the purchase. A reload restores no Undo timer
and no delayed Nearby card. Nearby comparison remains illustrative, matched
items only, ILS only, with no comparison-store pin. Physical canonical-place
additions retain one pin per place; online/unresolved additions add none.

The header privacy control and Capture's “Manage local data” open a native,
keyboard-operable EN/HE dialog. Deletion requires a second explicit action and
removes all local records and Inbox decisions, then reloads the fixture graph.
An empty revision tombstone contains no purchase data and prevents a stale tab
from resurrecting deleted records. Cancellation does not erase anything.
Opening management from Capture closes Capture and disposes camera work.

Privacy copy explains this browser/device only, no account/cloud backup/sync,
shared-browser-profile visibility, no user-password encryption, private-mode
or site-data-clear loss, and the existing external map tiles. IndexedDB is
origin-specific; localhost data does not migrate to Vercel or another hostname.
No persistence guarantee is made against browser eviction, profile deletion,
OS failure or a power-loss event. There is no export/import or per-record delete
outside the most recent Undo window in this bounded slice.

## Evidence

- Final typecheck passed.
- Full Vitest: **198/198**, 16 files, passed after the final validation change.
  The new local-store suite contributes 9 deterministic cases; focused local/
  Capture/session/comparison execution previously passed 41/41 in four files.
- Production build passed, including TypeScript checking, after the final
  source changes (nested label/identity validation, focus revision guard,
  privacy Escape handling and shield button).
- Fresh complete production browser P1 + Nearby + data-boundary run:
  **26/26 passed**, about 1.4 minutes, one worker, no retries.
  Command: `playwright test --config playwright.phase2a1.config.ts
  qa/spendscape-college-p1.spec.ts qa/spendscape-nearby-demo.spec.ts
  qa/spendscape-data-boundary.spec.ts`.
- Fresh bounded Capture/Scanner A/B/E production regression run:
  **28/28 passed**, about 1.7 minutes, one worker, no retries. Covers two
  direct Capture flows, four camera viewports, all four real-reader barcode
  formats, scanning privacy, pending camera cleanup on local-data management,
  four review viewports, unknown/foreign and unresolved/manual inputs,
  receipt arithmetic, real-reader review/save, Replay privacy in EN/HE,
  shared countdown/navigation/reduced motion and newer-addition/Undo/delete.
  Exact selected cases and timings are retained in ignored
  `artifacts/spendscape-college-p1/scanner-regression-report.json`; the
  26-test complete result is `combined-report.json`. Both used the existing
  `playwright.phase2a1.config.ts` against the same production build.
- P1 assertions cover exact 7999/8000-ms transition, durable Undo,
  no new reload window, future-version preservation, confirmed erase/cancel,
  quota failure and explicit double-click retry, abort after put success,
  stale-tab save/deletion protection without BroadcastChannel, unavailable
  IndexedDB, Inbox confirm/Undo reload, foreign online addition and reopening
  a page within the same browser context.
- Browser graph evidence: 43/12 and ILS 6,864.28 after the ILS 86.90 receipt;
  43/12 and ILS 6,864.81 after explicitly reported ILS 87.43; deletion/Undo
  restores baseline. Map construction/instance count remains one.
- Injected snapshot name tests pass through Capture, Inbox, Ask and Replay in
  EN/HE. No runtime feature fixture bypass was added.
- Inspected actual production screenshots: `privacy-360.png` (360×640 HE),
  `privacy-390.png` (390×844 EN), `privacy-430.png` (430×932 HE), and
  `privacy-1280.png` (1280×844 EN), under ignored
  `artifacts/spendscape-college-p1/`. Dialog text/actions fit, RTL and
  reduced-motion operation remain readable, with no horizontal overflow.
- Network assertions observe no non-GET/HEAD application requests in the
  scoped flows. Synthetic private markers do not enter logs, history, URL or
  sessionStorage. The exact store envelope excludes media/drafts/navigation.
  Scanner/privacy regressions and source inspection supplement these bounded
  observations; this is not an exhaustive security assessment.
- Physical iPhone persistence and browser-process restart/power-loss behavior
  were not tested. Page close/reopen is not equivalent to a browser restart.
  No physical camera or new deployment test is claimed.

### Failures investigated during implementation

The first browser attempt exposed a real classification error: a quota throw
from put was treated as invalid stored data, blocking retry. It now yields a
fixed unavailable-write error; the final quota/retry and transaction-abort
checks pass. Earlier interrupted attempts are not passing evidence:
5 passed/1 interrupted/3 not run; then 7/1/4; then a combined attempt with
8 passed/1 failed/1 interrupted/16 not run.

Harness corrections retained the assertions: close Capture before opening
privacy, explicitly override the expected duplicate warning before testing a
stale write, and click the visible styled Inbox label instead of its hidden
radio. A focused four-test run then passed. A later full run passed 25/26:
the 360-pixel deletion check read the old document during its automatic reload.
The harness now awaits the actual load event before inspecting the restored
graph. The fresh complete 26-test run above passed. No timeout increase,
test removal, forced retry setting or swallowed assertion was used.

A first scanner/Capture regression run passed 26 cases, failed the new
post-deletion baseline check because it read map counters before map readiness,
and was interrupted in its final case waiting for a camera-page button while
Undo had correctly returned to Sources. The test now waits for map readiness
and explicitly closes/reopens Capture before the third addition. Product code
and timeouts were unchanged.

Legacy Capture/Scanner E reload expectations now assert retained purchases.
The former immediate demo reset test now requires explicit confirmed deletion;
its pending-camera cleanup and baseline assertions remain. These are expected
P1 contract updates, not a change to the barcode decoding implementation.

## Exact checkpoint manifest (17 files)

Modified:
- `docs/AI_HANDOFF.md`
- `qa/spendscape-capture.spec.ts`
- `qa/spendscape-nearby-demo.spec.ts`
- `qa/spendscape-scanner-b.spec.ts`
- `qa/spendscape-scanner-e.spec.ts`
- `src/features/capture/CaptureExperience.tsx`
- `src/features/capture/PurchaseReview.tsx`
- `src/features/capture/session-purchase-domain.ts`
- `src/features/globe/SpendscapeAnalytics.tsx`
- `src/features/globe/SpendscapeGlobe.tsx`

New:
- `docs/spendscape/COLLEGE_P1_CHECKPOINT.md`
- `qa/spendscape-college-p1.spec.ts`
- `src/features/local-purchases/LocalDataPanel.module.css`
- `src/features/local-purchases/LocalDataPanel.tsx`
- `src/features/local-purchases/local-purchase-store.test.ts`
- `src/features/local-purchases/local-purchase-store.ts`
- `src/features/local-purchases/useLocalPurchases.ts`

The pre-existing user-added receipt-OCR target paragraph in AI_HANDOFF is
preserved exactly against the pre-P1 backup. Historical checkpoint results
remain history; the current handoff points to this P1 exception to reload reset.

## Git, cleanup and next gate

Branch: `feature/spendscape-rebuild`.
HEAD: `6fa7a60b9fadf15e09aecc50697f549cbbfa5177`.
Local origin feature ref: `66fb4204154c88789e9e0401e317f9000b6b5e18`,
ahead 2 / behind 0; no remote refresh.
Both main refs: `eee0d26b55e5061f87ac664938df0c195800b74f`.
Index is empty; exactly the 17 listed files remain unstaged/untracked.
`git diff --check` and new-file whitespace checks pass. QA evidence/build output
remain ignored. The task-owned production server PID 30039 was stopped
(exit 143 from the deliberate TERM); no QA listener/runner remains.
`next-env.d.ts` matches HEAD and the exact pre-P1 backup bytes, blob
`ce4e94a6b10f160ee021fe18939af160d2927dcf`; no restoration overwrite was
necessary. It is excluded from this checkpoint.

No application/dependency/provider work outside P1. D1's negative OCR result,
receipt-OCR readiness, other finished-product gaps and hosting remain separately
gated. The existing Vercel deployment is unchanged and does not include P1.

Next exact approval:
`APPROVE SPENDSCAPE COLLEGE P1 CHECKPOINT REVIEW`.


## Bounded correction after checkpoint review

Authority:
`APPROVE SPENDSCAPE COLLEGE P1 — STORAGE-LIMIT AND LATE-SAVE NAVIGATION CORRECTION + LOCAL QA`.

The independent review found two Medium defects (no Blocker/High). Its
read-only evidence remains in ignored
`artifacts/spendscape-college-p1-review/REVIEW.md`.

1. Prospective record-count/serialized-size overflow now returns a distinct
   capacity rejection. It keeps the app ready, existing records unchanged and
   the review draft editable; EN/HE copy explains the local limit without
   calling stored data corrupt or forcing reload/deletion. Malformed proposed
   writes are also separated from persisted corruption. Invalid persisted data
   and revision conflicts retain their existing blocking protection. Limits
   remain exactly 1,000 records / 2,000,000 serialized characters.
2. A submitting Capture view is invalidated on step/operation changes,
   history traversal and unmount. Durable save still commits once and updates
   the shared ledger, but an obsolete completion cannot replace newer
   navigation with the success screen. The form releases its pending-submit
   guard after completion; revisiting the consumed operation reports it as
   consumed rather than duplicating the purchase or leaving a dead submit.

No storage schema, retention policy, fixture, scanner engine, dependency or
provider change. This correction stays inside the existing 17-file checkpoint
manifest; eight source/test files and these two documentation files change
relative to review entry.

Correction verification:
- Final typecheck, **199/199 unit tests in 16 files**, and production build pass.
- Added unit assertions cover both capacity limits, malformed proposed writes
  and preservation of strict persisted-data validation.
- Six new browser cases: capacity rejection in desktop EN and 360×640 HE/RTL;
  pending-save Back, full exit/unmount, Back/Forward to the same step, and
  exit/re-entry. They verify unchanged durable data on capacity failure,
  retained drafts/access, no stale history or success UI, one durable addition,
  consumed-operation protection, reload retention and one MapLibre instance.
- Final-state complete P1 + Nearby + data-boundary browser suite:
  **32/32 passed**, one worker, no retries/flaky/skips. Includes all 18 P1 cases.
  Evidence: ignored `correction-combined-report.json`.
- Final neighboring Capture/Scanner E run: **11/11 passed in 45.9s**, no
  retries/flaky/skips. Covers direct Capture history and source flows,
  unknown/foreign/unresolved review, receipt arithmetic, real-reader handoff,
  shared Undo/navigation/reduced motion and newer-addition/confirmed deletion.
  Evidence: ignored `correction-neighbor-report.json`.
- Inspected final `capacity-en.png` (1280×720) and `capacity-he.png`
  (360×640): inline feedback is readable; submit/source controls remain visible
  and unobscured. Existing privacy viewport evidence also remains available.
- Visual inspection found that the pre-existing global write-error toast
  covered Capture's action buttons when showing the new capacity rejection.
  Capacity feedback now stays in Capture's live status region and scrolls into
  view; the global duplicate is suppressed while Capture is open. Browser
  assertions require the message in the viewport and an unobstructed submit
  hit target. The initial combined 32/32 pass predates this final visual fix;
  only the fresh final-state run below is its acceptance evidence.
- The initial six correction cases passed before adding the consumed-form
  assertion and the Hebrew small-phone viewport; final evidence is below.
- No physical iPhone, process-restart, power-loss or expanded OCR/provider claim.
- Correction cleanup: final task-owned production server stopped (explicit
  Ctrl-C, exit 130). No QA listener/runner remains. Index stays empty;
  feature HEAD and both main refs are unchanged from the Git section above.
  `next-env.d.ts` still matches HEAD and pre-P1 backup byte-for-byte.
  All 17 manifest paths remain unstaged/untracked; generated evidence is ignored.
  Whitespace checks pass. No known remaining defect in this bounded correction;
  independent checkpoint review is still the next gate.

Next gate remains `APPROVE SPENDSCAPE COLLEGE P1 CHECKPOINT REVIEW`.
No commit, push or deployment is authorized by this correction.
