---
name: plan-with-phase-gates
description: Plan product or engineering work through explicit human approval gates and hard stops. Use for readiness reviews, phase plans, implementation requests, scope changes, “continue” requests, acceptance planning, or any task that could cross from planning into building or testing.
---

# Plan With Phase Gates

Preserve human control while keeping the work concrete and executable.

## Establish authority

1. Read the closest `AGENTS.md` and identify the current phase.
2. Record which actions are currently authorized: read, plan, edit documentation, implement, test, deploy, or advance phases.
3. Treat a requested deliverable as a goal, not as automatic permission to cross a gate.
4. Require the exact approval defined by `AGENTS.md` before implementation or QA.
5. Stop when an action needs authority that has not been granted.

## Build the phase plan

Define:

- One phase objective.
- Concrete deliverables.
- In-scope and out-of-scope work.
- Dependencies and material provider choices.
- Reversible assumptions.
- Decisions requiring human input.
- Acceptance evidence.
- The phase's hard-stop condition.

Keep later phases visible only as deferred context. Do not pull their work into the active phase.

## Use bounded loops

After approval, organize each loop as:

`TARGET → CHANGE → VERIFY → FINDINGS → FIX → RE-CHECK`

Tie every loop to an acceptance criterion. Do not use “self-improvement” as permission for open-ended redesign, extra features, new integrations, or unrelated refactors.

If the same problem remains after reasonable attempts, report the evidence and the smallest decision needed from the user. Do not lower the acceptance bar silently.

## Report phase status

Include a compact ledger in planning or checkpoint responses:

- Current phase.
- Authorization received.
- Completed evidence.
- Remaining acceptance items.
- Assumptions.
- Deferred work.
- Next approval required.

At the hard stop, deliver the required artifacts and wait. Do not treat completion of one phase as approval for the next.

