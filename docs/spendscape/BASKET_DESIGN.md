# Multi-item baskets — design

Status: design only (2026-10-15). Nothing under `src/`, `qa/` or `data/` changes here.
Goal: scan several products into one basket → choose the store once → save **one
purchase with N lines, each with its own barcode** → the savings panel compares
the whole basket.

## 1. What exists today (read from code on `integration/final` + `feature/savings-engine`)

- **One barcode per record.** `SessionCaptureRecord.identification`
  (`capture-domain.ts`) holds a single `{ identity: { original, format, gtin14 }, method, syntheticCatalog }`.
  `reviewedRecord` (`session-purchase-domain.ts`) copies it from
  `PurchaseReviewInput.identification`; `validateReview` re-checks it with
  `validateBarcode(original, format)` and requires the same `gtin14`.
  `PurchaseItem` (`spendscape-globe.ts`) has no barcode.
- **Scan → review.** `CaptureBarcode` calls `onCandidate(name, syntheticCatalog, catalogPrices)`;
  `CaptureExperience` opens the review with `source: 'barcode'`, that one
  `identification`, `catalogPrices` (a form hint, never saved) and **one** line.
- **Several lines in review.** `PurchaseReview` lets the user add lines (max 50),
  but `withPublishedPrice` (`catalog-stores.ts`) fills a price only when
  `lines.length === 1`. The "price filled" hint has the same limit.
- **Hydration (the critical constraint).** `validateLocalPurchases`
  (`local-purchase-store.ts`) turns every stored record back into a
  `PurchaseReviewInput`, rebuilds it with `reviewedRecord` and requires
  `same(stored, rebuilt)`; any difference makes the **whole store** `invalid`.
  The envelope is `version: 4` (1–4 accepted, migrated in memory only). Backup
  (`purchase-backup.ts`) and time correction (`purchase-time.ts`) go through the
  same validator; backup import accepts data versions 1–4.
- **Per-line precedent.** `record.demoProductIds` is already a per-line array
  next to `purchase.items`: optional, same length as `items`, validated and only
  emitted when present.
- **Savings today.** `purchase-basket.ts` attaches `record.identification` to the
  only line, and only when the purchase has exactly one line. Every other line
  is sent as `no-barcode`. The engine already handles 100 items, partial stores
  and never splits a basket.

**What a per-line barcode changes.** If `reviewedRecord` *always* emitted a new
field (even an empty one), every record users have saved would fail `same()` →
the store becomes invalid on next load. If the field is **optional and emitted
only when the input has it**, old records rebuild byte-identically and nothing
breaks. What does break is the other direction: an **older build** reading a
record that has the field rebuilds it without it → `invalid`. That is why the
envelope version must change.

## 2. Options

| | A. Barcode on `PurchaseItem` | B. Sidecar store `purchaseId → line barcodes` | **C. Optional per-line array on the record (recommended)** |
| --- | --- | --- | --- |
| Shape | `items[i].gtin14` | separate IndexedDB key / object store | `record.lineIdentifications?: (LineId \| null)[]`, same length as `items` |
| Existing saved data | Rebuilds identically only if the field is omitted when absent | Untouched | Rebuilds identically (field absent ⇒ not emitted) |
| Data migration | none needed (optional) | none | **none** |
| Version | v5 | purchases stay v4, but backup format must go to v2 (it is `exactObject` on 5 keys) | v5 envelope; backup format stays v1, data v5 |
| Blast radius | `GlobePurchase` is shared by demo history, insights, analytics, both price comparisons, Replay — all see a new field | New paths in write, delete, undo, prune, restore (empty-only + atomic), time correction, backup; orphans/length drift must be validated separately | Only capture/review/store/backup + savings; the globe, demo data and insights never see it |
| Consistency | Automatic | Must be kept in one transaction with the purchase; easy to drift | Automatic (lives in the record, removed with it) |

B looks safer ("Shon's data untouched"), but it is not. Backup, delete/undo,
restore and validation all have to change anyway, and the two stores can drift
apart. A puts a capture-only fact on the shared purchase type. **C** keeps the
proven `demoProductIds` pattern and has the smallest surface.

## 3. Recommended design (C)

**Schema**

- `ReviewLine.identification?: { identity: BarcodeIdentity; method: 'camera' | 'manual' }`.
  It is attached to the line itself, so removing or reordering a line keeps its barcode.
- `SessionCaptureRecord.lineIdentifications?: ({ identity; method } | null)[]`.
  `reviewedRecord` emits it **only if at least one line has an identification**,
  with length `items.length`.
- `validateReview`, per line: provenance `user-reviewed`; `validateBarcode(original, format)` must give the same
  `gtin14`; method `camera|manual` (no `demo`, no `syntheticCatalog`, so demo data cannot enter);
  a record-level `identification` and line identifications are mutually exclusive.
- `validateLocalPurchases`:
  - map `r.lineIdentifications[i]` back onto each input line;
  - `denseArray(…, 50)` with length equal to `items`;
  - **`version < 5` must not carry it** (same rule style as the v<4 checks);
  - accept 1–5 and write `version: 5`.
- Update the version literals in `local-purchase-store.ts`, `purchase-time.ts`,
  `legacy-device-migration.ts` (the migration still writes records without the
  field), and the accepted data versions in `purchase-backup.ts`.
- Existing single-scan records keep `identification`; they are **not** rewritten.

**Prices per line (`catalog-stores.ts`)**

- `ReviewLine.catalogPrices?: Record<storeId, number>` is a form hint, never saved,
  like today's `input.catalogPrices`.
- `withPublishedPrices(input, storeId)` fills each line from its own map, all in agorot.
- A line remembers `autoFilledFrom: storeId` (form-only). On store change, only
  lines that still hold the auto-filled value follow the new store; typed values
  are kept. This builds on the separate "price follows store" fix.
- A line with no price at that branch stays empty and is marked
  "not published at this branch — enter what you paid".
- Weighted products get no auto-fill (unit `kg`, as today).
- The purchase total is the sum of the line totals in integer agorot.

**UI flow**

1. Scan, or type a code. The result card shows prices as today, plus a new
   **"הוספה לסל" / "Add to basket"** button next to "Continue".
2. The basket tray (in `CaptureExperience`, memory only, never persisted) shows
   N items. Scanning the same GTIN again increases that line's quantity.
3. "Scan more" goes back to the camera. "Review basket" opens one review with N lines.
4. Choose the store **once**: a chain branch from the list, or "find the store
   I'm in". Location only suggests, and the user confirms.
5. Each line's price auto-fills from that branch and stays editable. Review, then save
   one purchase with N lines, each line with its own barcode.

**Savings.** `purchase-basket.ts` reads `lineIdentifications` first (line `i` →
its `gtin14`, `null` → `no-barcode`). It falls back to today's single
`identification` rule. The engine is unchanged: identical GTIN-14 only, a
store's total only if it prices every compared line, partial stores shown as
"has X of Y", shelf-vs-shelf at the chosen branch or vs what was paid. The panel
shows the basket total per store instead of one product.

## 4. Risks

- **One-way upgrade:** after the first save, data is v5. Older builds (other
  branches, an old deploy, restoring a v5 backup into an old build) reject it.
  The backup gives a clear `unsupported` instead of `invalid`. Mitigation: ship
  only on the merged `integration/final`, never on a side branch.
- **Silent mass invalidation:** any accidental change to `reviewedRecord`'s
  output for records *without* line barcodes breaks every user. Mitigation:
  golden tests that freeze today's outputs (below).
- Name edits: the barcode stays bound to its line even if the name is retyped
  (the barcode is the identity; the name is a label).
- Limits: 50 lines per purchase (store cap), 100 items in the engine.
- Each scanned code still calls `/api/catalog/[gtin]` once; that is acceptable
  for under 50 lines.
- Collision with the price-follows-store fix (see §6).

## 5. Effort and test plan

| Step | Hours |
| --- | --- |
| 1. Schema + validation + v5 + version literals + backup versions | 5 |
| 2. Golden and validation unit tests for step 1 | 3 |
| 3. Per-line prices and store-follow in `catalog-stores.ts` | 3 |
| 4. `PurchaseReview` per-line hints and "not published here" | 3 |
| 5. Basket tray and "Add to basket" (`CaptureBarcode`, `CaptureExperience`) | 6 |
| 6. `purchase-basket.ts` + panel wording for baskets | 2 |
| 7. Playwright flow + docs | 4 |
| **Total** | **~26 h** |

**Unit**

- **Golden:** fixtures of today's v4 records (barcode, receipt, manual,
  synthetic, discounted) hydrate and rebuild **byte-identical**.
- A v4 envelope carrying `lineIdentifications` is rejected. Wrong length, bad
  check digit, original/format mismatch, `demo` or `syntheticCatalog` are
  rejected. Record-level and line identifications together are rejected.
- A v4 store loads and the next write is v5 with identical records.
  Backup v1 export/import works with data v5.
- Delete, undo, prune and time correction keep the alignment.
- `withPublishedPrices`: fills only empty or still-auto-filled lines; follows a
  store change; 3 × ₪7.90 = 2370 agorot; weighted lines are not filled.
- `purchase-basket`: N lines with mixed `null`; demo records give `null`.

**Playwright (he/en × 390/1280)**

1. Scan 3 real Tel Aviv GTINs (one not published at the chosen branch) and add
   each to the basket.
2. Choose Shufersal Ben Yehuda. Two prices fill, one is marked missing. Type it,
   and edit one filled price.
3. Save, reload, and check that IndexedDB is v5 with 3 line barcodes.
4. Open the purchase. The panel shows a complete store with a basket total,
   partial stores as "X of Y", and the price date.

## 6. Collisions and build order

Files that collide with `fix/integration-review`:

- `PurchaseReview.tsx`: line rendering, price hint, store change.
- `catalog-stores.ts`: `withPublishedPrice`.
- `legacy-device-migration.ts`: the version literal.
- `useLocalPurchases.ts`: only the `LocalPurchases` type/version, if touched.

`CaptureBarcode.tsx` also changes on both that branch and `feature/savings-engine`.

Order:

1. Merge `fix/integration-review`, then `feature/savings-engine`, into `integration/final`.
2. Branch `feature/baskets` from that.
3. Build steps 1–2 (schema and golden tests) as one PR before any UI.
4. Then 3 → 4 → 5 → 6 → 7.

## 7. סיכום

היום כל רכישה שמורה מחזיקה ברקוד אחד בלבד, ולכן סל אמיתי לא מושווה. כל שינוי בפלט של `reviewedRecord` מבטל נתונים שכבר נשמרו, חוץ משדה אופציונלי שנכתב רק כשיש לו ערך. מאגר צדדי (B) נראה בטוח יותר, אבל הוא מחייב לשנות גם את הגיבוי, המחיקה והשחזור, ויכול לצאת מסנכרון עם הרכישות.

**המלצה:** אפשרות C. מערך ברקודים אופציונלי לכל שורה בתוך הרשומה (כמו `demoProductIds`), עם גרסת מאגר 5 ובלי שום הגירה של נתונים קיימים.
הסדר: קודם הסכמה ובדיקות "זהב" כ-PR נפרד, אחר כך מחירים לכל שורה, ורק בסוף מסך הסל.
הבנייה מתחילה רק אחרי ש-`fix/integration-review` ו-`feature/savings-engine` ממוזגים, כ-26 שעות עבודה.
