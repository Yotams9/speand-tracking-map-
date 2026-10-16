# Purchase action styling and radius comparison readiness — 2026-10-16

Base: integration/final `47b10caac3f8dbe6906763468c79026cd7ceb3c9`.

## Requested purchase-action styling

Only the existing three purchase-detail actions use `viewPlaceButton`: Confirm/change purchase place, City price comparison and View place. Added a dark teal surface, the site's existing mint text, a mint border, 10px separation between consecutive actions, wrapping-friendly padding/line height, hover/pressed feedback and visible keyboard focus. Existing button actions, wording, order and visibility are unchanged. The shared historical empty-state action retains its existing style.

Production-build visual/interaction checks passed at widths 360 EN, 390 HE, 430 EN and 1280 HE. All three actions opened their existing destination; touch targets were at least 44px, adjacent gaps were 10px and text contrast was 9.74:1. No horizontal document overflow. All four screenshots were visually inspected. Initial harness attempts checked keyboard-only focus immediately after mouse navigation; the corrected check performs keyboard navigation first. No application focus change was required. Typecheck, production build and whitespace passed. Fictional data and isolated browser storage only; no real provider call, saved purchase edit or live-form access.

## Radius comparison audit — existing code and data, no new collection

- `receipt-comparison.ts` already calculates a 5,000m inclusive straight-line radius from the purchase's confirmed physical place. It excludes stores without coordinates and coordinate evidence. This logic is not the ordinary city comparison's data path.
- Existing radius/city engine checks passed: 15 tests across two files. This does not establish a live radius recommendation or fresh prices.
- The ordinary city comparison is limited to Petah Tikva branches 104/285 and four common Monster 500ml products. Both branch coordinates and coordinate evidence are null. Publications are 2026-10-14T10:18:33Z and 10:20:47Z; their 24-hour freshness windows have expired on the audit date. No nationwide coverage or radius recommendation is implemented by that city panel.
- The separate barcode catalog contains 40 Tel Aviv stores across Shufersal (33), Rami Levi (6), Osher Ad (1), and 30,603 product identities. Thirty-four stores have OpenStreetMap address points with OSM references; six have no location. Published prices are from 4 October 2026. These are historical reference prices, not newly qualified current prices or proof of a particular store's physical occupancy.
- The barcode catalog uses GTIN-14 keys and different product/package/source structures from the receipt comparison contract. An adapter needs explicit identity/package mapping and provenance; raw dictionary copying or name-only automatic product matching would not qualify.

## Concrete next slice

Start with the existing Tel Aviv catalog area and a default 5km straight-line radius around the saved purchase pin, with a clear unresolved-location state. Reuse exact catalog identities and reviewed product/package matches. Keep per-store matching coverage, partial totals, publication dates and missing-location states visible. Preserve city comparison and historical barcode reference prices.

Before enabling ordinary current-price recommendations, qualify the selected branch-ID/address/point linkage and collect fresh public retailer publications for those branches. Price collection is separate from Gemini receipt extraction and Geoapify address lookup; removing those application quotas does not refresh the retailer catalog. No new collection/provider activation is performed or authorized by this checkpoint.

A first implementation can wire and test the radius adapter/UI offline against explicit synthetic fixtures, while current-price results remain unavailable until source qualification. It must not silently promote old barcode prices to current savings, invent branch coordinates, infer a barcode from a product label, change paid amounts or recommend a complete basket from partial coverage. Broader country coverage, road/travel radius, automatic retailer refresh and automatic product substitutions are outside this first slice.

## Release state

Styling is prepared locally for separately approved publication to the existing Preview. No API policy, key, plan, usage counter, data file, application handler or price freshness rule is changed. Main and the user's original worktree remain untouched.
