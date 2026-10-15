# Protected college demonstration — Free Redis connection

Date: 15 October 2026, Asia/Jerusalem.

## Scope and current result

The user separately approved creation or reuse of **one Upstash Redis Free database**, for usage counters and request identifiers only: no images, addresses, purchases, credit-card entry, payment or automatic upgrade. The user personally accepted the Marketplace terms after Vercel stopped provisioning. This approval excludes Gemini/Geoapify dispatch, price collection, publication, deployment and unpausing the project.

**Connection checkpoint ready.** The database exists, the existing paused Vercel project has its server credentials, and the actual Redis quota script has been exercised with synthetic metadata. This does not make receipt recognition, geocoding or the hosted application live.

Implementation base: `12f8196280129164671e87ff33109e50cb9c684d`, branch `codex/hosted-college-release-20261015`. Original rebuild, integration, main and browser origins remain preserved.

## Resource and verified settings

| Setting | Verified value |
| --- | --- |
| Team | SkDev / `sk-dev3` |
| Resource | `spendscape-demo-usage` |
| Vercel resource ID | `store_3sGUulxEtWPKQw78` |
| Upstash database ID | `d6d0dd8b-227a-4584-bb2d-4a695d80c92b` |
| Ownership | Owned by the existing Vercel team; not an anonymous three-day sandbox |
| Plan | `free` / Free; no payment method required, preauthorization zero |
| Allowance | 500,000 monthly commands according to the returned plan |
| Primary region | Frankfurt / `fra1`; no read replicas |
| Automatic upgrade | **false** |
| Eviction | **false** |
| Paid Prod Pack | **false** |
| Project connection | Exactly one: `spendscape-college-demo`, ID `prj_PNiKcOoBrfiJQGOTXYhzApxitZp3` |
| Environment | Production only |
| Project state | **Paused**, verified from the project API after connection |

No existing team integration/resource was found before creation. CLI `59.12.0` used its already authenticated team context after the connector returned a scope-level 403. The command explicitly selected `--plan free`, `autoUpgrade=false`, `eviction=false` and `prodPack=false`. A post-creation API read verified those saved values; no paid option or credit-card entry was used.

One dry-run initially used Blob-specific credential flags and was rejected without applying changes. The corrected provider-managed connection added only the integration's server variables: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL` and `REDIS_URL`. No deployment was made and no hosted mode, access code, live allowance or receipt/address provider key was configured.

## Configuration compatibility and credential handling

The prepared adapter expected `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`; this Marketplace integration supplies `KV_REST_API_URL` / `KV_REST_API_TOKEN`. The adapter now accepts the complete Marketplace pair when neither explicit Upstash variable is present. If either explicit variable is present, both must validate; credentials from the two configurations are never combined. This avoids duplicating provider-managed secrets or silently using a different database.

Endpoint restrictions, server-only Authorization, response bounds, timeouts, strict quota projection and fail-closed behavior are unchanged. None of these variables is public or prefixed `NEXT_PUBLIC_`.

Only the new database's two REST values were privately fetched for verification. No Gemini/Geoapify credential was read. The temporary local connection file used mode `0600`, was ignored by Git, and was removed after verification and secret scanning. The production credentials remain in Vercel's encrypted environment storage, managed by the resource connection.

The Marketplace CLI automatically installed two documentation skills and a lock file. These three new entries were relocated from the original rebuild checkout into this slice's ignored evidence directory. Existing source and dirty files were preserved; no runtime dependency was installed.

## Actual service verification

`qa/redis-live.config.ts` is separate from ordinary unit tests. It requires an explicit metadata-only marker, a private `0600` file and a result path. Its sender permits only the configured Redis origin, at most 100 REST requests per invocation, a three-second timeout and no retry. It stops after the first failed scenario. It never calls Gemini/Geoapify or starts the application.

Eight scenarios are covered against the actual Free database:

1. `SET NX` initialization, absolute TTL, refusal to overwrite a reserved allowance and persistence when constructing a fresh client.
2. Concurrent receipt/address reservations: exactly one winner and a shared unresolved in-flight block.
3. Duplicate digest refusal and finite address allowance.
4. Conservative 35,400-micro-USD receipt reservation and cooldown.
5. Acknowledged failure stops that capability without refunding the reserved count/cost.
6. Missing state, corruption and policy mismatch block dispatch without automatic initialization.
7. Expiry uses Redis server time.
8. Stored fields contain only the known policy/counter state and one-way synthetic identifiers, with no content or credentials.

The first run passed **7/8**. The eighth test incorrectly required a literal `active: null`; Upstash's Lua JSON implementation omits that member after assigning `cjson.null`. The existing runtime already treats both forms as no in-flight request. The test now permits either representation while retaining the complete field allowlist and mandatory remaining fields. Only that corrected scenario was rerun: **1/1 passed**. The original failure and source were retained; this is combined coverage of eight scenarios, not a claimed fresh 8/8 run.

The first run made 50 Redis REST calls (the last recorded intermediate count was 46, followed by the final scenario's four calls); the targeted rerun made four. Redis may count commands inside scripts separately from HTTP requests. All records are randomly named synthetic test state with absolute TTLs; no production allowance was initialized, reset or consumed. No purchase or physical place was read or modified.

Offline regression checks: **37/37 focused unit tests**, application and focused QA typechecks, production build and whitespace checks passed. Existing browser evidence from the preceding preparation checkpoint is unchanged; no new UI or physical-phone readiness claim is made. Actual cross-deployment behavior and ambiguous acknowledgement loss still require their separately scoped operational checks.

Automatic approval review hit the account usage limit before the final offline checks could execute. No rejected command ran. After the user requested continuation, those exact checks resumed and passed.

## Preservation and evidence

The original 538 snapshot file hashes match. Rebuild remains `c481edb0b8da36c76d375dda00d0d71318b0fc13`; the original integration remains `31f271d39be4c84e181caa2d971fe3d051d3c3f1`. Local main and cached origin/main remain untouched at `eee0d26b55e5061f87ac664938df0c195800b74f`. This is not a statement about the latest remote main.

Ports 3172/3197, real browser data, historical reservations and `next-env.d.ts` were not changed. No new server was started. No push, PR, main merge, publication, price collection, Gemini/Geoapify call or deployment occurred.

Exact scope, source hashes, redacted result aggregation, raw initial failure and resource metadata are under `artifacts/redis-connection-20261015/`. Secret-bearing temporary configuration is excluded and removed. The final manifest records the local commit.

## Next gate

The Redis connection is complete. Before a live protected preview: agree on the exact access duration and shared receipt/address counts; privately configure access and existing provider readiness; approve the specific receipt/address data to send; initialize a new explicitly approved operational quota policy; authorize the preview deployment and perform bounded end-to-end checks. Preview credentials are not connected by this production-only resource step.

Prices remain expired and need a separately scoped verified refresh. Nationwide and radius comparisons remain unimplemented. Browser purchases stay on their existing origin; this database is not purchase storage or synchronization.

## Primary references

- [Upstash Redis pricing](https://upstash.com/pricing/redis): Free plan and its limits; the actual resource plan/settings were also verified through Vercel.
- [Upstash automatic upgrades](https://upstash.com/docs/redis/features/auto-upgrade): automatic upgrades are disabled on this resource.
- [Upstash REST API](https://upstash.com/docs/redis/features/restapi): server-only command transport.
