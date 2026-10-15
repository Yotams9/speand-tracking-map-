# College Milestone 2 — repeat local receipt capture

Offline implementation/QA authorized; entry and unchanged HEAD:
`acc8f12d57eacd9098158bb6a908b50737289c80`, `feature/spendscape-rebuild`.
Latest status: **scanner checkpoint closed at the user’s request**. Real extraction,
editable review, explicit user Save/reload and in-place date correction are verified
for the recorded receipts. Repeated-capture duplicate prevention remains unverified;
this checkpoint is not a full Milestone 2 acceptance pass or a general accuracy claim.
The user now authorizes the scoped local checkpoint commit and Milestone 3 address-
to-pin work. No further Gemini reads. Earlier live instructions below are historical
and consumed/expired; do not rerun their launchers. Vercel remains paused.

## Plan and acceptance

Reuse the successful Gemini JSON request and strict observation/review/save
contracts. Add a separate default-off loopback operational session, durable
bounded reservations and private startup. Ordinary Capture discovers that session
without a per-receipt pilot URL/launcher. Verify fictional transports and isolated
production browsers; retain historical launchers/freezes/consumed locks unchanged.

Acceptance: distinct images in one private session, explicit Read, no retries,
fallback or automatic save; finite request/cost reservations, serial dispatch,
same-image protection, fail-closed restart/journal, cancellation and late-result
rejection. No credential/content persistence or logs. Preserve editable original
observations, strict printed-line checks, independent final payable, explicit
context/merchant/location/timezone/units, IDs, places, Undo, reload, duplicate
protection, empty ordinary users and one MapLibre instance. Real scan → review →
user Save → Purchases → same-origin reload remains the milestone gate.

## Implemented boundary

- `/api/receipt-capture-session`, Node/server-only transport, exact loopback/same
  origin checks, no forwarded remote host/client, default-off and hosted/CI-off.
  Native activation requires the intended project/number, private verified-key
  digest, Prepay confirmation and reviewed pricing. Unknown modes are disabled.
- Existing `structuredRequest`, `STRUCTURED_PROMPT`, model, JSON mode and decoder
  unchanged. No geometry parser, new schema, tools, thinking option or receipt
  reference answer added. Response is proposed observations, not verified facts.
- Startup once per authorized session: 1–10 explicit reads, maximum configured
  estimated ceiling US$0.50, two-hour expiry, at least 60 seconds between
  reservations. The proposed live validation below is restricted to two reads
  and US$0.10. There is no budget refund for failure/cancellation/uncertainty.
- Durable exclusive `session.json` and sequential `request-N.json` under fixed
  `artifacts/receipt-capture-sessions/<32-hex-session-id>/`; no arbitrary path
  override. `wx`, private file modes and fsync precede transmission. Each request
  has the existing allowlisted lifecycle journal. Missing/corrupt/incomplete
  records stop further dispatch, including after restart. No reset/resume bypass.
- Concurrent reservations cannot advance another slot. Identical bytes within
  the session are blocked using a salted image fingerprint; no image bytes are
  retained. This is not semantic duplicate detection across edited images or
  sessions: the existing reviewed purchase duplicate gate remains necessary.
- Native timeout 45 seconds; client 50 seconds. Replacement, discard, background
  cancellation and unmount release the preview/input and reject late results.
  Historical Vision/direct/fictional-client timeout values remain 30/50/15 seconds.
- Any dispatched HTTP/transport/authentication/schema/timeout failure stops the
  session. An uncertain consumed reservation stays blocked. No retry, redirect,
  fallback, countTokens request, separate thinking call or automatic new session.
- JPEG/PNG only, ≤4 MiB, 32–6000 pixels per side, ≤12 million pixels; same existing
  header/client validation. Model output cap 4096 tokens; bounded provider JSON,
  ≤64 KB observations and strict numeric/barcode/array validation unchanged.
- Ordinary local Capture shows the provider disclosure and reserved read count;
  Read waits for readiness. Failure feedback includes only allowlisted code/HTTP
  status. GET provides safe last-attempt diagnostics independently of a lost
  browser response. It contains no receipt text/values or credentials.
- Photos/provider payloads remain in temporary memory only. Explicitly reviewed
  purchase facts alone reach unchanged IndexedDB v4 transactions. Address remains
  draft-only if location is unresolved; no inferred point or new map pin.
- Fictional server transport is in a separate module, requires server QA mode,
  loopback and explicit client query/header. Ordinary/hosted use cannot obtain
  fictional observations by selecting an image. No mock catalog or baseline added.

## Offline evidence (2026-10-11–12)

Fresh isolated candidate/evidence: `artifacts/college-m2-39cf1rhr/`. Candidate
contains entry HEAD plus this scope only; excluded dirty native configuration and
research are absent. Node modules reused, no installation. QA on port 3192 only.

- Focused parser-free request/diagnostics/image/review/storage suite: **189/189**.
- Final complete serial unit suite: **968/968, 48 files** (`unit-final.log`). Prior
  full serial run also 968/968. This does not claim legacy parallel timeout
  variability was fixed; no timeout or financial test was weakened.
- Private launcher/preparation pure mock tests: **5/5** (`launcher-verified.log`).
  Includes count/cost/expiry, complete source/build hashes, symlink rejection,
  private key/project mock matching and absence of inference in startup.
- Application typecheck and focused server/QA strict TypeScript check passed
  (`typecheck-final.log`, `typecheck-focused-verified.log`). This does not claim
  the separately documented repository-wide legacy QA typecheck defect was fixed.
- Isolated production build passed (`build-final.log`); existing multiple-lockfile
  root warning remains. Client chunk scan found no provider endpoint, API-key
  configuration, gcloud or synthetic credential prefix patterns.
- Final new browser coverage: **13/13 across current-state runs**. Twelve checks
  passed in `browser-final.log`; its actual server test stopped before reservation
  because the mock session expired across the date change. A fresh exclusive
  synthetic session passed that test (`browser-repeat-verified.log`, 1/1). Retained
  expired session unchanged. Earlier 10/10 run (`browser-second.log`) also remains.
  Initial sandbox browser-launch failures and one empty-filter run are retained.
- Neighboring production browser suite: **13/13** (`browser-neighbor.log`): zero
  ordinary baseline, unchanged v1–v4 hydration, receipt/manual save, unknown
  context, duplicate checks, Undo, confirmed/shared places, Show place and reload.
- New route's actual fictional wire response → validated observations → review →
  two distinct explicit saves (1 and 15 rows) passed. The second save was undone;
  original records reloaded unchanged; same-image replay sent no further model
  request. Synthetic partial/malformed/discount cases covered by unit regressions.
- Current UI synthetic checks: strict line mismatch blocks; correction enables
  explicit save; line sum/final payable remain independent; duplicate gate blocks
  a second purchase; default QA exclusion; delayed readiness; discard/replacement;
  simulated hidden-document event and late response cleanup; bounded errors.
- Rendered synthetic intake/review inspected at 360/390/430 px EN/HE and 1280 px EN
  (`browser-final/*.png`), readable controls, RTL, no horizontal overflow. No real
  receipt screenshots/video/traces. Owned QA server stopped. Port 3172 untouched.

## Exact task file/hunk boundary

Machine-readable manifest and task-only patch: `artifacts/college-m2-39cf1rhr/manifest.json`
and `TASK.diff`. Handoff includes **only this milestone's appended section**;
all earlier uncommitted handoff sections are excluded from a future commit.

- `docs/AI_HANDOFF.md` — new M2 appended section only.
- `docs/spendscape/COLLEGE_REPEAT_RECEIPT_CAPTURE.md`
- `src/features/receipt-image/ReceiptImageIntake.tsx`
- `src/app/api/receipt-capture-session/route.ts`
- `src/server/receipt-capture-session.ts`
- `src/server/receipt-capture.ts`
- `src/server/receipt-capture-qa.ts`
- `src/server/receipt-capture.test.ts`
- `qa/college-m2.config.ts`
- `qa/spendscape-college-m2.spec.ts`
- `tools/receipt-capture/key-project.mjs`
- `tools/receipt-capture/preparation.mjs`
- `tools/receipt-capture/prepare.mjs`
- `tools/receipt-capture/start.mjs`
- `tools/receipt-capture/preparation.test.mjs`

All remain uncommitted. No package/dependency, persistence schema, financial
validator, provider contract, historical launcher or consumed-lock changes.

## Proposed separately authorized live validation

Exactly two inference requests total in one privately configured session, one per
receipt, one model, no retries or fallback. Failure/uncertain dispatch stops the
session and the remaining request must not be used as a recovery. Use existing
Prepay only; user confirms current positive balance/auto-reload-off and no parallel
key use before activation. No billing, account or permission changes.

Model `gemini-3.8-flash`, POST
`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`.
One inline JPEG/PNG plus unchanged extraction prompt, JSON mode, 4096 output cap.
Transmitted: the whole user-selected approved crop, including visible business
receipt text, and the extraction instruction; no saved purchase/location graph.
Remove payment identifiers and unrelated personal details first. App retains no
photo/raw provider response. Paid-service terms exclude product-improvement use,
but Google may keep input/output temporarily for abuse prevention; app cleanup
is not a promise of zero provider retention. [Official terms](https://ai.google.dev/gemini-api/terms).

Proposed originals (metadata checked locally; originals unchanged, not copied):

| Case | Path under `/Users/testing.user/Downloads/` | Bytes / pixels | SHA256 |
| --- | --- | --- | --- |
| New weighted one-item receipt | `spendscape-receipt-cropped.jpeg` | 227076 / 1378×2048 | `6d61a6ef399da271c3af29e5a2719ce69b9660fee00ac002d5202c159c1669bd` |
| Previously approved five-row receipt, duplicate control | `WhatsApp Image 2026-10-08 at 18.03.31.jpeg` | 211603 / 918×2048 | `f309579ac77c22676d778758c1cc909bb33c0e4ab3fb7a65af180c3876360292` |

Recheck hashes/privacy before any dispatch. These are evaluation candidates only;
no receipt answers/hash-specific selection enter the request. Compare all visible
rows and header/numeric facts locally, classify matched/incorrect/missing/ambiguous,
and record user corrections honestly. Missing currency/units/timezone/context are
explicit review choices, never inferred. First case: user reviews and saves;
verify exactly one addition, original data/places intact, Purchases and same-origin
reload. Second case: confirm reuse of its genuinely matching merchant and known
review facts; verify duplicate gate and do not create a second purchase or choose
“Save separately”. Repeated intake/draft creation plus duplicate prevention is
required; HTTP 200 alone does not pass. Two cases do not establish all layouts or
15-item real accuracy. User alone presses Save; no automatic location confirmation.

Cost checked against [official pricing](https://ai.google.dev/gemini-api/docs/pricing)
on 2026-10-12: standard input US$0.75/M, generated output including thinking
US$3.75/M through 2026-12-31. Conservative input allowance 6240 tokens
(4000 text + 2240 image); generated allowance 8192 (twice the configured output
cap, including thinking). [Image token documentation](https://ai.google.dev/gemini-api/docs/media-resolution)
lists approximately 1120 default Gemini 3 image tokens; allowance doubles that.
Per request: `(6240×0.75 + 8192×3.75)/1e6 = US$0.03540`;
two requests **US$0.07080**, configured ceiling **US$0.10**. Full estimate reserved
before each dispatch. Guards expire at the documented 2027 price change. This
local estimate/limit is not a Cloud Billing hard spending cap, excludes tax/FX,
and cannot control other tools using the key. No funds/auto-reload changes proposed.

## Private startup, only AFTER separate live approval

Prepared isolated production app:
`artifacts/college-m2-39cf1rhr/app` (source/build freeze in its
`artifacts/receipt-capture-prepared.json`). The offline prepare command freezes
existing build bytes; it neither creates a native session nor uses credentials.
Native launcher rejects changed source/build, symlink substitutions, .env files,
unknown options/modes and occupied port. No launcher was run here.

1. Finish/discard any unsaved draft yourself before stopping the old server. A
   restart/reload loses transient drafts, while saved IndexedDB data remains on
   the same browser/origin. Do not rerun consumed launchers.
2. User stops their port-3172 server only when ready. Existing gcloud login must
   already be able to read named API-key metadata/keyString for project 376401338717.
   Launcher privately compares the entered key with `spendscape-benchmark`, prints
   match/project only and stops on denied/mismatched access; no permission change.
3. Run the following zsh subshell privately; never paste the key into chat or a
   command argument. One startup serves both explicit receipt reads:

```zsh
(
  unset GOOGLE_API_KEY GROQ_API_KEY GEMINI_API_KEY
  read -rs 'GEMINI_API_KEY?Existing Gemini API key (hidden): '
  printf '\n'
  export GEMINI_API_KEY
  node "/Users/testing.user/Documents/Codex/2026-08-28/referenced-chatgpt-conversation-this-is-an/work/spendscape-worktree/artifacts/college-m2-39cf1rhr/app/tools/receipt-capture/start.mjs" \
    --provider-session-approved --prepay-ready-confirmed \
    --auto-reload-off-confirmed --requests=2 --ceiling-usd=0.10
)
```

4. Open `http://127.0.0.1:3172/`, Capture → receipt image. No experimental query
   flag is required. Check native mode/unused safe session status before Read.
   Select only each approved crop; click Read once. Keep visible while reading.
   Review/correct, confirm timezone/units/context/merchant, and user Save. Allow
   ≥60 seconds between Reads. Do not restart launcher to bypass a stopped budget.
5. Inspect safe session GET diagnostics if response is lost, then stop without a
   retry. End with Ctrl+C; key/token remain memory-only, journals remain consumed.

Concrete approval proposal:
`APPROVE SPENDSCAPE COLLEGE MILESTONE 2 — TWO LOCAL RECEIPT READS, EXISTING PREPAY,
US$0.10 TOTAL MAX, USER-CONFIRMED SAVE/RELOAD, NO RETRIES`.
Native credentials, real extraction accuracy, this operational path's real
save/reload, and milestone commit remain pending that validation.


## Authorized real validation outcome (2026-10-12)

Authorization: two local reads, existing Prepay, US$0.10 total ceiling, user Save,
no retries. Preflight preserved the 15-file candidate/freeze and both image hashes;
HEAD unchanged. User ran private launcher, reported keyMatch=true/project 376401338717,
limits 2/US$0.10 and zero startup inference. Independent safe GET confirmed native,
available, used=0. The old app had no unsaved review/intake/location form. Reloading
the prepared app showed the saved real purchase once with its existing pin, and
removed the historical 42-fixture presentation without deleting stored records.

Native session: `af2da3b5c2ceebb1e9a55e0de270000c`; durable records remain under
isolated app `artifacts/receipt-capture-sessions/` in the prepared candidate.
One request/reservation consumed. Its salted fingerprint matches the approved
one-item crop hash. Read clicked once through actual Capture. Supported file chooser
completed, but took ~149 seconds despite the bounded requested timeout; avoid
repeating that prolonged automation in future, use manual upload when necessary.
No inference was sent during selection. No retry, fallback or second image sent.

Independent journal/status:

- reserved 0 ms; authentication-start 6 ms; authentication-complete 13 ms;
- dispatch-initiated 27 ms; provider HTTP **200** recorded at 27064 ms;
- parsing-start 27074 ms; failure **ocr-invalid** at 27080 ms;
- status failed/stopped, used=1, max=2, remaining=1 but further dispatch blocked.

Timing is durable-attempt start through memory key authentication, dispatch,
provider HTTP and local response decoding. It excludes private launcher, image
selection, user review/save. It is not isolated OCR latency. Dispatch alone is not
processing proof; the subsequent HTTP response establishes provider response.
Reserved conservative estimate US$0.0354, not an inspected actual charge; token
usage/billing was not inspected. Remaining authorization is not a recovery retry.

No editable draft, field accuracy verdict, user Save or new-purchase reload
verification. Provider response was discarded. The unknown rejection may be at
candidate/finish/part structure, JSON syntax or observation validation; the current
catch collapses all to ocr-invalid. Do not infer a missing field, a barcode problem,
truncation or recognition failure. No parser/schema/request change was made.

UI displayed safe HTTP 200/ocr-invalid feedback. Preview released, intake closed,
no review remained. Purchases count stayed 1, same saved purchase card unchanged
before/after same-origin reload, existing pin count 1, one map canvas, no duplicate.
This verifies preservation of the prior saved purchase, not new scan/save success.
No raw response/text/image/token/credentials/provider message was retained in
new evidence. Safe evidence: `artifacts/college-m2-live-9f3c9fdf/preflight.json`,
`outcome.json`, current manifest/patch and preservation result. Earlier offline
proposal and QA artifacts remain unchanged. User confirmed Ctrl+C shutdown; port 3172 has no listener independently verified.

Next smallest task: offline allowlisted response-rejection diagnostics derived
from the actual decoder predicates (candidate/finish/parts, JSON syntax, strict
observation shape/numeric validation), including truncation category only when
proved by an allowlisted finish reason. Preserve request format and financial
acceptance. Test category distinctions, secret/content exclusion and unchanged
outcomes. Do not reconstruct this discarded response. Any subsequent inference
requires new bounded authorization after that diagnostic checkpoint. No milestone
commit: real repeat capture/save/reload acceptance has not passed.

## Corrected decoder — user Save/reload and updated UI verified (2026-10-13)

User explicitly reports saving the real weighted receipt. Reconnected only after
that confirmation: no editable draft or pending Capture was present. New local
purchase session_purchase_receipt_03 appears once alongside prior receipt_01.
One item; UI checks match printed quantity, unit price, line amount and independent
payable total against the approved crop. Same-origin reload and private transient
card/detail comparisons preserve both purchases. New location remains unresolved,
without a pin; prior receipt_01's confirmed association/Show place and place details
remain intact. One canonical pin and one MapLibre instance. Verification uses
rehydrated UI, not a direct IndexedDB export or geographic-accuracy assessment.

Reviewed artifact hashes checked. Old3172 listener identified by its exact frozen
application cwd, then gracefully stopped after persistence verification. Started
artifacts/receipt-location-ux-jsgglraj/serve-offline.mjs, following LOAD_UPDATED_UI.md,
on the same origin. This is a provider-disabled loader, not an exhausted capture
launcher. New UI reloaded: both purchase/card/detail comparisons and existing place
association still match. Updated optional location form has Advanced coordinates
hidden and confirmation disabled until a point; opened read-only and cancelled
without saving. Capability GETs: receipt ocr-unavailable, address search disabled.
No new extraction, geocoding, reservation, credential or billing action. All protected
history/locks/next-env hashes matched. Temporary receipt text comparisons cleared;
no real screenshot, raw response or financial values retained in new artifacts.

Safe evidence: artifacts/receipt-ui-load-crmkge3q/pre-switch.json / outcome.json.
Updated server remains running (owned tool session70963); app at127.0.0.1:3172,
new receipt details visible. Real corrected-decoder scan → explicit user Save →
Purchases → reload is now verified for this one receipt. Successful repeated real
capture in one operational session remains unverified, so Milestone2 is incomplete
and no milestone commit is created. Future provider activation requires separate
bounded authorization; consumed sessions must not be reused. Vercel remains paused.


## Repeated real validation — prepared 2026-10-13

Current authorization: up to two distinct user-approved original crops in one native
operational session, US$0.10 per request / US$0.20 total, user-only Save, no retry or
fallback. No provider request or new session reservation has been made. Two image
paths and current positive Prepay / auto-reload-off / no-concurrent-use confirmation
are pending; the existing provider-disabled3172 server remains untouched.

Fresh isolated evidence: `artifacts/m2-repeat-live-st_6g4uw/`. The exact cumulative
proposal is `cumulative-manifest.json` / `CUMULATIVE.diff`: 40 files / 73 hunks,
including only appended M2 handoff sections and excluding dirty historical native
configuration/research. `commit-candidate/` contains HEAD plus only this proposal.
It passed 1029/1029 unit tests (52 files) and a fresh production build. Matching
EN/HE browser evidence from `receipt-location-ux-jsgglraj/browser-current.log` (8/8)
is reused because no reviewed application behavior changed. Fresh focused checks:
51/51 session/diagnostic tests, 5/5 launcher tests, application typecheck and tracked
whitespace checks passed. An initial test-executable path typo is retained in
`focused.log`; corrected command passed in `focused-rerun.log`.

The candidate's new source/build freeze covers187 source /232 build files. Existing
45 protected file hashes, main refs, entry next-env.d.ts and empty index verified.
Successful request/prompt/JSON mode and strict financial acceptance remain unchanged.
Current official pricing checked2026-10-13: US$0.75/M input and US$3.75/M output,
including thinking, through2026-12-31. Conservative allowances6240 input +8192
generated per request imply US$0.0354/read, US$0.0708/two. Default image tokens1120;
2240 budgeted. Sources: [pricing](https://ai.google.dev/gemini-api/docs/pricing),
[media tokens](https://ai.google.dev/gemini-api/docs/media-resolution). This is an
estimate, not an observed bill; launch/contract guards require re-review in2027.

Runtime source changes in this preparation: none. Documentation changes: this
checkpoint (current status + appended section) and only an appended AI_HANDOFF
section. Frozen candidate, manifest, logs and content-free results are isolated
artifacts, not provider evidence. No image, OCR text, financial values or credentials
are retained in these artifacts. The user session launcher will establish a fresh
exclusive reservation after private key/project verification; no old launcher is
reused. Milestone completion remains gated on two real reads, user saves, unchanged
prior purchases/pin, no duplicates and same-origin reload.


## Revised real acceptance — same original and duplicate prevention (2026-10-13)

The user explicitly replaces the second distinct-unsaved-receipt requirement with
one approved original Read → editable review → user-only Save → persistence, then
repeat Capture of the same original without server restart/key re-entry. A duplicate
check before provider dispatch is a successful protection outcome; do not bypass it,
force separate purchase or consume an unused request. Maximum two requests remains
US$0.10/read /US$0.20 total; no additional budget/requests granted. Two-distinct-real
receipt accuracy remains unverified even if the revised milestone passes.

Approved original: WhatsApp Image2026-10-05 at23.38.04.jpeg; SHA256
aa40404b602ccc38e3f16d75bf30472fc12afc1c69d2a217e869cb6b7376ef46 verified again.
The generated fictional QA receipt stays in isolated offline QA, never in ordinary
user purchase history or real validation. Current Prepay positive/auto-reload off/
no concurrent use confirmed by the user. Private key/project verification remains
in the user-run launcher, not performed by Codex.

The fresh frozen candidate is unchanged and verified. Existing baseline: two saved
purchases unchanged by private transient UI comparisons, one confirmed pin, one
MapLibre canvas, no unsaved draft/intake. Safely stopped owned provider-disabled
server70963; provided the prepared private launcher for same-origin3172. Native
mode/new unused session and live read are pending. No provider call or completion
commit yet. Existing51 focused/5 launcher/1029 isolated units/build/typecheck and
8 matching browser checks cover unchanged runtime; no rerun needed for this scope
revision. Local source changes in this revision: only this checkpoint append and
AI_HANDOFF append. Final exact cumulative manifest will be refreshed after actual
real outcomes, before any conditional completion commit.


## Revised native validation — real draft, user review pending (2026-10-13)

Fresh operational session e8bdbeb175a287666ea0810d53cb36cb is native, max2 /
US$0.20ceiling. User selected the approved short original; its reserved salted
fingerprint matches the approved hash. Codex pressed Read once. Exactly one native
request: HTTP200, strict observation decoding passed, editable draft visible with
one row; image preview released. Durable independent journal: authentication-start8ms,
complete14ms, dispatch32ms, HTTP7144ms, parsing-start7153ms/complete7161ms,
review-response-complete7167ms from reservation. This includes authentication/request/
decoding/preparation, not isolated model latency. Reserved estimateUS$0.0354; actual
billed amount not inspected. One allowance remains; no retry or second dispatch.

Actual visible remaining blockers: payment, category, date, merchantCategory, unit-0.
No field-accuracy verdict or save/reload claimed yet. Automatic approval rejected
bulk receipt-value retention in an inspection variable; subsequent content-free
accuracy comparison was blocked because re-access to the unsaved real draft could
reload/reconnect and lose it. Neither was bypassed. Structural checks completed;
user guided to review in the current tab and explicitly Save. No screenshots/raw
receipt/provider response/credential retained in diagnostic artifacts. Await user
Save before safe persistence/reload inspection, then same-image repeat.


## College two-digit date policy + address flow — offline verified (2026-10-13)

User explicitly authorizes DD/MM/YY /DD-MM-YY college years00–99 →2000–2099;
30-09-26 at15:47 now prefills2026-09-30T15:47 in the new candidate. Four-digit
years/calendar/timezone/financial validation and original observations preserved;
policy visible in EN/HE. Unsupported/ambiguous/invalid fields require review.
Existing optional after-Save reviewed-address/search/map/explicit-pin flow reused
and reverified, no new geocoding. Current open old frozen draft/server untouched;
agent fill remains auto-review blocked due reconnect risk. User confirmed2026 and
was guided to enter/confirm it then explicitly Save. No new provider call.

Checkpoint COLLEGE_RECEIPT_DATE_POLICY.md; exact incremental9files in
artifacts/receipt-date-policy-ux3av7zs/manifest.json /TASK.diff. Focused212 units;
isolated1049/1049, typecheck/QA typecheck/build, final9/9 browser checks and EN/HE
render inspection pass. RTL range ordering corrected.45 protected hashes/current
consumed session/main refs/index/next-env preserved. Only isolated3195 stopped.
Current real Save/reload/repeat guard and new real pin remain unverified; milestone
incomplete/no commit. Separate geocoding activation/submission approval required.


## Saved short receipt time correction — user correction pending (2026-10-13)

User reports Saved; actual3 purchases, targetreceipt_04 one row/payable match, prior
01/03 unchanged/pin1. Old cardOct30; tested new saved-time UI independently reveals
storedUTC2026-10-30T07:26Z (09:26 Asia/Jerusalem), not the confirmedSep30 15:47.
New narrow date-only editor reuses strict resolver/canonical validation/revision
transaction; sameID/products/financial/context/place/provenance remain intact, with
date-linked bookkeeping timestamps updated consistently. No extraction/recreation.

QA artifacts/purchase-time-fix-xyju3gq7/:1063 units, app/QA TS/build,5 new +9
neighbor browser checks/renders pass; earlier setup/type/timing failures retained.
Checkpoint COLLEGE_PURCHASE_TIME_CORRECTION.md /11-file incremental manifest.
Safely replaced exact expired native child with provider-disabled same-origin build
after no draft verified. User's intended date/time proposal verified, not saved yet;
auto-review blocks unsaved editor reconnection, so user guided to confirm/save.
Corrected persistence pending. Original session expired1used/1unused unchanged;
real repeat guard unverified. No new provider calls/commit/milestone-ready claim.


## User-confirmed correction and real reload verified (2026-10-13)

The user pressed Confirm and save date correction and replied "date corrected".
DOM inspection independently showed the form closed and stored timestamp
2026-09-30T12:47:00.000Z, corresponding to 30 September 2026 at 15:47 in
Asia/Jerusalem. Same-origin reload and reopening the purchase preserved this
instant. session_purchase_receipt_04 remains the same record; the temporary
non-date detail digest matched before and after reload (merchant, location,
context, products, amounts, final payable and provenance). Exactly three distinct
purchase cards and one canonical pin remain. The two older rendered cards matched
the pre-correction baselines, and Show place retained the existing confirmed place.
These are UI/rehydration checks, not a retained database export. Temporary comparison
content was cleared; no receipt screenshot, raw extraction or provider request was
created. The corrected purchase is left open on the provider-disabled local server.

Corrected real Save/reload now passes. Milestone 2 remains incomplete: same-session
repeat capture/duplicate prevention was not exercised before the native session
expired. Its one consumed request and unused expired slot remain unchanged. No
milestone commit, launcher reuse or further extraction is authorized by this check.


## Scanner checkpoint closed — 2026-10-13

Latest user instruction stops further scanner validation and authorizes a scoped
local checkpoint commit despite the explicit incomplete repeat-capture criterion.
Verified real results: corrected multipart decoder produced a weighted editable
draft, user Save/reload preserved receipt_03; subsequent short-receipt Read produced
a draft, user Save preserved receipt_04; user-confirmed date correction and reload
now retain 30 September2026 15:47 Asia/Jerusalem. Three saved purchases and the
existing confirmed place/pin remain unchanged by that correction. Original facts,
printed product amounts and independent final payable are preserved. HTTP success,
field review, user Save and reload are distinct evidence; broad receipt accuracy
is not established. Repeat Capture of the same real image in one native session
and its duplicate guard were NOT exercised before expiry, and remain UNVERIFIED.
No full Milestone2-ready claim; no further Gemini reads. Historical failures, used
reservations and unused blocked/expired allowances remain byte-identical.

Exact cumulative scope:51 files, only the M2 appended handoff sections, in
artifacts/scanner-close-ucxk2sek/manifest.json and PROPOSED.diff. All latest source
hashes matched recorded incremental proposals. Reuse final1063/1063 unit, app/focused
QA TS/build,5 date-correction +9 neighboring production-browser checks and EN/HE
render evidence where source hashes match. Fresh intended-files checks are recorded
in that artifact; historical setup/timing/strict-legacy-QA caveats are not erased.
Unrelated recovery configuration/research and earlier dirty handoff stay excluded.

Next authorized milestone: saved-purchase reviewed address → one bounded Free
Geoapify search → proposed map point → user-only confirmation → atomic same-ID
place update → one canonical pin → View place/reload. Uncertainty stays unresolved.
Nearby Prices and publication remain deferred. No new extraction authorization.

Fresh intended-files checkout:1063/1063 units across53files, application typecheck
and5/5 launcher tests pass; runtime source hashes exactly match the last tested
production build, so matching build/14 browser evidence is reused. Scope51files/
88hunks, no staged unrelated sections. Retained initial workspace-cwd run:1106pass/
2fail among1108, both unrelated untracked direct-image research tests (native-run
capability/historical freeze assertion); not repaired or included. The first isolated
command also had a relative executable-path typo, retained before successful rerun.
These do not establish a clean full dirty-workspace test suite.
