# Protected college demonstration — hosted preparation

Date: 15 October 2026, Asia/Jerusalem.

## Authorization and exact boundary

The user selected a protected demonstration for the owner and lecturer, with limited use. After automatic approval review rejected an insufficiently scoped hosted-provider patch, the user explicitly authorized **implementation and mocked verification only** of Gemini receipt processing, Geoapify address searches and Redis usage metadata. The rejected patch was not applied. No live connection, credential access, account creation, paid plan, source collection or deployment is authorized by this checkpoint.

Base: reviewed integration `31f271d39be4c84e181caa2d971fe3d051d3c3f1`.
Separate branch: `codex/hosted-college-release-20261015`.
Original integration/rebuild/main checkouts and ports 3172/3197 remain outside this slice.

## Implemented

- An opt-in private-access gate and bilingual mobile entry page. Two separate 256-bit random invitation capabilities are represented only by SHA-256 digests in server configuration. This is invitation access, not user accounts or cloud synchronization.
- Codes are submitted in a bounded same-origin POST, placed in an HttpOnly, Secure, SameSite=Strict host cookie, never in a URL, response body or purchase backup. Local synthetic QA uses an explicitly separate non-secure cookie; that mode is refused on Vercel/CI. Real codes must be privately generated from cryptographic random bytes, never copied from public test fixtures.
- Whole-app/API protection plus independent authentication and origin checks inside the receipt/address adapters. The exact configured HTTPS origin is required. Missing/invalid settings and expired access fail closed. Sign-out is available through privacy controls and the access page; it clears access, not saved purchases.
- Hosted adapters preserve the successful Gemini request builder, output token cap, strict decoder, financial review, user Save, address normalization and place confirmation. Existing local operational paths and historical launchers remain intact.
- The hosted browser path discovers capability and includes its same-origin access cookie. It retains explicit Read; no query opt-in, automatic extraction, retry or save is introduced.
- Redis REST commands use server-only authorization and an allowlisted HTTPS host. Runtime uses one EVAL operation to reserve the shared receipt/address allowance, identify replays, serialize concurrent requests, enforce receipt spacing and charge the conservative existing per-read reservation before dispatch.
- Redis state contains only policy/counters, keyed one-way request digests and coarse outcome state. No image, receipt observation, address, product, payment, access code or provider key is stored there. Identity data is not uploaded.
- Quota initialization is a separate administrative `SET NX` with absolute expiry. Runtime never initializes, deletes or resets missing quota records. Missing records and unresolved in-flight reservations block dispatch. An acknowledged failure stops that capability. Reservations are never refunded; policy/capability changes invalidate old state rather than silently resetting allowances. If a terminal Redis write commits but its acknowledgement is lost, the stored terminal state may already exist; inspect state before operational continuation. Real acknowledgement-loss behavior has not been exercised.
- Metadata responses are projected to an allowlist; external error text is not exposed. Input, response, function and request time bounds remain enforced.

## Configuration — names only, no active values

Private access:

`SPENDSCAPE_HOSTED_MODE=protected-demo`, `SPENDSCAPE_DEMO_ORIGIN`, `SPENDSCAPE_DEMO_RELEASE_ID`, `SPENDSCAPE_DEMO_START_AT`, `SPENDSCAPE_DEMO_EXPIRES_AT`, `SPENDSCAPE_DEMO_OWNER_SHA256`, `SPENDSCAPE_DEMO_LECTURER_SHA256`, `SPENDSCAPE_DEMO_DIGEST_SALT`.

One shared allowance for both visitors:

`SPENDSCAPE_DEMO_RECEIPT_LIMIT` (0–10), `SPENDSCAPE_DEMO_ADDRESS_LIMIT` (0–10), `SPENDSCAPE_DEMO_CEILING_MICRO_USD` (at most 500000 and covering all reserved reads). At least one capability must have a nonzero limit. Access lasts at most two hours and is bound to an exact origin and release policy. Do not change the release ID to bypass an exhausted allowance.

Quota adapter candidate:

`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. No resource exists or is connected by this change. `initializeRedisQuota` is an administrative preparation function; no public route calls it. Initialization and verification against a real Redis service require a separately approved connection. The token is never public or a query parameter.

Receipt readiness, in addition to a configured allowance:

`GEMINI_API_KEY`, `SPENDSCAPE_RECEIPT_PROJECT`, `SPENDSCAPE_RECEIPT_PROJECT_NUMBER`, `SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256`, `SPENDSCAPE_RECEIPT_PREPAY_CONFIRMED`. Existing project verification, pricing validity and Prepay readiness must be established privately at activation. The existing conservative 35400-micro-USD reservation is reused; no claim of a provider-enforced dollar spending cap is made.

Address readiness:

`GEOAPIFY_API_KEY`, `SPENDSCAPE_ADDRESS_FREE_READY`. Establish current project/Free allowance/no-paid-overage and approve the exact shared request count before activation.

Do not add secrets to `NEXT_PUBLIC_*`, source, screenshots, trace files or chat. Keep real production configuration separate from synthetic QA; `SPENDSCAPE_HOSTED_DEMO_TEST=synthetic` is local-only and cannot activate on Vercel.

## Verification and evidence limits

Focused tests exercise both roles, invalid/expired policies, exact origin/host checks, secure cookie attributes, login/logout, malformed input, unchanged provider request format, quota refusal, duplicate/concurrent handlers, timeout/late response, failed dispatch, metadata projection and initialization without reset.

Production-browser QA runs only at `http://127.0.0.1:3206` with the restricted synthetic startup `node tools/hosted-demo/start-offline-qa.mjs`. It has no provider/Redis keys and inherits no other provider configuration. Receipt success is intercepted with explicitly fictional observations; no real receipt is uploaded or saved. Ports 3172 and 3197 are untouched.

Initial build failure came from an external dependency symlink rejected by Turbopack. Existing dependencies were locally cloned; no package was downloaded or added. Initial browser failures reproduced the local Next URL alias and `no-referrer` form-origin issue. Production HTTPS checks were not relaxed; `same-origin` document policy preserves legitimate form Origin while withholding cross-origin referrers. A later harness selector matched Next's own route announcer and was narrowed. Initial failure evidence remains under `artifacts/hosted-demo-qa/{initial-results,origin-policy-results,selector-results}`.

Mocked tests do **not** establish live Google/Geoapify readiness, real Redis script execution, cross-instance persistence in a deployed environment, physical phone behavior or hosted TLS/access acceptance. Verify those with separately bounded calls after resource/activation approval. No physical-device or live OCR accuracy claim is made.

Final offline checks: **1167/1167 serial unit tests** (36 new focused tests), **8/8 production-browser scenarios**, application and focused test typechecks, production build and whitespace. Visual inspection covered entry at 360/430/1280 pixels and the Hebrew privacy panel at 390 pixels. The final browser scenarios used the final production build. The first 7/7 browser run and isolated 1/1 Hebrew check were followed by the final combined 8/8 run; earlier failures remain preserved.

Exact source hashes, scope, QA and initial failure notes are recorded in `artifacts/hosted-demo-checkpoint-20261015/manifest.json`. Synthetic QA port 3206 is stopped after verification; no ordinary preview is activated by this document.

## Remaining work before a working release

1. Approve and connect a shared quota resource with verified plan/region/limits and no paid upgrade. Store only the metadata above; do not migrate purchases to that service. Exercise the actual EVAL script, absence/corruption, NX initialization and concurrent reservations in a test namespace before enabling providers.
2. Privately configure invitation capabilities and existing provider keys on the agreed Vercel project/environment. Approve finite live allowances and the exact receipt image before sending it. Actual user purchase/place Save remains explicit.
3. Prepare and authorize certificate-verified price refresh. The inherited FTPS catalog collector disables certificate checking; do not use it as-is. Existing price snapshots remain expired. Nationwide and radius comparison remain unimplemented; no new price or distance claim is authorized by this slice.
4. Perform an access-protected hosted preview and bounded end-to-end checks, then an approved GitHub/PR/main/release sequence. Do not enable Vercel billing/add-ons or unpause the existing project implicitly.

Moving from localhost to a hosted origin does not transfer browser purchases. Use the existing user-controlled backup/restore when an appropriate empty destination is explicitly chosen. Sign-out does not erase on-device data. Legacy main purchases retain their documented read-only limitation.

## References

- [Vercel function runtimes](https://vercel.com/docs/functions/runtimes): local file reservations are not a hosted durable quota store.
- [Upstash REST API](https://upstash.com/docs/redis/features/restapi): server-side JSON command transport. Credentials/resource examples on external pages are reference data, never authorization to provision.
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection): Hobby Standard Protection does not protect the production domain. The application access gate must not be replaced by that assumption.

No new runtime dependency, provider call, account, resource, credential connection, price download, push, PR, main update or deployment is part of this checkpoint.
