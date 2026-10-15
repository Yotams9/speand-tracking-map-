# College receipt prefill and save blockers — offline checkpoint

2026-10-09. HEAD `52902b13a8493ed616cc35ccb084a3edeecaf590`,
`feature/spendscape-rebuild`. Implementation and synthetic local QA only;
all changes remain uncommitted. Evidence: `artifacts/receipt-prefill-d37rrqyn/`.

## Mapping audit and bounded correction

| Boundary | Verified result |
| --- | --- |
| Observations → editor | The preceding compatibility changes already convert strictly validated four-digit ISO/DMY dates and narrowly recognized ILS notation. The real page still has the earlier loaded code: its empty fields are not evidence that current conversions failed. Product descriptions, quantities, prices, printed amounts and final payable already map into editable controls. Originals remain separate. |
| Partial date/time | A datetime-local control cannot display a date or time alone. Separate controls now preserve any supported observed part; users complete only the missing part. No date, time, century or timezone is inferred. Editing either control resets confirmation; explicit timezone/clock-change confirmation remains required. |
| Merchant | The existing explicit new-merchant action now prefills the observed name. Users can correct it, choose the merchant category and explicitly save. No automatic fixture matching, IDs or directory writes occur before the validated save boundary. |
| Address and place | The editable address feeds the transient summary and explicitly opened place form. Coordinates remain blank and confirmation false. A receipt draft starts with the existing unresolved channel (`unknown`), no place or pin. Changing to physical and back preserves the corrected merchant proposal but removes the place proposal. |
| Save readiness | The visible blocker list comes from the actual `prepareReceiptReview` result. Presentation coalesces dependent quantity/line errors while a unit is missing; focus goes to the required unit. Invalid quantities, printed-line arithmetic, discounts and all underlying errors/validators are unchanged. |
| Summary | Observed merchant pending confirmation, corrected address, printed local clock pending timezone, unresolved location and explicit missing context replace generic summary placeholders. Select controls still have empty-choice options where a user decision is required. |
| Financial/save boundary | Product values and final payable remain independent; a line-sum/payable difference is nonblocking. Explicit Save, duplicate confirmation, atomic IndexedDB writes, reload and eight-second Undo retain their existing boundaries. |

No Gemini model, prompt, JSON mode, request builder, transport, parser, reservation,
financial validator or persistence schema was changed. No extraction was rerun.

## Remaining contract limits

VAT, pre-VAT and absent barcodes do not block saving. Unknown location is supported
without coordinates or a pin. Selecting an existing unresolved merchant remains an
explicit user action; observed names are never silently mapped to it.

Purchase payment requires `card`, `cash` or `manual`; `manual` is not an unknown
payment. Purchase and new-merchant category require `groceries`, `food`, `retail`
or `travel`. Item units require `item` or `kg`. A valid purchase timestamp requires
a known date/time and explicit timezone confirmation. These facts are not fabricated;
if genuinely unknown, saving remains blocked. Supporting unknown values in those
fields requires separate versioned contract/domain work.

An unresolved-location purchase has no persisted address field. The corrected address
is preserved in the transient draft; it can be stored as part of an explicitly
confirmed physical place through the existing directory flow. Persisting an address
without a place would require a separately approved storage contract change. Original
observations, printed identifiers, tax metadata, photo and timezone choice do not
enter purchase storage.

## Actual QA

- Guarded focused unit/domain suite: **264/264**, nine files. Includes adapter,
  strict editor conversions, readiness, timezone, final-payable, structured output,
  session domain, IndexedDB and native structured-boundary regressions.
  Reports: `unit-final.json`, `unit-final.txt`.
- Application typecheck and focused source/test/browser typecheck: pass
  (`typecheck-app-final.txt`, `typecheck-focused-after-feedback.txt`). This is not
  a claim that every historical QA file passes strict TypeScript checking.
- Isolated production build: pass (`build-final.txt`). Root native `.next` was
  never rebuilt. Standard multiple-lockfile warning remains in the build log.
- Final combined synthetic production-browser suite: **12/12, 44.8s**
  (`browser-final-report.json`, `browser-final.txt`). Credential-free mock app on
  loopback3161; fictional PNGs and intercepted extraction responses only.
- EN360×640, HE390×844/430×932 and EN1280×844 cover populated controls, originals,
  address/name corrections, new merchant confirmation, unresolved location,
  explicit timezone/payment/category/unit decisions, arithmetic blocking, Save,
  reload and duplicates. Partial date-only/time-only EN/HE360 scenarios fill only
  the missing part and verify Undo/orphan cleanup. Existing editor regressions
  cover invalid dates, missing facts, errors/focus and totals.
- Five fictional product rows/seven units, line sum60.45/payable60.50 persist
  independently. No receipt-level discount allocation, photo or observation storage.
  Baseline42 purchases,12 pins and one MapLibre instance/construction remain;
  synthetic save adds one unpinned purchase and Undo removes its orphan merchant.
- Twenty-four fictional screenshots retained across `screenshots-final/` and
  `editor-regression-screenshots-final/`. Narrow EN/HE blocker, partial-date/time,
  unit-focus and summary states inspected; visible focus, RTL reading and sticky
  actions remain usable. No real receipt screenshot or physical-device test.

Initial unit run262/264 had one obsolete blank-channel expectation and one new test
that bypassed the real directory projection. Those test expectations/setup were
corrected without weakening validation. Initial JSX/focused-QA type errors were
fixed before passing checks. First browser run12/12 preceded the unit-error
presentation refinement; the final rebuild/rerun above verifies that refinement.
Initial/final artifacts were retained separately, not overwritten.

Reproduction: use a new isolated mock app and fresh evidence paths. Run the nine
focused files listed by `unit-final.json` with
`NODE_OPTIONS='--import ./qa/receipt-p2d/offline-guard.mjs'`, then application/focused
typechecks and isolated `next build --webpack`. The retained
`playwright-final.config.ts` targets3161 and the two editor/prefill specs; clone its
output/report paths for a new run. Set `SPENDSCAPE_PREFILL_QA_OUT` and
`SPENDSCAPE_EDITOR_QA_OUT` to fresh screenshot directories. Do not use native3156,
historical activation launchers or existing artifact destinations for reproduction.

## Real draft, preservation and next gate

The user chose to leave the real draft open. Read-only visibility verified it remains
open; no field edit, Save, reload, navigation or user-server restart. User-owned
native3156 stays running. The older loaded page will not acquire these improvements
without a reload, which would discard its transient draft; no reload was performed.
No photo/raw provider response was retained to reconstruct it. Real save/reload
remains unverified. Users must review every proposed item against the receipt;
HTTP success does not establish completeness or factual accuracy.

Owned mock3161 stopped after QA. Final preservation evidence is in
`preservation-final.json` and `git-final.txt`:152 protected evidence files and449
root native build files unchanged, consumed locks/freezes/request code preserved,
main refs/index/entry next-env bytes unchanged. No provider/credential/billing,
dependency, commit/push/deploy or Vercel action. Next gate: checkpoint review.

## Exact task manifest (15 files)

1. `src/features/capture/receipt-review-readiness.ts` — new actual-error presentation.
2. `src/features/capture/receipt-review-readiness.test.ts` — new focused controls.
3. `src/features/capture/PurchaseReview.tsx` — state, blockers, context summary.
4. `src/features/capture/MerchantPlaceReview.tsx` — explicit observed-name/address prefill.
5. `src/features/capture/ReceiptReviewDetails.tsx` — controlled fields and partial clock.
6. `src/features/capture/receipt-review-adapter.ts` — existing unresolved channel default.
7. `src/features/capture/receipt-review-adapter.test.ts` — unresolved-channel assertions.
8. `src/features/capture/final-payable.test.ts` — same channel expectation.
9. `src/features/capture/receipt-editor-values.ts` — independent strict time conversion.
10. `src/features/capture/CaptureExperience.module.css` — blocker layout.
11. `qa/spendscape-receipt-editor.spec.ts` — intentional missing-unit focus assertion.
12. `qa/spendscape-receipt-prefill.spec.ts` — new complete-flow synthetic scenarios.
13. `docs/spendscape/COLLEGE_RECEIPT_PREFILL.md` — this checkpoint.
14. `docs/spendscape/COLLEGE_RECEIPT_EDITOR_COMPATIBILITY.md` — appended superseding status.
15. `docs/AI_HANDOFF.md` — appended verified status.

Eleven entry files edited, four new task files; unrelated entry work preserved.
Final cumulative Git state:13 tracked modifications/138 individual untracked files
(entry8/134), empty index, ahead18/behind0 versus cached origin feature; no fetch.
Whitespace checks pass for tracked diffs and every untracked task file.


## 2026-10-09 — Self-contained native mock fixtures and final review

Pass for the proposed local checkpoint; no staging or commit. The earlier isolated
candidate's eight ENOENT failures (214/222, native15/23) remain in
`artifacts/receipt-flow-review-q_4xde_r/`. Its patch/review/results were not replaced.
Native mock tests now create clearly synthetic history bodies in fresh temporary
roots and remove only those roots. Vitest substitutes their expected digests inside
its isolated test worker; the real fixed-path SHA256 verifier, exclusive/fsynced
reservation and lifecycle implementation execute unchanged. Every synthetic history
file is tested for tampering and absence; both fail closed. Production verification,
consumption, request caps, activation gates and historical bytes are unchanged.

Fresh candidate: HEAD52902b13 archive plus only the proposed43 file/hunk overlays,
with existing installed node_modules linked; no ignored historical artifacts,
receipts, credentials or research copied. Offline network guard and minimal clean
environment used. Final native23/23 and aggregate222/222 across8 files pass;
application and strict native-test typechecks pass. Extra strict test typing initially
found six missing NODE_ENV errors; adding explicit test-only environment values
resolved them. Initial/final evidence retained separately. Tracked/proposed whitespace
checks pass. No dependency/application change: retained production build and12/12
EN/HE browser evidence under receipt-prefill-d37rrqyn remains applicable, not rerun.

Correction manifest: `src/server/receipt-structured-native.test.ts`, this checkpoint,
`docs/AI_HANDOFF.md` appended status. Exact proposed43 file/hunk manifest, hashes,
patch, reproduction and final preservation evidence:
`artifacts/receipt-flow-final-7vfalg9y/`. Handoff proposal includes only the structured
receipt suffix beginning "Structured Gemini receipt preparation"; prior uncommitted
Vision/validation sections and all three Vision run-configuration files stay outside.

Real draft remains visible in its old loaded UI; no edit, reload, Save or server
restart. Real save/reload unverified. Product-line sum60.45 and payable60.50 remain
independent, with a nonblocking difference. No provider or credential access,
reservation creation, billing/account change, dependency, Vercel action, merge,
commit, push or deployment. Main refs, entry next-env bytes, historical evidence and
consumed locks preserved. Separate checkpoint commit approval is the next gate.
Proposed message: `feat(receipts): complete local structured extraction and reviewed save flow`.
