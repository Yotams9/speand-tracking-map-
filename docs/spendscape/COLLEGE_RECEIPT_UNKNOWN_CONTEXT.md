# Receipt review: explicit unknown context — offline checkpoint

2026-10-10. Base HEAD `79d1c3747e972898a29469a935dbebc1d0bbfecc`,
`feature/spendscape-rebuild`. Implementation and QA only; all task changes uncommitted.

## Real receipt status

The user confirmed the original draft is gone. A temporary read-only check of the
same local origin (`http://127.0.0.1:3156/`) reached validated IndexedDB hydration
(`ready`): zero user-added purchases, 42 baseline purchases and 12 pins; no draft.
The temporary tab was closed. No raw database/receipt content was exported.
No confirmed purchase is present at that origin in the inspected browser profile.
Real save/reload is **unverified**, not reconstructed or retried. This does not
establish another browser/profile's storage state. The existing server/native
build was left untouched. Confirmed data is device/browser-local; photos are not
retained and there is no cloud synchronization.

## Contract and intentional changes

Payment, purchase category and new-merchant category now offer explicit `unknown`.
Blank choices still block; there is no automatic unknown default or inferred
payment/category. `manual` retains its prior meaning. Known values keep their
strict allowlists. Summary, purchase details, filters, Stats and Replay display
unknown context coherently. Stats adds an unknown bucket only when present.
The EN/HE blocker hint now distinguishes unknown context from required facts.

The local envelope is v4, with the same keys and atomic purchase/directory write.
Strict v1/v2/v3 validation migrates to v4 **in memory only**; hydration writes
nothing. Legacy records/merchant categories cannot be reinterpreted as unknown.
An explicit next save persists v4 under the unchanged revision guard. Future
versions, extra fields and invalid records fail closed. Old application builds
will refuse a v4 envelope; do not downgrade after saving v4 data.

Unknown location remains unpinned, without fabricated coordinates. Its observed
address remains editable/transient and is not persisted as an unresolved place.
Original observations, printed quantities/prices/line amounts and explicit line
discounts remain separate from corrections. Final payable and product sum remain
independent; their difference is nonblocking. No receipt-level discount allocation.
Duplicate handling, asynchronous persistence, directory cleanup and eight-second
Undo are unchanged. Model/prompt/JSON-mode/transport and provider activation are
unchanged; there is no new native namespace or reservation.

Required financial facts remain required: usable merchant confirmation, currency,
valid date/time and explicit timezone confirmation, item descriptions, quantity,
unit, unit price and reconcilable printed line amount. Missing units or timestamps
have no supported unknown persisted representation. VAT and barcodes stay optional.
The review permits unknown payment/categories, not invented receipt facts.

## QA and evidence

Fresh isolated artifacts: `artifacts/receipt-real-save-8gzwwmyg/`.
- Guarded focused Vitest: **191/191, ten files** (`unit-verified.json/txt`). Covers
  adapter/domain, readiness, final payable, v1/v2/v3/v4 validation, directory,
  analytics, native mocks, unknown values, invalid values, duplicates and Undo.
- Production browser: **9/9** in `browser-third-report.json/txt`; final **9/9 in34.9s** after the bilingual hint correction
  (`browser-final-report.json/txt`).
  Six existing prefill regressions plus three new scenarios. EN360/HE390 unknown
  context save → Undo → save → Purchases/details → reload → duplicate rejection.
  Five fictional rows/seven units; line sum60.45/payable60.50 independent.
  v3 disk state stays byte-equivalent through hydration; next explicit unknown
  save atomically writes v4, preserving the known purchase/directory/revision.
  Checks retain 12 pins and one MapLibre construction/instance.
- Additional production regressions: **8/8 in31.3s**
  (`browser-migration-final-report.json/txt`): v1/v2 read-only hydration, failed
  migration rollback/stale-tab conflict, one-item/15-item structured save/reload
  EN/HE360/390/430 and desktop1280. Total17 passing checks across two fresh runs.
  Eight obsolete v3 envelope expectations in five existing QA files now expect v4;
  only those assertions and one migration title changed. Financial expectations
  and historical fixtures remain unchanged. Projected QA copies redirect fixed
  historical screenshot paths to fresh destinations; original tests keep their
  paths. Initial projection lacked its synthetic fixture import; failure retained,
  fixture copied locally, then8/8 passed. No historical QA output regenerated.
- Application TS and strict focused new-test/browser TS pass. Isolated production
  builds pass, including final hint correction. Whitespace checked separately.
- Synthetic screenshots only: unknown review/details EN360/HE390 inspected;
  existing prefill blockers EN360, summary HE430 and desktop1280 inspected.
  No horizontal overflow, readable summary/notice, visible focus and sticky save.
  Receipt content from real/provider output was not captured.
- Initial setup/test failures retained: malformed test syntax, obsolete legacy
  version/unknown-value expectations, incorrect synthetic snapshot setup and
  unsupported `readSnapshot`; corrected without weakening validators. Initial
  sandbox Chrome launch failure retained. Second browser run7/9: two tests tried
  opening Capture behind its still-open sources view after Undo;
  fresh rebuilt third run9/9 passed.
  Final visual check caught stale unknown-context guidance; corrected and tested.
- Full QA strict typecheck is not claimed: historical store-test snapshot arguments
  lack the required repository `source`; initial focused TS evidence retains this.
  App TS and the new strict tests pass. No broad-suite/physical-device claim.

Focused command (no network):
```sh
NODE_OPTIONS='--import ./qa/receipt-p2d/offline-guard.mjs' ./node_modules/.bin/vitest run \
  src/features/capture/unknown-context.test.ts \
  src/features/capture/receipt-review-adapter.test.ts \
  src/features/capture/receipt-review-readiness.test.ts \
  src/features/capture/session-purchase-domain.test.ts \
  src/features/capture/final-payable.test.ts \
  src/features/local-purchases/local-purchase-store.test.ts \
  src/features/local-purchases/local-directory.test.ts \
  src/data/spendscape-globe.test.ts src/data/spendscape-analytics.test.ts \
  src/server/receipt-structured-native.test.ts --no-file-parallelism
```
Browser configuration: `artifacts/receipt-real-save-8gzwwmyg/playwright.final.config.ts`;
credential-free isolated production app, opt-in fictional QA and intercepted
synthetic extraction only, port3162. No provider requests. Owned QA server stopped
after tests; no change to the user-owned native3156 server or its build.

## Exact task manifest

Edited (20):
- `src/data/spendscape-globe.ts`
- `src/data/spendscape-analytics.ts`
- `src/features/capture/session-purchase-domain.ts`
- `src/features/capture/PurchaseReview.tsx`
- `src/features/capture/MerchantPlaceReview.tsx`
- `src/features/capture/receipt-review-readiness.ts`
- `src/features/local-purchases/local-directory.ts`
- `src/features/local-purchases/local-purchase-store.ts`
- `src/features/globe/SpendscapeAnalytics.tsx`
- `src/features/globe/SpendscapeGlobe.tsx`
- `src/features/replay/LifeReplayExperience.tsx`
- `src/features/local-purchases/local-purchase-store.test.ts`
- `src/features/capture/final-payable.test.ts`
- `src/features/capture/receipt-review-readiness.test.ts`
- `qa/spendscape-college-p2c.spec.ts`
- `qa/spendscape-local-directory.spec.ts`
- `qa/spendscape-receipt-image.spec.ts`
- `qa/spendscape-receipt-direct.spec.ts`
- `qa/spendscape-receipt-structured.spec.ts`
- `docs/AI_HANDOFF.md` — appended unknown-context status only; earlier dirty text preserved.

New (3):
- `src/features/capture/unknown-context.test.ts`
- `qa/spendscape-receipt-unknown-context.spec.ts`
- `docs/spendscape/COLLEGE_RECEIPT_UNKNOWN_CONTEXT.md`

Ignored fresh QA artifacts are evidence, not proposed application files. Exact
hashes/task diff and preservation report are in that isolated artifact directory.
The three pre-existing Vision configuration edits and unrelated research are excluded.

## Separate next live gate

**Offline review readiness; real scan/save unverified.** After checkpoint review,
propose one new fixed run (not created/activated here), e.g.
`structured-save-validation-20261010-one`, with its own exclusive reservation and
new user-run private-project-verification launcher. Never reuse an old launcher.
Use the unchanged successful Gemini3.8Flash JSON-mode request and approved original
`/Users/testing.user/Downloads/WhatsApp Image 2026-10-08 at 18.03.31.jpeg`,
SHA256 `f309579ac77c22676d778758c1cc909bb33c0e4ab3fb7a65af180c3876360292`.
Recheck image/privacy, exact key/project match and account readiness privately before
activation. No credentials accessed in this offline task.

Current official [pricing](https://ai.google.dev/gemini-api/docs/pricing) lists
standard Gemini3.8Flash input $0.75/M and output including thinking $3.75/M through
2026-12-31. The unchanged local estimator reserves 4,000 text/schema-envelope input
+2,240 image tokens =6,240 input; 8,192 generated tokens (twice the4,096 output cap)
for output/thinking margin. Estimate: (6,240×0.75 +8,192×3.75)/1,000,000 =
**US$0.03540**, below proposed US$0.10. These are conservative planning allowances,
not an exact provider count or a billing-enforced dollar cap. Recheck at activation;
stop if a credible bound is unavailable. See official [image resolution](https://ai.google.dev/gemini-api/docs/generate-content/media-resolution)
and [thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking).

Proposed approval: **ONE new structured Gemini receipt request, existing Prepay,
US$0.10 maximum, approved crop only, no retries/fallbacks/automatic save.** Expected
facts are evaluation-only, never added to the generic extraction prompt. The user
reviews facts, chooses known/explicit unknown context, confirms timezone/units and
presses Save; only then inspect IndexedDB-backed counts/details and same-origin
reload. Real extraction, correction burden and save/reload must be reported separately.
No new request, reservation, credentials, billing, dependency, commit, push,
deployment or Vercel action occurred. Vercel remains paused.

## Final verdict and preservation

**Pass for this bounded offline checkpoint.** Exact23-file task manifest above;
20 entry files edited and three new task files. HEAD79d1c374/feature unchanged;
index empty, cached upstream ahead19/behind0 (no fetch). Cumulative working tree:
23 tracked modifications/108 individual untracked files, including unrelated
pre-existing work. All694 protected hashes (including native build/evidence),
main refs, entry next-env bytes and unrelated entry files unchanged. Earlier
handoff bytes are an identical prefix. See `preservation.json`, `manifest.json`
and `TASK.diff` for the exact bounded diff/hashes. No source fix remains within
this checkpoint; broader QA strict typing limitations remain as noted above.


## Independent checkpoint review — 2026-10-10

**Pass.** Reviewed the exact 23-file proposal and transitive committed dependencies.
No production defect was established and no request, persistence or UI logic was
changed in review. Added ten independent unit controls in `unknown-context.test.ts`
for combined legacy preservation, corrupt-member rejection per version, legacy
merchant-category isolation, and required currency/timestamp/unit validation.
Extended the existing three synthetic browser scenarios to cover Unknown in
Stats/category filtering and a transaction abort after a successful IndexedDB put.

Fresh evidence: `artifacts/unknown-context-review-qe1789eh/`. The exact proposal
was applied to an archived HEAD source checkout, with only installed dependencies
symlinked; no ignored history, receipts, account configuration or credentials
copied. Entry suite191/191 and strengthened suite201/201 passed under the committed
offline network guard. Application and strict focused unit/browser TS pass; a
fresh isolated webpack production build passes. Focused production browser3/3
(15.6s), mock-only, with fresh synthetic screenshots and provider network guard.
Retained earlier production9/9 + migration/structured8/8 evidence is reused:
its application sources match this proposal; only test files changed in review.
Initial loopback-bind EPERM is retained; the permitted loopback mock run passed.
Broader historical QA typing limitations are unchanged; no full-suite strict TS,
physical-device or real save/reload claim.

Review confirms exact validated v1/v2/v3-to-v4 memory migration: IDs, revisions,
nextSequence, records, directory and resolved/deferred decisions are preserved.
V2/v3 discounts, including zero-net lines, and independent final payable survive.
Corrupt members reject the entire envelope; no salvage or hydration write. V3
abort leaves disk unchanged; v1 stale-tab/rollback regression evidence remains
applicable to the unchanged revision-guarded transaction. Unknown values are an
explicit v4 choice, not a legacy reinterpretation or blank default. Unresolved
location is unpinned. Known-value, currency/unit/timestamp and printed-line
validation remain strict. Successful Gemini contract/transport and activation
safeguards are byte-identical to HEAD; no native namespace created.

Exact candidate/hunk hashes and patch: `manifest.json`, `PROPOSED.diff`; review,
QA commands/dependency isolation and preservation details: `REVIEW.md` and
`preservation.json` in the fresh directory. Proposed message:
`feat(receipts): support explicit unknown review context`.
Only the unknown-context append (including this review status) is eligible in
AI_HANDOFF; all earlier unrelated dirty handoff text is excluded. The three
pre-existing Vision server edits and unrelated research remain excluded.

Next gates remain separate local commit approval, then exactly one fresh
scan-and-save validation approval. No old draft exists, no reconstruction or
consumed launcher reuse. The live proposal above retains the unchanged generic
prompt, one approved crop, one exclusive new reservation, no retry/fallback and
explicit user Save. Current official pricing was rechecked; the planning estimate
remainsUS$0.03540 belowUS$0.10, including the existing image/output/thinking margins.
Account/key readiness and the credible cost bound must be rechecked at activation;
no funds/account action is authorized. Real save/reload remains unverified.
