# Saved receipt Nearby Prices — offline checkpoint

Status: implementation and scoped offline QA complete; awaiting checkpoint review.
Entry/current HEAD: `0c781287054c98a9bc0ac3cda5032dc3695a0029`,
`feature/spendscape-rebuild`. No commit, provider request or deployment.

## Behavior and limits

User-added receipt purchase details offer Nearby Prices. The canonical confirmed
physical place defines a 5 km straight-line area; unresolved/online purchases have
no comparison origin. Opening the panel stops globe rotation without moving its
camera or creating pins. Existing illustrative comparison remains separate.

There is no activated native price source. Ordinary pages explain that verified
current prices are unavailable. Only an explicit `?nearbyPricesQa=1` on literal
loopback installs a temporary fictional-snapshot injection hook. Hosted pages,
duplicate flags, malformed snapshots and nonfictional injections are rejected.
No source transport, automatic collection, credentials or persistence is added.

The read-only v1 contract validates exact keys, dense bounded arrays, IDs, source
hash/timestamps, currency evidence, branch coordinates/provenance, product
identity/package basis and ordinary package prices. Missing facts remain null.
Duplicates, orphan prices, invalid GTINs, unsafe amounts and unknown fields fail
validation. Schema validation does not establish factual source qualification.
The first slice supports existing EAN-8/EAN-13/UPC-A validation, not GTIN-14.

Each receipt row requires explicit catalog selection and confirmation of product,
brand, variant and package size. No label/price/arithmetic-based automatic match,
substitution, identifier invention or unit conversion is performed. Packaged
products with positive integral item quantities are supported; weighted or
fractional quantities remain unavailable. Receipt values are never rewritten.
Matches and snapshots are transient and discarded on panel close/reload.

Prices require explicit ILS evidence and a publication timestamp no more than
24 hours old, no future publication/fetch, and qualified branch geometry within
the radius. Refetching does not refresh publication age. The preview displays
unmatched/unconfirmed/unknown identity/package/currency, unsupported quantity,
stale/missing prices and missing nearby branches. Per-store coverage and partial
subtotals are distinct from complete baskets. No stock, driving route or savings
claim is made. Publication/coverage/provenance remain separate facts.

The persisted purchase date is labelled UTC; this is not reconstruction of
unpersisted printed timezone metadata. Receipt prices are explicitly historical.
The actual 2013 purchase's product sum and final payable remain independent;
this task did not edit or inspect its browser storage. Synthetic QA uses different
fictional values (31.45 line sum, 31.50 payable), five rows and seven units.

## Exact task manifest

12 files; task-only patch/hunk counts and SHA-256 values:
`artifacts/nearby-preview-updvse96/manifest.json` and `TASK.diff`.

- `src/features/globe/SpendscapeGlobe.tsx` — lazy panel entry, close/focus/lifecycle.
- `src/features/nearby-prices/price-contract.ts`
- `src/features/nearby-prices/price-contract.test.ts`
- `src/features/nearby-prices/receipt-comparison.ts`
- `src/features/nearby-prices/receipt-comparison.test.ts`
- `src/features/nearby-prices/NearbyPricesReview.tsx`
- `src/features/nearby-prices/NearbyPricesReview.module.css`
- `qa/nearby-preview-fixtures.ts` — self-contained fictional fixtures only.
- `qa/nearby-preview.config.ts`
- `qa/spendscape-receipt-nearby.spec.ts`
- `docs/spendscape/COLLEGE_RECEIPT_NEARBY_PRICES.md`
- `docs/AI_HANDOFF.md` — appended Nearby Prices status only.

The QA fixture is an additional necessary test dependency; it is not loaded into
ordinary application pages. Earlier uncommitted handoff/server/research changes
remain outside this task's patch. Index remains empty.

## Verified evidence

Fresh isolated evidence: `artifacts/nearby-preview-updvse96/`.

- `unit-final.log`: 181/181 focused tests across seven files: new contract and
  comparison plus existing comparison, receipt adapter, session purchase, local
  storage and purchase-location regressions.
- `typecheck-final.log`: application typecheck passed.
- `qa-typecheck-complete.log`: strict typecheck of the three new QA files passed.
  This does not claim a clean repository-wide QA TypeScript check.
- `build-final.log`: production build passed in `app-final`, containing tracked
  HEAD plus the task candidate, excluding unrelated dirty server changes. Existing
  multiple-lockfile workspace-root warning remains; no dependency was added.
- `browser-final.log`: 22/22 combined production-browser checks: ten existing
  illustrative comparison checks, six purchase-location checks and six new
  receipt-preview checks. Undo, failed writes, revision conflict, reuse, fixture
  protection, reload, one MapLibre instance and baseline pins were exercised.
- `browser-visual.log`: 6/6 final preview checks with synthetic-only screenshots
  after screenshot coverage was extended. 360/390/430 px EN/HE and 1280 px EN
  layouts inspected; readable controls/feedback, no horizontal overflow.
- Earlier `browser-first.log` retains 5 passes/1 failure caused by selecting the
  hidden mobile navigation in the desktop QA harness. Selector corrected; final
  combined run passed. Earlier evidence was not overwritten.
- Browser checks show exact persisted synthetic purchase unchanged through
  selection/confirmation, close/reopen and reload; no stored catalog, duplicate,
  new pin or provider request. Temporary QA hooks are removed on close.
- Whitespace, source/build comparison and entry preservation results are recorded
  in `manifest.json` and `preservation.json`.

The isolated QA server on 3183 is stopped after inspection. User-owned port 3172
was untouched and may still serve its earlier build; this checkpoint does not
claim the new UI is loaded there. No real current-price comparison was performed.

## Remaining gate

Review this offline checkpoint first. Then separately authorize bounded source
qualification/collection: establish applicable terms and the exact currency
mapping for Shufersal `ItemPrice`, qualify at most two physical branches actually
inside this origin's radius, and collect an explicitly bounded fresh
Stores/PriceFull pair. Existing research is routing evidence, not a current price
feed. Access restrictions must not be bypassed. Branch geocoding, if needed,
requires its own approval. Real identity, package, freshness and partial coverage
must be verified before factual prices; 2013 prices must not become current
savings. No such access or implementation is authorized by this checkpoint.

Protected main refs, entry `next-env.d.ts`, previous measured evidence and consumed
reservations remain unchanged. Vercel remains paused.
