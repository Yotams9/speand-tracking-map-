---
name: run-visual-qa-loops
description: Run rendered visual and interaction QA loops for an approved responsive front-end phase. Use after build-and-QA authorization to inspect phone and desktop layouts, exercise visible controls, capture evidence, prioritize defects, fix them, and re-check; before authorization, provide only a QA plan.
---

# Run Visual QA Loops

Verify the rendered experience repeatedly; do not substitute code inspection for visual evidence.

## Check authorization first

Read `AGENTS.md`. If implementation and QA are not explicitly authorized, return only the planned viewport, interaction, and acceptance matrix. Do not start a server, run browser automation, execute tests, or take screenshots.

## Prepare the matrix

Cover at least:

- Small phone.
- Typical modern phone.
- Large phone.
- Desktop.

Exercise the main product states: Map/Home, category filtering, purchase detail, merchant detail, For You, Capture options, Smart Inbox confirmation, completed Inbox, History/Profile, back/close behavior, and any empty or loading states included in the demo.

## Run one loop

1. Render the target state at the target viewport.
2. Inspect spacing, hierarchy, typography, clipping, overflow, safe areas, map sizing, overlays, navigation, touch targets, focus, contrast, and content length.
3. Exercise every visible control in the state.
4. Record defects with viewport, state, expected result, actual result, and severity.
5. Fix the smallest coherent set of high-impact issues.
6. Re-render the affected state and its nearest responsive neighbor.
7. Keep evidence only when it reflects the current build.

## Prioritize defects

- **Blocker:** Cannot navigate, complete the demo story, or view primary content.
- **High:** Broken interaction, major responsive failure, severe clipping, misleading result, or inaccessible primary action.
- **Medium:** Noticeable hierarchy, consistency, content, or polish problem.
- **Low:** Minor cosmetic refinement with no meaningful usability impact.

Fix blockers and high-severity defects before expanding scope. Fix medium defects that materially affect perceived quality. Record any accepted low-severity limitations honestly.

## Protect evidence quality

- Capture final screenshots only after the relevant state passes re-check.
- Use realistic mock content, not empty placeholders.
- Keep debug controls, browser chrome, and transient error overlays out of final screenshots unless needed as evidence.
- Do not claim a viewport or interaction passed without inspecting it.
- Re-test related navigation after structural layout changes.

## Complete the loop

Report:

- Viewports and states inspected.
- Interactions exercised.
- Defects fixed.
- Remaining known limitations.
- Acceptance criteria passed or failed.

Stop at the phase hard stop in `AGENTS.md`. Visual approval does not authorize the next phase or deployment.

