# College Milestone 5 — readiness audit and completion plan

Audit date: 14 October 2026 (Asia/Jerusalem). Starting HEAD
ad6091d5de8fd393eae7804c71e38edbae3f86c2, feature/spendscape-rebuild.
This slice covers read-only saved-data reconciliation, isolated offline checks,
submission instructions and a scoped local documentation commit. It performs no
extraction, geocoding, price collection, credential access or real-data writes.

**Readiness verdict: local audit complete; full Milestone 5 not ready.**
Backup/restore and an operational address-search session are absent. The scanner
checkpoint stays closed with its real repeated-capture limitation disclosed.
City-based comparison remains completed; distance-based comparison is deferred.

## Three-pin reconciliation — no data changed

The Milestone 3 acceptance record on 13 October verified three purchases and two
pins: receipt_01 at local_place_2 and receipt_04 at local_place_5. At the first
Milestone 4 walkthrough on 14 October, the application already hydrated three
pins. This audit identifies the additional association, rather than treating the
count as evidence that comparison created a location.

| Saved purchase | Current canonical place | Origin supported by inspected UI |
| --- | --- | --- |
| session_purchase_receipt_01 | local_place_2 | Earlier corrected-address, user-confirmed place in Ramat Gan; displays Geoapify suggestion attribution. |
| session_purchase_receipt_04 | local_place_5 | Milestone 3 user-confirmed place in Petah Tikva; displays Geoapify suggestion attribution. |
| session_purchase_receipt_03 | local_place_6 | The weighted receipt now has a saved physical place in Petah Tikva. The existing-place display has no street address or address-search attribution. |

Each existing-place form was opened only to read its current association and was
cancelled. Each merchant offers one distinct place; three distinct purchase IDs
and three distinct linked place IDs are present. View place shows one visit per
place. Canonical pin derivation groups confirmed physical purchases by place ID;
strict directory hydration rejects repeated IDs. No duplicate purchase or repeated
canonical place ID was observed. No retailer branch pin was created.

The third place's exact creation time, confirmation method and actor cannot be
established through the current UI. No retained event proves when it changed from
unresolved. Lack of address-search attribution is not proof of a specific manual
method. Coordinates were not inspected or exported, so coordinate coincidence or
geographic accuracy is not claimed. Preserve this place pending user review if
its physical location is uncertain; never silently delete or replace it.

## Current implementation inventory

| Area | Actual behavior and readiness |
| --- | --- |
| Ordinary data | Fresh user starts empty. User-reviewed IndexedDB records drive history, Stats and confirmed-place pins; synthetic data is QA-only. |
| Receipt capture | tools/receipt-capture supports a privately configured local operational session, repeated explicit Reads, finite count/cost, 60-second spacing, two-hour expiry, durable consumption, same-image protection and stop-on-error. Default/hosted behavior is disabled. No session is activated by this audit. |
| Request contract | Successful Gemini image + prompt + JSON MIME request remains unchanged. Multipart decoder, fixed diagnostics and deterministic financial validation are preserved. Proposed defaults and extracted facts remain distinguishable and editable. |
| Review/save | Supported printed date/time prefill, college two-digit-year policy, recognized currency, original observations, strict per-line arithmetic and independent final payable remain intact. Explicit Unknown context and unresolved location save without coordinates. Saving is explicit. |
| Scanner evidence | Real extraction → review → user Save → reload and same-ID date correction passed. Same-session repeat of the same real receipt and its duplicate prevention remain UNVERIFIED. The user closed that checkpoint; no new reads planned here. |
| Address/pin | Ordinary saved-purchase form supports edited address, candidate precision, same-map preview, explicit point confirmation, atomic same-ID update, reuse, cancellation and Undo. Live native activation still requires fixed frozen one-request mappings; existing runs are consumed. No reusable ordinary geocoding session exists. |
| City prices | Qualified Shufersal branches 104/285 in Petah Tikva; four shared Monster 500 ml products; explicit temporary identity/package matching. Real Mango match across both branches passed. Partial coverage is not a complete basket. No stock, promotions or historical-receipt savings guarantee. |
| Expiry | Each publication expires after 24 hours; current quotes disappear without hidden refresh. First publication expires 15 October 2026 at 13:18:33 Israel time, second at 13:20:47. Older item-update dates and fetch dates do not replace publication time. |
| Backup/restore | Not implemented. LocalDataPanel exposes privacy/deletion, not export/import. restoredLedger rehydrates validated memory; it is not a file-restore feature. Clearing site data, changing origin/profile or private browsing can lose access/data. |
| Mobile | Current Chromium emulation verifies EN/HE controls, optional Advanced coordinates, explicit save, errors and reload. It does not establish current physical iPhone camera/Safari acceptance. Older user-reported scanner smoke evidence predates this UI. |
| Deployment/backend | Current product remains local. No account, cloud sync, hosted provider activation or durable cloud backup. Vercel remains paused. |

## Ordered completion slices and acceptance gates

### 5A — audit, local checks and truthful submission package (this slice)

Acceptance: reconcile current pins without writes; verify current runtime/source;
check local provider/session/storage safeguards and mobile review; document scanner
and radius limitations; supply reproducible local submission instructions; preserve
historical evidence, dirty work, main refs and next-env.d.ts; commit exact scope.
This documentation/readiness slice passes. It is not full Milestone 5 readiness.

### 5B — local purchase backup/restore (next smallest implementation)

No provider or backend is necessary. Proposed bounded local scope:
- Explicit download of a versioned structured backup after a privacy notice.
  It contains reviewed purchases, merchant/place IDs and details, confirmed
  coordinates/provenance, decisions and sequence metadata; never photos, drafts,
  OCR, provider responses, credentials, temporary matches or reservation journals.
- File input with a 2 MB bound; validate the full envelope and reference graph
  through existing v1–v4 rules before any write. Corrupt/future/partial data fails
  closed. Preserve original IDs, financial values, independent totals and places.
- Preview counts and scope; explicit user confirmation. Initial restore should
  target only an empty local ledger and refuse a nonempty destination, avoiding
  speculative merge/replacement or accidental overwrite. Repeated import must not
  add duplicates. Use current destination revision and one atomic transaction;
  do not overwrite its concurrency revision with the exported revision.
- Verify synthetic round trip, legacy migration, Unicode, unknown context,
  discounts, final-total differences, place provenance, rejected files, quota/
  conflict rollback, idempotence and same-origin reload/pin parity in EN/HE.
- No automated export/restore of the user's real data. A real user-controlled
  backup and restoration check requires explicit confirmation and an isolated
  destination. Backup is a private unencrypted file, not cloud synchronization.

Requires a bounded local implementation/QA slice before it can be called ready.
No new dependency, account or provider is proposed.

### 5C — normal local provider startup and address-search operation

Reuse the receipt session and existing address-search UI/transport. Proposed
operational geocoding session must be separate from historical fixed runs, with
finite request/credit count, expiry, exclusive durable reservations, concurrency/
late-response guards, safe errors, user-submitted address only and no automatic
retry/fallback. A single private startup may enable only explicitly approved
capabilities; key existence must never activate them. Never expose keys to client
bundles, URLs or logs. Preserve map-only/unresolved alternatives.

Offline session/launcher and UI mocks can be prepared in a separately bounded
local slice. Live activation requires fresh current Geoapify Free/project/remaining
credit/no-paid-overage facts and an explicit request/credit allowance. Gemini
activation remains separately priced/budgeted and privacy-approved; this audit
provides no inference allowance and does not reopen scanner validation. Keep the
successful request shape unchanged. No backend/account change is needed for a
loopback session. Hosted providers require a separate security/access-control and
deployment gate; local-only guards must not simply be removed.

### 5D — price expiry and presentation-day freshness

Existing expiry/unavailable behavior passes. For a fresh-price presentation,
propose one bounded public collection of the same two branch PriceFull files
through published links, explicit total attempt/file/byte limits and no private
location transmission. Revalidate Stores linkage, ILS/package/identity, UTC
publication/fetch/raw item-update timestamps, age ≤24 hours and strict arithmetic.
Rebuild the validated snapshot explicitly. No hidden refresh or silent fictional
replacement. Fresh collection needs separate provider/download authorization;
the historical 19 consumed attempts stay unchanged. Radius/coordinates remain
deferred even after refreshed city data.

### 5E — final mobile/submission check

After accepted local slices: fresh-user zero-state; manual entry; receipt mock
review/cancellation/error; optional place confirmation; Purchases/Stats/search;
Undo; backup/restore; expired city prices; EN/HE at 360/390/430/1280 widths and
keyboard/reduced-motion. Keep one map and all actual user records intact.
Provider-free physical-phone display checks can follow a separately reviewed safe
local setup. Camera needs a trusted secure origin; current loopback provider guards
cannot be bypassed for LAN. Any tunnel/public URL or deployment requires approval.
Report physical checks separately from Chromium emulation. Submission acceptance
must explicitly allow the closed scanner limitation and deferred radius rather
than asserting them passed. No broad receipt accuracy claim.

## Submission instructions for the current local checkpoint

1. Present from the same browser profile at http://127.0.0.1:3172/. A different
   host, port, browser or profile has a different storage boundary. Do not clear
   site data or use private browsing for the saved-purchase walkthrough.
2. Current server is provider-disabled. Show Purchases → details → View place,
   Stats and city comparison. Explain that saved facts persist locally; images
   and temporary product matching do not. Do not rerun consumed launchers.
3. For comparison, select Petah Tikva and explicitly match the exact product,
   brand, variant and 500 ml single-can package. Unknown matches stay unavailable.
   Show branch addresses, publication/fetch times, source and coverage. After
   expiry, demonstrate the honest unavailable state; do not alter the clock.
4. For a reproducible source-only assessor package, use the committed branch
   checkpoint/archive and lockfile, excluding ignored artifacts, .next,
   node_modules, credentials, private images and browser data. Existing build
   prerequisites: Node ≥22.14 and npm 10.9.2. Build an isolated copy, then start
   production on loopback with all provider keys and SPENDSCAPE activation flags
   absent. It starts empty; user data is not included in Git or this package.
5. Never overwrite an active server/draft or build in its frozen directory.
   Stop it only after saved data/draft safety is established. Reuse the same origin
   when intentionally returning to stored purchases. Provider sessions use
   tools/receipt-capture/prepare.mjs and start.mjs only after separate activation
   approval; these are not instructions to run them now.
6. Supply this readiness plan, COLLEGE_CITY_PRICES.md, the closed scanner and
   COLLEGE_ADDRESS_TO_PIN_MILESTONE.md checkpoints with the submission. State
   that backup/restore and reusable geocoding are still missing. No hosted link
   represents these commits until separately published/deployed.

## Actual QA and preservation

Evidence: artifacts/college-m5-readiness-xsy4fm81/.
- Fresh HEAD-only checkout: 161/161 focused tests across 11 files; five launcher
  controls; application typecheck. Session/request diagnostics, concurrency,
  restart, fail-closed budgets, migrations, directory/pin/location/time, known/
  Unknown financial context and city expiry controls passed with synthetic inputs.
- 188 runtime/public/package files match the previously successful production
  build. Reused that build on isolated port 3195; real port 3172 was not replaced.
- Nine production-browser synthetic scenarios passed: EN/HE mobile prefill,
  explicit save/reload, duplicate-save blocking, Undo, invalid dates, ambiguous
  facts, unresolved without coordinates, mocked candidate/map confirmation,
  cancellation, safe disabled search and durable-write failure. EN/HE screenshots
  visually inspected. Existing M4 five-scenario city/expiry evidence matches
  unchanged runtime and is reused. No real provider call or real purchase write.
- Initial browser launch was blocked by the filesystem/process sandbox; all nine
  ended before app checks. Authorized rerun passed in a fresh output destination.
  Initial build-hash verifier used the wrong working directory; corrected verifier
  checked all 188 files. Earlier failures are retained, not reported as passes.
- Real read-only UI reconciliation found three distinct purchase/place links;
  all location forms cancelled. No private backup, screenshots, coordinates or
  receipt/provider content retained as QA artifacts. Pin confirmation timing is
  unresolved, not fabricated. Historical records/locks and unrelated dirty files
  remain protected. QA server stopped; current provider-disabled 3172 left intact.

Exact documentation scope: README.md (current capability copy/link only), this
file, and only appended M5 audit sections in docs/AI_HANDOFF.md and
COLLEGE_FINAL_MILESTONES.md. No runtime, request, schema or financial-rule changes.


## Milestone 5 slice 1 — local backup/restore ready (2026-10-15)

Versioned private JSON export and strictly validated, explicitly confirmed,
empty-only atomic IndexedDB restore are implemented. Preserve IDs, printed item
values and final payable independently, dates, unknown context, saved decisions,
merchant/place associations and existing provenance; no confirmation upgrades.
8 MiB file cap; existing 2,000,000-character ledger validation unchanged. No
images, credentials, diagnostic journals or temporary product matches exported.
Checksum detects corruption, not authenticity. Historical references require an
exact compatible baseline. Destination revision/sequence protection is retained.

Fresh isolated candidate: 108/108 focused tests, app/QA typechecks, production
build, 10/10 browser scenarios including abort/conflict/reload, EN/HE mobile
inspection. Retained earlier failures were corrected, not erased. No provider
calls or scanner retesting. Real ledger and running port 3172 left untouched;
no real backup/restore claimed. See COLLEGE_PURCHASE_BACKUP.md for the exact
16-file scope, limits and evidence artifacts/college-backup-6tqostgv/.

This supersedes the earlier audit's absent-backup status and proposed 2 MB file
limit only. Full Milestone 5 remains incomplete: reusable address-search startup,
separately approved fresh prices if needed, physical-mobile and submission checks
remain. Scanner's real same-session duplicate check remains unverified and closed;
city comparison's radius requirement remains deferred. Vercel paused; no push or
deployment. Unrelated work, main refs, next-env.d.ts and historical locks preserved.
