# Spendscape — Architecture, Data, Ingestion, and AI

## Target stack

- **Application:** Next.js App Router + TypeScript.
- **Hosting:** Vercel, introduced only in the deployment phase.
- **Platform:** Supabase Postgres, PostGIS, Auth, Storage, and Queues.
- **Globe:** MapLibre GL JS for benchmark parity; production tile/style provider
  selected separately.
- **Places:** Google Places API, server-side where required by security/terms.
- **AI:** OpenAI Responses API with image/file inputs, Structured Outputs, and
  typed application tools.
- **Email:** Gmail API with user-consented OAuth and server refresh tokens.
- **Barcode/products:** provider adapters with provenance, caching, confidence,
  and correction.
- **Currencies:** provider adapter for timestamped factual FX rates.

The inherited Vite/React code is a baseline, not a mandate. Migrate in a bounded
Phase 1 slice and retain useful components/data logic where lower-risk than a
blind rewrite.

## Logical pipeline

`Sources → Ingestion Jobs → Evidence → Extraction → Candidate Purchase →`
`Dedup/Fusion → Place & Product Matching → Canonical Purchase →`
`Analytics/Habits → Insights/AI Actions → Globe/Timeline/UI`

Each canonical purchase can explain which authorized evidence contributed to
it without exposing implementation jargon in ordinary consumer screens.

## Canonical data model

### Identity and policy

- `profiles`: locale, base currency, timezone, preferences.
- `consents`: source, scope, grant/revoke timestamps, policy version.
- `retention_policies`: source type and deletion schedule.
- `connected_accounts`: encrypted provider metadata; no client-visible tokens.

### Commerce and geography

- `merchants`: normalized business identity.
- `places`: branch/place identity, provider IDs, PostGIS point, address,
  timezone, and match provenance.
- `purchases`: user, timestamp, original amount/currency, normalized base
  amount, FX reference, channel (`physical`, `online`, `unknown`), payment mode,
  nullable `place_id`, merchant, and status.
- `purchase_items`: nested items with quantity, units, unit/line price,
  discounts, tax/deposit, normalized product, and raw extracted label.
- `products`: normalized structured identity; no retained product photo.
- `product_aliases` / `product_provider_refs`: barcode/provider provenance.
- `exchange_rates`: pair, rate, provider, effective/fetched timestamps.

The pin query groups canonical physical purchases by `place_id`, never by raw
merchant string or purchase ID.

### Evidence and processing

- `ingestion_jobs`: type, state, attempts, idempotency key, timestamps, error
  class, and retention action.
- `evidence`: source type/native ID, content hash, safe metadata, permitted
  storage pointer, and processing state.
- `extraction_results`: versioned structured output with model/provider metadata.
- `purchase_candidates`, `match_candidates`, and reversible `fusion_links`.
- `smart_inbox_cases`: material unresolved question, candidates, answer/state.
- `audit_events`: privacy-safe operational/user action audit.

### Intelligence and sharing

- `derived_metrics`, `habit_signals`, and `insights` with provenance/freshness.
- `ai_action_log`: typed action, validated arguments, result, and undo.
- `replay_events`: derived chronological view, not duplicated purchases.
- `shares`: explicit scope/filter, expiry, revocation, and redaction policy.

## Universal Scanner pipeline

1. Acquire camera/file input under HTTPS and explicit permission.
2. Classify receipt/product/barcode/document input.
3. Create an idempotent job and content fingerprint.
4. Use deterministic barcode/PDF/text parsing when available.
5. Use OpenAI vision/file input where semantic extraction adds value.
6. Require Structured Output matching a versioned extraction schema.
7. Validate arithmetic, dates, currency, and required fields deterministically.
8. Look up factual merchant/place/product candidates from providers.
9. Deduplicate/fuse with existing evidence.
10. Auto-resolve high confidence; ask material ambiguity in Smart Inbox; leave
    insufficient cases unresolved.
11. Persist structured data and apply media-retention policy.
12. Delete product images after processing and audit the deletion outcome.

## Deduplication and fusion

Use layered idempotency/similarity rather than one LLM judgment:

- Exact provider keys: Gmail message/attachment, upload hash, CSV row key.
- Fingerprint: merchant, timestamp bucket, amount/currency, document hash,
  barcode/item set.
- Similarity: time, amount, merchant/place candidates, item overlap, source
  relationship, and user corrections.
- Deterministic policy chooses auto-merge versus review.
- LLM may compare semantics but does not choose factual identifiers alone.
- Preserve evidence, prevent double counting, and support split/unmerge.

## Place matching

Inputs may include raw merchant text, receipt address, time, GPS/dwell evidence,
nearby Google Places, category, amount, item semantics, prior confirmations, and
habits. Never force the nearest place. Store provider ID/PostGIS coordinate only
after resolution. Online merchants have no physical place unless a specific
pickup branch is confirmed.

## Barcode/product provider interface

Provide adapter operations such as `lookupBarcode`, `searchProduct`,
`normalizeProviderProduct`, and `getProvenance`. Adapters may include open food
databases, GS1/commercial sources, merchant catalogs, and user-confirmed data.
Cache by barcode/provider/version, respect licenses/quotas, and never synthesize
a barcode or package fact. Provider selection requires coverage, region, cost,
terms, latency, freshness, and correction-flow review.

## Multi-currency rules

- Retain original amount and ISO currency.
- Normalize using a factual provider rate and effective timestamp.
- Apply one historical analytics policy consistently.
- Switching display currency never rewrites source amounts.
- LLMs never provide exchange rates.
- Represent refunds, rounding, tax, and card-provider conversions explicitly.

## OpenAI rules

- Server-side calls and secrets only.
- Responses API, versioned prompts/schemas, and Structured Outputs.
- Minimum necessary input and redaction of unrelated personal content.
- Extraction is separate from validation/database writes.
- Track model/prompt/schema, latency, cost, and failure class without raw
  sensitive logging.
- Build evaluation fixtures before trusting auto-resolution.
- Corrections feed aliases/evals, not silent training on private data.

## AI UI/map controller

Expose allowlisted tools over application state. Tools accept canonical IDs,
validate ownership, and return visible results. Read actions can run directly;
consequential actions require confirmation. The model receives neither database
credentials nor permission to emit executable client code.

## Security and privacy baseline

- RLS on every user-owned table/storage object.
- Server-only secrets and encrypted refresh tokens.
- Least-privilege Gmail scopes and clear disconnect/revoke.
- Signed URLs for retained private documents.
- Separate development, preview, and production environments.
- No real data in fixtures, screenshots, logs, analytics, or errors.
- Threat-model prompt injection in documents/email, malicious files, content
  spoofing, oversized input, duplicate jobs, and tool-call escalation.
- Document/email text is untrusted data, never agent instructions.

## Provider decisions still gated

- Production tile/style provider and cost/terms.
- Google Maps 3D versus MapLibre reconsideration after measured spike.
- OCR fallback beyond selected OpenAI/document parsing.
- Barcode/product providers by launch country/category.
- FX provider and historical-rate policy.
- Queue worker runtime/scheduling topology.
- Document retention defaults and jurisdictional requirements.
- Analytics/observability provider and privacy configuration.
