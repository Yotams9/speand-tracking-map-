# Milestone 2 receipt/location UX — offline correction

2026-10-13; feature/spendscape-rebuild; HEAD acc8f12d57eacd9098158bb6a908b50737289c80.
Offline implementation/QA passes. Milestone2 remains incomplete. No provider call,
credential access, commit, deployment, or interaction with the open real draft.

## Receipt first, optional location second

Receipt review starts with the supported editable observations and the previously
requested, visibly labeled Israel defaults. Original observations stay separate.
Known currencies, ambiguous/missing facts, date/time and unit validation are intact.

The default unresolved channel is saveable without a place, coordinates or pin.
A visible "Keep location unresolved · no pin" action also removes pending inline
place requirements while preserving the merchant choice. Receipt review no longer
exposes empty branch/city/country/coordinate forms or requires creating a place.
Existing confirmed-place selection remains explicit. Units, payment and categories
remain user choices; Unknown context is supported, not assumed automatically.

After durable explicit Save, an optional success action opens the existing saved-
purchase address-search/map-confirmation form. Reviewed merchant name/address are
carried directly in temporary memory: no receipt/photo/provider payload retention,
URL/history fields or storage additions. The location form is not mounted until
that explicit action. No search occurs without the existing address consent/Submit.
Default provider capability remains disabled; real geocoding needs separate approval.

City/country are suggestions only for the narrow literal "street, city, Israel"
or "street, city, ישראל" comma-separated address layout. City must contain letters,
spaces or conservative punctuation, no numbers/subaddress segments. Country is
suggested only when explicitly printed as a supported final segment. Unsegmented
addresses, unknown countries and competing/subaddress structure remain unresolved;
there is no inference from language, currency, merchant or Israel timezone defaults.
User can correct all proposals. No coordinates/IDs/merchant matching are inferred.

Search proposals preview on the existing mounted MapLibre instance. Map direction
buttons remain accessible; optional known coordinates are under a closed Advanced
section. Confirmation is unavailable until a point is proposed/selected, and
missing-point feedback directs to the map instead of forcing coordinate entry.
Approximate search matches retain the existing adjustment gate. A current address
match never proves historical store occupancy. Cancel clears the temporary handoff
and leaves the saved purchase unresolved; reopening later does not reconstruct an
unsaved receipt address.

Confirmed location uses the existing atomic IndexedDB update of the same purchase,
revision guard, duplicate-place protections, Undo and canonical graph. Products,
prices, discounts, date/context and independent final payable are unchanged. Only
explicit confirmed places produce pins. One MapLibre instance remains mounted.

Review summary reacts to valid currency/context selections. Unsupported currency
keeps monetary values unresolved; selecting a valid currency shows printed product
sum and final payable independently, with a nonblocking difference notice. No
financial acceptance rule, request/model/prompt/JSON mode/decoder/schema change.

## Actual offline evidence

Fresh isolated candidate: artifacts/receipt-location-ux-jsgglraj/app.
No ignored native reservations or unrelated research needed by new tests.

- Focused unit139/139; complete isolated serial1029/1029 across52files.
- Application and focused QA TypeScript pass; production build passes, existing
  multiple-lockfile root warning retained. Legacy broader QA/timer caveats unchanged.
- Final synthetic production-browser8/8 in15.7s: EN360/HE390, missing facts430,
  Undo1280; editable prefill, no-coordinate save, live summary recomputation,
  strict per-line correction, independent totals, duplicates, explicit Save/reload,
  optional address/map handoff, one confirmed pin, Show place, same purchase/financial
  data after reload, cancellation/seed disposal, honest disabled search, no auto-save,
  and durable-save failure retaining the draft without a location action.
- Provider endpoints forbidden in automation. Geocoder results are explicitly
  fictional mocked local responses; no geographic accuracy or real search claimed.
- Actual isolated capability GETs returned address-search disabled/ocr-unavailable.
- EN/HE synthetic renders inspected; no real receipt screenshot/text captured.
  Initial storage-error test hit multiple status elements; locator was narrowed
  to the actual failure feedback and earlier failure evidence retained.
- App3172/open real draft untouched: no reconnect, reload, server restart or data
  mutation. Only owned3195 mock server was stopped. Historical reservations/evidence,
  protected refs/index, preceding handoff and exact next-env.d.ts bytes preserved.

## Load updated UI safely

Do not load it over the unsaved current draft. In the old UI, choose unresolved
location to drop pending place/coordinate requirements; complete and review the
remaining required facts/context, then only the user presses Save. Alternatively,
the user may deliberately discard the draft, understanding it cannot be rebuilt
from checkpoints or an exhausted launcher. No extraction rerun is authorized.

After explicit Save or explicit discard, stop the old server with Ctrl+C. The
new artifact's LOAD_UPDATED_UI.md gives a provider-disabled launcher for the tested
build on the same3172 origin. Saved structured purchases remain in this browser's
IndexedDB; unsaved transient data is lost when loading new UI. No photo retention
or cloud synchronization is introduced. Existing consumed provider launchers must
not be rerun. New receipt reads/searches require separately approved activation.

## Exact incremental changed-file manifest

Task-entry working state is the baseline. Prior M2/diagnostic/default changes and
unrelated work are preserved outside this incremental patch. All uncommitted.

1. src/features/capture/PurchaseReview.tsx
2. src/features/capture/MerchantPlaceReview.tsx
3. src/features/capture/CaptureExperience.tsx
4. src/features/globe/SpendscapeGlobe.tsx
5. src/features/local-purchases/PurchaseLocationReview.tsx
6. src/features/capture/receipt-place-seed.ts
7. src/features/capture/receipt-place-seed.test.ts
8. qa/spendscape-receipt-defaults.spec.ts — revised intentional inline-place UX assertions/output path only.
9. qa/spendscape-receipt-location-ux.spec.ts
10. qa/receipt-location-ux.config.ts
11. docs/spendscape/COLLEGE_RECEIPT_LOCATION_UX.md
12. docs/AI_HANDOFF.md — appended UX section only.

manifest.json and TASK.diff in the new artifact directory record exact hashes/hunks.
Real corrected-decoder scan has a successful editable-draft result, but user-confirmed
new purchase Save/reload and repeated real captures remain unverified. No milestone-
completion commit. Vercel remains paused. Next: finish/protect the current draft,
then separately load this UI; complete real milestone acceptance under explicit gates.
