# Existing purchase → confirmed physical place — local checkpoint

2026-10-10. Implementation/local QA; awaiting separate review. HEAD remains
`cbf62a12acbd8be2e649a44d17064acaf82d6482` on `feature/spendscape-rebuild`.
No commit, push, deployment or provider request.

## Verified implementation

User-added, non-online purchase details offer **Confirm or change purchase place**.
Reuse is limited to places under its merchant. A new confirmed branch has editable
branch/address/city/country. The crosshair pans/zooms the existing MapLibre instance;
six keyboard-operable movement/zoom controls and a known-coordinate alternative
are available. No GPS, geocoder, inferred coordinates or automatic confirmation.
Changing fields revokes confirmation. Cancel/Escape performs no storage write.
Shared reused-place details are preserved; editing them requires a distinct,
nonduplicate branch in this slice.

Explicit confirmation changes the existing purchase's place/channel/resolution
through the existing revision-guarded IndexedDB transaction. Purchase/directory
changes are atomic. IDs, products, prices, discounts/zero-net lines, both totals,
timestamp, context, source and evidence remain unchanged. Sequence IDs stay
monotonic; orphan local places are pruned, shared places survive. Duplicate branch
names, exact coordinates or matching addresses under the same merchant are rejected.

Eight-second Undo restores the previous association/directory only while it is the
latest ledger; intervening changes cannot be overwritten. Expired purchase-addition
Undo is not resurrected. Double submissions produce one update. Failed writes keep
old records with visible feedback; cross-tab conflicts retain existing recovery.

All views use the same canonical graph: one pin per confirmed place; **Show place**
explicitly moves the current globe. Confirmation itself issues no camera command.
Reload retains the association while local selection remains transient. Online and
unresolved purchases remain unpinned; fixtures are protected. Existing scanner and
Nearby demo eligibility are unchanged. Envelope v4 accepts `map-selection` provenance;
v1–v3 still validate their historical manual-only records before read-only migration.
No hydration writes or downgrade support are introduced.

## Exact task manifest — 11 files

1. `src/features/local-purchases/purchase-location.ts` — resolution/Undo domain.
2. `src/features/local-purchases/purchase-location.test.ts` — 14 synthetic controls.
3. `src/features/local-purchases/PurchaseLocationReview.tsx` — bilingual review/picker.
4. `src/features/local-purchases/PurchaseLocationReview.module.css` — responsive UI.
5. `src/features/local-purchases/local-directory.ts` — allowlisted map provenance.
6. `src/features/local-purchases/local-purchase-store.ts` — legacy restrictions.
7. `src/features/globe/SpendscapeGlobe.tsx` — transaction/editor/Undo/navigation.
8. `src/features/globe/SpendscapeGlobe.module.css` — retain mounted map under editor.
9. `qa/spendscape-purchase-location.spec.ts` — six production-browser scenarios.
10. `docs/spendscape/COLLEGE_PURCHASE_PLACE_RESOLUTION.md` — this checkpoint/proposals.
11. `docs/AI_HANDOFF.md` — appended section only; all entry bytes preserved.

All changes remain uncommitted. Pre-existing server configuration, handoff sections
and unrelated research are excluded. Exact task-only patch/hashes/preservation/Git:
`artifacts/purchase-place-t4drwbom/{TASK.diff,manifest.json,preservation.json,git-status-final.txt}`.

## QA and actual limitations

Fresh isolated artifacts: `artifacts/purchase-place-t4drwbom/`.

- `unit-final.log`: **103/103**, six guarded files: 14 new controls plus directory,
  storage, session, Unknown-context and final-payable regressions; network disabled.
- `typecheck-final.log`, `focused-typecheck-final.log`: application and strict focused
  unit/browser TypeScript pass; not a claim about every historical QA spec.
- `build-second.log`: isolated current-source production build passes. Root `.next`
  untouched; known extra-lockfile workspace-root warning retained.
- `browser-fourth.log`/JSON: **6/6**, no skips/retries. EN 360 / HE 390 mobile:
  cancellation, double submission, immutable facts, map/pin selection, reload,
  shared reuse, repeated updates, Undo expiry, rollback, conflicts and protected records.
- `directory-regression-second.log/json`: **12/12**, no skips/retries. One-/15-item
  receipts, printed-line errors, discounts, read-only v1/v2 hydration, explicit migration,
  save/delete/Undo, Ask/Replay/search and single-map regression. Projected test copies
  changed only output destinations; historical output was never regenerated.
- EN/HE synthetic form/pin screenshots in `browser-fourth/` inspected. No real receipt
  screenshot, OCR export or receipt-content diagnostic retained.
- Earlier failures retained: browser-first fixture setup; browser-second assertion/
  navigation errors and interrupted run; browser-third **4/6** from incorrect transient
  selection expectations, corrected to association checks in browser-fourth. Initial
  directory **0/12** was sandbox Chrome-launch failure before application execution;
  log/JSON retained separately from authorized successful rerun.
- Whitespace passes including new files. Entry `next-env.d.ts`, protected branch/remote refs and every entry
  file outside the task manifest remain byte-identical; index empty.

## Real purchase status

The real receipt was found as one local purchase with five rows and independent
product/final totals; 42 baseline purchases/12 baseline pins remained. Reopening the
same local origin hydrated it. The actual user Save was not witnessed; direct IDB
export is not claimed because this browser's read-only evaluation lacks that capability.

The user stopped the old private scan server. The tested build now runs at
`http://127.0.0.1:3172` using a credential-free environment, all provider flags absent.
Local capability checks returned `503 / ocr-unavailable` for all three extraction
endpoints. Same-origin reload retained the real purchase and independent totals.
The location form was presented; the agent has not saved a point, changed the
purchase, created a pin or made another extraction request.

The user cannot identify the exact store manually and requests address search.
The purchase therefore remains unresolved/unpinned. Real location-save/reload and
geographic accuracy remain **unverified**. The synthetic QA server is stopped;
provider-disabled 3172 remains available for review. Never reuse a consumed launcher.

## Smallest address-search gate — proposed only

Next authorization: **offline address-search preparation + mock QA** for one opt-in,
server-only Geoapify forward-geocoding boundary. One explicit Search sends only the
user-reviewed address and returns at most five candidates; no keystroke autocomplete,
GPS, reverse lookup, retries or fallback. Candidate addresses/match quality/points
appear on this same map; selection and explicit location confirmation precede the
existing atomic update. A current address match cannot prove occupancy in 2013.

Official [forward-geocoding documentation](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/)
describes address→coordinates, limits and API-key setup; it currently advertises Free
registration without a card and up to 3,000 requests/day. That does not establish
this project's account/quota, accepted privacy/retention/reuse terms or attribution
compliance. Assess these before separate account/credential/provider approval and
one bounded live search. Keep key/query out of client URLs, logs and history; send no
receipt, payment, products or purchase record. Retain only the selected confirmed
place/address and reviewed provenance. No account/key/provider action occurred here.

## Nearby Prices — assessment only

Use a confirmed purchase place as the comparison origin. Current
`nearby-demo/comparison.ts` requires synthetic identities/demo product IDs; genuine
receipts remain excluded. Illustrative savings must remain visibly illustrative.

First prepare offline explicit catalog matching: users confirm product, variant,
package amount/unit per row. Absent barcodes stay unknown; receipt codes are not
GTINs; label similarity is insufficient. Unknown size/currency/match excludes a row.
Show partial coverage and uncovered rows. Compare equivalent quantities/packages and
promotion conditions; never allocate the product-sum/payable difference. Prices on
the 2013 receipt are historical, not current offers.

Potential factual source: [official Shufersal price-transparency publication](https://prices.shufersal.co.il/?sort=Branch&sortdir=ASC),
subject to separately approved retrieval/reuse qualification. Retain source hashes,
retailer/store/product IDs and publication/item-change/fetch times; qualify currency,
units/package and a visible freshness ceiling. Distance is straight-line, not route
or travel time. No current price file/basket intersection was retrieved in this task.

`NEARBY_PRICES_NP1_SCHEMA.md` records this contract; `NEARBY_PRICES_NP2G_QUALIFICATION.md`
still leaves ItemPrice currency unresolved and its old store qualification is not
location evidence for this purchase. `NEARBY_PRICES_NP2V_QUALIFICATION.md` records
Carrefour access/reuse blockers; do not bypass them. Resolve source currency, rights,
freshness and explicit equivalence before current savings claims. Price retrieval,
address lookup and routing remain separate approvals; none is implemented here.

## 2026-10-11 — Review and Geoapify preparation (current)

**Pass for offline preparation; native search remains disabled.** The entry 11-file /
24-hunk proposal matches its reviewed hashes. Review corrections: freeze the form
while a durable write is pending; do not replace newer Back navigation on late
completion; trap focus in both form and map controls (including attribution links).
The durable write still finishes atomically after Back; Back is not transaction Undo.

Explicit address submission sends only the edited address (2–100 characters) and
EN/HE result language through a same-origin POST. No keystroke search. Up to five
validated candidates show address, address-level match and building/street/area
precision. Selecting one previews/proposes a point using the existing mounted map;
it neither confirms nor writes. Street/area/unknown and partial matches require an
explicit map/known-point selection before physical-location confirmation. Even a
building/full-match result is a proposal, not verified store occupancy or 2013 evidence.
Provider points are explicitly rounded to eight decimal places for the existing
coordinate input validator, without a precision/accuracy claim; a realistic high-precision
response and the confirmed stored point are covered by domain and EN/HE browser tests.
Near-zero points use fixed decimal input rather than exponent notation; the same
format is used for the map picker without changing the stored coordinate validator.
Edits revoke confirmation; cancel/address replacement/unmount invalidate pending
search generations. Timeouts/cancellation reject late output; no automatic retry.

Confirmed local places may retain only fixed `addressSearch` provenance:
`provider=geoapify`, allowlisted `precision`, `match=full|partial|unknown`, and
`pointAdjusted` Boolean. Query, candidates, provider IDs/messages/confidence/URLs are
not stored. Existing purchase facts/identity/provenance, independent printed totals,
duplicate checks, orphan cleanup, atomic revisions and eight-second Undo are unchanged.
Legacy v1–v3 reject new provenance before read-only migration; existing v4 records
remain valid. Old builds will reject the new optional v4 metadata; no downgrade support.
Geoapify/OSM attribution appears beside candidates and confirmed place information.

### Provider evidence and restrictions (checked 2026-10-11)

[Official forward-geocoding docs](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/)
specify GET `/v1/geocode/search`, `text`, `lang`, `limit=5`, `format=json`, query
`apiKey`. The prepared server transport uses `bias=countrycode:none` to disable
implicit IP-country prioritization. Key/query occur only in the transient server
request URL, never client URLs/history/logs. JSON responses are bounded to 64 KiB;
client responses to 32 KiB. Unknown result types or non-OpenStreetMap data sources
fail closed pending attribution/reuse review; unsupported/overlong addresses are
not silently truncated. Extra provider fields are dropped and credential echoes rejected.

[Pricing](https://www.geoapify.com/pricing/) lists Free: 3,000 credits/day, up to
5 requests/second, no card required; simple geocoding generally costs one credit.
Quotas are soft. [Terms](https://www.geoapify.com/terms-and-conditions/) permit
suspension or overage charges beyond limits; a Free label is not a hard spending cap.
[Geocoding storage guidance](https://www.geoapify.com/geocoding-api/) permits storing
results subject to terms and required Geoapify/data-source attribution. This slice
stores only the user-confirmed subset, with fixed Geoapify and OSM links; no bulk cache.
[Privacy policy](https://www.geoapify.com/privacy-policy/) describes technical request
retention (body, headers, IP, timestamp), generally successful requests no longer
than 24 hours, with infrastructure subprocessors. This does not promise zero retention
or a fixed failure-retention limit. Address transmission therefore needs user consent.

### Private setup and next bounded approval

No account, key, plan, allowance or live search has been verified. The production
route has **no native transport attached and reads no credential variable**. Even
setting a key cannot activate it. Missing configuration shows disabled feedback;
map/manual/cancel remain available. `SPENDSCAPE_ADDRESS_SEARCH_QA=synthetic` permits
only explicitly fictional local mock results and labels them fictional; not native.

After separate approval:
1. In an existing [Geoapify project](https://myprojects.geoapify.com/), verify Free,
   at least one remaining daily credit, no concurrent use, and no paid/overage plan.
   If there is no account, stop for that separate user decision; none is created here.
2. Use that project's Geoapify key (not Gemini/GCP). A future reviewed user-run launcher
   must accept it by hidden Terminal input in process memory, never chat, a URL,
   shell history, `.env`, `NEXT_PUBLIC_*`, browser storage or logs. It must clear it
   on exit. No native launcher is released in this preparation checkpoint.
3. Prepare/review one fixed durable exclusive reservation and a frozen local-only
   native launcher, fail closed before transmission, no arbitrary path override.
   Do not use a receipt launcher or any consumed reservation. Unknown/hosted modes
   remain disabled. Source/origin/request/credit preflight precedes one user Search.
4. User reviews a commercial address including city/country; do not send a receipt,
   merchant purchase record, products, prices, payment or customer information.
   Only that address, EN/HE language, result bound and the provider key are sent.
5. Propose **APPROVE SPENDSCAPE — ONE GEOAPIFY ADDRESS SEARCH, FREE PLAN ONLY,
   MAX 1 REQUEST / 1 CREDIT, $0, USER-CONFIRMED PLACE ONLY**. Native wrapper activation
   and private setup require that gate; no call is authorized by this checkpoint.
   No retry/fallback/autocomplete/reverse lookup. A failed/uncertain attempt consumes
   the allowance. Expected provider charge is $0 only within verified remaining Free
   credits; the provider's soft quota is not a contractual zero-charge guarantee.

Search proposes a location; saving still requires explicit point/address confirmation.
Current-address accuracy and historical occupancy remain unverified. The real purchase
and its old provider-disabled form on3172 were not modified/reloaded. No location
was saved. Nearby Prices stays deferred under the earlier qualification proposal.

### Combined manifest and evidence

Combined proposal: **20 files**, all uncommitted. The original 11-file scope above
is retained (including unchanged location CSS/browser regression files). Nine added
files: `src/features/local-purchases/address-search.ts`, `address-search.test.ts`,
`AddressSearch.tsx`, `local-structure.ts`; `src/server/address-search-boundary.ts`,
`address-search-boundary.test.ts`, `address-search-local.ts`;
`src/app/api/address-search/route.ts`; `qa/spendscape-address-search.spec.ts`.
Shared exact-object/array checks were moved unchanged to avoid circular dependencies.
Only the two approved location sections are proposed from AI_HANDOFF; prior dirty
receipt validation/configuration/research remains excluded. Exact hashes/hunks and
patch: `artifacts/address-search-mptjgxxk/{manifest.json,PROPOSED.diff}`.

Fresh QA: guarded **144/144** units in eight files; application and strict focused
TypeScript pass; isolated production build passes (known extra-lockfile warning).
Combined production-browser **17/17**, EN360/HE390,430 approximate and1280 pending
write; neighboring directory **12/12** includes one/15-item receipts, migration,
rollback, deletion, zero-net discounts, Undo, canonical views and one map. EN/HE
fictional candidate/form/map screenshots inspected; no real receipt screenshots.
Local synthetic HTTP route confirms fictional capability, valid candidates and
foreign-origin rejection. No geocoding/OCR/LLM request or credential access.

Earlier evidence retained: first units105/106 (undefined mock argument accidentally
selected its default full match); initial strict test Headers typing failures; browser
first16/17 (hidden mobile navigation used at desktop); synthetic route first503 from
Next internal URL/Host mismatch. A later precision browser invocation omitted the old suite’s output variable:
11/11 search tests passed and six location controls were skipped. That incomplete
run is retained and corrected by the final full17/17 invocation; no assertions,
timeouts or safeguards were weakened. A build-command relative-path typo is also
retained separately from the successful final build.
Source/current-build parity and final preservation report accompany the manifest.
Root next-env/index/protected refs and historical evidence/locks remain unchanged.
Initial root TypeScript regenerated only its ignored `tsconfig.tsbuildinfo` cache;
subsequent caches/builds use fresh isolated paths. This is explicitly excluded from
preservation claims. Current task servers stopped; existing provider-disabled3172
and the user's unresolved real purchase/form remain untouched. Vercel paused.

Next gate: review this offline checkpoint, then the bounded native address-search
activation/setup proposal above. Real geographic accuracy/location save/reload and
Nearby Prices are not established by synthetic QA.

Isolated proposed-files verification: HEAD archive + only PROPOSED.diff passed patch
application and144/144 guarded units without historical artifacts. A /private/tmp
build first failed because Turbopack disallows its external node_modules symlink;
that log is retained. The same intended-files tree was copied under the workspace
artifact root (no dependency installation or source change) for the successful
production build. Final source/patch/bundle checks are in the preservation report.

## 2026-10-11 — Authorized one-search native launcher (pre-dispatch)

User authorized one forward-geocoding request/credit, Free only, followed by
user-confirmed location. Project **Spendscape**, active Free, ≥1 remaining daily
credit, no concurrent use and no paid overage billing are **user-reported**.
The key's project is console-confirmed by the user; no metadata/key API is called.
Soft quotas do not establish a hard $0 cap. One unused fixed native run is prepared:
`geoapify-address-validation-20261011-one`. No live search/credential access occurred.
The user's commercial address will be reviewed in the form, not retained in diagnostics.

Private launcher: `qa/address-search-native/{start.mjs,preflight.mjs,freeze.json,
preflight.test.mjs,README.md}`. Exact source/build freeze covers517 files, excludes
runtime caches/traces and hashes the production assets. The launcher verifies HEAD,
branch, empty index, frozen bytes and unused marker. Server repeats byte verification
before reservation. Environment is allowlisted; all OCR/LLM/provider/debug/proxy flags
and keys are excluded. Framework output/telemetry disabled; loopback3172 only.
Source/build live in `artifacts/geoapify-live-8jiueeim/app`; unrelated dirty recovery
server configurations are deliberately excluded from that intended-files build.
Native activation accepts only the literal worktree/build/run; no arbitrary path
or namespace override. A key alone, default/hosted/CI/unknown mode cannot activate it.

Reservation/lifecycle is separate at
`artifacts/geoapify-address-validation-20261011-one/`. Exclusive marker and event
writes are fsynced before fetch; corrupt/uncertain/consumed state fails closed.
Fixed stages: reserved, dispatch-initiated, provider-http, completed, interrupted.
Only bounded elapsedMs, numeric HTTP status and fixed outcomes are recorded;
no query, address, point, candidate, key, provider message or purchase content.
`dispatchInitiations` counts starts, not proof that Geoapify received/processed one.
GET `/api/address-search` is restricted to local origin and exposes only safe status.
Concurrency/restart/cancel/timeout never permit a second fetch; late output cannot
append or persist. Native UI disables a second submit even after editing/reopening.
Queries/results stay transient; only explicit confirmed place saving uses IDB.

Fresh QA: **161/161** guarded unit tests (17 native controls + prior144), **5/5**
launcher tests, application/focused TypeScript pass, isolated production build pass.
Production mock browser **19/19**, no retries/skips: prior17 + native success/failure
consumption controls, EN/HE mobile, preview/confirmation, atomic in-place save/reload,
Undo, shared reuse, duplicate protection and unchanged financial facts. No real
geographic/persistence claim. GET-only native smoke used a synthetic key, confirmed
native/unused and all3 extraction endpoints503; actual reservation remains absent.
Earlier failures retained: initial Turbopack tracing reached unrelated research
symlink; fixed by literal-validated runtime root, with no research/config deletion.
Initial sandbox server/Chrome launch failures retained; authorized isolated QA then
passed. Known multiple-lockfile warning remains. Final native-only hardening does
not change rendered candidate/save behavior; those browser results are reused.

Exact incremental/combined patch, hashes, preservation and Git status:
`artifacts/geoapify-live-8jiueeim/{TASK.diff,manifest.json,PROPOSED.diff,
combined-manifest.json,preservation.json,git-status-final.txt}`. Incremental12 files;
combined27 files (prior20 + native2 + private-launcher5). Existing checkpoint/handoff
bytes retained; earlier dirty receipt handoff excluded from proposed commit patch.
No staging/commit/push/deployment/billing/account/dependency/provider action.
Main refs, entry next-env, unrelated files, historical artifacts and locks preserved.

Private instructions in the launcher README. Loading the new UI clears unsaved
old form edits, not the saved unresolved purchase. The user must explicitly Search,
review candidate precision/map position, adjust approximate results and confirm/save.
Current matching cannot prove historical occupancy. Real request outcome, user
location confirmation, association reload/pin/Show place remain **pending**. No
Nearby Prices integration. Keep Vercel paused; never rerun a consumed launcher.

### User-private launch and form readiness (same authorized run)

The user ran the private launcher. Independently read safe local GET status:
HTTP200, mode native, correct fixed run, available/unused,0 dispatch initiations.
No key read or provider request. The in-app browser had no open tab; a new tab on
same origin3172 hydrated the existing purchase. UI shows1 local purchase,5 rows,
12 baseline pins, no Show place. Original purchase facts are held only transiently
for comparison after confirmation; no receipt/purchase content artifact exported.
The user's submitted commercial address/city/country are now prefilled in the
location form. Both search consent and physical-place confirmation remain unchecked;
no point selected. Browser remains open for user review and explicit one-time Search.
Search, candidate accuracy, user-confirmed association and reload remain pending.

### Authorized search outcome — 2026-10-11

User reports Search submitted once. Independent local durable status: native run
geoapify-address-validation-20261011-one consumed; one dispatch initiation; provider
HTTP200 at1445ms; completed/results at1460ms. Timing is reservation-through-provider/
completion, not isolated geocoding latency. Five candidate suggestions appeared.
None of the displayed street names matches the reviewed submitted street; no exact
store association is established, regardless of provider address-level match labels.
No candidate selected, point confirmed or place saved at this observation. One local
purchase/five rows and12 baseline pins remain; location unresolved. Request allowance
is consumed; no further search/retry authorized. Awaiting user recognition or cancel.
No receipt, key, candidate coordinates or unrestricted provider message retained.
Protected branch/main/remote refs unchanged; Codex-managed turn-diff refs rotated.
19,136 measured outside-manifest entry files unchanged; index empty,next-env unchanged.
Real place save/reload/Show place remains unverified. Nearby Prices deferred.

### User cancellation and same-origin reload — completed

User confirmed none of the five suggestions is independently verified and requested
cancel/unresolved. Agent used Cancel without changes; no candidate/point selected
and no location save. Same purchase remains unresolved, no Show place,12 baseline
pins. Before/after-cancel and after same-origin reload, private DOM comparisons of
merchant, five printed item rows, amount ledger, payment/category context and original
provenance match. One local purchase/same card ID hydrated once before opening details;
no duplicate. Comparisons output booleans only; temporary comparison content released.
No direct IndexedDB export or new place-save/geographic-accuracy claim. Existing
purchase persistence survives reload; location association and Show place remain
unverified because no trustworthy candidate was confirmed. The optional payable
summary test selector was absent; its equality is not additional verification.

Final verdict: bounded native search executed once (HTTP200/results), location
unresolved by explicit user decision. No further search authorized. Next smallest
gate: establish a trustworthy commercial address/point independently, then separately
authorize any further provider request if needed. Nearby Prices remains deferred.
All12 incremental files/13 hunks and cumulative27 files/42 hunks remain uncommitted;
no staging/push/deployment, Vercel unchanged/paused. Source/build freeze not regenerated.
User-owned private launcher may be stopped with Ctrl+C; never rerun consumed launcher.

### Address correction and local integration clarification — 2026-10-11

User corrected the commercial street name previously used in the authorized query:
the name is a person's given name, not the street-type expansion used for that query.
The earlier results establish transport/results only; they do not test the corrected
address or establish accurate store geocoding. User requests local integration only.
Existing prepared implementation already connects the saved purchase location form
to explicit search, bounded candidates, single mounted map preview and confirmed
atomic place saving. No further implementation defect established by this correction.

Agent reopened the same purchase's local form and prefilled the user's corrected
address/city/country transiently. Verified corrected input, no point, unchecked
physical confirmation, consumed-search message and12 baseline pins. No search, save,
new namespace or reservation reset. Unsaved form stays open for review; reload loses
those edits. Corrected address/location accuracy remains unverified; a separately
authorized bounded search is needed. No production-source, deployment or account
change. Current task changes only these checkpoint/handoff appendices. Historical
query outcome and consumed marker preserved, not rewritten as a successful match.
