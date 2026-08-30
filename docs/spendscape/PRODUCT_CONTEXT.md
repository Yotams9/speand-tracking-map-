# Spendscape — Product Context and Decision Record

## Product definition

Spendscape is a global personal purchase-intelligence product organized around
an interactive globe. It helps a person understand where, what, when, and how
they buy; identify meaningful patterns; and make better future purchase
decisions with minimal maintenance.

The globe is not a visualization added to a dashboard. It is the persistent
spatial canvas through which history, analytics, search, AI, and Life Replay are
explored.

Core experience principles:

1. **Globe first.** The map remains visually dominant and alive.
2. **Progressive disclosure.** Detail appears through pins, sheets, cards, and
   focused modes instead of permanent dashboard clutter.
3. **Confirm, do not configure.** Automation and AI prepare; the user confirms
   only when uncertainty matters.
4. **One primary action.** Each state has a clear next action.
5. **No unnecessary reloads.** Navigation and overlays preserve map state.
6. **60fps feel.** Use responsive motion, skeletons, transitions, and bounded
   rendering work; respect reduced-motion preferences.
7. **Privacy by design.** Collection, retention, sharing, and deletion are
   visible product controls.

## Locked delivery decisions

- Product name: **Spendscape**.
- Responsive web application and installable PWA only.
- No native iOS/Android package and no App Store/Play Store work.
- Premium near-black, modern, highly interactive 3D visual direction.
- Mobile first, with a deliberate desktop composition.
- English and Hebrew/RTL support are required.
- The system must support global locations and multiple currencies.

## Locked map and purchase semantics

- One canonical pin per **physical place** where purchases occurred.
- Many purchases at the same branch aggregate into that one place pin.
- Wide zoom may visually cluster pins, but clusters are render-time
  aggregations, not purchases or canonical places.
- Selecting a place reveals visits, total spend, average, categories, nested
  purchase history, and relevant intelligence.
- Online purchases have `place_id = null`, appear in timeline/search/analytics,
  and never create a map pin.
- Cash/manual purchases may have either a confirmed place or no place.
- A receipt purchase contains nested line items. Products are normalized as
  structured data without retaining product photographs.

## Universal input model

The Universal Scanner is one adaptive capture entry point for receipt photo,
product photo, barcode, PDF, CSV, screenshot/document, Gmail/digital receipt,
manual/cash entry, and future authorized sources. The input type may be detected
or selected with one tap. Product photos are transient processing inputs and
must not be retained. Receipt/document retention requires an explicit policy
and user-facing control in a later phase.

## Extraction, matching, and deduplication

- AI/LLM assistance is intentionally heavy for OCR interpretation, merchant and
  product semantics, document classification, and candidate ranking.
- Deterministic validation and provider data remain the factual source of
  amounts, currencies, dates, coordinates, identifiers, and exchange rates.
- GPS assists place matching but never proves a purchase happened.
- High-confidence evidence may resolve automatically.
- Material uncertainty becomes one short Smart Inbox question.
- Low-confidence evidence remains unresolved rather than guessed.
- Receipt, Gmail, CSV, manual, barcode, and future evidence for the same event
  must deduplicate into one canonical purchase.
- Every merge remains auditable and reversible.

## Required product surfaces

### Persistent globe

Search, category/date/currency filters, timeline, canonical place pins, heatmap,
reset-to-globe, contextual sheets, and smooth globe-to-city-to-street camera.
AI can safely operate typed, reversible map/UI actions.

### Desktop composition

- Minimal top navigation: **Globe · Analytics · Purchases**.
- Lightweight search and profile controls.
- Filters, Ask AI, timeline, and Add/Capture float over the live globe.
- Analytics and detail open without needlessly destroying globe state.

### Mobile composition

- Full-height globe remains the hero.
- Compact top brand/search controls.
- Bottom navigation: **Globe · Stats · AI**.
- Universal Scanner/Add is a prominent floating action.
- Timeline/details use reachable bottom sheets or focused full-screen flows.
- Smart Inbox and profile/privacy remain accessible secondary destinations.

### Intelligence and history

- Search across places, merchants, products, categories, cities, purchases, and
  natural-language questions.
- Analytics across time, category, place, geography, source, currency, channel,
  and recurring behavior.
- Original and normalized currency amounts with factual FX provenance.
- AI map/UI actions are visible and confirmation-gated when consequential.
- Life Replay supports play, pause, scrub, speed, date range, summaries, and
  reduced motion.
- Sharing is private by default and limited to an intentionally selected scope.

## Reference decisions

Use the supplied Origin Financial Refero page for atmosphere/system inspiration,
not for copied branding, content, or screens. Keep near-black gallery surfaces,
editorial display type, precise UI/data typography, restrained chromatic
feature surfaces, and a white primary action.

The supplied food-map site is the behavioral benchmark. Its public client code
was verified to use MapLibre GL JS, OpenFreeMap Liberty, globe projection,
atmosphere/sky, GeoJSON circle and heatmap layers, auto-spin that stops on first
interaction, hover/click popups, `flyTo`, and `fitBounds`.

For Phase 1, MapLibre is the recommended renderer because it directly matches
the benchmark. Google Places remains the place-resolution provider. Google Maps
JavaScript 3D remains a documented production alternative, but it must not
silently replace the renderer without a measured comparison and user approval.
Do not run two full map renderers on the same primary surface.

## Existing baseline: preserve, adapt, replace

Preserve where useful:

- Coherent synthetic fixtures and deterministic derivation/audit concepts.
- Purchase, merchant, comparison, capture, and Smart Inbox story coverage.
- English/Hebrew and RTL foundations.
- Reversible interactions and trust-oriented copy principles.

Adapt:

- Existing routes and reusable UI concepts into the new information
  architecture.
- ILS-only synthetic assumptions into multi-currency-ready canonical types.
- Current PWA foundation into a Next.js PWA over approved phases.

Replace:

- Ledgerline branding and light paper/teal visual system.
- Hand-authored SVG basemap and simulated curvature.
- Orbiting purchase markers; aggregate at one physical place pin.
- Dashboard-like permanent panels and inherited five-item primary nav.
- Assumptions that all purchases are physical or ILS-only.

## Scope boundary

This file describes the whole product but does not authorize implementation,
accounts, credentials, backend resources, deployment, or real data.
