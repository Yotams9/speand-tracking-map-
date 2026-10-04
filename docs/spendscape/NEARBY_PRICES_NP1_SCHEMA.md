# NP1 — descriptive price read model

Planning only: no SQL, migrations, database or hosted provider is created.
This is a separate public retailer-price graph, never the canonical user graph.

## Entities and constraints

- **ingestion_runs**: immutable run ID, adapter/normalization version, start/end,
  status, per-file fixed error codes/counts, approved source scope and limits.
  Partial chain failure is explicit; success in one partition does not certify another.
- **source_files**: retailer namespace, canonical public URL without query tokens,
  original filename, compressed/uncompressed hashes/sizes, source publication
  time and its basis, fetched time when actually recorded, ingestion time,
  licence reference, schema/parser version and validation outcome. Unknown times
  remain null with a reason. Artifact content dedup is separate from publication
  events: identical bytes under a new publication must not invent freshness.
- **run_files**: run-to-source provenance and statuses, including repeated runs,
  quarantine, historical-only and applied outcomes. Keep immutable evidence even
  when a current projection changes. Failure reports contain fixed codes only.
- **chains / subchains**: retailer-qualified source identifiers and raw forms.
  No global store-ID assumption. Source-specific aliases document padding rules.
- **stores / store_versions**: chain/subchain/store composite key; source name,
  physical/online classification, address/city/postcode and source version.
  Coordinates are nullable geography(Point,4326), longitude then latitude, with
  independent source, accuracy and verification time. No inferred coordinates.
- **source_products / products**: original ItemCode and internal/external flag,
  original label, optional validated GTIN14, source package quantity/content unit,
  package count and weighted flag. Keep raw and normalized values. Internal codes
  are retailer-scoped and never joined cross-chain as GTINs. GTIN checksum alone
  does not establish package equivalence, allocation or real product authenticity.
- **price_observations**: immutable observation ID, source product/store/version,
  exact decimal amount, currency or unresolved state, item last-change time,
  publication/confirmation time, action and original status, package basis,
  source-file links and normalization version. Keep history; never overwrite it.
- **promotions / promotion_versions / promotion_items**: source identity and
  validity, original nested group/item conditions, membership/coupon/minimum
  quantity/minimum basket/stacking constraints and explicit eligibility status.
  NP1 retains conditions without computing promotional prices. NP2 must use a
  child relation for item/group membership; no flattening into unconditional price.
- **publication_events / current_prices**: accepted full/delta event, partition,
  predecessor proof, affected record IDs/counts and projection revision. A valid
  full replaces that partition's current membership; absence means not confirmed
  in that full, not proof of stock removal. Previous observations remain retained.
  Explicit source removal is a distinct event. An invalid/partial file changes
  neither current membership nor the partition watermark.

## Keys, ordering and atomicity

Content hashes deduplicate files; observation hashes deduplicate deterministic
normalized facts. Retain links to all source evidence. The in-memory prototype
rejects distinct files at the same partition/time rather than guessing order;
NP2 must preserve both evidence records and quarantine the conflict.

The bounded review correction separates artifact content identity from source
publication identity. One content hash may have multiple source publications;
each retains filename, canonical URL, partition and source timestamp. Re-ingestion
time does not create a publication. A later dated full may advance the accepted
source watermark even when content is identical; this is not a newly changed
item price or a declaration of live freshness. Older publication evidence is
retained without replacing newer current state. All comparison eligibility
remains disabled in this prototype.

Validate the complete bounded file before publication. Stage in one transaction,
then atomically advance only the verified partition. Newer deltas need explicit
verified continuity; a newer timestamp alone does not prove no missed updates.
Old files may enter history but cannot replace a newer projection. Failed Store
ingestion does not authorize a price file to fabricate a missing store.

Separate Price and Promo watermarks. Do not apply an older Price delta over a
newer PriceFull. Repeated runs create run evidence but no duplicate price facts.
Item-change time, source publication time, fetched time and ingestion time are
different fields; download/replay never refreshes source truth.

## Indexes and spatial query plan for NP2

Unique retailer identity, content hash, observation hash and partition revision
constraints; B-tree indexes on GTIN14, store/product, publication and item-change
times; GiST on geography. Null/invalid coordinates excluded.
ST_DWithin filters metres using the geography index; ST_Distance returns metres
for final candidate ranking, converted to kilometres only for output.
Require EXPLAIN ANALYZE evidence after database approval; none is claimed now.
No full-table Haversine scan or comparison against all historical observations.

## Privacy and retention

Only public retailer evidence is eligible for this future database. No user
purchases, location, barcode queries, paid-price inputs or comparison responses.
Raw public XML remains outside Git. NP1 has no persistence except aggregate QA
evidence. Future raw/history retention and deletion require the resource gate.
No API or UI may receive raw condition XML; only later validated projections.

## Explicit unresolved items

Currency is absent from the evaluated payloads and remains unresolved; do not
insert ILS merely from product expectations. An attributed source policy may
resolve it after separate validation. Zero/missing package count remains unknown.
No promotion eligibility or geocoding has been implemented. Freshness/coverage
policy, retailer completeness guarantees and source reuse rights remain gates.
