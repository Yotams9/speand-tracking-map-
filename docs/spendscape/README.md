# Spendscape — Durable Project Package

This directory is the durable memory and execution contract for Spendscape.
Future Codex tasks should rely on these local authority files instead of needing the
full brainstorming transcript.

## Read order

1. `../../AGENTS.md` — authority, worktree rules, current gate.
2. `CONVERSATION_HANDOFF.md` — relevant history and current workspace facts.
3. `MASTER_PROMPT.md` — primary agent brief.
4. `PRODUCT_CONTEXT.md` — locked decisions and inherited baseline.
5. `DESIGN_AND_GLOBE_SPEC.md` — visual system and globe behavior.
6. `ARCHITECTURE_DATA_AI.md` — stack, data, ingestion, AI, privacy.
7. `EXECUTION_PLAN.md` — phased delivery and evidence.
8. `TECHNOLOGY_STRATEGY.md` — subordinate candidates, evaluations, and risks.
9. `REFERENCE_MANIFEST.md` — sources, tools, accounts, provenance.
10. `PROMPT_SEQUENCE.md` — exact prompts for every gate.

## Status

- Repository: `Yotams9/speand-tracking-map-`
- Worktree: `spendscape-worktree`
- Branch: `feature/spendscape-rebuild`
- Product: **Spendscape**
- Delivery: responsive web/PWA only
- Completed implementation checkpoint: bounded Phase 2A.1 local data contract boundary, fixture adapter, and Ask boundary correction, recorded by this local checkpoint
- Phase 1E status: final critical review, production-rendered local QA, and documentation reconciliation completed with no remaining Blocker or High defect
- Latest committed and pushed Scanner A checkpoint: `23683efcfea1151b96d940e420eafd19760626c6`.
- Latest completed, reviewed, committed and pushed Scanner B checkpoint: `33a34afb2668f58b89431e3cb7bc5f3c292ebb8d`, including the bounded transient invalid-frame correction. Scanner A is also completed and reviewed at the checkpoint above.
- Current authorization: documentation-only iPhone Scanner A/B and Vercel demo reconciliation. No implementation slice is currently active; documentation checkpoint review, commit and push remain separate gates.
- Active college demo: [spendscape-college-demo](https://spendscape-college-demo.vercel.app), SkDev / sk-dev3, Hobby; its separately approved first deployment is labelled Production.
- Physical iPhone evidence: **user-reported smoke-test pass** on iPhone 17 Pro, iOS 26.6.1 Safari. See [the current handoff](CONVERSATION_HANDOFF.md#scanner-ab-and-college-demo-reconciliation) for the exact deployment, reported checks, evidence limitations and minor demo-button UX issue. This is not independently instrumented device QA.
- Scanner B identifies candidates only and does not create or save purchases. [SCANNER_B_CHECKPOINT.md](SCANNER_B_CHECKPOINT.md) preserves the implementation and correction history.
- Preserved interaction checkpoint: details-first synthetic Life Replay with no automatic camera travel and explicit `Show place` as its only camera-moving action
- Existing app: Next.js App Router + React + TypeScript Spendscape concept
- Prior implementation checkpoint: `b5796c5d393d8271dd7ee1b175c2c45bfe364806`
- Phase 1 data: synthetic only
- Backend/authentication/Supabase/SQL/real provider integrations remain unimplemented and separately gated. The existing Vercel account/project and bounded demo deployment are recorded exceptions, not permission for further resources or deployment.
- Phase 2A.1 boundary: provider-neutral serializable read snapshot + fixture adapter over the unchanged canonical synthetic graph; no transport or mutation API
- Phase 2A.1 correction: Ask merchant lookup and all active feature/domain fixture fallbacks removed; 104 unit tests, 16 boundary/Ask browser tests, and 4 focused Replay/composition checks passed

The old root Phase 1 documents remain as historical evidence. They are not the
Spendscape execution contract.

The latest user decision replaces planned local Supabase Phase 2A.2 with a
college demo using the fixture baseline and session-only additions. No Docker,
Colima, Supabase, database, authentication or hosted storage is authorized.
Scanner A owns the explicit-user-action native camera preview. Scanner B adds
local reader-only barcode decoding and six synthetic product candidates, with
no scanned purchase mutation. Existing manual and simulated Capture paths remain
unchanged. Scanner D, Scanner E, optional Scanner C, further deployment and
resource changes retain separate gates. Historical checkpoint statements
excluding camera access or awaiting device QA describe their original scope;
the current handoff records the later user-reported smoke test.
