# Spendscape integration report — final merge, phase 1

Date: 15 October 2026. Branch: `integration/final` (pushed; nothing pushed to
`main` or any other branch, nothing deployed, no provider quota used).

- Base: `origin/feature/spendscape-rebuild` (Shon) at `c481edb`.
- Merged: `origin/feature/gal-cleanup-and-look` (Yotam) at `ffafbd8`, merge-base `66fb420`.
- Not merged: `origin/feature/receipt-r1` (Ofir) — see "Receipt R1" below.

Guiding rule (R4): where both sides changed the same thing, both behaviours were
kept; where they could not coexist, Shon's data, validation and safety logic won
and Yotam's presentation (Hebrew, wording, layout, fonts, colours) was kept.

## 1. Conflicts and resolutions

The merge produced exactly the 10 expected conflicts. Each conflicted file was
resolved by taking Shon's version as the base and porting Yotam's changes by
hand, so no part of the retired localStorage ledger could slip in through an
automatic hunk.

| File | Shon | Yotam | Resolution |
| --- | --- | --- | --- |
| `src/app/layout.tsx` | On-device description | Hebrew `lang/dir`, Heebo/Inter, catalog description | Yotam's fonts, `lang="he" dir="rtl"`; one description covering both. |
| `src/features/capture/session-purchase-domain.ts` | Local directory (`directoryIntent`), discounts, Unknown context, `deleteLocalPurchase`, async save results | `newStore`/`catalogStore` inputs, merchants/places inside the ledger, `removeSessionPurchase`, evidence label "saved on this device" | Shon's file kept unchanged except an optional `catalogPrices` form hint (never saved). Yotam's store concepts moved into Shon's directory (R2, §3). Shon's evidence label kept: IndexedDB hydration rebuilds every record and requires exact equality, so changing it would invalidate existing user data. |
| `src/features/capture/PurchaseReview.tsx` | Receipt review, directory form, discounts, final payable, storage errors | Catalog branches in the place list, "find the store I'm in", published-price fill, local-time date, Store wording, `＋ New store…` | Both. Catalog branch → `directoryIntent: { catalogStore }`; an already-saved branch is offered once, as its place. `＋ New store…` opens Shon's merchant+place form. Date field shows/accepts local time and still stores UTC minutes. Receipt mode unchanged. |
| `src/features/capture/CaptureBarcode.tsx` | Demo catalog only behind the QA gate | Tel Aviv lookup, per-store prices, cheapest badge, price hint for the form | Both: demo products stay QA-only; every other valid barcode is looked up on our own `/api/catalog/[gtin]`. |
| `src/features/capture/CaptureExperience.tsx` | Async save, receipt QA hooks, wording | Store wording, `catalogPrices` hand-off, `offered` prop | Shon's file + Yotam's wording and `catalogPrices`. `offered` dropped: the globe now passes the person's own capture context (§4). |
| `src/features/globe/SpendscapeGlobe.tsx` | IndexedDB hook, QA gate, delete, place/time correction, city comparison, privacy panel | Demo toggle, empty states, locale/demo preferences, catalog map layer, month card, purchase hero amount, two-press removal, localStorage effects | Shon's file + Yotam's presentation. localStorage effects and two-press removal dropped in favour of Shon's IndexedDB writes and confirmed delete (same feature, Shon's safety). Demo toggle re-implemented as a view-only layer (§4). |
| `src/features/globe/SpendscapeGlobe.module.css` | Delete/location-review styles | Visual polish (tokens, frosted panels, 44 px controls, demo toggle, empty states) | Yotam's file + Shon's added classes appended. |
| `src/features/globe/SpendscapeAnalytics.tsx` | QA/ordinary copy, Unknown category | Month card, first-run empty state, demo labels | Both; month card counts only the person's own purchases (R3). |
| `qa/spendscape-scanner-b.spec.ts` | "Manage local data" + erase | "Remove saved additions" | Shon's (matches the merged UI). |
| `qa/spendscape-scanner-e.spec.ts` | IndexedDB persistence assertions | localStorage assertions + 3 new tests | Shon's; Yotam's 3 new tests ported to IndexedDB/directory (§7). |

Other R4 decisions recorded:

- **Fresh-user empty state.** Shon showed a "globe ready for your first purchase"
  map card; Yotam showed a home card with Add and Load demo. They overlapped (an
  issue Yotam had already fixed once). Ordinary users now get Yotam's home card;
  Shon's map card remains for "purchases exist but none pinned" and in QA mode.
  Shon's `qa/spendscape-college-m1.spec.ts` line 36 still expects the old card for
  a fresh user; it is not in this run's required list and is listed as a known
  intentional difference (§8).
- **Wording.** Merchant/בית עסק → Store/חנות also in Shon's newer UI (directory
  form, receipt summary, privacy panel, backup preview). Code identifiers and
  stored keys are unchanged.
- **Language.** Ordinary users start in Hebrew. The loopback-only synthetic QA
  gate keeps its English baseline so both teams' suites run unchanged. The
  language preference is written only when the person switches language, never
  on load (Shon's suites assert an empty storage state).
- **Delete.** Shon's confirmed delete (and Undo, place/time correction) replaces
  Yotam's two-press removal; both remove one purchase and prune unused places.

## 2. One store and the one-time migration (R1)

IndexedDB (`spendscape-local-purchases`) is the only purchase store.
`src/features/capture/session-purchase-storage.ts` and its writer/effects are
deleted. `src/features/local-purchases/legacy-device-migration.ts`:

1. Runs once inside `useLocalPurchases` after the first IndexedDB read, while the
   UI is still inert (`data-local-state="loading"`).
2. Does nothing if the marker `spendscape.device-purchases.v1.migration` exists
   or the old key is absent. If IndexedDB is not empty it records
   `skipped-not-empty` and writes nothing.
3. Parses the old ledger strictly, all or nothing. Each kept record is rebuilt
   from decimal input through `reviewedRecord` (the reviewed-save boundary), so
   money is re-derived in integer minor units; the rebuilt purchase must match
   the stored facts exactly (ID, timestamp, channel, resolution, payment,
   category, amount, currency, FX, items, evidence, barcode identity). The
   whole envelope then passes `validateLocalPurchaseWrite`. Any failure skips the
   import and reports it; nothing is partially imported.
4. Purchase IDs are kept. `device_merchant_NN`/`device_place_NN` keep their
   sequence as `local_merchant_N`/`local_place_N`; pinned stores become
   `locationMethod: 'device-location'` with the old labels ("Pinned by you").
   `chain_*`/`store_*` become a chain merchant and a `catalog-store` place with
   the published address from `/api/catalog/stores` (bounded 10 s wait; on
   timeout the import is deferred to a later load). A branch no longer in the
   catalog skips the import (`unknown-store`) rather than inventing an address.
   References to fictional demo stores/places skip the import
   (`fixture-reference`); only the built-in "store not identified" merchant is
   allowed. Online-only flags are not carried (Shon's directory has no such
   flag). Demo (synthetic) records are never imported and are counted.
5. Writes with Shon's empty-only atomic restore transaction (refuses a non-empty
   destination even if another tab wrote meanwhile), then sets the marker. After
   a lost race or deferral the store is re-read. The old key is only ever read —
   never rewritten or deleted.
6. Notices: a successful import is reported once. A skipped import of the
   person's own purchases (destination not empty, invalid, over the 1,000
   purchase capacity) is shown on every load until dismissed; dismissing updates
   only the migration marker.

Unit tests (`legacy-device-migration.test.ts`, 10): valid import (IDs, agorot,
FX, barcode, both place kinds, pins, envelope validity); old ledger without
stores; 18 kinds of invalid data (incl. demo-store references and a branch
missing from the catalog) each skipping the whole import; waits for the store
list; marks done and never touches the old key; repeat run is a no-op; repeat
without the marker cannot duplicate (destination not empty); non-empty
destination untouched and reported until dismissed; invalid data reported;
concurrent write/storage failure retried later; no old ledger → nothing written.

## 3. Catalog stores are places (R2)

Choosing a Tel Aviv chain branch (from the list or "find the store I'm in")
sets `directoryIntent: { catalogStore }`. On save, `proposeDirectory`:

- reuses the existing place whose `catalogStore.storeId` matches, otherwise
- reuses the chain's merchant (`catalogChain`) or creates one with the canonical
  chain name, and creates a place with `source: 'user-confirmed'`,
  `locationMethod: 'catalog-store'`, `address` = published address, and
  `catalogStore: { storeId, chain, publishedAddress }`.

The user's choice is the confirmation. Coordinates are the catalog's OSM address
point; neither they nor the device location prove a purchase. `validateDirectory`
enforces: canonical chain names, one merchant per chain, groceries category,
Tel Aviv-Yafo/Israel labels, address equal to the published address, unique
store IDs, no address-search metadata; older envelope versions cannot carry
catalog fields. Because these are ordinary directory places, pins, Stats,
backup/restore, delete/prune and the address-to-pin "reuse" option include them.
Published price/quantity/total/date still auto-fill and stay editable.
Tests: `catalog-place.test.ts` (6) and the rewritten chain-store section of
`catalog-stores.test.ts`.

## 4. Demo data (R3)

- Fresh ordinary users start empty (Shon). The server still never puts synthetic
  purchases into the user snapshot.
- `page.tsx` passes the fictional history separately as `demoHistory`. The
  visible toggle (header, home card, Purchases, Stats) shows it next to the
  person's purchases, labelled "Demo data on" and "Demo · fictional purchase" on
  each demo detail. Hiding it changes only the view.
- Demo purchases never reach IndexedDB, backups, the purchase form (fictional
  stores are never offered; only the "store not identified" choice is), the
  duplicate-check baseline, or the "this month" card (own purchases only, with a
  note while demo is shown). Stats figures below the card include demo purchases
  while the toggle is on and say so.
- Smart Inbox and Ask remain QA-gate only (their decisions would otherwise be
  persisted).
- The QA gate (`SPENDSCAPE_SYNTHETIC_QA=1` + loopback + header/param) is
  unchanged and ignores the toggle.

## 5. Unit tests

| | Tests | Notes |
| --- | --- | --- |
| Shon before | 1,095 | On this Windows machine 1,002 pass, 93 fail (see below). |
| Yotam before | 241 | 241 pass. |
| Merged after | 1,152 | 1,059 pass, 93 fail — the identical 93 that fail on Shon's untouched branch here. 0 new failures. |

1,152 = Shon's 1,095 + Yotam's 41 in files only he had (demo visibility 8,
price catalog 5, catalog stores 11, insights 17) + 16 new (catalog places 6,
migration 10). Yotam's other 181 tests live in files both branches share, where
Shon's later versions already contain them. Yotam's `device-store.test.ts` (11)
and `session-purchase-storage.test.ts` (8) tested the retired localStorage
ledger; their cases are covered by the migration and catalog-place tests
(intentional behaviour change). In `catalog-stores.test.ts` the "chain store
purchases" section was rewritten for the directory model (same count).

The 93 environment failures are in server-side receipt/address-session modules
(`src/server/*`, `src/features/receipt-image/*`): 39 throw `EPERM` from
directory `fsync`/rename on Windows and the rest fail downstream of those file
operations. They fail identically on a clean checkout of Shon's branch here.

## 6. Playwright

Setup (all mine, loopback only, no provider calls): production build of
`integration/final`, `next start` on 127.0.0.1:3301 with `SPENDSCAPE_SYNTHETIC_QA=1`,
a second instance on 3196 (Shon's backup spec opens its fresh restore profile
there), and `qa/qa-gate-proxy.mjs` on 3302. Provider hosts are blocked by the
specs; address search is answered by route mocks; receipts are injected through
the existing loopback QA hook. No server I did not start was touched.

Why a proxy: Playwright's `extraHTTPHeaders` sends the QA opt-in header to every
host, including the map tile host, whose CORS preflight rejects it — the globe
then never loads and every QA-gate test times out. The proxy adds the header to
same-origin app requests only.

Baseline method: every required Shon suite was also run unchanged against a
clean production build of `origin/feature/spendscape-rebuild` (same proxy setup,
ports 3311/3312). A merged failure counts as pre-existing only if the same test
fails there.

Baseline (Shon's untouched branch, 87 tests): 55 passed, 32 failed — 28 in his
own suites (below) and 4 backup tests that only failed because nothing listened
on 3196 in that run.

Round 2 on the merged build (110 tests): 71 passed, 39 failed. Every failure was
either pre-existing on Shon's branch, the walk-through's receipt step (the test
used the old store dropdown; fixed), Shon's backup restore profile now starting
in Hebrew (test given an English preference), or `nearby-demo` Hebrew asserting
an empty storage after the language switch (test now ignores only the language
preference).

Final round (110 tests, latest build, 1.1 h): **82 passed, 28 failed. All 28 failures
fail identically on Shon's untouched branch (same tests, same counts: local-directory
12, receipt-review-integration 15, scanner-e 1). No failure is caused by the merge.**

| Spec | Final | Notes |
| --- | --- | --- |
| Shon · spendscape-purchase-backup | 10/10 | Export, preview, restore into a fresh profile, reload and shared pin. |
| Shon · spendscape-receipt-review-integration | 2/17 (15 pre-existing) | Pre-existing on Shon's branch: receipt review now pre-fills the observed store as a new-store form, so tests that pick `merchant_unresolved` or a fixture place from the old dropdown time out. |
| Shon · spendscape-address-search | 13/13 | Mocked search only; no Geoapify call. |
| Shon · spendscape-local-directory | 0/12 (12 pre-existing) | Pre-existing on Shon's branch (same pre-filled receipt store; `review-new-merchant` is not shown in receipt mode). |
| Shon · spendscape-nearby-demo | 10/10 | City comparison and expiry, EN/HE. |
| Yotam · spendscape-first-run | 4/4 | Hebrew empty start, demo toggle remembered, catalog store, month card. |
| Yotam · spendscape-night-shots | 8/8 | |
| Yotam · spendscape-contrast | 4/4 | WCAG AA, he/en × 390/1440. |
| Yotam/Shon · spendscape-scanner-e | 27/28 (1 pre-existing) | The line-244 test is hard-wired to `127.0.0.1:3000`; it fails identically on Shon's branch (environment). |
| Integration walk-through | 4/4 | All 18 steps, he/en × 390×844/1280×900. |

No video-recording spec was in the required set, so no ffmpeg-only failures apply.

Walk-through screenshots: `artifacts/integration/walk/` (git-ignored), per
variant `he|en`-`390|1280`: 01 empty → 02 demo on → 02b demo purchases → 03 demo
off → 04 barcode prices + cheapest → 05 review filled from the chain branch →
06 saved → 07 reloaded globe → 08 purchase detail → 09 pin/place with catalog
provenance → 10 Stats month card → 11 backup panel → 12/13 restored in a fresh
profile → 14/15 receipt review and save → 16 city comparison → 17/18 mocked
address search and confirmed pin.

## 7. Test changes (R6)

Only where merged behaviour intentionally changed:

- `qa/spendscape-scanner-e.spec.ts`, `qa/spendscape-scanner-b.spec.ts`: Shon's
  versions kept (IndexedDB). Yotam's three new tests ported from localStorage to
  IndexedDB/directory assertions; his two-press removal became Shon's confirmed
  delete; "New store" now fills Shon's place form and needs the explicit
  confirmation checkbox.
- `qa/spendscape-local-directory.spec.ts`: the public store-list GET
  (`/api/catalog/stores`, used by the map's chain dots) is allowed; product
  lookups stay forbidden in that flow.
- `qa/spendscape-nearby-demo.spec.ts`: after switching language the only stored
  item may be the language preference (Yotam's remembered language).
- `qa/spendscape-purchase-backup.spec.ts`: the fresh restore profile gets an
  English preference (fresh profiles now start in Hebrew).
- Unit: `catalog-stores.test.ts` chain-store section rewritten for directory
  places; `device-store.test.ts` and `session-purchase-storage.test.ts` removed
  with the retired ledger and replaced by `legacy-device-migration.test.ts` and
  `catalog-place.test.ts`.
- New: `qa/integration.config.ts`, `qa/qa-gate-proxy.mjs`,
  `qa/spendscape-integration-walk.spec.ts`.

## 8. Known differences and follow-ups

- Shon's receipt/directory browser tests that pick a store from the old receipt
  dropdown fail on his own branch too; they need updating to the pre-filled
  store form (his change). Not touched here.
- `qa/spendscape-college-m1.spec.ts` (not in the required set) expects Shon's
  fresh-user map card; fresh users now see Yotam's home card.
- The 93 Windows-environment unit failures (§5) are pre-existing.
- Chain-branch choices and their published address are validated for shape, not
  re-checked against the catalog at save/restore time (the list comes from our
  own server; a tampered backup could carry a wrong address). Follow-up: verify
  against `/api/catalog/stores` before saving a new catalog place.
- After the published price fills quantity 1 and the total, changing the
  quantity does not recompute the total; validation then asks for a correct
  total (unchanged from Yotam's branch).
- `demoStory` in `src/data/demo-visibility.ts` is now only used by its tests.

## 9. Receipt R1 (Ofir) — not merged

Shon's receipt flow covers capture, review and validation. Worth porting later:

- The extraction prompt rule "transcribe only what is printed; never guess,
  complete or estimate" and the per-line tolerance table (±1 agora per item,
  ±2 per kg line) as explicit cases in Shon's validator tests.
- Optional `barcode`, `chain` and `branchName` fields in the extraction: with the
  Tel Aviv catalog they could suggest (never confirm) a chain branch and allow
  barcode-only price comparison for receipt lines.
- `tools/receipt-benchmark/run.mjs` (counts and validation status only, reads a
  git-ignored folder) as a privacy-safe benchmark harness.
- The documented Interactions API notes and latency measurements (2026-10-09).
- Its `.gitignore` additions are already covered (`.env`, `.env.*`, `*.local`).

## 10. Agent handoff

State for the next agent working on `integration/final`:

- Commits on top of Shon's `c481edb`: merge resolution (`2723bbe`), legacy
  migration (`edad88b`), review fixes (`b681e4c`), QA tooling and ported tests
  (`dcea179`), then spec updates and docs. Only `integration/final` is pushed;
  `main` and the other branches are untouched; nothing is deployed.
- Authorities: purchases live only in IndexedDB (`local-purchase-store.ts`);
  every save goes through `saveReviewedPurchase` → `validateLocalPurchases`.
  Directory rules are in `local-directory.ts` + `place-provenance.ts`. Do not
  change `reviewedRecord` output (labels included): hydration rebuilds every
  record and requires exact equality, so any change invalidates saved data.
- Demo data enters only through the `demoHistory` prop of `SpendscapeGlobe`
  (from `src/app/page.tsx`). Keep it out of `captureContext`, the save
  baseline (`initialData.purchases`), `monthSummary` and IndexedDB.
- QA mode (`SPENDSCAPE_SYNTHETIC_QA=1` + loopback + `x-spendscape-synthetic-qa`
  header or `?syntheticQa=1`) starts in English; ordinary users start in Hebrew.
- How to verify:
  1. `npm.cmd ci`, `npm.cmd run typecheck`, `npm.cmd test` (on Windows expect
     exactly the 93 environment failures listed in §5), `npm.cmd run build`.
  2. Start `next start -p <free> -H 127.0.0.1` with `SPENDSCAPE_SYNTHETIC_QA=1`,
     a second instance on 3196 for the backup spec, and
     `node qa/qa-gate-proxy.mjs <proxyPort> <serverPort>`.
  3. Set `SPENDSCAPE_IT_BASE=http://127.0.0.1:<server>`,
     `SPENDSCAPE_IT_QA_BASE=http://127.0.0.1:<proxy>`, `SPENDSCAPE_BACKUP_QA_OUT`
     and `SPENDSCAPE_ADDRESS_QA_OUT`, then
     `npx.cmd playwright test --config qa/integration.config.ts`.
- Windows pitfalls met here: unlink a `node_modules` junction before removing
  a git worktree that contains it — worktree removal follows the junction and
  empties the target. Turbopack refuses a junctioned `node_modules`, so a
  separate build checkout needs its own `npm ci`.
- Do not run the `tools/receipt-capture` or `tools/address-search` launchers or
  any live provider; never read or commit `.env*`.
- Next steps: update Shon's receipt/directory specs to the pre-filled store
  form; decide on `college-m1`'s fresh-user expectation; add catalog
  re-verification for chain places; then open a PR from `integration/final`
  for review (not done; it needs the owner's decision).
