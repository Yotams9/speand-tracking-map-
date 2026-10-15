# College receipt date policy and address-to-pin — offline checkpoint

2026-10-13; feature/spendscape-rebuild; HEAD acc8f12d57eacd9098158bb6a908b50737289c80.
Offline correction verified; all changes uncommitted. Real current draft remains
open on the earlier frozen3172 build. No restart, reload, receipt inspection, new
Gemini/Geoapify call, credential access or ordinary-history mutation in this task.

## Explicit date policy

The user explicitly chooses zero-padded day-month-year DD/MM/YY or DD-MM-YY, with
consistent separators, years00–99 mapped to2000–2099. This is a college review
policy, not a discovered century. Example30-09-26 /15:47 produces editable local
2026-09-30T15:47. The printed observation remains unchanged. A visible EN/HE policy
notice and date-field description distinguish the mapped year from original text.

Existing YYYY-MM-DD and DD/MM/YYYY /DD-MM-YYYY retain their four-digit years and
existing1900–2100 validation range. Gregorian calendar validation rejects rollover,
invalid leap days/months/day0. Mixed separators, non-padded/three-digit years,
unsupported notation and multiple observation candidates remain unresolved. No
missing date/time or coordinates are supplied. Time format and timezone/DST checks
are unchanged. Save confirms the reviewed valid prefill; editing wall time or zone
clears confirmation and requires existing time confirmation again. Unit/payment/
category and strict financial validation remain unchanged.

## Address-to-pin flow — reused and reverified

The existing receipt flow already carries the edited address and merchant name in
a temporary seed after durable explicit Save. Its visible optional success action
opens the saved-purchase location form. It never searches/saves a location
automatically. Address-search consent and Submit precede bounded candidate preview
on the existing MapLibre instance. City/country suggestions require supported
printed structure or validated candidate data; no fabricated geography. Candidate
selection alone is unconfirmed. The user reviews/adjusts the point and explicitly
confirms before atomic same-ID purchase/place update. Manual coordinates remain
optional/Advanced; unresolved no-pin Save remains straightforward.

Existing revision guards, duplicate-place checks, original purchase provenance and
financial/date/context values are preserved. Show place and reload derive from the
canonical graph. A current address candidate is not proof of historical occupancy.
No address/location implementation change was necessary in this task; focused mocks
exercise its complete integration. Unresolved receipt address metadata remains
transient; after closing/discarding the seed it is not reconstructed from answers.

## Actual QA and preservation

Fresh isolated artifact: artifacts/receipt-date-policy-ux3av7zs/.
- Focused212/212 units; complete isolated1049/1049 (52files).
- Application typecheck, focused QA TypeScript and final production build pass.
- Final production browser9/9 (15.9s): EN360 /HE390, large phone430 /desktop1280;
  exact two-digit date prefill and saved UTC timestamp, original observation retained,
  invalid calendar correction/confirmation, unknown context, strict printed-line
  arithmetic, independent payable, explicit Save/reload/duplicate/Undo, reviewed
  address handoff, mocked search/map preview, explicit pin, same-ID update/Show place/
  reload, cancellation and durable-save failure. All provider endpoints forbidden.
- EN/HE synthetic renders inspected. Fixed RTL year-range ordering with LTR bdi.
  Earlier9/9 plus focused2/2 visual checks retained; final9/9 covers final state.
- Initial isolated server start hit sandbox EPERM; authorized loopback-only QA
  start succeeded. Existing multiple-lockfile build warning unchanged. No strict
  all-historical-QA typecheck claimed. Existing timing caveats remain documented.
-45 protected file hashes, main refs/index, next-env bytes and the active consumed
  session policy/request/journal hashes unchanged. Only owned3195 QA server stopped.
  Native3172 server/draft untouched. No application source/provider shape/schema/
  decoder/financial/storage/credentials/dependency change outside this manifest.

## Exact incremental manifest

1. src/features/capture/receipt-editor-values.ts
2. src/features/capture/receipt-editor-values.test.ts
3. src/features/capture/receipt-review-prefill.test.ts
4. src/features/capture/ReceiptReviewDetails.tsx
5. qa/spendscape-receipt-defaults.spec.ts
6. qa/spendscape-receipt-location-ux.spec.ts
7. docs/spendscape/COLLEGE_RECEIPT_DATE_POLICY.md
8. docs/spendscape/COLLEGE_REPEAT_RECEIPT_CAPTURE.md — appended status only.
9. docs/AI_HANDOFF.md — appended status only.

manifest.json /TASK.diff record task-entry versus candidate bytes, not a wholesale
commit of other dirty work. Existing cumulative M2 changes remain preserved.

## Remaining real gates

The existing real request consumed one allowance and produced a draft on the old
frozen build. User explicitly confirms26 means2026; safe agent filling remains
blocked by browser auto-review because reconnecting may lose unsaved state. User
was guided to fill the existing control and explicitly Save. No bypass/reload.
Save/reload and same-session repeat-image duplicate prevention still require actual
verification. Do not declare Milestone2 ready or commit solely from these mocks.

After current draft Save or deliberate discard, loading the updated provider-disabled
UI on the same origin is safe for stored purchases but loses unsaved transient data.
The new date behavior is verified synthetically, not on the open real old UI. No
new extraction is authorized by this correction. A real new place requires separate
local Geoapify activation/readiness and explicit submission of the reviewed commercial
address/language (one bounded search, at most5 suggestions, no retry), followed by
user address/point confirmation and same-ID persistence checks. No new geocoding
request or real new pin accuracy is claimed here.
