# Project Context — Purchase Intelligence

## Product vision

Build a globally oriented consumer product that helps people understand where and what they buy, learn recurring purchase habits, compare useful alternatives, and make better future purchasing decisions with minimal manual effort.

The product is more than a spending map. The map/globe is the main visual layer for a broader purchase-intelligence system.

Core experience principle:

> The application works for the user; the user should not have to maintain the application.

The long-term target is usually zero user actions per purchase and at most one short action when the system genuinely needs help.

## Approved product decisions

- The long-term product should support purchase categories where meaningful alternatives can be compared, including groceries, food, shopping, fuel, pharmacy, and others.
- The product direction is global, although early demos may use one small, coherent locale and currency.
- Bank/card connectivity is optional and must never be a prerequisite.
- Capture may eventually combine receipt photos, product photos, barcodes, digital receipts, shared files or screenshots, email receipts, quick add, optional transaction feeds, location evidence, and future integrations.
- Multiple signals referring to the same event should become one purchase, not duplicates.
- GPS is a signal, never proof of a purchase or of the exact merchant.
- High-confidence matches may be automatic; meaningful uncertainty goes to a one-tap Smart Inbox; low-confidence cases remain unresolved.
- The system should ask only when uncertainty could materially affect a comparison or recommendation.
- Product equivalence must preserve meaningful attributes. A different brand of otherwise equivalent milk may be comparable; regular and zero-sugar cola are not automatically equivalent.
- The LLM may help with semantic reasoning and wording, but factual numbers and identifiers must come from real data or deterministic calculations in later phases.
- Savings should reflect usefulness to the specific user: basket cost, comparable items, distance, travel time, route deviation, transport cost, frequency, and expected recurring impact.
- A recommendation should use one alternative destination. Do not split a basket across multiple stores.
- Support both reactive insights after a purchase and proactive recommendations before a predicted purchase.
- Privacy is a product requirement, not a late add-on.

## Approved long-term architecture

`Capture → Purchase Fusion → Purchase Matching / Confidence → Product Intelligence → Habit Learning → Price & Alternatives → Route / Effective Savings → Recommendations`

- **Capture:** Accept whichever authorized source is easiest and available.
- **Purchase Fusion:** Merge related evidence into one purchase.
- **Matching / Confidence:** Resolve the real merchant using multiple signals without treating GPS as proof.
- **Product Intelligence:** Normalize products, quantities, units, and valid equivalents.
- **Habit Learning:** Learn recurring stores, baskets, times, routes, and repurchase intervals.
- **Price & Alternatives:** Compare the basket only with supported factual price data.
- **Route / Effective Savings:** Account for travel and recurring impact, not sticker price alone.
- **Recommendations:** Decide whether a useful message or user question is warranted—and when to stay silent.

Use deterministic logic, APIs, and databases as sources of truth in later phases. Use an LLM only where semantic reasoning adds value.

## Phase 1 objective

Create a polished, mobile-first front-end concept demo that lets the team see, touch, critique, and approve the product direction before the real prototype is built.

The five primary areas are:

1. **Map / Home** — map- or globe-led purchase exploration with clusters, merchants, purchases, and category filters.
2. **For You** — useful habit, savings, route, and upcoming-purchase insights.
3. **Capture** — a fast simulated camera-first entry point for receipt, products, barcode, upload/share, and quick add.
4. **Smart Inbox** — only unresolved cases that merit a short one-tap answer.
5. **Profile / History** — purchase history, frequent merchants, categories, privacy controls, preferences, and clearly optional future integrations.

Supporting concept views include purchase detail, merchant detail, a lightweight “likely needed soon” prediction, and a route-aware comparison.

## Phase 1 data policy

Use only synthetic, coherent mock data. The dataset should demonstrate:

- Multiple locations and merchant categories.
- Recurring grocery and food/cafe behavior.
- Purchase and merchant histories.
- One ambiguous purchase requiring Smart Inbox confirmation.
- One strong recurring-savings recommendation.
- One proactive recommendation.
- A typical basket and logically equivalent products.
- A route-based comparison.

Every total, average, visit count, route delta, and savings figure must reconcile with the canonical mock fixtures. Label savings as illustrative or estimated.

## Deferred beyond Phase 1

Do not implement real capture, OCR, product recognition, bank/email/SMS connectivity, fusion, merchant matching, habit models, factual price collection, route engines, authentication, production backend, background location, native mobile packaging, or deployment.

## Intentionally undecided

- Framework and package manager.
- Map/globe provider.
- Hosting and deployment platform.
- Production data providers and integration architecture.
- Exact confidence thresholds.
- Production privacy, consent, retention, and local-versus-server processing design.

These choices must not be silently locked in during scaffolding. Phase 0 may recommend a Phase 1 approach; implementation requires the explicit gate in `AGENTS.md`.

