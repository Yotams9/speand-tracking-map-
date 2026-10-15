# Milestone 2 — offline response failure diagnosis

2026-10-12, `feature/spendscape-rebuild`, unchanged HEAD
`acc8f12d57eacd9098158bb6a908b50737289c80`. Offline checkpoint passes; Milestone 2
remains incomplete. No provider/credential/billing action or milestone commit.

## Established and unknown

The consumed native session `af2da3b5c2ceebb1e9a55e0de270000c` recorded HTTP200,
parsing-start and ocr-invalid, with no editable draft. Its response was discarded.
No finish reason, candidate/text-part count, JSON syntax or rejected observation
field can be recovered. Do not attribute the live failure to the defect below,
claim recognition failure, or backfill its diagnostics. Its first reservation,
policy and journal remain byte-identical; second allowance remains absent/unused
and blocked by the existing stopped session. Real purchase/pin were not touched.

## Exact comparison with successful structured flow

| Component | Previous successful flow | Operational flow |
| --- | --- | --- |
| Endpoint | `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent` | Same constant |
| Model | `gemini-3.8-flash` | Same |
| Instruction | `STRUCTURED_PROMPT` | Same imported string, no reference answers |
| Image | `Buffer.from(bytes).toString('base64')`, inlineData mimeType/data | Same; one JPEG/PNG |
| Configuration | maxOutputTokens4096, responseMimeType application/json | Byte-identical; no schema/tools/thinking options |
| Headers/options | JSON, private x-goog-api-key, redirect error, cache no-store | Same |
| Input/output bounds | Existing 4MiB/pixel checks, 128000 provider JSON bytes, 64000 observation bytes | Same |
| Control | Frozen approved-image/request hash and historical exclusive pilot | Separate selected-image fingerprint, finite operational session; no old slot reuse |
| Successful response reader | boundedDirectJson, generic parsing failure | Equivalent bounded operational reader with fixed outer-JSON/structure categories |
| Candidate decoder | Historical structuredResponse | Separate instrumented operational captureResponse |
| Review/save | receiptToReviewDraft then prepareReceiptReview and explicit IDB transaction | Same; server additionally verifies draft construction before response |

A pure mocked comparison asserts identical serialized bodies, endpoint, headers and
transport options for the previous createStructuredTransport and captureTransport.
The successful request builder/prompt/model/configuration, original decoder,
financial validators and persistence files remain byte-identical to task entry.

## Demonstrated defect and smallest correction

The original decoder requires exactly one non-thought text part. Google documents
its text accessor as concatenating non-thought text parts. Fictional one/15-row
JSON split across multiple text parts is rejected by the historical decoder and
accepted by the new operational decoder, preserving every character and field.
[Official SDK response documentation](https://googleapis.github.io/js-genai/release_docs/classes/types.GenerateContentResponse.html).

The operational decoder joins text fragments in order without inserting separators,
stripping Markdown, repairing JSON, coercing numbers or selecting expected answers.
It still requires one candidate, STOP finish, supported text/signature structure,
≤16 total parts and ≤64000 combined UTF8 text bytes. Thought/signature content is
never returned/persisted. Multiple JSON objects, non-text/tools, unknown part keys,
invalid values, extra observation keys and invalid supplied GTINs still fail.
This is a demonstrated compatibility correction, not a diagnosis of the live call.

## Actual predicate diagnostics

The new error carries only validated `ReceiptFailure` metadata and public fixed
message ocr-invalid. No provider message or SyntaxError text is retained.

| Category | Actual boundary/predicate |
| --- | --- |
| candidate-missing | Missing/empty candidates or no non-thought text |
| candidate-blocked | Prompt blockReason is present, with absent candidate output |
| response-structure | Unsupported envelope/parts/signature, encoding/stream/body/text bound |
| truncated | Provider finishReason is exactly MAX_TOKENS; never inferred from JSON failure |
| provider-finish | Non-STOP finish; only documented enums or fixed UNKNOWN retained |
| invalid-json | JSON.parse fails at outer response or concatenated output |
| observation-contract | Existing structuredObservations rejects; exact observation field remains unknown |
| review-contract | Actual receiptToReviewDraft construction throws |
| review-validation | Actual prepareReceiptReview/validateReview returns errors when user submits |

Paths are fixed response/candidates/finish/parts/output.json/observations/review.
Candidate/part/text-part counts are capped at16, limitExceeded is Boolean; finish
and block reasons are allowlisted. Unknown strings become UNKNOWN; no raw finish
message, response ID, model message, prompt, field value or geometry is retained.
Validators reject extra keys, getters, sparse arrays, arbitrary paths, invalid
category/path combinations and oversized metadata. Review field paths map actual
error keys to a fixed set, deduplicated and capped at8; unknown keys become other.
No validation result is approximated by a separate receipt/geometry algorithm.

Server failure metadata flows through the existing failure boundary to the durable
allowlisted journal before response disposal, and into safe API/UI feedback. Strict
journal reading after restart verifies it and rejects tampering. Existing code,
HTTP status, one-request/concurrency/fail-closed/restart protections stay intact.
Legacy journals remain readable without the new optional property and are not edited.

Review/domain diagnostics live only in the transient review form's
`data-receipt-failure` attribute, derived from actual errors; clear on correction,
close/unmount. They are not appended to an already completed extraction journal,
not saved to IndexedDB and do not trigger telemetry requests. Missing facts still
create an editable draft, then require review; they are not extraction failure.
Per-line arithmetic remains blocking. Product line sum and final payable remain
independent, with their difference nonblocking. Save is always explicit.

## Exact changed-file scope

Task-only manifest and patch relative to preserved entry working changes:
`artifacts/m2-failure-diagnostics-d3ba64c9/manifest.json`, `TASK.diff`.
All uncommitted; no staging. Earlier Milestone 2 implementation/research excluded
from this task-only patch where already present.

1. `src/features/receipt-image/receipt-failure.ts` — strict fixed diagnostic contract/projection.
2. `src/features/receipt-image/structured-capture-response.ts` — operational decoder/reader.
3. `src/features/receipt-image/receipt-failure.test.ts` — synthetic structural/privacy/financial tests.
4. `src/server/receipt-capture-diagnostics.test.ts` — exact wire comparison, persistence/restart mocks.
5. `src/server/receipt-capture.ts` — selects new operational decoder/reader.
6. `src/server/receipt-capture-qa.ts` — same decoder and isolated multipart fixture.
7. `src/features/receipt-image/vision-attempt.ts` — optional allowlisted failure metadata.
8. `src/features/receipt-image/direct-image-boundary.ts` — trusted error projection into journal/API.
9. `src/features/receipt-image/ReceiptImageIntake.tsx` — validated safe category/finish/path feedback.
10. `src/features/capture/PurchaseReview.tsx` — transient projection of actual review errors.
11. `qa/m2-failure.config.ts` — isolated browser output/provider-disabled origin.
12. `qa/spendscape-m2-failure.spec.ts` — synthetic failure and review/save/reload checks.
13. `docs/spendscape/COLLEGE_RECEIPT_CAPTURE_FAILURES.md` — this checkpoint.
14. `docs/AI_HANDOFF.md` — appended diagnosis section only.

## Verified evidence

Fresh isolated candidate/evidence: `artifacts/m2-failure-diagnostics-d3ba64c9/`.
Candidate is HEAD plus prior reviewed M2 implementation plus this scope; unrelated
uncommitted native configurations/research absent. No ignored historical fixture
or real receipt is used by new tests. Native fetch is injected/mocked; browser
provider destinations are forbidden and server mode is fictional-qa, with no key.

- Focused initial corrected suite 50/50; added stream-failure regression in final set.
- Complete final serial suite **1002/1002 across50 files**, `unit-final.log`.
  Existing parallel timer caveat was not changed or claimed fixed.
- Application and focused QA/server TypeScript checks passed; `typecheck-verified.log`,
  `typecheck-focused-verified.log`. No claim of a clean repository-wide legacy QA check.
- Isolated production build passed, `build-verified.log`; existing multiple-lockfile
  root warning remains. No dependency changes.
- Final combined browser **13/13**, `browser-final.log`: all failure categories,
  malformed diagnostic exclusion, EN/HE user-required review and strict arithmetic,
  correction/explicit Save/reload, independent line/payable totals and actual
  server multipart mock → editable review without automatic save.
- Synthetic mobile renders inspected at360/390 px EN/HE; preserved highlighted
  line error/focus and readable LTR diagnostic codes within RTL. Initial crowded
  diagnostic placement corrected to a separate line. No real receipt screenshot,
  trace, video or content artifact. Initial test syntax failure retained; corrected.
- Prior successful request/decoder, historical evidence/freezes/consumed locks,
  unused second allowance, excluded work, HEAD/main refs/index and entry next-env
  bytes preserved. Mock server only on3193; user3172 and real browser storage untouched. Owned3193 mock server stopped.

## Smallest next live gate (proposal only)

After checkpoint review, authorize ONE new operational-session request of the same
approved weighted crop, with a new source/build freeze and one-request/US$0.10
session limit using existing Prepay. Same Gemini3.8Flash request/JSON mode, estimated
US$0.0354 under the previously checked standard pricing; recheck pricing/balance and
private key/project readiness before any dispatch. No current launcher reuse,
remaining-slot bypass, retries, fallback or billing change.

On failure: inspect safe category/path/allowlisted finish/counts independently, stop,
retain reservation. On success: compare all proposed fields against the original
locally, preserve missing facts and human corrections, ask user to Save, then verify
one addition, original purchase/pin intact, Purchases/reload/duplicate protection.
One successful new request alone does not complete real repeated-capture acceptance;
any subsequent distinct receipt request needs its own remaining authorization gate.
Milestone-completion commit remains blocked until the real milestone criteria pass.
