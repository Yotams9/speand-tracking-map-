# P2B: authorized synthetic Gemini benchmark runner

**Current state: stopped at 5/12. Initial and recovery invocations below are historical; do not rerun them. No further live calls are authorized.**

User authorized gemini-3.8-flash, at most 12 calls, Free tier only, $0.
User reported Free tier, no linked billing and quotas 5 RPM / 250K TPM / 20 RPD.
The key is configured in the user's terminal, not supplied to Codex.
No live call was made while preparing this runner. 17 offline/mock tests passed.

Run `node qa/receipt-p2b/run.mjs --check` for offline checks only.
From the terminal holding GEMINI_API_KEY for the verified project, run:
`node qa/receipt-p2b/run.mjs --run --free-tier-confirmed`.
Do not use a key from another or billing-enabled project. The flag records user
confirmation; the runner cannot independently determine billing from an API key.
No billing settings are changed. The $0 boundary relies on that unbilled project.

Exactly four P2A images, three repetitions each; sequential requests, 13 seconds
between completions and subsequent starts, 30-second request/body timeout,
8192 output-token limit, low thinking, no summaries. No retries, fallback,
Files API, tools, grounding, caching resource or application integration.
Interactions uses store=false; this does not override Google's Free-tier data
processing terms. Only synthetic data is permitted.

A permanent exclusive run directory prevents concurrent or repeated invocation.
An fsynced journal reserves every attempt before network activity. Errors and
interruptions consume allowance and stop; do not delete the directory to retry.
Partial interrupted results need manual review before any further authorization.
An HTTP timeout cannot guarantee cancellation of server-side processing.

Ignored artifacts/receipt-p2b-run contains synthetic raw responses (never request
headers), safe scores, payload-body byte counts, elapsed time and usage. Body
bytes are not full TLS/network transfer measurements. Keys and provider errors
are never printed. A reflected literal key blocks response retention.
Results do not establish promotion; P2A thresholds and D1 limitations still apply.
No interpretation or repair of extracted fields. Local envelope version/receipt
ID are evaluation metadata, not evidence sent to the model. All request hashes
and image hashes are recorded. Schema/prompt live in request.mjs.

Official request and response references checked during preparation:
- https://ai.google.dev/gemini-api/docs/image-understanding
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/api/interactions-api
- https://ai.google.dev/gemini-api/docs/interactions-overview

No dependencies, source UI, IndexedDB, commit, push or deployment changes.

## Authorized recovery after attempt 3 HTTP 503

User explicitly approved resuming the remaining nine slots. Preparation passed
20 combined offline/mock tests. No live recovery request was sent by Codex.
`--check-resume` validates the original three journal entries and summary offline.
Run `node qa/receipt-p2b/run.mjs --resume-after-3 --free-tier-confirmed` only from
the user's keyed terminal for the same verified unbilled Free project.
The permanent exclusive resume-after-3.lock consumes this recovery once.
Attempts 1–3 remain unchanged; append slots 4–12, starting with degraded mixed
repeat 1, then all four fixtures for repeats 2 and 3. Failed slot 3 is not retried.
A new failure/interrupt requires review; never delete the lock/journal to rerun.
The model, request schema/prompt, timeout, pacing and original 12-call cap stay
unchanged. Completing these slots yields at most 11 successful results, not 12.


## Offline bilingual diagnostic

Run `node qa/receipt-p2b/rescore-labels.mjs` to read the retained successful
synthetic responses and assert unchanged original scores. This command performs
no network activity and prints only safe scoring metrics and response hashes.
Run `node --test qa/receipt-p2b/*.test.mjs qa/receipt-p2a/evaluate.test.mjs qa/scanner-d1/numeric-evidence.test.mjs`
for the 44 offline/mock regression cases.

`label-diagnostic.mjs` reports reviewed intact Hebrew/Latin run exchanges
separately from the original strict score. Its equivalence is limited to the
unchanged mixed-25 fixtures and exact row labels, not arbitrary OCR output.
No within-run sorting, digit repair, translation or numeric leniency is allowed.
Uncertainty and factual errors remain review obligations. Supplementary counts
are not measured user effort or model promotion. Saved responses, strict scores,
request/prompt, fixtures and attempt journal remain unchanged.


## Offline test reproducibility correction

`prepareJobs()` and `--check` verify fixture truth, image hashes and request
construction without consulting Git or sending requests. Mock-runner tests use
that offline path, so staging or committing the checkpoint cannot invalidate
them. Live `--run` and `--resume-after-3` still call `preflight()`, requiring
feature/spendscape-rebuild, the original approved HEAD 399fce8, and an empty
index. The consumed run/recovery reservations remain unchanged. This correction
does not authorize another call or broaden the accepted execution commit.
