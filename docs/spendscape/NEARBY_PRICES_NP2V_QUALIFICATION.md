# NP2V — Carrefour public HTTPS verification: access stop

Date: 2026-09-23 (Asia/Jerusalem).
Authority: `APPROVE SPENDSCAPE NEARBY PRICES NP2V — CARREFOUR PUBLIC HTTPS VERIFICATION AND BOUNDED SAMPLE QUALIFICATION`.

## Outcome

**STOP at Stage 1: the first public-source verification request returned HTTP 403.**
No retry, alternate hostname request, price listing request, file download,
browser, authentication, cookie, proxy workaround or retailer substitution followed.
This is an access failure in this execution environment, not proof of why the
response was blocked, that CAPTCHA is required, or that Carrefour has no public
price publication. The price host was not contacted.

The exact user stop rule applies: "If access controls, authentication, required
cookies, suspicious redirects, unclear official ownership or prohibited reuse
appear, stop and issue a blocked report." No remaining budget authorizes retrying
around this stop. No cross-retailer qualification success is claimed.

## Source ownership, terms and access assessment

The candidate price listing remains `https://prices.carrefour.co.il/`, derived
statically from pinned `scrappers/bitan.py` and `engines/publishprice.py` in NP2R.
The first request was to `https://www.carrefour.co.il/` to seek an official link
or publication/terms context. It returned 403 before that evidence was obtained.
An expected retailer-domain name and package configuration are engineering
leads, not independently verified official delegation or dataset reuse rights.

Official ownership/delegation: **not established in this run**.
Current official price-transparency/reuse terms and attribution: **unresolved**.
Credential/cookie-free listing and file access: **not established**.
No robots.txt permission inference, legal assertion, currency inference or
unofficial mirror was used. No price files were downloaded without reuse support.

## Pre-request manifest and exact network evidence

The manifest was written before the request at the ignored path
`artifacts/nearby-prices-np2v/pre-request-manifest.json`.

- Stage 1 limits: 4 requests, 2,000,000 total response-body bytes, zero dataset files.
- Candidate allowlist: `www.carrefour.co.il`, `carrefour.co.il`,
  `prices.carrefour.co.il`; HTTPS port 443 only. This restricts targets; it does
  not itself prove official delegation.
- First endpoint: `https://www.carrefour.co.il/`.
- Redirects disabled. Only explicit reviewed allowlisted HTTPS targets would be
  permitted; no redirect was received/followed.
- No URL user-info, query strings, cookies, authorization or persistent session.
- Fixed identifying user-agent, no rotating user-agent or browser imitation.
- Standard-library HTTPS client with certificate/hostname verification;
  no environment proxy, netrc, upstream runner or shell-download fallback.
- Error bodies, response-header values and transport exception contents are not
  retained or printed. MIME is reduced to an allowlisted label.
- Raw-data exclusion: `artifacts/` is ignored. Intended cleanup path is exactly
  `artifacts/nearby-prices-np2v`; it holds safe metadata only, no dataset.

| Request | UTC start | Status | MIME | Body bytes read | Elapsed | Result |
| --- | --- | --- | --- | ---: | ---: | --- |
| https://www.carrefour.co.il/ | 2026-09-22T21:15:45.967294+00:00 | 403 | text/html | 0 | 0.060 s | HTTP_ACCESS_STOP |

Actual: **1 request**, **0 response-body bytes read**, **0 dataset downloads**,
**0 compressed/expanded dataset bytes**, **0 additional stores**. Headers and TLS
traffic are outside the response-body metric. The unconsumed server error-body
size is unknown; zero means the client did not read or retain it, not that the
server produced an empty response. No error-body hash exists because no body was
read. Timing is one local request, not a performance benchmark.

Safe local evidence: `artifacts/nearby-prices-np2v/network.json`. The table above
preserves its complete meaningful network outcome in tracked documentation.
Stage 2/3's allowance (10 additional requests, 6 files, 20 MB compressed,
150 MB expanded, at most 2 stores) was **not activated**. There is no approved
source-file manifest or source-file hash to report; no files were obtained.

## Collector boundary and local QA

`qa/nearby-prices/verify_np2v.py` is an original Stage 1 helper, not an ingestion
pipeline. It imports no scraper/parser. It performs no network call on import.
Each explicit `get` returns a response for review; redirects are never followed.
A failure halts the instance. All requests count before network I/O; body bytes
accumulate across requests; declared excess lengths and compressed responses
are rejected. Reaching the cap fails closed without reading an extra byte.
Dataset suffixes are rejected; only planned human-reviewed HTML/text endpoints
are in scope. This is not a general adversarial URL/content classifier.

Budget state is in-memory per instance. The live one-shot invocation refused to
overwrite an existing evidence ledger. This checkpoint does not provide a
restartable collector or permission to create another instance for live retries.
Any future live run needs its own explicit authorization and durable budget
handling before implementing restart/retry support.

Final focused result: **10/10 synthetic offline tests passed** in 0.041 seconds:

- no Cookie/Authorization header or variable user-agent, no Set-Cookie retention;
- invalid hosts/protocols/ports/user-info/query/dataset URL rejection;
- no automatic redirect and unrelated/HTTP/token/empty redirect rejection;
- HTTP error-body non-read and halted-run behavior;
- fixed transport error redaction;
- four-request limit;
- response-body cap and cumulative cap across two requests;
- excessive Content-Length and compressed-body rejection before reading;
- challenge-marker stop without returning/logging content.

Command: `artifacts/nearby-prices-np0/venv/bin/python -m unittest discover -s qa/nearby-prices -p test_np2v.py -v`.
Tests use fake responses/connections with socket connect patched to fail and
asserted unused. Zero socket connection attempts occurred in these focused tests.
This is not an offline retailer replay result. No source dataset was processed.
The initial 9-test suite also passed before the live request. After stopping,
local hardening rejected empty redirects, suppressed close-time exceptions and
added cumulative-byte coverage. No further live request followed those changes.

## Eligibility funnel and unexecuted conditional stages

| Required evidence | Result |
| --- | --- |
| Carrefour normalized stores/prices | Not measured; no sample |
| Validated external GTIN intersection | Not measurable, not an empty-intersection finding |
| Package/unit/count/weighted/variant equivalence | Not evaluated |
| Ordinary positive base prices | No paired candidate established |
| Authoritative currency | Unresolved; ILS not inferred |
| Freshness | Not evaluated for Carrefour |
| Verified physical-store coordinates at both ends | Not established |
| All criteria simultaneously | No complete source-backed comparison proven |
| Exact savings and store-to-store distance | Not calculated |

The retained Shufersal NP0 sample was not downloaded again or modified.
NP0/NP1 strict parsing, ordering, source identity, provenance, idempotency and
quarantine code remain unchanged. No sample replay was run. The 24-hour source
publication proposal remains unchanged; download/replay never renew source truth.
Unknown currency/package/location/status remains unresolved. No synthetic place,
GPS, promotion-derived price, cross-retailer internal-code join or substitution
was used.

Required data-dependent tests (gzip/XML quarantine, source-specific joins, GTIN,
package/variant/weighted checks, promotions, currency, coordinates, freshness,
savings/distance, idempotency and replay network blocking) were **not implemented
or run in NP2V**, because the preceding access stop prevented Stages 2–4.
Prior NP0/NP1 tests remain historical; they do not prove Carrefour qualification.
Stage 1's zero-dataset-file boundary is tested through URL rejection; no Stage 3
six-file/expanded-byte enforcement was implemented or claimed.

## Licence and attribution

No dependency installed or changed and no upstream implementation copied or
executed. Existing scraper 1.0.14/parser 1.0.11 remain subject to their custom
non-commercial licence and attribution to Sefi Erlich. Original sources:
https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-scarpers and
https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-parsers .
Retailer reuse rights are separate and unresolved. No dataset redistributed.

## Exact changed-file manifest and Git safety

Three new files only:

1. `docs/spendscape/NEARBY_PRICES_NP2V_QUALIFICATION.md`
2. `qa/nearby-prices/verify_np2v.py`
3. `qa/nearby-prices/test_np2v.py`

Ignored generated evidence: Stage 1 manifest/network metadata and Python bytecode;
no raw retailer files, successful page bodies, credentials or error bodies.
`git diff --check` and explicit untracked-file whitespace/manifest checks pass.
No Next.js commands, browser tests or application server ran. Existing tracked
files are unchanged, including application, dependencies, canonical fixtures,
Scanner A/B/E and next-env.d.ts. Single MapLibre behavior is preserved by source
identity; no fresh rendered regression claim is made.

Branch: `feature/spendscape-rebuild`. HEAD and origin tracking ref:
`8d8613ad87374573596f3ba14144880d54e30428`.
main and origin/main: `eee0d26b55e5061f87ac664938df0c195800b74f`.
Initial worktree/index clean; final index empty. Remote refs were not refreshed
in NP2V; direct remote verification was performed by the preceding approved push.
No stage, commit, push, PR, deployment, database, provider resource or API/UI work.

Recommendation: **stop at source access**, not hosted Supabase/PostGIS readiness
or a currency/location correction. No follow-up network action is authorized by
this report. Next separate gate:
`APPROVE SPENDSCAPE NEARBY PRICES NP2V CHECKPOINT REVIEW`.
