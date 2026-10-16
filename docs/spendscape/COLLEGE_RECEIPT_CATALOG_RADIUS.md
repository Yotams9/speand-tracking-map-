# Receipt comparison using the existing Tel Aviv catalog

## Scope and authorization — 16 October 2026

The user requested a working comparison fallback using the prices already in the code, including the Tel Aviv catalog used by barcode lookup. This slice implements and verifies that local fallback on `integration/final`, based on `4ef4d166927fa06670639eac071db283b725470e`.

Publication, deployment and any fresh collection require their own authorization. No new provider request, retailer HTTP request, key change, plan change or real-ledger operation was performed in this slice.

## Diagnosis

The existing Petah Tikva comparison was already present, but its two publications had passed the existing 24-hour expiry. The two separately authorized refresh attempts ended in timeouts; neither produced a completed retained listing or a PriceFull download. Their consumed reservations and evidence were preserved. The precise HTTP failure cause remains unknown.

DNS, TCP and certificate-verified TLS diagnostics in the same session succeeded against both `prices.shufersal.co.il` and `pricesprodpublic.blob.core.windows.net`. This establishes reachability at those layers at that time; it does not establish why the earlier HTTP requests timed out or qualify new prices. No HTTP retry was made for those diagnostics.

The local barcode catalog was available independently: 40 Tel Aviv stores across three chains, 30,603 product identities, with publications dated 4 October 2026. Thirty-four stores have OpenStreetMap address points; six lack points. These are archived publications, not verified current prices. Nationwide coverage is not present.

A further executable-path check found that the bundled Mango product has an empty optional manufacturer field. Explicit confirmation is therefore based on the displayed product name, GTIN and known package; the UI honestly displays unknown manufacturer. No brand/manufacturer is inferred or fabricated.

## Behavior

1. Open a saved native receipt in Purchases, then **Price comparison**.
2. The default **Catalog near purchase** mode uses the same bundled catalog and product lookup endpoint as barcode lookup.
3. Search explicitly by product name or barcode. Search goes to this application's local catalog endpoint, not Gemini, Geoapify or a retailer. The query is sent in a POST body; no receipt photo, coordinates or financial values are sent with it.
4. Choose a candidate and explicitly confirm the same product, brand, variant and package. No automatic match is made. Unknown packages, weighted products, unsupported quantities and foreign-currency receipts cannot produce a quote.
5. A confirmed purchase-owned pin supplies the origin. Choose a 5, 10 or 20 km straight-line radius. Unlocated stores are excluded. Store coordinates are address points, not independently verified business premises or driving distances.
6. Results show branch, address, distance, publication time, matching coverage and archived price totals. Only a fully matched basket receives a historical difference against the independent final payable. Partial coverage is never presented as the whole basket or savings. No basket splitting is recommended.
7. **Petah Tikva publications** retains the original city comparison and its expiry behavior.

Matches are temporary and clear on close, mode change or reload. Editing a search clears its previous match. Purchase IDs, paid amounts, receipt rows, dates, merchant/place associations and pins are not changed. Scanning, address search, API operating mode and usage settings remain unchanged.

## Verification

- 33 focused tests across existing catalog, search, comparison, city and receipt comparison modules passed.
- Five production-browser scenarios passed: EN/HE, widths 360/390/430/1280, complete and partial matching, unresolved origin, 5/10 km filtering, publication display, exact expected totals, old city mode, search-edit invalidation, close/reopen, focus return and reload.
- Four local route contract checks passed, including Hebrew search and invalid/oversized/extra-field bodies.
- Synthetic ledger equality before/after comparison and reload passed. No real browser ledger was accessed.
- Rendered EN/HE phone screenshots were inspected; panel overflow checks passed.
- Application typecheck, production build and whitespace checks passed. The production function trace includes the bundled catalog for `/api/catalog/search`.
- No new dependency was added. Existing catalog JSON and the Petah Tikva snapshot are unchanged.

Evidence: ignored `artifacts/receipt-catalog-radius-20261016/` in the original rebuild worktree. `qa/catalog-receipt-ui.cjs` runs only against an explicitly supplied literal loopback origin and uses an isolated synthetic ledger. Tests use the actual bundled public catalog, without provider calls.

## Limits

This restores useful receipt-to-catalog comparison and address-point radius filtering using existing data. It is an archived reference comparison. Current nationwide cheaper-price recommendations still require accessible current publications and appropriate branch-location evidence. No live refresh, nationwide coverage, verified business-premises claim, guaranteed savings or physical-device verification is claimed.
