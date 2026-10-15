# College final payable total — offline checkpoint

## Result and approved policy

Implemented locally, uncommitted, for separate checkpoint review. A receipt
with user-reviewed provenance treats its positive final payable amount as the
purchase total, independently of the sum of valid product lines. EN/HE review
and saved purchase details show both totals and a nonblocking difference notice.
No receipt-level discount field, allocation or inferred explanation is required.
Synthetic demo receipts and non-receipt inputs retain their existing basket
reconciliation rule. Invalid quantities, units, gross prices, line discounts,
printed line amounts and purchase amounts still block saving. Invalid item
arithmetic now reports item errors without the obsolete basket-equality message
on reviewed receipts; an independently invalid payable retains its amount error.

The user's future reference has five product rows, seven units, printed date
30/09/2013, item sum ILS60.55 and payable ILS60.50. This task uses fictional
controls with that same arithmetic shape, not a transcript or provider result.
A save stores 60.50 only after explicit review; printed product facts remain
unchanged and their sum remains 60.55. Barcodes stay unknown. Promotions are not
mock purchase rows. No extraction quality claim is made about the real image.

## Data and compatibility

Existing source/provenance distinguish the receipt policy. The strict v3
IndexedDB envelope, purchase/directory atomic writes and revision guard are
unchanged. No migration or new persisted metadata is necessary: originalAmount
holds the reviewed payable; each item's lineTotal retains its reviewed printed
amount after strict per-line reconciliation. Existing records keep their bytes
and meaning; v1/v2 validation remains read-only and unknown versions fail closed.
Original observations remain separate in the transient draft, not persisted.

Product totals are summed as integer currency minor units (JPY factor1, other
supported currencies factor100). Purchase/Analytics/place-spend totals continue
to use payable originalAmount and the existing ILS authority. A foreign addition
still requires the user's explicit reported ILS amount; no synthetic FX is used.
Purchase detail exposes the product sum separately. No global basket arithmetic
or fixture is rewritten. Printed differences in either direction are notices,
not manufactured discounts or charges.

Explicit context, merchant/place and timezone confirmation remain required.
Unresolved fields are not replaced with zero. Duplicate warning/override,
consumed operation IDs, durable save, Undo and cancellation remain intact.
Baseline42 purchases/12 pins, a single mounted MapLibre and one pin per existing
physical place are verified. Reviewed receipts do not qualify as synthetic
Nearby comparison evidence. Camera/barcode/Ask/Replay/navigation code is unchanged;
this is focused receipt regression evidence, not a new full application audit.

## Exact task manifest (13 files)

1. src/features/capture/session-purchase-domain.ts — scoped receipt total policy and invalid-line feedback.
2. src/data/spendscape-globe.ts — integer minor-unit item sum helper.
3. src/features/capture/ReceiptPayableSummary.tsx — new shared EN/HE review/detail totals and notice.
4. src/features/capture/PurchaseReview.tsx — editable payable label and observed printed-line summary.
5. src/features/globe/SpendscapeGlobe.tsx — saved user-reviewed item/payable summary.
6. src/features/capture/receipt-review-adapter.test.ts — superseded basket equality expectation only.
7. src/features/capture/final-payable.test.ts — new14 focused domain/storage/derived/Undo tests.
8. src/features/receipt-image/direct-image-compatibility.test.ts — superseded save-readiness expectation only; strict provider schema unchanged.
9. qa/final-payable-mocks.ts — new fictional five-row/seven-unit control.
10. qa/spendscape-final-payable.spec.ts — new6 production-browser controls.
11. docs/spendscape/COLLEGE_FINAL_PAYABLE_TOTAL.md — this checkpoint.
12. docs/spendscape/COLLEGE_GEMINI_REJECTED_FIELDS.md — appended policy supersession only.
13. docs/AI_HANDOFF.md — appended verified result only.

This is the task delta against the dirty entry snapshot, not the cumulative
Git diff. Earlier adapter/UI/direct-image/recovery/research work is preserved.
No storage implementation, provider request builder/schema, transport, old
launcher, freeze, reservation or account setting is changed by this slice.

## QA actually measured

Fresh ignored evidence: artifacts/final-payable-4436jwo9/.

- Final guarded sequential10-file Vitest run: **195/195**,10/10 files,
  unit-complete.json/log. Includes14 new tests, receipt adapter/domain,
  storage/directory, nearby, canonical data/Analytics and Gemini diagnostics/
  compatibility. No live transport.
- App typecheck and focused strict new-test/new-QA typecheck: **passed**,
  typecheck-complete.log and typecheck-focused-complete.log. This does not
  claim a clean full strict QA typecheck (historical Scanner E error remains).
- Final production build: **passed**, build-complete.log.
- Fresh final-code combined production-browser run: **23/23**,47.7s,
  browser-verified-report.json/log. Six new tests plus17 unchanged receipt
  integration regressions; the latter copied to this ignored directory only
  to redirect screenshot output/import paths. No assertions/timeouts weakened.
- Editing, printed-line error/focus visibility, explicit save/double-submit,
  exact v3 save/reload, preserved five rows/seven units/both totals/date,
  duplicates/override, Undo and cancellation checked. Missing facts/foreign
  context and15-line existing integration regression controls passed.
- Browser provider modes/credentials disabled. No POST/provider/OCR requests,
  page errors or synthetic receipt content in console/URLs/history/localStorage/
  sessionStorage observed. Explicitly reviewed facts go only to IndexedDB.
- Ten final synthetic screenshots inspected under visuals-verified/: review
  and saved detail at360x640 EN/HE,390x844 HE,430x932 EN and1280x844 EN.
  Totals/notice/sticky actions remain readable; no horizontal overflow.
  Reduced-motion preference applied. Focused feedback/RTL checks are not a
  comprehensive assistive-technology or physical-device audit.

Earlier reports retained honestly: initial145/146 exposed a new test helper's
missing places argument; expanded194/195 exposed the obsolete compatibility
expectation. Both corrected in tests only. Intermediate195/195 and23/23 runs
also retained. The final rerun first stopped23/23 at Chrome launch due to sandbox
EPERM, before application assertions; unchanged suite with required local browser
permissions then passed23/23. No timeout/assertion changes. Historical direct-image
30ms pre-dispatch timing variability was not addressed and is not claimed fixed.

Reproduction (offline units):

```sh
NODE_OPTIONS='--import ./qa/receipt-p2d/offline-guard.mjs' ./node_modules/.bin/vitest run src/features/capture/final-payable.test.ts src/features/capture/receipt-review-adapter.test.ts src/features/capture/session-purchase-domain.test.ts src/features/local-purchases/local-purchase-store.test.ts src/features/local-purchases/local-directory.test.ts src/features/nearby-demo/comparison.test.ts src/data/spendscape-data.test.ts src/data/spendscape-analytics.test.ts src/features/receipt-image/gemini-error-diagnostic.test.ts src/features/receipt-image/direct-image-compatibility.test.ts --no-file-parallelism
```

For production browser reproduction use an unused artifact destination and
loopback production server with all native/fictional provider modes disabled;
SPENDSCAPE_PAYABLE_QA_OUT is required. The recorded config is
artifacts/final-payable-4436jwo9/playwright.verified.config.ts. Do not regenerate
historical outputs or run a provider launcher.

## Git, preservation and remaining gate

Branch feature/spendscape-rebuild; HEAD25e69201a3f0c64e4b6d7e9af7f41e68fac06f84.
Main/origin-main eee0d26b55e5061f87ac664938df0c195800b74f; cached origin feature
66fb4204154c88789e9e0401e317f9000b6b5e18 (17 ahead/0 behind; no remote fetch).
Index empty, working tree intentionally dirty. Entry next-env.d.ts bytes retained
(SHA2561862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b).
Owned QA servers stopped; localhost3130 released. Final entry-hash comparison
covers15,657 snapshotted files, including historical ignored evidence. Only
listed task files may differ; final verification is verification-final.json.
New artifacts ignored, no dependency/generated file added to the task manifest.

This policy supersedes the earlier receipt-level-discount save blocker in the
Gemini assessment/handoff; historical scores and provider rejection conclusions
remain unchanged. Real extraction is still unverified. There was no real-receipt
save/reload, provider request, credential access, billing or Vercel action.
All consumed reservations remain consumed; original stopped second slot remains
stopped. No commit, push or deployment. Review this offline checkpoint first;
any future inference needs separate authorization, new exclusive reservation,
current readiness/cost verification and explicit user review before saving.

Proposed next approval: APPROVE SPENDSCAPE FINAL PAYABLE TOTAL CHECKPOINT REVIEW.
