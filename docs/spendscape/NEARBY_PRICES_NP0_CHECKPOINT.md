# Nearby Prices NP0 — bounded source/library benchmark

Date: 2026-09-22. Scope: non-commercial local qualification only.
Authorization: `APPROVE SPENDSCAPE NEARBY PRICES NP0 — BOUNDED SOURCE AND LIBRARY BENCHMARK`.

## Verdict

NP0 evidence collection completed. Conditional recommendation for an offline NP1
normalization prototype only. Not qualified for a database, API, live savings UI,
commercial use or deployment. No product changes or resources were created.

## Runtime, dependencies and licences

The default Python 3.14 is outside the scraper's declared >=3.8,<3.13 range.
Used the already installed Codex Python 3.12.14 to create an isolated venv at
`artifacts/nearby-prices-np0/venv`; no system Python installation/update.
Official PyPI metadata was checked immediately before resolution. Installed
exactly il-supermarket-scraper 1.0.14 and il-supermarket-parser 1.0.11, with 42
transitive dependencies. `pip check` passed. Bootstrap pip 25.0.1 is separate.

`requirements-macos-arm64-py312.lock` records all 44 wheel SHA-256 pins;
`dependency-manifest.json` records exact graph, wheel sources, licence metadata,
licence-file hashes and installed console entry points. This lock is specific to
macOS ARM64/Python 3.12, not a portable Linux deployment lock.
All installs were wheels: no sdist builds, setup.py or post-install hooks were
run. No .pth files were present in the 44 distributions. Console entry points
were installed only inside the venv. No Playwright browser download was run.
MongoDB/Kafka libraries are transitive packages; no daemon or connection exists.
The venv occupies about 333 MiB as reported by `du -sh`.

Both main packages carry CUSTOM licence metadata and misleading MIT classifiers.
The installed LICENSE.txt files match each other at SHA-256
`cdc8ccfd7e3c906635c134eff73271b537f1c28671c294cab256adbab15b647f`.
The actual licence is non-commercial-only with attribution; commercial use
requires written permission. Attribution: Sefi Erlich, author of
https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-scarpers and
https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-parsers .
The installed upstream packages were not modified. The benchmark harness is
Spendscape-specific and is not copied upstream code. Third-party licences include
MIT/BSD/Apache/ISC/PSF, MPL-2.0 and Artistic/GPL alternatives; see the manifest.
This is a metadata/licence inventory, not a complete CVE or legal audit.
Retailer data rights are distinct; no dataset redistribution is proposed.

## Source sample and limits

Only public Shufersal listing and its published Azure blob links were used.
Nine gzip files: Price, PriceFull, Promo and PromoFull for branches 001 and 002,
and one chain-wide Stores directory. The directory necessarily contains 416
records; the benchmark retains/analyzes only the two selected store records.
No other branch prices, alternative retailer, geocoder or account was accessed.
No broad scraper was started: downloads use the small bounded harness rather
than the package's multi-chain/process orchestrator. The package was installed
and inspected; only its parser was executed on the sample.

Limits: at most 10 files, 50,000,000 compressed bytes, 250,000,000 expanded bytes.
Actual: **9 files, 1,224,577 compressed bytes, 35,821,123 expanded bytes**.
The collector made 18 successful requests (nine filtered listings, nine files),
total measured request time 85.518 seconds. Earlier landing-page and public JS
inspection requests are additional and excluded from that timing.
All raw datasets remain ignored under `artifacts/nearby-prices-np0/sample`.
Public signed download query strings are not in checkpoint provenance; source
URLs retain only origin/path. No cookies, user images, credentials or location
were supplied. Access from a foreign hosting region was not tested.

`evidence.json` contains exact filenames, sources, checksums, byte counts,
request metadata and aggregate benchmark results. Collector replay refuses to
overwrite an existing sample directory to avoid accidental repeated downloads.

## Parsing measurements

Three sequential offline conversions per file, using the pinned Shufersal
converter's in-memory public conversion interface. Timing excludes download,
gzip decompression, package import and hash computation. It measures local
conversion only, not ingestion/service latency or iPhone performance.

| Type | Branch | Retained rows | Conversion seconds, min–max |
| --- | --- | ---: | ---: |
| Price | 001 | 9 | 0.000099–0.000140 |
| PriceFull | 001 | 6587 | 0.079124–0.094859 |
| Promo | 001 | 22 | 0.000866–0.003744 |
| PromoFull | 001 | 1302 | 0.138823–0.157792 |
| Stores | 001 | 2 | 0.002585–0.008742 |
| Price | 002 | 10 | 0.000109–0.000159 |
| PriceFull | 002 | 7550 | 0.102968–0.111805 |
| Promo | 002 | 24 | 0.000894–0.003957 |
| PromoFull | 002 | 1404 | 0.170152–0.247105 |

Every file returned identical row hashes on all three runs. This proves local
conversion repeatability, not database idempotency or safe incremental merging.
For the four price files, independent strict XML parsing found matching row
counts and zero mismatches for nonempty leaf fields against library output.
This includes item codes, labels, prices and package fields; it does not certify
that retailer data is factually correct or every package is comparable.
PriceFull has 6,587 / 7,550 rows; all prices are positive decimal values.
Only 6,505 / 7,465 rows respectively both declare external item type and pass
GTIN checksum/length validation. Other rows must not silently become GTINs.

## Findings and limitations

1. **Required before price-by-distance:** Store XML contains address/city and IDs,
   but no latitude/longitude fields. No coordinates were invented or geocoded.
2. **Required before trusted ingestion:** pinned parser accepts malformed XML
   through recovery. A synthetic malformed example was accepted. Independent
   strict preflight rejects it. Upstream was not patched; NP1 must fail closed.
3. **Validation limitation:** BaseFileConverter.read(run_validation=True) explicitly
   raises NotImplementedError after streaming rows. Conversion is not validated
   ingestion. Independent checks are required before publishing anything.
4. **Freshness:** selected Price deltas are dated 2026-09-21; full snapshots are
   dated 2026-09-22. Never replay older deltas over a newer full snapshot.
   PriceUpdateTime ranges as far back as 2013/2014 inside a new full snapshot.
   Item last-change time is distinct from snapshot publication/confirmation.
   Filename times are source naming evidence, not independently authenticated
   publication clocks. No live freshness/availability claim is made.
5. **Joins:** store directory IDs use unpadded forms while price/promo files use
   padded forms. Preserve raw IDs and implement a source-specific validated join;
   do not casually strip zeros from product barcodes.
6. **Promotions:** nested groups, item mappings, club IDs, minimum quantities,
   redemption limits and validity fields exist. No effective promotional price
   or eligibility was calculated. Scalar extraction does not establish savings.
7. **Security/performance:** measured peak whole-process RSS is recorded in
   evidence.json (macOS ru_maxrss bytes). It includes loaded Python libraries,
   XML trees, retained rows and temporary copies. It is not engine-only memory.
   No broad malicious-input or production reliability audit is claimed.
8. **Not measured:** outside-Israel access, scheduled imports, retry/partial-chain
   recovery, full/delta reconciliation, stock availability and other chains.
9. **Import side effect:** upstream default loggers created an empty `logging.log`
   during initial inspection. It contained zero bytes and was removed. The
   benchmark now configures NullHandlers before importing either package.
   This is another reason not to import these packages into the product runtime.

## QA and boundaries

Six offline qualification tests passed: valid GTIN/leading zeros, invalid
checksum/non-ASCII, gzip roundtrip, truncated gzip, strict malformed rejection,
and explicit reproduction of upstream malformed recovery. The recovery test
records a defect; its passing is not a safety endorsement.
During the conversion benchmark socket connections were blocked; zero connection
attempts occurred. No app server, browser, database or provider was started.
No npm package or lockfile changed; no Next.js commands ran.
No application regression tests were needed or claimed: all tracked application
and canonical fixture files remain byte-identical to HEAD. Thus this slice
introduces no bundle, MapLibre, Scanner A/B/E or graph modification.
The existing baseline remains the previously verified 42 purchases / 12 places /
12 pins / ILS 6,777.38; it was not re-executed as a fresh browser assertion.

## Reproduction and removal

From the worktree, use the isolated venv with the hash-locked requirements.
Offline replay: `artifacts/nearby-prices-np0/venv/bin/python qa/nearby-prices/benchmark.py`.
Tests: `artifacts/nearby-prices-np0/venv/bin/python -m unittest discover -s qa/nearby-prices -p 'test_*.py' -v`.
The sample is deliberately outside Git, so offline replay requires the retained
local sample. A new network collection must remain within a separately confirmed
remaining download budget; do not silently rerun against all retailers.
To remove local runtime/data, remove only `artifacts/nearby-prices-np0`.
No global install, service, provider resource or environment variable needs removal.

## Git safety and next gate

Branch: feature/spendscape-rebuild. HEAD and local origin feature ref:
`a0d4e51f8b037dfe5c4da9a9cbbd44e252fea941`.
main and origin/main: `eee0d26b55e5061f87ac664938df0c195800b74f`.
Initial working tree/index clean; no stage, commit, push, PR or deployment.
next-env.d.ts remains unchanged. Generated outputs stay ignored.

Next separate gate: `APPROVE SPENDSCAPE NEARBY PRICES NP1 — OFFLINE NORMALIZATION AND SCHEMA PROTOTYPE`.
That scope must include strict preflight, package/identity rules, source-specific
ID joins and snapshot/delta ordering. It does not authorize a database or UI.
