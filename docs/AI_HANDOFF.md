# Spendscape — AI handoff

Updated against the local worktree on 2026-09-26. This is a quick orientation, not a replacement for `AGENTS.md` and the authority files in `docs/spendscape/`; read those before acting. Recheck Git and external services because they can change.

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
- `src/features/globe/`: persistent MapLibre instance and shared UI/session state. `capture/`, `inbox/`, `ask/`, and `replay/` contain their feature domains and views; English/Hebrew copy lives with the active features. The unreachable inherited Ledgerline source tree was removed in the bounded 2026-10-01 cleanup; see README.md for the retained repository layout.
- `tools/nearby-prices/` and `qa/nearby-prices/`: isolated Python source parsing, normalization, comparison qualification and offline tests. They are not imported by the Next.js app.
- `docs/spendscape/`: phase authority, design, technology decisions and checkpoint evidence. `artifacts/` holds ignored raw samples and QA output.

Flow: synthetic fixture repository → server snapshot → persistent client globe → derived Purchases/Stats/search/map state. Reviewed Capture commits to native IndexedDB before updating the shared ledger; validated records and Inbox decisions restore into the same graph. Undo removes the latest addition within eight seconds and persists that removal; reload does not restart Undo. Scanner B identifies a barcode/product candidate; it does not prove a purchase. No application `/api/*` endpoint is currently implemented. The intended `/api/compare-price` route remains a proposal.

Core TypeScript model: `SpendscapeDataSnapshot` (`profile`, `merchants`, `places`, `purchases`, `evidence`, `smartInboxCases`); `GlobePurchase` includes merchant, optional place, channel, resolution, original amount/currency, FX provenance and nested items. One pin represents a physical place, not each transaction; online/unresolved purchases have no pin. There is no backend database schema or migration; the local IndexedDB version-1 envelope is documented in COLLEGE_P1_CHECKPOINT.md. The planned separate retailer-price read model is described, not created, in `docs/spendscape/NEARBY_PRICES_NP1_SCHEMA.md` (source files, stores, products, price observations, promotions and projections).

## 4. Completed work

- Globe, RTL/trackpad, clusters, heatmap, search, Purchases, Analytics, synthetic Capture, Smart Inbox, deterministic Ask and details-first Life Replay are implemented. Replay moves the camera only on explicit `Show place`.
- Scanner A requests live camera permission; Scanner B reads barcodes locally with pinned `zxing-wasm`; Scanner E connects a reviewed candidate to a purchase that College P1 persists in this browser's IndexedDB. An eight-second timed Undo UI is committed. The fixture baseline is 42 purchases, 12 places/pins and illustrative ILS 6,777.38.
- Phase 2A.1 established the fixture repository boundary in `src/data/spendscape-repository.ts`. Main implementation entry points are `src/features/globe/SpendscapeGlobe.tsx`, `src/features/capture/`, and `src/data/spendscape-globe.ts`.
- Nearby Prices NP0/NP1 benchmarked and normalized a bounded Shufersal sample; NP2–NP2V documented access stops for additional chains. NP2F found 15 unequal historical source-price pairs between two distant Shufersal stores. NP2G qualified a nearby Shufersal address point at branch 11, about 1.6 km from branch 1, and added offline selection tests. No current price pair or factual savings claim has been established.

## 5. Current state and risks

Current local HEAD is `1bbd50ec3f0bffe0fcb7da0adf016da3d61363b8`: College P1 and the reviewed P2A/P2B benchmark foundation are committed locally. The local origin feature ref remains `66fb420` (ahead 4, behind 0; not refreshed); main/origin-main remain `eee0d26`. P2B remains stopped at 5/12 synthetic Gemini attempts, with two HTTP 503 responses and no model promotion or Capture integration; see section 10. Earlier Git/QA statements are historical snapshots. No push, deployment, additional provider call or subsequent implementation is authorized.

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
This checkpoint passed re-review and was committed locally at `399fce8` on
2026-09-26; it does not mean the finished college product is complete. The required receipt-photo-to-itemized-
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
The separate re-review passed: 199/199 unit tests, 32/32 combined production
browser tests, typecheck/build and whitespace checks. Its separate commit approval
was consumed by `399fce8`; push/deployment remain gated. Physical iPhone
persistence and power-loss durability are not established.


## 10. College P2A — offline receipt benchmark, 2026-09-26

Approved foundation completed in `qa/receipt-p2a/`: four fictional PNG receipts
with exact structured truth/hashes, including 25 mixed Hebrew/English items,
repeats, quantities, discounts and an intentionally unreadable name. The offline
evaluator checks per-row facts, arithmetic, omissions and correction burden.
Constructed controls are evaluator evidence only: **zero OCR/model runs**.
See [COLLEGE_P2A_RECEIPT_BENCHMARK.md](spendscape/COLLEGE_P2A_RECEIPT_BENCHMARK.md)
for commands, measured controls, acceptance targets and the mobile state spec.
D1's negative recommendation remains. P1 has no explicit discount representation;
a later reviewed integration must resolve that without silently rewriting prices.
No consumer UI, IndexedDB schema, dependency, provider, account or deployment change.
The finished-product receipt-photo goal in section 7 remains unmet.

Next single approval: `APPROVE SPENDSCAPE COLLEGE P2B — BOUNDED SYNTHETIC RECEIPT PROVIDER BENCHMARK READINESS`.
This selects/verifies a concrete provider/model, privacy terms and hard budget
for at most 12 synthetic calls; it does not itself authorize calls, credentials
or billing. No provider is currently selected. Google AI Pro is not API authority.

### P2B execution preparation

The user separately authorized Gemini `gemini-3.8-flash`, maximum 12 synthetic
calls, Free tier only, $0, and reported an unbilled Free project with 5 RPM /
250K TPM / 20 RPD. Key remains in the user's terminal; never request it in chat.
`qa/receipt-p2b/` now contains the bounded runner and mock tests; 17 combined
P2A/P2B offline tests passed. **Codex made no live API calls; the user subsequently launched the runner.**
The run stopped at 3/12 (two scored responses, then HTTP 503). Read its README and inspect
ignored `artifacts/receipt-p2b-run/` before any continuation; never rerun or
remove the journal to reset the 12-call allowance. No model result or promotion
is claimed. Billing status is user-reported, not independently API-verified.


### P2B partial live result — stopped at 3/12

User-run attempts 1/2 scored 6/6 exact rows each (English 4.257 s, Hebrew
22.392 s, zero correction fields). Attempt 3, mixed 25-item receipt, returned
HTTP 503 after 15.604 s; no extraction result. Offline rescoring matched stored
scores. Nine slots remain, with the failed third slot permanently consumed.
No rerun, journal reset or automatic retry is authorized at this stop.
See [COLLEGE_P2B_PARTIAL_RESULTS.md](spendscape/COLLEGE_P2B_PARTIAL_RESULTS.md).
Long-receipt accuracy and repeated/degraded behavior remain unproved; no model
promotion or integration. Preserve ignored run evidence before any recovery.

The user subsequently approved the remaining-nine recovery. The runner's
`--resume-after-3 --free-tier-confirmed` preserves slots 1–3 and appends at most
4–12 once, guarded by a permanent exclusive recovery lock. 20 offline/mock tests
pass; no live recovery call made during preparation. User terminal execution is
pending. Inspect actual journal/summary before reporting current call count.


P2B recovery subsequently stopped at **5/12**: attempt 4 degraded 25-item
receipt scored in 26.787 s, attempt 5 returned HTTP 503 in 24.447 s. All
25 numeric rows and total match; unreadable name correctly unresolved. The
24 readable labels differ only in word order (same token multisets), so strict
25-line correction burden is not proof of 25 actual user edits. Original scorer
and scores remain intact. Seven slots unused; no further rerun authorized.
The subsequently approved offline review and diagnostic correction are complete.
The supplementary `reviewed-two-run-labels-v1` metric recognizes the 24 intact
Hebrew/Latin run exchanges on the reviewed corpus only, leaving one unreadable
name for review. Strict scores remain unchanged (1/25 exact, 25 correction
fields); these counts are not measured human editing effort. All three saved
successes were rescored offline with exact original-score equality; 42/42
offline/mock tests passed. No additional calls, app changes or promotion. The
26.787-second long result and two 503 failures remain unresolved. Preserve the
consumed recovery lock and journal. See the partial-results report for evidence
and limits. At that point, the correction awaited separate checkpoint review;
the later review and local commit are recorded below.


The complete P2A/P2B review subsequently found that offline runner tests depended
on the pre-commit HEAD and empty index. The separately authorized correction
separates Git-independent fixture/request preparation from the unchanged live
Git gate. Fresh offline/mock QA is **44/44 passed**, including Git/network-forbidden
offline execution and wrong-branch/HEAD/staged-index rejection. The 21-file
package passed complete checkpoint re-review and was committed locally as
`1bbd50e`. Still stopped at 5/12 calls; no additional provider execution,
integration, push or deployment.

## 11. College P2C — reviewed line discounts (2026-09-27)

The separately approved P2C implementation is complete locally, awaiting its
checkpoint review. This section supersedes earlier version-1/current-gate
statements above; the Architect's pre-task status reconciliation is preserved.
Gross unit price, explicit whole-line `discountMinor` and net line total remain
separate facts through review, detail and IndexedDB. Integer arithmetic rejects
unresolved/invalid discounts; absent and explicit zero retain old totals and
duplicate meaning. Nearby illustrative savings use the discounted paid amount.

The envelope is now version 2 (IndexedDB database version still 1). Strict v1
hydration changes only the in-memory envelope tag; existing records/decisions
are not written until a successful explicit transaction. Revision conflicts,
failed-write preservation, durable eight-second Undo and unknown-version
rejection remain. No OCR/provider integration or calls; P2B stays at 5/12 and
D1's negative recommendation stands. Receipt extraction remains separately gated.

See [COLLEGE_P2C_CHECKPOINT.md](spendscape/COLLEGE_P2C_CHECKPOINT.md) for the exact
13-file manifest, measured QA, corrected viewport/error-banner findings and
physical-device limits. The finished college-product goal remains separate from
the illustrative-price feature. No commit, push or deployment is authorized.
Next: `APPROVE SPENDSCAPE COLLEGE P2C CHECKPOINT REVIEW`.

Final P2C QA: typecheck/build passed, 210/210 unit tests, 41/41 combined
P2C/P1/comparison/boundary production-browser tests and 19/19 neighboring
Capture/Scanner tests. The QA server is stopped; next-env equals entry/HEAD.
HEAD remains `1bbd50e`, protected main refs `eee0d26`, local cached origin
feature `66fb420` (ahead 4, behind 0; no refresh). Empty index; 11 modified and
2 new intended files, with ignored artifacts excluded.

The subsequent P2C checkpoint review found a Medium visibility defect despite
9/9 focused browser tests passing: storage failure feedback was below the
visible scroll area after the global banner was suppressed. The separately
approved bounded correction now reveals the inline message after every failed
save, including repeated failures, and restores focus lost to the transaction
inert lock without taking focus from a newer target. Retry remains unobstructed.
Four EN/HE mobile/desktop regressions check actual clipping, keyboard retry,
unchanged data and successful save/Undo. No storage, arithmetic or provider
scope changed. This supersedes the prior implementation's ready-for-review
statement only with the corrected result; a new P2C review remains the gate.

Correction QA completed: final build/typecheck, 210/210 unit tests, 4/4 focused
visibility/focus cases, then a fresh combined P2C/P1 run **31/31 passed**. Four
initial focus failures are documented in the checkpoint. All four EN/HE
mobile/desktop correction screenshots were inspected. Server stopped;
next-env, HEAD and protected refs unchanged; index empty; same 13-file manifest.
Next: `APPROVE SPENDSCAPE COLLEGE P2C CHECKPOINT REVIEW`. No commit/push/deploy.


### College receipt-to-review core adapter — 2026-10-04

Latest bounded task complete offline in receipt-review-adapter.ts and its test.
Runtime-validated fictional observations preserve originals/alternatives alongside
editable review fields; no merchant/place/time/unit/price/discount inference.
Printed line amounts remain separate and must match integer calculated nets
before whitelisted PurchaseReviewInput projection. Pre-VAT/VAT/rate and barcodes
are optional; no historical evaluator/score/freeze/lock changed. Missing required
facts/context require explicit review, including UTC date/time and foreign ILS.
No consumer wiring, purchase creation side effect or persistence schema change.

New mocks: one item and 15 lines with Hebrew/mixed/repeated labels, weight and
explicit discount. Final focused tests 84/84; full Vitest 248/248 (17 files);
project typecheck and separate strict new-file/test typecheck passed. Guarded
mock adaptation/preparation observes zero transport/storage/log calls; existing
save/v2 round trips, duplicates, consumed IDs, Undo and 42/12/12/ILS 6,777.38
baseline checks pass. No build/browser/device QA; all existing UI/MapLibre/camera
source and 219 protected files byte-identical. Initial test fixture mistakes
corrected without weakening assertions; checkpoint records exact evidence.

Remaining gate: separate core-adapter checkpoint review. Capture UI still needs
separately approved wiring for observed metadata, unknown units, printed-line
corrections and UTC confirmation, then existing explicit P1 save. Merchant/
address, taxes and per-line barcode sidecars are not persisted by current v2;
unknown merchants need explicit unresolved/canonical context, no new IDs/pins.
No live/general receipt extraction claim; Vision 3 consumed, Gemini P2D 3/12
and consumed Groq evidence remain locked. See COLLEGE_RECEIPT_REVIEW_ADAPTER.md.

Exact task manifest (4): src/features/capture/receipt-review-adapter.ts,
src/features/capture/receipt-review-adapter.test.ts,
docs/spendscape/COLLEGE_RECEIPT_REVIEW_ADAPTER.md, docs/AI_HANDOFF.md (append only).
Pre-task handoff and unrelated dirty/untracked files preserved. Feature branch,
HEAD e7f05f8, main/origin-main eee0d26, cached origin feature 66fb420; ahead 6/
behind 0, no fetch. Index empty; next-env matches HEAD/pre-task. Ignored evidence
only under artifacts/spendscape-receipt-review-adapter. No server, dependencies,
credential/provider/account/billing action, stage/commit/push/deployment.


### Receipt adapter strict-array correction — 2026-10-04

Checkpoint review found one Medium runtime validation issue: sparse JavaScript
line arrays could return ready:true but fail local-store validation; extra array
properties survived cloning. Ordinary JSON cannot carry these shapes. Under the
separate correction approval, bounded dense-array validation now guards observed
lines, ambiguous candidates and edited review lines. Reject holes/inherited or
hidden indices, accessors, custom prototypes and extra string/symbol/hidden keys
before cloning/projection; preserve valid dense/frozen arrays and existing caps.
No changes to facts, arithmetic, optional VAT/barcodes, save/store or consumer UI.

Fresh offline QA: 75/75 adapter tests (37 new); combined domain/store/comparison/
repository suite 121/121 in five files, zero failures/skips. Both project and
explicit strict new-file/test typechecks passed; whitespace checks passed.
Original one/15-item, context, discounts, Undo, pin/baseline and storage tests
remain green; maximum 50-line/frozen control round-trips through v2. No full
suite/build/browser/server or provider call in this correction. Prior 248-test
full result is historical initial-implementation evidence, not a fresh rerun.

Same four-file manifest: receipt-review-adapter.ts, receipt-review-adapter.test.ts,
COLLEGE_RECEIPT_REVIEW_ADAPTER.md and this handoff append. Pre-correction inputs
retained in ignored artifacts/spendscape-receipt-review-adapter/strict-arrays/;
219 protected files and 63 historical pins/five Vision wrapper hashes unchanged.
Feature HEAD e7f05f8; protected main refs eee0d26; cached origin feature 66fb420,
ahead 6/behind 0. Index empty; next-env matches HEAD/pre-task. Unrelated work and
all consumed provider locks preserved. No dependencies, UI/schema integration,
stage/commit/push/deploy. Next gate: a new receipt-to-review adapter checkpoint
review; neither commit nor consumer/provider integration is authorized.

### Receipt review Capture integration — 2026-10-04

Approved bounded local slice complete, awaiting separate checkpoint review.
Capture accepts an in-memory ReceiptReviewDraft; the existing form calls
prepareReceiptReview before explicit P1 save. Original observed merchant/address/
printed date/time and all original lines remain separate from corrections.
Unknown units and editable printed net amounts fail closed until resolved;
quantity/gross price/explicit discount/net must agree. No merchant/place inference.
Explicit wall time + IANA timezone confirmation produces the existing UTC instant;
DST gaps fail and overlaps require a chosen occurrence. VAT/barcodes optional.
Unsupported observation metadata stays transient; IndexedDB envelope v2 unchanged.
One/15-item fictional observations enter only a loopback/opt-in QA hook, no public
OCR-success control. Source changes, navigation, success and stale hooks clear
drafts; existing late-save generation and operation protections remain.

QA: focused unit 130/130; full unit 296/296 (18 files); production combined
receipt/P2C/Capture/Scanner A/data-boundary/Nearby suite 64/64 (3.5m), plus 6/6
real pinned barcode handoff, eight-second Undo and delayed-save navigation checks.
Build, project/strict QA typechecks and whitespace passed. Inspected EN/HE mobile
360/390/430 and desktop 1280 screenshots, including full errors at 360x420 under
reduced motion. Receipt-only layout observation fixed short-viewport error clipping;
no timeout/assertion weakened. Baseline 42/12/12/ILS 6777.38, one MapLibre; tested
41.00 addition/reload gives ILS 6818.38 and keeps 12 pins. No outgoing purchase/
provider/OCR request or persisted original-observation sidecars.

Exact task manifest (10): CaptureExperience.tsx, PurchaseReview.tsx,
CaptureExperience.module.css, ReceiptReviewDetails.tsx, receipt-review-time.ts,
receipt-review-time.test.ts (all src/features/capture/);
qa/receipt-review-integration-mocks.ts, qa/spendscape-receipt-review-integration.spec.ts,
docs/spendscape/COLLEGE_RECEIPT_REVIEW_INTEGRATION.md, this append-only handoff.
HEAD 6a9661b unchanged; main/origin-main eee0d26, cached origin feature 66fb420,
ahead 7/behind 0. Index empty; unrelated dirty/untracked benchmark work preserved.
257 other snapshotted files and 63+5 Vision hashes unchanged. next-env matches
HEAD/pre-task; ignored artifacts only, owned QA server stopped (3000 free).
All consumed provider locks/scores preserved; no dependency/provider/commit/push/
deploy. Photo/file ingestion and general receipt extraction remain unimplemented;
no real OCR accuracy or physical-device claim. Next gate:
APPROVE SPENDSCAPE COLLEGE RECEIPT REVIEW INTEGRATION CHECKPOINT REVIEW.


### Receipt integration date/time visibility correction — 2026-10-04

The checkpoint review's Medium finding was feedback below the visible scroll
area for missing date/time/zone and shortened-screen reconfirmation. Under the
separate correction approval, one described error sits with the actual correction
control; failed Save/confirmation focuses it and reveals the whole group after
layout changes. Calendar-only UTC probing never chooses the saved timezone.
Time validation, explicit confirmation, facts, adapter/store schema and scanners
are unchanged. No receipt-photo/provider integration or physical-device claim.

Fresh QA: 296/296 unit (18 files), typecheck/strict QA/build/whitespace passed;
new EN/HE reduced-motion time-feedback cases 4/4; full receipt/data-boundary
production suite 20/20 (52.4s), direct barcode/8s Undo/late-save neighbors 6/6
(26.4s). No failures, retries, flaky cases or timeout/assertion weakening.
Inspected 360x640/420 EN/HE correction screenshots plus fresh 390 HE and desktop
1280 states. Fully-visible focus/error assertions cover missing zone/time,
confirmation, resize and DST gap/overlap; save/Undo preserve baseline pins/map.
Original 64/64 combined integration evidence remains retained separately.

Correction manifest (six, within the same ten-file integration slice):
ReceiptReviewDetails.tsx, PurchaseReview.tsx, CaptureExperience.module.css,
qa/spendscape-receipt-review-integration.spec.ts,
docs/spendscape/COLLEGE_RECEIPT_REVIEW_INTEGRATION.md, this appended handoff.
294/300 other protected inputs byte-identical, all consumed provider locks and
scores preserved. HEAD 6a9661b/main eee0d26/cached origin feature 66fb420 unchanged;
ahead 7/behind 0, index empty, unrelated dirty/untracked work retained. next-env
matches HEAD/pre-correction; ignored QA artifacts only, owned server stopped,
3000 free. No dependencies, credentials, provider calls, stage/commit/push/deploy.
Next gate: APPROVE SPENDSCAPE COLLEGE RECEIPT REVIEW INTEGRATION CHECKPOINT REVIEW.
