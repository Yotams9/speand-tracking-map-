# One local Geoapify search — user execution only

Fixed run `geoapify-address-validation-20261011-one`; project **Spendscape**
is user-console-confirmed, not independently verified through a metadata API.
No key verification request is sent. Native execution requires every launcher
confirmation and the exact frozen source/build. Unknown runs, hosted/CI and a
key alone remain disabled. OCR/LLM flags/credentials are absent from the server.

## Private setup

Use https://myprojects.geoapify.com/ → the intended project → API Keys.
If needed, the user may register a Free account and create their own project;
this launcher never changes accounts, plans, billing or permissions. Do not use
playground Try, which would be an additional request. Verify the exact key's
project, active Free plan, at least one remaining daily geocoding credit, no
concurrent use and no paid overage billing. Do not paste the key into chat.

Official Free allowance is 3,000 credits/day; a simple forward geocoding request
uses one credit. Quotas are soft, not a hard zero-charge safeguard. The local
exclusive marker limits this run to one dispatch initiation, including uncertain
outcomes. Expected charge is $0 only within confirmed applicable Free allowance.
Sources: https://www.geoapify.com/pricing/ and
https://www.geoapify.com/terms-and-conditions/ (checked 2026-10-11).

The previous unsaved location form's edits will disappear when the new build
loads. The saved unresolved purchase remains in the same browser/origin3172.
Stop the old server if one still owns that port. Never rerun a receipt launcher.

Run in zsh; input is hidden and exists only in process memory:

```zsh
(
  unset GEOAPIFY_API_KEY
  read -rs 'GEOAPIFY_API_KEY?Paste Geoapify key (hidden): '
  printf '\n'
  export GEOAPIFY_API_KEY
  node "/Users/testing.user/Documents/Codex/2026-08-28/referenced-chatgpt-conversation-this-is-an/work/spendscape-worktree/qa/address-search-native/start.mjs" \
    --one-search --key-project-confirmed --free-plan-confirmed \
    --remaining-credit-confirmed --no-concurrent-use-confirmed \
    --no-paid-overage-confirmed
)
```

The launcher starts loopback3172 only; it never searches by itself. Do not restart
it after a search. GET `/api/address-search` returns restricted safe native/unused
or consumed status; it performs no provider request. Verify native/unused before
Search. The private key, proxy/debug/provider flags and framework output are not
printed or persisted. A server failure prints only a fixed failure code.

## User Search and Save

Open the saved purchase → Confirm or change purchase place → new confirmed
branch. Review/correct the commercial address, including city/country. Only that
address and EN/HE result language are transmitted as address data. Technical
parameters are limit5, JSON format, no IP-country bias and server-only API key.
No receipt, payment, products or purchase ID is sent.

Consent and press Search once. No automatic retry, autocomplete, reverse lookup,
fallback or second request. Errors/timeouts/cancellation consume the reservation.
Candidates/queries remain transient; diagnostics retain only stage, elapsed time,
HTTP status and fixed outcome. Dispatch initiation is not proof of provider
receipt/processing; received HTTP status is separate.

Select a suggestion only to preview/propose it on the existing map. Street/area,
partial or unknown matches need explicit map/known-point adjustment. Verify the
actual store point/address, branch/city/country; explicitly confirm and press
Confirm and save place yourself. A current match does not prove 2013 occupancy.
If uncertain, cancel and leave the purchase unresolved. Only the selected,
confirmed place/provenance is persisted atomically; no other purchase facts change.
Geoapify/OpenStreetMap attribution is retained. No Nearby Prices connection.
