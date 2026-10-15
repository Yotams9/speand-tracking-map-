# College local Vision receipt checkpoint — 2026-10-05

Authority: local Google Vision integration, focused QA and one approved cropped
receipt validation, maximum one `DOCUMENT_TEXT_DETECTION` request within the
remaining free allowance. Entry HEAD `37fac7d059bac7947f1fe2f8828518e1e2d49187`.
No commit, push, deployment, billing/API/account change or further call authorized.

## Local implementation

- `/api/receipt-ocr` keeps fictional QA separate. Ordinary/hosted recognition
  remains unavailable. Local activation requires all three server environment
  gates: `SPENDSCAPE_RECEIPT_VISION_LOCAL=1`,
  `SPENDSCAPE_RECEIPT_VISION_READY=1`, and
  `SPENDSCAPE_RECEIPT_VISION_IMAGE_SHA256=<approved crop hash>`, plus loopback,
  same-origin checks and `?receiptVisionLocal=1`. Vercel/CI disables activation.
  Selecting a photo never transmits it; explicit Read is required.
- The native server obtains an ephemeral token through existing gcloud login
  for `spendscape-receipt-benchmark`. No key, new dependency, SDK, storage upload,
  credential environment variable or client credential access was added.
- One fixed HTTPS POST, one image, one feature, no redirects/retries/fallback.
  Request image limit 4 MiB; validated JPEG/PNG dimensions 32–6,000 per side and
  <=12M pixels. Only the approved exact image SHA-256 is eligible. Response
  <=2 MiB; observations returned to the client <=64K. Server whole job 25 seconds,
  gcloud timeout 8 seconds, local client job 30 seconds (mock retains 15 seconds).
- `artifacts/receipt-vision-local-capture/attempt-one.reservation.json` is a new
  exclusive `wx` reservation, fsynced before credentials/provider work. It is
  permanent on failure, interruption and uncertain dispatch; never reset it.
  Tests use separate disposable temp directories, never the live reservation.
- Inputs/previews are transient. Cancel/replacement/unmount/timeouts reject late
  generations, revoke URLs and clear byte buffers. Native fetch receives the
  abort signal. JavaScript strings/objects are dereferenced for GC; deterministic
  erasure from JS/browser memory cannot be guaranteed. No photos/raw OCR/token/
  full provider errors are logged or written. Only approved receipt observations
  reach the transient review; existing explicit v3 save retains supported facts.

## Recognition, normalization and interpretation

FullTextAnnotation words/symbol boxes are normalized, including documented
omitted zero coordinates and observed whitespace/line breaks. Unsupported
hyphen reconstruction, malformed boxes, excessive geometry and per-image errors
fail closed. The full annotation text and provider errors never reach the client.

Existing explicit labelled-table parsing is preserved. A separate short printed
layout accepts one two-row description/code/amount + quantity/unit-price table
and printed payable-total labels. Merchant/address use the first two printed
text rows, excluding date/identifier/receipt-heading rows. Anchors are derived
from labels/relative geometry; no fixed crop regions or reference answers enter
selection. This is a limited layout strategy, not general receipt support.

Observed short dates remain verbatim: two-digit years require user completion;
no century or timezone is invented. Currency/units absent from print remain
unresolved. Printed totals/line amounts are not repaired or derived from other
numbers. Internal item/receipt identifiers never become verified barcodes.
Percent-discount layouts and optional tax interpretation are not supported by
this short strategy; unresolved discounts need review. Existing labelled amount
discounts/weighted lines remain supported. VAT/pre-VAT/barcodes remain optional.
Unknown merchants/places need explicit selection/creation; no IDs/coordinates or
pins are inferred. `prepareReceiptReview`, printed-line checks, timezone review,
duplicates, eight-second Undo and atomic IndexedDB v3 remain the save boundary.

## Readiness and official evidence

Read-only gcloud checks confirmed selected project, billingEnabled and enabled
Vision API for the exact project. Active Free Trial/no paid upgrade and at least
one applicable free unit/no concurrent use are **user-reported**, not independent
billing-usage measurements. The approved crop is 247,408 bytes, SHA-256
`aa40404b602ccc38e3f16d75bf30472fc12afc1c69d2a217e869cb6b7376ef46`.
The crop excludes the payment section; AI-generated edits were not used.

Current official sources checked:
[authentication](https://docs.cloud.google.com/vision/docs/authentication),
[OCR REST](https://docs.cloud.google.com/vision/docs/ocr),
[document hierarchy/zero coordinates](https://docs.cloud.google.com/vision/docs/handwriting),
[response/break contract](https://docs.cloud.google.com/vision/docs/reference/rest/v1/AnnotateImageResponse),
[pricing](https://cloud.google.com/vision/pricing), and
[data use](https://docs.cloud.google.com/vision/docs/data-usage).
Google documents the first 1,000 monthly units as free. One image/one feature is
one unit; a quota or Free Trial credit is not itself a hard $0 safeguard. Our
one-shot guard relies on the confirmed remaining allowance. Google states online
requests are processed in memory, with temporary request metadata logging, and
content is not used to train Vision. No guarantee about all provider metadata
retention is made by this application.

## Evidence and limits

Original implementation and validation evidence
root: `artifacts/vision-local-capture-nppfrda3/` (ignored).

The initial browser invocation was interrupted to isolate artifact destinations:
11 passed, 1 interrupted, 18 not run. It wrote 47 historical QA artifact paths
before isolation; exact list in `interrupted-artifact-writes.json`. Original
bytes at those paths were not backed up and cannot be claimed preserved. This
is an evidence-handling limitation; provider/benchmark evidence is separately
hash-checked. Subsequent copied specs change only imports and artifact paths,
not assertions/timeouts. The pre-existing four overwritten local-directory QA
artifacts and historical Scanner E strict-QA TS2556 limitation remain historical.

## Verified QA and live result

- Focused units: **99/99**, 7 files. Full units: **406/406**, 26 files.
- Application typecheck, production build, strict compilation of the new browser
  spec and whitespace checks passed. Final build contains `/api/receipt-ocr`.
- Combined browser suite: **96/100**, 5.8 minutes, 0 retries. All 94 existing
  Capture/receipt-image/receipt-review/data-boundary/Scanner A/B cases passed.
  Four new save cases failed because the QA script omitted the required explicit
  unresolved-merchant selection. After that correction, all saves succeeded, but
  four reload checks read map counts before map mount (**2/6**). The final focused
  run waits for the unchanged complete graph counts and passed **6/6**, 9.6s.
  No timeout increase, removed assertion or product validation change. Full
  aggregate is not described as 100/100; failed runs remain retained.
- Inspected fictional draft screenshots: 360x640 EN/HE, 430x932 HE, desktop
  1280x844; neighboring existing image QA covers 390x844. Dark design, RTL,
  visible required fields and keyboard-safe fixed actions remain.
- Baseline 42 purchases, 12 places/pins, ILS 6,777.38 and one mounted MapLibre
  remain verified by unit/data-boundary/browser checks. Existing scanners,
  review discounts, duplicates, Undo, reload and explicit local save passed.
- Real validation: **one local image POST and one consumed reservation**. It
  stopped during browser response inspection before HTTP/result metrics were
  retained. Actual Vision dispatch/status and exact/corrected/unresolved real
  fields are **unknown**; possible provider request count 0–1. Treat the entire
  single-call authorization as consumed. Do not rerun or reset. No raw response
  is retained for retrospective inference/rescoring.
- No real purchase was saved; no real image-to-review/reload success is claimed.
  Temporary browser context/previews were disposed. Offline inspection over
  fictional mocked transport and local HTTP both produced review successfully;
  the real inspection error's precise cause remains unestablished.
- Need **checkpoint review**, with live evidence incomplete. A later real
  validation would need separate authorization and safer stage/result capture;
  this task does not authorize it. General/10–15-item real support, physical
  iPhone receipt OCR and hosted deployment remain unproved.

## Exact changed-file manifest (18)

- `docs/AI_HANDOFF.md`
- `docs/spendscape/COLLEGE_LOCAL_VISION_RECEIPT.md`
- `qa/spendscape-vision-local.spec.ts`
- `src/app/api/receipt-ocr/route.ts`
- `src/features/receipt-image/ReceiptImageIntake.tsx`
- `src/features/receipt-image/image-session.ts`
- `src/features/receipt-image/ocr-parser.ts`
- `src/features/receipt-image/short-receipt-parser.ts`
- `src/features/receipt-image/short-receipt-parser.test.ts`
- `src/features/receipt-image/vision-fixtures.ts`
- `src/features/receipt-image/vision-local-boundary.ts`
- `src/features/receipt-image/vision-local.test.ts`
- `src/features/receipt-image/vision-normalize.ts`
- `src/features/receipt-image/vision-normalize.test.ts`
- `src/features/receipt-image/vision-transport.ts`
- `src/server/receipt-ocr.ts`
- `src/server/vision-local-reservation.ts`
- `src/server/vision-local.ts`

## Git safety

Branch/HEAD/index and protected main refs unchanged. Cached origin feature
`66fb4204154c88789e9e0401e317f9000b6b5e18`; ahead 10/behind 0 without fetch.
Unrelated untracked research/pilots are excluded. `next-env.d.ts` matches entry
and HEAD; generated evidence and the new reservation are ignored. All 454
snapshotted historical provider/benchmark files remain byte-identical. The
local QA/live servers are stopped at completion; no commit/push/deployment.

## Approved offline selection correction — 2026-10-06

The checkpoint review reproduced three parser findings using fictional geometry:
complete-amount filtering converted adjacent `7.` + `50` into `50` and discarded
malformed competing totals; global currency scanning accepted a product label;
heading selection accepted a standalone date as merchant.

The bounded correction changes only the short-layout parser and its tests:
- Select every geometrically relevant total token before parsing. Reconstruct
  adjacent decimal fragments only through the existing numeric helper; retain
  malformed singletons verbatim for correction. Competing, distant-fragment or
  anchor-crossing evidence remains unresolved, including repeated total rows.
- Accept currency only in an explicit edge `Currency:`/`מטבע:` header before
  the table. Unknown/malformed/repeated ambiguous headers remain unresolved.
  Unlabelled symbols, product labels and internal codes are not currency proof.
- Exclude standalone/segmented dates, times and identifier-only rows from the
  first two merchant/address rows. Do not shift another row into their place.

19 permanent regression controls added. Fresh offline results: **425/425** full
units (26 files), **118/118** network-guarded receipt-image units (7 files), and
**4/4** preserved independent review controls. Application typecheck and
`git diff --check` passed. No build, browser/server, credential or provider action
was needed for this pure parser correction. Fresh isolated evidence:
`artifacts/vision-selection-correction-f15p2z2v/`.

Correction manifest (four, within the existing 18-file slice):
`src/features/receipt-image/short-receipt-parser.ts`,
`src/features/receipt-image/short-receipt-parser.test.ts`, this checkpoint and
`docs/AI_HANDOFF.md`. Historical live freeze/request hashes/scores/results and
all 454 provider/benchmark files plus the consumed local reservation are
byte-identical. The changed parser intentionally no longer matches its historical
live-source hash; the original freeze is not rewritten. Existing live-result and
QA-artifact limitations remain unchanged. This is mock evidence, not proof the
consumed real receipt now extracts correctly. No further call is authorized.
Next gate: separate local Vision receipt integration checkpoint review.
