---
name: design-mobile-pwa-ux
description: Plan or implement mobile-first PWA user experiences for the purchase-intelligence concept demo. Use for screen inventory, information architecture, responsive layout, navigation, map-led Home, Capture, Smart Inbox, interaction states, accessibility, and desktop adaptation; do not use it to authorize implementation.
---

# Design Mobile PWA UX

Create a consumer mobile experience first, then adapt it intentionally to larger screens.

## Respect the phase gate

Read `AGENTS.md` before acting. During planning-only phases, produce screen, state, and interaction specifications without creating application code, launching the app, or running QA. Begin implementation only after the required approval.

## Start from the core jobs

Prioritize the daily experience:

1. See purchases and places on a map-led Home.
2. Understand a useful insight in seconds.
3. Capture a purchase with minimal effort when needed.
4. Resolve meaningful uncertainty with one tap.
5. Review history, privacy, and optional integrations.

Keep the main navigation to Map, For You, Capture, Inbox, and Profile. Give Capture appropriate prominence without letting it displace Map and For You as the primary value surfaces.

## Design mobile first

- Begin with the smallest supported phone layout.
- Keep primary actions in comfortable reach.
- Respect safe areas and virtual keyboards.
- Use touch targets large enough for reliable use.
- Keep map controls and overlays from competing for space.
- Prefer bottom sheets or focused full-screen flows for mobile details.
- Preserve clear back, close, and dismissal behavior.
- Adapt navigation and layout deliberately for desktop.

Do not compress a desktop dashboard into a phone viewport.

## Make the map the hero

Keep the geographic surface visually dominant on Home. Use clusters, selected states, filters, and contextual sheets to reveal detail progressively. Avoid covering most of the map with permanent cards.

Ensure the product remains understandable if map rendering is simplified for the concept demo. The visual identity should survive without depending on an expensive or production-grade map engine.

## Minimize user work

- Simulate Capture as camera-first and fast.
- Explain automatic future sources without asking users to configure them in the demo.
- Ask questions in Smart Inbox only when the answer materially affects an outcome.
- Resolve questions in one tap where possible.
- Show a calm “Everything is up to date” state when no help is needed.
- Hide internal pipeline and confidence jargon from ordinary UI.

## Define complete states

For each screen or interaction, specify applicable states:

- Default.
- Selected or expanded.
- Loading or transition.
- Empty.
- Success.
- Ambiguous or needs attention.
- Unavailable future capability.
- Error-like demo state only when it helps evaluate recovery.

Do not create dead controls. Make a visible control work or label it clearly as deferred.

## Preserve trust and accessibility

- Use plain language for estimated savings and uncertainty.
- Avoid manipulative urgency, shame, or financial overclaims.
- Provide sufficient contrast, visible focus, semantic labels, and reduced-motion-friendly behavior.
- Keep key information available without relying on color alone.
- Use realistic content lengths during design, not only short placeholders.

## Review the experience

Confirm that the product purpose is immediate, the map is the identity, insights are actionable, Capture is obvious, Smart Inbox is low-friction, and all screens feel like one original consumer product rather than a generic dashboard.

