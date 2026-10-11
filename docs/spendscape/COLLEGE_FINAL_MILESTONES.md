# College final product milestones

## Milestone 1 — actual user data (authorized 2026-10-11)

Replace ordinary fixture-backed surfaces with the reviewed local user graph. Keep
IndexedDB authoritative and unchanged: validate v1–v4 against the historical
directory and Inbox definitions before composing visible data. Legacy references
must survive; hydration must not write, reset, salvage or invent entities.

Acceptance: fresh browser has zero purchases/pins and useful EN/HE empty states;
existing reviewed records retain IDs, directory, financial facts, revisions and
decisions; all retained views agree; manual/receipt review, duplicate protection,
atomic save, reload, deletion/location confirmation and Undo remain functional;
online/unresolved records stay unpinned; one MapLibre instance. No ordinary demo
actions/catalog/simulated insights/savings. Unsupported providers remain unavailable.
Synthetic fixtures are explicitly opt-in loopback QA only. Verify with fictional
records in isolated browser origins/builds; never modify the real user's purchase.

Audit: purchase state is only `spendscape-local-purchases/state/current` (IDB v1,
envelope v4). v1/v2 records may reference historical merchants/places; v3/v4 add
local directory records. Inbox decisions reference historical case/candidate IDs.
`sessionStorage` retains camera and filter preferences, not purchases; no application
purchase `localStorage` remains. Keep the historical validation snapshot separate
from visible data, including stored synthetic additions, without schema migration.

Hard stop: scoped local commit after acceptance QA. No provider/dependency/account,
billing, push or deployment. Preserve historical locks/evidence and unrelated edits.

## Deferred Milestone 2 — reliable repeat receipt capture

Prepare a separately approved normal-user local capture activation and bounded
accuracy/lifecycle validation beyond the consumed one-shot pilots. Provider request
limits, privacy, existing Prepay cost and user Save remain explicit gates. Current
native request shapes and consumed launchers are unchanged by Milestone 1.

## Deferred Milestone 3 — qualified current Nearby Prices

Collect a bounded fresh public Stores/PriceFull sample only after separate collection
authorization; qualify branch, freshness, ILS, product/package/unit coverage before
connecting prices. No historical-receipt savings or invented identifiers/prices.

Publication remains a separate approval; Vercel stays paused.

## Milestone 1 implementation and evidence

Ordinary data composition includes only validated, non-synthetic reviewed records
and their referenced existing merchants/places. Historical validation references,
stored synthetic additions and Inbox decisions remain untouched in IndexedDB;
they are hidden from ordinary presentation, not deleted or migrated. No storage
schema/validator change or hydration write was introduced. Synthetic presentation
requires server opt-in, an exact loopback host and a separate explicit QA opt-in.

Ordinary Capture retains receipt intake, camera/barcode decoding and manual entry.
It offers no demo product or simulated-source actions. Unactivated recognition and
external product lookup are honestly unavailable. Ask/Inbox simulations and demo
savings are absent; current prices remain unavailable. Retained search, Stats,
Replay, Purchases and pins compose the same reviewed graph. Latest-place navigation
uses the latest visible confirmed place, never a fixture target; empty controls
cannot move to an invented place. Receipt provider requests and one-shot launchers
are unchanged. Existing default-off boundaries remain separately gated.

QA uses tracked HEAD plus only this milestone's proposed source in an isolated
application at `artifacts/college-m1-u5ep1sgr/app`, excluding unrelated server and
research edits. Evidence remains in that parent directory. Production QA uses
port 3191; the user's real purchase/origin on 3172 is untouched. All receipt content
in screenshots and tests is fictional. Browser emulation is not physical-device QA.

Reproduction: build the isolated candidate; serve on loopback port 3191 with
`SPENDSCAPE_SYNTHETIC_QA=1`, `SPENDSCAPE_STRUCTURED_QA=1` and a fresh
`SPENDSCAPE_STRUCTURED_QA_RUN` identifier (mock mode only, no credentials/native
activation). Run `qa/college-m1.config.ts` with fresh `SPENDSCAPE_M1_QA_OUT`,
`SPENDSCAPE_UNKNOWN_QA_OUT`, `SPENDSCAPE_NEARBY_QA_OUT` and
`SPENDSCAPE_LOCATION_QA_OUT` destinations. Fixture headers apply only to local
HTML documents, never external tile requests. Ordinary tests omit fixture opt-in.

Exact local commit scope (handoff: this milestone's appended section only):

- `README.md`
- `docs/AI_HANDOFF.md`
- `docs/spendscape/COLLEGE_FINAL_MILESTONES.md`
- `package.json`
- `public/manifest.webmanifest`
- `qa/college-m1-fixture-regressions.spec.ts`
- `qa/college-m1.config.ts`
- `qa/spendscape-college-m1.spec.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/data/spendscape-repository.ts`
- `src/data/spendscape-user.test.ts`
- `src/data/spendscape-user.ts`
- `src/features/capture/CaptureBarcode.tsx`
- `src/features/capture/CaptureCamera.tsx`
- `src/features/capture/CaptureExperience.tsx`
- `src/features/globe/SpendscapeAnalytics.tsx`
- `src/features/globe/SpendscapeGlobe.tsx`
- `src/features/local-purchases/LocalDataPanel.tsx`
- `src/features/receipt-image/ReceiptImageIntake.tsx`

Verified results: **Milestone 1 acceptance passed** in the isolated candidate.

- Focused domain/storage/final-payable regressions: 47/47.
- Complete isolated unit suite: 951/951 across 47 files, serial execution;
  `unit-reviewed.log`. The earlier parallel run retained 950 passes/one existing
  40 ms Vision-disconnect timing failure (`unit-full.log`). No timeout/assertion
  was weakened; serial passes do not establish that parallel variability is fixed.
- Application typecheck, focused QA TypeScript check and production build passed
  (`typecheck-final.log`, `qa-typecheck-final.log`, `build-reviewed.log`). Existing
  multiple-lockfile workspace-root warning remains. This is not a claim that the
  repository-wide legacy QA TypeScript error has been fixed.
- Final combined production-browser suite: 40/40 (`browser-final-pass.log`),
  including 13 ordinary-user checks and 27 isolated fixture regressions. Fresh
  users have zero purchases/pins and no hydration write. v1–v4 records/decisions
  read back unchanged. EN/HE mobile review/correction, unknown context, independent
  line/payable totals, explicit save, reload, duplicates, eight-second Undo,
  cancellation, manual entry, shared places, Show place, deletion, zero-net lines,
  rollback and concurrent revision conflicts passed. MapLibre remained one instance.
- Earlier interrupted/failing browser logs remain: new-test wording/navigation
  corrections, explicit branch selection, fixture header leaking to map requests,
  and missing mock readiness setup. The fixture wrapper now limits the header to
  local documents; mock readiness is explicitly enabled with no native credentials.
- Rendered synthetic screenshots inspected at 360/390/430 px EN/HE and 1280 px EN;
  readable controls and feedback, no horizontal overflow. Screenshots are under
  `browser-final-pass/` (empty states, reviewed/saved receipts, manual history),
  and isolated `app/artifacts/spendscape-local-directory/`/location QA destinations.
- Commit manifest, exact staged patch and preservation evidence are retained beside
  those logs. Entry `next-env.d.ts`, protected main refs, excluded dirty work,
  historical evidence and consumed reservations are preserved. The QA server is
  stopped; port 3172 was neither restarted nor reloaded.

Limits: this milestone changes ordinary presentation and local reviewed-data
composition, not provider availability or general receipt accuracy. Recognition,
address lookup and current price sources remain separately gated/default-off;
no cloud synchronization or backup. Real user data was not edited during QA.
Next: separately approve Milestone 2's bounded repeat-capture activation, provider
budget/privacy and new-photo validation. No existing consumed launcher is reusable.
