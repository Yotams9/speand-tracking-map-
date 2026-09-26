# Spendscape — AI handoff

Updated against the local worktree on 2026-09-25. This is a quick orientation, not a replacement for `AGENTS.md` and the authority files in `docs/spendscape/`; read those before acting. Recheck Git and external services because they can change.

## 1. Project overview

Spendscape is a mobile-first purchase-intelligence web/PWA product for consumers, with an interactive globe showing where purchases happened. The user's target is a **finished, functioning college-project product**, not a site that remains merely a demo throughout. The current local build is an incomplete concept/prototype toward that target: users can review purchases and analytics, capture and explicitly save purchases, resolve material uncertainty, issue bounded map/UI commands, and replay purchase details, and approved College P1 now persists reviewed purchases and Inbox decisions locally across reload; receipt OCR and other target capabilities remain unimplemented. Nearby Price Comparison may use explicitly labelled illustrative Israeli-store prices in ILS for the final college submission; this data-source simplification does not redefine the whole product as a demo or establish factual retailer savings. See the bounded implementation record below.

## 2. Tech stack and commands

| Layer | Current state |
| --- | --- |
| Frontend | Next.js 16 App Router, React 19, TypeScript, CSS Modules; MapLibre GL 6 with OpenFreeMap Liberty and a self-hosted RTL text plugin. |
| Backend | Next.js server page loads a provider-neutral **fixture** snapshot. No product API routes or persistent write service. |
| Local storage | College P1 uses native IndexedDB for validated reviewed purchases and Inbox decisions in this browser only. No backend database, account or cloud sync. Canonical fixtures and ignored Nearby-price research remain separate. |
| Auth | None. Camera access requires an explicit browser permission. |
| Deployment | Existing Vercel Hobby college demo: https://spendscape-college-demo.vercel.app . Verify its deployed commit separately; local commits and pushes do not update it automatically. |

Requires Node >=22.14 and npm 10.9.2. Run `npm install`, `npm run dev` (or `npm run dev:mobile` for LAN display), `npm run typecheck`, `npm test`, and `npm run build`. `npm run start` serves a built app. Targeted Playwright scripts include `qa:globe`, `qa:capture`, `qa:scanner-b`, `qa:data-boundary`, `qa:ask`, and `qa:replay`; see `package.json` for the full list and server prerequisites. **There is no lint script configured.** Offline Nearby Prices tests use the ignored NP0 Python 3.12 virtual environment if present: `artifacts/nearby-prices-np0/venv/bin/python -B -m unittest discover -s qa/nearby-prices -p 'test_*.py'`.

## 3. Architecture

- `src/app/`: App Router entry. `page.tsx` loads `fixtureSpendscapeRepository` and passes one serializable snapshot to the client globe.
- `src/data/`: canonical synthetic fixtures, repository read contract, purchase/place types, filtering, derived map and analytics data.
- `src/features/globe/`: persistent MapLibre instance and shared UI/session state. `capture/`, `inbox/`, `ask/`, and `replay/` contain their feature domains and views. `src/i18n/` handles English/Hebrew.
- `tools/nearby-prices/` and `qa/nearby-prices/`: isolated Python source parsing, normalization, comparison qualification and offline tests. They are not imported by the Next.js app.
- `docs/spendscape/`: phase authority, design, technology decisions and checkpoint evidence. `artifacts/` holds ignored raw samples and QA output.

Flow: synthetic fixture repository → server snapshot → persistent client globe → derived Purchases/Stats/search/map state. Reviewed Capture commits to native IndexedDB before updating the shared ledger; validated records and Inbox decisions restore into the same graph. Undo removes the latest addition within eight seconds and persists that removal; reload does not restart Undo. Scanner B identifies a barcode/product candidate; it does not prove a purchase. No application `/api/*` endpoint is currently implemented. The intended `/api/compare-price` route remains a proposal.

Core TypeScript model: `SpendscapeDataSnapshot` (`profile`, `merchants`, `places`, `purchases`, `evidence`, `smartInboxCases`); `GlobePurchase` includes merchant, optional place, channel, resolution, original amount/currency, FX provenance and nested items. One pin represents a physical place, not each transaction; online/unresolved purchases have no pin. There is no backend database schema or migration; the local IndexedDB version-1 envelope is documented in COLLEGE_P1_CHECKPOINT.md. The planned separate retailer-price read model is described, not created, in `docs/spendscape/NEARBY_PRICES_NP1_SCHEMA.md` (source files, stores, products, price observations, promotions and projections).

## 4. Completed work

- Globe, RTL/trackpad, clusters, heatmap, search, Purchases, Analytics, synthetic Capture, Smart Inbox, deterministic Ask and details-first Life Replay are implemented. Replay moves the camera only on explicit `Show place`.
- Scanner A requests live camera permission; Scanner B reads barcodes locally with pinned `zxing-wasm`; Scanner E connects a reviewed candidate to a session-only purchase. An eight-second timed Undo UI is committed. The fixture baseline is 42 purchases, 12 places/pins and illustrative ILS 6,777.38.
- Phase 2A.1 established the fixture repository boundary in `src/data/spendscape-repository.ts`. Main implementation entry points are `src/features/globe/SpendscapeGlobe.tsx`, `src/features/capture/`, and `src/data/spendscape-globe.ts`.
- Nearby Prices NP0/NP1 benchmarked and normalized a bounded Shufersal sample; NP2–NP2V documented access stops for additional chains. NP2F found 15 unequal historical source-price pairs between two distant Shufersal stores. NP2G qualified a nearby Shufersal address point at branch 11, about 1.6 km from branch 1, and added offline selection tests. No current price pair or factual savings claim has been established.

## 5. Current state and risks

Current local HEAD is `6fa7a60b9fadf15e09aecc50697f549cbbfa5177`, including the reviewed synthetic Nearby Comparison checkpoint. The local origin feature ref remains `66fb420` (ahead 2, behind 0; not refreshed); main/origin-main remain `eee0d26`. College P1 implementation and local QA are authorized and remain uncommitted; see section 9 for its checkpoint state. Earlier section 8 Git/QA statements are historical snapshots, not current status. This handoff is tracked. No publication or subsequent slice is authorized.

For a **factual retailer-price claim**, the immediate blocker is authoritative mapping of the regulated shekel/agora price field to the current Shufersal XML `ItemPrice` tag. NP2G stopped before fresh PriceFull downloads. The nearby coordinates are public address points, not surveyed entrances or route distances. Currency, current price overlap, source freshness/coverage, stock and dataset reuse still need proof before a factual savings claim. This does not block a clearly labelled synthetic college demo. Carrefour verification returned HTTP 403; the reviewed Osher Ad adapter uses authenticated FTP. Do not route around access controls. The scraper/parser packages have a custom noncommercial licence with attribution; retailer data rights are separate. Scanner D1 OCR missed Hebrew/mixed accuracy targets and has a worker cleanup limitation; receipt-photo OCR is not ready. Physical iPhone Scanner A/B testing is user-reported; do not label it independently instrumented QA. Some older general status documents lag recent commits: use Git and the latest checkpoint reports for current facts.

## 6. Development rules

- Work only in this worktree on `feature/spendscape-rebuild`; never alter `main`. Review, implementation, commit, push, provider connection and deployment are separate gates. A prior approval does not activate a later slice.
- Preserve `Globe · Capture · Purchases · Stats`, a single mounted MapLibre instance, one pin per physical place, and the canonical snapshot/derived-state boundary.
- Do not infer financial facts, currency, location, product equivalence or freshness. GPS is evidence, not purchase proof. Keep user purchase data, search text, receipt images and exact device location out of logs, URLs/history and price-source artifacts. Only explicitly reviewed purchases and Inbox decisions may enter the bounded local IndexedDB store; drafts, images, search and navigation remain ephemeral.
- Validate untrusted XML/HTTP input strictly; preserve source hashes/timestamps and quarantine bad files. Never turn conditional promotions into unconditional savings or treat a new fetch as a new publication.
- Keep secrets and raw retailer data out of Git. Preserve unrelated/generated changes such as `next-env.d.ts`; check the exact file manifest, `git diff --check`, relevant type/unit/browser or offline tests, branch/remote refs and server cleanup before reporting completion. Never claim tests that were not run.
- Next.js 16 has local version-specific documentation in `node_modules/next/dist/docs/`; consult it before changing framework code.

## 7. College product target and comparison data decision

The user clarified on 2026-09-24 that the destination is a **finished product for college**, with working end-to-end user flows, even though it is not intended for a market release. The current fixture-backed, session-only implementation is a checkpoint, not that final state. The user also fixed the nearby-price comparison scope to **Israeli stores and ILS only**; purchases elsewhere retain their existing multi-currency behavior and do not enter this comparison. Current retailer prices and an official `ItemPrice` field mapping are not acceptance requirements for the college submission. The comparison may use a small, internally consistent synthetic price set, with its prices and savings labelled illustrative. Do not label the whole product as a demo, present invented prices as current retailer facts, or treat the unresolved XML mapping as proved. The NP2G checkpoint review passed, but no current source-backed price pair or factual savings claim exists.

The user also clarified that the finished product must make receipt capture low effort: photographing a receipt with about 25 items should produce a reviewable itemized draft without typing every line. The existing camera/barcode path does not read receipt items, and Scanner D1 rejected the tested local Tesseract configuration for Hebrew/mixed receipt accuracy and cleanup. OCR or image-assisted extraction therefore remains a required capability to qualify for the college-product target, with provider/engine selection, privacy, cost and accuracy still undecided. A model's output is a proposal for review, never a factual source that can invent amounts or silently save a purchase. Product-photo identification likewise needs a separately validated path; barcode recognition alone is not photo understanding.

1. Plan one bounded synthetic Nearby Prices demo slice around the existing reviewed session purchase and eight-second Undo flow. Show a comparison only for explicitly matched products at one nearby demo store, with purchase context, comparison store, distance, matched-item count, and arithmetically correct illustrative savings. Suppress the card when its demo match conditions fail.
2. Implement and locally QA that slice only after its separate explicit authorization. Preserve the persistent globe, existing purchase ledger, English/Hebrew behavior, and no-pin rules. Keep demo prices out of the NP0–NP2G real-source qualification path.
3. Treat official XML field mapping and fresh retailer files as optional later decisions if factual comparisons become necessary. Decide persistence, hosting and other remaining product capabilities through separate scoped architecture and implementation gates; do not assume the present session-only prototype already satisfies the final-product target. Deployment and branch push retain separate approval gates.


## 8. Synthetic Nearby Comparison demo — local implementation, 2026-09-24

Authority: `APPROVE SPENDSCAPE SYNTHETIC NEARBY COMPARISON DEMO + LOCAL QA`.
Implementation and local QA only; no publication or follow-up source research.
The planning items in section 7 are historical: this bounded implementation is
complete and awaits a separate checkpoint review. No further slice is active.

### Result and data boundary

After explicit review/save of the built-in receipt, the existing eight-second
Undo expiry releases a purchase ID for comparison. No second timer is added.
The card appears in Capture success, or on the unobstructed Globe after leaving
Capture. Other purchase/detail/Ask/Inbox/Replay surfaces suppress its display.
Dismissal clears it and restores focus; a new addition clears the prior result.
Undo and Reset remove eligibility; reload returns the original fixture baseline.
Only records still present in the same session ledger qualify.

The checked-in `demo-prices.ts` fixture contains one fictional **Demo Grove
Market / מרקט החורשה — דמו** at invented coordinates [34.779, 32.078], and two
explicit demo product IDs from the built-in receipt. No NP0–NP2G artifact is
imported, copied or treated as a demo price. No live product match is implied.
The comparison location is never added to canonical places or the map source.
Distance uses the injected confirmed purchase place and Haversine arithmetic;
the default scenario is 629 metres straight-line, not a travel route or GPS.

The four-item receipt remains ILS 86.90. Two individually identified items are
compared: olive sourdough (18.50 vs 16.00) and whole sesame tahini (24.90 vs
21.90). Totals are **4340 vs 3790 minor ILS units**, a **550-unit illustrative
saving on 2/4 items only**. Tomatoes and seasonal fruit are not matched. All
savings arithmetic is integer minor-unit arithmetic; formatting converts only
at presentation. EN/HE copy explicitly labels prices and savings illustrative,
the store fictional, and partial coverage as not a whole-basket saving. The
item breakdown is available through an accessible disclosure.

Eligibility rejects nonreceipt/nonsynthetic/user-reviewed records, unsupported
currency, missing/unconfirmed/mismatched purchase place, distances outside 5 km,
missing identities, edited product labels, unsupported units/quantities,
invalid matched-line arithmetic, duplicate matched identities and nonpositive
savings. No text similarity, substitutions, inferred package equivalence or FX
conversion is used. Only the two fixed unit-item identities qualify; weighted
items and general address/product matching remain outside this demo.

### Files (11 total, unstaged)

- `src/features/capture/CaptureExperience.tsx`
- `src/features/capture/capture-domain.ts`
- `src/features/capture/session-purchase-domain.ts`
- `src/features/globe/SpendscapeGlobe.tsx`
- `src/features/nearby-demo/demo-prices.ts`
- `src/features/nearby-demo/comparison.ts`
- `src/features/nearby-demo/comparison.test.ts`
- `src/features/nearby-demo/NearbyDemoCard.tsx`
- `src/features/nearby-demo/NearbyDemoCard.module.css`
- `qa/spendscape-nearby-demo.spec.ts`
- `docs/AI_HANDOFF.md` (pre-existing untracked file, updated only as authorized)

### QA and limitations

- Focused comparison/Capture/session domain tests: **32/32 passed**.
- Full `npm test`: **189/189 passed in 15 files**.
- `npm run typecheck` and production `npm run build`: passed.
- Final combined production Chrome run: **11/11 passed in 38.6s**, no retries,
  skips or timeouts. Comparison suite: five new cases covering desktop EN,
  360×640 mobile HE/RTL/reduced motion, exact 7999/8000 ms boundary, shared
  Capture/external display, both Undo controls, Reset, dismissal and reload.
- Six existing timed-Undo regressions exercise expiry, shared countdown across
  navigation, newer-addition deadlines and reset at 360/390/1280 widths.
- Screenshots of expanded Capture and compact Globe cards were inspected at
  1280×844 EN and 360×640 HE. Evidence remains ignored under
  `artifacts/spendscape-nearby-demo/`; no physical iPhone QA is claimed.
- Browser assertions retain one MapLibre construction/instance, 12 pins,
  43 purchases after save, ILS 6864.28 total, and 42 purchases on Undo/reload.
  They observe no write requests, OCR/retailer/geocoder requests or persistent
  cookies/localStorage origins. This is bounded QA, not an exhaustive audit.
- Initial focused unit execution failed because the test runner did not resolve
  a new `@/` test import; corrected to the existing relative-import convention.
- Initial browser execution timed out after successful card assertions when
  reload ran with the test clock still paused. Resuming the test clock before
  reload fixes that harness error; no timeout or assertion was weakened. That
  initial run was interrupted during the second test (three not run), with
  interruption-related trace errors. It is not counted as a passing run.

Factual retailer currency qualification, fresh price data, OCR, GPS, backend,
database, providers, dependencies, deployment and physical device QA remain
outside this slice. The existing Vercel deployment is unchanged.

### Git and cleanup

Work remains on `feature/spendscape-rebuild` at
`f1184676d229663e2253f2884b08c55a556e7cbc`; local origin feature ref remains
`66fb4204154c88789e9e0401e317f9000b6b5e18` (ahead 1, behind 0; no remote refresh).
main/origin-main remain `eee0d26b55e5061f87ac664938df0c195800b74f`.
Index remains empty. No commit, push, PR or deployment. Generated evidence is
ignored. The task-owned QA server was stopped after the final passing run.
`git diff --check` and new-file whitespace checks passed. next-env.d.ts retains its pre-task blob
`ce4e94a6b10f160ee021fe18939af160d2927dcf` and is excluded from the manifest.


### Bounded checkpoint correction — 2026-09-24

Authority: `APPROVE SPENDSCAPE SYNTHETIC NEARBY DEMO CHECKPOINT CORRECTION + LOCAL QA`.
Only the narrow-screen floating presentation and generated-file reconciliation
were corrected. The 11-file manifest above remains the complete intended
checkpoint; this correction changes `NearbyDemoCard.tsx`, its CSS module,
`qa/spendscape-nearby-demo.spec.ts`, and this handoff. Comparison prices,
identities, eligibility, ledger and Undo behavior are unchanged.

At widths up to 760px, the floating card has a compact summary with the
illustrative saving, fictional-store label/name, straight-line distance and
2-of-4/not-whole-basket limitation immediately visible. Receipt context and
item details remain in native keyboard-operable `details`/`summary`.
Capture retains its full comparison presentation, as does desktop.

Fresh correction checks:
- Typecheck passed; focused comparison/Capture/session unit tests **32/32**
  passed across three files; production build passed.
- Focused production Chromium suite **10/10 passed in 30.3s**, no retries,
  failures or timeouts. Seven save/expiry/layout cases cover 360×640,
  390×844 and 430×932 in EN and HE/RTL, plus 1280×844 desktop EN.
  Three additional cases cover both Undo controls and leave/expiry/Reset.
- Keyboard Enter/Space opens/closes the disclosure. The full card fits the
  viewport, no document horizontal overflow occurs, and mobile collapsed
  height is at most 200px. Actual heights: 170.70px at 360 EN; 155.19px at
  360 HE and both languages at 390/430. Desktop remains 299.03px.
- Actual screenshots inspected under ignored
  `artifacts/spendscape-nearby-demo/correction/`: `globe-360-en.png`,
  `globe-360-he.png`, `globe-390-en.png`, `globe-390-he.png`,
  `globe-430-en.png`, `globe-430-he.png`, `globe-1280-en.png`,
  `globe-expanded-360-he.png`, and `capture-360-he.png`.
  The globe remains the primary visible mobile surface with details closed;
  opening details deliberately occupies more space and allows card scrolling.
- Existing assertions still pass for exact 7999/8000ms expiry, one map instance
  and construction, 12 pins, 43 purchases/ILS 6864.28 after save, baseline 42
  after Undo/reload, no write or OCR/retailer/geocoder requests, and no cookies
  or localStorage origins. No physical-device claim or wider QA is made.

Generated-file reconciliation: at correction entry, `next-env.d.ts` differed
only in the two imports pointing to `.next/dev/types/` instead of `.next/types/`.
Its entry blob was `a419cbe4e3a5e8d4b481b851dbf4ac767de069e6`.
No running Next/dev/build/Playwright process or port-3000 listener existed then;
the prior writer cannot be identified from this evidence. The paths match
Next development generation, not an unrelated source edit. The retained
`artifacts/spendscape-nearby-demo/next-env.before` matches the HEAD blob
`ce4e94a6b10f160ee021fe18939af160d2927dcf`. This correction's production build
itself regenerated exactly those pre-task bytes; no manual overwrite was
needed. Final checks after stopping QA confirm byte equality with the backup
and HEAD, no generated-file Git diff, and no active writer found. Earlier
cleanup statements describe their original check, not proof that the file
could not subsequently be regenerated.

The task-owned production server (PID 23737) was terminated. Final Git state:
branch `feature/spendscape-rebuild`, HEAD
`f1184676d229663e2253f2884b08c55a556e7cbc`; origin feature tracking ref
`66fb4204154c88789e9e0401e317f9000b6b5e18`, ahead 1/behind 0 (not refreshed).
Both main refs remain `eee0d26b55e5061f87ac664938df0c195800b74f`.
Index empty; intended 11 files remain unstaged, including the pre-existing
untracked handoff. `next-env.d.ts` and ignored QA evidence are excluded.
Whitespace checks passed. No commit, push, PR, deployment, dependency or
provider change. Stop after this correction and local QA report.


## 9. College P1 — local purchase persistence and privacy, 2026-09-25

Authority: `APPROVE SPENDSCAPE COLLEGE P1 — LOCAL PURCHASE PERSISTENCE + PRIVACY + LOCAL QA`.

P1 supersedes the older reload-reset behavior recorded in sections 7–8:
reviewed purchases and Inbox decisions now survive reload in this browser.
The original fixture graph remains unchanged. Successful writes commit before
the UI reports success; Undo persists removal, and an explicit confirmed
privacy action deletes all local additions and decisions. Reload creates no
new Undo/comparison window. Cross-tab revision checks prevent stale writes.

See [COLLEGE_P1_CHECKPOINT.md](spendscape/COLLEGE_P1_CHECKPOINT.md) for the
implementation, privacy boundary, exact QA evidence, limitations and manifest.
This is a local-only checkpoint awaiting separate review, not a claim that the
finished college product is complete. The required receipt-photo-to-itemized-
draft journey in section 7 remains separately gated; D1's negative result is
unchanged. No backend, provider, dependency, push or deployment was added.


### P1 bounded review correction

The independent P1 review found two Medium defects: capacity rejection was
misreported as invalid existing data, and late saves overwrote newer Back
navigation. The separately approved correction now distinguishes prospective
capacity rejection from persisted corruption and invalidates obsolete Capture
view completions while retaining exactly-once durable save. Existing purchases
remain accessible at capacity; the draft is retained, with EN/HE feedback.
The checkpoint report records focused QA and the unchanged 17-file manifest.
A new separate P1 checkpoint review is required; commit/publication remain gated.
