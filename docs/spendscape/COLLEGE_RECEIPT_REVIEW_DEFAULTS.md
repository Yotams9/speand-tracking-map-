# Receipt review defaults — offline checkpoint

2026-10-12; feature/spendscape-rebuild; HEAD acc8f12d57eacd9098158bb6a908b50737289c80.
User requested fewer clicks for observed merchant/address and Israel time/currency.
All changes remain uncommitted. No new provider request, credential access or real
purchase mutation. The successful frozen live build on3172 was not restarted.

## Behavior

- New receipt review opens the editable new-merchant fields with the unambiguous
  observed name, without a separate Create merchant click. Nothing is persisted
  before explicit Save. Existing explicit merchant choices survive; duplicate
  merchant validation still requires explicit reuse or separate-entity confirmation.
- Printed address is already prefilled in review. Creating a place proposes the
  current merchant name as branch/pin label and copies the reviewed address.
  Coordinates, city/country and physical confirmation are never invented.
  An unresolved purchase remains unpinned. Pin creation still requires a confirmed
  physical point; receipt text is insufficient evidence of coordinates.
- Asia/Jerusalem is the user-requested review timezone default. Supported printed
  date/time resolves only when exactly one valid UTC round-trip exists. Missing,
  invalid, two-digit-year, DST-gap and overlapping times remain unresolved.
  No date/time is supplied. The UTC conversion is hidden from the user's work;
  Save confirms review facts. Editing date/time/zone invalidates readiness and
  exposes the existing confirmation control. The original observation is unchanged.
- ILS defaults only when no currency was observed (null) and no review currency
  was already chosen. This is explicit user preference, not extraction evidence.
  Known currencies are preserved; competing or unrecognized notation stays
  unresolved. Currency, timestamp and units keep their strict save validation.
- Units, payment and purchase/merchant categories are not guessed. Unknown context
  remains an explicit selection. Per-line arithmetic and independent final payable
  are unchanged. No discount allocation, automatic corrections or automatic Save.
- EN/HE text explains the defaults and preserves their editability. Missing facts
  and remaining blockers are still visible. Manual-entry initialization is unchanged.

## Verification

Isolated candidate/evidence: artifacts/receipt-israel-defaults-c1sk1slt/.
Focused unit172/172; complete isolated serial suite1018/1018 across51files. Application
and focused new-QA TypeScript pass. Production build passes, with existing root
lockfile warning retained. Final production-browser4/4 (EN360/HE390, missing facts430,
Undo1280) covers prefill, corrections, new-place address/label proposal without
coordinates, no auto-save, explicit save/reload, independent totals, explicit
merchant reuse and purchase duplicate handling, unresolved pin0 and Undo.
Synthetic EN/HE renders inspected; no real receipt screenshot/content retained.

Initial browser2/4 passed: two scenarios reached the correct duplicate-merchant
block before purchase-duplicate handling. The tests were corrected to explicitly
reuse the saved merchant, preserving both gates. Initial QA type errors in synthetic
string assertions were fixed by explicit type narrowing; earlier logs retained.
Legacy broader browser assertions expecting blank timezone and Create merchant
remain historical evidence; they were not rewritten or claimed to cover this UI.
Legacy full-QA TypeScript/timer caveats remain unchanged. React checklist: lazy
initialization, no new effects/storage/network work, original props unmutated,
semantic labeled editable controls, no new dependency or MapLibre instance.

## Real validation boundary

Corrected decoder produced a real editable draft from exactly one native request,
with successful durable parsing/review stages. That session remains exhausted.
User requested these UI improvements rather than confirming all remaining context.
The running real-validation build still uses the old frozen UI; the draft was not
re-inspected after the browser block. Safe status later showed session expired,
used1/remaining0 with the same completed journal; expiry is not proof of draft loss. An attempted existing-tab edit
was blocked by automatic approval review over potential unsaved-state loss; no
navigation/reload workaround was attempted. Complete it manually or deliberately
finish/discard it before separately loading the new UI. No receipt reconstruction
or further extraction is authorized. Real new Save/reload and repeated real capture
remain unverified, so Milestone2 is incomplete and no milestone commit is made.

## Exact incremental manifest

manifest.json and TASK.diff in the new artifact directory describe changes relative
only to task-entry bytes; preceding M2/diagnostic/research work stays excluded.

1. src/features/capture/receipt-review-prefill.ts
2. src/features/capture/receipt-review-prefill.test.ts
3. src/features/capture/PurchaseReview.tsx
4. src/features/capture/ReceiptReviewDetails.tsx
5. src/features/capture/MerchantPlaceReview.tsx
6. qa/receipt-defaults.config.ts
7. qa/spendscape-receipt-defaults.spec.ts
8. docs/spendscape/COLLEGE_RECEIPT_REVIEW_DEFAULTS.md
9. docs/AI_HANDOFF.md — appended defaults section only.

Provider request, decoder, schema, financial/domain/storage validators and frozen
launchers remain unchanged by this slice. Historical reservations/evidence, main
refs, index and entry next-env.d.ts bytes preserved. Only owned3194 QA server stopped;
3172/real draft remains untouched. Vercel unchanged/paused; no commit/push/deployment.
