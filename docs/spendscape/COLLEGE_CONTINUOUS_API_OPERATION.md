# Continuous receipt and address API operation — 2026-10-16

## Authorization and release boundary

The user explicitly requested removal of application API usage restrictions, then requested continuation from the usage-limit interruption. This local implementation removes the application request-count cap, receipt cooldown, session expiry, duplicate-image reservation block, persistent failure latch and application spending ceiling in a separately selected continuous mode. It does not change provider account plans, provider quotas, provider billing configuration or Vercel access protection. Provider charges and provider-side failures can still occur. Publishing and live activation remain a separate release approval.

Base: integration/final `3b6703a36364b6bbbbe6f6fae19cbe85750b4db6`.

## Implementation

- Set `SPENDSCAPE_API_USAGE_MODE=continuous` on the existing Preview only after release approval. Existing hosted mode must be `presentation`, the configured HTTPS origin must match, and the existing private keys/project readiness must verify.
- Receipt and address GET availability use `mode: native-service` without invented remaining-count, budget or expiry values. The receipt intake accepts that mode and displays recognition failures without claiming a depleted session. Address search already supports an available service without session counters.
- Explicit POST requests call the existing Gemini JSON request/decoder or the existing Geoapify address-only transport. An explicit request is one provider call; there is no automatic retry, automatic receipt save, automatic address search, automatic candidate selection or automatic pin save.
- Continuous operation never reads, initializes, clears or writes historical Redis quota records. The historical bounded mode remains selectable when the continuous setting is absent, without reopening any consumed reservation. No usage-counter database is required by the continuous request path.
- Same-origin checks, server-only credentials, image/address validation, response bounds, cancellation and request timeouts remain. Purchase financial validation, duplicate-purchase checks, save/Undo, confirmed location persistence and backup formats are unchanged.
- The service has no application spending ceiling. Existing provider account controls remain outside this change. No account upgrade, paid overage configuration or new service is authorized by this code.

## Verification

- Twelve offline backend contract checks passed, including twelve identical explicit receipt reads and twelve identical address searches after the old session expiry; no quota port was touched. A provider failure dispatches once and a later explicit request can succeed. Wrong-origin requests, invalid images/address input and invalid credentials still reject before dispatch. The receipt provider request is identical to the existing request builder.
- Existing bounded address and receipt-repeat contract checks passed unchanged. Their consumed-reservation behavior and quota policy remain intact.
- Four isolated browser checks passed across EN/HE: repeated explicit reads/searches, no quota/expiry banner in service mode, non-latching failure, full reviewed city/country submission, explicit location confirmation, single-purchase preservation and synthetic pin save/reload.
- The first browser attempt omitted a wait for map readiness. After adding that wait, functional assertions passed but test teardown reported an in-flight asset fetch. The final run unregisters routes before closing and exits successfully. These harness failures are retained with the final evidence; no application map change was needed.
- Application typecheck, production build and whitespace checks passed. Providers were mocked and the user's real ledger/form were not opened or changed. The temporary preview was stopped.

## Remaining release work

After approval: publish this exact commit to integration/final, set only the continuous-mode Preview environment flag, deploy to the existing spendscape-college-preview project, wait for READY and update the same presentation alias. Verify both availability GETs report native-service without submitting an image/address. Keep original Production paused and main unchanged. A user must finish or cancel an open draft before refreshing the page to load the new receipt intake.

This checkpoint does not claim a live receipt recognition result, a geographically correct new address result or a real new pin save.
