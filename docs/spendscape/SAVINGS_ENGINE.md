# Savings engine — "You'd save ₪X at a branch nearby"

Branch `feature/savings-engine` (from `integration/final`). For a saved purchase
or a scanned product, find the cheapest nearby Tel Aviv branch for the **same
barcodes** and show the saving.

## Rules

- **No LLM.** Every price comes from `data/catalog/tel-aviv.json`; every paid
  amount comes from the user's own saved purchase. Numbers are computed by
  deterministic code (`src/features/savings/savings-engine.ts`).
- **Identical barcode only** (GTIN-14 with a valid check digit). No name
  matching, no substitutes.
- **Never split a basket.** A store gets a basket total only if it publishes a
  price for *every* compared item. Stores with some items are listed as
  "has X of Y items" and never get a savings claim.
- **Comparable items**: valid GTIN-14, in the catalog, not weighted (`w`), whole
  units (`unit: 'item'`, integer quantity 1–1000). Anything else is returned in
  `notCompared` with a reason: `no-barcode`, `invalid-barcode`,
  `not-in-catalog`, `weighted`, `unsupported-quantity`. Nothing is dropped
  silently.
- **Duplicate barcodes** in one basket are kept as separate lines (each keeps
  its own `ref`, quantity and paid amount). A store's total is the sum over all
  lines, so it equals the total for the merged quantity; the result is the same
  either way and nothing is rejected.
- **Integer agorot.** Catalog prices are converted once (`toMinor`,
  `Math.round(price × 100)`), then only integers are multiplied and summed
  (3 × ₪7.90 = 2370 agorot exactly).
- **Distance**: haversine in metres from the origin; stores within the radius
  (inclusive, default `NEARBY_RADIUS_M` = 5000 m from `receipt-comparison.ts`).
  The 6 catalog stores without a location never take part.
- **Baseline (same basis)**:
  - origin is a catalog branch that prices every compared item → its shelf
    total (shelf vs shelf, "vs the shelf price where you bought");
  - otherwise → the sum of what the user paid for the compared items ("vs what
    you paid"), only when every compared item has a paid amount (ILS only).
- **Result**: complete stores ranked by total, then whole-metre distance, then
  store ID. `saving = baseline − best total`. If that is ≤ 0 the outcome is
  `already-cheapest` and no amount is shown (never a negative saving). Other
  outcomes: `no-baseline`, `no-complete-store`, `nothing-comparable`.
- **Privacy**: `/api/savings` only reads the body, validates it, computes and
  answers. It does not log, store or forward coordinates or items, the response
  has `Cache-Control: no-store` and carries distances, not the origin
  (`savings-privacy.test.ts`).
- **Location**: the origin is the purchase's saved place. Device location is
  used only after "Use my location" (one read, not saved), only as the origin,
  and is sent only to our own `/api/savings`. It never proves anything.
- **Read-only**: the feature never writes IndexedDB, never edits a purchase and
  never creates a place or pin. "Show on the globe" only moves the camera to
  the branch's existing catalog dot.
- **Demo data** never reaches the engine: demo purchases have no saved record
  or barcode, so no panel is shown and nothing is mixed into any total.

## Data basis

- Published ordinary shelf prices of Shufersal, Rami Levy and Osher Ad in Tel
  Aviv-Yafo (40 branches, 34 located), published 4.10.2026. Promotions and club
  prices are **not** applied.
- Every comparison shows its price date, e.g. "מחירי מדף שפורסמו ב-4.10.2026,
  ללא מבצעים" / "Shelf prices published on 4.10.2026, without promotions",
  plus "not a current price, stock level or checkout price". The date is never
  a literal: the engine returns `published.earliest/latest` from the
  `publishedLocal` of the price files of the stores actually in the result
  (falling back to the catalog's `generatedAt`), and `priceDateNote()` shows one
  date or a range ("published between X and Y") in Hebrew and English.

## Freshness: how this relates to the 24-hour rule

These are **two different data sources with different rules**, and both stay
as they are:

| | Petah Tikva city comparison (Shon) | Savings engine (this branch) |
| --- | --- | --- |
| Data | `city-snapshot.json`, prices fetched with a `publishedAt`/`fetchedAt` per file | `data/catalog/tel-aviv.json`, one dated snapshot built offline |
| Claim | "Prices near you **now**" for a receipt | "Shelf prices **as published on** a stated date" |
| Rule | A quote older than 24 hours (`MAX_PRICE_AGE_MS`) is hidden (`stale`) | Nothing is hidden by age; the publication date is always shown next to the numbers |

Why the older snapshot is still shown: the savings panel never claims a current
price, stock or checkout price. It compares the same barcodes across branches
**from the same publication**, so the comparison is internally consistent even
when the snapshot is days old, and the visible date lets the person judge it.
The 24-hour rule exists because the city comparison presents prices as current;
applying it here would hide the whole feature without making any number more
true. Refreshing the catalog is out of scope; when it is rebuilt, the shown date
changes with it automatically.

## Pieces

| File | Role |
| --- | --- |
| `src/features/savings/savings-engine.ts` | Pure engine: per-product offers, basket totals, baseline, outcome. Typed result, no UI strings. Max 100 items. |
| `src/features/savings/savings-request.ts` | Strict request validation (unknown fields, GTIN check digit, quantities, coordinates, store ID, radius ≤ 20 km, body ≤ 32 KB). |
| `src/app/api/savings/route.ts` | `POST /api/savings` → engine result; 400 on bad input, 503 if the catalog is unavailable. The catalog stays on the server (`outputFileTracingIncludes` in `next.config.ts`). |
| `src/features/savings/purchase-basket.ts` | Saved purchase → basket + origin (saved place coordinates and catalog store ID). |
| `src/features/savings/SavingsPanel.tsx` | "איפה זה זול יותר?" in purchase detail. |
| `src/features/savings/BarcodeBranchCompare.tsx` | Barcode result: distance from me, "your branch", "₪X cheaper than your branch". |
| `src/features/savings/savings-camera.ts` | Keeps the flown-to branch beside/above the open panel. |
| `src/features/savings/savings-privacy.test.ts` | Proves the route only reads, computes and answers (no logging, storage, outbound call or echoed origin). |

Shared files touched (small, additive): `SpendscapeGlobe.tsx` (panel + camera
call), `CaptureBarcode.tsx` (distance per row + one component), `next.config.ts`.

## Limits

- A saved purchase stores **one barcode for the whole purchase**
  (`record.identification`), not one per line. The barcode is attached to a
  line only when the purchase has exactly one line; multi-line purchases list
  every line as `no-barcode`. Receipts have no barcodes today, so real baskets
  will compare once receipt lines carry barcodes (the engine already handles
  up to 100 items).
- Weighted products are not compared in baskets (price per kg vs unknown
  weight).
- Tel Aviv only; one dated snapshot; no promotions or club prices.
- Distances are straight lines, not walking or driving routes.

## How to test

```
npm.cmd run typecheck
npm.cmd test            # savings: src/features/savings/*.test.ts (43 tests)
npm.cmd run build
npx.cmd next start -p 3217 -H 127.0.0.1
$env:SPENDSCAPE_SAVINGS_BASE='http://127.0.0.1:3217'; npx.cmd playwright test --config qa/savings.config.ts
```

The Playwright spec (`qa/spendscape-savings.spec.ts`) scans Goldstar 6×330 ml
(`7290008464741`), saves it at Shufersal Ben Yehuda, opens the purchase and
checks the store, the ₪ amount and the price-date note in Hebrew and English at
390 px and 1280 px. It also checks that the request carries only barcode,
quantity, paid amount and the saved place, and that IndexedDB is unchanged after
"show on the globe".

Example (real catalog numbers): 1 × Goldstar at Shufersal Ben Yehuda, shelf
₪43.90 → Osher Ad Tel Aviv, 2.8 km, ₪31.90 → "היית חוסך ₪12.00". With 2 units:
₪87.80 vs ₪63.80 → ₪24.00.

## Screenshots

Written by the spec to `artifacts/savings/` (git-ignored):

1. `he-390-02-savings-panel.png` — Hebrew phone, the savings panel.
2. `en-1280-02-savings-panel.png` — English desktop, the savings panel.
3. `he-390-01-barcode.png` — barcode result with distances, chosen branch and
   "זול ב-₪12.00 מהסניף שבחרת".
