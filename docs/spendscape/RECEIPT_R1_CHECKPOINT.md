# Receipt R1 checkpoint — Hebrew receipt photo to validated lines (Gemini)

Branch: `feature/receipt-r1`. New files only; no UI, no existing behaviour changed.
Authorization: the user's explicit message starting Receipt R1 (the Phase 0 gate in
CLAUDE.md is outdated for this bounded task). Nothing deployed from this task.

## What was built

| File | Purpose |
| --- | --- |
| `src/features/receipt/receipt-domain.ts` | Types, `validateReceipt()` (integer agorot, never fixes numbers), `receiptToReviewInput()` |
| `src/features/receipt/receipt-domain.test.ts` | Vitest, synthetic receipts: exact, rounding, weighted, discount, mismatch, review mapping |
| `src/app/api/receipt/extract/route.ts` | `POST` multipart `image` → `{ extraction, validation }`. Image is never stored. 503 if the key is missing |
| `tools/receipt-benchmark/run.mjs` | Local benchmark; reads the git-ignored `tools/receipt-benchmark/local-receipts/` |

Rules enforced: the prompt tells the model to transcribe only what is printed and never
guess, complete or estimate. Prices are never produced by the model beyond transcription;
code checks every line (`quantity × unitPrice ≈ lineTotal`, ±1 agora for items, ±2 for kg)
and `sum(lines) + sum(discounts) = total` exactly. Discounts must be negative as printed.

`receiptToReviewInput()` leaves merchant, place, payment, category and channel empty.
The existing review shape has no discount line, so a receipt with discounts yields
`notes: ['discounts-not-representable']` and the review's own `arithmetic` error rather
than silently folding the discount in. Currency other than ILS stays empty.

## API facts (checked in Google's docs, 2026-10-09)

- Docs now document the **Interactions API**: `POST /v1beta/interactions`, header
  `x-goog-api-key`, `input: [{type:'text'},{type:'image',data,mime_type}]`,
  `response_format: {type:'text', mime_type:'application/json', schema}`. Output is in
  `steps[]` where `type === 'model_output'` → `content[].text`. Plain `fetch`, no SDK.
- Default model `gemini-3.5-flash` (override with `GEMINI_MODEL`). The newest
  `gemini-3.8-flash` was measured at **~64 s** for one small image on 2026-10-09 versus
  ~7.7 s for 3.5-flash and ~2.9 s for 3.5-flash-lite, so it is not the default.
- The route retries 429/503 up to 3 times and times out each call at 45 s.

## How to run

```bash
# .env.local (git-ignored): GEMINI_API_KEY=...   optional: GEMINI_MODEL=...
npm run dev
node tools/receipt-benchmark/run.mjs            # uses tools/receipt-benchmark/local-receipts
```

The benchmark prints only counts and validation status per receipt, never contents.

## Results

Synthetic smoke test (a generated English image, one receipt: 3 lines + 1 discount):
read 3 lines and 1 discount, totals validated, 0 agorot difference. A blank image returned
zero lines and was flagged `no-lines`. Unit tests: all new tests pass; full suite
191 tests passing; `npm run typecheck` and `npm run build` pass.

**Real-receipt benchmark: not yet run.** No real receipt photos were available to the
agent. Fill in this section after running the benchmark on 5–10 real Hebrew receipts:

| # | Lines read | Totals validate | Issue codes | Notes |
| --- | --- | --- | --- | --- |
| — | — | — | — | pending |

## Known risks

- Hebrew right-to-left line layout and tiny thermal print are the likely failure points.
- Weighted items and multi-quantity lines may print the unit price on a separate row.
- Discounts printed with a trailing minus (`3.00-`) rely on the model normalising the sign;
  a positive discount is flagged, not corrected.
- Free-tier prompts may be used by Google to improve products; do not use receipts with
  personal data until the plan's data terms are reviewed.
- 503 "high demand" responses occur on newer models; the route retries and then returns 502.

## Recommendation

**Provisional: conditional go** for wiring to Capture, contingent on the real-receipt
benchmark (target: totals validate on most receipts, and failures are always flagged by
`validateReceipt`, never accepted silently). Because validation is deterministic, a bad
read cannot reach the ledger unflagged. Decide after the benchmark table above is filled.
