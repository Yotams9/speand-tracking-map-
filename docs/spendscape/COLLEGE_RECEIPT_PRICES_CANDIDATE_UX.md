# Clear receipt prices using integration/candidate's savings cards

## Scope — 16 October 2026

The user requested removal of the confusing added catalog screen, clearer prices next to a selected receipt product, and inspection of `integration/candidate`.

Implementation base: `integration/final` at `6889833d8a67f0c867e67095764540b25523fee0`.
Reference fetched read-only: `integration/candidate` at `e4f9707fbd9aad42e1dcae5b23f5c09762ecce87`.
No branch merge was performed. No publication is authorized by this implementation request alone.

## Findings from the comparison

- Both branches contain byte-identical `data/catalog/tel-aviv.json` and `src/data/price-catalog.ts`. Switching the interface cannot add nationwide coverage or fresh prices.
- Basic milk products are present, including GTIN `07290000474076` (Tara 3%, 1 litre) and `07290000042435` (pasteurized 1% carton, 1 litre).
- The old search returned only its first 15 results without a continuation control. Broad words also matched irrelevant names. There are 504 valid product names containing `חלב`; this includes cosmetics and other foods, not 504 ordinary milk SKUs.
- Candidate has a clear `SavingsPanel` with a branch, distance, comparison total and publication date. Its automatic saved-purchase adapter requires a recorded barcode. Receipt rows do not contain barcodes, so copying it alone would not compare photographed receipts.

## Implemented replacement

- Removed `CatalogReceiptComparison` and its separate receipt comparison engine. There is no longer a Catalog near purchase mode.
- Reused candidate's deterministic savings engine, request validator, money helper, camera offset, automatic barcode-purchase adapter, card styling and existing tests.
- Adapted the card for receipt rows: explicit product-name/barcode search, package display, and **Same product and package — show prices**. That button is the identity confirmation; there is no second checkbox.
- The resulting price card appears immediately within the selected receipt row, with unit price, quantity total, cheapest published branch, its address, distance and alternatives. The selected row is brought into view.
- Search ranks exact and prefix name matches first and supports **Show more products**. All result pages are reachable. A missing exact product is still shown as unavailable; no identity is invented.
- Every receipt card compares only its selected row, not the whole receipt. Unsupported weights, fractional quantities, foreign currencies and unknown package units cannot be matched.
- A one-row receipt uses the independent final payable for its historical difference. Multi-row receipts use a row's paid amount only if row totals reconcile to the final payable; unallocated receipt adjustments are not assigned to a row.
- Receipt comparisons use the purchase-owned confirmed pin. No automatic GPS or provider lookup is initiated. A missing pin gets a clear message.
- Radius remains 5/10/20 km. Branch points are the existing address points, not verified premises or driving routes. Showing a branch returns from the receipt comparison to the purchase sheet and moves the existing map camera into the visible area; it creates no pin.
- Single-row native barcode purchases now receive candidate's automatic savings card in purchase detail. Receipt rows still need an explicit identical-product selection.
- The old Petah Tikva comparison remains available with its existing expiry behavior.

Publication dates are derived from the source. Dated prices stay visibly identified as not current. Copy describes a published-price difference, not guaranteed current savings. No new price, coordinate, barcode, manufacturer or package was fabricated.

## Verification

- 73 focused tests passed across savings, receipt-row mapping, search, bundled catalog and retained city/receipt comparison modules.
- Six production-browser scenarios passed: EN/HE at 360/390/430/1280 px; immediate Monster prices, basic milk search/selection, pagination from 15 to 30 candidates, 5/10 km changes, unknown-origin state, automatic barcode card, changing a match, city view, focus return, close/reopen and reload.
- Five local search-route contract checks passed.
- Synthetic ledger equality passed before/after comparisons, map actions and reload. Single MapLibre canvas and pin count remained unchanged.
- First browser run passed receipt flows but the final barcode scenario failed because its harness omitted the explicit English locale. That failure is retained. The corrected full run passed in `final-map-reveal/browser-results.json`.
- Typecheck, production build, whitespace checks and catalog inclusion in the `/api/savings` function trace passed.
- Rendered Hebrew/English phone result cards and the milk result were inspected.

No real ledger was accessed. No Gemini, Geoapify, retailer HTTP, account, billing or deployment operation occurred for this implementation. Existing published API operation, storage formats, scanner routes, source catalog and price snapshot are unchanged.

Evidence: ignored `artifacts/receipt-savings-candidate-20261016/` in the original rebuild worktree; final screenshots/results in its `final-map-reveal/` directory. The original failed browser run remains alongside the final run.
