# College receipt image → review — local checkpoint

Date: 2026-10-05. Bounded implementation and local QA only, starting at
`5253f5ab026484646d853f90a0328904a92a83e0` on `feature/spendscape-rebuild`.
The local merchant/place slice is committed at that HEAD. This new slice is
uncommitted and requires separate checkpoint review.

## Result and boundary

Capture’s existing source chooser now offers explicit receipt photo/file intake.
The camera screen, controls and keyboard loop are byte-identical to entry/HEAD. The native file picker
uses `capture="environment"` only on the photo action; the application does not
request a second MediaStream. JPEG/PNG inputs are checked before preview: up to
4 MiB, 32–6,000 pixels per side and 12 million pixels. HEIC/PDF are unsupported.
No image is sent anywhere by this implementation. Ordinary users receive an
honest recognition-unavailable state; choosing an image never creates a purchase.

The server-only `/api/receipt-ocr` boundary has no provider transport or
credential access. A local mock requires all of: server environment switch
`SPENDSCAPE_RECEIPT_IMAGE_QA=1`, loopback Host/internal URL, same-origin request,
explicit client `?receiptImageQa=1`, and a fixed QA header. It accepts only a
128-byte-bounded `{fixture:"one"|"fifteen"}` selector. It never accepts images,
filenames, user OCR or arbitrary provider payloads. Responses are no-store;
the client response limit is 64,000 bytes. Hosted/non-opted requests cannot
receive synthetic results. The QA panel explicitly labels fictional OCR as
independent of the selected image: this is plumbing evidence, not recognition.

Validated mocked word geometry → provider-neutral parser → runtime-validated
ReceiptObservations → receiptToReviewDraft → existing editable review.
prepareReceiptReview still blocks discrepancies and incomplete context before
explicit save. Original observations remain detached from corrections. Printed
local time requires the existing explicit timezone confirmation; merchant/place,
payment/category/channel remain user choices. No fixture merchant is inferred.
The unchanged v3 IndexedDB schema atomically persists only reviewed purchases and
directory changes. Optional VAT/barcodes do not block drafting or saving.

## Supported parsing and limits

Supports exactly one aligned item table with explicit printed column headers:
Item/פריט, Qty/כמות, Unit/יחידה, Price/מחיר, Amount/סכום, optional
Discount/הנחה. Header facts use colon-labelled Merchant/בית עסק,
Address/כתובת, Date/תאריך, Time/שעה, Currency/מטבע, Total/לתשלום/סה״כ;
optional English VAT headers are retained when observed. Rows and columns derive
from word geometry and printed anchors, never fixed receipt inspection regions,
expected answers, profiles or historical provider responses. Maximum 50 item
rows, 1,500 words and strictly validated finite geometry.

Preserves words and numeric characters. Adjacent incomplete decimal/date/time
fragments can concatenate only under bounded geometric/format checks. Competing
complete numbers, column-crossing boxes, missing values and conflicting header
facts stay unresolved. Raw malformed facts remain visible for correction; no
O→0 replacement, arithmetic repair, inferred currency, quantity, unit price,
discount, identifier, location or inverse calculation occurs. Explicit `יח׳`
and `ק״ג` project to item/kg in editable review while original strings remain.
Printed gross price, discount and net amount remain distinct facts.

This is not a general receipt recognizer. Unlabelled tables, multiple tables,
multiline/wrapped item rows, merged OCR words, arbitrary column/header synonyms,
rotation/skew and more complex discount layouts require later evaluation or
manual correction. Unsupported structure fails closed. No barcode is extracted:
receipt IDs and internal item codes remain text, never verified product barcodes.
Fictional one-item and 15-item English/Hebrew fixtures include repeated items,
weighted quantity and explicit discount. They are independent of historical
P2A/P2B/P2D/Groq/Vision fixtures, freezes and scores.

## Lifecycle and privacy

One current transient input and one logical job generation per mounted intake. A generation token rejects
obsolete inspection/OCR completion after Back, Escape, Close, replacement,
Discard, timeout or unmount. Validation/reading each have a 15-second client
bound; server QA has a 10-second bound. No automatic retries. Previews are revoked,
File/state references and timers cleared; decoded ImageBitmap closes in finally,
and temporary header byte arrays are zero-filled. Browser-native file reading
and createImageBitmap cannot be interrupted mid-operation: late decode is closed
as soon as available and cannot create a preview/draft. No instantaneous native
memory-release guarantee is claimed; superseded native reads/decodes may briefly
overlap until completion. File chooser cancellation without selecting
a replacement keeps the currently selected image until explicit Discard/leave.

No photos, raw OCR, credentials or provider payloads enter storage, logs, URLs or
history. Only the already-approved reviewed purchase data persists. Existing
MapLibre tile requests remain unchanged. Server-only mock fixtures are absent
from production client chunks. This task did not read the real receipt image,
call providers, change accounts/billing, install dependencies or deploy.

## Local reproduction

Ordinary flow: Capture → Choose another source → Receipt photo/upload → explicit
native photo/file choice → Read receipt (honestly unavailable; image discarded).
The original camera/barcode screen remains unchanged.

Local fictional plumbing only: build, then run
`SPENDSCAPE_RECEIPT_IMAGE_QA=1 npm run start -- --hostname 127.0.0.1`, open
`http://127.0.0.1:3000/?receiptImageQa=1`, choose the explicitly labelled 1/15-item
QA fixture, and select only a fictional JPEG/PNG for testing. This does not
recognize the selected photo. The checked-in production spec is
`qa/spendscape-receipt-image.spec.ts`, using `playwright.phase2a1.config.ts`.
Review runs should relocate artifact paths into a fresh ignored directory;
this task's QA copies changed only imports/output destinations. Their hashes,
configs, reports and runtime source hashes are retained with the local evidence.
No live transport can be activated by these commands.

## QA evidence

Fresh isolated output: `artifacts/spendscape-receipt-image-39zuu_ur/` (ignored).

- Final application typecheck passed; separately strict-compiled the new browser
  spec and four new unit specs. This does not claim the legacy Scanner E history
  probe TS2556 was corrected or all historical QA files strict-compile.
- Final unit suite: **344/344**, 23 files; focused image suites: **37/37**.
- Production build passed (`build-focus-center.log`), including the disabled/mock API.
- Earlier focused production-browser run: **13/13**, 33.1 seconds, before
  placement/focus corrections. Final new-path checks are included in the combined run.
- Combined final production-browser suite: **127/127**, 404.6 seconds (6.7 minutes),
  nine suites, zero retries/skips/flaky. Final new path 13/13; Capture 5/5,
  P2C 13/13, data boundary 4/4, local directory 12/12, nearby demo 10/10,
  prior receipt review 17/17, Scanner A 20/20 and Scanner B 33/33..
- Screenshots inspected: intake and arithmetic correction in EN 360×640,
  HE 360×640, HE 390×844, EN 430×932 and EN desktop 1280×844. Dark layout,
  RTL, visible field error/focus, scrollable long review and no page overflow.
  Final synthetic screenshots are retained in this slice's evidence-fixed
  directory; earlier focused images remain in evidence-second. Earlier checkpoint
  output paths are not used.

New browser checks exercise image → actual local mock route → 1/15-item review,
printed mismatch correction, explicit timezone/place/payment/category, durable
save/reload, duplicate prevention, double-submit, Undo, cancellation/late response,
replacement, malformed output, timeout, unavailable ordinary path, invalid/large
image and transition from the sole barcode stream. Baseline 42 purchases, 12 pins
and one mounted/constructed MapLibre instance; neighboring local directory,
receipt integration, discounts, synthetic comparison, Capture, Scanner A/B and
data-boundary suites are included in the combined run.

Failures preserved: initial unit harness had an obsolete repository import and a
fixture mutation that targeted the line amount instead of the footer; corrected
without weakening assertions. First focused browser aggregate **6/12** exposed an actual
mock origin mismatch: Next's internal request URL was localhost while browser
Host/Origin was 127.0.0.1. The handler now checks the loopback browser Host origin,
with a deterministic regression. No timeout or assertion was relaxed. The final
focused run adds the sole-stream transition check. The original failed browser log remains.

The first combined run was **126/127** (7.0 minutes): Scanner B
`barcode entry, review and camera at 360x640` timed out at its unchanged full
viewport assertion for Enter barcode. The new receipt button had added a third
row above the barcode panel. It was temporarily moved after that panel to
restore the two-row camera actions. The placement experiment passed the
360 test (1/1, 4.9 seconds) but its next aggregate was **125/127** (7.3 minutes):
adding an action after the barcode panel changed the accepted Hebrew keyboard
loop, and one duplicate-warning check unexpectedly reached a second saved mock
purchase. Final design removes the new camera action entirely and places intake
in the existing source chooser. CaptureCamera is unchanged and outside the final
manifest. Original narrow camera and Hebrew loop assertions passed (2/2) in the
next focused check. No scanner assertion/timeout was changed.

The duplicate-check failures are now diagnosed as a QA fixture-selection race.
The helper previously counted the opt-in selector immediately after mounting and
skipped selection when its effect had not rendered yet. Both failed traces show
request selectors `one` (cancelled), `fifteen`, `one`, `fifteen`. The final stronger
comparison exposed a previously saved 12.50 one-item purchase versus a new 41.00
15-item draft: these are different purchases, so no duplicate warning was due.
Safe selector/status metadata and both trace hashes are retained in
`fixture-race-evidence.json`; no provider evidence was involved. The helper now
waits for the QA selector and verifies its intended value; ordinary mode explicitly
skips QA. Original warning/count assertions remain, with added item-field/amount
consistency checks. Before diagnosis, one focused pass and five repetitions had
passed incidentally; they were not treated as proof against the failure. A
separate five-repeat verification passed after the correction (5/5, 22.5 seconds). The deterministic
15-item domain test also verifies duplicate/consumed-ID behavior through Undo.
No duplicate/persistence domain implementation changed.

New focused-action checks also exposed preview-load layout timing: focus initially
remained off-screen, then nearest scrolling left a fractional edge clipped.
The intake now reveals the focused Read button after layout and image load,
without stealing focus from another control; its animation frame is cancelled
on stage exit/unmount. Final assertions require focus and full viewport visibility.
The failed focused checks remain. No timeout/assertion was relaxed.

No physical iPhone/photo-picker/HEIC/camera behavior, OCR quality, live provider
latency or general receipt accuracy is established by desktop Playwright.

## Exact intended 19-file manifest

- `docs/AI_HANDOFF.md`
- `docs/spendscape/COLLEGE_RECEIPT_IMAGE_REVIEW.md`
- `qa/spendscape-receipt-image.spec.ts`
- `src/app/api/receipt-ocr/route.ts`
- `src/features/capture/CaptureExperience.module.css`
- `src/features/capture/CaptureExperience.tsx`
- `src/features/capture/capture-domain.ts`
- `src/features/capture/receipt-review-adapter.ts`
- `src/features/receipt-image/ReceiptImageIntake.tsx`
- `src/features/receipt-image/image-input.test.ts`
- `src/features/receipt-image/image-input.ts`
- `src/features/receipt-image/image-session.test.ts`
- `src/features/receipt-image/image-session.ts`
- `src/features/receipt-image/ocr-boundary.test.ts`
- `src/features/receipt-image/ocr-boundary.ts`
- `src/features/receipt-image/ocr-fixtures.ts`
- `src/features/receipt-image/ocr-parser.test.ts`
- `src/features/receipt-image/ocr-parser.ts`
- `src/server/receipt-ocr.ts`

## Git and remaining gate

- Branch `feature/spendscape-rebuild`; HEAD unchanged at
  `5253f5ab026484646d853f90a0328904a92a83e0`.
- Main and origin/main unchanged at `eee0d26b55e5061f87ac664938df0c195800b74f`.
- Upstream `origin/feature/spendscape-rebuild`, cached ref unchanged at
  `66fb4204154c88789e9e0401e317f9000b6b5e18`; ahead 9, behind 0. No fetch/remote
  publication occurred; this is a local ref report.
- Index unchanged from entry; no staged changes. Exactly the 19 intended files
  differ or are newly created, alongside preserved entry untracked benchmark work.
- All 536 entry file hashes checked: no missing files or changes outside the
  manifest. This includes 153 provider/receipt QA source/evidence files with zero
  byte changes. Historical handoff body below the current status is unchanged.
- `next-env.d.ts` matches entry and HEAD exactly; SHA-256 `1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b`.
- All owned QA servers stopped; no port-3000 listener. Build/typecheck/QA output
  is ignored and excluded. A temporary copied Scanner A `path.join` output mistake
  wrote 60 new screenshots under a worktree-local `Users/...` mirror; all were
  moved into this unique ignored evidence folder with byte hashes verified and
  empty generated directories removed. Exact moves: `qa-output-relocation.json`.
  No entry file was removed or overwritten by that relocation.
- No dependency, persistence schema, account, provider, stage/commit/push/deploy,
  merge/rebase or protected branch change.

Next gate: `APPROVE SPENDSCAPE COLLEGE RECEIPT IMAGE TO REVIEW CHECKPOINT REVIEW`.
Live activation remains separate: choose and explicitly authorize one bounded
transient image request contract and server-only OCR provider transport,
credentials/privacy/budget controls and
representative transcription/parsing validation. The current QA-only selector
route cannot become real OCR merely by supplying a credential or enabling a
switch; actual image transmission is not implemented. Then separately authorize any
real transmission and deployment. Current mock path provides no evidence of real
photo extraction, multi-item provider accuracy or general product OCR readiness.
All historical provider reservations remain consumed; no approval here resets
or reuses any call allowance. D1's negative recommendation remains unchanged.


## Bilingual labels and header ambiguity correction — 2026-10-05

The independent checkpoint review found two Medium parser defects despite the
initial passing aggregate: English header language reversed separate Hebrew
words, and an unresolved repeated header was omitted while another value appeared
resolved. Both could reach a save-ready projection after context completion.
The original review and failed synthetic regression probes remain unchanged in
`artifacts/receipt-image-review-nsnsg3en/`; no provider output was reconstructed.

Under the separate bounded correction approval, label ordering now uses the
observed content scripts and word geometry, independently of table/header keys.
Hebrew words read right-to-left; contiguous Latin runs retain left-to-right order;
each word's characters remain intact. Overlapping boxes remain unresolved.
This is a conservative supported-layout rule, not general bidirectional OCR
or complex mixed-script layout qualification. No text is translated or repaired.

Recognized labelled header occurrences now retain null reconstruction results.
Any unresolved occurrence keeps that field unresolved even alongside a valid
repeat, independent of repeat order. Identical resolved repeats remain resolved;
conflicting resolved values remain alternatives. Raw malformed singleton values
remain observed strings. No expected-answer/arithmetic selection is introduced.
Optional unresolved VAT remains optional and does not block core preparation.
Required unresolved totals leave the review amount blank until explicit entry;
missing/ambiguous dates retain the existing explicit date/time correction gate.

Fresh correction QA:
- Focused image unit suites: **55/55** (18 additional parser controls).
- Full unit suite: **362/362**, 23 files.
- Independent original-review-derived regression/impact controls: **6/6**;
  the two originally failing required-behavior checks now pass, and ambiguous
  totals no longer produce a ready projection without explicit correction.
- Application typecheck, strict new-spec/unit-spec compilation, production build,
  tracked/new-file whitespace checks passed.
- New EN/HE production-browser cases: **2/2**, 5.2 seconds.
- One fresh combined production-browser run: **41/41**, 117.8 seconds,
  no skips/retries/flaky failures: Capture 5, data boundary 4, image intake 15,
  existing receipt review 17. This is focused neighboring verification; it does
  not replace or describe the original 127-case aggregate as a fresh rerun.
- EN/HE 360x640 ambiguity states show visible focused amount errors; original
  Hebrew observations remain separate after editing. No save occurs before
  explicit total entry; corrected save and durable Undo succeed. Existing
  one/15-item save/reload, duplicates, discounts, timezone/location, cancellation,
  privacy, baseline 42/12/12/ILS 6777.38 and one MapLibre checks remain passing.
- Inspected new 360 EN/HE header-error screenshots and current 390 HE /430 EN
  line corrections and desktop1280 intake. No physical-device/native-picker or
  live OCR accuracy claim. No browser timeout/assertion relaxation.
- First focused unit run: 49/55, six new tests used `review.items` instead of the
  existing `review.lines` field. Corrected only that test helper property; label
  assertions already passed. The failed log is retained, followed by green runs.

Correction changes only five files within the unchanged 19-file checkpoint:
`src/features/receipt-image/ocr-parser.ts`, its `.test.ts`,
`qa/spendscape-receipt-image.spec.ts`, this checkpoint and `docs/AI_HANDOFF.md`.
Fresh isolated evidence: `artifacts/receipt-parser-correction-hx455irl/`.
Historical provider files/evidence/locks, fixtures, image lifecycle/server/client
transport, consumer UI, save/store schema and scanners remain unchanged.
HEAD/main/upstream/index and unrelated work are preserved; next-env matches exact
entry/HEAD, owned server stopped, generated output ignored. No credential,
provider/account/dependency, staging/commit/push/deployment action.

The correction is complete locally, not independently re-reviewed. Next gate:
`APPROVE SPENDSCAPE COLLEGE RECEIPT IMAGE TO REVIEW CHECKPOINT REVIEW`.
Real recognition remains disabled; no call allowance or historical score changes.
