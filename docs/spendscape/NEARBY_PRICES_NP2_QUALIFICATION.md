# Nearby Prices NP2 — qualification stopped at source-access gate

Date: 2026-09-22.
Authority: `APPROVE SPENDSCAPE NEARBY PRICES NP2 — CROSS-RETAILER COMPARISON ELIGIBILITY AND STORE-LOCATION QUALIFICATION`.
This approval supersedes the previous NP2 local database proposal. It does not
authorize Postgres.app, Docker, Supabase, a database, API or application changes.

## Outcome: STOP, not a completed eligibility benchmark

Exactly one additional retailer was selected: Osher Ad, source chain ID
7290103152017. Static inspection of the already installed, pinned
il-supermarket-scraper 1.0.14 established that its Osherad adapter inherits
Cerberus, supplies a configured FTP username, and passes username/password to
the FTP listing utility. Cerberus defaults to an empty password. That is still
an authenticated FTP protocol flow; it is not a credential-free HTTP listing.
No private credential was discovered or requested, and no login was attempted.

The user's explicit instruction is: "Stop if the selected retailer requires
credentials, bypassing access controls, acceptance of paid terms, or an
unsupported source workaround." This report treats even the published username
and empty-password login as outside that credential-free access boundary.
This is a finding about the reviewed adapter path, not proof that every possible
official Osher Ad distribution channel requires authentication.

Evidence inspected locally, without importing or executing the scraper:

- il_supermarket_scarper/scrappers/osherad.py: Osherad(Cerberus), chain ID,
  configured FTP username.
- il_supermarket_scarper/engines/cerberus.py: FTP host configuration, username/
  password arguments, collect_files_details_from_site forwarding those arguments
  to collect_from_ftp.

Upstream reference: https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-scarpers
No alternate retailer, mirror, protocol workaround or broad scraper was used.

## Source scope and budget at the stop

Existing Shufersal sample: nine NP0 files, two price-store partitions, unchanged
and not redownloaded. Previously retained normalized evidence is background;
it is not a newly verified cross-retailer comparison.

Osher Ad requested files: none. No listing was accessed, so no trustworthy exact
filename, file size or one/two-store selection could be made. Active network
request budget and compressed download budget for this stopped run: **0 requests,
0 bytes**. Actual: **0 requests, 0 bytes**. No retailer file URL or signed query
parameter was collected. Any future resumption must first resolve the source
access gate, inspect a permitted listing and record exact file/request limits
before any dataset download. Do not fabricate filenames in advance.

## Required overlap funnel

| Question | Result |
| --- | --- |
| Exact external GTIN overlap | Not measurable: no authorized second-retailer sample |
| Overlap after package/variant validation | Not measurable |
| Eligible ordinary base prices at physical stores | Not measurable |
| Stores with coordinates verified in NP2 | 0 verified; actual availability unknown |
| Candidates satisfying all requirements | 0 proven; not a measured empty intersection |
| Complete deterministic source-backed example | None established |

No prices, savings, coordinates, distance, product substitutions or user purchase
were manufactured to fill the missing evidence. No eligible public-data example
or production claim exists from this run.

## Currency, location and freshness status

Currency remains unresolved from NP1. NP2's requested authoritative legal/schema
research did not proceed after the access stop; no ILS inference is made.
No live location-source research, coordinates or geocoder qualification was
performed. The unchanged Shufersal Store sample lacks coordinate fields, as
recorded in NP0. Source-specific physical-store identity, coordinate provenance,
accuracy class, permitted reuse and verification time remain required. Do not
use synthetic Spendscape place coordinates or device GPS.

Future origin semantics are the verified purchase store, not the phone. Future
distance would be store-to-store; PostGIS remains only a later candidate.
No distance implementation, geospatial query or performance claim was made.

Proposed college-demo freshness policy, not measured/implemented: require source
publication/confirmation within 24 hours of an explicitly recorded comparison
time and no known coverage gap. A new fetch/ingestion/replay does not renew it.
Keep publication, item last-change, fetch, ingestion and comparison times
separate. Missing provenance or exceeded threshold means unavailable/stale.
The NP0 exact fetch times remain unknown; do not backfill them from replay time.
The original bounded sample must never be described as prices "now" on replay.

## Eligibility rules retained for a separately authorized resumption

Only validated external GTINs may join across retailers; preserve leading zeros
and scope internal codes to their retailer. Require equivalent known package
quantity/unit/count, non-weighted status and meaningful variant evidence.
Checksum equality alone is insufficient. Unknown or mismatched facts reject.
Use positive exact decimal ordinary base prices with authoritative currency
semantics; exclude all conditional promotions. Preserve source promotion
evidence separately, never convert it to unconditional savings. Require verified
physical store identities and attributable acceptable coordinates at both ends.
No substitutions, user GPS, API/UI or canonical purchase graph mutation.

## Dependencies, licensing and tests

No dependencies were installed or changed. The NP0 macOS/Python lock remains
unchanged: scraper 1.0.14, parser 1.0.11 and its existing transitive packages.
Non-commercial-only custom licence and attribution obligations remain in force:
credit Sefi Erlich and the original scraper/parser repositories, disclose changes
if any, and obtain separate written permission before commercial use.
No upstream package was modified and no dataset was redistributed.

NP2's requested offline eligibility tests were **not implemented or run** after
the explicit access stop. This is not a QA pass. The prior 30 NP0/NP1 tests remain
historical evidence, not proof of cross-retailer eligibility. No application
build, browser QA or server was started. Report consistency, Git cleanliness of
existing files and `git diff --check` were checked for this documentation-only
blocked outcome.

## Git safety, manifest and next gate

Only new file: `docs/spendscape/NEARBY_PRICES_NP2_QUALIFICATION.md`.
Branch feature/spendscape-rebuild. HEAD and origin feature tracking ref remain
2c383b666a560d1bea4f4bf1fff25aca093ae74c, synchronized at the reviewed NP0+NP1
checkpoint. main and origin/main remain
eee0d26b55e5061f87ac664938df0c195800b74f. Index empty; all existing tracked files,
including next-env.d.ts, scanners, application and canonical fixtures unchanged.
No stage, commit, push, database, provider resource, account or deployment.

Recommendation: **stop at source access**. Do not propose Supabase/database
readiness: the required complete comparison candidate has not been proven.
The access boundary would need an explicit user decision before a resumed
qualification; no permission to log in, select another retailer or use another
source is inferred here. No credentials are requested.

Next separate approval: `APPROVE SPENDSCAPE NEARBY PRICES NP2 CHECKPOINT REVIEW`.
That reviews this blocked finding and scope compliance; it does not approve
comparison eligibility, source authentication or a later implementation phase.
