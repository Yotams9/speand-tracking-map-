# Hosted reviewed address → confirmed pin — 2026-10-16

Base: integration/final 30410437dbd13d70095cbf75fe259f62618aafe6.

The user requested a pin from the street printed on the receipt. The existing receipt flow prefills merchant/address for review, saves the purchase first, then transfers those temporary fields to its location form. A text address is not a coordinate; a suggested point remains unconfirmed until the user explicitly confirms it. The Channel selector does not create a point.

Ported the existing hosted Geoapify adapter and the request-authorization hook from c3c49c8. The existing address UI, provider request, result validation, precision checks, map preview, explicit location confirmation and durable update path remain unchanged. The route uses hosted mode on Vercel and keeps the existing loopback handler locally.

A dedicated address quota uses `SPENDSCAPE_ADDRESS_RELEASE_ID`, `SPENDSCAPE_ADDRESS_START_AT`, `SPENDSCAPE_ADDRESS_EXPIRES_AT` and `SPENDSCAPE_ADDRESS_REQUEST_LIMIT`. Its receipt limit and paid ceiling are both zero. Other policy identity/origin fields remain those already configured for the presentation. The dedicated Redis release must be explicitly initialized; runtime does not create/reset it. The receipt namespace, counters, history, limits, budget and expiry are not changed. Missing address activation fields keep the service disabled.

Verification: application typecheck, production build and whitespace check passed. An isolated synthetic contract check verified default-off, a separate address namespace, unchanged receipt-policy hash, strict address/language-only input, reservation before provider dispatch, bounded candidates, duplicate/cap rejection, and no automatic selection/save. Two mocked searches ran; no live provider calls, account changes, activation, quota initialization/reset or deployment occurred in preparation.

Next approval: publish this scoped fix and activate up to two user-triggered Geoapify searches until the original presentation expiry, only after current user confirmation that project Spendscape has active Free, at least two remaining forward-geocoding credits, no concurrent use and no paid overage. Reuse the already configured key and existing Free Redis resource. Only the user's reviewed address and result language are sent. Each search requires the existing in-form consent and Search action; pin saving requires separate explicit location confirmation.

Presentation workflow: finish/save the receipt; choose Optional: address search and confirm a pin; review the prefilled address including city/country; approve sending it and Search; select a recognized candidate for map preview; adjust if required, use the map point, check confirmation and Confirm and save place. Reuse an existing place when appropriate. No new purchase is created. Do not reload an unsaved receipt draft to load this backend-only activation.

## 2026-10-16 — reviewed city/country search correction (local)

A user reported an address suggestion in a different city. Source inspection established that the deployed form submitted only its reviewed-address field: the separate reviewed city/country fields were omitted. The provider's precise ranking/rejection reason was not retained or established. No result was confirmed by this correction.

The local fix composes the explicit street/address, city and country for the existing bounded address-only request, avoids duplicate comma-separated context, and displays the complete query before consent. Editing any of those fields clears candidate results and consent. Editing a selected search proposal's address context also clears its coordinates/provenance and confirmation; no stale search point can be saved after that edit. Manual/map selection remains available without another provider search.

Verification: 21 focused unit tests, five production-browser checks (including EN/HE submissions, city/country edit invalidation, confirmed save/reload/Undo and partial-point behavior), application typecheck, production build and whitespace checks passed. Providers were mocked. No actual provider search, receipt read, quota reset, real-ledger edit or live-form reload occurred. The two previously authorized searches remain consumed as shown in the user's screenshot; the original receipt quota and expiry are unchanged. This checkpoint does not authorize additional searches or publication of this fix.
