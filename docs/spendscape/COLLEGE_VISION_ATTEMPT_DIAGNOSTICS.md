# Local Vision attempt diagnostics — 2026-10-06

Entry: feature/spendscape-rebuild, HEAD
108d2bbce89b452230781dfa75157c87a700dff9. Authorized correction + offline/local
fictional QA only. No new live attempt, credentials, commit or deployment.

## Durable lifecycle

The original exclusive reservation remains the one-call guard. Only its successful
owner may exclusively create a separate 0600 `attempt-one.lifecycle.jsonl` in the
same private directory. Initial file and parent directory are fsynced; subsequent
serialized events are fsynced. Failure to establish/write the diagnostic record
before transmission fails closed and consumes the reservation. No reset or retry.

At most 16 events, only fixed stage codes and 0–60,000 ms elapsed timing. HTTP
status is an integer 100–599; Google numeric code uses canonical RPC 0–16 and a fixed REST error-code list; Google status and
failure codes are explicit allowlists. Unknown fields/messages/reasons are
ignored. No image, token, request body, OCR text, receipt value or raw error is
written/printed. HTTP error inspection is transient and capped at 4 KiB; malformed,
oversized or unknown errors retain the HTTP status alone. Success-body limit
remains 2 MiB. Existing image hash/origin/default-off/timeouts remain.

Stages: reserved; authentication-start/complete; dispatch-initiated; provider-http;
normalization-start/complete; parsing-start/complete; review-response-complete;
failure/interrupted. A separate provider-http event may add allowlisted error codes.
Dispatch initiation records intent immediately before the single send invocation;
cancellation can still prevent invocation. It does **not** prove Google received
or processed anything. A received HTTP response proves only that response/status,
not successful OCR. Response completion records preparation of the returned
Response object, **not** delivery or browser inspection success.

Abort/timeout records interruption and terminally ignores late events/results.
A process crash can leave an incomplete record; inspection never fabricates its
cause or marks it failed/successful. Partial/unreadable/unsafe records return a
fixed diagnostics-unavailable error. A post-dispatch filesystem failure cannot
undo the request; last durable stages remain incomplete, and no retry follows.

## Restricted inspection and legacy evidence

With existing local activation gates, same-origin loopback GET `/api/receipt-ocr`
with `x-spendscape-local-vision: 1` and `x-spendscape-vision-status: 1` returns
`attempt-status`, `consumed`, and safe `attempt` metadata; no-store/nosniff.
Foreign/public/forwarded origins and hosted/CI activation stay unavailable.
No credential lookup or provider call occurs during GET. No new public UI control.

The historical reservation is still consumed. There is no historical lifecycle
record; GET reports attempt=null and consumed=true. This is absence of diagnostics,
not evidence of dispatch or success. No historical record is backfilled/reinterpreted.
A future real call needs a separate approval and reviewed new attempt reservation.

## Mock QA and evidence

Explicit `SPENDSCAPE_VISION_DIAGNOSTIC_QA=1`, validated QA_RUN (8–64 lowercase
alphanumeric/underscore/hyphen characters), and synthetic approved hash select
fake authentication/transport; native gcloud/fetch is never reached in that branch.
QA reservation/record live only under `artifacts/vision-diagnostics-qa/<run>`.
Vercel/CI and origin gates still apply. No environment file or credential is created.

- Focused lifecycle/boundary: 44/44 tests. Covers auth failure, HTTP 400/403/429/500,
  malformed/oversized/private errors, normalization/parser failure, timeout,
  disconnect, late-result rejection, concurrency, restart, record establishment/
  pre-dispatch failure and privacy allowlists. Global native-fetch guard in tests. Per-image codes with HTTP 200 are covered too.
- Full unit suite: 443/443, 27 files. Application typecheck passed.
- Production build passed. Two retained initial failures: Turbopack traced the
  dynamic QA path into an unrelated ignored Python venv symlink. Dedicated QA
  subtree fixed it; no historical file or Next configuration was altered.
- Fresh isolated production browser: 7/7, 10.1 seconds, no retries/skips. Two native
  fictional endpoint/status tests plus five copied neighboring EN/HE save/reload/
  cancellation tests. Copies change only imports/output destinations. No historical
  QA output regenerated. The browser harness requires explicit fictional mode before submission. Status remains readable after leaving Capture; repeat
  POST blocked, foreign origin rejected. Unit tests cover interrupted transport.
- Inspected fresh 360x640 EN/HE draft screenshots. Existing 430 HE/1280 EN cases
  passed too. Baseline 42 purchases/12 pins/one MapLibre; explicit saved fictional
  addition reloads as 43 with 12 pins. No consumer UI or financial parsing change.
- Evidence: `artifacts/vision-diagnostics-0knnvnf4/`, dedicated mock-run directory
  recorded in qa-root.txt. Timing is local QA, not real OCR performance.

## Manifest (10)

- docs/AI_HANDOFF.md
- docs/spendscape/COLLEGE_VISION_ATTEMPT_DIAGNOSTICS.md
- qa/spendscape-vision-diagnostics.spec.ts
- src/features/receipt-image/vision-attempt.ts
- src/features/receipt-image/vision-attempt.test.ts
- src/features/receipt-image/vision-local-boundary.ts
- src/features/receipt-image/vision-local.test.ts
- src/features/receipt-image/vision-transport.ts
- src/server/vision-attempt-record.ts
- src/server/vision-local.ts

This manifest is ten files (four existing source modifications, five new source/
QA/checkpoint files, and handoff); no generated files or historical pilots.

## Remaining gate

Separate diagnostics checkpoint review. No new real request or general receipt
accuracy claim. Prior real result, consumed reservations/scores and overwritten
historical QA evidence limitations remain unchanged. No dependency, account,
billing, application storage-schema, commit/push/deployment change.

## Final Git and cleanup evidence

HEAD remains 108d2bbce89b452230781dfa75157c87a700dff9; main and origin/main
remain eee0d26b55e5061f87ac664938df0c195800b74f. Cached upstream feature is
66fb4204154c88789e9e0401e317f9000b6b5e18, ahead 11/behind 0 without fetch.
Index empty; unrelated untracked research preserved. All 656 protected source/
provider/benchmark/previous-task artifact inputs match entry hashes. Historical
native lifecycle remains absent and its consumed reservation is byte-identical.
Owned QA servers stopped; next-env matches entry and HEAD. Whitespace and strict
new-browser-spec typecheck passed. Generated evidence is ignored and excluded.
