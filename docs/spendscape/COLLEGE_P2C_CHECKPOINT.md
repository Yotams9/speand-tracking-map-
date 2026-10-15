# College P2C — explicit reviewed receipt-line discounts

2026-09-27. Implementation and local QA only, under the user's P2C approval.
Awaiting separate checkpoint review; no stage, commit, push or deployment.

## Representation and boundary

`PurchaseItem.unitPrice` remains the gross unit price in original currency major
units; optional `discountMinor` is an explicit whole-line deduction in original
currency minor units; `lineTotal` is the net line amount in major units. No
invented effective price, inferred discount or extraction integration. Review
accepts currency-precision decimal strings and computes gross, discount, net
and basket reconciliation with integers. Weighted quantities retain P1 half-up
rounding at the line level. Missing legacy discounts mean zero; an edited blank,
negative, excessive, fractional-minor-unit, malformed or unresolved discount
fails validation. A fully discounted line may have net zero; a purchase must
still have a positive total. Existing limits (50 lines, amount/quantity bounds)
remain. JPY keeps its zero-decimal precision; foreign purchases still require
user-reported ILS and never use fixture FX for user facts.

English/Hebrew review distinguishes gross unit price, optional whole-line
discount and net, with labelled errors and visible focus. Invalid line totals
show an em dash rather than a misleading partial sum. Detail retains gross and
net with the explicit discount. Nearby demo compares actual discounted paid
amounts; unchanged eligibility and partial-basket wording still apply. The
ILS 2.50 test discount reduces illustrative matched-basket saving from 5.50 to
3.00; non-positive savings remain suppressed.

## Storage compatibility

The persisted envelope is version 2; the IndexedDB database version, object
store and key remain unchanged. Strictly validated version-1 records migrate
in memory by changing only the envelope tag. Hydration performs no write and
preserves records, decisions, sequence and revision. The next successful
explicit write persists version 2 under the existing atomic revision guard.
Failed writes leave version 1 intact; stale tabs cannot overwrite a newer save.
Version 1 carrying a discount, unknown future versions, malformed discounts,
forged net amounts and extra fields fail closed. Older clients cannot read a
version-2 envelope; no downgrade or silent deletion is implemented.

Duplicate fingerprints distinguish discount facts but treat absent and explicit
zero equivalently. Operation consumption, explicit duplicate override, durable
eight-second Undo and reload behavior remain. Canonical fixtures are untouched:
42 purchases, 12 places/pins, ILS 6,777.38. Additions use the same derived graph;
online/unresolved purchases create no pins and MapLibre remains one instance.

## QA evidence

Evidence is ignored under `artifacts/spendscape-college-p2c/`.
- `npm run typecheck`: passed against the final production source.
- `npm test`: 16 files, 210/210 passed (including focused domain, migration,
  comparison and canonical-boundary cases).
- `npm run build`: passed; root and not-found prerendered, no new app route.
- Fresh final combined production run: **41/41 passed in 2.4 minutes**, no
  retries: `spendscape-college-p2c.spec.ts`, `spendscape-college-p1.spec.ts`,
  `spendscape-nearby-demo.spec.ts`, `spendscape-data-boundary.spec.ts` using
  `playwright.phase2a1.config.ts`. Includes all 9 P2C cases: five EN/HE viewport
  cases, zero-discount/duplicate/Undo, read-only v1 migration, 25-line arithmetic,
  and failed migration write plus stale-tab conflict without BroadcastChannel.
- Neighboring production-browser run: **19/19 passed in 1.1 minutes**, no
  retries, across Capture and Scanner A/B/E. The exact selected test names are
  retained in `neighbor-list.txt`; execution is in `neighbors.log` and
  `neighbors-report.json`. Includes camera lifecycle at four widths, the real
  pinned reader's four supported formats, scanner privacy, demo/manual/receipt
  review paths, reported foreign-currency amount, history and derived surfaces.
- `git diff --check` and whitespace checks on both new files passed.
- Production QA server PID 16320 was stopped after tests. Build logs contained
  no failure; no development server was started. `next-env.d.ts` equals both
  the pre-task backup and HEAD (SHA-256
  `1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b`).

Two genuine local-browser failures were investigated and corrected without
raising timeouts or removing assertions:

- Initial 8-case run: 6 passed, 2 failed at 360×420; the globe's minimum height
  clipped review actions. Review alone now follows the visual viewport, with
  listener/animation cleanup; other Capture states keep their layout.
- First combined 41-case run: 40 passed, 1 timed out. The global storage-error
  banner intercepted retry after a simulated migration quota failure. During
  review/manual forms the existing inline live status now owns that error;
  the global banner remains available outside those forms.

Rendered screenshots inspected: `discount-360-en/he.png`,
`discount-390-he.png`, `discount-430-en.png`, `discount-1280-en.png`,
`short-viewport-en/he.png`, `error-360-he.png`, `detail-360-he.png`,
`detail-1280-en.png` and `25-lines.png`. Review viewports were 360×640 EN/HE,
390×844 HE, 430×932 EN and 1280×844 EN; short viewports were 360×420 EN/HE.
Numeric direction, RTL ordering, focus ring, line net, scrolling and visible
save actions were inspected. These are desktop Chromium viewport checks, not
physical Safari keyboard, screen-reader or iPhone performance certification.

## Exact intended manifest (13 files)

1. `docs/AI_HANDOFF.md` — preserves the Architect's entry status update and appends P2C.
2. `docs/spendscape/COLLEGE_P2C_CHECKPOINT.md` — this record (new).
3. `qa/spendscape-college-p2c.spec.ts` — focused production-browser suite (new).
4. `src/data/spendscape-globe.ts`
5. `src/features/capture/CaptureExperience.module.css`
6. `src/features/capture/PurchaseReview.tsx`
7. `src/features/capture/session-purchase-domain.ts`
8. `src/features/capture/session-purchase-domain.test.ts`
9. `src/features/globe/SpendscapeGlobe.tsx`
10. `src/features/local-purchases/local-purchase-store.ts`
11. `src/features/local-purchases/local-purchase-store.test.ts`
12. `src/features/nearby-demo/comparison.ts`
13. `src/features/nearby-demo/comparison.test.ts`

## Git safety

Branch `feature/spendscape-rebuild`, HEAD
`1bbd50ec3f0bffe0fcb7da0adf016da3d61363b8`, upstream
`origin/feature/spendscape-rebuild` at local cached ref
`66fb4204154c88789e9e0401e317f9000b6b5e18` (ahead 4, behind 0; not refreshed).
Both protected main refs remain
`eee0d26b55e5061f87ac664938df0c195800b74f`. Index is empty; the 13-file manifest
is the complete intended diff (11 modified, 2 new). The Architect's entry
handoff remains a byte-identical prefix with only P2C appended. Ignored QA
artifacts and generated files are excluded. No commit or network Git action.

## Limits and next gate

No receipt extraction, camera/gallery receipt integration, model promotion,
provider calls, dependency or schema infrastructure were added. Scanner D1's
negative result stands. P2B remains stopped at 5/12 attempts (two HTTP 503s);
seven protected fixture/request/evidence hashes remain identical. Further
receipt extraction requires a separate bounded approval. No claim of physical
iPhone P2C QA. No application deployment changed.

Next token: `APPROVE SPENDSCAPE COLLEGE P2C CHECKPOINT REVIEW`.

## Subsequent checkpoint finding and bounded correction

The separate P2C checkpoint review reran typecheck/build, 210 unit tests and
9 P2C browser tests successfully, but an additional visibility reproduction
found one Medium defect: suppressing the global storage-error banner left
`Not saved` below the visible form scroll area at 360×640 and 1280×844. The
original test asserted text presence rather than visible feedback. Data stayed
unchanged; this was a feedback defect, not a failed storage transaction.
Review evidence remains in `artifacts/spendscape-college-p2c-review/`.

The user separately authorized **VISIBLE STORAGE-ERROR FEEDBACK CORRECTION +
LOCAL QA**. Each storage-error result now requests that the inline live status
scroll into view after rendering. This runs for every failed attempt, including
an unchanged error after scrolling away and retrying. It does not restore the
obstructing overlay, change validation/arithmetic, alter storage or affect the
save/Undo transaction boundary. The first correction run passed 27/31 but the
four new checks exposed focus loss caused by the transaction's existing inert
lock. The correction now restores the pre-save focused control only if focus
fell to body, the same control remains in the form and the form is no longer
inert. It never steals focus from a newer target or a conflict-management panel.
The assertions and timeouts were retained. A focused rerun passed 4/4.

Four EN/HE production-browser regressions at 360×640 and 1280×844 explicitly
check clipping against the scroll container, primary-action visibility and
non-overlap, focus retention, two consecutive failures (second retry by Enter),
unchanged stored data, successful retry exactly once, discount facts, one map,
12 pins and durable Undo. All four `storage-360-en/he.png` and
`storage-1280-en/he.png` screenshots in the correction artifact directory were
visually inspected: full message visible above unobstructed actions, clear
focus ring, correct RTL. Physical iPhone/keyboard testing remains unclaimed.
Final combined results and cleanup follow below.
This correction changes only `PurchaseReview.tsx`, the existing P2C browser
specification and these two checkpoint/handoff documents; the full manifest
remains the same 13 files. A new separate checkpoint review is required.

Final correction QA: production build and typecheck passed; 210/210 unit tests
passed; the fresh complete P2C/P1 production-browser run passed **31/31 in
1.9 minutes**, without retries, skips or timeout changes. This includes all
13 P2C cases and 18 P1 cases. The earlier four focus failures and the subsequent
4/4 focused pass are retained, not represented as a first-run success. Logs,
reports and screenshots are ignored under
`artifacts/spendscape-college-p2c-correction/`. Final server PID 24745 was stopped;
next-env remains byte-identical to entry/HEAD. Whitespace checks passed.

Git remains on `feature/spendscape-rebuild` at `1bbd50e`, index empty; main refs
and cached origin feature ref remain as recorded above. No commit/push/deploy,
provider calls or additional files outside the same 13-file manifest. The
Medium visibility finding is corrected locally and awaits independent review:
`APPROVE SPENDSCAPE COLLEGE P2C CHECKPOINT REVIEW`.
