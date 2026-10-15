# Isolated main integration — 15 October 2026

Review candidate only. The user explicitly authorized an isolated integration
checkout, compatibility fixes, mocked local QA and local integration commits.
The original feature worktree, original main checkout and running app are not
replaced. No main update, push, PR, deployment or provider request is authorized.

## Inputs and recovery

- Feature: `c481edb0b8da36c76d375dda00d0d71318b0fc13`.
- GitHub main: `69506d22b6497dec0ecb4abd5979c98260ba4b25`, rechecked unchanged
  with `ls-remote` before the candidate commit.
- Merge base: `66fb4204154c88789e9e0401e317f9000b6b5e18`.
- Original local main: `eee0d26b55e5061f87ac664938df0c195800b74f`.
- Candidate branch: `codex/spendscape-main-integration-20261015`.
- Recovery refs: `refs/codex/integration-20261015/{feature,main,original-main}`.

The first fetch also refreshed cached origin/main through Git's configured
refmap; it was restored to its entry SHA. The local main branch never moved.
Subsequent fetch used an empty refmap. A partial-clone missing-blob failure was
resolved by fetching the same pinned main without a filter, without changing
inputs or taking code from another branch.

Entry evidence: original feature `artifacts/main-integration-ovdt9_en/entry.json`
and its dirty diff. All eight modified tracked files and 117 untracked files
were excluded from integration inputs, individually hashed and left in place.
The evidence includes 239 historical-file hashes and 54 additional reservation/
lock-metadata hashes. The original main checkout was clean and remains clean.
The user's provider-disabled port-3172 app was neither restarted nor reloaded.

## Conflict decisions

Eight textual conflicts were resolved:

- `CaptureBarcode.tsx`: retain main's server-local catalog lookup; restore the
  feature's explicit synthetic-QA gate and preserve identification-only behavior.
- `CaptureExperience.tsx`, `PurchaseReview.tsx`, `session-purchase-domain.ts`:
  retain the feature's receipt/financial/review contract. Port store selection
  through the canonical local directory, not a competing save implementation.
- `SpendscapeGlobe.tsx`: retain IndexedDB, real-user graph, date/location/backup
  and comparison behavior; port main's supermarket source/layers separately.
- `SpendscapeAnalytics.tsx`: retain actual-purchase-derived filtering/analytics.
- Scanner B/E QA files: retain the feature's isolated synthetic-QA expectations;
  combined ordinary catalog/storage coverage is in the new integration suite.

Main's price-to-paid-price autofill was deliberately not carried forward.
Choosing a store proposes a location, never a paid amount, quantity, date or
payment context. Actual paid facts remain explicit and financially validated.
No Gemini request builder, model, transport, historical launcher or reservation
was changed. No dependency or package-lock change was needed.

## Storage compatibility

IndexedDB remains the authority for new writes. Envelopes v1–v4 are completely
validated before an in-memory-only migration to v5. Hydration does not write.
The v5 envelope adds a separately validated `legacyMain` archive of main's
`spendscape.device-purchases.v1` localStorage ledger. The source key is never
modified or removed by this integration.

Main's former partial-salvage loader was replaced by complete validation:
malformed records, unsupported versions, duplicate IDs, invalid references,
invalid known values and unexpected fields reject the entire legacy ledger.
No record is silently dropped. Original purchase/directory IDs, timestamps,
amounts, descriptions and provenance remain unchanged inside the archive.
Each ledger retains its own two-million-character bound; the combined envelope
can carry both. Native record/revision/sequence and financial validation remain.

For display only, colliding legacy purchase/evidence IDs and legacy-added
merchant/place IDs receive a reversible `legacy_main:` prefix. Identical known
historical directory references are shared; coordinates or financial similarity
are never used to guess that two independent records are the same purchase.
Two different ledger records with a colliding ID are retained independently.
Repeated loading does not append/import duplicates.

The archive enters IndexedDB only with a successful explicit native transaction
or confirmed backup restore. Backup carries both ledgers and original IDs;
restore remains atomic and empty-destination-only. An occupied legacy ledger
also makes the destination nonempty. Abort, revision conflicts and invalid files
leave prior data intact. Legacy source changes block stale writes rather than
replacing either ledger. There is no cross-store atomic lock against an already
open old-main application; divergent histories require explicit reconciliation.

Legacy main purchases are **read-only** in this candidate. This avoids rewriting
old provenance through the newer editor. They remain visible in Purchases,
Stats, search, place details and backup. Erase-all is disabled when an archive
is present, with an explanation, to avoid silent source deletion/reappearance.
Native feature purchases retain editing, location/date correction, deletion and
Undo. Legacy place metadata is not upgraded to new confirmation provenance.

## Catalog and geography

The exact catalog blob from pinned main is retained: 40 Tel Aviv stores and
30,603 products. Barcode identity lookup and explicit store selection use local
API routes over that file, without a new retailer/provider request.

Published shelf prices remain reference data. Their raw local publication times,
generation time and source attribution are preserved. The catalog lacks a
qualified publication timezone and per-item update timestamps; neither is
invented. Its 4 October publications are expired on this review date. The UI
shows an unavailable-current-price warning and labels retained prices historical.
No shelf price is assigned as a paid amount or used for savings.

Catalog context circles/labels use their own MapLibre source, separate from
purchase pins, clustering, heat and spending totals. A fresh user has zero
purchases and zero purchase pins even when catalog context is loaded. Only
explicit store/location confirmation creates a purchase place through IndexedDB.
The existing map is reused; OpenStreetMap location attribution remains visible.

The Petah Tikva city comparison remains independent, with explicit temporary
product/package matching, branch/source/publication/fetch/item-update clocks,
partial coverage and expiry. Tests simulate its original fresh publication
window and then expiry. That is not a claim of fresh prices today. Distance/
5-km qualification remains deferred; no branch pins or inferred distances added.

## Verification

Evidence directory: `artifacts/integration-20261015/` in the candidate worktree.

- Complete serial unit suite: **1,120/1,120 passed**.
- Application and new integration-QA TypeScript checks: passed.
- Production build: passed using installed Next's supported `--webpack` option.
  Default Turbopack refused the QA-only external node_modules symlink; the
  original failure is retained. No packages were installed or changed.
- Final production-browser acceptance: **30/30 passed**.
- EN/HE mobile rendered inspection: catalog lookup, store proposal, receipt
  review, date correction and backup preview; no document-width overflow.
- Whitespace, exact staged-tree manifest and preservation checks: recorded in
  the evidence manifest before the local candidate commit.

Browser checks use isolated profiles at port 3196, synthetic ledgers/images and
mocked receipt/address endpoints. They cover empty ordinary use; actual retained
catalog lookup/store selection; strict review/save; no shelf-price autofill;
duplicate blocking; both-ledger ID collisions; read-only hydration; successful
explicit v4-to-v5 write; repeated load; conflict/error protection; backup/restore,
abort/reload; date correction/Undo; location confirmation/View place; one map;
city matching and expiry; EN/HE mobile layouts. No real ledger was used or edited.

Earlier evidence is retained: initial full merge run 1,081/1,126, focused
compatibility 124/124, intermediate full run 1,117/1,117, then 1,118/1,119 under
concurrent load with an unchanged operational-timeout test failing before its
mock dispatch. Final serial run passes without changing that test. First browser
run was 17/20 (readiness assertions/stale-change classification); a later new
city-test selector error was corrected in QA. Subsequent 23/23 and 29/29 runs
passed. Timing variability is not claimed to have disappeared.

## Review gate and limitations

Candidate integration is local and mocked-provider tested. It does not revalidate
receipt recognition accuracy, reopen the closed receipt benchmark, establish
real repeated-capture duplicate prevention, verify a physical phone, refresh
prices, qualify old catalog coordinates independently or authorize publication.
The original local app and real stored purchases remain on their current build.
Review the isolated candidate before separately authorizing any main update.


## Authorized final-review corrections — 15 October 2026

The final review of merge `30c82840183271bec70702e66c0087014dbefb68`
found three defects, retained in the separate ignored final-review evidence.
All three are now corrected on the isolated integration branch:

- Legacy line validation uses the existing integer minor-unit, half-up helper.
  Original unit prices, quantities, line totals and purchase amounts are never
  rewritten. Native validation is unchanged. Five exact cross-input reproduction
  cases pass; altered printed amounts and malformed precision remain rejected.
- No selection reverses unchanged catalog-derived merchant/place values, restores
  prior independently entered values and retains subsequent independent edits.
  Partially cleared place facts require reconfirmation. Clearing a selected
  already-saved catalog place also restores prior review details. No persisted
  purchase or directory record is modified by selecting or clearing a proposal.
- Restored Find the store I'm in and Use my current location. Both read browser
  geolocation only on press, once, with a 10-second timeout and no automatic
  retry. Nearest within 200 m is a suggestion requiring a separate Review action;
  it does not auto-select, confirm or save a place. GPS point updates reset
  confirmation and catalog attribution. Denial/unavailability leaves manual and
  unresolved alternatives. Edits, closing/unmount and timeout invalidate pending
  callbacks. No raw GPS read is persisted; only explicitly confirmed place facts
  can enter the existing atomic save boundary. GPS is never purchase proof.

New evidence: `artifacts/integration-fixes-20261015/` (fresh isolated data).
Serial unit suite **1131/1131**, final production-browser **40/40**, application
and integration-QA typechecks, webpack production build and whitespace pass.
Browser scenarios mock all geolocation/receipt/address responses; no real GPS or
external provider call. They cover the three corrections plus both-ledger
hydration/reload, native review/save, duplicate protection, date/Undo, backup/
restore/interruption, shared pins, city-price expiry and EN/HE mobile layouts.
Earlier 28-pass/3-fail/9-not-run browser evidence is retained: two new map-count
assertions ran before readiness, and a backup harness output variable was absent.
Corrected readiness waiting and supplied isolated output settings, without
weakening the assertions. Original unit/type-check development failures remain.

Exact cumulative scope (13 files):
`src/features/capture/{session-purchase-storage.ts,CatalogStoreReview.tsx,
PurchaseReview.tsx,MerchantPlaceReview.tsx,catalog-stores.ts,catalog-stores.test.ts,
useReviewGeolocation.ts}`;
`src/features/local-purchases/main-integration.test.ts`;
`qa/spendscape-integration-fixes.spec.ts`;
`playwright.integration.config.ts`; `tsconfig.integration-qa.json`;
this appended review section; appended `docs/AI_HANDOFF.md` section.

Re-review verdict: **Pass for the three authorized fixes and affected local
integration flows.** The original main/feature worktrees, protected refs,
next-env bytes, real ledger, port3172 and historical reservations are preserved.
Provider request paths and frozen launchers are unchanged. No push, PR, main
update or deployment. Legacy purchases remain read-only; divergent old-main
changes still require reconciliation. Prices remain expired/unqualified as
current quotes, radius qualification stays deferred, and physical-phone/real
GPS accuracy and real repeated-capture duplicate coverage remain unverified.
