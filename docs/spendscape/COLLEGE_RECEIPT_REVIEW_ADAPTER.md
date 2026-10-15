# College receipt-to-review adapter — offline checkpoint

2026-10-04. Bounded implementation with fictional observations only. Ready for
separate checkpoint review; no consumer wiring, provider call, commit or push.

## Contract and behavior

`receipt-review-adapter.ts` exposes `validateReceiptObservations`,
`receiptToReviewDraft` and `prepareReceiptReview`. The adapter receives no
repository or provider client; compatibility checking receives the existing
injected merchant/place context. There is no fixture lookup or name matching.

Observations are bounded plain objects with explicit string/null/ambiguous
candidate values. Core keys are present even when their value is null; tax,
discount and barcode keys can be omitted. Values remain strings, with no OCR
character repair, inferred currency, inverse unit-price calculation or amount
replacement. Unknown keys, media/provider payloads, malformed observations,
control characters and complete invalid barcode identities fail closed with a
fixed error code. Limits: 50 lines, 500 characters per observed string, two to
five alternatives per ambiguous value. Financial semantics use the existing
stricter review limits, not these structural limits.

The detached observation copy preserves merchant/address, printed date/time,
currency/total, all line facts, alternatives and optional tax metadata. Editable
review fields use the existing names and string representation. Unresolved units
have an explicit empty value, not a default item/kg. Every line retains a separate
editable `printedAmount`; corrections leave the original observation intact.
No observed fact is promoted to a product/demo, merchant, place or coordinate ID.

Merchant/place, payment, category and channel stay blank until explicit review.
Printed wall-clock date/time stays in observations; the existing save model
requires UTC minutes, so its date stays blank until explicit UTC confirmation.
No timezone, midnight or current date is invented. Unsupported currencies and
units remain preserved observations with unresolved review fields. Foreign
currency still requires an explicitly reviewed ILS amount; no fixture FX.

Pre-VAT, VAT amount/rate and barcode identification are optional and do not gate
core saving. Complete supplied barcodes use the existing checksum/normalization
validator; missing/ambiguous codes remain unassigned. Valid per-line identities
stay in the draft sidecar, not a fabricated purchase-level Scanner B identity.
An absent discount stays absent; supplied null/ambiguity becomes unresolved.
Explicit zero is retained. Gross unit price, discount and printed net amount
remain separate, including fully discounted lines and weighted half-up rounding.

`prepareReceiptReview` delegates required context, calendar, precision, quantity,
discount and basket validation to `validateReview`. It additionally compares
each printed line amount with the calculated net using integer minor units;
errors prevent projection even when the computed basket would pass the old
validator. No fee, tax or missing discount is inferred to reconcile a mismatch.
Ready output is a whitelisted `PurchaseReviewInput` with receipt/user-reviewed
provenance. Preparing or editing it never creates a purchase. Only the existing
explicit save boundary creates the record; Undo/duplicate/operation behavior is
unchanged. Optional taxes are neither a calculation input nor a reconciliation
requirement. Historical OCR acceptance and scores are unchanged.

## Measured offline QA

Fictional one-item ILS 12.50 mock: two units at 6.25. Separate 15-item ILS 41.00
mock: two breads at gross 3.25 minus explicit 0.50 whole-line discount = 6.00;
0.375 kg at 24.00 = 9.00; thirteen 2.00 lines = 26.00. Includes repeated and
Hebrew/mixed labels. These are new mocks, not provider output or benchmark truth.

- New adapter tests: **38/38 passed** within the combined executions.
- Focused adapter/session/local-store/comparison/repository tests:
  **84/84 passed in five files**, final execution, zero failures/skips.
- Full `npm test`: **248/248 passed in 17 files**, zero failures/skips.
- `npm run typecheck`: passed. The unwired files are outside the current
  tsconfig roots, so a separate strict TypeScript invocation targeting both new
  files also passed (ES2022, bundler resolution, no emit, unused checks).
- Tests cover optional VAT/barcodes, required unresolved fields, Hebrew and
  repeated labels, weighted rounding, explicit/zero/invalid discounts, printed
  line mismatch, total mismatch, missing date/time/price, unsupported currency/
  unit, explicit merchant/place selection, foreign ILS, barcode normalization/
  rejection, strict payload validation and malformed edited drafts.
- Completed one/15-item outputs pass existing `validateReview`, `reviewedRecord`
  and strict v2 local-store JSON round trips. Explicit saves retain duplicate
  protection, consumed operation IDs and Undo. Canonical baseline remains
  42 purchases, 12 places/pins, ILS 6,777.38; confirmed existing-place additions
  keep 12 pins, online/unresolved additions add none. No baseline mutation.
- A guarded mock test blocks fetch, browser storage and console log/error/warn
  during adaptation/preparation and observes zero calls. Source has no
  transport, credentials, media, logging, persistence or timer code.
- Initial targeted execution: 36/37 passed; one mock used `.label.he` instead
  of the merchant type's `.name.he`. Corrected the test. Initial explicit test
  typecheck also exposed the fixture object's missing repository `source`;
  tests now load the proper repository snapshot. Assertions were not weakened.
- `git diff --check` and new-file whitespace checks passed. No build/browser/
  rendered/device QA was needed or run: there is no consumer import/UI change.
  Single MapLibre/camera source behavior is byte-identical, not freshly exercised.

## Remaining integration constraints

This is a core draft adapter, not receipt-photo ingestion or a Capture feature.
The existing PurchaseReview UI cannot display unknown units, original merchant/
address/time observations or editable printed line amounts. Future separately
approved wiring must expose these and use the extra compatibility gate before
the existing explicit review/save boundary; `validateReview` alone cannot detect
printed-line discrepancies. UTC conversion/confirmation needs deliberate UX.

Current persistence supports only reviewed canonical records. It has no fields
for original merchant/address text, raw observations, optional taxes or per-line
barcodes. These remain transient sidecar data; the adapter does not expand the
envelope or promise to persist them. Unknown merchants require explicit use of
the existing unresolved merchant context or an explicit valid canonical choice.
An unresolved channel has no place/pin. No new merchant/place creation is added.
Projected records retain reviewed gross/discount/net facts after reconciliation.

No live OCR/model accuracy, 10–15-item recognition, label accuracy or physical
device acceptance is established. Existing Gemini/Groq/Vision locks, freezes,
responses and scores remain unchanged. Vision attempt 3 stays field-review-
required, fullSuccess false; optional VAT does not retroactively rescore it.

## Exact task manifest and Git safety

1. `src/features/capture/receipt-review-adapter.ts` — new pure adapter.
2. `src/features/capture/receipt-review-adapter.test.ts` — new fictional tests.
3. `docs/spendscape/COLLEGE_RECEIPT_REVIEW_ADAPTER.md` — this new checkpoint.
4. `docs/AI_HANDOFF.md` — pre-task content preserved; appended adapter status.

Existing unrelated dirty/untracked benchmark work is not part of this task.
Ignored evidence in `artifacts/spendscape-receipt-review-adapter/` records
pre-task hashes, handoff prefix and Git status. All **219** protected pre-existing
source/benchmark/artifact/package/generated files still match their pre-task
SHA-256 hashes; no consumed lock or historical evidence changed.
The existing Vision validation freeze also verifies all 63 pinned dependencies
and five wrapper files with zero mismatches, including older provider evidence.

Branch `feature/spendscape-rebuild`; HEAD
`e7f05f80543623182a6cc5c8d49101dc9e75c421`. Main/origin-main both
`eee0d26b55e5061f87ac664938df0c195800b74f`. Cached upstream
`origin/feature/spendscape-rebuild` is
`66fb4204154c88789e9e0401e317f9000b6b5e18`, ahead 6/behind 0, no fetch.
Index empty; next-env.d.ts matches HEAD and its pre-task bytes. No application
UI/store/schema/dependency edit, server, provider/credential/account action,
staging, commit, push or deployment.

## Strict-array correction — 2026-10-04

The separate checkpoint review found one Medium runtime-boundary defect despite
84/84 focused tests passing. Independent direct-JavaScript controls reproduced
a sparse line array passing validation and returning ready:true, then failing
the existing local-store validator. An extra array property also survived in the
observation copy. Ordinary parsed JSON cannot contain those shapes; the public
adapter and edited-draft boundary nevertheless must fail closed for direct callers.

Under the user's separate strict-array correction approval, one bounded dense
array validator now guards observation lines, ambiguous candidates and edited
review lines. It requires each own index to be enumerable data and rejects
holes, inherited entries, extra string/symbol/hidden keys, accessors and custom
array prototypes before iteration or cloning. Existing 50-line and two-to-five
candidate limits remain; valid frozen arrays continue to work. No fact, required
field, arithmetic, optional-VAT rule or downstream save/store boundary changed.

Fresh correction QA: **75/75 adapter tests** and **121/121 focused tests in five
files**, zero failures/skips. Includes 37 new controls: twelve malformed-array
shapes at each of the three boundaries, plus dense/frozen 50-line storage and
candidate-bound controls. Accessor fixtures throw if accessed; rejection never
invokes them. Sparse arrays cannot produce a ready projection and unexpected
array payloads cannot enter a cloned draft. All original one/15-item, VAT,
barcode, printed-line, context, discount, Undo and persistence controls still pass.
Project typecheck and separate strict adapter/test typecheck passed. Whitespace
checks passed. No new full-suite/build/browser/server/device run; the earlier
248-test full result above records initial implementation evidence only.

Correction manifest remains the same four files: adapter, tests, this checkpoint
and append-only handoff. Pre-correction copies are ignored under
artifacts/spendscape-receipt-review-adapter/strict-arrays/. All 219 original
protected files and 63 pinned historical dependencies/five Vision wrapper files
remain byte-identical. Git refs/index/next-env, unrelated work and all provider
locks unchanged; no provider call, schema/UI/dependency edit or publication.
The Medium issue is corrected with mock evidence; a fresh separate review is
still required. Consumer wiring and live extraction remain gated.

Next gate: **APPROVE SPENDSCAPE COLLEGE RECEIPT-TO-REVIEW ADAPTER CHECKPOINT REVIEW**.
This gate does not authorize consumer integration or live extraction.
