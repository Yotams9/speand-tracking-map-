# NP2R — static source-access inventory and qualification stop

Date: 2026-09-22. Authority: `APPROVE SPENDSCAPE NEARBY PRICES NP2R — CREDENTIAL-FREE SOURCE RECOVERY AND BOUNDED CROSS-RETAILER QUALIFICATION`.

## Verdict and scope

**Stop at Stage 1: no second source fully qualified under the pre-request gate.**
This is not a finding that no credential-free Israeli retailer source exists.
The installed code exposes plausible public HTTPS candidates, but does not
establish all required facts: current credential/cookie/CAPTCHA-free access,
official source designation, permitted bounded reuse and available store/base-price
files. No source was selected for collection. No network request was made.

Rami Levy and Yohananof both inherit Cerberus and supply credential-like
configuration. They are excluded, as is Osher Ad's reviewed FTP adapter.
An empty/default/published login is still excluded. Credential values are not
reproduced in this report. No adapter was imported or executed.

The user's explicit stop rule is: "If no retailer qualifies, stop with a
source-access inventory and recommendation. Do not perform network access".
Consequently, neither online source discovery nor a trial request was used to
resolve the remaining access/reuse uncertainty. This interpretation is stricter
than treating a plausible HTTPS URL as an already qualified source.

## Static inventory

Source: already installed scraper 1.0.14 and parser 1.0.11, inspected as text/AST.
All **41 factory entries** are listed: 33 active and 8 deprecated according to the
pinned package, not a new verification of retailer business status. Names below
are exact adapter class identifiers; chain identifiers are source namespaces.
No upstream module was imported, no factory/orchestrator was run.

Each row references the transport/state/logging profiles below. `L` is the common
licence qualification. `S/P/PF/M/MF*` means the parser has Stores, Price, PriceFull,
Promo and PromoFull conversion paths (including inherited defaults). It means
library support appears available, **not that current source files exist**.
SuperPharm maps Promo to PromoFull in its listing filter. Other generic listing
parsers accept file categories by filename rather than proving their presence.

| Retailer adapter | Source chain ID(s) | Package status | Access profile | Categories | Licence |
| --- | --- | --- | --- | --- | --- |
| Bareket | 7290875100001 | active | B | S/P/PF/M/MF* | L |
| YaynotBitanAndCarrefour | 7290055700007 | active | P | S/P/PF/M/MF* | L |
| CityMarketKiryatGat | 7290058288526, 7290058266241, 7290058288090 | active | B | S/P/PF/M/MF* | L |
| CityMarketShops | 7290000000003 | active | H | S/P/PF/M/MF* | L |
| DorAlon | 7290492000005, 729049000005 | active | F | S/P/PF/M/MF* | L |
| GoodPharm | 7290058197699 | active | B | S/P/PF/M/MF* | L |
| HaziHinam | 7290700100008 | active | W | S/P/PF/M/MF* | L |
| HetCohenNewSource | 7290455000004 | active | A | S/P/PF/M/MF* | L |
| Keshet | 7290785400000 | active | F | S/P/PF/M/MF* | L |
| KingStore | 7290058108879 | active | B | S/P/PF/M/MF* | L |
| Maayan2000 | 7290058159628 | active | B | S/P/PF/M/MF* | L |
| MahsaniAShukNewSource | 7290661400001, 7290633800006 | active | A | S/P/PF/M/MF* | L |
| NetivHased | 7290058160839 | active | W | S/P/PF/M/MF* | L |
| MeshnatYosef1 | 5144744100002 | active | W | S/P/PF/M/MF* | L |
| MeshnatYosef2 | 5144744100001, 7290058289400, 2222222 | active | B | S/P/PF/M/MF* | L |
| Osherad | 7290103152017 | active | F | S/P/PF/M/MF* | L |
| Polizer | 7291059100008 | active | F | S/P/PF/M/MF* | L |
| RamiLevy | 7290058140886 | active | F | S/P/PF/M/MF* | L |
| SalachDabach | 7290526500006 | active | F | S/P/PF/M/MF* | L |
| ShefaBarcartAshem | 7290058134977 | active | B | S/P/PF/M/MF* | L |
| Shufersal | 7290027600007 | active | W | S/P/PF/M/MF* | L |
| ShukAhir | 7290058148776 | active | B | S/P/PF/M/MF* | L |
| StopMarket | 72906390, 7290639000004 | active | F | S/P/PF/M/MF* | L |
| SuperPharm | 7290172900007 | active | H | S/P/PF/M/MF* | L |
| SuperYuda | 7290058198450, 7290058177776 | active | F | S/P/PF/M/MF* | L |
| SuperSapir | 7290058156016 | active | B | S/P/PF/M/MF* | L |
| FreshMarketAndSuperDosh | 7290876100000 | active | F | S/P/PF/M/MF* | L |
| TivTaam | 7290873255550 | active | F | S/P/PF/M/MF* | L |
| VictoryNewSource | 7290696200003, 7290058103393 | active | A | S/P/PF/M/MF* | L |
| Yellow | 7290644700005 | active | F | S/P/PF/M/MF* | L |
| Yohananof | 7290803800003 | active | F | S/P/PF/M/MF* | L |
| ZolVeBegadol | 7290058173198 | active | B | S/P/PF/M/MF* | L |
| Wolt | 7290058249350 | active | W | S/P/PF/M/MF* | L |
| Victory | 7290696200003, 7290058103393 | deprecated | M | S/P/PF/M/MF* | L |
| Quik | 7291029710008 | deprecated | P | S/P/PF/M/MF* | L |
| HetCohen | 7290455000004 | deprecated | M | S/P/PF/M/MF* | L |
| MahsaniAShuk | 7290661400001, 7290633800006 | deprecated | M | S/P/PF/M/MF* | L |
| Cofix | 7291056200008 | deprecated | F | S/P/PF/M/MF* | L |
| Mega | 7290055700007 | deprecated | P | S/P/PF/M/MF* | L |
| CityMarketGivatayim | 5359000000000 | deprecated | B | S/P/PF/M/MF* | L |
| CityMarketKirtatOno | 5359000000000 | deprecated | B | S/P/PF/M/MF* | L |

### Transport, state and connection logging profiles

- **F — Cerberus:** FTP_TLS with username/password arguments; credential-like
  configuration supplied, sometimes using inherited empty-password defaults.
  Not anonymous credential-free access. `utils/network/connection.py:649–776`
  lists through FTP login; `:666` logs host and both credential variables at
  INFO; `:813` repeats connection details for downloads. Categorically excluded.
- **B — Bina:** HTTP listing plus JSON download-location resolution on the
  configured Bina publisher service. No adapter username/password/token argument
  found. Inherits WebBase's cookie-file path and generic connection logs;
  `engines/bina.py:132` also logs resolved download-location data. Publisher
  designation, actual download transport and cookie-free availability unverified.
- **P — PublishPrice:** HTTPS retailer-domain HTML listings/direct file paths;
  no adapter username/password/token argument found. Inherits cookie handling and
  logging below. Carrefour is a plausible candidate; Quik/Mega are deprecated
  in this package. No current availability or reuse permission established.
- **M — Matrix:** HTTPS catalog HTML on a shared publishing service; no adapter
  username/password/token argument found. Inherited cookie handling/logging;
  official retailer delegation unverified. These entries are deprecated.
- **A — Laibcatalog API:** HTTPS JSON catalog on a shared publishing service;
  no explicit authorization/token header configured in the inspected adapter.
  `requests.Session` retains response cookies and may send them on later requests;
  no source-specific account established. API errors log URLs/exceptions
  (`engines/api_web.py:45,76`). Current publisher delegation/reuse unverified.
- **W — WebBase/MultiPageWeb HTTPS:** no adapter authentication argument found.
  Includes HaziHinam, NetivHased, MeshnatYosef1, Wolt and existing Shufersal.
  Shared cookie files/logging still apply. Wolt's URL contains a public path but
  that is not proof of physical-store eligibility or current access conditions.
  MeshnatYosef1 uses a workers.dev host whose official status is unverified.
  Shufersal is the retained baseline, not an additional retailer.
- **H — WebBase/MultiPageWeb HTTP:** CityMarketShops and SuperPharm configure
  HTTP listings. No adapter credentials found; inherited cookie/log behavior.
  Current redirects, protections and reuse unverified; no HTTPS upgrade guessed.

Shared WebBase path: `engines/engine.py:148` assigns a cookie filename;
`:524–536` forwards it to `session_with_cookies`; `connection.py:283–346`
loads/writes cookie state, logs method/URL/body at DEBUG and logs response body
on errors. Cookie-support code does **not** prove the remote source requires
cookies. It does show the existing runner is unsuitable for a no-cookie run
without a separately controlled request path. No stored cookie files were read.
No direct header-value log was found in these request paths, but raw exceptions
and response bodies can expose connection information; do not treat them as safe.

The shared utility also contains Playwright/stealth rendering, rotating user-agent
and blocked-page fallback logic (`connection.py:490–606`); this is excluded.
It is a government-page utility, not proof every retailer adapter uses browser
automation. The generic download path can fall back to wget, placing a link in
process arguments (`engines/engine.py:801–809`); that path is also excluded.
No browser, shell downloader, authentication or anti-bot workaround was executed.

`utils/core/logger.py` creates console/file handlers at import unless handlers
already exist. Any later approved execution must suppress upstream logging
**before import**, disable propagation and default file handlers, use fixed error
codes, and avoid URL-bearing exceptions. This run avoids import entirely.
Do not rely merely on lowering DEBUG: FTP credential logging is INFO.

### Best unqualified candidate and recommendation

For a subsequent permitted public-source verification, Carrefour is the most
direct static candidate: `scrappers/bitan.py` + `engines/publishprice.py` construct
`https://prices.carrefour.co.il/`, parse a file array from HTML and build direct
file paths without adapter credentials. **It has not been selected or contacted.**
NetivHased and HaziHinam also have plausible retailer-domain HTTPS paths.
No mirror was substituted; no attempt was made to bypass the shared runner's
cookies against a live source.

The missing step is permission to verify one candidate's public information/listing
before claiming it satisfies the all-facts-established pre-request gate. That
verification would need explicit bounds, no cookies/authentication, no redirects
to unapproved hosts and immediate stop on access controls. This report does not
activate it or request credentials. Do not relax the original no-authentication
boundary or proceed to database readiness.

## Licences and provenance

**L:** installed scraper/parser LICENSE.txt is custom non-commercial-only,
requiring attribution to Sefi Erlich; written permission is required for commercial
use. Preserve original notices and identify modifications if any. Neither package
was modified. Sources:
https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-scarpers and
https://github.com/OpenIsraeliSupermarkets/israeli-supermarket-parsers .
Installed licence SHA-256 is recorded in NP0:
`cdc8ccfd7e3c906635c134eff73271b537f1c28671c294cab256adbab15b647f`.
Package licensing does not establish retailer dataset reuse rights. No dataset
licence or legal currency interpretation was inferred; no dataset redistributed.
All external-source descriptions here are local pinned-code evidence, not live
website or legal verification. No source URL with user-info or a signed query
belongs in this report.

## Budget and qualification results

No Stage 2 collection manifest was activated. Limits and actual use for this
stopped run: **0 listing requests, 0 file downloads, 0 compressed bytes,
0 expanded bytes, 0 additional stores**. No cleanup directory was created.
The existing Shufersal NP0 sample was not redownloaded, modified or deleted.
Raw data remains ignored under `artifacts/`; no raw data enters this checkpoint.

| Funnel / required evidence | Result |
| --- | --- |
| Second-source normalized rows | Not measured; no collection/adapter execution |
| Valid external GTIN overlap | Not measurable, not a measured zero intersection |
| Strict package/unit/count/variant and weighted-item checks | Not run |
| Positive ordinary base prices at physical stores | Not established |
| Authoritative currency | Unresolved; ILS not inferred |
| Verified coordinates/provenance | No second-store coordinates verified |
| Freshness | Not evaluated for a second source |
| All requirements simultaneously | No complete candidate proven |
| Deterministic source-backed comparison | None established |

No conditional promotion, synthetic coordinate, GPS or internal product code was
converted into comparison evidence. The NP2 proposed 24-hour source-publication
threshold plus no known coverage gap remains unchanged and unimplemented here.
Fetch, ingestion and replay cannot renew source truth. Unknown NP0 fetch times
remain unknown. No current-price or savings claim is made.

## QA, limitations and exact manifest

Stage 1 static consistency checks verify factory coverage, source chain IDs,
active/deprecated counts and unchanged tracked files. No scraper/parser import,
retailer access, new dependency or application command was needed.
Stages 3/4 and their required offline eligibility tests were **not implemented or
run**, because the conditional Stage 1 stop precedes them. This is not an NP2R
cross-retailer QA pass. The prior 30 NP0/NP1 tests are historical evidence only.
No runtime socket-blocking/replay result is claimed for this documentation run.
Static-inspection deviation: an initial raw source excerpt exposed an obsolete
commented public login identifier. It was not used for access or copied into this
report; no private credential was requested or read from an account. Subsequent
credential-configuration inspection used AST field-presence reporting without
values. Future inspections must redact comments as well as active assignments.
NP0/NP1 normalization, provenance, quarantine and ordering code remain unchanged.

Exact changed-file manifest (one new file):
`docs/spendscape/NEARBY_PRICES_NP2R_QUALIFICATION.md`.

Baseline verified locally: feature/spendscape-rebuild HEAD and origin tracking ref
both `99d074685380b59e66067e7fcb38dab59430a50c`; main/origin/main both
`eee0d26b55e5061f87ac664938df0c195800b74f`. No network refresh of refs in NP2R;
the direct remote verification occurred in the preceding authorized push.
Initial worktree/index clean. No tracked application, dependency, fixture,
Scanner A/B/E, next-env.d.ts or MapLibre change. No fresh application/browser QA
claimed. No stage, commit, push, database, provider, account or deployment.

Recommendation: **stop**, with plausible HTTPS candidates still unqualified.
The next gate reviews this inventory and stop interpretation, not source access
or a successful comparison:
`APPROVE SPENDSCAPE NEARBY PRICES NP2R CHECKPOINT REVIEW`.
