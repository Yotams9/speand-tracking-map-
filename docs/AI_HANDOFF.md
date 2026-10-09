# Typography-aware leading-row proximity — 2026-10-08

- Offline correction only; HEAD remains ab26990de1aae394d10c46a00829693f4fd0bf96 on feature/spendscape-rebuild. Prior live short-leading row10/16 wordCount1 had only near-baseline=false; raw geometry/content was discarded. No reconstruction, receipt accuracy claim or new request.
- Manifest3: src/features/receipt-image/short-receipt-parser.ts; src/features/receipt-image/short-receipt-parser.test.ts; docs/AI_HANDOFF.md (this status only). Entry server configuration edits and previous handoff content preserved.
- Leading proximity now uses median word top/bottom edges per grouped row; representative height=bottom-top and centre=(top+bottom)/2. Require forward centre and anchor.top <= prefix.bottom + min(prefix.height,anchor.height): at most one smaller representative glyph-height of blank gap. Equal aligned heights preserve the former two-height centre-distance limit. Example fictional prefix top240/height10 and item top260/height30: gap10 passes; top260.125 fails. Previously their centre distance30 exceeded the smaller-height bound20. Median edges tolerate modest within-row baseline shifts and a single tall outlier without letting maximum word height inflate ownership.
- All competing forward item anchors use the SAME shared window end computed from prefix and first anchored item, rather than their own smaller height. Existing small-anchor ambiguity rejection remains. Adjacency, numeric/column structure, description anchoring, competing/malformed observed amounts, financial validation, review and signature allowlists unchanged. Existing row grouping (.65 smaller-height tolerance against first word) remains a support limit; medians do not repair split/misgrouped rows. Distant/intervening/ambiguous ownership remains rejected; missing facts remain unresolved. No geometry/values added to durable diagnostics; near-baseline and unique-item report actual new predicates.
- Fresh ignored evidence artifacts/leading-typography-pnrwdfhg. Initial targeted run108/111 exposed narrower competing-anchor ownership and an overlapping synthetic test row: shared window corrected, fixture separated; focused111/111 passed. Expanded run331/332 exposed another fictional quantity row overlapping the shifted item; moved that quantity row to preserve its intended distinct-row layout. Final guarded regressions354/354 across13files passed (receipt-image parser/inspection/diagnostics/lifecycle/boundary, server run/reservation/record, receipt adapter and session purchase domain). New controls cover unequal heights in both directions, median baseline variation, scale0.5/1/2/3, exact gap boundary and just beyond, tall outlier/competitor, small competitor and damaged/competing amounts; existing unrelated rejection/discount/partial/review controls pass. Typecheck and whitespace checks pass. No browser/server/build/provider activity was needed or performed for this pure offline parser correction.
- Historical evidence/consumed reservations, protected refs, entry next-env.d.ts and unrelated research preserved; index empty, no stage/commit/push/deployment/dependencies/credentials. Separate correction checkpoint review is the next gate. No live validation authorized.

---

# Item-row rejection signature — offline checkpoint, 2026-10-06

- Entry/unchanged HEAD 2bc082b141aa91638346b79ee85cfa24fd95909a, feature/spendscape-rebuild. Latest native run remains consumed: HTTP200/normalization-complete → item-row-unassigned; discarded OCR cannot establish its row/path. No new native namespace/request or retrospective signature backfill.
- All four reachable item-row-unassigned sites now attach actual predicate results: labelled-continuation, labelled-item, short-leading, short-following. Predicates are computed once and used for the rejection decision; no separate classifier or acceptance relaxation. Fixed check names distinguish proximity/columns, description/numeric structure, intervening prefixes and competing item anchors. Grouped-row ordinal is 1-based across the complete normalized document; ordinal/count/wordCount restricted to integers 1–1500, ordinal<=rowCount. Exact path-specific boolean keys, no extra keys/accessors/unknown strings; at least one check must fail. No coordinates/text/receipt values/images/credentials/provider messages in the signature.
- Typed layout error carries the signature into the existing failure boundary before temporary normalized evidence leaves scope. safeAttemptEvent retains a cloned signature only for failure/layout-unsupported/item-row-unassigned; ordinary POST error payload remains unchanged. Existing exclusive/fsynced attempt journal persists it; restricted local status exposes it after restart. Invalid/tampered stored signatures fail closed through existing strict record readback. Historical records without signatures remain valid, untouched.
- Task manifest9: docs/AI_HANDOFF.md; src/features/receipt-image/{layout-reason.ts,ocr-parser.ts,short-receipt-parser.ts,vision-attempt.ts,vision-local-boundary.ts,parser-inspection.test.ts,row-rejection.ts,row-rejection.test.ts}. Last two are new. Existing three src/server run-configuration edits and unrelated untracked research remain byte-identical to entry.
- Fresh ignored evidence artifacts/row-signature-l2msjumv. Initial focused run 238/241: existing exact event assertion lacked new signature; two new fictional controls accidentally described an accepted continuation or removed their test row. Corrected fixture setup and expanded exact assertion; no production acceptance change. Final guarded focused suite 241/241 (11 files), 60/60 isolated comparisons against HEAD parser observations/error outcomes, npm run typecheck and production build passed. Tests exercise all four sites, actual failed predicates, immutable input/success behavior, fixed allowlists, synthetic-secret/value exclusion, durable failure/restart and tampered readback. Whitespace passed. No broad browser QA/server/provider execution was needed or performed.
- next-env restored to exact entry/HEAD bytes; index empty, protected main refs and historical evidence/consumed locks unchanged. No new dependencies/accounts/credentials/billing/provider calls, stage/commit/push/deployment. Remains uncommitted for separate checkpoint review. This adds future diagnostic capability only; it does not diagnose or fix the discarded live response, establish OCR accuracy, or authorize another call.

Earlier entries below remain historical.

---

# One live transient parser inspection — 2026-10-06

- Inspection checkpoint is committed locally at HEAD d279759e0a1ab4d186d711ce3f5477fa0057ca87 on feature/spendscape-rebuild. Latest authorization consumed exactly one new native Capture request; no further request/retry/save authorized.
- Minimal fixed mapping validation-20261006-inspection-one → artifacts/receipt-vision-local-validation-20261006-inspection-one, separate exclusive reservation/lifecycle. Historical/default mappings unchanged; unknown names still disable native mode, no arbitrary paths. New mapping concurrency/restart/exclusive reservation mock control added. Focused offline tests195/195 across10files, application typecheck/build and whitespace passed. Fresh ignored evidence artifacts/vision-inspection-live-682bv4oc; no historical QA regenerated.
- Approved original crop hash aa40404b602ccc38e3f16d75bf30472fc12afc1c69d2a217e869cb6b7376ef46 verified. Read-only authentication active, exact project spendscape-receipt-benchmark billingEnabled=true and vision.googleapis.com enabled. Free Trial/remaining applicable free allowance/no other concurrent use reuse the user's documented confirmations, not independently measured usage. Official pricing rechecked https://cloud.google.com/vision/pricing (first1,000 Document Text Detection units/month free); no account-wide hard spending cap or independently verified charge is claimed. No account/settings/billing changes.
- Before Read: restricted status mode=native, consumed=false, attempt=null; new path absent; visible page, explicit server activation and checked client inspection. Selected crop once and pressed actual Capture Read once. Durable outcome consumed=true/state=failed: reserved0ms, authentication-start5, authentication-complete455, dispatch-initiated461, provider-http HTTP2002461, normalization-start2473, normalization-complete2479, parsing-start2484, failure2491/code layout-unsupported/layoutReason item-row-unassigned. Timing includes authentication/request/normalization/parser; not isolated OCR latency. Dispatch intent alone is not receipt proof; the HTTP200 response is confirmed. Browser file-chooser handling was unusually delayed before dispatch; it is not OCR performance evidence.
- Transient UI inspected while visible before120-second expiry: short-two-row-table strategy;16grouped rows,9header/0item/0continuation/0numeric-details/2summary/5unassigned. Exactly one explicitly rejected row, ordinal10, the first body row. Other unassigned rows were not treated as rejected or processed.
- Rejected row has one numeric-bearing word entirely within the amount column, with neither a description nor an item-code anchor. The immediately following row contains a description and an amount anchor; those rows are vertically separated beyond the grouping tolerance but within two word heights. Confirmed source cause: short-receipt-parser.ts starts[0] !== 0 rejects leading body rows before the first supported item anchor. The trace does not establish whether the leading token is a detached line amount, misrecognized decoration, or another observation; no values, text, geometry or OCR accuracy verdict retained. It is not supported as a discount/header/summary/verified product identifier. The neighboring amount means association is potentially competing, not automatically safe.
- Proposed narrow offline gate: conservative leading amount-column row association/classification with varied fictional geometry, requiring a unique printed item relationship; preserve competing numeric observations as unresolved and never discard arbitrary rows, overwrite another printed amount, invent an item or relax review arithmetic. If unique association cannot be established, retain a precise leading-numeric-row rejection/ambiguity instead of claiming a repaired draft. No parser correction implemented in this diagnosis task.
- Inspection explicitly closed then Capture/tab closed; no draft/save/reload. Receipt text/geometry remained transient UI/memory; screenshots/video/traces/raw-content logging disabled, no content retained in journals/evidence. Native server stopped; next-env restored to exact entry/HEAD bytes. All prior locks/lifecycles and protected evidence unchanged, original absent lifecycle not backfilled. No dependency/merge/commit/push/deployment. Index empty; main/origin-main unchanged eee0d26b55e5061f87ac664938df0c195800b74f; cached origin feature66fb4204154c88789e9e0401e317f9000b6b5e18, ahead14/behind0. Unrelated untracked research preserved.
- Exact uncommitted manifest4: src/server/vision-local-run.ts; src/server/vision-local-run.test.ts; src/server/vision-local.ts; docs/AI_HANDOFF.md. No new native activation or provider request permitted by these configuration files alone.

Earlier entries below are preserved as history.

---

# Transient inspection background cleanup correction — 2026-10-06

- Authorized bounded correction complete; uncommitted, awaiting a new checkpoint review. The prior independent review found one Medium defect: a response arriving after backgrounding populated inspection because the visibility listener started only after content existed. Its isolated mock evidence remains artifacts/parser-review-un7yygh_ (4 passed/1 failed); no historical score or live result is changed.
- Intake now registers its visibility listener for the entire mounted lifetime. A hidden document clears inspection and cancels the opted-in image session, aborting and invalidating the pending generation even if foregrounded before completion. A direct document.hidden check also prevents publication while hidden. Listener cleanup occurs on unmount; the independent 120-second expiry timer remains. Ordinary non-inspection intake is not cancelled by the added listener. No parser/financial/provider/reservation changes.
- Fresh offline receipt/lifecycle/namespace tests194/194 (10 files); application typecheck, strict inspection browser-spec typecheck, production build and whitespace passed. Production-browser9/9,12.6s: existing four controls plus five permanent background controls, EN1280×844/HE360×640 with hidden and foreground-before-response orderings and completed-inspection clearing. Visibility is simulated deterministically; no physical browser-backgrounding or real OCR accuracy claim. Existing storage isolation, cancellation, expiry, one-attempt rejection and 42 purchases/12 pins/single MapLibre checks passed. No screenshot/video/trace or receipt content retained.
- Correction manifest3: src/features/receipt-image/ReceiptImageIntake.tsx; qa/spendscape-parser-inspection.spec.ts; docs/AI_HANDOFF.md. The ten-file inspector slice and prior recovery configuration remain uncommitted. Fresh ignored evidence artifacts/parser-background-i9_knai5 and fictional QA namespace inspection-background-i9knai5; no historical outputs regenerated. Full unrelated unit/browser suites were not rerun; previously documented lifecycle timing variability remains unresolved.
- All656 protected historical files, three consumed native application reservations/lifecycles, prior run mappings and unrelated research remain unchanged. No credentials, provider calls, real receipts, dependencies, accounts, commit, push or deployment. QA server stopped; next-env.d.ts restored to exact entry/HEAD bytes. HEAD160f96235089ef0f05ba89bbd137bf98e1bc97b6, feature/spendscape-rebuild; empty index. main/origin-main remain eee0d26b55e5061f87ac664938df0c195800b74f; cached upstream66fb4204154c88789e9e0401e317f9000b6b5e18, ahead13/behind0 without fetch.
- Next gate: APPROVE SPENDSCAPE COLLEGE TRANSIENT PARSER INSPECTION CHECKPOINT REVIEW. No new live request authorized; real receipt draft/save/reload remains unproved.

Earlier entries below are preserved as history.

---

# Transient parser inspection — 2026-10-06

- Bounded implementation complete, uncommitted, awaiting checkpoint review. HEAD remains 160f96235089ef0f05ba89bbd137bf98e1bc97b6 on feature/spendscape-rebuild. No new provider request, credentials or real receipt intake. Latest real native run remains consumed: HTTP200/normalization-complete → item-row-unassigned. Its discarded output is not reconstructed or rescored.
- Default-off server flag SPENDSCAPE_RECEIPT_VISION_INSPECTION=1 advertises inspection only through the existing activated loopback/same-origin boundary. The local receiptVisionLocal opt-in additionally shows an unchecked inspection checkbox; checked POST adds x-spendscape-parser-inspection:1. Server and user activation are both required. Existing !VERCEL/!CI/origin/hash/reservation/timeout/no-retry gates remain unchanged; the inspection flag alone cannot activate native transport or bypass consumed locks.
- Optional pure parser trace marks the actual grouped normalized rows: header, item, continuation, numeric-details, summary, unassigned. Fixed layoutReason and an explicit rejected-row flag survive parser failure. Unassigned may mean not yet reached, explicitly stated in the view; no speculative row diagnosis or alternate parsing/financial acceptance. Successful inspection returns only parser-inspection metadata/content, never observations for saving. Invalid or over-240KB inspection responses fail closed; client byte bound 256KB in inspection mode, ordinary bound stays64KB.
- Receipt text/geometry are held only in transient request/browser memory with no module-level receipt store, journal, logs, files, screenshots, URL/history or browser persistence. No-store responses; inspection view has no save action. Clear on explicit close, discard/cancel, input replacement, leaving Capture/unmount, hidden document and 120-second expiry. Aborted/obsolete responses cannot restore it. Temporary photo URLs and input bytes use existing cleanup. No memory-erasure/garbage-collection timing guarantee is claimed for immutable strings.
- Fictional-only mock server addition requires valid existing diagnostic QA namespace and SPENDSCAPE_VISION_INSPECTION_QA=1; returns an intentionally unassigned row. It never calls gcloud/native fetch. Separate fresh mock namespaces inspection-cxzd6h9y and inspection-final-cxzd6h9y preserve original evidence/reservations. No native run mapping changes in this task.
- QA: focused receipt-image 190/190 before final disabled-boundary control; final full units501/501 across29files (includes16new inspection controls and unchanged namespace regression). Application typecheck, production build, strict new-browser-spec typecheck, whitespace passed. Final production-browser4/4,5.7s: actual fictional server rejection + consumed second submission, ENdesktop/HE360px expiry/discard/replacement/Escape/unmount, late cancellation, storage checks (local/sessionStorage and IndexedDB), 42baseline purchases/12pins/singleMapLibre. No screenshot/video/trace artifacts; viewport overflow checked. Initial unit188/190 failure was an invalid new synthetic PNG header, corrected only in the test fixture; failed log retained. Initial sandbox server start failed binding, then authorized loopback mock start succeeded. Prior full-suite lifecycle timing variability remains documented; current pass does not prove it eliminated.
- Exact task manifest10: src/features/receipt-image/parser-inspection.ts, parser-inspection.test.ts, ocr-parser.ts, short-receipt-parser.ts, vision-local-boundary.ts, ReceiptImageIntake.tsx, image-session.ts; src/server/vision-local.ts; qa/spendscape-parser-inspection.spec.ts; docs/AI_HANDOFF.md. Prior uncommitted vision-local-run.ts/test remain byte-identical; server file retains prior namespace modifications and adds only inspection/mock gates. Unrelated research preserved. Evidence artifacts/parser-inspection-cxzd6h9y plus dedicated fictional diagnostic QA directories, all ignored.
- All656protected historical files and all three consumed native application reservations/lifecycle hashes remain unchanged; original absent lifecycle not backfilled. Server stopped, next-env restored to exact entry/HEAD bytes; index empty, main/origin-main unchanged eee0d26b55e5061f87ac664938df0c195800b74f, cached origin feature66fb4204154c88789e9e0401e317f9000b6b5e18, ahead13/behind0 without fetch. No dependency/account/provider/commit/push/deploy action.
- Next gate: APPROVE SPENDSCAPE COLLEGE TRANSIENT PARSER INSPECTION CHECKPOINT REVIEW. Capability is proved with fictional rows only. A future real inspection still requires a separately approved new one-request namespace/allowance; existing consumed runs cannot be reused. Real draft/save/reload and general receipt accuracy remain unproved.

Earlier entries below are preserved as history.

---

# Post-parser native receipt validation — 2026-10-06

- Parser correction reviewed and committed at current HEAD 160f96235089ef0f05ba89bbd137bf98e1bc97b6 on feature/spendscape-rebuild. One separately approved new live request is now consumed. No further request/retry authorized.
- Minimal configuration extends the existing uncommitted recovery files with fixed validation-20261006-two → artifacts/receipt-vision-local-validation-20261006-two. Undefined historical/default and validation-20261006-one mappings remain unchanged; other inputs disable native mode. Literal roots preserve build tracing isolation. No arbitrary directory override or lock reset. New namespace mock concurrency/restart/exclusive reservation tests pass.
- Reused approved cropped original with SHA-256 aa40404b602ccc38e3f16d75bf30472fc12afc1c69d2a217e869cb6b7376ef46; locally inspected with no payment section. Read-only checks confirm active gcloud login, target project billingEnabled=true and vision.googleapis.com enabled. Active Free Trial/no other concurrent use/remaining monthly free unit reuse the user's unchanged documented confirmations; allowance is not independently metered. No account/billing/API/permission changes.
- Actual Capture selected this crop and pressed Read exactly once. Restricted GET before: mode=native, consumed=false, attempt=null. Durable outcome after: mode=native, consumed=true, failed. Events: reserved0ms, authentication-start7, authentication-complete469, dispatch-initiated475, provider-http HTTP2001344, normalization-start1356, normalization-complete1362, parsing-start1366, failure1373/code layout-unsupported/layoutReason item-row-unassigned. Last successfully completed processing stage is normalization-complete; parsing began and rejected structure. Timing includes authentication/request/normalization/parsing, not isolated OCR latency.
- Capture displayed no reliable draft and discarded the image. No observations reached review, corrections, save or purchase creation. Merchant/address/date/time/product names/quantity/unit-price/line-amount/payable-total accuracy are all unassessed, not established missing/incorrect merely because parsing failed. Currency/unit/century/location/discount not inferred; VAT/barcodes remain optional. No user save confirmation or reload verification because no usable draft exists. Baseline visible 42 results/12 places remained; no purchase write/camera action occurred.
- item-row-unassigned can denote an unanchored leading row, unsupported continuation/discount, distant textual continuation, or unassigned labelled-table cell. The reason alone cannot identify the failed row/strategy. Transient normalized output was discarded by the existing boundary and is unavailable after response completion; no raw output retained, reconstructed or rescored. Another OCR accuracy or layout claim needs separate evidence; no financial acceptance change.
- Fresh QA: 178/178 focused offline tests (nine files), typecheck and production build passed. This task did not repeat the full suite; prior review passed 484/484, while earlier concurrent 483/484 lifecycle timing variability remains documented and unresolved as test variability. Isolated evidence only artifacts/vision-post-parser-15abp234. Initial sandboxed readiness/status checks could not access gcloud/local server; authorized read-only checks succeeded with appropriate permissions, without a provider OCR call. Browser Chrome unavailable; actual UI validation used the in-app browser.
- Manifest (4, all uncommitted): src/server/vision-local-run.ts, src/server/vision-local-run.test.ts, src/server/vision-local.ts, docs/AI_HANDOFF.md. Existing partial configuration preserved and extended only with this fixed namespace/test coverage; parser source stays at reviewed HEAD. All 656 historical protected files and both earlier consumed application reservations/lifecycle hashes remain unchanged; old absent lifecycle not backfilled. New run reservation/lifecycle are permanent and ignored.
- Server stopped and validation tab closed. next-env restored to exact entry/HEAD bytes; index empty, main/origin-main remain eee0d26b55e5061f87ac664938df0c195800b74f; cached origin feature 66fb4204154c88789e9e0401e317f9000b6b5e18, ahead13/behind0 without fetch. No dependencies, account changes, commit, push, deployment or further implementation. Remaining boundary: a usable real receipt review is not demonstrated; no save/reload validation on this receipt.

Earlier entries below are preserved as history; current Git/attempt status above supersedes their next-gate statements.

---

# Item-anchor and discount evidence correction — offline only, 2026-10-06

- Authorized bounded correction complete, uncommitted, awaiting separate checkpoint review. HEAD remains f9a84b69a7036fe37ccaa24acce6d762521b7b25 on feature/spendscape-rebuild. No new provider request; the prior real result remains HTTP200/normalization-complete/layout-unsupported, with no retroactive accuracy claim.
- Short layout now requires a printed amount or a multi-digit item-code anchor to establish a description row as an item. Damaged decimal prices such as fictional I.50/S.50/o.50 remain verbatim numeric observations on the original item, never repaired or appended to its name. Unsupported unrelated text beside a short quantity fails with item-row-unassigned. Existing decimal-fragment reconstruction remains intact.
- Labelled layout rejects unknown-only or numeric-only unassigned rows instead of creating all-null products; new items require observed name cells and a quantity/price/amount cell. Existing partial fields, bounded name continuations and strict financial review validation remain.
- A percentage on any competing associated numeric row preserves discount=null even when quantity/price association is unresolved. Absence is no longer substituted for that printed uncertainty; no percentage-to-amount calculation is added.
- Exact current correction manifest (5): src/features/receipt-image/short-receipt-parser.ts, short-receipt-parser.test.ts, ocr-parser.ts, ocr-parser.test.ts; docs/AI_HANDOFF.md. Prior nine-file parser slice and three preceding recovery-config files remain in the cumulative 12-file working scope; unrelated research preserved.
- Fresh offline QA: 175/175 receipt-image tests (eight files), typecheck and whitespace passed; ten new permanent regression controls. Default concurrent full unit run was 483/484: existing 40ms disconnect lifecycle test failed waiting for mock dispatch under parallel load. Same final source passed 484/484 with --maxWorkers=1; no timeout/assertion changes or lifecycle-test edits. Preserve this variability rather than claim an all-green default run. Evidence: artifacts/receipt-anchor-correction-0xf_ahzc (including original failed log).
- All 656 protected historical files, both consumed application reservations and latest lifecycle match original hashes; old absent lifecycle remains absent. next-env matches entry/HEAD, index empty, main/origin-main unchanged at eee0d26b55e5061f87ac664938df0c195800b74f; cached origin feature remains 66fb4204154c88789e9e0401e317f9000b6b5e18 (ahead12/behind0, no fetch). No server/build/browser/provider/credential/dependency/commit/push/deploy action in this correction.
- Next gate: APPROVE SPENDSCAPE COLLEGE RECEIPT LAYOUT PARSER CORRECTION CHECKPOINT REVIEW. Mock geometry proves only these offline cases; consumed real OCR output remains discarded and cannot be reconstructed. Further live validation remains separately gated.

The preceding status is preserved below as history.

---

# Receipt layout correction — offline only, 2026-10-06

- Approved bounded parser correction complete, uncommitted, awaiting separate review. HEAD remains f9a84b69a7036fe37ccaa24acce6d762521b7b25 on feature/spendscape-rebuild. Preserve the preceding four-file recovery configuration and both consumed application Vision runs. The latest real result remains HTTP200/normalization-complete/parser layout-unsupported; this is not an OCR accuracy verdict and is not retroactively rescored.
- New ReceiptLayoutError carries one of seven fixed structural reasons: table-header-missing, table-header-ambiguous, column-order-unsupported, column-header-ambiguous, item-anchor-missing, item-row-unassigned, item-count-limit. Existing layout-unsupported consumer error category stays stable; native response and durable failure event additionally expose only allowlisted layoutReason. No OCR text, values, coordinates or arbitrary error strings enter diagnostics. Historical JSONL remains byte-identical/readable; no backfill.
- Short table: text spans recognize split header words; bounded row grouping allows baseline offsets up to 0.65 of the smaller word height against the first word (no transitive chaining). Printed amount/code plus description anchors delimit products rather than fixed alternating rows. Bounded name-only continuations join wrapped labels. Numeric rows may occur at uneven spacing within eight top-row heights; absent, distant or competing numeric rows remain unresolved. Missing/ambiguous numeric-column headers leave quantity/price null. No summary anchor yields finalAmount=null; no total is calculated from the basket. Amount crossing, malformed singletons and ambiguous totals retain prior strict behavior. No inferred currency/unit/century/discount/barcode/location.
- Labelled table: printed name/amount plus another known column establish the strategy. Unknown printed header cells remain relative boundaries, preventing their values entering adjacent known fields. Missing known fields stay null; an unknown column conservatively leaves discount unresolved if no explicit discount column exists. Bounded name-only continuation appends to an anchored previous line, not a new purchase item. Duplicate known columns fail with a fixed reason. All existing explicit discounts/fully discounted lines, printed arithmetic and save validation remain unchanged.
- Still unsupported: unknown/ambiguous primary table anchors, reordered short columns, unanchored or unrelated rows, over-limit data, arbitrary multi-table layouts and sufficiently skewed/multi-baseline text. Percent/standalone short-layout discounts and unknown extra rows are not silently interpreted. Unknown numeric-field association remains unresolved; these drafts need explicit user correction and cannot bypass prepareReceiptReview. Primary table ambiguity fails closed rather than falling through to another strategy.
- Fictional controls: split header fragments, 5/10/12px baseline shifts on 20px boxes, wrapped 1/3/15-item descriptions, variable spacing, missing numeric headers/rows/totals/line amounts, malformed O-containing prices, overlapping/crossing fields, competing rows/anchors, unassigned discounts, fixed reason/privacy allowlists and labelled unknown columns. No real receipt values or discarded provider response used. Updated prior missing-field rejection assertions to require partial unresolved drafts; parser-failure lifecycle fixture now removes a required primary header, preserving its failure assertion.
- Fresh offline QA: receipt-image 165/165 in eight files; full units 474/474 in 28 files; application typecheck and whitespace passed. Earlier failures retained: obsolete whole-receipt rejection expectations and a new malformed-price grouping bug; the latter fixed without O-to-zero repair. No browser/build/server, credential, provider or network transport in this task. Evidence only artifacts/receipt-layout-offline-sOFUx4. All 656 protected historical inputs and latest consumed reservation/lifecycle match hashes; next-env, index and protected main refs unchanged.
- Exact current-task manifest (9): src/features/receipt-image/layout-reason.ts, ocr-parser.ts, ocr-parser.test.ts, short-receipt-parser.ts, short-receipt-parser.test.ts, vision-attempt.ts, vision-attempt.test.ts, vision-local-boundary.ts; docs/AI_HANDOFF.md. The three prior recovery-config source/test changes remain untouched, making 12 cumulative current files including this shared handoff. Unrelated untracked research preserved. No dependency, financial schema, UI, commit/push/deployment change.
- Next gate: APPROVE SPENDSCAPE COLLEGE RECEIPT LAYOUT PARSER CORRECTION CHECKPOINT REVIEW. Offline controls establish supported fictional geometry only; they do not prove the consumed live receipt now parses. No retry or future call authorized.

The following handoff is preserved as history; this offline status supersedes earlier next-gate text only.

---

# One new local Vision validation — 2026-10-06

- Entry/unchanged HEAD f9a84b69a7036fe37ccaa24acce6d762521b7b25, feature/spendscape-rebuild. Diagnostics checkpoint is committed. Latest approval authorized exactly one new Capture native request; that allowance is now consumed. No retry or further provider call authorized.
- Reused the locally inspected, previously approved cropped original (SHA-256 aa40404b602ccc38e3f16d75bf30472fc12afc1c69d2a217e869cb6b7376ef46), not the newly attached receipt or an AI edit. Read-only gcloud confirmed project spendscape-receipt-benchmark, billingEnabled=true and Vision enabled. Active Free Trial, unused applicable monthly allowance/no other or concurrent use are user-confirmed, not independent billing-meter measurements. Official pricing reconfirmed: https://cloud.google.com/vision/pricing . No account/billing/API/permission changes.
- Small recovery configuration: SPENDSCAPE_RECEIPT_VISION_RUN accepts only validation-20261006-one, selecting fixed artifacts/receipt-vision-local-validation-20261006-one. Undefined preserves historical default; any other value disables native mode. No arbitrary path/run override. Existing activation/origin/image-hash/default-off/hosted restrictions and one-call transport unchanged. New exclusive reservation and separate lifecycle are permanent. The old consumed reservation remains byte-identical and its absent lifecycle is not backfilled.
- Actual Capture selected the approved crop and pressed Read once. Independent GET status before dispatch: mode=native, consumed=false, attempt=null. Afterward: mode=native, consumed=true, state=failed. Durable stages: reserved(0ms), auth-start(6), auth-complete(283), dispatch-initiated(289), provider-http HTTP200(1282), normalization-start(1294), normalization-complete(1300), parsing-start(1305), failure/layout-unsupported(1312). Times are elapsed lifecycle measurements including authentication, not isolated OCR latency. Dispatch initiation alone is not receipt proof; the HTTP event establishes a response, not correct extraction.
- Capture displayed an honest unavailable-draft error and discarded the photo. No review response, automatic save, manual corrections or purchase creation occurred. Merchant/address/date/time/product/quantity/unit-price/line-amount/payable-total correctness are all unassessed: no review observations were produced, so none can be classified exact or incorrect. Currency/unit/century/discount/location were not inferred. VAT/barcodes remain optional. Save/reload was not exercised because no usable draft existed; no user save confirmation requested. Baseline UI remained 42 results/12 places; no added pin or second map observed.
- Useful offline analysis: layout-unsupported can arise in either supported parser strategy from unrecognized/ambiguous table anchors, quantity/price headers, column order, total anchors or paired item rows. Normalization completion does not establish any of these. Raw response was discarded; the failing individual layout predicate cannot be reconstructed. No receipt-specific tuning or financial acceptance change.
- QA: 46/46 focused offline run/lifecycle/boundary tests; 37/37 parser/normalization controls; typecheck and final production build passed. Initial build failed because a dynamic artifact directory made Turbopack trace an unrelated ignored venv symlink; fixed literal roots resolved it without touching history/configuration. Fresh evidence only artifacts/vision-validation-ZI0GfX. All 656 protected historical inputs match. Native server stopped; next-env restored to exact entry/HEAD; protected main refs unchanged; index empty.
- Exact uncommitted manifest (4): src/server/vision-local-run.ts, src/server/vision-local-run.test.ts, src/server/vision-local.ts, docs/AI_HANDOFF.md. No dependency, credential retention, application schema/UI/financial parser change, commit/push/deployment. Remaining limitation: actual receipt-to-review validation failed; general receipt support is unproved. Next useful task would be separately bounded offline parser-compatibility investigation with fictional controls; another live request needs new explicit authorization and must never reset this consumed run.

The following status is preserved as historical context; this outcome supersedes its gate statements.

---

# Local Vision attempt diagnostics — 2026-10-06

- Entry HEAD `108d2bbce89b452230781dfa75157c87a700dff9` on `feature/spendscape-rebuild`; local Vision integration is committed. Current bounded diagnostics correction is uncommitted and awaits review. Prior real validation remains inconclusive; its reservation and all historical evidence stay unchanged. No new live attempt is authorized.
- Separate private lifecycle JSONL starts exclusively after the one-call reservation and is fsynced before authentication/dispatch. Fixed allowlisted stages cover reservation, auth, dispatch initiation, provider HTTP receipt, normalization, parsing, response preparation and failure/interruption. Only bounded timing, numeric HTTP/code and allowlisted Google status survive; no image/token/OCR/message/field values. Record failure before transmission fails closed.
- Restricted loopback/same-origin GET `/api/receipt-ocr`, headers `x-spendscape-local-vision: 1` + `x-spendscape-vision-status: 1`, returns the safe record with no-store. Activation gates still apply. Missing legacy record stays null with consumed=true; no historical backfill. Restart leaves a nonterminal record incomplete, not a reconstructed diagnosis. Dispatch initiation is not proof of Google receipt/processing; review-response-complete means a Response was prepared, not browser delivery.
- Explicit fictional server QA (`SPENDSCAPE_VISION_DIAGNOSTIC_QA=1` + validated QA_RUN) uses fake authentication and injected transport only, isolated under artifacts/vision-diagnostics-qa/<run>. Default/hosted activation restrictions remain. It cannot use gcloud/native fetch. Real native reservation path remains consumed.
- Fresh QA: 44/44 focused lifecycle/boundary tests, 443/443 full units, typecheck and production build passed; 7/7 isolated production-browser mocks (10.1s). Two initial builds hit Turbopack tracing of an unrelated ignored venv; restricting QA paths to a dedicated subtree fixed it without touching old artifacts/config. EN/HE 360px review screenshots inspected; save/reload, 42 baseline purchases, 12 pins and one MapLibre verified by neighboring tests. No timeout/assertion relaxation.
- Exact manifest/results and limits: docs/spendscape/COLLEGE_VISION_ATTEMPT_DIAGNOSTICS.md. Evidence: artifacts/vision-diagnostics-0knnvnf4/; no historical QA destination regenerated. All 656 protected inputs match entry. Server stopped, next-env restored to entry bytes, main refs/consumed locks preserved. No credentials/provider call, dependency/account/billing/schema/UI change, stage/commit/push/deploy.
- Next gate: `APPROVE SPENDSCAPE COLLEGE LOCAL VISION ATTEMPT DIAGNOSTICS CHECKPOINT REVIEW`. A later real attempt needs separate approval and a new reviewed reservation; never reset the consumed one. Real extraction/general receipt support remains unproved.

The following handoff is preserved as historical context and superseded by this status.

---

# Current local Vision receipt slice — 2026-10-05

- HEAD `37fac7d059bac7947f1fe2f8828518e1e2d49187`, branch `feature/spendscape-rebuild`; the prior mock receipt-image checkpoint is committed locally. Current local Vision connection is **uncommitted, awaiting review**; exact 18-file manifest and limitations: `docs/spendscape/COLLEGE_LOCAL_VISION_RECEIPT.md`.
- Native server-only Vision is default-off, explicitly local/loopback, same-origin and approved-image-SHA gated. One image/one DOCUMENT_TEXT_DETECTION POST, no retry/redirect/fallback; token stays server-side through existing gcloud. No dependency/schema/account/billing/deployment change. Hosted recognition remains unavailable; fictional QA is separate.
- New short printed two-row table parsing uses text headers/relative geometry; original labelled tables/discounts remain. Missing currency/units and two-digit year need explicit review. No amounts, century, barcode, merchant/place IDs or coordinates are invented. Existing adapter, printed-line reconciliation, timezone confirmation and atomic IndexedDB v3 save remain.
- Read-only project/billing/API checks passed. Free Trial/free allowance/no concurrent use are user-confirmed. One real local image POST was made; the new reservation is consumed. **Live validation is inconclusive**: browser response inspection stopped before recording HTTP status/observations; provider dispatch/status and real extracted fields cannot be reconstructed. Conservatively count this as the entire one-call authorization consumed (0–1 provider calls, no retry). No real purchase was saved; no claim of OCR/extraction or reload success on this image. All prior Gemini/Groq/Vision evidence/locks remain unchanged.
- QA: 99/99 focused units, 406/406 full units, application typecheck/production build and strict new QA compile passed. Combined production browser 96/100 (all 94 existing regressions passed); four new tests omitted explicit merchant selection. A focused rerun then exposed immediate map-count reads on reload (2/6); after correcting only test setup/waiting for unchanged counts, final focused 6/6 passed on final build. No assertion/timeout relaxation. Fictional UI saves/reloads pass in 360 EN/HE, 430 HE and desktop; screenshots inspected. Baseline 42/12/12, one MapLibre preserved. Live response-inspection failure did not reproduce with fictional mocked or local HTTP responses; cause remains unknown.
- Evidence handling limitation: initial interrupted QA wrote 47 historical ignored QA artifact paths before isolation; originals were not backed up. Do not claim their complete preservation. Exact list and all new isolated evidence are under `artifacts/vision-local-capture-nppfrda3/`. 454 provider/benchmark files hash-checked unchanged. Earlier four overwritten artifacts and legacy strict Scanner E TS2556 remain historical limits.
- Next gate: separate checkpoint review only. No further provider request, real save, commit, push or deployment is authorized. General/10–15-item real OCR and hosted activation remain unproved and separately gated. Finished college-product goal remains separate from illustrative ILS nearby prices.

## Offline selection correction — 2026-10-06

- Separately approved correction addresses checkpoint findings only: total selection retains complete geometric evidence before decimal reconstruction; malformed/competing/boundary-crossing candidates fail closed. Currency comes only from an explicit `Currency:`/`מטבע:` header in the short layout; unlabelled currency tokens remain unresolved. Merchant/address reject standalone or segmented dates, time and identifier-only rows without shifting later rows into their place.
- Changed only short-receipt-parser.ts, its test file, COLLEGE_LOCAL_VISION_RECEIPT.md and this handoff. 19 new permanent synthetic controls; full units 425/425, guarded receipt-image units 118/118, original four independent review controls 4/4, typecheck and whitespace passed. No build/browser/server/provider/credential operation in this offline correction. Evidence: artifacts/vision-selection-correction-f15p2z2v/.
- Original live freeze, scores, 454 historical provider/benchmark files and consumed local Vision reservation remain unchanged; source revision intentionally differs from the historical parser hash. Live result remains inconclusive and no retry is authorized. Prior 96/100 aggregate, final 6/6 browser run and overwritten-QA-artifact limitations are historical, not fresh correction QA.
- Next gate: fresh local Google Vision receipt integration checkpoint review; no commit/push/deployment authorization.

The following status and handoff entries are preserved as historical context; this prefix supersedes older next-gate/Git/API statements.

---

# Current local slice — 2026-10-05

- Branch `feature/spendscape-rebuild`, HEAD `5253f5ab026484646d853f90a0328904a92a83e0`. Local merchants/places are reviewed and committed there; IndexedDB v3 remains the sole atomic purchase/directory authority. Receipt adapter/review checkpoints are unchanged. Current receipt image-to-review slice is **uncommitted and awaiting separate review**: exact 19-file manifest, tests and limits in `docs/spendscape/COLLEGE_RECEIPT_IMAGE_REVIEW.md`.
- Capture’s existing source chooser has explicit temporary JPEG/PNG photo/file intake (4 MiB, 12M pixels; no HEIC/PDF). Ordinary recognition is honestly unavailable and sends no request/image. The new server-only `/api/receipt-ocr` has no live transport or credential access. Fictional 1/15-item word geometry requires opt-in loopback QA (`SPENDSCAPE_RECEIPT_IMAGE_QA=1`, `?receiptImageQa=1`, same-origin selector only); mock results are visibly labelled independent of the selected image.
- Provider-neutral parsing supports one explicit labelled aligned table, including Hebrew/English, weighted quantities and printed discounts. Geometry derives from headers, not fixed receipt regions/expected answers. Unsupported/ambiguous facts remain unresolved; no financial repair or barcode/location inference. Original observations stay transient and separate from corrections. Existing `receiptToReviewDraft`/`prepareReceiptReview`, timezone/location/payment/category confirmation, v3 explicit save, reload, duplicates, eight-second Undo and deletion remain.
- Initial slice QA (before parser correction): application typecheck/build, strict compilation of the new QA files, 344/344 units (37/37 image tests), focused production browser 13/13. Combined production browser **127/127**, nine suites, zero retries/skips/flaky. EN/HE intake/correction screenshots inspected at 360/390/430/desktop. Earlier 6/12, 126/127 and 125/127 failures are retained. Loopback origin and camera placement/keyboard regressions were corrected; CaptureCamera is now unchanged. Duplicate-check failures were traced to the QA helper skipping its not-yet-rendered selector and comparing different fixtures; it now waits/verifies the chosen fixture, with same-fact assertions and a domain regression. No timeout/assertion relaxation. Historical legacy Scanner E TS2556 is not claimed fixed.
- Baseline remains 42 purchases, 12 places/pins, ILS 6,777.38 and one MapLibre instance; Globe · Capture · Purchases · Stats, scanners and synthetic comparison remain. No photos/raw OCR/provider payloads are retained, logged or uploaded. No real OCR/provider accuracy or physical receipt-photo QA is claimed. Prior D1 negative result, consumed Gemini/Groq/Vision locks and evidence are unchanged; current mock fixtures never rescore them. Earlier local-merchant checkpoint's four overwritten UI artifacts remain an acknowledged historical limitation.
- Git safety: HEAD/index/main/origin-main and cached origin feature ref unchanged; ahead 9/behind 0 without fetch. `next-env.d.ts` matches entry/HEAD. QA server stopped; all generated output is ignored (60 misplaced new Scanner A screenshots relocated without byte changes; see checkpoint). Unrelated untracked benchmark/docs work is preserved; no dependency, schema, account, provider, commit/push/deploy change.
- Next gate only: `APPROVE SPENDSCAPE COLLEGE RECEIPT IMAGE TO REVIEW CHECKPOINT REVIEW`. Real server OCR transport/credential/privacy/budget validation, any real transmission and deployment each remain separately authorized. The finished college-product goal remains separate from illustrative ILS nearby prices.

- Bounded parser correction complete, awaiting fresh checkpoint review: label direction uses observed Hebrew/Latin runs rather than header language; overlapping labels and any unresolved repeated header stay unresolved. Optional VAT remains optional; no character/financial repair. Fresh QA: 55/55 focused, 362/362 full units, 6/6 independent controls, typecheck/strict new QA/build/whitespace passed; 2/2 new EN/HE cases and one combined 41/41 production-browser run (117.8s, no skips/flaky/retries). Changed only parser, parser tests, image browser spec, checkpoint and this current-status prefix; full checkpoint remains 19 files. Historical 127-case aggregate/evidence and all provider locks preserved. No live OCR, commit/push/deploy; same separate review token above.

The prior handoff below is retained unchanged as historical context; this current status supersedes its older next-gate, schema, API and Git statements.

---

# Spendscape — AI handoff

Updated against the local worktree on 2026-09-27. This is a quick orientation, not a replacement for `AGENTS.md` and the authority files in `docs/spendscape/`; read those before acting. Recheck Git and external services because they can change.

## 1. Project overview

Spendscape is a mobile-first purchase-intelligence web/PWA product for consumers, with an interactive globe showing where purchases happened. The user's target is a **finished, functioning college-project product**, not a site that remains merely a demo throughout. The current local build is an incomplete concept/prototype toward that target: users can review purchases and analytics, capture and explicitly save purchases, resolve material uncertainty, issue bounded map/UI commands, and replay purchase details, and approved College P1 now persists reviewed purchases and Inbox decisions locally across reload; receipt OCR and other target capabilities remain unimplemented. Nearby Price Comparison may use explicitly labelled illustrative Israeli-store prices in ILS for the final college submission; this data-source simplification does not redefine the whole product as a demo or establish factual retailer savings. See the bounded implementation record below.

## 2. Tech stack and commands

| Layer | Current state |
| --- | --- |
| Frontend | Next.js 16 App Router, React 19, TypeScript, CSS Modules; MapLibre GL 6 with OpenFreeMap Liberty and a self-hosted RTL text plugin. |
| Backend | Next.js server page loads a provider-neutral **fixture** snapshot. No product API routes or persistent write service. |
| Local storage | College P1 uses native IndexedDB for validated reviewed purchases and Inbox decisions in this browser only. No backend database, account or cloud sync. Canonical fixtures and ignored Nearby-price research remain separate. |
| Auth | None. Camera access requires an explicit browser permission. |
| Deployment | Existing Vercel Hobby college demo: https://spendscape-college-demo.vercel.app . Verify its deployed commit separately; local commits and pushes do not update it automatically. |

Requires Node >=22.14 and npm 10.9.2. Run `npm install`, `npm run dev` (or `npm run dev:mobile` for LAN display), `npm run typecheck`, `npm test`, and `npm run build`. `npm run start` serves a built app. Targeted Playwright scripts include `qa:globe`, `qa:capture`, `qa:scanner-b`, `qa:data-boundary`, `qa:ask`, and `qa:replay`; see `package.json` for the full list and server prerequisites. **There is no lint script configured.** Offline Nearby Prices tests use the ignored NP0 Python 3.12 virtual environment if present: `artifacts/nearby-prices-np0/venv/bin/python -B -m unittest discover -s qa/nearby-prices -p 'test_*.py'`.

## 3. Architecture

- `src/app/`: App Router entry. `page.tsx` loads `fixtureSpendscapeRepository` and passes one serializable snapshot to the client globe.
- `src/data/`: canonical synthetic fixtures, repository read contract, purchase/place types, filtering, derived map and analytics data.
- `src/features/globe/`: persistent MapLibre instance and shared UI/session state. `capture/`, `inbox/`, `ask/`, and `replay/` contain their feature domains and views; English/Hebrew copy lives with the active features. The unreachable inherited Ledgerline source tree was removed in the bounded 2026-10-01 cleanup; see README.md for the retained repository layout.
- `tools/nearby-prices/` and `qa/nearby-prices/`: isolated Python source parsing, normalization, comparison qualification and offline tests. They are not imported by the Next.js app.
- `docs/spendscape/`: phase authority, design, technology decisions and checkpoint evidence. `artifacts/` holds ignored raw samples and QA output.

Flow: synthetic fixture repository → server snapshot → persistent client globe → derived Purchases/Stats/search/map state. Reviewed Capture commits to native IndexedDB before updating the shared ledger; validated records and Inbox decisions restore into the same graph. Undo removes the latest addition within eight seconds and persists that removal; reload does not restart Undo. Scanner B identifies a barcode/product candidate; it does not prove a purchase. No application `/api/*` endpoint is currently implemented. The intended `/api/compare-price` route remains a proposal.

Core TypeScript model: `SpendscapeDataSnapshot` (`profile`, `merchants`, `places`, `purchases`, `evidence`, `smartInboxCases`); `GlobePurchase` includes merchant, optional place, channel, resolution, original amount/currency, FX provenance and nested items. One pin represents a physical place, not each transaction; online/unresolved purchases have no pin. There is no backend database schema or migration; the local IndexedDB envelope is version 2 with validated in-memory version-1 compatibility, documented in COLLEGE_P2C_CHECKPOINT.md. The planned separate retailer-price read model is described, not created, in `docs/spendscape/NEARBY_PRICES_NP1_SCHEMA.md` (source files, stores, products, price observations, promotions and projections).

## 4. Completed work

- Globe, RTL/trackpad, clusters, heatmap, search, Purchases, Analytics, synthetic Capture, Smart Inbox, deterministic Ask and details-first Life Replay are implemented. Replay moves the camera only on explicit `Show place`.
- Scanner A requests live camera permission; Scanner B reads barcodes locally with pinned `zxing-wasm`; Scanner E connects a reviewed candidate to a purchase that College P1 persists in this browser's IndexedDB. An eight-second timed Undo UI is committed. The fixture baseline is 42 purchases, 12 places/pins and illustrative ILS 6,777.38.
- Phase 2A.1 established the fixture repository boundary in `src/data/spendscape-repository.ts`. Main implementation entry points are `src/features/globe/SpendscapeGlobe.tsx`, `src/features/capture/`, and `src/data/spendscape-globe.ts`.
- Nearby Prices NP0/NP1 benchmarked and normalized a bounded Shufersal sample; NP2–NP2V documented access stops for additional chains. NP2F found 15 unequal historical source-price pairs between two distant Shufersal stores. NP2G qualified a nearby Shufersal address point at branch 11, about 1.6 km from branch 1, and added offline selection tests. No current price pair or factual savings claim has been established.

## 5. Current state and risks

Current local HEAD is `6d384029cf6ad83c0f55537650d35b0bed6a4b12`: College P1, the P2A/P2B benchmark foundation, and the reviewed P2C discount support are committed locally. The local origin feature ref remains `66fb420` (ahead 5, behind 0; not refreshed); main/origin-main remain `eee0d26`. P2B remains stopped at 5/12 synthetic Gemini attempts, with two HTTP 503 responses and no model promotion or Capture integration; see sections 10–11. Earlier Git/QA statements are historical snapshots. No push, deployment, additional provider call or subsequent implementation is authorized.

For a **factual retailer-price claim**, the immediate blocker is authoritative mapping of the regulated shekel/agora price field to the current Shufersal XML `ItemPrice` tag. NP2G stopped before fresh PriceFull downloads. The nearby coordinates are public address points, not surveyed entrances or route distances. Currency, current price overlap, source freshness/coverage, stock and dataset reuse still need proof before a factual savings claim. This does not block a clearly labelled synthetic college demo. Carrefour verification returned HTTP 403; the reviewed Osher Ad adapter uses authenticated FTP. Do not route around access controls. The scraper/parser packages have a custom noncommercial licence with attribution; retailer data rights are separate. Scanner D1 OCR missed Hebrew/mixed accuracy targets and has a worker cleanup limitation; receipt-photo OCR is not ready. Physical iPhone Scanner A/B testing is user-reported; do not label it independently instrumented QA. Some older general status documents lag recent commits: use Git and the latest checkpoint reports for current facts.

## 6. Development rules

- Work only in this worktree on `feature/spendscape-rebuild`; never alter `main`. Review, implementation, commit, push, provider connection and deployment are separate gates. A prior approval does not activate a later slice.
- Preserve `Globe · Capture · Purchases · Stats`, a single mounted MapLibre instance, one pin per physical place, and the canonical snapshot/derived-state boundary.
- Do not infer financial facts, currency, location, product equivalence or freshness. GPS is evidence, not purchase proof. Keep user purchase data, search text, receipt images and exact device location out of logs, URLs/history and price-source artifacts. Only explicitly reviewed purchases and Inbox decisions may enter the bounded local IndexedDB store; drafts, images, search and navigation remain ephemeral.
- Validate untrusted XML/HTTP input strictly; preserve source hashes/timestamps and quarantine bad files. Never turn conditional promotions into unconditional savings or treat a new fetch as a new publication.
- Keep secrets and raw retailer data out of Git. Preserve unrelated/generated changes such as `next-env.d.ts`; check the exact file manifest, `git diff --check`, relevant type/unit/browser or offline tests, branch/remote refs and server cleanup before reporting completion. Never claim tests that were not run.
- Next.js 16 has local version-specific documentation in `node_modules/next/dist/docs/`; consult it before changing framework code.

## 7. College product target and comparison data decision

The user clarified on 2026-09-24 that the destination is a **finished product for college**, with working end-to-end user flows, even though it is not intended for a market release. The current fixture-backed, session-only implementation is a checkpoint, not that final state. The user also fixed the nearby-price comparison scope to **Israeli stores and ILS only**; purchases elsewhere retain their existing multi-currency behavior and do not enter this comparison. Current retailer prices and an official `ItemPrice` field mapping are not acceptance requirements for the college submission. The comparison may use a small, internally consistent synthetic price set, with its prices and savings labelled illustrative. Do not label the whole product as a demo, present invented prices as current retailer facts, or treat the unresolved XML mapping as proved. The NP2G checkpoint review passed, but no current source-backed price pair or factual savings claim exists.

The user also clarified that the finished product must make receipt capture low effort: photographing a receipt with about 25 items should produce a reviewable itemized draft without typing every line. The existing camera/barcode path does not read receipt items, and Scanner D1 rejected the tested local Tesseract configuration for Hebrew/mixed receipt accuracy and cleanup. OCR or image-assisted extraction therefore remains a required capability to qualify for the college-product target, with provider/engine selection, privacy, cost and accuracy still undecided. A model's output is a proposal for review, never a factual source that can invent amounts or silently save a purchase. Product-photo identification likewise needs a separately validated path; barcode recognition alone is not photo understanding.

1. Plan one bounded synthetic Nearby Prices demo slice around the existing reviewed session purchase and eight-second Undo flow. Show a comparison only for explicitly matched products at one nearby demo store, with purchase context, comparison store, distance, matched-item count, and arithmetically correct illustrative savings. Suppress the card when its demo match conditions fail.
2. Implement and locally QA that slice only after its separate explicit authorization. Preserve the persistent globe, existing purchase ledger, English/Hebrew behavior, and no-pin rules. Keep demo prices out of the NP0–NP2G real-source qualification path.
3. Treat official XML field mapping and fresh retailer files as optional later decisions if factual comparisons become necessary. Decide persistence, hosting and other remaining product capabilities through separate scoped architecture and implementation gates; do not assume the present session-only prototype already satisfies the final-product target. Deployment and branch push retain separate approval gates.


## 8. Synthetic Nearby Comparison demo — local implementation, 2026-09-24

Authority: `APPROVE SPENDSCAPE SYNTHETIC NEARBY COMPARISON DEMO + LOCAL QA`.
Implementation and local QA only; no publication or follow-up source research.
The planning items in section 7 are historical: this bounded implementation is
complete and awaits a separate checkpoint review. No further slice is active.

### Result and data boundary

After explicit review/save of the built-in receipt, the existing eight-second
Undo expiry releases a purchase ID for comparison. No second timer is added.
The card appears in Capture success, or on the unobstructed Globe after leaving
Capture. Other purchase/detail/Ask/Inbox/Replay surfaces suppress its display.
Dismissal clears it and restores focus; a new addition clears the prior result.
Undo and Reset remove eligibility; reload returns the original fixture baseline.
Only records still present in the same session ledger qualify.

The checked-in `demo-prices.ts` fixture contains one fictional **Demo Grove
Market / מרקט החורשה — דמו** at invented coordinates [34.779, 32.078], and two
explicit demo product IDs from the built-in receipt. No NP0–NP2G artifact is
imported, copied or treated as a demo price. No live product match is implied.
The comparison location is never added to canonical places or the map source.
Distance uses the injected confirmed purchase place and Haversine arithmetic;
the default scenario is 629 metres straight-line, not a travel route or GPS.

The four-item receipt remains ILS 86.90. Two individually identified items are
compared: olive sourdough (18.50 vs 16.00) and whole sesame tahini (24.90 vs
21.90). Totals are **4340 vs 3790 minor ILS units**, a **550-unit illustrative
saving on 2/4 items only**. Tomatoes and seasonal fruit are not matched. All
savings arithmetic is integer minor-unit arithmetic; formatting converts only
at presentation. EN/HE copy explicitly labels prices and savings illustrative,
the store fictional, and partial coverage as not a whole-basket saving. The
item breakdown is available through an accessible disclosure.

Eligibility rejects nonreceipt/nonsynthetic/user-reviewed records, unsupported
currency, missing/unconfirmed/mismatched purchase place, distances outside 5 km,
missing identities, edited product labels, unsupported units/quantities,
invalid matched-line arithmetic, duplicate matched identities and nonpositive
savings. No text similarity, substitutions, inferred package equivalence or FX
conversion is used. Only the two fixed unit-item identities qualify; weighted
items and general address/product matching remain outside this demo.

### Files (11 total, unstaged)

- `src/features/capture/CaptureExperience.tsx`
- `src/features/capture/capture-domain.ts`
- `src/features/capture/session-purchase-domain.ts`
- `src/features/globe/SpendscapeGlobe.tsx`
- `src/features/nearby-demo/demo-prices.ts`
- `src/features/nearby-demo/comparison.ts`
- `src/features/nearby-demo/comparison.test.ts`
- `src/features/nearby-demo/NearbyDemoCard.tsx`
- `src/features/nearby-demo/NearbyDemoCard.module.css`
- `qa/spendscape-nearby-demo.spec.ts`
- `docs/AI_HANDOFF.md` (pre-existing untracked file, updated only as authorized)

### QA and limitations

- Focused comparison/Capture/session domain tests: **32/32 passed**.
- Full `npm test`: **189/189 passed in 15 files**.
- `npm run typecheck` and production `npm run build`: passed.
- Final combined production Chrome run: **11/11 passed in 38.6s**, no retries,
  skips or timeouts. Comparison suite: five new cases covering desktop EN,
  360×640 mobile HE/RTL/reduced motion, exact 7999/8000 ms boundary, shared
  Capture/external display, both Undo controls, Reset, dismissal and reload.
- Six existing timed-Undo regressions exercise expiry, shared countdown across
  navigation, newer-addition deadlines and reset at 360/390/1280 widths.
- Screenshots of expanded Capture and compact Globe cards were inspected at
  1280×844 EN and 360×640 HE. Evidence remains ignored under
  `artifacts/spendscape-nearby-demo/`; no physical iPhone QA is claimed.
- Browser assertions retain one MapLibre construction/instance, 12 pins,
  43 purchases after save, ILS 6864.28 total, and 42 purchases on Undo/reload.
  They observe no write requests, OCR/retailer/geocoder requests or persistent
  cookies/localStorage origins. This is bounded QA, not an exhaustive audit.
- Initial focused unit execution failed because the test runner did not resolve
  a new `@/` test import; corrected to the existing relative-import convention.
- Initial browser execution timed out after successful card assertions when
  reload ran with the test clock still paused. Resuming the test clock before
  reload fixes that harness error; no timeout or assertion was weakened. That
  initial run was interrupted during the second test (three not run), with
  interruption-related trace errors. It is not counted as a passing run.

Factual retailer currency qualification, fresh price data, OCR, GPS, backend,
database, providers, dependencies, deployment and physical device QA remain
outside this slice. The existing Vercel deployment is unchanged.

### Git and cleanup

Work remains on `feature/spendscape-rebuild` at
`f1184676d229663e2253f2884b08c55a556e7cbc`; local origin feature ref remains
`66fb4204154c88789e9e0401e317f9000b6b5e18` (ahead 1, behind 0; no remote refresh).
main/origin-main remain `eee0d26b55e5061f87ac664938df0c195800b74f`.
Index remains empty. No commit, push, PR or deployment. Generated evidence is
ignored. The task-owned QA server was stopped after the final passing run.
`git diff --check` and new-file whitespace checks passed. next-env.d.ts retains its pre-task blob
`ce4e94a6b10f160ee021fe18939af160d2927dcf` and is excluded from the manifest.


### Bounded checkpoint correction — 2026-09-24

Authority: `APPROVE SPENDSCAPE SYNTHETIC NEARBY DEMO CHECKPOINT CORRECTION + LOCAL QA`.
Only the narrow-screen floating presentation and generated-file reconciliation
were corrected. The 11-file manifest above remains the complete intended
checkpoint; this correction changes `NearbyDemoCard.tsx`, its CSS module,
`qa/spendscape-nearby-demo.spec.ts`, and this handoff. Comparison prices,
identities, eligibility, ledger and Undo behavior are unchanged.

At widths up to 760px, the floating card has a compact summary with the
illustrative saving, fictional-store label/name, straight-line distance and
2-of-4/not-whole-basket limitation immediately visible. Receipt context and
item details remain in native keyboard-operable `details`/`summary`.
Capture retains its full comparison presentation, as does desktop.

Fresh correction checks:
- Typecheck passed; focused comparison/Capture/session unit tests **32/32**
  passed across three files; production build passed.
- Focused production Chromium suite **10/10 passed in 30.3s**, no retries,
  failures or timeouts. Seven save/expiry/layout cases cover 360×640,
  390×844 and 430×932 in EN and HE/RTL, plus 1280×844 desktop EN.
  Three additional cases cover both Undo controls and leave/expiry/Reset.
- Keyboard Enter/Space opens/closes the disclosure. The full card fits the
  viewport, no document horizontal overflow occurs, and mobile collapsed
  height is at most 200px. Actual heights: 170.70px at 360 EN; 155.19px at
  360 HE and both languages at 390/430. Desktop remains 299.03px.
- Actual screenshots inspected under ignored
  `artifacts/spendscape-nearby-demo/correction/`: `globe-360-en.png`,
  `globe-360-he.png`, `globe-390-en.png`, `globe-390-he.png`,
  `globe-430-en.png`, `globe-430-he.png`, `globe-1280-en.png`,
  `globe-expanded-360-he.png`, and `capture-360-he.png`.
  The globe remains the primary visible mobile surface with details closed;
  opening details deliberately occupies more space and allows card scrolling.
- Existing assertions still pass for exact 7999/8000ms expiry, one map instance
  and construction, 12 pins, 43 purchases/ILS 6864.28 after save, baseline 42
  after Undo/reload, no write or OCR/retailer/geocoder requests, and no cookies
  or localStorage origins. No physical-device claim or wider QA is made.

Generated-file reconciliation: at correction entry, `next-env.d.ts` differed
only in the two imports pointing to `.next/dev/types/` instead of `.next/types/`.
Its entry blob was `a419cbe4e3a5e8d4b481b851dbf4ac767de069e6`.
No running Next/dev/build/Playwright process or port-3000 listener existed then;
the prior writer cannot be identified from this evidence. The paths match
Next development generation, not an unrelated source edit. The retained
`artifacts/spendscape-nearby-demo/next-env.before` matches the HEAD blob
`ce4e94a6b10f160ee021fe18939af160d2927dcf`. This correction's production build
itself regenerated exactly those pre-task bytes; no manual overwrite was
needed. Final checks after stopping QA confirm byte equality with the backup
and HEAD, no generated-file Git diff, and no active writer found. Earlier
cleanup statements describe their original check, not proof that the file
could not subsequently be regenerated.

The task-owned production server (PID 23737) was terminated. Final Git state:
branch `feature/spendscape-rebuild`, HEAD
`f1184676d229663e2253f2884b08c55a556e7cbc`; origin feature tracking ref
`66fb4204154c88789e9e0401e317f9000b6b5e18`, ahead 1/behind 0 (not refreshed).
Both main refs remain `eee0d26b55e5061f87ac664938df0c195800b74f`.
Index empty; intended 11 files remain unstaged, including the pre-existing
untracked handoff. `next-env.d.ts` and ignored QA evidence are excluded.
Whitespace checks passed. No commit, push, PR, deployment, dependency or
provider change. Stop after this correction and local QA report.


## 9. College P1 — local purchase persistence and privacy, 2026-09-25

Authority: `APPROVE SPENDSCAPE COLLEGE P1 — LOCAL PURCHASE PERSISTENCE + PRIVACY + LOCAL QA`.

P1 supersedes the older reload-reset behavior recorded in sections 7–8:
reviewed purchases and Inbox decisions now survive reload in this browser.
The original fixture graph remains unchanged. Successful writes commit before
the UI reports success; Undo persists removal, and an explicit confirmed
privacy action deletes all local additions and decisions. Reload creates no
new Undo/comparison window. Cross-tab revision checks prevent stale writes.

See [COLLEGE_P1_CHECKPOINT.md](spendscape/COLLEGE_P1_CHECKPOINT.md) for the
implementation, privacy boundary, exact QA evidence, limitations and manifest.
This checkpoint passed re-review and was committed locally at `399fce8` on
2026-09-26; it does not mean the finished college product is complete. The required receipt-photo-to-itemized-
draft journey in section 7 remains separately gated; D1's negative result is
unchanged. No backend, provider, dependency, push or deployment was added.


### P1 bounded review correction

The independent P1 review found two Medium defects: capacity rejection was
misreported as invalid existing data, and late saves overwrote newer Back
navigation. The separately approved correction now distinguishes prospective
capacity rejection from persisted corruption and invalidates obsolete Capture
view completions while retaining exactly-once durable save. Existing purchases
remain accessible at capacity; the draft is retained, with EN/HE feedback.
The checkpoint report records focused QA and the unchanged 17-file manifest.
The separate re-review passed: 199/199 unit tests, 32/32 combined production
browser tests, typecheck/build and whitespace checks. Its separate commit approval
was consumed by `399fce8`; push/deployment remain gated. Physical iPhone
persistence and power-loss durability are not established.


## 10. College P2A — offline receipt benchmark, 2026-09-26

Approved foundation completed in `qa/receipt-p2a/`: four fictional PNG receipts
with exact structured truth/hashes, including 25 mixed Hebrew/English items,
repeats, quantities, discounts and an intentionally unreadable name. The offline
evaluator checks per-row facts, arithmetic, omissions and correction burden.
Constructed controls are evaluator evidence only: **zero OCR/model runs**.
See [COLLEGE_P2A_RECEIPT_BENCHMARK.md](spendscape/COLLEGE_P2A_RECEIPT_BENCHMARK.md)
for commands, measured controls, acceptance targets and the mobile state spec.
D1's negative recommendation remains. P1 has no explicit discount representation;
a later reviewed integration must resolve that without silently rewriting prices.
No consumer UI, IndexedDB schema, dependency, provider, account or deployment change.
The finished-product receipt-photo goal in section 7 remains unmet.

Next single approval: `APPROVE SPENDSCAPE COLLEGE P2B — BOUNDED SYNTHETIC RECEIPT PROVIDER BENCHMARK READINESS`.
This selects/verifies a concrete provider/model, privacy terms and hard budget
for at most 12 synthetic calls; it does not itself authorize calls, credentials
or billing. No provider is currently selected. Google AI Pro is not API authority.

### P2B execution preparation

The user separately authorized Gemini `gemini-3.8-flash`, maximum 12 synthetic
calls, Free tier only, $0, and reported an unbilled Free project with 5 RPM /
250K TPM / 20 RPD. Key remains in the user's terminal; never request it in chat.
`qa/receipt-p2b/` now contains the bounded runner and mock tests; 17 combined
P2A/P2B offline tests passed. **Codex made no live API calls; the user subsequently launched the runner.**
The run stopped at 3/12 (two scored responses, then HTTP 503). Read its README and inspect
ignored `artifacts/receipt-p2b-run/` before any continuation; never rerun or
remove the journal to reset the 12-call allowance. No model result or promotion
is claimed. Billing status is user-reported, not independently API-verified.


### P2B partial live result — stopped at 3/12

User-run attempts 1/2 scored 6/6 exact rows each (English 4.257 s, Hebrew
22.392 s, zero correction fields). Attempt 3, mixed 25-item receipt, returned
HTTP 503 after 15.604 s; no extraction result. Offline rescoring matched stored
scores. Nine slots remain, with the failed third slot permanently consumed.
No rerun, journal reset or automatic retry is authorized at this stop.
See [COLLEGE_P2B_PARTIAL_RESULTS.md](spendscape/COLLEGE_P2B_PARTIAL_RESULTS.md).
Long-receipt accuracy and repeated/degraded behavior remain unproved; no model
promotion or integration. Preserve ignored run evidence before any recovery.

The user subsequently approved the remaining-nine recovery. The runner's
`--resume-after-3 --free-tier-confirmed` preserves slots 1–3 and appends at most
4–12 once, guarded by a permanent exclusive recovery lock. 20 offline/mock tests
pass; no live recovery call made during preparation. User terminal execution is
pending. Inspect actual journal/summary before reporting current call count.


P2B recovery subsequently stopped at **5/12**: attempt 4 degraded 25-item
receipt scored in 26.787 s, attempt 5 returned HTTP 503 in 24.447 s. All
25 numeric rows and total match; unreadable name correctly unresolved. The
24 readable labels differ only in word order (same token multisets), so strict
25-line correction burden is not proof of 25 actual user edits. Original scorer
and scores remain intact. Seven slots unused; no further rerun authorized.
The subsequently approved offline review and diagnostic correction are complete.
The supplementary `reviewed-two-run-labels-v1` metric recognizes the 24 intact
Hebrew/Latin run exchanges on the reviewed corpus only, leaving one unreadable
name for review. Strict scores remain unchanged (1/25 exact, 25 correction
fields); these counts are not measured human editing effort. All three saved
successes were rescored offline with exact original-score equality; 42/42
offline/mock tests passed. No additional calls, app changes or promotion. The
26.787-second long result and two 503 failures remain unresolved. Preserve the
consumed recovery lock and journal. See the partial-results report for evidence
and limits. At that point, the correction awaited separate checkpoint review;
the later review and local commit are recorded below.


The complete P2A/P2B review subsequently found that offline runner tests depended
on the pre-commit HEAD and empty index. The separately authorized correction
separates Git-independent fixture/request preparation from the unchanged live
Git gate. Fresh offline/mock QA is **44/44 passed**, including Git/network-forbidden
offline execution and wrong-branch/HEAD/staged-index rejection. The 21-file
package passed complete checkpoint re-review and was committed locally as
`1bbd50e`. Still stopped at 5/12 calls; no additional provider execution,
integration, push or deployment.

## 11. College P2C — reviewed line discounts (2026-09-27)

The separately approved P2C implementation is complete locally, awaiting its
checkpoint review. This section supersedes earlier version-1/current-gate
statements above; the Architect's pre-task status reconciliation is preserved.
Gross unit price, explicit whole-line `discountMinor` and net line total remain
separate facts through review, detail and IndexedDB. Integer arithmetic rejects
unresolved/invalid discounts; absent and explicit zero retain old totals and
duplicate meaning. Nearby illustrative savings use the discounted paid amount.

The envelope is now version 2 (IndexedDB database version still 1). Strict v1
hydration changes only the in-memory envelope tag; existing records/decisions
are not written until a successful explicit transaction. Revision conflicts,
failed-write preservation, durable eight-second Undo and unknown-version
rejection remain. No OCR/provider integration or calls; P2B stays at 5/12 and
D1's negative recommendation stands. Receipt extraction remains separately gated.

See [COLLEGE_P2C_CHECKPOINT.md](spendscape/COLLEGE_P2C_CHECKPOINT.md) for the exact
13-file manifest, measured QA, corrected viewport/error-banner findings and
physical-device limits. The finished college-product goal remains separate from
the illustrative-price feature. No commit, push or deployment is authorized.
Next: `APPROVE SPENDSCAPE COLLEGE P2C CHECKPOINT REVIEW`.

Final P2C QA: typecheck/build passed, 210/210 unit tests, 41/41 combined
P2C/P1/comparison/boundary production-browser tests and 19/19 neighboring
Capture/Scanner tests. The QA server is stopped; next-env equals entry/HEAD.
HEAD remains `1bbd50e`, protected main refs `eee0d26`, local cached origin
feature `66fb420` (ahead 4, behind 0; no refresh). Empty index; 11 modified and
2 new intended files, with ignored artifacts excluded.

The subsequent P2C checkpoint review found a Medium visibility defect despite
9/9 focused browser tests passing: storage failure feedback was below the
visible scroll area after the global banner was suppressed. The separately
approved bounded correction now reveals the inline message after every failed
save, including repeated failures, and restores focus lost to the transaction
inert lock without taking focus from a newer target. Retry remains unobstructed.
Four EN/HE mobile/desktop regressions check actual clipping, keyboard retry,
unchanged data and successful save/Undo. No storage, arithmetic or provider
scope changed. This supersedes the prior implementation's ready-for-review
statement only with the corrected result; a new P2C review remains the gate.

Correction QA completed: final build/typecheck, 210/210 unit tests, 4/4 focused
visibility/focus cases, then a fresh combined P2C/P1 run **31/31 passed**. Four
initial focus failures are documented in the checkpoint. All four EN/HE
mobile/desktop correction screenshots were inspected. Server stopped;
next-env, HEAD and protected refs unchanged; index empty; same 13-file manifest.
Next: `APPROVE SPENDSCAPE COLLEGE P2C CHECKPOINT REVIEW`. No commit/push/deploy.

The bounded P2C correction passed its subsequent checkpoint re-review and was
committed locally as `6d38402`. The 13-file checkpoint and no-provider boundary
remain unchanged. No push or deployment followed; receipt-photo extraction and
the complete Universal Scanner journey remain unfinished.

## 12. College P2D — offline next-candidate preparation, 2026-09-27

P2C is committed at `6d38402`. Separately authorized P2D preparation selects
`gemini-3.1-flash-lite` as an unqualified latency-oriented candidate; official
image/structured-output/free-tier evidence and caveats are in
`docs/spendscape/COLLEGE_P2D_RECEIPT_CANDIDATE.md`. Four P2A images, truth, strict
scoring and original thresholds are unchanged. P2D freezes its own requests
and reserves no live attempts yet: **0/12 calls**. P2B remains stopped at 5/12;
its responses, hashes, journal and consumed recovery lock are unchanged.

The isolated mock executor enforces 12 maximum attempts, 61-second pacing,
30-second timeout, durable exclusive reservation and stop-on-error; CLI live
execution is locked pending separate activation and user verification of the
candidate's access/quotas on an unbilled Free project. No key was requested.
Final offline network-guarded suite: **55/55 passed**; freeze/whitespace checks
passed. No extraction success, API compatibility or physical-device result is
claimed. No consumer UI/storage/dependency change, build, server or live call.

Seven-file manifest and evidence are in the P2D record. Architect's entry edits
are preserved verbatim. HEAD/main/upstream unchanged, index empty, ahead 5 /
behind 0 against cached origin feature; next-env equals HEAD; artifacts ignored.
No commit/push/deploy. Next approval is the exact P2D synthetic benchmark
activation token in that record, conditional on account checks. Receipt Capture
integration remains separately gated; no other implementation slice is active.

P2D activation was subsequently explicitly authorized (max 12, Free only, $0).
The CLI is now activated with mandatory Free/no-billing/model-quota confirmations
and environment-only key handling; preparation-stage locked-CLI text above is
historical. Fresh network-guarded offline QA: **57/57 passed**. Frozen requests
and policy unchanged; only the activation runner hash renewed. Live execution
is pending user verification of this candidate's account access/quotas: **0/12**,
no live reservation. Do not run until confirmed; never rerun after an attempt
error. Instructions and fixed command are in the P2D record. Git unchanged.

P2D user confirmed the project Free/no billing and candidate quota 15 RPM /
250K TPM / 500 RPD. Initial invocation failed before any reservation because
the local key filter excluded periods. Bounded filter correction permits periods
unchanged and retains whitespace/control rejection; **58/58 offline tests pass**.
No key inspected, no API call, no P2D reservation (0/12). Requests/policy/P2B
unchanged; runner hash refreshed. User alone will run the approved command.


### P2D locked attempt and offline compatibility review

Safe journal now verifies **1/12 consumed**, English-6, HTTP 400 in 476 ms;
no extraction scored and no error body retained. Earlier 0/12 statements are
historical. The remaining 11 attempts are unused and not authorized for recovery.
Original reservation/journal/summary and all frozen requests remain unchanged.

Offline review found `unit` uses `type: [string, null]` with
`enum: [item, kg, null]`. Google's structured-output guide documents nullable
types and string/numeric enums, but not null-valued enums. This is a plausible
compatibility issue, not a proven cause; the raw JSON-schema route is distinct
from Google's typed OpenAPI Schema, whose enum field is string-only.
Also, the REST reference specifies APPLICATION_JSON for responseFormat.text.mimeType
and LOW for thinkingLevel, whereas guide examples use application/json and low.
The frozen payload follows those guide examples; this official-document conflict
prevents claiming a confirmed runtime rejection from inspection alone.
References: https://ai.google.dev/api/generate-content and
https://ai.google.dev/gemini-api/docs/generate-content/structured-output .

Proposed only: a P2D-local schema clone with unit anyOf(string enum item/kg,
null type), plus canonical REST enum spellings APPLICATION_JSON and LOW. Preserve
P2B's shared schema, all factual validation and original criteria. Before any
separately approved recovery, freeze a distinct revision and prove semantic
parity, request isolation and aggregate <=12 attempts with immutable attempt 1
and an exclusive recovery lock. No code/schema/manifest correction was made.
Four current request hashes verified offline; tests for the proposed correction
remain future work. No key access, API call, provider change, commit/push/deploy.

### P2D isolated unit-anyOf candidate — offline preparation

The latest user instruction supersedes the proposed casing changes above:
only nullable unit representation changes. Four new files under
`qa/receipt-p2d/unit-anyof/` contain an isolated cloned request/schema, candidate
freeze, six focused tests and README. `application/json` and `low` are retained.
Original P2D/P2B requests, original freeze, reservation, journal and attempt-1
evidence remain byte-identical. Candidate request/schema hashes are distinct;
prompt/images/evaluator/thresholds unchanged. Focused 6/6 and combined 64/64
network-guarded offline tests passed. No key access or API calls; no recovery
runner activated. Candidate remains unproven; 1/12 consumed, 11 unused and locked.
Separate bounded recovery authorization is still required. No commit/push/deploy.

### P2D recovery foundation — offline only

Separate `unit-anyof/recovery.mjs` verifies the frozen candidate and original
HTTP-400 evidence before exclusive durable recovery reservation; mock runs
number attempts 2–12 (Hebrew-6 first), maximum 11 additional, stop on error.
Original evidence and candidate files are byte-identical. No environment/key
access or default transport; CLI live execution remains disabled. Focused 10/10
and combined 74/74 guarded offline tests passed. Three new recovery files plus
this appended status are the task diff; see `unit-anyof/RECOVERY.md` for checks
and exact future approval. Real state remains locked 1/12, 11 unused; no real
recovery lock created, no API call, commit, push or deployment.

P2D unit-anyOf recovery activation has now received explicit user approval.
CLI is activated for the fixed recovery directory with mandatory Free/no-billing/
model-quota confirmations and Git/frozen-evidence checks. User-terminal execution
only; no agent key access or live call. Combined offline QA 75/75 passed; no
recovery reservation exists yet. Original/candidate freezes and attempt 1 are
unchanged: 1/12 consumed, 11 unused. Stop on any recovery error; do not rerun.

### P2D diagnostic preparation — verified 2/12, 2026-09-28

Safe original/recovery journals now verify two consumed attempts: English-6
HTTP 400/476 ms, then unit-anyOf Hebrew-6 HTTP 400/574 ms. Ten unused; both
reservations locked. Earlier 1/12 statements are historical. Neither scored;
discarded error bodies prevent identifying the cause. No Gemini rerun authorized.

Offline-only `qa/receipt-p2d/diagnostic/` adds a response consumer, nine mock tests
and plan. Capture is capped at 64 KiB/1 s and emits only allowlisted codes/reasons
and fixed field-name hints, never provider message text, metadata or input.
No transport/key access/persistence/live CLI. Focused 9/9, combined 84/84 guarded
tests passed. Original requests, freezes and both evidence sets unchanged.
One future diagnostic call requires separate authorization and a tested one-shot
adapter (global attempt 3, no retry). If no actionable cause results, stop Gemini
retries and propose a separately bounded Free-tier comparison. No provider change,
API call, commit/push/deploy here. See diagnostic/README.md for the exact plan.

P2D one-shot diagnostic adapter is now prepared offline only: attempt.mjs and
its separate freeze/tests/ATTEMPT.md verify both locked evidence sets and reserve
only global attempt 3 in a new fixed location. Same unit-anyOf Hebrew-6 request;
no retry/attempt 4, key access or native transport. Errors use the reviewed bounded
allowlist; success retains only strict evaluation metrics, never receipt content.
Final focused 10/10 and combined 94/94 offline tests passed. All previous source/
evidence unchanged. No real diagnostic reservation: still 2/12 consumed, 10
unused. Exact separate activation/one-call approval is in diagnostic/ATTEMPT.md.
No commit/push/deploy; both prior locks remain intact.

The separate P2D diagnostic attempt-3 activation/live-call approval was received.
New diagnostic/live.mjs binds the reviewed one-shot adapter and fixed location,
with Free/no-billing/quota/key/Git checks; new mock activation test included.
95/95 guarded offline tests passed. No key accessed or live call by the agent;
user-terminal command only. Original evidence/freezes and offline adapter unchanged.
No diagnostic reservation yet: 2 consumed, 10 unused; never continue to attempt 4.

The user-run diagnostic attempt 3 subsequently returned HTTP 400 / INVALID_ARGUMENT
after 61.488 seconds including the required 61-second wait. Its allowlisted
diagnostic has no reason or field hint; no extraction was scored. The safe
attempt-3 journal and summary confirm **3/12 consumed, 9 unused**. All three
reservations remain locked. Earlier 2/12 statements are historical. Per the
agreed decision rule, stop Gemini retries; no attempt 4 is authorized. The next
bounded task is documentation-only assessment of one alternative Free-tier
candidate, with no provider calls, account changes or billing activation.

Documentation-only non-Gemini assessment completed: Groq `qwen/qwen3.8-27b`
has documented vision/strict-schema support and a Free plan, but our Hebrew
receipt accuracy and existing user-account entitlement/quota are unverified.
Not cleared for execution or account creation. Single next gate: user-reported
existing Groq Free-account/model/quota readiness, without keys or settings changes.
See `docs/spendscape/COLLEGE_RECEIPT_NON_GEMINI_ASSESSMENT.md`. P2D remains stopped
at 3 consumed / 9 unused, all locks preserved; no Gemini retry or live call.

The user subsequently reports Groq Free, no added payment method, model access,
and displayed limits 30 RPM / 1,000 RPD / 8,000 TPM / 200,000 TPD. This is
user-reported account evidence. Benchmark readiness remains open because the
complete 25-line receipt request plus safe output allowance has not been shown
to fit the 8,000 TPM limit; an account-specific input/output split may also
apply. Next gate: offline token-budget and request-compatibility analysis only.
No runner, credentials, provider call, billing change or P2D retry is authorized.

Groq offline token-budget analysis completed; see
`docs/spendscape/COLLEGE_GROQ_TOKEN_BUDGET.md`. Full 25-row compact output is
3,580 UTF-8 bytes (5,470 pretty); conservative input + 20%-margin output
scenario is 8,436 tokens, versus 7,518 with more efficient input tokenization.
These are byte-based proxies, not provider counts. Verdict: inconclusive; no
safe 8,000-TPM bound established. TPM hover split, concurrent usage and official
reservation accounting remain unresolved. No runner/live clearance, field or
threshold reduction. User-reported Free/no-payment/model quotas retained; P2D
remains locked at 3/12 with all evidence unchanged.

Groq mixed-25 one-shot pilot prepared offline in `qa/receipt-groq-pilot/`.
Experimental 3,840 output cap, strict schema, explicit non-thinking; complete
frozen image/prompt/fields/evaluator unchanged. Separate exclusive durable
reservation, injected mock transport only, no live CLI or key access. Final
network-guarded tests 33/33 passed (9 pilot + 24 evaluator/numeric). Request hash
and dependencies frozen; README records limits, exact manifest and separate
one-call activation token. Offline preparation is reviewable, but admission and
extraction quality remain unproven; 8K TPM split/accounting/concurrency unresolved.
No real Groq reservation/call; P2D remains locked at 3/12. No commit/push/deploy.

The exact Groq one-shot activation/one-call approval was received. New
`qa/receipt-groq-pilot/live.mjs` binds the unchanged frozen mixed-25 request and
fixed reservation with Free/no-billing/model confirmations, secure user-terminal
key handling, pinned freeze and Git checks. New mock activation test; combined
network-guarded suite **34/34 passed**. No agent credential access, real reservation
or live call. User-terminal execution pending; never rerun after reservation.
Request cap remains experimental 3,840; P2D still locked at 3/12. No commit/push/deploy.

The user-run Groq pilot is now consumed. Its retained safe summary reports
quality-fail in 4.536 seconds: all 25 rows, no omissions/extra rows, numeric and
sum checks pass, 0/24 readable labels match, headers are not exact, and 25 lines /
26 fields require correction. The request was admitted and returned a valid
complete extraction; this is not proof of repeatable quota headroom or accepted
quality. The pilot core retained only aggregate metrics, not extracted labels,
header values or the provider response, so actual mismatches cannot be recovered
from these artifacts. Preserve the consumed Groq reservation; no rerun or model
promotion. Next bounded task: offline evaluator/adapter compatibility and
evidence-sufficiency review, with no calls or relaxed criteria. P2D stays 3/12.

Consumed Groq pilot offline review: retained summary confirms quality-fail at
4,536 ms, 0/24 readable labels strict-exact, numeric evidence exact, one header
mismatch (merchant/date/currency), 25 correction lines / 26 fields. No adapter
mapping defect found. Ten fresh synthetic adapter controls plus three Unicode/
missing-key assertions passed; existing guarded suite 44/44. Run swaps can produce
the same pattern, but actual cause cannot be reconstructed from discarded output.
Original score is unchanged; no Groq retry. See COLLEGE_GROQ_PILOT_REVIEW.md for
evidence limits and proposed allowlisted row/header diagnostic metadata. Next
gate: offline-only diagnostic metadata preparation + mock QA, separately approved.
Groq reservation consumed; P2D remains locked at 3/12; no provider call or commit.

Groq diagnostic metadata prepared offline in `qa/receipt-groq-diagnostics/`:
pure fixed mixed-25 projection, expected IDs/allowlisted field names/five boolean
label flags only. Revalidates score correspondence; no verdict changes, text
retention, logging, runner or pilot/live wiring. Saved focused controls plus
existing evaluator/label tests passed 29/29. Consumed summary/reservation and all
29 frozen dependencies unchanged; P2D 3/12 and Groq one consumed remain locked.
Next gate: separate offline diagnostic-metadata checkpoint review, not a live call.

Architect's bounded metadata checkpoint review passed: 29/29 tests rerun under
the network guard, all 29 frozen dependency hashes and both consumed Groq
evidence hashes matched, whitespace check passed. No actionable defect found
in this slice. Next proposed task is offline-only wiring into a separately
reserved one-shot diagnostic adapter with the unchanged request and strict
score; no live activation or additional call is authorized by this review.

Separate Groq one-shot diagnostic adapter prepared offline in
`qa/receipt-groq-diagnostic-one/`; additive reviewed metadata only after validated
extraction and unchanged strict evaluation. Exact original mixed-25 request hash
preserved (e9fd9818…5a668b), experimental cap 3,840; no native transport/key access
or live CLI. New exclusive Groq-attempt-2 reservation remains absent. Final guarded
suite 36/36 passed, including original quality parity and late-response/body-timeout
privacy. Original pilot/evidence and P2D remain unchanged/locked. README records
manifest, freeze and separate one-call activation token; no live approval consumed.

Groq diagnostic one-call activation explicitly approved. Added separate
`qa/receipt-groq-diagnostic-one/live.mjs` and mock activation test; fixed endpoint,
reservation, original request and pinned freeze, with Free/no-billing/quota/Git
checks. Guarded suite 37/37 passed. Agent accessed no key and made no provider
call; new diagnostic reservation absent, user-terminal execution pending.
Original Groq pilot remains consumed and P2D locked at 3/12. Never rerun after
reservation. No request/score/evidence change, commit, push or deployment.

2026-09-29 user scope correction: prioritize a usable college receipt scanner
with 10–15 items rather than treating 25-item qualification as the immediate
release gate. Choose 15 items for a separately versioned representative fixture;
retain all historical 25-item fixtures, scores, freezes and locks unchanged.
This scope change does not authorize provider calls, billing or activation of
the old mixed-25 command. Next task: prepare the new 15-item fixture and offline
acceptance evidence. GitHub's current official docs state GitHub Models retired
on 2026-07-30 (https://docs.github.com/en/github-models). Cloud Vision offers OCR
and a monthly free allowance but its setup requires enabled Cloud billing;
no such billing change is authorized by this user message. OCR text/layout must
still be mapped into validated receipt fields and explicit user review.

Submission deadline supplied by the user: **2026-10-16**. On 2026-09-29 there
are 17 calendar days remaining. Prioritize the user-approved 10–15-item
receipt-photo -> reviewed draft -> persisted purchase journey, then final
integration/device QA, separately approved deployment and presentation rehearsal.
The 15-item fixture is not yet present in this inspected worktree. Receipt
provider extraction is not qualified or integrated into Capture. Current local
frontend/persistence work must not be described as the deployed version without
verifying its release. A recommended milestone is a viable extraction path by
2026-10-02; unresolved failure then requires an explicit scope/provider decision,
not further open-ended diagnostic cycles. Planning dates are targets, not
guarantees or authorization for implementation, calls, billing or deployment.

## Architect status review — 2026-10-04

Read-only review covered the 52 first-party Markdown files inventoried in the
repository root, docs/, qa/ and .agents/skills/, plus the separate ignored
real-receipt harness and its retained summaries. Installed dependency and
generated artifact documentation are not part of this inventory. Source and
Git, rather than stale status paragraphs, establish the current implementation.
No fresh application tests, build, browser QA or provider calls were performed.

The separate cropped one-item real-receipt test has two consumed attempts with
the same request hash: attempt 1 returned HTTP 429 after 226 ms; attempt 2
returned extraction-fail after 1,521 ms. Nine of eleven checks passed. Date and
item line amount failed. Local inspection of the cropped image corroborated the
reference date and line amount; the actual extracted values were discarded, so
the cause cannot be reconstructed. Merchant/product labels are present but
unscored. core.mjs deliberately returns fullSuccess:false even for perfect
numeric/date checks. This is a test limitation, not an additional observed
extraction error. Both reservations remain consumed; no retry is authorized.
Historical Gemini/Groq synthetic experiments retain their independent budgets,
scores and locks. This real-receipt experiment does not qualify a provider.

Verified product state:
- Phase 1 and bounded Phase 2A.1 are completed foundations. Full original
  backend/authentication Phase 2 is not implemented; the college path instead
  uses native IndexedDB under College P1, with P2C discounts/envelope v2.
- Camera preview and local barcode decoding exist; receipt/product/document
  source demos remain synthetic. There is no application receipt-provider
  endpoint or photo-to-extraction-to-review integration.
- The original Phase 3 Universal Scanner is partially represented by camera,
  barcode and explicit review/save; real receipt/photo/PDF/CSV/Gmail ingestion
  is incomplete. General matching/fusion/FX, real AI actions and sharing remain
  later original-roadmap work, not completed by synthetic UI counterparts.
- Nearby comparison accepts only the eligible built-in synthetic receipt.
  Actual reviewed receipt additions are excluded. NP2 cross-retailer proof was
  not completed; the user-approved illustrative comparison is a separate path.
- The original deployment record covers Scanner B. No current hosted-version
  verification or final college release acceptance is established by this review.
- General authority/status documents still contain historical pre-College-P1
  statements. Preserve their product rules, but do not replay consumed gates or
  present those status paragraphs as current facts.

Recommended single next implementation slice (not activated by this review):
an offline provider-neutral extraction-to-editable-review bridge, exercised with
a separately versioned 15-item mock fixture. Preserve observed line amounts
separately from calculated amounts, mark discrepancies/nulls, require explicit
resolution before save, and reuse the existing durable save/Undo boundary.
Do not invent time, unit, merchant/place IDs or product matches. Mock evidence
does not qualify live extraction. Acquisition and approved server transport are
subsequent integration work; no new provider experiment is authorized here.

Remaining college delivery order: reviewed receipt flow and bounded extraction
evidence; price-comparison integration for explicitly matched reviewed items;
agreed disposition of still-synthetic/deferred visible capabilities; final
EN/HE mobile/physical-device integration QA; separately approved publication
and presentation rehearsal. On 2026-10-04, 12 calendar days remain to submission.
This is a proposed delivery order, not a promise to finish the full master vision.

Git at review: feature/spendscape-rebuild, HEAD 6d384029cf6ad83c0f55537650d35b0bed6a4b12,
ahead 5 / behind 0 relative to the cached upstream (not refreshed). Both main
refs remain eee0d26b55e5061f87ac664938df0c195800b74f. Existing uncommitted
benchmark work and the bounded legacy cleanup remain present and preserved.
This review appends only this handoff; no commit, push or deployment.

## Cloud Vision bounded recovery — 2026-10-04

Original Vision attempt 1 is consumed: HTTP 403 after 1,200ms, unchanged request
hash d1a4c4f…71fc9f4b, no OCR result. Missing billing remains a possible cause,
not a diagnosis; the error body was discarded. Both retained files and all
historical Gemini/Groq/Vision evidence are preserved.

The interrupted recovery had three partial source files, unresolved readiness,
missing imports/freeze and no attempt-two reservation/result; it could not
dispatch through the supplied wrapper. Resume reused that work and completed
qa/receipt-vision-pilot/recovery/. The latest user-console reports establish
correct-project linkage to the existing active Free Trial, Vision API enabled
and authenticated gcloud for spendscape-receipt-benchmark. The user reports a
new billing account, no Vision use except our single 403 attempt, no other
users/projects and no concurrent use. Counting that call conservatively as one
unit gives >=999 remaining monthly free units; this is user-reported evidence,
not independently metered usage. The other project's Free Trial screenshot
alone was not linkage evidence. No paid upgrade or Gemini setting change.

Separate attempt-2 request/ready/source hashes are frozen; original crop,
profile, request and evaluator unchanged. Durable exclusive attempt-two
reservation, one additional OCR unit maximum, no retry/redirect/fallback,
30s deadline and ephemeral selected-field inspection preserved. Token remains
internal to user-executed gcloud authentication. Numeric/label quality is still
unproven; fullSuccess remains false pending label review.

Final guarded mock suite: 55/55 passed (15 recovery + 40 existing pilot/wrapper);
initial test-file syntax error fixed before passing runs. Actual local preflight
is checked without credentials/send/reservation. No application/build/browser
QA or integration. Latest user approval already authorizes exactly one
user-terminal recovery while the reported free-allowance/trial facts remain true;
no duplicate approval needed. Never rerun after attempt-two exists, even on
error or uncertain dispatch. User execution/result pending; no attempt 3.

Task manifest: six files in qa/receipt-vision-pilot/recovery/ (job.mjs,
wrapper.mjs, live.mjs, recovery.test.mjs, README.md, freeze.json), plus this
appended handoff record. Ignored local readiness/interruption/integrity records
remain outside source commits. Git: feature/spendscape-rebuild, HEAD e7f05f8;
main/origin-main eee0d26; cached upstream 66fb420. Index empty; next-env matches
HEAD. No staging, commit, fetch, push, deployment, resource/credential access or
agent provider call. Earlier handoff history and unrelated changes preserved.

### Consumed Cloud Vision recovery result — 2026-10-04

User-executed attempt 2 returned field-review-required in 1,477ms with the same
frozen request hash. Saved reservation/summary confirm consumption; both Vision
one-shot reservations now remain locked and no attempt 3 is authorized. The
service returned structured OCR annotation successfully; this is not receipt
extraction acceptance or proof of the first 403's cause. Reported timing includes
authentication/request/local evaluation, excludes user inspection, and is not an
isolated Google OCR latency measurement.

Within the frozen selected regions, quantity and printed line amount matched
exactly. Product-label text was present but has no verified label reference or
accuracy score. Date, unit price, payable total, pre-VAT, VAT amount and VAT rate
had no selected words and remained unresolved. Arithmetic checks were null,
fullSuccess false; no values were repaired and no purchase was created. The
selector requires full word-box containment. Aggregate evidence cannot establish
whether absent fields were absent from Google's entire transcription or omitted
by the local region/segmentation filter; provider content was deliberately not
retained. Do not characterize these as confirmed wrong numbers or a demonstrated
Vision recognition failure.

Original/recovery freezes, request/profile and historical retained evidence
hashes remain intact; no credentials/provider calls by Codex. Only this status
was appended; no source change, tests/build/server, stage/commit/push/deployment
or account action. Next proposed gate: offline field-region/segmentation and
evidence-sufficiency review only, not another provider call or application
integration. Previous pending-execution paragraph records pre-call history.


### Vision field-selection v2 offline candidate — 2026-10-04

Bounded correction prepared separately in qa/receipt-vision-pilot/selection-v2/;
not wired to any live wrapper or app. Local visual inspection found tight
original field regions and payable-total printing below its ROI. A separate
ignored version-2 profile preserves the crop hash/dimensions and reference facts.
Selection now permits bounded box crossings, uses unique geometric ownership,
and joins adjacent date/decimal fragments only with observed punctuation.
Missing separators, digit-to-digit splits, multiple candidates, oversized boxes,
neighboring identifiers and unsafe text remain unresolved. No expected-answer
selection, inferred characters or silent amount repair.

Fixed-name/count/boolean diagnostics distinguish no candidate, excluded geometry,
ambiguity, segmentation and parsing failures without retaining values/text or
coordinates. Unchanged original evaluator separates selected-stream OCR/CER,
interpretation and arithmetic; internal projection boxes are synthetic, not
provider evidence. Original ephemeral TTY/expiry controls reused. Labels remain
unscored/review-required and fullSuccess false. This is crop-specific geometry,
not general receipt extraction or product acceptance.

Final network-guarded suite: 80/80 passed, zero failures/skips (25 candidate +
55 original pilot/wrapper/recovery regressions). Initial candidate run 24/25
identified a missing-slash diagnostic classification issue; ordering corrected
without relaxing numeric acceptance. Synthetic mocks establish candidate
behavior only. Discarded attempt-2 provider output cannot be reconstructed or
rescored; no claim that the consumed result is fixed. Both Vision reservations
remain consumed/locked; Gemini/Groq history unchanged; no further call approved.

Exact task manifest: qa/receipt-vision-pilot/selection-v2/{select.mjs,
select.test.mjs,README.md,freeze.json}, plus this appended docs/AI_HANDOFF.md.
Ignored artifacts/receipt-vision-selection-v2/ contains candidate profile,
pre-task hashes and offline test output. Separate freeze records candidate and
preserved hashes; 53 pre-existing files remain byte-identical, including original
selector/profile/freezes/scores/reservations/results and next-env.d.ts. Original
crop unchanged. Existing unrelated dirty/untracked work preserved.

Git: feature/spendscape-rebuild, HEAD e7f05f80543623182a6cc5c8d49101dc9e75c421;
main/origin-main eee0d26b55e5061f87ac664938df0c195800b74f; cached upstream
66fb4204154c88789e9e0401e317f9000b6b5e18 (ahead 6 / behind 0; not refreshed).
Index empty, next-env matches HEAD. No application/dependency/generated edits,
build/browser/server, credential/provider/billing action, stage/commit/push or
deployment. Next gate: separate offline candidate checkpoint review; live wiring
or another provider call requires a later bounded authorization.

Architect selection-v2 checkpoint review, 2026-10-04: Pass within the offline
candidate scope; no actionable defect found. Fresh network-guarded combined
execution passed 80/80, with no skips or failures. All three hashed candidate
files, the separate v2 profile and all 53 preserved files matched the candidate
freeze. Git whitespace check passed; index empty and protected refs unchanged.
This does not qualify provider accuracy or repair the consumed live result.
Recommended next gate: separately authorized selection-v2 one-call validation,
with a new attempt-3 wrapper/reservation, unchanged image/provider request and
at most one additional OCR unit after allowance/readiness confirmation. Prior
locks stay consumed. No live call or credential access occurred in this review.


### Vision selection-v2 one-call validation preparation — 2026-10-04

User authorized exactly one additional user-terminal Vision call (global
attempt 3, maximum one additional OCR unit) with the reviewed unchanged v2
selector/profile and original crop/request. Separate wrapper prepared under
qa/receipt-vision-pilot/selection-v2-validation/. No attempt-three reservation
or provider dispatch exists yet; no credentials accessed by Codex. Do not run
either consumed original wrapper; never remove/reset any reservation.

The user freshly reconfirmed exact project spendscape-receipt-benchmark,
linked active existing Free Trial, enabled Vision API, no billing-account Vision
use beyond our two attempts and no concurrent use. Conservatively counting both
leaves >=998 monthly free units, user-reported rather than independently metered.
Google's official pricing/setup/data-use documentation rechecked. New separately
hashed readiness record; if readiness facts change or allowance is unknown, stop.
No paid upgrade, settings/resource change or Gemini/Groq call authorized.

Original provider request SHA-256 remains d1a4c4f560b6ef7f2e4a766e7c47ee3c3085ae1e51c9e95f22f24a3271fc9f4b:
one unchanged image, DOCUMENT_TEXT_DETECTION only. Fixed durable exclusive
artifacts/receipt-vision-pilot/attempt-three/ reservation precedes gcloud auth/
dispatch; any existing or incomplete directory consumes/blocks the attempt.
No retry, redirect, fallback or fourth call. 30s deadline including auth, 10s
per gcloud subprocess and 2MiB response limit preserved. Cancellation/late
results cannot send late credentials, open inspection or overwrite the result.
A dispatched call may still finish at Google after local cancellation; never
rerun uncertainty. Existing gcloud login/token helper is user-executed only.

Summary retains approved OCR/CER checks, separate interpretation/arithmetic and
safe v2 field/count/boolean selection diagnostics. No OCR/financial/label/payment
values or credentials persisted. Selected safe fields are ephemeral TTY-only,
cleared on close/expiry <=60s. Label remains independently unscored and requires
human review; fullSuccess false. authRequestEvaluationElapsedMs spans auth,
request/response and local selection/evaluation after reservation; excludes
preflight, human inspection and final persistence, not isolated OCR latency.
Even perfect one-receipt numeric results do not qualify 10–15-item/general support.

Final guarded offline suite 101/101 passed, zero failures/skips (21 wrapper +
80 preserved controls); no initial test failures. Credential-free actual local
preflight passed; no reservation/auth/send. All 61 pre-task protected source/
profile/evidence files remain byte-identical, including v2 freeze and both
consumed Vision results/locks; original reference facts/image preserved. Existing
MockTimers experimental warnings only. No application/build/browser/server QA.

Exact task manifest: qa/receipt-vision-pilot/selection-v2-validation/{job.mjs,
wrapper.mjs,live.mjs,validation.test.mjs,README.md,freeze.json}, plus this appended
handoff. Separate ignored artifacts/receipt-vision-selection-v2-validation/
contains before/readiness/test/integrity records, no receipt contents. Prior
handoff/Architect review and unrelated dirty/untracked work preserved.
Git remains feature/spendscape-rebuild at e7f05f80543623182a6cc5c8d49101dc9e75c421;
main/origin-main eee0d26b55e5061f87ac664938df0c195800b74f; cached upstream
66fb4204154c88789e9e0401e317f9000b6b5e18, ahead 6/behind 0, no fetch. Index
empty; next-env matches HEAD. No dependency/application/generated edits,
staging/commit/push/deployment or agent credential/provider/account action.
User execution pending; README contains exact command authorized by the latest
prompt, no duplicate approval needed. Stop after that single result, including
errors/timeouts; no continuation is authorized.


### Consumed Vision selection-v2 validation result — 2026-10-04

User-executed attempt 3 is consumed/locked. Retained reservation and summary
verified against the unchanged request hash d1a4c4f…71fc9f4b and reviewed v2
freeze. No fourth call or rerun authorized. Preparation's pending-execution
paragraph is historical; all three Vision reservations now remain consumed.
No agent credential access or provider call.

Result: field-review-required. Seven of eight checked date/numeric fields had
exact selected-stream transcription (zero CER edits) and exact interpretation:
date, quantity, unit price, line amount, payable total, VAT amount and VAT rate.
Weighted-line arithmetic passed. Pre-VAT remained unresolved: excluded-candidate,
two intersecting boxes, zero selected words, two excluded words; no ownership
conflict, privacy exclusion or segmentation failure reported. This establishes
local geometric exclusion, not that Google failed to recognize the value or
that either excluded box contained it. No raw response was retained, so the
precise box/character cause remains unknown.

Boundary-crossing selection was observed for date, VAT and VAT rate. VAT-rate
reconstruction joined two observed fragments and scored exactly. This validates
those v2 paths on this response; it cannot rescore or explain the discarded
attempt-2 response. Tax reconciliation remains null because pre-VAT is missing.
Product label selected three words, present but unscored; human label correctness
has not been reported. fullSuccess false; labelsNeedUserReview true. No missing
value inferred/repaired or purchase created. No 10–15-item/general receipt claim.

Elapsed 1,693ms includes authentication, request/response and local selection/
evaluation; excludes preflight, human inspection and final persistence, not
isolated OCR latency. All 63 pinned input/history/readiness files and five wrapper
files matched current validation freeze. Summary SHA-256:
a9343a32541fb9179ebf02971b92d86ee4df866d6411356551a70d7115f336c9.
Separate ignored consumed-result-integrity.json records safe checks/hashes only.
No selector/profile/request/freeze/result/lock changed. This turn appends only
this handoff plus that ignored integrity record; no tests/build/server needed.
Git refs/index/next-env and unrelated changes preserved; no commit/push/deploy,
resource/billing/account change. Next proposed gate: separately approved offline
pre-VAT selection/evidence review only, not another call or application wiring.

### Architect scope correction — college receipt core, 2026-10-04

Latest user decision: pre-VAT is not required by the college product. The
proposed pre-VAT selection review above is superseded; do not spend another
provider attempt on that field. VAT amount/rate may be optional metadata, not
core-save acceptance gates. Preserve all historical evaluator results, freezes,
consumed reservations and locks; attempt 3 remains field-review-required, not a
retroactively relabeled full pass.

Source check: PurchaseReviewInput/validateReview in session-purchase-domain.ts
contain no tax fields. Receipt saving currently needs final amount, currency,
date/time, item names, quantities, units and unit prices with explicit discounts
when applicable and reconciled line totals. Payment/category/channel also need
review context. Merchant IDs must exist in canonical context; a physical place
must match that merchant. Observed merchant/address text alone cannot create a
confirmed place or coordinates. Barcode identification is optional and must
pass the existing validation; missing codes must remain missing.

Attempt 3 established exact date, quantity, unit price, line amount and final
amount on this one-item crop. It did not qualify merchant/address extraction,
barcode identification, label accuracy, general layouts or 10–15-item receipts,
nor implement receipt OCR in Capture. The next proposed bounded Builder task is
an offline core receipt-to-review draft contract/adapter with mocked observations
and explicit unresolved fields. Consumer UI/provider wiring remains subsequent
work. A different cropped 10–15-item receipt would be useful for later validation;
no additional receipt upload/provider call is authorized by this planning turn.

Architect changed only this handoff append; no application or evidence edits,
credential access, provider call, commit, push, deployment or account change.


### College receipt-to-review core adapter — 2026-10-04

Latest bounded task complete offline in receipt-review-adapter.ts and its test.
Runtime-validated fictional observations preserve originals/alternatives alongside
editable review fields; no merchant/place/time/unit/price/discount inference.
Printed line amounts remain separate and must match integer calculated nets
before whitelisted PurchaseReviewInput projection. Pre-VAT/VAT/rate and barcodes
are optional; no historical evaluator/score/freeze/lock changed. Missing required
facts/context require explicit review, including UTC date/time and foreign ILS.
No consumer wiring, purchase creation side effect or persistence schema change.

New mocks: one item and 15 lines with Hebrew/mixed/repeated labels, weight and
explicit discount. Final focused tests 84/84; full Vitest 248/248 (17 files);
project typecheck and separate strict new-file/test typecheck passed. Guarded
mock adaptation/preparation observes zero transport/storage/log calls; existing
save/v2 round trips, duplicates, consumed IDs, Undo and 42/12/12/ILS 6,777.38
baseline checks pass. No build/browser/device QA; all existing UI/MapLibre/camera
source and 219 protected files byte-identical. Initial test fixture mistakes
corrected without weakening assertions; checkpoint records exact evidence.

Remaining gate: separate core-adapter checkpoint review. Capture UI still needs
separately approved wiring for observed metadata, unknown units, printed-line
corrections and UTC confirmation, then existing explicit P1 save. Merchant/
address, taxes and per-line barcode sidecars are not persisted by current v2;
unknown merchants need explicit unresolved/canonical context, no new IDs/pins.
No live/general receipt extraction claim; Vision 3 consumed, Gemini P2D 3/12
and consumed Groq evidence remain locked. See COLLEGE_RECEIPT_REVIEW_ADAPTER.md.

Exact task manifest (4): src/features/capture/receipt-review-adapter.ts,
src/features/capture/receipt-review-adapter.test.ts,
docs/spendscape/COLLEGE_RECEIPT_REVIEW_ADAPTER.md, docs/AI_HANDOFF.md (append only).
Pre-task handoff and unrelated dirty/untracked files preserved. Feature branch,
HEAD e7f05f8, main/origin-main eee0d26, cached origin feature 66fb420; ahead 6/
behind 0, no fetch. Index empty; next-env matches HEAD/pre-task. Ignored evidence
only under artifacts/spendscape-receipt-review-adapter. No server, dependencies,
credential/provider/account/billing action, stage/commit/push/deployment.


### Receipt adapter strict-array correction — 2026-10-04

Checkpoint review found one Medium runtime validation issue: sparse JavaScript
line arrays could return ready:true but fail local-store validation; extra array
properties survived cloning. Ordinary JSON cannot carry these shapes. Under the
separate correction approval, bounded dense-array validation now guards observed
lines, ambiguous candidates and edited review lines. Reject holes/inherited or
hidden indices, accessors, custom prototypes and extra string/symbol/hidden keys
before cloning/projection; preserve valid dense/frozen arrays and existing caps.
No changes to facts, arithmetic, optional VAT/barcodes, save/store or consumer UI.

Fresh offline QA: 75/75 adapter tests (37 new); combined domain/store/comparison/
repository suite 121/121 in five files, zero failures/skips. Both project and
explicit strict new-file/test typechecks passed; whitespace checks passed.
Original one/15-item, context, discounts, Undo, pin/baseline and storage tests
remain green; maximum 50-line/frozen control round-trips through v2. No full
suite/build/browser/server or provider call in this correction. Prior 248-test
full result is historical initial-implementation evidence, not a fresh rerun.

Same four-file manifest: receipt-review-adapter.ts, receipt-review-adapter.test.ts,
COLLEGE_RECEIPT_REVIEW_ADAPTER.md and this handoff append. Pre-correction inputs
retained in ignored artifacts/spendscape-receipt-review-adapter/strict-arrays/;
219 protected files and 63 historical pins/five Vision wrapper hashes unchanged.
Feature HEAD e7f05f8; protected main refs eee0d26; cached origin feature 66fb420,
ahead 6/behind 0. Index empty; next-env matches HEAD/pre-task. Unrelated work and
all consumed provider locks preserved. No dependencies, UI/schema integration,
stage/commit/push/deploy. Next gate: a new receipt-to-review adapter checkpoint
review; neither commit nor consumer/provider integration is authorized.

### Architect post-commit routing — 2026-10-04

Local HEAD verified as 6a9661b6657d187bd7a2a012c103a0a65fb36734 on
feature/spendscape-rebuild, cached upstream ahead 7/behind 0. Its four-file
manifest contains the corrected adapter, tests, checkpoint and 68 adapter-only
handoff lines. Index empty; unrelated benchmark work remains dirty/untracked.
Architect read the committed adapter/checkpoint and reran its focused suite:
75/75 passed. No fresh full-suite, browser, build, provider or device verification.

CaptureExperience still imports PurchaseReviewInput/reviewFromDemo, not this
adapter. Next proposed single slice: connect receipt drafts and
prepareReceiptReview to the existing editable Capture review/save flow, with
fictional observations delivered through QA-only injection. Expose unresolved
units, observed merchant/address/time and editable printed amounts; retain
explicit date/time confirmation and canonical/unresolved place rules. No public
control may pretend to have scanned a real photo. Live photo ingestion/provider
parsing remains subsequent work. The user's short and discount-bearing receipts
are future validation references, not attached raw data to persist or upload now.
This routing note does not activate implementation or another provider attempt.
All consumed locks and historical scores remain unchanged. Architect appended
only this note; no application edit, credential access, commit/push/deploy.

### Receipt review Capture integration — 2026-10-04

Approved bounded local slice complete, awaiting separate checkpoint review.
Capture accepts an in-memory ReceiptReviewDraft; the existing form calls
prepareReceiptReview before explicit P1 save. Original observed merchant/address/
printed date/time and all original lines remain separate from corrections.
Unknown units and editable printed net amounts fail closed until resolved;
quantity/gross price/explicit discount/net must agree. No merchant/place inference.
Explicit wall time + IANA timezone confirmation produces the existing UTC instant;
DST gaps fail and overlaps require a chosen occurrence. VAT/barcodes optional.
Unsupported observation metadata stays transient; IndexedDB envelope v2 unchanged.
One/15-item fictional observations enter only a loopback/opt-in QA hook, no public
OCR-success control. Source changes, navigation, success and stale hooks clear
drafts; existing late-save generation and operation protections remain.

QA: focused unit 130/130; full unit 296/296 (18 files); production combined
receipt/P2C/Capture/Scanner A/data-boundary/Nearby suite 64/64 (3.5m), plus 6/6
real pinned barcode handoff, eight-second Undo and delayed-save navigation checks.
Build, project/strict QA typechecks and whitespace passed. Inspected EN/HE mobile
360/390/430 and desktop 1280 screenshots, including full errors at 360x420 under
reduced motion. Receipt-only layout observation fixed short-viewport error clipping;
no timeout/assertion weakened. Baseline 42/12/12/ILS 6777.38, one MapLibre; tested
41.00 addition/reload gives ILS 6818.38 and keeps 12 pins. No outgoing purchase/
provider/OCR request or persisted original-observation sidecars.

Exact task manifest (10): CaptureExperience.tsx, PurchaseReview.tsx,
CaptureExperience.module.css, ReceiptReviewDetails.tsx, receipt-review-time.ts,
receipt-review-time.test.ts (all src/features/capture/);
qa/receipt-review-integration-mocks.ts, qa/spendscape-receipt-review-integration.spec.ts,
docs/spendscape/COLLEGE_RECEIPT_REVIEW_INTEGRATION.md, this append-only handoff.
HEAD 6a9661b unchanged; main/origin-main eee0d26, cached origin feature 66fb420,
ahead 7/behind 0. Index empty; unrelated dirty/untracked benchmark work preserved.
257 other snapshotted files and 63+5 Vision hashes unchanged. next-env matches
HEAD/pre-task; ignored artifacts only, owned QA server stopped (3000 free).
All consumed provider locks/scores preserved; no dependency/provider/commit/push/
deploy. Photo/file ingestion and general receipt extraction remain unimplemented;
no real OCR accuracy or physical-device claim. Next gate:
APPROVE SPENDSCAPE COLLEGE RECEIPT REVIEW INTEGRATION CHECKPOINT REVIEW.


### Receipt integration date/time visibility correction — 2026-10-04

The checkpoint review's Medium finding was feedback below the visible scroll
area for missing date/time/zone and shortened-screen reconfirmation. Under the
separate correction approval, one described error sits with the actual correction
control; failed Save/confirmation focuses it and reveals the whole group after
layout changes. Calendar-only UTC probing never chooses the saved timezone.
Time validation, explicit confirmation, facts, adapter/store schema and scanners
are unchanged. No receipt-photo/provider integration or physical-device claim.

Fresh QA: 296/296 unit (18 files), typecheck/strict QA/build/whitespace passed;
new EN/HE reduced-motion time-feedback cases 4/4; full receipt/data-boundary
production suite 20/20 (52.4s), direct barcode/8s Undo/late-save neighbors 6/6
(26.4s). No failures, retries, flaky cases or timeout/assertion weakening.
Inspected 360x640/420 EN/HE correction screenshots plus fresh 390 HE and desktop
1280 states. Fully-visible focus/error assertions cover missing zone/time,
confirmation, resize and DST gap/overlap; save/Undo preserve baseline pins/map.
Original 64/64 combined integration evidence remains retained separately.

Correction manifest (six, within the same ten-file integration slice):
ReceiptReviewDetails.tsx, PurchaseReview.tsx, CaptureExperience.module.css,
qa/spendscape-receipt-review-integration.spec.ts,
docs/spendscape/COLLEGE_RECEIPT_REVIEW_INTEGRATION.md, this appended handoff.
294/300 other protected inputs byte-identical, all consumed provider locks and
scores preserved. HEAD 6a9661b/main eee0d26/cached origin feature 66fb420 unchanged;
ahead 7/behind 0, index empty, unrelated dirty/untracked work retained. next-env
matches HEAD/pre-correction; ignored QA artifacts only, owned server stopped,
3000 free. No dependencies, credentials, provider calls, stage/commit/push/deploy.
Next gate: APPROVE SPENDSCAPE COLLEGE RECEIPT REVIEW INTEGRATION CHECKPOINT REVIEW.

## 2026-10-06 — conservative leading amount correction (offline; uncommitted)

Bounded short-table parser change: exactly one leading grouped numeric-bearing
row may belong to the immediately following description-anchored item. All
prefix words must start in the amount column and end before the code-column
boundary; at most seven words; no percentage marker. Positive centre-baseline
separation must be <= twice the smaller row's maximum word height. Any second
anchored item within that same window, intervening row, distant/unrelated prefix
or code-column crossing retains item-row-unassigned. No arithmetic, payable-total
matching, expected answer, new item or inferred discount is used for ownership.

A wholly contained, uniquely reconstructed amount remains observed text.
Competing occurrences (even equal values) become unresolved candidates; damaged
singletons remain verbatim for strict validation. Unreconstructable fragments
are candidates when bounded to 2–5 tokens, otherwise null. Column crossings
remain null; original words/geometry remain available only in transient
inspection, with the accepted prefix classified numeric-details. They are not
silently skipped or accepted as financial facts. Existing optional VAT/barcode,
partial-layout, discount and printed-line validation behavior remains intact.

Changed in this task: src/features/receipt-image/short-receipt-parser.ts,
short-receipt-parser.test.ts, parser-inspection.test.ts, and this appended status.
Fresh isolated evidence: artifacts/leading-amount-0ofeof47 (ignored). Initial
focused run: 89/93 passed; four new test setup/assertion failures corrected
(grouped-row placement and draft field path), without weakening production
acceptance. Final guarded offline suite: 310/310 across 11 files (receipt-image,
receipt adapter and session-purchase domain); npm run typecheck passed;
git diff --check passed. No browser QA/build/server/provider request was needed
or performed. All receipt fixtures used for this task are fictional.

The prior live response was discarded; this is mock evidence only, not a fix
claim or OCR accuracy verdict for that receipt. Multiple prefix rows, ambiguous
ownership and unsupported layouts still reject. No live validation authorized.
Entry recovery/config changes and unrelated untracked work are preserved.
HEAD d279759e0a1ab4d186d711ce3f5477fa0057ca87 and feature branch unchanged;
main/origin main eee0d26, cached origin feature 66fb420 unchanged; index empty;
next-env.d.ts matches HEAD. Cumulative tracked manifest is seven files: the four
above plus the three pre-existing src/server/vision-local{,-run,-run.test} files.
Consumed reservations, diagnostics and historical benchmark evidence preserved.
No stage, commit, push or deployment. Next gate: separate leading-amount
checkpoint review; no new live request.

## 2026-10-08 — Final payable review/save, offline checkpoint

User-approved policy supersedes the receipt-level-discount blocker above:
user-reviewed receipts store explicitly confirmed payable independently of
valid product sum. EN/HE review and saved details show both totals and a
nonblocking difference; no allocation, inferred discount or printed-line rewrite.
Synthetic demos/non-receipts remain reconciled. Per-line/invalid-value/context/
timezone gates remain strict; v3 shape unchanged, no migration or hydration write.
Spending uses payable; item sum uses minor units. Foreign amounts still need
explicit reported ILS. Original observations remain transient.

Fictional5-row/7-unit control: product60.55/payable60.50/date2013-09-30; unknown
GTINs. Real candidate extraction and real save/reload remain unverified. No
provider/request/schema change or live allowance; historical locks preserved,
stopped slot remains stopped. Old launcher must not be reused.

QA: final guarded10-file195/195; app/focused strict typechecks and production
build passed; final combined production-browser23/23 (47.7s), including17
receipt integration regressions. Ten final EN/HE synthetic screenshots inspected
(360/390/430/1280 widths); duplicates/Undo/save/reload/both totals/12pins/one map
verified. Sandbox Chrome-launch23 failures occurred before assertions; unchanged
rerun passed with local browser permissions. Earlier test-only corrections and
reports retained. Historical30ms direct-image timing variability and full strict
QA typecheck limitation not claimed resolved.

Exact13-file task manifest, commands, limits and Git state:
docs/spendscape/COLLEGE_FINAL_PAYABLE_TOTAL.md. Fresh ignored evidence:
artifacts/final-payable-4436jwo9. HEAD25e6920, feature/spendscape-rebuild, empty
index; cumulative tree remains dirty with prior work. Main refs/entry next-env/
15,657-file entry snapshot preserved outside manifest; owned3130server stopped.
No credentials, provider calls, billing/Vercel action, commit/push/deployment.
Next gate: separate final-payable checkpoint review; any inference remains gated.

## 2026-10-09 — Structured Gemini receipt preparation (offline, uncommitted)

Prepared the separate minimal-baseline JSON-mode candidate (`gemini-3.8-flash`,
`responseMimeType: application/json`, combined output/thinking cap 4096), strict
small-contract validation and mock-only Capture → editable review → explicit P1
save/reload. No geometry parser, live transport/key reader, live reservation or
provider call. Missing facts remain unresolved; original observations stay transient.
Printed lines and final payable remain distinct; their difference is nonblocking,
with no receipt-level discount allocation. Old request/financial validators unchanged.

Final QA: 286/286 guarded unit tests; 13/13 synthetic production-browser tests
(39.111s); application/focused QA typechecks and production build pass. Inspected
17 fictional EN/HE screenshots at 360/390/430/1280 widths. Owned servers stopped.
Exact next-env entry/HEAD bytes, all 100 protected snapshot artifact hashes and
minimal freezes' 49/57 dependency hashes preserved. Ignored tsconfig.tsbuildinfo
was regenerated. Earlier handoff text and unrelated source work preserved.

Real structured admission, extraction/item coverage and real save readiness remain
unverified. Minimal HTTP 200 proves only image/plain-text compatibility; repeated
HTTP 400 cause remains unknown. Next gate: separately authorize one fixed native
structured validation of the approved 2013 receipt, existing private project/key
verification and Prepay, no retries/fallback/autosave. Planning cost US$0.03540
(<$0.10; pricing reviewed 2026-10-09, recheck by 2027-01-01). No executable native
launcher here. See COLLEGE_GEMINI_STRUCTURED_RECEIPT.md for the exact 12-file task
manifest, request comparison, evidence, contract limits and activation requirements.

Git: feature/spendscape-rebuild; HEAD 52902b13a8493ed616cc35ccb084a3edeecaf590;
index empty; cumulative 8 tracked modifications / 122 individual untracked files.
Main/origin-main eee0d26b55e5061f87ac664938df0c195800b74f unchanged; cached origin
feature 66fb4204154c88789e9e0401e317f9000b6b5e18 (ahead 18/behind 0; no fetch).
All task files uncommitted. Vercel untouched; pause not independently rechecked.
No billing/account changes, commit, push or deployment. Stop for checkpoint review.


## 2026-10-09 — Authorized native structured run prepared; private launch pending

Separate fixed run structured-validation-20261009-one prepared for ONE approved
2013 crop/one Gemini request on existing Prepay,≤US$0.10. Original contract/prompt/
JSON mode/4096 cap unchanged; no geometry parser. New transport verifies serialized
request SHA256 1c9420c3…; exclusive fsynced reservation and durable lifecycle precede
transmission. Default/unknown/hosted/CI disabled; no retry/fallback/autosave.
User-only launcher performs existing private gcloud/key/project match; agent has
not accessed credentials. Current count0, native reservation absent; waiting for
private launch, not an extraction result. Keep all historical consumed locks.

QA125/125 guarded unit,25/25 guarded Node,3/3 focused production-browser mocks
(12.468s), application/focused TS and production build pass. Initial browser sandbox
failure and evidence-directory invocation error retained separately; fresh final
mock run passed. Owned mock servers stopped; next-env entry bytes preserved.
Current official cost estimateUS$0.03540 incl thinking margin,expiry2027-01-01;
existing Prepay/Auto-reload Off are user-confirmed via launch flags,not remeasured.
All101 protected entry hashes and minimal freezes49/57 deps preserved. Original
candidate freeze intentionally detects only the activated route; kept unchanged.
Separate activation freeze131 source/history+449 build files verifies local preflight.

Exact11-file activation manifest/instructions in COLLEGE_GEMINI_STRUCTURED_RECEIPT.md
and qa/receipt-structured/activation/README.md. All uncommitted; HEAD52902b13,
feature/spendscape-rebuild,main refs unchanged,index empty. Vercel untouched.
After private readiness: native/unused check, ONE normal Capture Read, safe durable
status and transient field classification; no correction/save. Real structured
extraction/accuracy/save/reload remain unverified until actually observed.


## 2026-10-09 — Native structured validation: editable draft, review required

Run structured-validation-20261009-one consumed exactly ONE Capture inference;
private user launcher/key-project match, native/unused status checked before Read.
Approved crop/frozen request unchanged. Durable HTTP200 → parsing-complete →
review-response-complete at11746ms (server key check/request/validation/preparation,
not isolated model latency; excludes private gcloud verification and upload).
Real editable five-row draft appeared; all product descriptions/quantities/prices/
printed line amounts matched, seven units, promotions excluded, barcodes unknown,
final payable matched. Address prefix needs review. Printed date/time matched in
observations but DMY date did not populate datetime-local; Hebrew currency notation
did not populate ISO select. Five units unresolved; required purchase context and
explicit timezone unresolved. No manual corrections/save/reload, no inferred facts.
Reference arithmetic: approved product amounts sum60.45, not60.55; payable60.50.
No allocation or rewrite. Live totals notice remains unverified while currency is
blank; mocks passed. User draft/tab and user-owned server3156 retained for review;
owned mock servers stopped; consumed reservation prevents another inference.
QA125/125 unit,25/25 Node,3/3 browser mocks; TS/build pass. Cost boundUS$0.03540,
actual charge not measured. Exact11-file activation manifest and detailed findings
in COLLEGE_GEMINI_STRUCTURED_RECEIPT.md. All task changes uncommitted; historical
locks/evidence, main refs and entry next-env preserved. Vercel untouched. No retry,
provider/schema fix, billing action, commit/push/deploy. Next gate is checkpoint/
compatibility review; no further call authorized.

Final Git verification: 8 tracked modifications / 130 individual untracked files,
index empty, ahead18/behind0 versus cached origin feature; no fetch. All101 protected
entry artifacts and activation freeze131 source/history+449 build hashes match.
Only task docs/route and ignored tsconfig.tsbuildinfo differ from entry; unrelated
entry files preserved. next-env matches entry and HEAD. Whitespace checks pass.


## 2026-10-09 — Receipt observation/editor compatibility, offline QA complete

Strict ISO/DMY four-digit calendar conversion plus exact supported ILS notation now
populate receipt review controls; originals remain separate. Missing/ambiguous time,
units, currency, timezone and place require explicit review. Address is editable
only in transient review memory; no persistence/location inference. Existing
structured Gemini request/model/prompt/JSON mode/transport and financial/store
validators unchanged. Correct approved evaluation sum60.45/payable60.50; independent
product values and final total retained, difference nonblocking. No receipt-discount
allocation. Historical scores/freezes and older synthetic60.55 controls unchanged.

QA259/259 guarded focused unit,6/6 final synthetic production-browser tests25.467s,
application/focused TS and isolated production build pass. Initial browser2/6 had
four incorrect unit-first focus expectations: existing validation focuses quantity
while unit is unresolved. New tests verify that focus, keyboard unit access/errors;
no source safeguard changed. Failure artifacts retained. Fourteen fictional EN/HE
screenshots;360/390/430 mobile and1280 desktop, save/reload/duplicates/Undo,12 pins
and one MapLibre verified. No broad suite or physical-device claim.

User chose to leave real draft open: verified visible, no Save/reload or field edits.
User-owned native3156 server/build retained; isolated fictional3160 server stopped.
New code is not applied to the already loaded real page; reloading would discard
its draft. Real save/reload remains unverified. No provider call/new reservation,
credentials, billing, dependency, commit/push/deploy or Vercel action.

Exact8-file task manifest/rules/results in COLLEGE_RECEIPT_EDITOR_COMPATIBILITY.md;
evidence artifacts/receipt-editor-ak98df2a/. All103 protected entry hashes and449
native build hashes preserved, original freezes/locks byte-identical. Source freeze
intentionally detects new editor/adapter code; it was not regenerated. HEAD52902b13,
feature/spendscape-rebuild, index empty; main refs/entry next-env unchanged, unrelated
dirty/untracked work preserved. All task changes uncommitted. Next gate: checkpoint
review; eventual real Save remains the user's explicit action.

Final cumulative Git state:8 tracked modifications/134 individual untracked files,
index empty,ahead18/behind0 versus cached origin feature; no fetch. Four new task
files/four edited entry files; zero unrelated entry changes. Whitespace checks pass.

## 2026-10-09 — Complete receipt prefill and actual save blockers (offline)

HEAD52902b13/feature-spendscape-rebuild unchanged; all task work uncommitted.
See COLLEGE_RECEIPT_PREFILL.md for exact15-file manifest and evidence under
artifacts/receipt-prefill-d37rrqyn/. Existing strict date/currency prefill retained;
partial date/time now keeps the supported part. Observed merchant name prefills
explicit creation, address stays editable/transient and can prefill an explicitly
created place. Unknown channel permits an unpinned save without coordinates.
No automatic merchant/place match or invented context. Actual prepareReceiptReview
errors drive live blockers; missing-unit presentation coalesces dependent quantity
errors/focuses unit without altering validators. Summary uses meaningful facts.
Printed product values/payable remain independent; difference nonblocking.

Payment/category/units/confirmed timestamp have no unknown persisted alternatives;
if unknown, keep draft. Unresolved-place address cannot persist without a separate
contract change. Request/model/prompt/JSON/transport, store schema and financial
validators unchanged. QA264/264 guarded focused unit,12/12 final combined synthetic
browser44.8s, application/focused TS and isolated production build pass;24 fictional
EN/HE screenshots. Explicit mock save/reload/duplicates/Undo,12 pins/one map verified.
Initial failures recorded in checkpoint; no broad-suite/physical-device claim.

Real draft verified still open in older loaded UI; no edits/save/reload/native restart.
Reload would discard it, so improvements were tested on separate credential-free
mock3161, now stopped. User-owned3156 remains; real save/reload unverified.
152 protected evidence/449 native build hashes, main refs,index,entry next-env and
unrelated work preserved. No call/new reservation, credentials,billing,dependency,
commit/push/deploy or Vercel action. Next gate: checkpoint review.

Final cumulative state13 tracked modifications/138 individual untracked files,
index empty,ahead18/behind0;11 entry files edited/four new task files, zero unrelated
entry changes. Tracked and untracked-task whitespace checks pass.


## 2026-10-09 — Self-contained native mocks / final receipt-flow review

Proposed43-file checkpoint now passes in a fresh HEAD52902b13 source projection:
native23/23, guarded aggregate222/222, application/strict-native-test TS and whitespace.
Earlier214/222 (eight ignored-history ENOENT failures) retained byte-identically in
receipt-flow-review-q_4xde_r. Test-only synthetic history/digest substitution exercises
the unchanged production fixed-path SHA256, durable reservation and lifecycle code;
missing/tampered records still reject. Fresh temp roots cleaned; no real/ignored
history, receipt, credential or research dependency. Extra strict test typing's six
NODE_ENV errors corrected only in synthetic environments; initial evidence retained.

Exact43-file/hunk patch, final checks and preservation:
artifacts/receipt-flow-final-7vfalg9y/. This correction changes only native test,
COLLEGE_RECEIPT_PREFILL.md and this appended section. Application/dependencies unchanged;
retained12/12 EN/HE browser/build evidence reused. Prior dirty handoff sections and
three Vision run-config files excluded from the proposal. No staging/commit.
Real old-UI draft still open/untouched; real save/reload unverified. Printed line
sum60.45/payable60.50 independent. No calls, credentials, new locks, billing/Vercel
change or publication. Main refs, historical evidence, consumed locks and entry
next-env preserved. Next gate: separate commit approval for
`feat(receipts): complete local structured extraction and reviewed save flow`.
