---
name: curate-coherent-mock-data
description: Design and audit synthetic demo data for purchase, merchant, route, habit, and savings experiences. Use when defining fixtures, stories, totals, averages, recommendations, ambiguity, or UI copy; enforce internal consistency, privacy, clear mock labeling, and separation from real personal or live price data.
---

# Curate Coherent Mock Data

Create a small canonical dataset that tells the complete demo story without pretending to be real financial evidence.

## Respect authorization

Read `AGENTS.md`. During Phase 0, plan the entities, scenarios, and derivation rules only. Create implementation fixtures only after Phase 1 build authorization.

## Define the canonical entities

Use stable identifiers and explicit relationships for the entities the demo needs, such as:

- User profile and preferences.
- Cities or geographic clusters.
- Merchants and branches.
- Purchases.
- Line items and products.
- Product-equivalence groups.
- Normal routes and alternative destinations.
- Habit summaries.
- Recommendations.
- Smart Inbox cases.

Keep one source of truth. Do not duplicate totals independently across screens.

## Cover the required stories

Include at minimum:

- Multiple locations and merchant categories.
- A recurring grocery pattern.
- Restaurant or cafe history.
- One purchase with enough detail for a purchase view.
- One merchant with enough history for averages and frequent products.
- One ambiguous merchant requiring a one-tap choice.
- One strong recurring-savings recommendation.
- One proactive upcoming-purchase recommendation.
- One typical basket.
- One route-compatible alternative.
- Valid product equivalents and a meaningful non-equivalent contrast.

Keep the dataset manageable. Prefer a few rich stories over dozens of shallow records.

## Reconcile every number

- Calculate purchase totals from line items or document an intentional mock adjustment such as tax or discount.
- Derive visit counts and averages from purchase history.
- Make date ranges and labels agree.
- Make route deviations and travel times plausible within the fictional scenario.
- Calculate recurring savings from the stated per-basket difference and frequency when those values are shown together.
- Keep currency and locale consistent within a scenario.

Do not let screens disagree about the same merchant, purchase, or recommendation.

## Preserve product truth

- Label the fixture set as synthetic.
- Use fictional user identity and avoid real account, receipt, bank, email, or precise home-location data.
- Describe savings as estimated or illustrative.
- Never imply mock prices are current market prices.
- Do not use an LLM-generated number as an external fact.
- Treat GPS as evidence, not proof.
- Preserve meaningful product attributes when defining equivalents.
- Do not split a recommended basket across stores.

## Audit before handoff

Check:

1. Referential integrity.
2. Arithmetic consistency.
3. Date and locale consistency.
4. Coverage of every required UI story.
5. Absence of real personal data.
6. Clear mock or estimate labeling.
7. No contradictory recommendations.
8. No orphan records or unused narrative values.

Report any narrative value that cannot be derived and explain why it remains a stored mock estimate.
