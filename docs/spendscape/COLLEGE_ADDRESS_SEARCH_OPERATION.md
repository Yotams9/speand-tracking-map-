# Milestone 5 slice 2 — operational local address search

15 October 2026. Base d88e4f27b2df12bd5f2af0ab6a9aae37fde48c3a,
feature/spendscape-rebuild. This slice implements and tests offline startup and
bounded address sessions. It authorizes no live Geoapify request. Scanner remains
closed; no receipt request/decoder/prompt or financial acceptance rule changes.

## Operational boundary

New tools/address-search startup is separate from every consumed validation run.
Choose an explicit 1–10 request limit and 5–120 minute expiry; there is no default
live allowance. A key alone cannot activate search. A fresh random session's
exclusive, fsynced policy and per-request records live in the prepared app's
artifacts/address-search-sessions/. Keep those records; do not reset or edit them.
Same-session restart cannot refill consumed requests. An incomplete reservation
fails closed as busy/interrupted; a provider, transport, malformed-result or
cancellation error stops the remaining session. No automatic retry or fallback.
Successful no-results consumes one slot and permits a later deliberate search.
Expiry is checked before reservation and before dispatch. No path/run override.

Only Search my reviewed address sends the bounded reviewed address and result
language to the existing Geoapify forward endpoint. No autocomplete, reverse,
GPS, extra provider or hidden extraction call. Local status GETs contain no query
and consume no provider credits. The UI shows remaining searches/expiry and
clear limit/expired/unavailable/stopped feedback. A random submission identifier
prevents a repeated submission from consuming another slot; simultaneous requests
compete for one exclusive reservation. Errors/uncertain dispatch never reset it.
Durable dispatch initiation is not proof of provider receipt or processing.

Existing candidate normalization, up-to-five suggestions, precision/attribution,
same MapLibre preview, optional Advanced coordinates, explicit physical-location
confirmation, atomic same-purchase saving, shared-place reuse and Undo are retained.
Current geocoding is not proof of historical merchant occupancy. An uncertain
location can remain unresolved without a pin. Search never saves a place itself.

The child environment allows only necessary runtime variables and address-session
flags/key. OCR/LLM activations, debug/proxy variables and unrelated keys are not
inherited. .env files in the prepared root are rejected. Keys remain in server
memory only; framework output is suppressed. No key appears in browser code,
UI URLs, logs or purchase exports. No addresses, candidates or coordinates are
written to session journals. Journals contain only fixed stages/outcomes, bounded
HTTP/timing/count metadata and a salted random-submission digest. Validated place
facts persist only when the user explicitly confirms and saves through IndexedDB.
The existing provider-side URL authentication remains unchanged and server-only.

## Safe startup and first backup — no key or provider needed

1. In the existing browser tab, finish and save any form, or explicitly cancel it.
   A reload loses unsaved forms, receipt drafts and temporary matches. Never stop
   an active draft to load this update. No existing application tab was available
   for inspection in this task; this is not proof that another browser has none.
2. Stop the old server with Ctrl+C only after the form check. Never rerun a
   consumed validation launcher. Keep the same browser profile and origin:
   http://127.0.0.1:3172/. Do not clear site data.
3. Use the prepared HEAD-only updated build at
   artifacts/college-address-session-nv_xmrd_/app. It includes the committed backup
   UI and only this slice's intended changes, not unrelated dirty research.
   Its production build and source freeze are tested. Start it without a key:

   ```sh
   node "/Users/testing.user/Documents/Codex/2026-08-28/referenced-chatgpt-conversation-this-is-an/work/spendscape-worktree/artifacts/college-address-session-nv_xmrd_/app/tools/address-search/start.mjs" --offline
   ```

   If origin-in-use appears, stop: do not start another server or change ports to
   find your ledger. A changed host/port/profile is a different storage boundary.
4. Reload the same origin after startup. Check your saved purchases and places.
   Open the shield button, On-device data & privacy → Download JSON backup. The browser
   downloads a private unencrypted JSON file. Keep it somewhere safe. No upload or
   cloud sync occurs. This task did not create a backup of your real ledger.
5. Do not restore into your occupied real ledger or delete it to test restoration.
   Restore inspection/preview is harmless; actual restore requires an empty
   destination, explicit confirmation and full validation. See
   COLLEGE_PURCHASE_BACKUP.md for limits and validation behavior.

For a new source-only local build, use an isolated committed checkout, install
already-declared dependencies, build with providers disabled, then run
node tools/address-search/prepare.mjs --freeze-built-app once. That offline
preparation hashes src/public/launcher/runtime configuration and .next; it reads
no key, creates no live reservation and makes no provider request. Changing the
prepared source/build invalidates startup; preserve previous freezes and prepare
a new isolated build instead of modifying consumed or historical evidence.

## Separate live activation proposal — NOT authorized here

Propose at most TWO explicit forward searches / TWO credits in ONE 30-minute
session for user-reviewed addresses of saved purchases. Only address/result
language go to Geoapify; no receipt, products, payment or private map position.
Use existing project Spendscape only after the user verifies the exact key's
project, active Free plan, at least two remaining credits, no concurrent usage
and no paid overage. Never send a key in chat. Stop if any fact is unknown.

Official documentation checked 15 October 2026:
[forward API](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/)
(one forward request = one credit; existing GET text/lang/limit=5 JSON contract),
[pricing](https://www.geoapify.com/pricing/) (Free advertises 3,000 credits/day,
5 requests/second, required attribution and soft quotas). The local request limit
is hard for this session; the provider's soft allowance is not a hard spending
cap. Expected provider charge is $0 only under confirmed applicable Free usage.
No purchase, plan/account change or paid fallback is permitted.

Only AFTER the separate live/session approval, privately run in zsh:

```sh
(
  unset GEOAPIFY_API_KEY GEMINI_API_KEY GOOGLE_API_KEY GROQ_API_KEY
  read -rs 'GEOAPIFY_API_KEY?Existing Geoapify key (hidden): '
  printf '\n'
  export GEOAPIFY_API_KEY
  node "/Users/testing.user/Documents/Codex/2026-08-28/referenced-chatgpt-conversation-this-is-an/work/spendscape-worktree/artifacts/college-address-session-nv_xmrd_/app/tools/address-search/start.mjs" \
    --address-session-approved --requests=2 --expires-minutes=30 \
    --key-project-confirmed --free-plan-confirmed --remaining-credits-confirmed \
    --no-concurrent-use-confirmed --no-paid-overage-confirmed
)
```

Do not run both offline and live servers simultaneously. Starting a new live
session creates a new allowance and requires its own authorization; never restart
the launcher to bypass an exhausted or stopped session. This proposal does not
reactivate Gemini. User alone reviews candidates/point and confirms place saving.
Future real-session acceptance must separately verify actual request count,
location confirmation, same-ID financial preservation, one canonical pin, Show
place and same-origin reload. Synthetic QA below is not live geographic proof.

## QA and exact scope

Evidence: artifacts/college-address-session-nv_xmrd_/; final results recorded below.
The candidate is HEAD plus only intended source/QA, with no ignored history as a
test dependency. Synthetic ledger and profiles use isolated port 3197; the real
ledger is never imported/exported or changed. No provider API calls, credentials
access, deployment or scanner retesting. Existing tile requests remain unchanged.
All historical reservations, protected refs, next-env.d.ts and unrelated work
are preserved. Exact file/hunk hashes: manifest.json and PROPOSED.diff there.


## Verified offline results

- 122/122 focused tests across eight files, including session policy/lifecycle,
  legacy native runs, transport/input restrictions, directory/location, storage
  and backup controls (unit-final.log). No scanner retesting.
- Four launcher tests pass (launcher-final.log): exact flags, bounds, child
  environment isolation, source/build drift/symlinks and actual executable safe
  argument rejection. Actual prepare entry ran with zero provider requests. Actual --offline startup
  was tested on unused port 3172, then stopped: root HTTP 200; address search and
  all four receipt capability endpoints 503/disabled. No browser or ledger access.
  Prepared hashes still match after startup (offline-http-check.json).
- Application typecheck, focused QA/unit TypeScript and production build pass
  (typecheck-final.log, qa-typecheck-final.log, build-verified.log).
- 18/18 production-browser scenarios pass (browser-initial.log, 51.5 seconds):
  four session viewports 360/390/430/1280 including EN/HE, two deliberate mocked
  searches, no request on edits, required consent, remaining/limit/expiry/error
  messages, distinct submission IDs, proposal-only preview, explicit saving,
  unchanged purchase financial facts, same-origin reload, one map/canonical pin,
  shared-place reuse, Undo, no-results/quota/malformed/timeouts, cancellation,
  stale responses, pending writes and historical one-shot UI behavior.
- Final 360 EN/390 HE session-limit screens visually inspected. No overflow;
  readable precision, attribution, stop messages, preview and save controls.
- Previous failures retained: an early timing-based cancellation test aborted
  before dispatch (correct fail-closed behavior); test now waits for dispatch
  before aborting. Final server-only expiry recheck after journal fsync is covered
  by an additional focused test; unchanged client/browser evidence is reused.
  Focused QA TypeScript found a widened synthetic literal;
  corrected to version:1, without weakening types. Working-directory mistakes in preparation helpers were corrected with prior
  evidence retained. Initial QA server sandbox
  bind was rejected before app startup; approved loopback-only rerun succeeded.

Exact 16-file scope: README.md; docs/AI_HANDOFF.md (this slice append only);
docs/spendscape/COLLEGE_FINAL_MILESTONES.md (append only);
docs/spendscape/COLLEGE_SUBMISSION_READINESS.md (append only); this checkpoint;
src/server/address-search-local.ts; src/server/address-search-session.ts;
src/server/address-search-session.test.ts;
src/features/local-purchases/AddressSearch.tsx;
src/features/local-purchases/address-search.ts;
tools/address-search/{prepare,preparation,preparation.test,start}.mjs;
qa/address-session.config.ts; qa/spendscape-address-session.spec.ts.
No change to location/domain/storage rules, successful receipt request or historical
launchers/mappings. Unrelated research and earlier handoff edits stay excluded.

**Slice verdict: operational startup and synthetic QA ready; live session unverified.**
No full Milestone 5 or live geographic-accuracy claim. Remaining gates: a separately
authorized current-Free bounded live address session if desired, fresh price
collection if needed, physical-mobile/submission checks. Scanner stays closed with
real repeated-capture duplicate prevention unverified. City-based comparison stays
completed; radius/distances remain deferred. Vercel paused; no push/deployment.
