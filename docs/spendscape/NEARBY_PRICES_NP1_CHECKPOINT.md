# Nearby Prices NP1 — offline normalization prototype

Date: 2026-09-22. Authorized only by
`APPROVE SPENDSCAPE NEARBY PRICES NP1 — OFFLINE NORMALIZATION AND SCHEMA PROTOTYPE`.

## Outcome

### Subsequent bounded review correction

The NP1 checkpoint review reproduced two Medium defects: identical compressed
content in a distinct later publication was discarded as a duplicate, and a
corrupt DEFLATE payload escaped the fixed-error boundary as `zlib.error`.
The user separately authorized
`APPROVE SPENDSCAPE NEARBY PRICES NP1 — PUBLICATION IDENTITY AND GZIP ERROR CORRECTION + OFFLINE QA`.
Both are corrected in adapter version `np1-shufersal-1.1`:

- Content identity remains chain + compressed SHA-256; publication identity also
  includes kind, partition, source filename/URL and source publication time.
  Refetch/ingestion timestamps never establish a new publication. Different
  dated source publications preserve separate provenance and observations;
  identical content is counted once. Historical arrivals cannot move watermarks
  backwards. Item-change timestamps and comparison eligibility are unchanged.
- Corrupt DEFLATE now becomes `Rejected(INVALID_GZIP_OR_XML)` without exposing
  the underlying exception. A synthetic integration test runs the real replay
  loop with a corrupt file followed by a valid file and verifies quarantine,
  continued processing, retained valid observations and zero network attempts.

Final bounded suite: **30/30 tests passed**, including five new correction tests.
Fresh retained-sample replay: all 9 files normalized, 16,910 observations,
9 source publications / 9 unique contents, all nine repeats duplicate,
zero network attempts. No source/dependency downloads or application QA.
The original 25-test result below is historical, not the final correction count.
Only offline.py, replay_np1.py, test_np1.py, np1-evidence.json, this checkpoint
and the descriptive schema changed during the correction. No migration or DB.
Next gate remains a separate NP1 checkpoint review, not commit or NP2.

Completed a bounded Shufersal-specific offline prototype and descriptive schema.
No database, migration, API, UI, new dependency, download, account or service.
NP0's uncommitted benchmark files are preserved, not silently included in a commit.
No checkpoint review or publication approval is implied.

The prototype uses lxml 5.4.0 already in the NP0 lock. It is original adapter
code, not a patched or copied upstream parser. NP0's custom non-commercial
licence warning and Sefi Erlich attribution remain applicable to its packages.
No package graph or licence files changed.

## Implemented boundary

- SHA-256 verification; bounded gzip expansion; strict UTF-8 XML parsing with no
  recovery, DTD/entities/network, huge-tree mode or alternate encodings.
- Fixed error codes, duplicate-field/record rejection, exact Decimal parsing;
  no NaN, exponent coercion, negative/zero price or silent numeric repair.
- Source filename/root ID agreement, only the two approved branches, store
  referential checks and source-specific zero-padding normalization. Product
  leading zeros are preserved; invalid/internal GTINs stay unresolved.
- Exact original price, label and package evidence retained in memory. Unknown
  package count, currency and coordinates are not supplied with defaults.
- Timestamp parsing supports the observed fractional seconds; DST ambiguity,
  nonexistent local time, future source time and item time after file time fail.
- Immutable batch serialization, deterministic source/observation keys,
  in-memory full/delta replay, historical-only old files, explicit removals,
  atomic rejection and retained observation history.
- A later delta requires an explicit verified predecessor. The prototype cannot
  infer source continuity; production proof remains deferred.
- Promotion validity and nested conditions preserved, never converted to an
  unconditional discounted price. All comparison eligibility remains false.

## Measured evidence

Reused exactly the nine retained NP0 files; no new network collection.
All nine normalized: two selected store records, 14,156 price rows across full
and delta files, and 2,752 promotion rows. Total **16,910 observations**.
Two Price and two Promo deltas older than their full snapshots were historical
only. A second application of all nine batches returned duplicate with no new
observations. Socket connections were blocked during replay: zero attempts.

The two full price files have 2,311 and 2,635 missing/nonpositive package counts;
the two deltas have 1 and 3 respectively. These remain unknown, not one package.
Exact original download times were not retained in NP0; fetched_at stays null.
The replay records its own real ingestion time instead of inventing a fetch time.

25 offline tests passed (19 NP1 + 6 NP0). Synthetic fixtures are generated in
memory, labelled SYNTHETIC, and contain no personal data or retailer dataset.
Tests cover strict malformed XML/gzip and expansion cap, bad/missing price,
barcode/internal identity, leading zeros, unknown store, hash/source mismatch,
duplicates, old/new delta ordering, explicit removal, missing baseline/continuity,
invalid partial-file atomicity, full replacement with history, DST/future times,
promotion conditions and store coordinates left unresolved.

The first sample pass rejected fractional promotion timestamps. The strict
adapter was corrected to accept the actual fractional-seconds format without
repairing values; the final sample run normalized all files. Original NP0 XML
recovery is still documented by its regression test, not used in NP1.

This is not production ingestion: no persistence, crash recovery, concurrency,
indexed geospatial query, live freshness, package equivalence or savings result
has passed. Valid full-file completeness cannot be established solely by XML
syntax; future source completeness/coverage validation is still required.
Same-time conflicting files fail closed; no arbitrary last-writer winner.

## Files and reproduction

NP1 additions only:

- `tools/nearby-prices/.gitignore`
- `tools/nearby-prices/offline.py`
- `qa/nearby-prices/replay_np1.py`
- `qa/nearby-prices/test_np1.py`
- `qa/nearby-prices/np1-evidence.json`
- `docs/spendscape/NEARBY_PRICES_NP1_SCHEMA.md`
- `docs/spendscape/NEARBY_PRICES_NP1_CHECKPOINT.md`

Run offline replay with
`artifacts/nearby-prices-np0/venv/bin/python qa/nearby-prices/replay_np1.py`.
Run combined bounded tests with
`artifacts/nearby-prices-np0/venv/bin/python -m unittest discover -s qa/nearby-prices -p 'test_*.py' -v`.
Generated output is ignored under `artifacts/nearby-prices-np1`; no normalized
retailer dataset is added to Git. The retained NP0 sample is needed for replay.

## Git safety

Branch feature/spendscape-rebuild; HEAD/local origin feature ref remain
`a0d4e51f8b037dfe5c4da9a9cbbd44e252fea941`.
main/origin/main remain `eee0d26b55e5061f87ac664938df0c195800b74f`.
Index empty. Only NP0/NP1 untracked additions are present. No existing tracked
files changed, including next-env.d.ts, canonical fixtures, Scanner A/B/E,
package manifests, lockfile and application code. No Next.js build, application
QA or browser assertion was run or claimed. The original canonical baseline
and single-map implementation are unchanged by source identity.
No commit, push, PR or deployment; no QA server to stop.

## NP2 connection approval brief — proposal only

Read-only local inventory found no docker, psql, postgres, colima or orb command
on PATH, and no Docker.app/OrbStack.app in /Applications. This is not a full
machine-wide software inventory. No daemon was contacted or started.

Recommend **local Postgres.app** for this Mac-only bounded prototype, avoiding
a container VM. The official download page currently lists Postgres.app 2.9.6,
PostgreSQL 18.6 / PostGIS 3.6.3, Universal, 123 MB download:
https://postgresapp.com/downloads.html . Reverify signature, release checksum,
architecture and versions immediately before any future installation; stop on
mismatch rather than substitute. The PostgreSQL/PostGIS Docker image README
currently lists amd64 support, so do not assume a native ARM64 container:
https://github.com/postgis/docker-postgis . No image or application was downloaded.

Proposed resource: dedicated local cluster and database `spendscape_nearby_np2`,
loopback only on an independently checked unused port (candidate 55432), no
autostart. Separate owner/importer/read-only roles; public sample data only.
Enable only required PostGIS functionality. No hosted provider/account, Supabase,
Docker, authentication product or cloud cost. Local target budget: <=5 GB disk
and <=1 GB measured database-process memory for the sample, not a guaranteed cap.
Keep exact cluster path and process identity in the future resource manifest.
Proposed history retention: this bounded sample only, until checkpoint decision;
no recurring ingestion, new datasets or backups containing personal data.

NP2 needs a separate explicit authorization for downloading/installing that
runtime, creating the exact local cluster, roles/schema/migrations and executing
DB tests. Use bundled psql where practical; any Python/Node DB driver requires
an exact verified dependency manifest before installation. No such driver is
selected or installed by NP1.

Removal: stop only the named cluster, remove only its recorded data directory,
then remove the separately installed app only if NP2 created it and nothing else
uses it. Preserve all pre-existing PostgreSQL resources. No cloud cleanup.

Next recommended gate is NP1 checkpoint review before approving the new runtime:
`APPROVE SPENDSCAPE NEARBY PRICES NP1 CHECKPOINT REVIEW`.
Review remains local/offline and must not install, connect a DB, modify product
code, stage, commit, push or deploy. NP2 is not activated by this report.
