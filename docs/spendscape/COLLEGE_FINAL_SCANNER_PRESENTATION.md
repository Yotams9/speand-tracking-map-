# integration/final: receipt scanner presentation transfer — 2026-10-16

## Scope and provenance

Base: `646c6e6177b8ba4dcd8efdbfb14e11493f357447` (`integration/final`).
Source: `c3c49c8a2451e96ca2387e0db819768fbb37f8a0` (`codex/hosted-college-release-20261015`).
The user requested the shortest transfer of existing scanner code; no broad test suite or scanner benchmark was run.

Copied the hosted receipt adapter, Redis quota and provider policy, optional request authorization hook, and hosted intake/route wiring. The Gemini request builder, transport, strict decoder and financial review/save path remain unchanged. Barcode camera, catalog, team UI, IndexedDB migration, purchases and pins are unchanged.

Presentation adaptation: `SPENDSCAPE_HOSTED_MODE=presentation` permits same-origin receipt requests without an application login cookie. HTTPS client capability discovery no longer relies on a protected-layout marker. No proxy, login page or whole-site expiry gate was added. Existing `protected-demo` mode still requires its access cookie. Secrets remain server-only. Private local artifacts and test files are excluded from function traces/uploads.

## Minimal verification

- Production build and its application TypeScript phase passed on Node 22.14.0 with no provider credentials. The initial sandboxed attempt failed to fetch the existing Google fonts; the network-enabled build passed.
- `git diff --check` passed.
- Transport and response decoder match the source byte-for-byte.
- No new live receipt, address, price request, quota initialization/reset, phone test, push or deployment was performed in this transfer.

This proves the source builds; it does not establish hosted extraction readiness.

## Exact remaining activation

Reuse `spendscape-college-preview` (`prj_28lNdvbpPK3zNOrAq8C9hnuhupJS`), team `sk-dev3`. Keep the original `spendscape-college-demo` paused. Deploy this exact shared-branch candidate as Preview only after release authorization. No main merge is required.

The existing Gemini key/project verification and Redis REST variables must be configured for the deployment's Preview environment. Set presentation mode, the exact HTTPS origin and one explicitly approved finite provider quota. Existing `SPENDSCAPE_DEMO_*` policy variables and Redis policy hash must agree. Initialize only a new approved policy via `initializeRedisQuota` (SET NX); never overwrite/reset a prior session. The copied API policy retains its maximum two-hour provider window and finite request/budget caps; the application itself remains accessible after API expiry. Do not claim a new live allowance is approved merely because this code was transferred.

Required server settings (never NEXT_PUBLIC): `SPENDSCAPE_HOSTED_MODE`, `GEMINI_API_KEY`, `SPENDSCAPE_RECEIPT_PROJECT`, `SPENDSCAPE_RECEIPT_PROJECT_NUMBER`, `SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256`, `SPENDSCAPE_RECEIPT_PREPAY_CONFIRMED`, one complete Redis REST URL/token pair, and the policy origin/release/start/expiry/limits/ceiling/digest/access-hash fields defined by `demoPolicy`. Access hashes remain in the quota fingerprint for compatibility; no application login is needed in presentation mode.

Before presenting: GET `/api/receipt-capture-session` must return native capability with session.state `available` and remaining > 0. Then use one explicitly approved receipt, check the editable result, Save yourself and reload. No terminal is required by the person using the hosted site. Barcode camera needs HTTPS and browser camera permission. This transfer does not activate hosted address search or refresh/expand prices.
