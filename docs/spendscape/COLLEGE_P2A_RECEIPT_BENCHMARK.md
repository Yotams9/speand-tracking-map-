# College P2A — offline receipt benchmark foundation

2026-09-26. Authorized: `APPROVE SPENDSCAPE COLLEGE P2A — UNIVERSAL SCANNER RECEIPT BENCHMARK FOUNDATION + LOCAL QA`.
Completed local foundation only. No OCR/model/provider was run or promoted.
No consumer UI, application source, storage schema, dependency or deployment changed.

## Dataset and reproducibility

`qa/receipt-p2a/fixtures.mjs` is the authored source of truth. Its checked-in
`manifest.json` records the exact structured truth, PNG path, dimensions, bytes
and SHA-256 for each image. These are fictional benchmark inputs, not retailer
prices, canonical purchases or real receipts. Images were rendered locally with
installed Chrome/Arial using canvas; browser context was offline and all page
requests blocked. They are outside `public` and have no application import.
The four PNGs were visually inspected for clipping, Hebrew shaping and columns.
No application server or model was started.

| Fixture | Items | Total, minor ILS | PNG bytes | Coverage |
| --- | ---: | ---: | ---: | --- |
| english-6 | 6 | 9290 | 94305 | English item names, repeat, quantity, weight, discount |
| hebrew-6 | 6 | 9290 | 91038 | Hebrew item names, same numeric control |
| mixed-25 | 25 | 37830 | 259316 | Mixed names, repeated milk, four row discounts, weighted produce, ambiguous name |
| mixed-25-degraded | 25 | 37830 | 400004 | Same evidence with slight skew and lower contrast |

English/Hebrew case names refer to item language; the merchant/header includes
both languages and columns use English. Clean receipts are 1200×692 or
1200×1870. The two long images are related, not independent holdout examples.
Tax is included in row prices; discount is a positive deduction per row.
`quantityMilli * unitMinor = 1000 * (lineMinor + discountMinor)` exactly.
Amounts use integer minor currency units, quantities use integer thousandths.
No rounding is needed in this corpus. Other currencies, tax regimes, refunds,
receipt-wide coupons, multipage inputs and photographic glare remain uncovered.

Row 25's name is deliberately unreadable. Ground truth is **null**, requiring
`uncertain: ["label"]`; there is no hidden intended product to guess. Its other
fields remain legible. Repeated milk rows 1/21 are separate occurrences.
Printed row numbers make identity/alignment explicit; this is a simplifying
benchmark aid, not proof of unnumbered receipt segmentation.

Commands from the worktree root (no installs):

```sh
node --test qa/receipt-p2a/evaluate.test.mjs qa/scanner-d1/numeric-evidence.test.mjs
node qa/receipt-p2a/controls.mjs
node qa/receipt-p2a/evaluate.mjs mixed-25 /absolute/path/to/synthetic-result.json
```

`render.mjs` regenerates images/manifest with installed Chrome when explicitly
needed; platform font/Chrome rasterization may change bytes. Checked-in hashes
are the evaluation identity. Never overwrite approved fixtures to fit a result.
The evaluator reads at most a 1 MB supplied JSON file, accepts no executable
input, and prints only fixed metrics, field names and row indices. It makes no
network calls and writes no output file. Use synthetic supplied results only;
any later approved provider experiment must retain original response separately
in ignored evidence, with no credentials. Current results contain no model text.

## Input contract and scoring

Use `idealResult(fixture)` for the contract shape only, never as model evidence.
Result fields: `version:1`, `receiptId`, `merchant`, `date`, `currency`,
`totalMinor`, `lines`. Each line contains printed `row`, `label`, `quantityMilli`,
`unit` (`item` or `kg`), `unitMinor`, `discountMinor`, `lineMinor`, `uncertain`
(array of those field names). Missing known facts are null and explicitly
flagged, never zero by default. Missing rows may be omitted; they score omissions.
Unknown fields, duplicate row IDs, numeric strings, nonfinite/out-of-bound values
or malformed structures are invalid. Dates/currency/labels compare to truth,
not inferred equivalents. Numeric maximum is 10,000,000; at most 100 rows.
This is a QA contract, not a production parser or the P1 storage schema.

Match by printed row identity, not a bag of numbers, label similarity or array
order. Compare each field exactly, with NFC/whitespace normalization for strings
only (reused from D1); do not repair O/0, punctuation, case, signs or bidi order.
Report exact lines and per-field counts, wrong fields, omissions, extra rows,
header errors, arithmetic per line and total sum. A correct total cannot mask
wrong quantities, swapped prices, repeated-item loss or incorrect discounts.
`evidenceExact` means visible evidence matches and ambiguity is honestly marked;
it is **not** model promotion or permission to save.

Correction burden is an offline proxy, not measured taps/time: count each wrong,
missing, null-expected or flagged field once per row; count each wrong header
and each extra row once. Omitted rows therefore need six fields. Also report
affected line count and unnecessary flags. Even an accurate all-uncertain result
has excessive correction burden. Human completion of purchase context and final
review are additional mandatory actions not represented by this proxy.

## Measured evaluator controls — not OCR performance

`qa/receipt-p2a/control-results.json` is reproducible via `controls.mjs`.
All results below were actually computed from constructed answers, with **zero
model runs** and no claim of extraction latency, network cost or image accuracy.

| Supplied control | Exact lines | Correction fields | Evidence exact |
| --- | ---: | ---: | --- |
| Exact visible English / Hebrew | 6/6 each | 0 each | yes |
| Exact visible mixed / degraded | 25/25 each | 1 each | yes; ambiguous name still requires user |
| Swap two unit prices | 23/25 | 3 | no |
| Omit repeated milk row | 24/25 | 7 | no |
| Wrong total by one minor unit | 25/25 | 2 | no |
| Invent ambiguous name | 24/25 | 1 | no |
| Flag every field uncertain | 25/25 | 150 | yes, but correction threshold fails |

Focused offline tests: **24/24 passed**, zero failures/skips (12 P2A and
12 existing D1 numeric-context tests). Covers malformed input, nulls, duplicates,
field swaps, totals, quantities, discounts, omissions, invented names, uncertainty
and checked-in image hashes/truth. D1's former numeric-multiset false positive
remains rejected by its contextual tests. D1 OCR was not rerun; its Hebrew/mixed
accuracy and initialization cleanup failures remain a negative integration result.
Initial image generation failed at sandbox Chrome launch; the same offline
renderer succeeded with execution permission. No package or timeout was changed.

## Promotion criteria (targets, not observed model results)

A bounded future benchmark must freeze input hashes, provider/model/version,
prompt and adapter version before testing. Send **images only**, never truth or
ideal answers. Map output to this schema without correcting facts; preserve
nulls/errors. Record any human alignment or adapter conversion. Run all four
fixtures three times (12 calls maximum, no hidden retries) and report every run,
not a best-of selection. A later varied holdout corpus is required before broad
receipt support; four authored images cannot establish general reliability.

- Schema validity 100%; zero invented fields/facts, missing or extra rows on
  clean cases; all legible numeric/date/currency fields exact in every run.
- All deliberate ambiguities stay null/flagged. Any unflagged wrong financial
  value fails factual acceptance, even if the total balances.
- At least 95% correct readable item labels; at most two affected lines needing
  correction per 25-item clean receipt (including the deliberately ambiguous
  line); no blanket uncertainty. Short clean receipts: at most one line.
- Degraded cases: every failure/unknown reported, no invented repair, at most
  five correction lines. Exceeding this yields conditional/reject, never a
  silent threshold change or omission from results.
- Measure end-to-end latency separately from evaluator time; target ≤15 s per
  25-item case, hard timeout 30 s. Report all timings; this sample cannot give a
  reliable population p95. Measure payload bytes and actual usage/cost, within
  a separately approved hard budget (none authorized now).
- Cancellation/late-result cleanup, no sensitive logging/persistence, and a
  reviewed provider privacy/retention/key boundary are mandatory before any
  Capture integration. Physical iPhone file/camera, memory and accessibility QA
  remain separate integration acceptance, never inferred from desktop controls.

## Intended Capture interaction (specification only)

Preserve Globe · Capture · Purchases · Stats and the existing Scanner A camera,
B barcode/manual barcode, demo product and manual purchase paths as one Universal
Scanner. Reuse the dark design system; keep the globe mounted behind Capture.

1. **Acquire:** deliberate receipt photo/file action, image-type/size validation;
   no microphone. Camera only after explicit action; reuse sole camera owner.
   Proposed initial image-only scope: JPEG/PNG, one receipt, ≤10 MB and ≤20 MP;
   unsupported HEIC/PDF gets clear guidance, not a false extraction attempt.
   Camera denial retains file/manual choices. No acquisition implemented here.
2. **Processing:** one cancellable operation, one image/job, bounded 30 s wait;
   loading text with a polite live announcement, no fake percentage. Cancel,
   Back, Close or navigation invalidates operation; release tracks, image buffers
   and URLs, reject late completion. Explicit retry only. A future remote call
   already sent may not be retractable; disclose approved retention beforehand.
3. **Draft/partial:** show all itemized rows with quantity, unit price, discount
   and line amount, plus original receipt total. Collapse verified details,
   offer “Review 1 uncertain line / בדיקת שורה אחת לא ודאית”; never hide rows or
   present confidence scores. Missing fields stay blank; show “Needs review /
   נדרשת בדיקה”. Users may inspect/edit any line. Partial extraction retains
   available rows and visibly reports incompleteness; add missing rows or retake.
4. **Corrections:** focus first unresolved field, inline text errors plus
   `aria-invalid` and associated explanation. Announce changed uncertainty count
   without re-reading the receipt. Hebrew layout RTL; numeric columns and mixed
   text isolated with bidi semantics. Reachable ≥44px controls, keyboard-safe
   footer, visible focus, no horizontal scrolling at 360px, no motion dependency.
   Desktop uses the same step model with more space, not another workflow.
5. **Review:** verify merchant/place or online/unresolved channel, date, currency,
   payment and exact arithmetic. Never infer place/GPS, missing date, currency
   or FX. Foreign purchases still need explicitly reported ILS amount under P1.
   No save while required facts/line arithmetic are unresolved. Retake warns
   before discarding edits; Back within draft preserves in-memory edits, exit
   discards them after confirmation. Reload loses draft but retains P1 purchases.
6. **Save:** explicit user review, user-reviewed provenance, duplicate warning
   and explicit override, one operation ID. Commit through P1 only and acknowledge
   success after durable transaction. Capacity/failure preserves draft; late
   save may update ledger once but never hijack newer navigation. Then existing
   eight-second shared Undo; expiry keeps purchase, successful Undo persists
   removal. No image or OCR draft enters IndexedDB, history, URL, logs or analytics.

**Integration blocker:** P1 `ReviewLine` currently supports quantity × unit price,
not explicit discounts. Do not silently invent an effective unit price, drop a
discount, or bypass its exact validation. A separately approved integration slice
must design reviewed discount representation and any required versioned storage
compatibility before discounted receipts can save. No schema change is made now.
Only structured, explicitly reviewed records cross P1; all photos remain transient.

## Exact changed-file manifest (13 files)

- `docs/AI_HANDOFF.md`
- `docs/spendscape/COLLEGE_P2A_RECEIPT_BENCHMARK.md`
- `qa/receipt-p2a/control-results.json`
- `qa/receipt-p2a/controls.mjs`
- `qa/receipt-p2a/evaluate.mjs`
- `qa/receipt-p2a/evaluate.test.mjs`
- `qa/receipt-p2a/fixtures.mjs`
- `qa/receipt-p2a/images/english-6.png`
- `qa/receipt-p2a/images/hebrew-6.png`
- `qa/receipt-p2a/images/mixed-25-degraded.png`
- `qa/receipt-p2a/images/mixed-25.png`
- `qa/receipt-p2a/manifest.json`
- `qa/receipt-p2a/render.mjs`

CLI valid/invalid input checks and deterministic control-results reproduction
also passed. New text whitespace and `git diff --check` passed. The index is
empty; origin feature tracking ref remains `66fb420` (ahead 3 / behind 0,
not fetched). No QA server was started; the fixture renderer closed its browser.

## Safety and next approval

Started clean on feature/spendscape-rebuild at
`399fce8e8209f0ffbeb8893903a28b43d537f8aa` (committed P1). No commit, push,
deployment, provider, account, credential or billing action. Main refs remain
`eee0d26b55e5061f87ac664938df0c195800b74f`. Existing application source and
next-env.d.ts remain unchanged. No build/app server or broad UI QA was needed.

Single next requested approval:
`APPROVE SPENDSCAPE COLLEGE P2B — BOUNDED SYNTHETIC RECEIPT PROVIDER BENCHMARK READINESS`.
This authorizes current official provider/model/privacy/cost assessment and an
exact ≤12-call synthetic-only execution proposal, not calls, credentials,
accounts or billing. Provider/model and hard budget are intentionally unselected;
actual calls require that concrete execution boundary to be approved. Google AI
Pro manual experimentation is separate and confers no API authorization.
