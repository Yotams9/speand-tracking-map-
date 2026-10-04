# NP2F — bounded Shufersal same-chain qualification

Date: 2026-09-23. Status: qualification completed; comparison proof blocked;
separate checkpoint review required. No product integration is authorized.

## Decision

**Stop because currency and location remain unresolved.** The retained sample
supports conservative exact-product matching and base-price ordering, but does
not prove a truthful nearby-store savings example. Do not proceed to
Supabase/PostGIS readiness, API/UI work or additional collection on this evidence.
Cross-retailer support remains deferred; no other retailer was contacted.

## Retained stores and overlap

Source chain `7290027600007`, subchain `1`; normalized store IDs preserve NP1's
source-qualified identity rules. Original store names and address strings:

| Store | Name | Address | Raw city code | Store type |
| --- | --- | --- | --- | --- |
| 1 | שלי ת"א- בן יהודה | בן יהודה 79 | 5000 | 1 |
| 2 | שלי ירושלים- אגרון | אגרון 1 | 3000 | 1 |

City names used for address research came from the explicit source store names,
not an invented mapping of numeric city codes.

| Qualification stage | Count |
| --- | ---: |
| Accepted projected base-price rows, store 1 / store 2 | 6,587 / 7,550 |
| Unique validated external GTINs, store 1 / store 2 | 6,505 / 7,465 |
| Ambiguous duplicate GTINs excluded, each store | 0 |
| Shared validated external GTINs | 5,926 |
| Equal known package quantity/unit/count, nonweighted | 3,670 |
| Exact conservative product-variant matches | 3,632 |
| Positive ordinary base-price pairs | 3,632 |
| Equal source base-price values | 3,617 |
| Lower source value at store 1 | 10 |
| Lower source value at store 2 | 5 |
| Unequal source base-price pairs | 15 |
| Fully eligible historical nearby savings examples | **0** |

Matching revalidates external GTIN checksums and preserves leading zeros through
GTIN-14 normalization. Internal product IDs never establish product identity.
Package count must be a positive integer. Unit strings must match exactly;
quantity/count use exact Decimal equality. Both weighted flags must explicitly
be `0`; variable-weight products are conservatively excluded. Labels,
manufacturer names and manufacturer product descriptions must be known and
exactly equal; country fields must also agree. No fuzzy substitutions, unit
conversions, semantic repairs or regular/zero merging occur. These conservative
rules may reject otherwise equivalent items.

Only Price/PriceFull ordinary values participate. Promo/PromoFull rows remain
separate; no conditional benefit or effective promotional price is substituted.
The counts describe historical **source-value ordering**, not an ILS savings
claim. No factual example is fabricated from the synthetic arithmetic tests.

## Currency evidence — unresolved

Research on 2026-09-23 prioritized official government/regulator/legislation and
schema sources. The [official food competition law, government-hosted PDF](https://www.gov.il/BlobFolder/legalinfo/foodsectorlaw/he/foodlaw_%D7%97%D7%95%D7%A7%20%D7%A7%D7%99%D7%93%D7%95%D7%9D%20%D7%94%D7%AA%D7%97%D7%A8%D7%95%D7%AA%20%D7%91%D7%A2%D7%A0%D7%A3%20%D7%94%D7%9E%D7%96%D7%95%D7%9F%20%D7%95%D7%94%D7%A4%D7%90%D7%A8%D7%9D%20%D7%94%D7%AA%D7%A9%D7%A2%D7%93-2014%20%D7%9E%D7%A2%D7%95%D7%93%D7%9B%D7%9F%200725.pdf)
was retrieved as indexed excerpts concerning sections 29–30: per-store
machine-readable prices and total-price scope. The filename identifies an
updated 07/25 document; its full legal currency/currentness was not audited.
The [regulator's 2014 annual report](https://www.gov.il/BlobFolder/reports/pfta_annual_reports/he/docs_cpfta_AnnualReport2014.pdf)
provided indexed context about separate store/price/promotion files.
Neither retrieved evidence established the precise currency semantics of the
sample's `ItemPrice` field. The official Knesset consumer-law record was found,
but the relevant operative currency provision was not retrieved and verified.
Third-party summaries were not accepted as authoritative proof.

This is an incomplete qualification, not a claim that official evidence does
not exist. Publication dates beyond the document identifiers above were not
independently verified. No currency is inferred from Israel, an address, a
currency symbol elsewhere on the retailer site, or a generic legal summary.
The report leaves currency null and declares no monetary savings.

## Public store locations

The [official Shufersal branch PDF](https://media.shufersal.co.il/policy/ShufersalBranchesOnSaturdayEveningsV3.pdf)
confirmed Agron 1, Jerusalem, but supplied no reusable coordinates. Its
publication date was not verified. The official store-finder page could not be
retrieved by the browsing tool (InternalError); no access-control bypass or
retry workflow was attempted.

The [official Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
was read before geocoding: at most one request/second, identifying User-Agent,
small bounded one-time use, caching and attribution. Only the two public store
addresses were submitted. No purchase, user, phone or GPS data was submitted.
Fixed User-Agent: `Spendscape-NP2F-college-qualification/1.0 (bounded two-public-store study)`.

| Query | UTC verification time | Response | Decision |
| --- | --- | --- | --- |
| בן יהודה 79, תל אביב, ישראל | 2026-09-23T10:35:29.146545+00:00 | HTTP 200, 914 bytes, one house result | Accept address point only |
| אגרון 1, ירושלים, ישראל | 2026-09-23T10:35:50.324292+00:00 | HTTP 200, 2,500 bytes, three street segments | Reject all; stop |

Accepted: OpenStreetMap node `2079212541`, type `house`, latitude `32.0813610`,
longitude `34.7704850`. Returned address:
`79, בן יהודה, תל־אביב–יפו, הצפון הישן - החלק הדרומי, תל־אביב–יפו, נפת תל אביב, מחוז תל אביב, 6343527, ישראל`.
This is an address point, not an independently surveyed store entrance; no
metre-level positional accuracy is asserted.

Rejected Agron results all returned road `אגרון`, city `ירושלים | القدس`,
without house number 1; all type `tertiary`, rank 26:

| OSM way | Latitude | Longitude |
| --- | ---: | ---: |
| 810509458 | 31.7765764 | 35.2197770 |
| 810509459 | 31.7760467 | 35.2189336 |
| 810509438 | 31.7752769 | 35.2177161 |

These coordinates are documented as **rejected street segments**, never store
coordinates. No nearest-result selection or follow-up geocoding occurred.
Both public responses are cached only in ignored local evidence. Attribution:
**Data © OpenStreetMap contributors, ODbL 1.0**, with
[OpenStreetMap copyright/licence information](https://www.openstreetmap.org/copyright).
Any later permitted reuse must retain attribution and applicable ODbL duties.

**Store-to-store distance: unresolved. Within 5 km: unresolved.** No actual
store distance was calculated from rejected candidates. Different source city
names are not a substitute for the required verified coordinate pair. No
additional store sample was downloaded.

The offline Haversine helper uses mean Earth radius 6,371,008.8 metres and an
inclusive 5,000-metre boundary. It measures spherical straight-line distance,
not a route or driving distance, and is not a PostGIS replacement.

## Time, provenance and replay

The final offline run used comparison/ingestion time
`2026-09-23T10:42:53.932820+00:00`. Both eligible PriceFull publications are
`2026-09-22T00:00:00+00:00` (filename time interpreted by the unchanged NP1
adapter). Item last-change timestamps remain separate normalized row fields;
they do not replace publication time. Original per-file fetched timestamps are
not available in this retained manifest and remain null. Reanalysis is not a
new fetch or publication.

Both publications exceed the diagnostic 24-hour window; this window alone
would not establish complete live coverage even for a newer file. Coverage at
comparison time is explicitly unknown. Results are historical/source-backed
qualification only and may not be presented as current savings.

All nine retained gzip files passed unchanged NP1 hash, gzip/XML, identity and
normalization rules. There were 16,910 observations. Full snapshots initialized
the projections; four older deltas stayed historical-only. Repeating all nine
publications returned `duplicate` nine times with unchanged projection. No
retailer file was redownloaded. The source/hash ledger below records exactly
which retained inputs were used.

## QA and reproducibility

Commands run with the existing NP0 virtual environment, no installation:

```sh
artifacts/nearby-prices-np0/venv/bin/python -B -m unittest discover -s qa/nearby-prices -p 'test_np2f.py' -v
artifacts/nearby-prices-np0/venv/bin/python -B -m unittest discover -s qa/nearby-prices -p 'test_*.py' -v
artifacts/nearby-prices-np0/venv/bin/python -B qa/nearby-prices/qualify_np2f.py
```

Results: **15/15 NP2F tests; 55/55 combined offline tests**. All requested NP2F
cases are covered: identity, GTIN/leading zeros/checksum/internal-ID exclusion,
package/variant/weighted uncertainty, promotion exclusion, Decimal arithmetic,
unresolved currency, ambiguous/invalid coordinates, Haversine zero/known point,
invalid range and inclusive radius, stale and idempotent replay. Each NP2F test
blocks and checks socket connection entry points. The retained-data run used
the same connection guards and recorded zero network attempts.

The end-to-end positive arithmetic test is explicitly synthetic. It demonstrates
structural composition, not successful factual currency/location qualification.
No application/build/browser QA was run: application, fixtures, dependencies,
Scanner A/B/E and MapLibre code are unchanged. No server was started.

Reproduction requires the already retained ignored NP0 sample/manifest and
NP2F public location cache; a fresh clone deliberately contains no raw datasets
and cannot reproduce the real-data funnel without separately authorized input
provision. Synthetic tests remain independent of these retained files.

## Network accounting and limitations

- Exactly **2 direct Nominatim HTTPS requests**, of the allowed maximum 4;
  3,414 response bytes; 21.177747 seconds between request timestamps, plus
  explicit inter-request pacing. No redirects or retries.
- **6 web research tool calls**, comprising **13 search queries and 6 page-open
  operations** (19 logical operations), including repeated policy-page reads.
- **0 retailer dataset downloads**, **0 offline comparison/test network
  attempts**, and no other retailer access.

The browsing service does not expose its underlying HTTP requests, redirects
or search-engine infrastructure traffic. Therefore an exact aggregate wire-level
HTTP count for research cannot truthfully be supplied. The exact observable
operation counts above are the audit boundary; they must not be relabelled as
21 total HTTP requests. This is a reporting limitation against the requested
exact total network count. No further network work is needed for this checkpoint.

## Exact checkpoint manifest and Git safety

Four new files only:

1. `docs/spendscape/NEARBY_PRICES_NP2F_QUALIFICATION.md` — this report.
2. `tools/nearby-prices/same_chain.py` — isolated offline qualification helpers.
3. `qa/nearby-prices/qualify_np2f.py` — retained-input aggregate replay.
4. `qa/nearby-prices/test_np2f.py` — synthetic offline tests.

Existing tracked files remain byte-for-byte unchanged. Branch:
`feature/spendscape-rebuild`. HEAD and local origin feature tracking ref:
`e6746408d7f87cae785c6ba1e5c68f453a0b62b2`. No remote refresh was needed for this
local qualification; tracking-ref equality is not a new remote-wire check.
Local main and origin/main remain
`eee0d26b55e5061f87ac664938df0c195800b74f`.
`next-env.d.ts` still matches HEAD, Git blob
`ce4e94a6b10f160ee021fe18939af160d2927dcf`. Index empty. No staging, commit, push,
PR, deployment, accounts, database, provider resource or environment variables.
Generated aggregate/location evidence under `artifacts/nearby-prices-np2f/`
remains ignored and excluded from this manifest, as do retained raw data/venv.
`git diff --check` and an explicit new-file whitespace check passed.

Next gate only:
`APPROVE SPENDSCAPE NEARBY PRICES NP2F CHECKPOINT REVIEW`

## Retained source/hash ledger

Sources below identify already retained inputs; they were not fetched in NP2F.

- File: `Stores7290027600007-000-20260922-025.gz`
  - Source: https://pricesprodpublic.blob.core.windows.net/stores/Stores7290027600007-000-20260922-025.gz
  - SHA-256: `3d895dcad48d153f873bf4b3b9a6875e7120284070bb31ea0a29b43b9b81ffda`
  - Publication UTC: `2026-09-21T23:52:11+00:00`; basis: `source_fields`.

- File: `Price7290027600007-001-001-20260921-020000.gz`
  - Source: https://pricesprodpublic.blob.core.windows.net/price/Price7290027600007-001-001-20260921-020000.gz
  - SHA-256: `fc8c95ef5d1bfba655a084232f86ed2637147483fa52eced360d88bb5a26c05a`
  - Publication UTC: `2026-09-20T23:00:00+00:00`; basis: `filename`.

- File: `PriceFull7290027600007-001-001-20260922-030000.gz`
  - Source: https://pricesprodpublic.blob.core.windows.net/pricefull/PriceFull7290027600007-001-001-20260922-030000.gz
  - SHA-256: `6e52f28b11304473eb96b3f646c13e0e305a31410f16b5bbcd15d5501c0d052b`
  - Publication UTC: `2026-09-22T00:00:00+00:00`; basis: `filename`.

- File: `Promo7290027600007-001-001-20260922-020000.gz`
  - Source: https://pricesprodpublic.blob.core.windows.net/promo/Promo7290027600007-001-001-20260922-020000.gz
  - SHA-256: `9fa7c4cd377a976f0c1fc57a4d75274e7392196ed8a3e24250f376a8f9a82a23`
  - Publication UTC: `2026-09-21T23:00:00+00:00`; basis: `filename`.

- File: `PromoFull7290027600007-001-001-20260922-030000.gz`
  - Source: https://pricesprodpublic.blob.core.windows.net/promofull/PromoFull7290027600007-001-001-20260922-030000.gz
  - SHA-256: `b43f58037cac804bfb2a4b76ddcee6ab435918818c95023f13ef5b7a5383d4be`
  - Publication UTC: `2026-09-22T00:00:00+00:00`; basis: `filename`.

- File: `Price7290027600007-001-002-20260921-020000.gz`
  - Source: https://pricesprodpublic.blob.core.windows.net/price/Price7290027600007-001-002-20260921-020000.gz
  - SHA-256: `c2edbf4695c235b048bea98df82f778c580b343789391db24cbda6d9711c677a`
  - Publication UTC: `2026-09-20T23:00:00+00:00`; basis: `filename`.

- File: `PriceFull7290027600007-001-002-20260922-030000.gz`
  - Source: https://pricesprodpublic.blob.core.windows.net/pricefull/PriceFull7290027600007-001-002-20260922-030000.gz
  - SHA-256: `87f4795456368c58aff049abc148558f3229223aa7ba88b6b0a5d245d3483e75`
  - Publication UTC: `2026-09-22T00:00:00+00:00`; basis: `filename`.

- File: `Promo7290027600007-001-002-20260922-020000.gz`
  - Source: https://pricesprodpublic.blob.core.windows.net/promo/Promo7290027600007-001-002-20260922-020000.gz
  - SHA-256: `1ac79305d9825ff42301fb6276a0fa94fe25ae34398daaed7de1d77c96ae259f`
  - Publication UTC: `2026-09-21T23:00:00+00:00`; basis: `filename`.

- File: `PromoFull7290027600007-001-002-20260922-030000.gz`
  - Source: https://pricesprodpublic.blob.core.windows.net/promofull/PromoFull7290027600007-001-002-20260922-030000.gz
  - SHA-256: `7016706c50a76fcc326adfb3dd4da4c26b96ee5b1442013d12db05df589a1da2`
  - Publication UTC: `2026-09-22T00:00:00+00:00`; basis: `filename`.
