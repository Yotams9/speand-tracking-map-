# Scanner D1 checkpoint — local synthetic OCR benchmark

Date: 2026-09-10. Status: implementation and bounded local QA complete;
checkpoint review pending. Nothing staged, committed, pushed or deployed.
The bounded numeric-evidence correction on 2026-09-12 is recorded below;
its focused QA passed and a new checkpoint review is required.

## Decision

**Reject the current OCR configuration for Scanner D2 integration.** This is
not a rejection of all local OCR engines or future Tesseract experiments.
The required clean Hebrew/mixed accuracy target failed and the public API
cannot guarantee worker cleanup when initialization never returns a handle.
Any remediation experiment, internal adapter or D2 work needs a separate scope
and authorization. No internal-protocol adapter was implemented.

The user's exact D1 approval permitted the two pinned dependencies, synthetic
fixtures, local QA and documentation. It explicitly excluded consumer UI,
camera/gallery integration, structured receipt extraction, purchases and
hosting changes. Scanner A/B and the existing Vercel demo remain unchanged.
Physical iPhone OCR remains pending D2 and a separately approved deployment.
The older user-reported A/B iPhone smoke pass does not establish OCR performance.

## Source and installation

Worktree branch: `feature/spendscape-rebuild`.
HEAD and local tracking ref: `591a9e9ffe09114713040c72cf88eb09369fc335`.
Local main and origin/main: `eee0d26b55e5061f87ac664938df0c195800b74f`.
Upstream: `origin/feature/spendscape-rebuild`.
Origin: `https://github.com/Yotams9/speand-tracking-map-.git`.
No remote ref refresh or remote write was necessary for this local task.

Official npm version metadata was checked immediately before installation.
`tesseract.js@7.0.0` declares `tesseract.js-core: ^7.0.0`; exactly core 7.0.0
was available and installed/deduplicated. Core's `latest` tag still pointed to
6.1.2 at that check, so it was deliberately not used. Local Node 22.14.0 and
npm 10.9.2 were compatible with the selected packages.

Command: `npm install --save-dev --save-exact --ignore-scripts --no-audit --no-fund tesseract.js@7.0.0 tesseract.js-core@7.0.0`.
No installation scripts executed. Tesseract's declared
`opencollective-postinstall || true` was skipped. No root scripts changed.
Exactly 13 package entries were added; no existing package entry changed.
No alternative OCR package or PDF library was added. The full resolved graph,
package scripts, optional peers and npm integrity values are retained in
`qa/scanner-d1/dependencies.json`.

| Added package | Exact version | Declared licence |
| --- | --- | --- |
| bmp-js | 0.1.0 | MIT |
| idb-keyval | 6.3.0 | Apache-2.0 |
| is-url | 1.2.4 | MIT |
| node-fetch | 2.7.0 | MIT |
| opencollective-postinstall | 2.0.3 | MIT |
| regenerator-runtime | 0.13.11 | MIT |
| tesseract.js | 7.0.0 | Apache-2.0 |
| tesseract.js-core | 7.0.0 | Apache-2.0 |
| tr46 | 0.0.3 | MIT |
| wasm-feature-detect | 1.9.0 | Apache-2.0 |
| webidl-conversions | 3.0.1 | BSD-2-Clause |
| whatwg-url | 5.0.0 | MIT |
| zlibjs | 0.3.1 | MIT |

The optional `encoding` peer of node-fetch is not installed. node-fetch and the
funding helper are package dependencies, not receipt transport or executed
install scripts. The browser API/worker use only explicit local runtime URLs.

## Exact runtime assets

All rows are checked at server startup against bytes and SHA-256. Copied worker
and core bytes match the installed packages. English/Hebrew files also match the
Git blob IDs at tessdata_fast commit
`87416418657359cb625c412a48b6e1d6d41c29bd`.

| File relative to qa/scanner-d1 | Bytes | SHA-256 |
| --- | ---: | --- |
| `../../node_modules/tesseract.js/dist/tesseract.esm.min.js` | 63220 | `64871d76c75609fd5413b88a8171e2ef40deedd77d5875ba23df104b2d05eb29` |
| `vendor/worker.min.js` | 111307 | `576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d` |
| `vendor/core/tesseract-core-lstm.wasm.js` | 3896484 | `eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680` |
| `vendor/core/tesseract-core-simd-lstm.wasm.js` | 3899472 | `c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38` |
| `vendor/core/tesseract-core-relaxedsimd-lstm.wasm.js` | 3905767 | `861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3` |
| `vendor/lang/eng.traineddata` | 4113088 | `7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2` |
| `vendor/lang/heb.traineddata` | 961404 | `11f9e43ab227f786352a50f75c94c2e9906f1baba86d93276da19da7ce0904db` |

The API entry above is served from node_modules and was not copied. It is
necessary to use the documented API rather than an internal protocol. The
source/URL mapping is exact in `qa/scanner-d1/assets.json`. Core `.wasm.js`
files contain embedded WASM, so no separate WASM binaries or plain `.js`
loaders are needed. No legacy model, OSD model, source map or other language
was copied. Runtime feature detection selected Relaxed SIMD in measured Chrome;
plain/SIMD LSTM are the other branches of the pinned loader. Their existence
is source-verified, not a claim of measured Safari/fallback execution.

| Retained licence / notice | Bytes | SHA-256 |
| --- | ---: | --- |
| `licenses/api.NOTICES` | 149 | `cdf963ced7d25a0f98901a547647b4d6e2dbe0197fd78c87a059a87b0e542fe2` |
| `licenses/core.LICENSE` | 11357 | `b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1` |
| `licenses/tessdata.LICENSE` | 11358 | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| `licenses/tesseract.LICENSE` | 11357 | `b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1` |
| `licenses/worker.NOTICES` | 466 | `45f54171aeaa1d10c0c1a66f374b7bba1f02472b1487fbe892eec04f840002ac` |

The core licence has only its extra terminal blank line removed for whitespace
checks; its legal text is unchanged. Runtime assets remain byte-identical.
Notices retain the distributed API/worker third-party notices and upstream
Tesseract/core/tessdata licence files. Package-level licence declarations and
these notices are recorded; this benchmark is not an independent legal audit
of every native component compiled into the upstream core binary.

## Fixtures and accuracy

`qa/scanner-d1/fixtures.mjs` is the explicit expected-text and fixture manifest.
It contains only fictional synthetic receipts; no canonical fixture is reused.
1400×950 canvases, Arial 42px; 90° variants swap dimensions. Degradation is a
fixed affine skew, 2px blur or grey low-contrast text. No automatic orientation
correction, receipt parser, inference or factual repair was applied. PSM is 6,
LSTM only, with eng, heb, or heb+eng as shown. The benchmark does not measure
photographed thermal paper, long real receipts or autofocus.

CER: code-point Levenshtein / expected code-point count after NFC, whitespace
collapse and trim only. No punctuation/digit/case/bidi rewriting. Values above
100% are possible through insertions. Clean target: ≤5%.
Numeric pass requires exact critical-token matches plus the entire numeric-token
multiset, including counts/repeated values; no rounding or O/0 correction.
These original checks did not bind numbers to their fixture lines. The
2026-09-12 correction below supersedes numeric acceptance with line-context-v2.
Structured receipt parsing still belongs to D3.

| Fixture | Language mode | CER | Original multiset-v1 result (superseded) |
| --- | --- | ---: | --- |
| english-clean | eng | 0.00% | PASS |
| english-clean | heb+eng | 0.00% | PASS |
| hebrew-clean | heb | 16.53% | FAIL |
| hebrew-clean | heb+eng | 14.05% | PASS |
| mixed-clean | heb+eng | 13.53% | FAIL |
| mixed-rotate90 | heb+eng | 121.05% | FAIL |
| mixed-rotate180 | heb+eng | 75.94% | FAIL |
| mixed-skew | heb+eng | 6.77% | FAIL |
| mixed-blur | heb+eng | 13.53% | FAIL |
| mixed-low-contrast | heb+eng | 14.29% | FAIL |
| blank | heb+eng | 0.00% | PASS |
| non-receipt | heb+eng | 0.00% | PASS |
| conflicting-total | heb+eng | 0.00% | PASS |
| multiple-totals | heb+eng | 0.00% | PASS |

The blank case returned `no-text`. Non-receipt text is transcribed as text,
not classified as a receipt. The two conflicting-total cases preserve the
printed conflicting numbers; no arithmetic reconciliation or selection is
implemented. Clean Hebrew with heb+eng had exact numeric tokens under the original check
but still failed the text target; its corrected context check is unverified. Wrong numeric evidence in other cases is a factual
failure even when the UI status is `success` (meaning only that text exists).
No OCR result is promoted to a purchase or treated as reviewed fact.

## Timing and transferred bytes

Measured on desktop macOS arm64, Chrome 151.0.7922.170, Node 22.14.0.
These are loopback tests, not iPhone, mobile emulation, or a 20 Mbps internet
simulation. Cold means a fresh browser context/HTTP cache, not a purged OS or
browser-process compilation cache. There is one cold sample per language mode.
Each warm sample still creates and terminates a new OCR worker.

| Cold fixture / mode | Initialization ms | OCR ms | Input-ready to result ms | HTTP body bytes | Socket bytes written |
| --- | ---: | ---: | ---: | ---: | ---: |
| english-clean / eng | 50.5 | 134.3 | 190.9 | 8194142 | 8196332 |
| hebrew-clean / heb | 46.6 | 120.6 | 172.8 | 5042458 | 5044647 |
| mixed-clean / heb+eng | 53.7 | 146.6 | 206.1 | 9155546 | 9158172 |

Twenty warm mixed-language repeats: initialization median
48.0 ms;
OCR median 148.4 ms;
OCR p95 (nearest rank, 19th/20) 150.0 ms.
Each repeat transferred 760 body bytes / 1,187 socket bytes for the no-store
bootstrap; engine and language assets came from HTTP cache. The warm transition
from English to combined loaded Hebrew once (962,164 body bytes including
bootstrap). Worker-internal requests are included through context request
observations and the loopback server's actual socket counters.

Initial benchmark page entry made no API/engine/language request and created
zero workers. Ordinary production Spendscape page load made zero OCR requests.
The existing application bundle contains no tesseract/traineddata/D1 references.

Warm JS-heap observations ranged from 2,227,734
to 4,571,274 bytes. These do not account
for full WASM, image, GPU or process memory, and do not prove the proposed
200 MiB incremental budget. No forced GC or independent iPhone measurement.
The 10-second desktop recognition target passed; mobile timing, cold networking
and total memory targets remain unverified, not silently passed.

## Lifecycle, privacy and failures

- 34 sequential main-context recognitions: 34 workers created/terminated,
  maximum one active worker and one active job; zero left after completion.
- Real public-API cancel and dispose at API import, worker script, core load,
  language load and recognition: ten cases. Delayed initialization cases kept
  one exclusive pending worker; releasing the delayed request produced a
  handle that was terminated without obsolete text/state publication.
- Actual page close at all five stages was tested separately. Every worker
  observed by Playwright closed. At API/worker-script gates, some workers had
  not yet become observable targets; this is not a count of hidden handles.
- New work during cancelled pending initialization returns `busy`. After the
  late handle is cleaned, a fresh run succeeds. Reload starts at idle with no
  restored result or storage state. Twenty completed repeat cycles are also
  covered by deterministic unit tests.
- Malformed synthetic image bytes produce only `engine-error`, no OCR result,
  and a terminated worker. Blank input is `no-text`, not an exception.
- **Failed language request reproduced the limitation:** public error callback
  fired but initialization never supplied a handle. The caller returned
  `engine-error`; the slot remained occupied with one worker and no job. Only
  closing its browser context cleaned it. D2 cleanup acceptance therefore fails.
  There is no internal protocol workaround or retry worker.
- Timeouts remain 20s initialization, 15s recognition and 30s total. Unit tests
  prove bounded caller completion and late cleanup; they do not claim a public
  initialization timeout can forcibly destroy a worker lacking a handle.
- Successful OCR, cancellation and malformed-input paths emitted no console
  messages or page errors. Worker diagnostics are suppressed at the bootstrap;
  error output is fixed-code. Recognized text is scored only in memory and then
  released, never saved in logs, screenshots, traces, URLs or reports.
- All runtime requests were same-origin GET with no request payload. CSP and
  an explicit server allowlist enforce the isolated runtime boundary. Existing
  production MapLibre tile requests were untouched.
- Storage API guards apply in both document and worker. Browser-reported usage
  was zero for IndexedDB, Cache Storage, service workers and filesystem storage;
  cookies and persisted origin state were empty. HTTP asset caching is allowed.
- No Object URLs or ImageBitmap were created; temporary canvases are reset and
  input buffers cleared. The engine's temporary input uses its in-memory WASM
  filesystem only. This is not a claim of forensic erasure from OS memory.

## Checks and scope evidence

- D1 deterministic and manifest checks: 13 passed.
- D1 real-browser benchmark: 36 scored runs (14 matrix runs, 20 warm repeats,
  two additional cold modes), 10 cancel/dispose cases, malformed input and a
  deliberately failed language request. OCR acceptance failures remain above.
- Additional actual-close/reload/overlap checks: 6 passed.
- Existing data/graph/repository/analytics unit tests: 18 passed in 5 files.
- Existing Capture + Scanner A + Scanner B browser regressions: 58 passed.
- Focused data-boundary browser checks: 4 passed, including injected names in
  English/Hebrew through Capture, Inbox, Ask and Replay.
- `npm run typecheck`: passed. `npm run build`: passed using existing Next.js
  16.3.3/Turbopack configuration; only `/` and `/_not-found` routes produced.
- Canonical baseline: 42 purchases, 12 places, 12 pins, ILS 6,777.38. Existing
  online/unresolved exclusion checks passed. MapLibre count/constructions: 1.
- No src, public, styles, Next config or existing A/B test files changed.
- No consumer OCR route or code is present; all D1 files are under QA plus
  dependency declarations and bounded documentation. No new npm scripts.
- Both local QA servers stopped. All generated build/browser evidence stays
  ignored under existing artifact/build patterns, outside the checkpoint.
- `next-env.d.ts` restored byte-for-byte to pre-D1 drift; SHA-256
  `0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc`.

## Deviations and review gate

Initial harness plumbing failures (the ESM default export and an unnecessary
favicon 404) were corrected before the retained successful browser suite.
No accuracy thresholds were changed. No runtime engine/model was substituted.
The minimal public API module is served from the approved installed package
instead of copying it, and the bootstrap implements privacy guards only.
The entire benchmark is a standalone loopback harness, not a Next.js QA route.

No source changes were made to improve failed OCR results or bypass the public
API limitation. No Safari/iPhone performance, exhaustive OCR quality, 20 Mbps
network performance, total memory bound or native dependency legal audit is
claimed. D1 establishes a negative result for this configuration's D2 readiness.

Next separate token:
`APPROVE SPENDSCAPE SCANNER D1 CHECKPOINT REVIEW`

Review does not authorize commit, push, deployment, D2/D3, Scanner E/C, a new
engine, or an internal worker-protocol adapter.

## Bounded numeric-evidence correction — 2026-09-12

Authorization: `APPROVE SPENDSCAPE SCANNER D1 — NUMERIC EVIDENCE CHECK CORRECTION + FOCUSED QA`.
Only the fixture oracle, focused tests and this D1 documentation changed.
No OCR parameters, fixture text/rendering, engine, worker lifecycle, assets,
licences, package files, product source or deployment were changed.

The review reproduced a wrong VAT/total assignment with CER 3.10%, an identical
numeric multiset and `numericPass=true`. `line-context-v2` now requires the
ordered numeric fixture lines to match in full after NFC and within-line
whitespace normalization. Blank lines and CRLF differences are harmless;
missing/merged/reordered/relabelled numeric lines remain unverified. This also
binds unit prices, quantities, line amounts and dates to their known fixture
contexts. It does not extract structured receipt fields or infer missing data.

The original multiset/global-token results remain diagnostics only. A wrong
assignment cannot pass on those flags alone. Output adds only check version,
context indices and booleans; no receipt text or image data is persisted/logged.
Context failure is conservatively unverified evidence; it does not establish
that every numeric character is wrong. CER and its 5% target are unchanged.

The original review example now returns `numericMultisetExact=true`,
`numericContextExact=false`, `numericPass=false`, while CER remains 3.10%.
This was reproduced in Node and in the actual benchmark browser module.

Corrected matrix, Chrome 151.0.7922.170, desktop local synthetic OCR:

| Fixture | Mode | CER | Context-qualified numeric evidence |
| --- | --- | ---: | --- |
| english-clean | eng | 0.00% | PASS |
| english-clean | heb+eng | 0.00% | PASS |
| hebrew-clean | heb | 16.53% | FAIL / unverified |
| hebrew-clean | heb+eng | 14.05% | FAIL / unverified |
| mixed-clean | heb+eng | 13.53% | FAIL / unverified |
| mixed-rotate90 | heb+eng | 121.05% | FAIL / unverified |
| mixed-rotate180 | heb+eng | 75.94% | FAIL / unverified |
| mixed-skew | heb+eng | 6.77% | FAIL / unverified |
| mixed-blur | heb+eng | 13.53% | FAIL / unverified |
| mixed-low-contrast | heb+eng | 14.29% | FAIL / unverified |
| blank | heb+eng | 0.00% | PASS |
| non-receipt | heb+eng | 0.00% | PASS |
| conflicting-total | heb+eng | 0.00% | PASS |
| multiple-totals | heb+eng | 0.00% | PASS |

Blank/non-receipt cases have no expected numeric facts; their numeric pass is
vacuous and does not identify a purchase. Conflicting-total fixtures pass only
because their original printed contradictions are preserved, never repaired.
The Hebrew heb+eng numeric result changes from the old multiset PASS to
unverified context. No OCR accuracy or performance improvement is claimed.

Focused verification:

- 25 Node tests passed: the 13 existing D1 lifecycle/asset checks plus 12 new
  numeric-evidence cases. Coverage includes VAT/total swaps in EN/HE/mixed,
  subtotal/total swaps, inter-item prices, within-line price/amount swaps,
  dates on wrong labelled lines, whitespace/CRLF, merged/reordered lines,
  changed labels/signs, missing/extra values and content-free score output.
- Browser original false-positive regression passed; all 14 existing real OCR
  fixture/language pairs were rescored with line-context-v2. OCR failures were
  retained as measured outcomes, not changed into successful acceptance.
- Same-origin GET-only requests, zero console/page errors and empty persisted
  origin/cookie state were verified in the focused browser run.
- Package, vendor, licence, worker/lifecycle, product-source and next-env hashes
  were checked against the pre-correction inventory and remain unchanged.
- The loopback QA server was stopped. Generated evidence remains ignored.
- No Next.js commands or full unrelated app QA were rerun: only the isolated
  scorer/tests/docs changed. Original application build/regression evidence
  remains historical evidence above; it is not claimed as newly rerun.
- `git diff --check` passed. No staging, commit, push, deployment or main change.

The Medium numeric-oracle defect is corrected and awaits separate review.
The negative recommendation for this OCR configuration's D2 readiness remains:
Hebrew/mixed accuracy and public-API initialization cleanup still fail. No D2,
D3, Scanner E/C or internal worker adapter is authorized.

Next token: `APPROVE SPENDSCAPE SCANNER D1 CHECKPOINT REVIEW`.

## Exact intended changed-file list

32 files; paths relative to the worktree root. The pre-existing
`next-env.d.ts` drift is excluded. Generated artifacts are ignored.

- `AGENTS.md`
- `docs/spendscape/CONVERSATION_HANDOFF.md`
- `docs/spendscape/README.md`
- `docs/spendscape/SCANNER_D1_CHECKPOINT.md`
- `package-lock.json`
- `package.json`
- `qa/scanner-d1/README.md`
- `qa/scanner-d1/assets.json`
- `qa/scanner-d1/assets.test.mjs`
- `qa/scanner-d1/browser.mjs`
- `qa/scanner-d1/cleanup.mjs`
- `qa/scanner-d1/dependencies.json`
- `qa/scanner-d1/fixtures.mjs`
- `qa/scanner-d1/harness.mjs`
- `qa/scanner-d1/index.html`
- `qa/scanner-d1/numeric-evidence.test.mjs`
- `qa/scanner-d1/numeric-evidence.browser.mjs`
- `qa/scanner-d1/licenses/api.NOTICES`
- `qa/scanner-d1/licenses/core.LICENSE`
- `qa/scanner-d1/licenses/tessdata.LICENSE`
- `qa/scanner-d1/licenses/tesseract.LICENSE`
- `qa/scanner-d1/licenses/worker.NOTICES`
- `qa/scanner-d1/server.mjs`
- `qa/scanner-d1/session.mjs`
- `qa/scanner-d1/session.test.mjs`
- `qa/scanner-d1/vendor/core/tesseract-core-lstm.wasm.js`
- `qa/scanner-d1/vendor/core/tesseract-core-relaxedsimd-lstm.wasm.js`
- `qa/scanner-d1/vendor/core/tesseract-core-simd-lstm.wasm.js`
- `qa/scanner-d1/vendor/lang/eng.traineddata`
- `qa/scanner-d1/vendor/lang/heb.traineddata`
- `qa/scanner-d1/vendor/worker.min.js`
- `qa/scanner-d1/worker-bootstrap.js`
