# College P2B — partial live benchmark and stop

Current state: **stopped at 5/12**, after the separately authorized recovery below.
Earlier 3/12 sections preserve the original stop history.

2026-09-26. User launched the approved runner from their own keyed terminal.
Free tier and unlinked billing were confirmed by the user, not independently
verified through an account API. Authorized maximum: 12 calls, $0, synthetic only.

## Verified results

| Attempt | Fixture | Outcome | Exact rows | Correction fields | Elapsed |
| --- | --- | --- | --- | --- | --- |
| 1 | english-6 | HTTP 200; evidence exact | 6/6 | 0 | 4.257 s |
| 2 | hebrew-6 | HTTP 200; evidence exact | 6/6 | 0 | 22.392 s |
| 3 | mixed-25 | HTTP 503; stopped | unmeasured | unmeasured | 15.604 s |

Both successful responses name gemini-3.8-flash. Offline re-evaluation of the
retained responses exactly matches the stored scores: quantities, unit prices,
discounts, line totals, merchant/date/currency and total match the short fixtures.
Request body bytes: 127898, 123542, 347914. Successful response body bytes: 2640,
2646. These are body sizes, not TLS transfer measurements. Each successful
response reports 1282 input, 564 output and 1846 total tokens; these are provider
usage fields, not an independently verified invoice. No paid usage was authorized.

The third failure is specifically HTTP 503, not a locally observed timeout or
HTTP 429. The runner deliberately discarded its error body, so its detailed
cause cannot be established from retained evidence. No automatic retry occurred.
The durable attempt journal has exactly three entries. Failed attempt 3 consumes
one of the 12 authorized attempts; it must not be erased or silently replayed.

## Interpretation and limits

Two accurate short receipts do not establish the 25-item college-product goal,
repeated-run reliability, ambiguity handling or degraded-image extraction.
The Hebrew short case took 22.392 seconds: do not describe the system as
consistently fast. P2A's explicit 15-second long-receipt target has not been
measured successfully. No model promotion, integration, device performance or
full benchmark pass is established. D1's negative result is unchanged.

Current recommendation: incomplete; preserve evidence and stop. Nine attempt
slots remain under the total ceiling, but the error-stop gate requires a bounded
recovery authorization before changing the runner or issuing further calls.
A recovery should resume slots 4–12 only, preserve slot 3 as failed, retain the
same model/prompt/images/30-second timeout and Free/$0 boundary, and stop again
on an error. It must not reset the journal or add a thirteenth attempt.

## Evidence and Git safety

Ignored evidence: artifacts/receipt-p2b-run/summary.json, attempts.jsonl,
1-response.json and 2-response.json. No key or raw response is copied here.
Current review performed offline rescoring only, with zero additional API calls.
No runner, application source, dependency, storage schema or generated-file edit.
HEAD remains 399fce8e8209f0ffbeb8893903a28b43d537f8aa on
feature/spendscape-rebuild. Both main refs remain
eee0d26b55e5061f87ac664938df0c195800b74f. No stage, commit, push or deployment.

Next bounded authorization, if continuing:
`APPROVE SPENDSCAPE COLLEGE P2B — RESUME REMAINING 9 ATTEMPTS AFTER HTTP 503, PRESERVE 12-CALL TOTAL, FREE TIER ONLY, $0`.

## Recovery authorization received

The exact remaining-nine approval above was received. Runner preparation now
supports `--resume-after-3`, with offline journal/request-hash validation and a
permanent exclusive recovery reservation. 20 combined offline/mock tests pass,
including nine-only continuation, unchanged original results, concurrent-start
rejection, new-error stop and changed-request rejection. Live state at preparation
remains 3/12; user execution is pending in their keyed terminal. This does not
claim nine further calls or a new benchmark result.


## Recovery results — second stop at 5/12

The user ran the authorized resume. Slot 4 (mixed-25-degraded) returned HTTP
200 in 26.787 s; slot 5 (english-6 repeat 2) returned HTTP 503 in 24.447 s.
The journal contains five attempts; the recovery reservation remains consumed.
No automatic retries, further API calls or runner changes were made in review.

Offline rescoring of retained 4-response.json exactly matches summary.json:
- All 25 quantities, units, unit prices, discounts and line amounts exact.
- Total and merchant/date/currency exact; no missing or extra rows.
- Deliberately unreadable row 25 name remains null and explicitly uncertain.
- Strict label scoring: 24 mismatches, hence 1/25 fully exact rows and 25
  correction fields/lines including the intentional uncertainty.
- Diagnostic comparison only: every one of those 24 label mismatches contains
  exactly the same whitespace-delimited word multiset after NFC normalization,
  but in a different order. Zero other label-token differences observed.

This suggests bilingual reading-order/fixture alignment sensitivity; it does
not establish 24 wrong product identities or 25 actual manual corrections.
The scorer and thresholds were not changed, and token-multiset equality is
not substituted for contextual numeric acceptance or a promotion pass. Review
bilingual rendered label equivalence offline before interpreting correction
burden or changing a future evaluation protocol. Keep original scores intact.

The degraded 25-item result also exceeds the 15-second latency target. With
three successful responses and two HTTP 503 failures, the small interrupted
sample does not establish stable latency, reliability or promotion readiness.
The detailed 503 causes remain unknown because error bodies were not retained.
Seven unused slots remain under the ceiling, but this recovery stopped and
its authorization is consumed; do not rerun, delete locks, reset the journal,
raise timeouts or switch models. Recommended next work: offline bilingual
label/scoring review, before requesting any further API recovery. No new call
or paid usage is authorized by this report.


## Approved offline bilingual evaluator correction

Authority: `APPROVE SPENDSCAPE COLLEGE P2B — OFFLINE BILINGUAL EVALUATOR CORRECTION + QA`.
No additional API calls: the journal remains at **5/12**, with seven unused
slots and the recovery authorization consumed.

The preceding offline rendered review found that all 24 readable labels from
attempt 4 reproduce the expected RTL canvas pixels when rendered LTR. Rendering
those returned strings RTL instead does not reproduce the source. All 24 are
exchanges of two intact Hebrew/Latin runs, with no within-run reorder or changed
package text. This is evidence of representation ambiguity in this synthetic
corpus, not proof of 24 wrong products or 25 actual user edits. Pixel evidence
is local Chrome/Arial only; it does not establish future UI or device behavior.
Retained evidence: ignored `artifacts/receipt-p2b-label-review/metrics.json`
and `comparison.png` from the prior review.

`qa/receipt-p2b/label-diagnostic.mjs` adds the supplementary metric
`reviewed-two-run-labels-v1`. It accepts only the reviewed, unchanged mixed
fixtures, the same row, and an exact exchange of intact language runs after
NFC/whitespace normalization. It rejects changed words/package sizes, within-run
reordering, interleaving, bidi controls and unreviewed fixture variants. It
never repairs extracted text. Explicit uncertainty still requires review.
The original strict evaluator and its acceptance thresholds remain unchanged.
Numeric, arithmetic, date, currency, merchant, omission and extra-row failures
remain in the strict report; no diagnostic grants promotion or automatic save.

Offline rescoring of all three retained successful responses exactly matches
the original stored strict scores:

| Attempt | Strict exact rows | Strict correction fields | Reviewed label swaps | Supplementary remaining fields / lines |
| --- | --- | --- | --- | --- |
| 1 | 6/6 | 0 | 0 | 0 / 0 |
| 2 | 6/6 | 0 | 0 | 0 / 0 |
| 4 | 1/25 | 25 | 24 | 1 / 1 |

The remaining field is the deliberately unreadable name. These counts are
scoring diagnostics, not measured human editing effort. Attempt 4 still fails
the original strict evidence score and exceeds the 15-second target at 26.787 s.
Two HTTP 503 failures and absent repetitions still prevent a reliability or
promotion claim. D1's negative recommendation is unchanged.

QA: `node --test qa/receipt-p2b/*.test.mjs qa/receipt-p2a/evaluate.test.mjs qa/scanner-d1/numeric-evidence.test.mjs`
passed **42/42**, zero failures, skips or cancellations. This includes ten new
label-diagnostic tests, eight existing mock runner tests, twelve P2A evaluator
tests and twelve D1 contextual numeric tests. `node qa/receipt-p2b/rescore-labels.mjs`
read saved responses only and asserted exact equality with every original score.
Its safe output, including response SHA-256 hashes, is retained in ignored
`artifacts/receipt-p2b-label-review/diagnostic-v1.json`. No application/browser
QA was rerun because no consumer code changed.

Correction manifest: the three QA files `label-diagnostic.mjs`,
`label-diagnostic.test.mjs`, `rescore-labels.mjs` under `qa/receipt-p2b/`, its
`README.md`, this report and `docs/AI_HANDOFF.md`. Earlier P2A/P2B files remain
uncommitted separately within the same working tree. No stage, commit, push,
deployment, dependency, schema, UI, fixture or live-runner change.


## Approved offline test reproducibility correction

The complete checkpoint review found a Medium issue: mock tests called the
live Git preflight and would fail after staging or committing the checkpoint.
Authority: `APPROVE SPENDSCAPE COLLEGE P2A+P2B — OFFLINE TEST REPRODUCIBILITY CORRECTION + QA`.

`prepareJobs()` now performs the unchanged fixture/hash/request validation
independently of Git. Mock tests and offline `--check` use it. Live invocation
still calls `preflight()`, which runs `validateExecutionGit()` first and retains
the exact branch, original approved HEAD and empty-index restrictions. No live
loop, request, timeout, pacing, quota, journal, reservation or response changed.

Fresh combined offline QA: **44/44 passed**, zero failures/skips/cancellations.
Two added tests cover rejection of wrong branch, changed HEAD and staged files,
and a subprocess that forbids every Git and fetch call while running both
`--check` and offline job preparation. No actual staging or Git mutation was
needed. The original controls and saved-response scores remain unchanged;
call count stays **5/12**, with no new live authorization or model promotion.

This correction changes five existing working-tree files: `qa/receipt-p2b/run.mjs`,
`qa/receipt-p2b/run.test.mjs`, `qa/receipt-p2b/README.md`, this report, and
`docs/AI_HANDOFF.md`. The complete P2A/P2B manifest remains 21 files. Next gate:
separate complete checkpoint re-review. No commit, push or deployment.
