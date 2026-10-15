# Deploying Spendscape (preparation only)

Written 16 October 2026 on `integration/candidate`. Nothing here has been run
against Vercel: no login, no project change, no deployment. These are the steps
for the owner after the candidate is reviewed.

## Project

Reuse the existing Vercel project **`spendscape-college-demo`**
(https://spendscape-college-demo.vercel.app). Earlier handoff notes say the
project was paused; resume it in the Vercel dashboard first if it still is.

| Setting | Value |
| --- | --- |
| Git repository | `Yotams9/speand-tracking-map-` |
| Production Branch | `main` — updated only by a reviewed PR (e.g. from `integration/candidate`) |
| Framework preset | Next.js (build `next build`, output detected automatically) |
| Install command | default (`npm install`; the lockfile is committed) |
| Node.js | 22.x (`package.json` requires `>=22.14.0`) |
| Environment variables | **none** |
| Preview deployments | on for every branch (default) |

### No environment variables

The ordinary app needs none. Do **not** add `GEMINI_API_KEY`,
`GEOAPIFY_API_KEY` or any `SPENDSCAPE_*` variable to the project:

- `SPENDSCAPE_SYNTHETIC_QA` turns on synthetic QA fixtures (and only for
  loopback requests); it must stay unset in a hosted deployment.
- Receipt recognition (`/api/receipt-*`) and address search
  (`/api/address-search`) are local-only. On Vercel they answer a plain
  `404 {"status":"disabled","code":"local-only"}` before any handler runs, so no
  file, key, quota or provider is touched (`src/server/hosted-guard.ts`, tests in
  `hosted-guard.test.ts`). The client only calls them from loopback anyway.

### Files the hosted build must include

The catalog snapshot `data/catalog/tel-aviv.json` is read from disk at request
time. `next.config.ts` → `outputFileTracingIncludes` lists it for every route
that reads it: `/api/catalog/[gtin]`, `/api/catalog/stores`, `/api/savings`.
`src/server/deploy-readiness.test.ts` fails if a new disk-reading route is not
listed there, or if a receipt/address route loses its local-only guard.

### Fonts and map tiles

- Inter and Heebo come from `next/font/google`: downloaded at build time and
  served from the deployment itself (no runtime font request).
- Map tiles and style come from `https://tiles.openfreemap.org`
  (`access-control-allow-origin: *`, checked from a hosted origin). No key.

### HTTPS Preview URLs (camera and GPS)

Phones allow the camera (barcode scan) and geolocation ("Find the store I'm
in", "Use my current location") only on secure origins. Every branch push gets
an HTTPS Preview URL (`https://spendscape-college-demo-git-<branch>-<team>.vercel.app`);
use it for phone testing instead of a LAN IP over plain HTTP. Production is also
HTTPS.

## After each deployment (checklist)

Open the deployment URL on a phone (HTTPS) and on a desktop:

1. **First run**: the app opens in Hebrew with the home card ("עוד אין רכישות");
   the language switch shows English; demo data loads only on request.
2. **Barcode**: scan (or type) **07290008464741**. The card shows the
   published Tel Aviv shelf prices, the cheapest branch marked, distances and
   the "your branch" comparison.
3. **Store and price**: continue to purchase details; "Find the store I'm in"
   suggests the nearest branch and Save is blocked until "I confirm this
   purchase was at this branch" is ticked; choosing another branch from the list
   updates the filled-in price and total.
4. **Savings panel**: open the saved purchase; the savings panel appears for
   that barcode purchase (never for demo purchases).
5. **he/en**: switch language; texts, numbers and layout follow (RTL/LTR).
6. **Backup**: Profile → On-device data → export a backup, then restore it in
   a fresh browser profile (empty destination only) and see the same pin.
7. **Closed routes**: `curl -i <url>/api/receipt-ocr` and
   `curl -i <url>/api/address-search` answer `404` with `"code":"local-only"`.
8. **Catalog routes**: `<url>/api/catalog/stores` answers `200` with stores.

## Not covered

- No real-phone camera/GPS check has been done for this candidate (needs the
  Preview URL).
- The price catalog snapshot is not refreshed here; its published date shows
  in the price note.
