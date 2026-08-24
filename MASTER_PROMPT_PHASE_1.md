# Master Prompt — Purchase Intelligence App

## Phase 1: Front-End Concept Demo

This specification defines the Phase 1 outcome. It does not authorize implementation. Follow the approval gate in `AGENTS.md`.

## 1. Role and objective

Act as a senior product engineer, consumer-product UX designer, front-end architect, and critical QA reviewer.

The first objective is not to build the complete product. It is to create, after explicit approval, a polished mobile-first visual and interactive demo that allows the team to review:

- Product identity.
- Information architecture.
- Navigation.
- Main layouts.
- Interaction model.
- Map/globe experience.
- Capture and Smart Inbox concepts.
- Habit, route, and savings storytelling.
- Overall direction before the real prototype.

The final Phase 1 demo should communicate the product without requiring a long verbal explanation.

## 2. Mandatory Phase 0 response

Before any implementation, return a readiness package with these sections:

1. **Understanding** — a concise restatement of the product and Phase 1 goal.
2. **Proposed experience** — the five primary areas and the main end-to-end demo story.
3. **Recommended Phase 1 technical approach** — one recommendation, material tradeoffs, and any paid-service or API-key implications. Do not install or initialize anything.
4. **Screen and state inventory** — the minimum screens, sheets, modals, empty states, loading states, and confirmation states needed to tell the story.
5. **Mock-data plan** — canonical entities, required scenarios, derivation rules, and how mock/estimated values will be labeled.
6. **Acceptance plan** — functional, visual, responsive, and content checks that will run only after approval.
7. **Assumptions and unresolved decisions** — separate minor reversible assumptions from decisions that need human direction.
8. **Scope exclusions** — explicitly repeat what will not be built.
9. **Approval request** — end with the exact authorization needed: `APPROVE PHASE 1 BUILD + QA`.

Then stop. Do not create files, install dependencies, run commands that start implementation, launch the app, run tests, or capture screenshots.

## 3. Product vision

Design a global personal purchase-intelligence product that helps users understand:

- Where they buy things.
- What they buy.
- How much they spend.
- Which patterns repeat.
- Whether a nearby or route-compatible alternative could have saved meaningful money.
- What they are likely to need soon.
- Where and when a future purchase may be more useful or economical with minimal inconvenience.

Core UX principle:

> The application works for the user. The user should not have to maintain the application.

The long-term interaction target is usually zero user actions per purchase and no more than one short action when the system genuinely needs help.

## 4. Trust model: location is evidence, not proof

Never present GPS or proximity as proof that a purchase happened at a specific merchant.

In a mall or dense commercial area, many businesses may be within tens of meters. A future Purchase Matching / Confidence Engine should combine signals such as:

- Merchant string.
- Transaction timestamp.
- Location history and dwell time.
- Nearby businesses.
- Receipt merchant and line items.
- Business category.
- Purchase amount.
- Product information.
- Previous visits and confirmations.
- User habits.
- Digital receipts and other authorized evidence.

The long-term behavior is:

- High confidence → associate automatically.
- Meaningful medium confidence → ask once through Smart Inbox.
- Low confidence → leave unresolved.

Do not expose raw scores or technical reasoning in normal consumer UI. Phase 1 should demonstrate this behavior with mock data, not implement the engine.

## 5. Long-term input model

The future product may accept:

- Receipt photo.
- Purchased-product photo.
- Barcode scan.
- Digital or email receipt.
- Shared PDF, screenshot, or message.
- Quick manual purchase.
- Optional bank/card integration.
- Other authorized automated sources.

No source is mandatory. Multiple signals describing the same purchase should eventually merge into one purchase through a Purchase Fusion Engine.

For Phase 1, simulate the user-facing states convincingly. Do not implement real capture or fusion.

## 6. Long-term architecture to preserve conceptually

Design the front end so it can later connect to this pipeline without redefining the product:

`Capture → Purchase Fusion → Purchase Matching / Confidence → Product Intelligence → Habit Learning → Price & Alternatives → Route / Effective Savings → Recommendations`

Do not build this architecture in Phase 1. Represent only the outputs needed for UX validation.

## 7. Savings and recommendation principles

The product must not simply recommend the cheapest store. A useful alternative may consider:

- Comparable basket price.
- Exact and logically equivalent products.
- Distance and travel time.
- Route deviation.
- Transportation or fuel cost.
- Purchase frequency.
- Expected monthly impact.
- User inconvenience and normal habits.

Use one alternative destination per recommendation. Do not recommend splitting a basket across stores.

Allow substitutions only when products are logically equivalent. For example, same-size 3% milk from another brand may be comparable. Regular cola and zero-sugar cola are meaningfully different and must not be treated as interchangeable by default.

An LLM may eventually assist semantic matching and recommendation wording. It must never be the source of truth for a price, amount, date, distance, route time, coordinate, or place identifier.

In Phase 1, use internally consistent mock numbers and label savings as estimated or illustrative.

## 8. Habit and proactive intelligence

Use mock data to demonstrate learning such as:

- Frequent stores and restaurants.
- Repeated purchases.
- Typical baskets.
- Typical purchase times.
- Common routes.
- Repurchase intervals.
- Weekly or monthly patterns.

Show both:

- **Reactive:** “This purchase could have cost about ₪31 less at a nearby alternative.”
- **Proactive:** “You usually make a large grocery purchase on Thursday evening. A route-compatible alternative may save about ₪34 with only three extra minutes.”

Do not flood the user with low-value advice. The product should learn when to stay silent.

## 9. Primary product structure

Keep the main mobile navigation to five areas:

### A. Map / Home

Make the map or globe the hero and visual identity.

Demonstrate:

- Purchase locations.
- Clusters or cities at wide zoom.
- Merchants at city zoom.
- Individual purchases at close zoom or through a selected merchant.
- Category filters: Everything, Groceries, Food, Shopping, Fuel, Pharmacy, Other.
- A focused overlay or sheet that turns selected map data into an understandable story.

Use the best technically reasonable concept-demo presentation identified in Phase 0. Do not overengineer a 3D engine solely for spectacle. Preserve a premium, map-led feel even if the selected implementation uses a simplified map or globe simulation.

### B. For You

Show decision-oriented intelligence rather than generic dashboard filler. Candidate cards include:

- Potential recurring monthly savings.
- Repeated visits and spend habits.
- A nearby route-compatible alternative.
- A likely upcoming purchase.
- A meaningful category trend.

Each card should be understandable within seconds and provide a clear next interaction.

### C. Capture

Make Capture a visually prominent, camera-first action. Simulate these options:

- Scan receipt.
- Scan products.
- Scan barcode.
- Upload or share receipt.
- Quick add.

The flow should explain that automatic future sources may require no action. Do not perform real OCR, image recognition, barcode lookup, or upload processing.

### D. Smart Inbox

Use Smart Inbox only for ambiguity that warrants user input.

Example concept:

> One purchase needs confirmation  
> ₪58.90 · Yesterday · BIG Petah Tikva  
> Where was this purchase?  
> [Aroma] [McDonald's] [Japanika]

Resolve it with one tap and show a clear completed state. If nothing needs attention, show “Everything is up to date.”

Do not make Inbox resemble a task manager.

### E. Profile / History

Include:

- Purchase history.
- Frequent merchants.
- Categories.
- Basic preferences.
- Privacy controls.
- A future integrations area that clearly marks bank, card, and email connections as optional and unavailable in this phase.

## 10. Supporting concept views

### Purchase detail

Show merchant, date and time, total, location, products, and a concise alternative-savings insight. Do not expose unnecessary internal confidence data.

### Merchant detail

Show visits, spend, average purchase, frequent products, estimated recurring savings, and routes into purchase history or comparison insights.

### Likely needed soon

Demonstrate a predicted list derived from purchase history. Do not turn it into a permanent manually maintained shopping list.

### Route-aware comparison

Compare the normal route and one alternative destination with typical basket price, added travel time, and estimated recurring savings. Keep the visual explanation simple and immediately legible.

## 11. Mobile-first PWA-ready UX

Build, after approval, a responsive web application designed for mobile first and structured so it can later become installable as a PWA.

The Phase 1 experience should:

- Feel like a native consumer mobile app.
- Use a coherent bottom navigation pattern on phones.
- Give Capture appropriate prominence.
- Respect safe areas, touch targets, and one-handed reach.
- Handle small, typical, and large phone widths.
- Adapt intentionally to desktop instead of stretching a phone screen.
- Preserve key context when sheets, modals, and detail views open.
- Use accessible contrast, focus behavior, labels, and reduced-motion-friendly transitions.

Do not build a desktop admin dashboard and squeeze it into a phone.

## 12. Visual direction

Aim for an original, premium consumer-technology identity that feels:

- Map-centric.
- Clean and modern.
- Minimal without feeling empty.
- Financially trustworthy.
- Visually engaging.
- Easy to understand immediately.

Avoid:

- University CRUD-project styling.
- Admin-dashboard layouts.
- Bootstrap-template appearance.
- Generic AI dashboard cards and gradients without purpose.
- Banking spreadsheets.
- Excessive technical labels.

Use visual hierarchy, typography, spacing, motion, surfaces, and map treatment as one coherent system. Do not copy another product's branding.

## 13. Mock-data contract

Create one canonical fixture set separate from presentation logic. Keep it small enough to audit and rich enough to support the story.

Include at minimum:

- More than one city or geographic cluster.
- Several merchant categories.
- Recurring grocery purchases.
- Restaurant or cafe purchases.
- Purchase history with line items.
- One ambiguous merchant match.
- One strong recurring-savings recommendation.
- One proactive recommendation.
- One typical basket.
- One route-based comparison.
- Logically valid product equivalents and at least one non-equivalent contrast.

Derive displayed totals, averages, visit counts, trends, and savings from the fixtures where reasonable. If a narrative value must be stored directly, document its derivation or label it as a mock estimate. Never mix real and mock personal data.

## 14. Strict Phase 1 scope

After approval, build only:

- Front-end application.
- Main navigation and interactions.
- Map/globe-led presentation.
- Mock purchase and merchant data.
- Mock recommendations and predictions.
- Simulated Capture.
- Simulated Smart Inbox.
- Purchase and merchant detail flows.
- Responsive phone and desktop layouts.
- Polished loading, empty, success, and selected states needed for the story.

Do not build:

- Real bank or Open Banking integration.
- Real Gmail, email, or SMS access.
- Real OCR, receipt extraction, or vision pipeline.
- Real barcode catalog lookup.
- Production Purchase Fusion or Matching Engine.
- Production LLM orchestration.
- Real price collection or global product-price infrastructure.
- Production geolocation or background tracking.
- Full authentication or complex backend.
- Native iOS or Android applications.
- App Store or Google Play packaging.
- Public deployment.
- Phase 2.

## 15. Execution loops after approval

Use the following loops only after the exact approval in `AGENTS.md`.

### Loop 1 — foundation

Confirm the approved stack and screen inventory, establish the smallest coherent application shell, load canonical mock fixtures, and make the primary navigation usable.

### Loop 2 — core story

Implement the map-led Home, one purchase path, one merchant path, one For You recommendation path, Capture simulation, and Smart Inbox resolution.

### Loop 3 — responsive refinement

Inspect small phone, typical phone, large phone, and desktop layouts. Fix hierarchy, overflow, safe areas, navigation, sheets, cards, and map sizing.

### Loop 4 — functional refinement

Exercise every visible control. Fix broken, misleading, dead, or inconsistent interactions. Clearly label intentionally deferred controls.

### Loop 5 — critical review

Ask:

1. Does the product purpose read immediately?
2. Does this feel like a consumer product rather than a student dashboard?
3. Is the map clearly the visual identity?
4. Is Capture obvious and fast?
5. Does Smart Inbox demand minimal effort?
6. Are recommendations clear within seconds?
7. Is the user asked for anything that could later be automated?
8. Are mock values consistent and honestly labeled?
9. Do all screens feel like one product?
10. Is anything visibly unfinished?

List the issues, fix all high-impact issues, and repeat the affected checks.

## 16. Functional QA after approval

Check every visible interaction, including:

- Primary navigation.
- Map selections and category filters.
- Purchase and merchant details.
- Capture entry and each simulated option.
- Inbox confirmation and completed state.
- Recommendation details.
- Back, close, dismiss, and sheet behavior.
- Empty, loading, and error-like mock states used in the demo.

No visible control should be fake or broken unless it is clearly presented as a future capability.

## 17. Visual QA after approval

Inspect rendered output at representative small phone, typical phone, large phone, and desktop sizes. Prioritize mobile defects.

Check:

- Spacing and typography.
- Visual hierarchy and contrast.
- Overflow and clipping.
- Safe-area behavior.
- Map size, controls, and overlays.
- Bottom navigation and Capture prominence.
- Cards, sheets, modals, and detail views.
- Empty and success states.
- Long labels and realistic content.
- Interaction consistency.
- Motion and reduced-motion behavior when applicable.

Use actual rendered inspection, not code review alone. Re-check after fixes.

## 18. Engineering discipline

Even for a demo:

- Keep components and routes understandable.
- Separate canonical mock data from presentation.
- Avoid giant files and duplicated logic.
- Use clear names.
- Keep the project easy to evolve after product approval.
- Do not prematurely build production abstractions.
- Do not add dependencies without a clear Phase 1 benefit.
- Keep credentials and paid API keys out of the repository.

## 19. Phase 1 acceptance criteria

Do not declare Phase 1 complete until all applicable criteria pass:

- The approved project runs locally.
- Mobile layouts are polished at representative sizes.
- Desktop adaptation is intentional and usable.
- Primary navigation works.
- Map/Home is visually compelling and clearly central.
- Mock locations, merchants, and purchases are discoverable.
- Purchase and merchant detail flows work.
- For You contains realistic, useful insights rather than filler.
- Capture is understandable and convincingly simulated.
- Smart Inbox resolves an ambiguous purchase in one tap.
- Habit-learning and “likely needed soon” concepts are visible.
- Route-aware savings is understandable.
- Mock data and displayed numbers reconcile.
- No major visible control is broken or misleading.
- No obvious layout defect remains.
- No major runtime or console error remains.
- The product concept is understandable without a long explanation.

## 20. Required Phase 1 handoff

When the acceptance criteria pass:

1. Leave the runnable Phase 1 project in the workspace.
2. Provide concise run instructions.
3. Provide final screenshots of at least:
   - Mobile Map / Home.
   - For You.
   - Smart Inbox.
   - Capture.
   - One purchase or merchant detail view.
4. Summarize what was implemented.
5. Add a section titled **Not implemented yet** listing intentionally deferred systems.
6. List assumptions and known limitations.
7. State which acceptance checks were performed and their results.
8. Stop.

Do not deploy. Do not begin production backend work. Do not implement Phase 2. Wait for a new explicit human instruction.

## 21. Most important rule

When uncertain, do not silently invent a major product requirement. Prefer the simplest interpretation consistent with the approved context. Make minor reversible decisions professionally and record them. Surface major direction, cost, provider, privacy, or scope decisions for human review.

The target is a polished visual and interactive first demo that lets the team see, touch, critique, and approve the product direction before investing in the real prototype.
