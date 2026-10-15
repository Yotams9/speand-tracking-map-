# NP2G — nearby Shufersal selection; stopped at currency qualification

Date: 2026-09-23. Authority:
`APPROVE SPENDSCAPE NEARBY PRICES NP2G — NEARBY SHUFERSAL STORE SELECTION, CURRENT TWO-STORE SAMPLE AND CURRENCY QUALIFICATION`.

## Outcome and next decision

A nearby alternative address was qualified: source branch **11**,
`שלי ת"א- נורדאו`, original address **אבן גבירול157**, at **1,595.4351395559495
metres** straight-line from the retained Ben Yehuda 79 address point.
This is the nearest verified result in the bounded shortlist, not a claim to
have found the nearest Shufersal branch overall. The reference remains branch 1.

**Stop at Stage 3.** A primary legal-text facsimile establishes shekels/agorot
for the regulation's machine-readable total-product-price field. The exact
mapping to Shufersal's `ItemPrice` XML tag and current specification was not
established from an authoritative specification. Currency is therefore not
promoted into executable comparison evidence. No price file was downloaded,
no monetary savings were declared, and no current product intersection was
measured. This is a partial qualification, not proof that such evidence does
not exist or that the source uses another currency.

Recommendation: **request one narrowly scoped currency-documentation
qualification**, after this checkpoint review, identifying the official
regulator/retailer mapping and applicable version. Do not proceed to hosted
Supabase/PostGIS readiness or broaden collection. No such follow-up is activated
by this report. Current NP2G's download allowance was not activated.

## Stage 1 — retained directory and deterministic shortlist

No Stores redownload. Input:
`Stores7290027600007-000-20260922-025.gz`, SHA-256
`3d895dcad48d153f873bf4b3b9a6875e7120284070bb31ea0a29b43b9b81ffda`,
retained in ignored `artifacts/nearby-prices-np0/sample/`.
Original source:
https://pricesprodpublic.blob.core.windows.net/stores/Stores7290027600007-000-20260922-025.gz
Publication from source fields: `2026-09-21T23:52:11+00:00`.
Original fetched time remains unknown; reading it again does not refresh it.

The full retained directory has 416 store records. The new offline selector
uses the unchanged strict NP1 gzip/XML reader, validates the Shufersal chain,
and preserves source-qualified composite IDs. The live caller verified the
retained file hash before extraction. No upstream scraper or orchestrator ran.

Shortlist policy, fixed before requests:

- Explicit physical StoreType `1`, complete source name/address, explicit Tel
  Aviv text (`ת"א` or spelled-out locality) in the name; numeric city code 5000
  alone is insufficient. Exclude online/warehouse/administrative indicators.
- Conservatively restrict to reference subchain `1` (same supermarket format).
  Other formats, including BE pharmacies, are outside this shortlist.
- Require a street followed by a house number; preserve original text and split
  an omitted separator without changing letters/digits. No road spelling repairs.
- Exclude reference branch 1, partial/multi-address records and duplicate
  normalized source identities. Sort numeric subchain/store IDs and take at most 3.

The eligible subchain-1 IDs were 7, 11, 39, 69 and 117. Branch 28's address
`צה"ל 71, מרכ` was rejected as partial. Resulting shortlist:

| Source key (chain/subchain/store) | Exact name | Exact source address |
| --- | --- | --- |
| 7290027600007 / 1 / 7 | שלי ת"א- ארלוזורוב | ארלוזרוב 53 |
| 7290027600007 / 1 / 11 | שלי ת"א- נורדאו | אבן גבירול157 |
| 7290027600007 / 1 / 39 | שלי ת"א- ברזיל | ברזיל 15 |

No Agron query, synthetic place graph, device location or other retailer was used.

## Stage 2 — coordinates, network and attribution

The [official Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/)
was rechecked on 2026-09-23 before querying. This was a single-machine,
single-thread, one-time three-address attempt with an identifying User-Agent,
pacing, caching and attribution. No generic application geocoder was added.
User-Agent: `Spendscape-NP2G-college-qualification/1.0 (bounded three-public-store study)`.
No cookies, authorization, retries, redirect following or user/purchase data.

| Branch | UTC attempt time | Result | Bytes read | Qualification |
| --- | --- | --- | ---: | --- |
| 7 | 2026-09-23T15:33:12.518454+00:00 | No HTTP response; fixed transport/format error | 0 | Unresolved, never retried |
| 11 | 2026-09-23T15:33:58.091518+00:00 | HTTP 200, one house | 924 | Accepted address point |
| 39 | 2026-09-23T15:33:59.597073+00:00 | HTTP 200, one house | 848 | Accepted address point |

The first call in the restricted execution environment produced no response;
its underlying exception was redacted, so a DNS/sandbox cause is not proven.
It consumed one attempt conservatively. The two remaining, different addresses
were queried with approved network execution permission. No failed address was
retried. Start intervals were 45.573064 and 1.505555 seconds; an explicit 1.1s
pause preceded each remaining call. Responses were size-bounded to 100,000 bytes.
The third attempted address exhausted the three-attempt ceiling.

Returned country was `il`; house number, street and city matched each accepted
source address. All points use latitude then longitude:

| Store | OSM reference | Latitude | Longitude | Returned address evidence | Verification time UTC | Distance from reference |
| --- | --- | ---: | ---: | --- | --- | ---: |
| Ben Yehuda 79, branch 1 | node 2079212541 | 32.0813610 | 34.7704850 | 79, בן יהודה, תל־אביב–יפו, 6343527, ישראל | 2026-09-23T10:35:29.146545+00:00 (NP2F reuse) | Reference |
| Nordau, branch 11 | node 2078994039 | 32.0914750 | 34.7824970 | 157, אבן גבירול, תל־אביב–יפו, הצפון הישן - החלק הצפוני, 6296802, ישראל | 2026-09-23T15:33:58.091518+00:00 | 1,595.4351395559495 m |
| Brazil, branch 39 | node 2078991654 | 32.1116021 | 34.7968154 | 15, ברזיל, תל־אביב–יפו, רמת-אביב, 6946032, ישראל | 2026-09-23T15:33:59.597073+00:00 | 4,178.447305902193 m |

All three are type `house` address points, not surveyed shop entrances. No
positional error bound, routing/driving distance or current business operation
is established. Reusing branch 1 is not a new coordinate verification.
Selection accepts only positive distances <=5,000 m and ranks by distance,
then numeric source-qualified ID for ties. Haversine uses the unchanged NP2F
mean Earth radius; full precision above is arithmetic, not geographic accuracy.

Attribution: **Data © OpenStreetMap contributors, ODbL 1.0**.
[Copyright and licence](https://www.openstreetmap.org/copyright).
Ignored local caches retain full returned public address/provenance and licence.
Later authorized reuse must preserve attribution and applicable ODbL obligations.

## Stage 3 — currency evidence and precise gap

The strongest new evidence is the **primary legal-text facsimile**, not a
third-party prose summary, of *תקנות קידום התחרות בענף המזון (שקיפות מחירים),
התשע״ה–2014*, issued by the Minister of Economy, with Minister of Finance
approval. Signed 2014-10-30; published in Reshumot, Kovetz HaTakanot 7442,
2014-11-20. Retrieved 2026-09-23 from the Federation of Israeli Chambers of
Commerce mirror: https://www.chamber.org.il/media/147842/7442.pdf . The hosting
site is not the issuing government authority; no government-hosted matching
copy/current consolidated technical mapping was verified.

Regulation 2(4)/(8) binds the product/price file to the Second Schedule and XML.
The Second Schedule, printed page 221 (PDF page 5), explicitly gives the total
product price in **שקלים ואגורות**. This addresses a file field, not merely a
retail shelf-display obligation. The First Schedule also identifies physical
StoreType 1. The facsimile uses Hebrew field names; it does not name `ItemPrice`.
Mapping that statutory field to the retained Shufersal XML tag is plausible,
but an official field mapping/version was not retrieved. That inference is
insufficient under NP2G's explicit exact-dataset-field gate. Searches for later
amendments did not establish a current consolidated technical contract.

Supporting official context inspected in indexed excerpts on 2026-09-23:

| Source / issuer / date | Scope and limit |
| --- | --- |
| [Consumer Protection and Fair Trade Authority annual report 2014](https://www.gov.il/BlobFolder/reports/pfta_annual_reports/he/docs_cpfta_AnnualReport2014.pdf), report year 2014; exact issue date not verified | Describes preparation of transparency regulations; no `ItemPrice` mapping |
| [Authority annual report 2015–2016](https://www.gov.il/BlobFolder/reports/pfta_annual_reports/he/docs_cpfta_AnnualReport2015-16.pdf), report years 2015–2016; exact issue date not verified | Describes per-store publication and updates; no exact currency/tag contract |
| [State Comptroller report 71C, food sector](https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2021/71C/2021-71c-101-Mazon.pdf), 2021, printed page 89 excerpt | Describes statutory technical publication obligations; no machine field mapping |

Third-party package/blog statements saying `ItemPrice` is ILS were search leads
only, never accepted as regulatory/retailer proof. No package was installed.
No source price was rewritten or currency silently assigned. Existing NP1
currency-null behavior and NP2F unresolved-currency rejection remain unchanged.

## Conditional collection and required funnel

Stage 4 requires both a qualified location and authoritative currency evidence.
Only the location condition passed. **No pre-download authorization manifest
was activated, no listing was requested and no dataset was downloaded.**
There are no current PriceFull names, hashes or fetched/publication times to
report. The old NP2F product counts must not be reused for branch 11.

| Required result | NP2G outcome |
| --- | --- |
| Candidates considered / shortlisted | 5 eligible in chosen subchain / 3 shortlisted |
| Newly qualified coordinates | 2 accepted; branch 7 unresolved |
| Selected alternative | 7290027600007 / 1 / 11; 1,595.4351395559495 m |
| Current files downloaded and hashes | None |
| Normalized current price rows per store | Not measured |
| Shared validated GTINs | Not measured |
| Package / variant / ordinary base-price pairs | Not measured |
| Unequal-price pairs | Not measured |
| Cheaper at alternative / Ben Yehuda | Not measured, not a measured zero |
| Fully eligible current comparisons | 0 proven; no evaluated current intersection |
| Source-backed savings example | None; exact currency mapping and current files absent |

The reference store was not reversed to obtain a favorable result. Publication
freshness policy remains <=24 hours at comparison time plus no known coverage
gap; no current-price freshness assertion is made in this stopped run.

## Budgets and observable actual use

- Geocoding: maximum 3; **3 attempted, 2 HTTP 200 responses, 1 no-response
  transport failure**, 1,772 successful-response bytes read. No retries.
- Research tool: **10 calls**, comprising **27 search queries, 2 page-open
  operations and 2 PDF screenshot operations**. Some search results were
  irrelevant; those sites were not opened as retailer sources. The browsing
  service's underlying HTTP count is not observable; these are logical
  operations, not an invented wire-level request count.
- Retailer collection: maximum 6 listing/file HTTP requests, 3 dataset files,
  25,000,000 compressed and 200,000,000 expanded bytes. **Actual all zero**;
  the conditional collection stage never activated. No delta or promo files.

## Offline QA, limitations and reproducibility

Initial focused selection suite: **8/8 passed**; initial complete bounded Nearby
Prices suite: **63/63 passed** on 2026-09-23. Checkpoint review subsequently
reproduced two Medium gaps: duplicate identities could be hidden by eligibility
filters, and multi-address text ending in a number could pass the address regex.
Those initial passes did not cover either case.

The separately authorized **SHORTLIST IDENTITY AND ADDRESS VALIDATION CORRECTION
+ OFFLINE QA** now counts normalized composite identities across all source
records before eligibility filtering, excluding every occurrence of a duplicate.
The bounded address grammar accepts Hebrew/Latin street letters, spaces and
limited name punctuation followed by one house number with an optional Hebrew
suffix. It rejects address separators, embedded street digits and house ranges;
numeric street names and other unsupported forms remain unresolved rather than
being repaired. This is deliberately not a general-purpose address parser.
Omitted separators such as `אבן גבירול157` remain accepted without changing
source text. The original selection policy above describes the intended rule;
these corrections close its implementation gaps.

Final focused suite: **11/11 passed**; final combined suite: **66/66 passed**.
Added regressions exercise duplicate identities whose other row is online,
missing an address/locality, or excluded by name, in both source orders;
multi-address/range rejection; and unchanged Hebrew/Latin single-address splits.
All run offline with socket entry-point guards. Retained input SHA-256,
exact shortlist, both cached coordinate qualifications and selected branch 11
with its exact distance were independently reproduced after correction using
the saved evidence, with zero socket calls. No cache or network evidence was
refreshed. The Stage 3 currency stop and all collection budgets remain unchanged.
No remaining failure was observed in this bounded correction QA; a new separate
checkpoint review is still required. Commands:

```sh
artifacts/nearby-prices-np0/venv/bin/python -B -m unittest discover -s qa/nearby-prices -p 'test_np2g.py' -v
artifacts/nearby-prices-np0/venv/bin/python -B -m unittest discover -s qa/nearby-prices -p 'test_*.py'
```

New tests cover deterministic three-item shortlist, source identity, physical
vs online/unresolved/locality filtering, partial and duplicate records, strict
corrupt directory rejection, ambiguous locations, nearest qualified selection,
numeric ID ties, zero-distance exclusion, >5km exclusion and inclusive exact
5km boundary. All NP2G tests guard socket connection entry points and verify
zero calls. NP2F's independent Haversine fixture remains in the combined suite.

Existing tests for GTIN/package/variant/weighted rules, unresolved currency,
Decimal arithmetic, stale/idempotent replay, promotion exclusion and corrupt
price-file quarantine passed unchanged. They do not prove a current branch-1/11
pair. No new current-two-store normalization, currency acceptance contract or
6-request/3-file/25MB/200MB collection enforcement was implemented/tested after
the Stage 3 stop. Those conditional-stage tests remain **unexecuted**, not passed.
NP1 remains restricted to its original approved stores; no whitelist was widened.

No application QA, build, browser, server or dependency changes. Scanner A/B/E,
42/12/12 canonical baseline and single MapLibre instance are preserved by
unchanged application/fixture source; no fresh runtime assertion is claimed.
No upstream package was imported for discovery or networking. Existing NP0
package licensing/attribution remains unchanged; no raw dataset redistribution.

Local ignored evidence and SHA-256:

| Artifact under artifacts/nearby-prices-np2g/ | SHA-256 |
| --- | --- |
| shortlist.json | e07e7623f759cba12de384c76694efea0e2d75e9619d32ec75d4c2898e576db4 |
| locations.json | 6967cac8d2c169d6a12746d58b9d70542b9b9246296b67fa50f602bb9a285371 |
| selection.json | 664552682daaba332bd29ffcfd85ff247168ea406358b15d6e4ef876ef39b3b8 |

Live results require these retained local caches; synthetic tests do not.
No durable credential, cookie, signed query, personal information or error body
is included. No requery permission is implied by reproducibility instructions.

## Manifest, Git safety and hard stop

Exactly three new checkpoint files:

1. `docs/spendscape/NEARBY_PRICES_NP2G_QUALIFICATION.md`
2. `tools/nearby-prices/nearby_selection.py`
3. `qa/nearby-prices/test_np2g.py`

Branch: `feature/spendscape-rebuild`. HEAD and origin tracking ref remain the
pushed NP2F checkpoint `66fb4204154c88789e9e0401e317f9000b6b5e18`.
main and origin/main remain `eee0d26b55e5061f87ac664938df0c195800b74f`.
No remote refresh during NP2G; the preceding push directly verified the server.
Initial tree/index clean. Final index empty; existing tracked files unchanged.
next-env.d.ts matches HEAD blob `ce4e94a6b10f160ee021fe18939af160d2927dcf`.
Generated caches remain ignored. Diff/new-file whitespace checks passed.
No stage, commit, push, PR, merge, deploy, database, API/UI or recurring ingestion.
No QA server was started; no service cleanup is required.

Next separate gate only:
`APPROVE SPENDSCAPE NEARBY PRICES NP2G CHECKPOINT REVIEW`
