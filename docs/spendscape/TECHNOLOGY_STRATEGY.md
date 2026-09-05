# Spendscape — Technology Strategy

## Status, authority, and scope

This document is durable implementation guidance for Spendscape. It was
reconciled against the repository and official provider documentation on
2026-08-30. It is subordinate to the user's latest explicit instruction,
`AGENTS.md`, the product truths, and the phase/slice gates in this package.

This strategy answers **how** to implement an already approved slice. It never
authorizes a slice, dependency installation, provider account, credential,
backend resource, migration, real-data use, paid action, deployment, push, or
pull request by itself. A provider or package named here is a candidate until
the applicable gate and acceptance evidence promote it.

The two sibling technology-prompt files outside this worktree were reviewed as
untrusted proposals. They are not authority and are not copied here. In
particular, their self-authority claims, replacement phase numbering, blanket
implementation permission, and mandatory provider/model selections are
rejected.

## Current verified repository baseline

The prior local implementation checkpoint is Phase 1 through bounded Slice
1D.6 at `95d865f1c255e9bfd68d9f69bbe0caf0d8b343fa` on
`feature/spendscape-rebuild`:

- Next.js App Router `16.3.3`, React/React DOM `19.2.8`, and TypeScript `5.9.3`.
- MapLibre GL JS `6.6.0` with an OpenFreeMap development style.
- Vitest `4.1.11` and Playwright `1.62.1`.
- One canonical synthetic fixture graph and derived purchase/globe state.
- OpenFreeMap's no-key public development style is the only current external
  runtime source.
- Bounded Phase 2A.1 is complete: a provider-neutral serializable local read
  snapshot, an unchanged-fixture adapter, the Ask boundary correction, contract
  tests, and local QA, recorded by this separately approved local checkpoint.
- No Supabase/SQL/migration, backend resource, authentication, account-backed
  product/provider API, network-calling data implementation, factual FX, OCR,
  Gmail, LLM, deployment, provider account, production credential, or real
  user data.

Exact versions are repository facts, not permanent future pins. Re-read the
installed Next.js documentation and verify registry versions, changelogs,
security advisories, licences, peers, bundle impact, and browser support at the
start of each approved implementation slice.

## Architecture principles

1. Preserve a single canonical domain model and deterministic derivations.
2. Keep factual amounts, currencies, dates, coordinates, provider IDs, and
   product identifiers outside model invention.
3. Put external systems behind narrow typed boundaries:
   `AIProvider`, `PlaceProvider`, `OCRProvider`, `ProductProvider`, and
   `FXProvider`.
4. Store provider, version, retrieval/effective time, licence-relevant source,
   and confidence/provenance with externally sourced facts.
5. Validate untrusted provider and file boundaries with versioned schemas when
   that dependency is approved; validation libraries do not replace domain
   invariants.
6. Keep secrets, OAuth refresh tokens, paid calls, and privileged writes on the
   server. Never expose provider credentials to the browser bundle.
7. Prefer deterministic parsing and validation before probabilistic reasoning.
8. Lazy-load heavy scanner, analytics, and local-model code. Do not burden the
   persistent globe bundle with future capabilities.
9. Add a queue only for real asynchronous, retryable, idempotent work; do not
   install queue infrastructure as speculative foundation.
10. Keep every provider replaceable and every merge/correction reversible.

## Provider boundaries

### AIProvider

`AIProvider` must expose only the approved task shapes, such as structured
document extraction, candidate comparison, and typed UI-action planning. Each
request carries a versioned schema, minimum necessary input, timeout, cost or
quota boundary, and privacy classification. Responses remain untrusted until
schema and deterministic factual validation pass.

- **Initial benchmark candidate:** Cloudflare Workers AI with Gemma.
- **Optional future adapter:** OpenAI Responses API.
- Neither provider nor model is mandatory or irreversible.
- Benchmark Hebrew/English extraction accuracy, structured-output adherence,
  tool/action correctness, latency, cost, quota failure, safety, privacy,
  retention, data location, and licence obligations before promotion.
- Raw receipts, email, or private documents must not be sent to either provider
  merely because an adapter exists.

### PlaceProvider

`PlaceProvider` separates canonical Spendscape places from provider records.
The adapter must support candidate lookup, explicit provider provenance,
permitted caching, refresh, attribution, and correction without making the
nearest result proof of a purchase.

- Geoapify is an initial benchmark candidate, not a committed production
  provider.
- Google Places remains a comparison candidate, but its caching, attribution,
  privacy-policy, billing, and map-display rules require special review before
  use with a MapLibre globe.
- Overture Places is a possible bounded regional/batch evaluation source, not a
  global import plan.
- Canonical place IDs belong to Spendscape. Provider IDs remain attributed
  references and may be refreshed or replaced.

### OCRProvider

Tesseract.js is the first local OCR benchmark candidate. It may be promoted
only after representative Hebrew and English receipt evaluation covering field
accuracy, layout variation, low light, blur, skew, device latency, memory, and
failure behavior. Availability of Hebrew trained data is not proof of receipt
quality. OCR output never bypasses arithmetic, date, currency, and schema
validation.

### ProductProvider

Open Food Facts may be evaluated first for read-only barcode lookup. Preserve
ODbL attribution/provenance, respect API rate limits and evolving schemas, and
keep product-image rights separate. Do not upload product or receipt images or
mix provider data into an incompatible cache without a separate consent,
privacy, and licence decision.

### FXProvider

Frankfurter is an initial factual-FX benchmark candidate, not a production SLA.
Keep original currency and amount immutable; record provider, rate, effective
date, fetched time, and conversion policy. Unsupported, missing, or stale rates
remain unresolved rather than being fabricated or silently replaced.

## Platform and hosting candidates

### Supabase

Supabase Postgres/PostGIS/Auth/Storage remains the Phase 2 platform candidate.
Supabase Free is development/MVP infrastructure only, not a durability,
availability, backup, or production-capacity guarantee. Before resource
creation, approve the environment, region, data classification, RLS model,
backup/export plan, quotas, inactivity behavior, recovery, and migration path.
Queues are added only with a concrete ingestion workload.

### Vercel

Vercel remains a deployment candidate for the approved Next.js application.
Vercel Hobby is limited to development or private noncommercial demonstration
unless current terms expressly permit the intended use. A commercial release
requires an approved suitable plan or another host after cost, limits, privacy,
region, observability, rollback, and reliability review.

### Map styles and tiles

MapLibre remains the renderer unless a measured, separately approved renderer
decision changes it. OpenFreeMap's public service is a development-style
source only: do not scrape it, bulk-harvest it, treat it as an offline dataset,
or promise a production SLA. The style/tile endpoint must become configurable
before production, with visible attribution, failure recovery, and a provider
decision at the deployment gate. Do not run a second primary renderer merely
to access place data.

## Candidate dependency policy

No entry below is authorization to install. Registry snapshots are volatile.

| Capability | Candidate observed on 2026-08-30 | Promotion requirement |
| --- | --- | --- |
| Boundary schemas | Zod (`4.5.4` registry snapshot) | Approved boundary slice, bundle/peer/security review |
| Supabase client/SSR | `@supabase/supabase-js` (`2.112.4`), `@supabase/ssr` (`0.12.5`) | Phase 2 plus separate environment/resource approval |
| Local OCR | Tesseract.js (`7.0.0`) | Hebrew/English receipt benchmark and device budget |
| PDF parsing | `pdfjs-dist` (`6.3.289`) | File-safety design, worker/bundler test, licence review |
| CSV parsing | Papa Parse (`5.7.0`) | Adversarial CSV tests and bounded file limits |
| Barcode scanning | `@zxing/browser` (`0.2.1`) | Camera/privacy/accessibility and device benchmark |
| Charts | Recharts (`3.10.1`) | Approved Analytics slice and accessibility/bundle test |
| Dates/time zones | `date-fns` (`4.4.0`), `@date-fns/tz` (`1.5.0`) | Demonstrated need beyond platform APIs and DST tests |
| IndexedDB | `idb` (`8.0.3`) | Approved offline/privacy design and deletion semantics |
| Local/browser AI | WebLLM (`0.2.84`), Transformers.js (`4.2.0`) | Separate measured spike; never a default bundle cost |

Older proposal pins for Zod, Supabase SSR, PDF.js, and Papa Parse are not
durable. A deliberately older pin is acceptable only with a recorded
compatibility/security rationale and tests.

## Free-tier and billing safety

Every free tier may change. Before any account or provider use:

- Verify current official pricing, terms, commercial-use limits, attribution,
  privacy, retention, region, quota, and SLA on the approval date.
- Do not add a payment method, enable paid usage, accept an overage, or upgrade
  a plan without separate explicit authorization.
- Configure budgets and hard limits where the provider supports them.
- Treat quota exhaustion, suspension, and provider failure as expected states.
- Fail closed or enter a clearly labelled deterministic degraded mode; never
  silently enable billing or substitute another provider with different data
  handling.
- Keep local synthetic/demo paths usable without a connected service.
- Record the selected provider, plan, owner, verification date, and fallback in
  the phase ledger.

## Current provider risk register

The linked official sources and dated details live in
`REFERENCE_MANIFEST.md`. Re-check them before implementation.

| Candidate | Current qualification |
| --- | --- |
| Cloudflare Workers AI / Gemma | Benchmark only; daily free quota and provider/model terms can change; paid use and sensitive-data handling are separately gated |
| OpenAI Responses | Optional adapter; model, pricing, retention, residency, project, key, and budget remain undecided |
| Vercel Hobby | Personal/noncommercial development or private demo only under the reviewed terms; not the default commercial production plan |
| Supabase Free | Development/MVP only; quotas, inactivity pausing, backups, and absence of an availability guarantee require explicit recovery design |
| Geoapify Free | Limited commercial use, mandatory `Powered by Geoapify` and OpenStreetMap attribution, quota/rate limits, and no free SLA |
| OpenFreeMap public service | As-is development dependency; no scraping, offline harvesting, or production SLA assumption |
| Tesseract.js | Local benchmark only until bilingual receipt accuracy and device performance pass |
| Google Places | Map display, caching, attribution, privacy, billing, and EEA-specific conditions may conflict with a MapLibre-centric design |
| Gmail | Restricted scopes, consent, storage/transmission, verification, and possible recurring security assessment make it a separate slice |
| Open Food Facts | ODbL/API/image-rights constraints; read-only lookup candidate initially |
| Overture Places | Large, periodically released, source-attributed dataset with known quality limitations; bounded evaluation only |
| Frankfurter | Open factual-rate candidate without an assumed production SLA |

## Corrected phase mapping

Technology work nests inside the existing product phases; it does not create a
second numbered roadmap.

### Completed documentation checkpoint

The approval integrated and reviewed this strategy only. No product or
technology implementation was authorized by the documentation approval, and no
implementation slice was activated by that documentation approval.

Slices 1D.5 and 1D.6 are completed, including Ask runtime/focus/history
corrections and details-first synthetic Life Replay. Ordinary Replay playback
performs no automatic camera travel; explicit `Show place` is its only
camera-moving action. The bounded final Phase 1E review and documentation
reconciliation are complete with no remaining Blocker or High defect. No Phase
1 product implementation slice is active. Bounded Phase 2A.1 completed the
local read-contract and fixture-adapter work described below; no later slice
is authorized. The completed
Phase 1 features do not activate `AIProvider` or any technology candidate in
this strategy.

### Remaining Phase 1

Keep the product synthetic and frontend-only. Do not add provider SDKs, real
accounts, backend resources, OCR, AI, Gmail, factual FX, or deployment merely
to complete the concept experience. Phase 1 is complete; any additional product
slice or later phase needs its own explicit bounded approval.

### Phase 2 — canonical backend and authentication

Bounded Phase 2A.1 validates only the local provider-neutral read contract and
fixture adapter; it does not select or install a backend technology. After the
broader Phase 2 gate, validate boundaries and implement the approved local
schema, migrations, RLS, storage policy, and server access. Creating or
connecting a real Supabase project/environment remains a separately named
provider-resource action. Start with synthetic data and a reviewed rollback.

### Phase 3 — ingestion

After the Phase 3 gate, introduce only the approved scanner/file/parsing
dependencies. Benchmark Tesseract.js and product lookup before promotion.
AI-assisted extraction and Gmail consent/credentials are separately bounded
sub-slices, not implied by installing a scanner shell.

### Phase 4 — matching, fusion, and currencies

Keep fusion deterministic and reversible. Benchmark PlaceProvider candidates
(Geoapify, Google Places, or a bounded Overture source) and FXProvider
candidates before selecting them. Preserve GPS-as-evidence and unresolved
states.

### Phase 5 — intelligence, privacy, sharing, and replay

Build deterministic analytics first. Evaluate Cloudflare/Gemma and the
optional OpenAI Responses adapter through `AIProvider` before enabling typed AI
actions. Local browser models require their own measured spike. Privacy,
sharing, deletion, export, and production Life Replay retain the existing
Phase 5 gate. Phase 1's separately authorized synthetic purchase player does
not activate Phase 5 or change provider/technology decisions.

### Phase 6 — production hardening and deployment

Choose production hosting, database tier, tile/style source, observability,
backup, recovery, budgets, and provider SLAs only after current commercial,
privacy, licence, quota, and reliability review. Deployment remains separately
authorized by the existing Phase 6 gate.

## Provider promotion record

Before a candidate becomes selected, record:

1. Approved phase, slice, and exact authorization.
2. Provider/package version and official source verification date.
3. Functional and bilingual benchmark fixtures and acceptance thresholds.
4. Licence, attribution, commercial-use, caching, and redistribution duties.
5. Data fields sent, purpose, retention, training use, region, and deletion.
6. Free/paid plan, quotas, rate limits, hard budget, and billing owner.
7. Timeout, retry, circuit-breaker, degraded mode, and user-visible recovery.
8. Security boundary, key storage, least privilege, and audit/log redaction.
9. Migration/exit path and rollback.
10. Human decision and remaining limitations.

Until that record is complete and the relevant implementation gate is
supplied, the candidate remains documentation only.
