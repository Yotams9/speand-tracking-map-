# College Milestone 5, slice 1 — local purchase backup and restore

Completed offline implementation/QA: 14 October 2026. Checkpoint finalized:
15 October 2026. Base: 7b3f37b6669c5aec4ddf8562a73f58b870bf1463,
feature/spendscape-rebuild. **Backup and restore ready; full Milestone 5 remains open.**

## User flow and contract

After intentionally loading the updated build, open **On-device data & privacy**.
Choose **Download JSON backup** to explicitly export the current durable ledger.
The private, unencrypted file contains saved structured purchases, merchant/place
associations, existing confirmation metadata, decisions and sequence metadata.
Keep it securely; it includes confirmed coordinates and addresses. It contains no
receipt photos, raw provider responses, credentials, diagnostics or temporary
product matches. There is no upload, cloud service or automatic backup.

In an empty destination, select that file. Full validation and an integrity check
precede the count preview; selecting a file writes nothing. Review the purchase,
merchant, place and unresolved-location counts, check confirmation and explicitly
restore. Nonempty destinations cannot restore: no replacement or merge. Cancel
or close clears the temporary inspection. Never delete the real ledger just to
test restore; use a separate empty browser profile/origin for an intentional copy.
The currently running port-3172 build was deliberately not replaced by this task.

Version 1 envelope wraps the validated v4 ledger and referenced historical
merchant/place facts. Supported v1–v3 ledgers are validated before existing
in-memory migration. Unknown versions, invalid graphs, extra/duplicate keys,
corruption and incompatible historical references fail closed. Historical
references must match the destination's trusted baseline exactly; no invented
replacement entities or confirmation defaults. Synthetic flags remain synthetic
and hidden in ordinary use. SHA-256 detects accidental change; it is not a
signature, authentication or factual verification.

The file cap is 8 MiB UTF-8 bytes (including wrapper, Unicode and references),
replacing the earlier proposed 2 MB file cap. The existing 2,000,000-character
ledger limit and all financial validation remain unchanged. IDs, printed item
values, discounts, final payable, dates, unknown context and place provenance are
preserved. Source revision is not copied over the destination's concurrency
revision. The single IndexedDB transaction checks the actual destination is
empty and its revision still matches; it increments that revision and preserves
monotonic sequence. Existing decisions/directory entries also make a destination
nonempty. Empty deletion tombstones are supported; revision overflow is rejected.
Hydration/inspection is read-only, and failure never reports a successful restore.

## Verified evidence

Fresh HEAD-only candidate plus exactly the scoped runtime/QA files:
artifacts/college-backup-6tqostgv/app. Evidence is isolated synthetic data;
no real export/import, receipt read, provider call or scanner retest occurred.

- 108/108 focused unit tests, eight files (unit-verified.log).
- Application and focused QA/unit TypeScript checks passed
  (typecheck-verified.log, qa-typecheck-verified.log).
- Production build passed (build-verified.log).
- 10/10 production-browser scenarios passed in 9.5 seconds
  (browser-verified.log and browser-verified/): downloaded-file round trip,
  exact facts/reference preservation, no-write preview, explicit confirmation,
  shared canonical pin, reload, occupied destination/repeated restore refusal,
  invalid/unsupported/corrupt/oversize rejection, cancel/close cleanup, aborted
  transaction rollback, destination filled after preview, stale revision,
  tombstone/sequence and revision overflow.
- EN/HE layouts at 360/390/430/1280 widths checked for overflow. Final 360 EN
  and 390 HE previews visually inspected; readable counts, confirmation and
  actions; file chooser has a 44px minimum target. One mounted map retained.
- Synthetic four-record graph covers unknown context, weighted/unresolved and
  online purchases, discounts, independent line/final totals, Unicode and
  shared confirmed-place metadata. External provider routes blocked in QA.

Earlier evidence is retained: initial QA fixture type error (missing typed source
metadata), and a regression demonstrating that undefined optional baseline
metadata changed a checksum after JSON serialization. Both were corrected;
references now omit undefined values consistently without inventing metadata.
No validation weakening. Final logs above cover the corrected source. Interrupted
write testing proves transaction abort rollback, not every hardware/crash mode.
Browser emulation is not a physical-device test or a real-ledger restore claim.

## Exact slice manifest

- README.md
- docs/AI_HANDOFF.md — appended slice status only
- docs/spendscape/COLLEGE_FINAL_MILESTONES.md — appended slice status only
- docs/spendscape/COLLEGE_SUBMISSION_READINESS.md — appended superseding status only
- docs/spendscape/COLLEGE_PURCHASE_BACKUP.md
- src/features/globe/SpendscapeGlobe.tsx — LocalDataPanel backup props only
- src/features/local-purchases/LocalDataPanel.module.css
- src/features/local-purchases/LocalDataPanel.tsx
- src/features/local-purchases/PurchaseBackupControls.tsx
- src/features/local-purchases/local-purchase-store.ts
- src/features/local-purchases/purchase-backup.ts
- src/features/local-purchases/purchase-backup.test.ts
- src/features/local-purchases/useLocalPurchases.ts
- qa/purchase-backup-fixtures.ts
- qa/purchase-backup.config.ts
- qa/spendscape-purchase-backup.spec.ts

Exact patch/hashes: artifacts/college-backup-6tqostgv/manifest.json and PROPOSED.diff.
Unrelated research/server configurations and earlier handoff/milestone edits are
excluded. Protected main refs, next-env.d.ts and historical reservations/evidence
remain unchanged. Real origin/server and saved ledger were not used for QA.
Vercel remains paused; no dependency, cloud, push or deployment changes.

## Remaining submission work

Load this build safely when the user is ready; any manual real-file round trip
must use an empty separate destination and explicit confirmation. Reusable local
address-search startup remains a separate slice; live activation needs its own
allowance. Fresh price collection needs separate approval; expired data must stay
unavailable. Final physical-mobile/submission checks remain. Scanner checkpoint
stays closed: real repeated-capture duplicate prevention is unverified. City
comparison remains completed with radius/distance deferred. This slice does not
reopen those gates or declare all Milestone 5 ready.
