# Overnight report — 15/16 October 2026

Branches pushed: **`fix/integration-review`** (from `integration/final` @ `646c6e6`)
and **`integration/candidate`** (fix branch + `origin/feature/savings-engine` @
`000e9f0`). Nothing pushed to `main` or `integration/final`, no force-push, no
branch deleted or renamed, no merge into anything else, no Vercel action, no
API key, no live provider, no `.env*` read, no package/lockfile change, no
catalog refresh. `origin/codex/hosted-college-release-20261015` (Shon) was only
read (`git show`).

## Results

| Suite | Before (646c6e6) | After: fix/integration-review | After: integration/candidate |
| --- | --- | --- | --- |
| Unit (`npm test`) | 1,152 · 1,059 pass · 93 fail | 1,182 · 1,089 pass · 93 fail | 1,236 · 1,143 pass · 93 fail |
| `qa/integration.config.ts` | 110 · 82 pass · 28 fail | **117 · 117 pass** | **117 · 117 pass** |
| `qa/college-m1.config.ts` (ordinary-user) | 13 · 1 pass · 12 fail | **13 · 13 pass** | — (not re-run; no app change touches it) |
| `qa/savings.config.ts` | — | — | **4 · 4 pass** |
| typecheck / build | pass | pass | pass |

The 93 unit failures are the known Windows `EPERM` ones, all in `src/server/*`
and `src/features/receipt-image/*`; none elsewhere, before or after. The
college-m1 "before" failures were measured against a clean build of `646c6e6`
(same 12 tests fail there), so none were caused by this work.

Integration per spec (after): address-search 13, contrast 4, first-run 4,
walk 4, legacy-migration 2 (new), local-directory 12, nearby-demo 10,
night-shots 8, purchase-backup 10, receipt-review-integration 17,
review-fixes 5 (new), scanner-e 28.

## Phase 1 — review fixes on `fix/integration-review`

| Fix | Commit | What changed |
| --- | --- | --- |
| 1 legacy import per purchase | `162cff6` | A demo-store purchase or invalid record is left out and counted (`fixtureSkipped`/`invalidSkipped`); the rest imports. Each purchase goes through the same rebuild, exact-facts check and write validator; stores used only by left-out purchases are pruned; final envelope still validated; empty-only restore and old key untouched. |
| 2 store list unavailable | `adb5795` | `catalog-unavailable`: nothing written, store stays empty, loading state kept (saving blocked), "Try again" / "Continue without importing" (`skipped-by-user`, notice until dismissed). No append path (your instruction). |
| 3 imported marker | `ccc0715` | Marker re-read before writing; `imported` never replaced. |
| 4 suggested branch | `b501cee` | `locationSuggested {confirmed}` on the catalog intent; Save blocked until "I confirm this purchase was at this branch" (he/en). Also for a suggested branch that is already a saved place. |
| 5 wording | `8388222` | "merchant"/"בית עסק" → "store"/"חנות" in user-facing strings (OCR receipt keywords left as they are). |
| 6 stale spec | `382645c` | college-m1 home card + catalog lookup text; dead "not connected" override removed. |
| 7 price follows store | `9e3f8f6` | Form-only `publishedFill`; auto price/total follow the store; typed values never change; store without price clears auto values; auto total follows item edits; integer agorot (3 × 7.90 = 23.70). |

## Review rounds (independent subagents, each saw only branch + diff + fix list)

- Round 1 → `095aaa7`: **the "Try again"/"Continue" banner was unusable** (outside
  the modal loading dialog → inert). Moved into the dialog; new browser spec
  `spendscape-legacy-migration`. Also: retry waits past the 15 s fetch abort,
  marker re-checked before restore, channel/store change clears auto price.
- Round 2 → `741b976`: set-aside new branch lost its store; online store list
  did not cancel GPS; auto-chosen ILS now reverts. Nothing serious otherwise.

## Phase 2 — layout bugs (`c050a54`)

- 360×420 location form: the app's 520 px minimum height made the absolutely
  placed form run off-screen. Form is now `position: fixed` to the viewport,
  footer buttons share one row, bottom scroll padding keeps focus clear of the
  footer. Measured: form 8–412 px of 420; error, checkbox, Save all visible.
- 1280×720: Ask status (z 71) covered the timeline sheet (z 65); while a modal
  sheet is open the status now sits below its backdrop.
- Spec `spendscape-review-fixes` asserts both (in viewport and not covered).

## Phase 3 — Shon's three bugs, checked on our branch

| Shon | In ours? | Result |
| --- | --- | --- |
| 951e75f weighted legacy rounding | No | Old `Math.round(price×qty)` and our integer half-up give the same totals; 5 of his cases import unchanged (`71e225b`, test only). |
| 4d5e09a clearing a catalog proposal loses details | Yes (equivalent) | A half-typed new store replaced by a branch/saved place now comes back on "New store"/"Choose…", place unconfirmed (`07256bb`, `6cc83a1`). |
| 31f271d explicit GPS suggestions | Partly | Both buttons existed; late GPS answers could override a manual choice or typed coordinates — now ignored (`07256bb`, `741b976`). |

## Phase 4 — specs and push

`origin/qa/receipt-directory-specs` existed and was merged (`1acd4d4`, specs
only, matches the current UI). scanner-e insecure-origin test uses the
configured server (`534a77c`). college-m1 fixed for Hebrew start, receipt
pre-fill and Stats first-run card (`b9207c4`, `f0c6332`). Integration
**0 failures** (baseline 28). Report §8 updated (`03a2a94`).

## Phase 6 — `integration/candidate`

`git merge origin/feature/savings-engine` (`085560f`): **no conflicts** — the
expected `CaptureBarcode.tsx` overlap merged automatically; checked by hand: the
removed "not connected" copy stays removed and `BarcodeBranchCompare` +
distances are present. `next.config.ts` keeps all three catalog traces;
`SpendscapeGlobe.tsx` has the savings panel. Interactions
(`candidate-integration.test.ts`, `d35385e`): (a) suggested + confirmed branch
→ basket with that `storeId`; (b) migrated chain purchase → origin
`ramilevi-733`; (c) demo/fixture → no panel; (d) savings spec 4/4 covers the
barcode "your branch" comparison and the store→price→save→panel flow.

## Phase 7 — deployment readiness (`cf78ba3`, `ee10d59`)

- Receipt (`/api/receipt-*`) and address-search routes: new `localOnly` guard →
  `404 {"status":"disabled","code":"local-only"}` when `VERCEL` is set or the
  request is not loopback; tested for all five routes (no 500, no stack text,
  fetch never called). Local behaviour unchanged.
- Traced files: catalog ×2 + savings include `data/catalog/tel-aviv.json`
  (checked in `.next/**/route.js.nft.json`); `deploy-readiness.test.ts` guards it.
- No env var for the ordinary app; fonts self-hosted via `next/font`; tiles from
  openfreemap (`access-control-allow-origin: *`).
- `docs/spendscape/DEPLOY.md`: project, settings, Preview URLs, checklist.

## Decisions made alone

- Fix 1: `unknown-store` (branch gone from catalog) and duplicate sequence
  numbers are per-purchase skips; first copy wins, as in the old build.
- Fix 4: a suggested branch that is already a saved place also needs the box.
- Fix 7: auto total also follows price/unit/discount edits (not only quantity),
  so it never contradicts the line; non-ILS and multi-line untouched.
- Restored (set-aside) places always need confirming again.
- Disabled local-only routes answer 404 (not 503) on hosted; the inner
  handlers' local 503 is unchanged.
- college-m1 was run on its own config (ordinary-user project); the
  `isolated-fixture-regressions` project was not part of the request.
- Two long integration runs were stopped early when the code under test had
  already changed; the final runs above are complete.

## Reverted / open

Nothing reverted. Open: no real-phone camera/GPS check (needs an HTTPS
Preview); chain-place addresses are not re-verified against the catalog at
save/restore; the 93 Windows unit failures.

## Run the candidate locally

```
git fetch && git switch integration/candidate
npm.cmd ci
npm.cmd run build
npx.cmd next start -p 3000 -H 127.0.0.1
```

Then open http://127.0.0.1:3000 (QA runs: see INTEGRATION_REPORT.md §10).
