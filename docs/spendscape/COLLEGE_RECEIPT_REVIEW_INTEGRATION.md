# College receipt review integration — local checkpoint

2026-10-04. Bounded Capture integration from committed core adapter
`6a9661b6657d187bd7a2a012c103a0a65fb36734`. Implementation and local QA only;
no provider/photo ingestion, schema change, dependency, publication or commit.

## Boundary and reviewed facts

CaptureExperience accepts an optional in-memory `ReceiptReviewDraft`. It detaches
the supplied draft and allocates a fresh existing review operation. PurchaseReview
keeps observations separate from editable facts and calls `prepareReceiptReview`
before the existing explicit asynchronous save boundary. Invalid required context,
units, arithmetic or printed line amounts prevent that boundary from being called.
Ready projection strips observation sidecars and preserves existing P1/P2C saving,
duplicate override, consumed operations, eight-second Undo and strict envelope v2.

The review displays observed merchant/address and printed date/time. A keyboard
accessible disclosure preserves all original lines, alternatives, optional taxes
and barcodes independently of edits/removal/addition. Existing controls edit names,
quantities, gross unit prices and whole-line discounts; new controls expose unknown
units and editable printed net amounts. Printed amounts must equal calculated nets
in integer minor units. Neither gross prices nor amounts are silently repaired.
The field-specific mismatch explanation remains visible with the focused control,
including a shortened mobile viewport. Missing/ambiguous supplied discounts stay
blank and blocking; absent discount retains the existing no-discount meaning.

Observed names/addresses never select a canonical merchant/place. The user must
choose an existing confirmed place or explicitly choose an unpinned channel and
merchant context (including the existing unresolved merchant). No new IDs or
coordinates are created. Foreign-currency user review still requires the reported
ILS amount; no synthetic FX is substituted. VAT and barcodes are optional.
Address/original merchant text, tax, per-line barcode, timezone and original
observations stay transient: current persistence does not support those fields.
The disclosure explains this limitation. Reviewed gross/discount/net item facts
and the confirmed UTC timestamp are saved through the unchanged schema.

## Explicit wall-clock confirmation

Receipt date/time starts from unambiguous printed strings, never a current time
or midnight. Missing/ambiguous observations remain visible and require correction.
The user chooses an IANA timezone and confirms the wall-clock date/time. Jerusalem,
UTC and the browser's zone are offered first, followed by the browser's supported
zones. Older engines lacking `Intl.supportedValuesOf` get those first three only.
There is no default zone selection or GPS/place-based timezone inference.

Platform Intl round trips convert to the existing UTC-minute save format.
Invalid calendars and DST gaps fail closed; repeated DST times require an explicit
earlier/later occurrence choice. Changes to wall time, zone or occurrence clear
confirmation. Users do not calculate UTC. Zone identity is transient; the saved
UTC instant remains subject to the existing 1900–2100 validator. Runtime Intl's
timezone database is the source of offset rules, not a bundled date dependency.

## Lifecycle and QA-only entry

The production UI has no receipt-photo success action. Fictional observations in
`qa/receipt-review-integration-mocks.ts` exercise one ILS 12.50 item and 15 lines
summing to ILS 41.00, including Hebrew/mixed/repeated labels, weight and an explicit
whole-line discount. They are not provider results or reused retailer prices.

For local QA only, opening Capture on loopback with `?receiptReviewQa=1` installs
`window.__SPENDSCAPE_RECEIPT_REVIEW_QA__`. It validates observations through the
committed adapter and passes the resulting draft to the same in-memory receiver.
The hook is absent without opt-in and on hosted origins. No receipt data is put
in the URL. Unmount/rebinding invalidates old hook references. Source changes,
success and browser traversal discard the active receipt draft; even traversal
between two review history states cannot resurrect it. Existing late-save
navigation generation protection remains. No media or OCR assets are loaded.

## QA evidence

Final production-state combined suite: **64/64 passed in 3.5 minutes**. Command:
`node node_modules/@playwright/test/cli.js test --config playwright.phase2a1.config.ts
qa/spendscape-receipt-review-integration.spec.ts qa/spendscape-college-p2c.spec.ts
qa/spendscape-capture.spec.ts qa/spendscape-scanner-a.spec.ts
qa/spendscape-data-boundary.spec.ts qa/spendscape-nearby-demo.spec.ts`.
All 12 receipt-integration cases passed within it. The separate focused run was
12/12 before adding keyboard disclosure assertions. Earlier combined 63/63 was
before the last refinements and remains intermediate evidence only.

Focused domain/time/store/comparison tests: 130/130; full `npm test`: 296/296
in 18 files, no failures/skips. Project `npm run typecheck`, explicit strict
TypeScript checking of new QA/tests, and `npm run build` passed. Whitespace
checking passed. No dependency/configuration/timeout changes.

Verified correction → save/reload, one/15 lines, gross/discount/net facts,
missing financial facts, absent VAT/barcodes, explicit unresolved/existing place,
reported ILS for foreign online purchases, timezone confirmation/DST overlap,
duplicate warning/override, repeated submit, Undo, Escape, Back/Forward and stale
hook cleanup. The saved 15-line ILS 41.00 purchase updates the composed Analytics
total to ILS 6,818.38; reload preserves it. Baseline is 42 purchases/12 places/
12 pins/ILS 6,777.38, and additions retain 12 pins/one MapLibre construction.
No provider/OCR requests, outgoing purchase payload or observation-sidecar
persistence was observed. Only the established camera/navigation session keys
are allowed; durable reviewed purchase facts use the unchanged IndexedDB v2.

Rendered screenshots inspected: observations at 360×640 EN, 390×844 HE and
1280×844 EN; line errors at 360×640 HE and 430×932 EN; saved result at
390×844 HE; shortened 360×420 EN/HE with the entire focused error and actions
visible. Files are `observations-*`, `line-error-*`, `saved-*` and
`short-viewport-{en,he}.png` in the ignored task artifact directory. These are
desktop Chrome synthetic-input checks; no physical keyboard/iPhone QA claim.

Test corrections during implementation: an initial focus assertion assumed the
unit control preceded the basket error; the established form focuses the first
invalid control in DOM order. A second run was 7/8: its Undo assertion sampled
before the asynchronous store/graph update. A combined run was 60/61: its blanket
sessionStorage-empty assertion conflicted with accepted camera/navigation state.
The tests now retain focus assertions, await the exact Undo count and allow only
those existing storage keys while rejecting receipt content. No timeout increased,
quality criterion relaxed, source observation repaired or assertion removed to
hide a product defect. Visual inspection prompted full error-label scrolling.
A subsequent expanded run was 62/64: EN/HE error text clipped after reducing
the 360px phone height to 420px under reduced motion. Viewport events preceded
the final scroll-area layout. A receipt-only ResizeObserver now reapplies focus
visibility after that layout settles and disconnects on unmount. The unchanged
full-visibility assertions passed in the fresh 12/12 focused run; native disclosure
keyboard checks were then added to the final combined run. No timeout changed.

## Exact task manifest

Additional direct regressions: **6/6 passed in 25.3 seconds**, using the same
production configuration on `qa/spendscape-scanner-e.spec.ts` and
`qa/spendscape-college-p1.spec.ts`, filtered by
`real pinned|Undo countdown expires|late durable save`. This covers one real pinned
reader handoff on synthetic camera frames, exact eight-second Undo expiry and
four delayed durable-save navigation cases. Complete and additional JSON reports
were retained separately; split results do not replace the 64-case combined run.

1. src/features/capture/CaptureExperience.tsx
2. src/features/capture/PurchaseReview.tsx
3. src/features/capture/CaptureExperience.module.css
4. src/features/capture/ReceiptReviewDetails.tsx (new)
5. src/features/capture/receipt-review-time.ts (new)
6. src/features/capture/receipt-review-time.test.ts (new)
7. qa/receipt-review-integration-mocks.ts (new)
8. qa/spendscape-receipt-review-integration.spec.ts (new)
9. docs/spendscape/COLLEGE_RECEIPT_REVIEW_INTEGRATION.md (new)
10. docs/AI_HANDOFF.md (task status appended; unrelated prior edits preserved)

The committed adapter/evaluator, storage/domain, scanners, globe, fixtures,
dependencies and historical provider files are unchanged. Ignored evidence:
`artifacts/spendscape-receipt-review-integration/`. No screenshot/build output or
next-env.d.ts belongs to this manifest.

## Final Git and cleanup evidence

Branch `feature/spendscape-rebuild`; HEAD unchanged at
`6a9661b6657d187bd7a2a012c103a0a65fb36734`. Upstream remains
`origin/feature/spendscape-rebuild` at cached ref
`66fb4204154c88789e9e0401e317f9000b6b5e18`: ahead 7/behind 0; no fetch/push.
Local main and origin/main remain `eee0d26b55e5061f87ac664938df0c195800b74f`.
Index empty. Working tree contains this ten-file task plus pre-existing unrelated
benchmark work; it is not clean. The handoff's pre-task contents remain an exact
prefix, with only this task status appended.

Of 260 snapshotted pre-task files, only the three intended existing Capture files
changed; the other 257 match, including dependencies and consumed provider locks.
All 63 historical Vision pins and five validation-wrapper hashes also match.
`next-env.d.ts` matches both pre-task bytes and HEAD blob
`ce4e94a6b10f160ee021fe18939af160d2927dcf`; no generated drift remains.
QA artifacts and `.next` are ignored. The owned production server was stopped;
port 3000 has no listener. No stage, commit, push, deployment or provider action.

## Remaining boundary and gate

This qualifies mocked observations → explicit corrected review → existing local
save. It establishes no receipt recognition accuracy or physical iPhone acceptance.
Photo/file acquisition, consent, general layout/field extraction, bounded approved
provider transport and real multi-item receipt evidence remain separate work.
Gemini P2D remains locked at 3/12; consumed Groq and all three Vision attempts,
original scores, freezes and locks remain unchanged. Optional VAT does not rescore
any historical benchmark. Existing Nearby comparison eligibility stays limited to
the accepted synthetic demo; these user-reviewed receipt additions do not imply
product matches or eligible savings.

Next gate: `APPROVE SPENDSCAPE COLLEGE RECEIPT REVIEW INTEGRATION CHECKPOINT REVIEW`.
Stop before commit, push, deployment or photo/provider integration.


## Date/time error visibility correction — 2026-10-04

The separate checkpoint review identified one Medium presentation defect:
missing date/time/zone feedback lay below the visible scroll area at 360x640
EN/HE; at 360x420 the reconfirmation explanation was also below the scroll area.
Validation already rejected saving. The original implementation and review
reports remain historical evidence; their passing tests did not assert every
time-error state was fully visible.

Under the bounded correction approval, the single described error now sits with
the control needing correction: wall date/time, explicit timezone, clock-change
occurrence, or explicit confirmation. Failed Save/confirmation focuses that
control and reveals its whole feedback group. Viewport/scroll-area resizing
reveals the group using the settled layout. Scheduled confirmation focus is
cancelled on unmount. Error IDs remain unique, and descriptions disappear when
the error clears. The UTC calendar probe chooses only the feedback target; it
never chooses a timezone or a saved instant. Existing time validation, explicit
confirmation, DST behavior, save projection, persistence and source facts are
unchanged. The correction adds no facts, provider, dependency or public entry.

Fresh final-code QA:
- `npm test`: 296/296 in 18 files; no failures/skips.
- Project typecheck, explicit strict QA/test typecheck, production build passed.
- Four new focused production-browser tests: 4/4 in 11.1s.
- Complete receipt-integration/data-boundary production suite: 20/20 in 52.4s
  (16 receipt cases, four boundary cases), no retries/flaky/skipped cases.
- Direct neighboring barcode handoff/Undo/late-save suite: 6/6 in 26.4s.
- Whitespace and protected-input integrity checks passed.

New deterministic cases cover missing date/time, missing explicit zone,
unconfirmed/reconfirmed time, a DST gap, a DST overlap and occurrence
confirmation at 360x640 and 360x420, EN/HE, with reduced motion. They assert the
focused control and its single described error are wholly in view, including a
640-to-420 resize; saving remains blocked until explicit confirmation. The later
DST occurrence saves the expected instant and Undo restores 42 purchases.
Existing cases still verify one/15-item corrections, save/reload, duplicates,
privacy, cancellation, shared graph, 12 pins and one MapLibre instance.

Actual screenshots inspected: time-missing-640-en, time-missing-420-he,
time-unconfirmed-420-en, time-overlap-420-he, time-zone-420-he,
time-gap-420-en and time-resized-640-he in
`artifacts/spendscape-receipt-review-integration/date-time-correction/`; fresh
line-error-390-he and observations-1280-en in the parent task directory.
Geometry assertions also cover the other EN/HE states. These are desktop Chrome
synthetic-input/reduced-height checks, not physical iPhone or keyboard QA.
Separate JSON results preserve each run; the original 64-case combined report
has not been replaced by these focused reruns.

Correction manifest (six files within the unchanged ten-file integration slice):
1. src/features/capture/ReceiptReviewDetails.tsx
2. src/features/capture/PurchaseReview.tsx
3. src/features/capture/CaptureExperience.module.css
4. qa/spendscape-receipt-review-integration.spec.ts
5. docs/spendscape/COLLEGE_RECEIPT_REVIEW_INTEGRATION.md
6. docs/AI_HANDOFF.md (append only over the pre-correction contents)

Of 300 pre-correction snapshotted inputs, only these six changed; the remaining
294, including historical provider evidence/locks, are byte-identical. The
original selectors, freezes, evaluators, fixture graph, committed adapter,
storage/domain, scanners, dependencies and time conversion helper are unchanged.
HEAD/main/upstream refs and empty index are unchanged from the Git evidence above.
next-env.d.ts matches exact pre-correction bytes and HEAD. QA artifacts remain
ignored, the owned production server is stopped and port 3000 has no listener.
No stage, commit, push, deployment, credential access or provider request.

No remaining defect was found in this bounded local correction QA. The next
gate is a fresh `APPROVE SPENDSCAPE COLLEGE RECEIPT REVIEW INTEGRATION CHECKPOINT REVIEW`;
commit is not authorized. Photo/provider acquisition and physical-device
acceptance remain separately gated.
