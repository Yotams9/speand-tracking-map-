# College receipt observation/editor compatibility — offline checkpoint

2026-10-09. HEAD52902b13a8493ed616cc35ccb084a3edeecaf590, branch
feature/spendscape-rebuild. Implementation and focused local QA only; no provider
call, new reservation, credentials, billing, dependency, commit, push or deployment.
Vercel untouched; its paused state was not independently queried.

## Behavior and limits

- Strict calendar conversion accepts YYYY-MM-DD, DD/MM/YYYY and DD-MM-YYYY,
  four-digit years1900–2100. Rejects rollover, invalid leap dates, mixed separators,
  two-digit years, unsupported formats and candidate lists. DMY is an explicitly
  supported convention, not a merchant/locale guess.
- The datetime-local control populates only with a valid observed date AND explicit
  zero-padded HH:MM. Missing/ambiguous date or time remains blank in that combined
  control and visible in original observations. No midnight, century or timezone
  is filled. Selecting and confirming a timezone remains required; existing DST
  gap/overlap checks are unchanged. UTC used for calendar validation is not an
  inferred receipt timezone.
- Exact supported ISO currencies remain supported. Narrow ILS spellings: ₪, שח,
  ש"ח, ש״ח, ש”ח, ש“ח, ש'ח, ש׳ח (outer whitespace only). Unknown symbols, mixed
  notation, control characters and ambiguous candidates remain unresolved.
- Units remain explicit selections even for integer quantities. Existing receipt
  validation marks quantity invalid while its unit is unresolved, then focuses
  quantity first; keyboard traversal reaches the required unit and its error.
  This checkpoint does not alter those financial validators.
- Address has an editable EN/HE control with its immutable original separately
  visible. Corrections live only in component memory, disappear on review disposal,
  and are not persisted or used to resolve a merchant/place. Existing explicit
  merchant/place creation/selection remains independent; no IDs, coordinates,
  geocoding or location were added.
- Original observations remain separate from edits. The successful structured
  Gemini request/model/prompt/JSON mode/transport, geometry paths, IndexedDB schema,
  save validation, duplicate handling and Undo are unchanged.
- Printed item values and final payable remain independent. Required per-line
  arithmetic still blocks mismatches. Receipt-level discounts are not required or
  allocated. Correct approved evaluation reference: five rows/seven units, product
  amounts60.45, payable60.50; their0.05 difference is nonblocking after review.
  Those answers are not in the request/prompt. Historical scores/freezes and the
  independent older synthetic60.55 scenario were not rewritten.

## Exact task manifest

1. src/features/capture/receipt-editor-values.ts — new pure format mapping.
2. src/features/capture/receipt-editor-values.test.ts — synthetic strict controls.
3. src/features/capture/receipt-review-adapter.ts — currency helper only in this task;
   earlier uncommitted adapter changes preserved.
4. src/features/capture/ReceiptReviewDetails.tsx — date initialization and transient
   editable address with original preserved.
5. qa/spendscape-receipt-editor.spec.ts — new synthetic Capture/browser checks.
6. docs/spendscape/COLLEGE_RECEIPT_EDITOR_COMPATIBILITY.md — this checkpoint.
7. docs/spendscape/COLLEGE_GEMINI_STRUCTURED_RECEIPT.md — corrected evaluation
   reference and appended status; historical live record preserved.
8. docs/AI_HANDOFF.md — appended concise status; earlier sections preserved.

All task changes remain uncommitted. This manifest excludes pre-existing server
run configuration, native activation/research and all other untracked work.

## QA evidence actually measured

Fresh ignored destination: artifacts/receipt-editor-ak98df2a/. No historical output
regenerated. Isolated app copy/build and credential-free fictional server3160 kept
the native3156 server, its449-file root build, and open real draft intact.

- Guarded focused unit:259/259, zero failures, eight files. Helpers/adapter/calendar,
  final payable, structured response contract, local store, purchase domain and
  native one-attempt protections. Initial narrower run197/197 also retained.
- Application typecheck passed. Focused source/test/browser typecheck passed, also
  after final QA-only assertion correction. Initial focused config omitted the
  next-env CSS declarations; adding that config include resolved it without source
  change. This is not a repository-wide strict QA typecheck claim.
- Isolated Next production build passed (--webpack); existing multiple-lockfile
  workspace-root warning retained. Root .next was not rebuilt.
- Final Chrome production-browser run6/6, zero skipped/flaky,25.467s. Four recognized
  format scenarios at360×640 EN,390×844 HE,430×932 HE,1280×844 EN; two invalid/missing
  date/currency scenarios at360×640 EN/HE. All data and PNG intake are fictional.
  POST extraction responses were intercepted; native transport/keys were absent.
- Covered original preservation, transient address edits, blank timezone/units,
  accessible required-field focus, keyboard unit access, printed-line mismatch
  blocking, user corrections, explicit synthetic Save, IndexedDB reload, duplicate
  protection and asynchronous Undo. Both totals and all five prices/amounts persist
  unchanged; no observations/address/photo enter purchase storage. Counts remain
  baseline42→43→42(Undo)→43,12 pins, one MapLibre construction/instance.
- First browser run2/6, four failures at an incorrect unit-first focus assertion.
  Source confirmed existing quantity validation depends on a resolved unit. The
  new test now verifies actual quantity-first focus, required unit error and two
  keyboard Tabs to unit; no acceptance rule or application behavior was weakened.
  First-run artifacts preserved. Initial sandbox server bind failure also retained;
  separately authorized local QA process succeeded.
- Fourteen fictional screenshots retained in screenshots-final/. Rendered timezone/
  unit errors, invalid-date EN/HE and totals inspected at the representative widths;
  focus/errors remain visible above sticky actions, RTL and mixed labels readable,
  no horizontal document overflow in the checked totals states. Physical-device
  testing and a broad regression suite were not run.

Reproduction (new artifact destinations and isolated fictional app required):

```sh
NODE_OPTIONS='--import ./qa/receipt-p2d/offline-guard.mjs' ./node_modules/.bin/vitest run src/features/capture/receipt-editor-values.test.ts src/features/capture/receipt-review-adapter.test.ts src/features/capture/receipt-review-time.test.ts src/features/capture/final-payable.test.ts src/features/receipt-image/structured-image.test.ts src/features/local-purchases/local-purchase-store.test.ts src/features/capture/session-purchase-domain.test.ts src/server/receipt-structured-native.test.ts --no-file-parallelism
./node_modules/.bin/tsc --noEmit
SPENDSCAPE_EDITOR_QA_OUT="$PWD/artifacts/NEW-FRESH-DIRECTORY/screenshots" ./node_modules/.bin/playwright test --config artifacts/receipt-editor-ak98df2a/playwright-final.config.ts
```

The retained Playwright config targets3160; clone it with fresh report/output paths
and start a fresh credential-free mock server before reproduction. Do not use it
against native3156 or overwrite retained output. Isolated build/start/config scripts
and JSON reports/logs are retained under the evidence directory for inspection.

## Real draft and remaining gate

User: “Leave the draft open for now.” Read-only DOM visibility confirms it is still
open; its tab was retained. No agent field edits, Save, reload, navigation or native
server restart. Existing page uses the earlier loaded UI; a reload to acquire new
code would discard its transient draft, so no reload was performed. No photo/raw
provider response was retained to reconstruct it.

Existing real extraction observations were verified in the prior consumed run;
this task adds only synthetic editor/save evidence. Real remaining actions are
address review; printed date/time and explicit timezone confirmation; ILS/unit
confirmation; explicit merchant/place/channel/payment/category; user-only Save.
If the user later saves, check persistence before claiming real save/reload. Until
then real save/reload is unverified. Next gate: review this offline checkpoint.
No additional provider request, reservation, activation or publication authorized.

Final preservation/Git verification is recorded in preservation-final.json and
git-final.txt in the evidence directory. Owned mock3160 server stopped; user-owned
3156 remains listening to preserve the draft. Original103 protected evidence hashes,
all449 native build hashes, main refs, index and exact entry next-env bytes preserved.
The original activation freeze remains byte-identical and intentionally detects the
new editor/adapter source; no freeze or consumed reservation was reset/regenerated.

Final cumulative working state:8 tracked modifications/134 individual untracked
files (entry8/130), empty index, ahead18/behind0 versus cached origin feature; no
fetch. Four new task files, four edited entry files, zero unrelated entry changes.
Whitespace checks pass for tracked diffs and every untracked task file.

## 2026-10-09 follow-up: complete prefill and actionable blockers

See `COLLEGE_RECEIPT_PREFILL.md` for the separately approved15-file follow-up.
Observed merchant now prefills the explicit new-merchant flow; unresolved location
uses the existing unknown channel without coordinates/pin. Partial date/time retains
the supported part. Summary and blocker list use extracted/corrected facts and the
actual preparation errors. Missing-unit feedback now focuses unit and coalesces its
dependent quantity error; the historical quantity-first result above describes the
earlier UI, and financial validators remain unchanged.

Final follow-up QA264/264 focused unit,12/12 combined synthetic browser44.8s,
application/focused typechecks and isolated build pass. Native3156/real draft remain
untouched in the old loaded UI; real save/reload unverified. Unknown payment/category/
units/date-time and address persistence without a place remain explicit contract
limits. Historical evidence and consumed reservations preserved; no provider call.
