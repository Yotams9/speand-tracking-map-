# Scanner D1 — isolated synthetic OCR benchmark

This is a QA-only experiment, not Scanner D2 or a consumer receipt workflow.
No application module imports this directory. Assets are outside `public`, so
ordinary Spendscape builds do not serve them. No camera, gallery, PDF, purchase
callback, real receipt, external OCR endpoint or persistence is supported.

The user authorized this bounded benchmark and exactly `tesseract.js@7.0.0`
and `tesseract.js-core@7.0.0`. Both are development dependencies. Installation
used `--ignore-scripts --no-audit --no-fund`; no lifecycle script ran. See
`dependencies.json` for every added package, dependency edge, licence, integrity
and package script. Existing installed package entries did not change.

## Reproduction within the approved local QA scope

Run from the worktree root:

```sh
node --test qa/scanner-d1/*.test.mjs
node qa/scanner-d1/server.mjs
```

The second command listens only on `127.0.0.1:4317`. It verifies the asset
manifest before serving an explicit allowlist. With the separately built
Spendscape production app running on loopback port 3000:

```sh
node qa/scanner-d1/browser.mjs
node qa/scanner-d1/cleanup.mjs
```

The runners launch local installed Chrome. They write safe measurements to
ignored `artifacts/scanner-d1/`; they do not save OCR text, receipt images,
screenshots, recordings, traces or HAR files. Stop both servers afterward.
Preserve pre-existing `next-env.d.ts` bytes around Next.js commands.

## Assets and public API

`assets.json` records exact sources, sizes and SHA-256 hashes. Only the worker,
three LSTM core paths and pinned English/Hebrew trained data are copied.
The documented public API's ESM entry is served directly from the installed
package (not copied); its default export is used. Its licence is retained too.
The three core `.wasm.js` files embed their WASM: no separate `.wasm`, legacy
core, orientation model, source map or additional language model is copied.
The v7 loader selects plain, SIMD or Relaxed SIMD LSTM after feature detection.
The measured Chrome selected Relaxed SIMD; the other two are compatibility
paths proven by the pinned loader source, not measured browser paths here.

`worker-bootstrap.js` is only a `workerPath` bootstrap: it silences console
diagnostics, blocks persistent storage APIs and imports the unchanged worker.
It does not implement, patch or replace Tesseract's internal job protocol.
The browser probe observes job envelope counts only, never their payloads.
The engine's temporary `/input` is its volatile WASM filesystem; it is not a
disk file or persistent mount and disappears with worker termination.

All asset URLs are explicit same-origin paths; `cacheMethod: 'none'`, LSTM-only
and `gzip: false` are explicit. CSP permits same-origin scripts/workers/fetches
and WebAssembly compilation, without general `unsafe-eval`. Ordinary HTTP
caching is permitted only for the public API/engine/language assets.

## Public-API cancellation limitation

`createWorker()` supplies a handle only after core and language initialization.
Cancellation immediately clears input and invalidates the run. No subsequent
run is admitted while a handle is outstanding. If initialization completes,
the late handle is terminated without recognition or state publication.
Recognition cancellation uses the available public `terminate()` method.

If a language download fails, v7's public initialization promise can remain
unsettled despite calling `errorHandler`. D1 returns a fixed error to its caller
but cannot forcibly terminate a worker whose handle was never returned. The
benchmark tab/context must be closed to clean that case. The exclusive slot
remains occupied; there is no hidden retry worker or internal-protocol workaround.
This is a failed cleanup requirement for D2, not a passed cancellation test.

Timeouts remain 20 seconds initialization, 15 seconds recognition and 30 seconds
total. They settle caller/UI state but do not solve the missing-handle problem.
No automatic retry or timeout increase is implemented.

## Fixture / expected-result manifest

`fixtures.mjs` is the single source for all expected text, critical tokens,
language modes and transformations. It renders fictional fixtures with the
browser's Arial at 42px, on a 1400×950 white canvas (950×1400 for 90° rotation).
PNG bytes exist only in memory. Canvases are reset immediately after conversion;
Object URLs and ImageBitmap are not needed. No fixture imports canonical data.

Cases: clean English café, clean Hebrew grocery, clean mixed retail; mixed
90°/180° rotations, slight affine skew, 2px blur, low contrast; blank;
non-receipt text; conflicting subtotal/VAT/total; two plausible totals.
Arithmetic conflicts are intentional fixtures. D1 does not parse, resolve or
repair them; Scanner D3 remains gated. No automatic orientation correction,
character repair, currency inference or numeric substitution is performed.

CER is Unicode-code-point Levenshtein distance divided by expected character
count, after NFC normalization, Unicode whitespace collapse and trim only.
Case, punctuation, digits and bidi ordering are preserved. CER can exceed 100%
when insertions dominate. A blank expectation scores 0 only for empty output.
Clean acceptance target is CER ≤5%, not a measured guarantee.

Numeric acceptance requires both every declared critical token to appear as an
exact whitespace-delimited token and equality of the complete sorted numeric
token multiset, including dates, repeated amounts and quantities. Since the
2026-09-12 checkpoint-review correction, `line-context-v2` additionally requires
the complete ordered numeric lines to match their expected fixture lines.
Each line receives NFC/whitespace normalization; blank lines and CRLF variations
are harmless. Labels, signs, numbers and within-line order must match exactly.
Missing, merged, reordered or relabelled numeric lines remain unverified even
if every numeric token exists elsewhere. Full nonnumeric header text is still
evaluated by CER, not by this numeric check. No receipt-field parser is added.

`numericPass` requires all these checks. `numericMultisetExact` and the global
`critical[].exact` flags are diagnostic only and cannot establish a pass alone.
`numericContext` contains indices/booleans only, never recognized content.
Context failure can mean the label/order was not verified, rather than the
number itself being wrong. There is no numeric tolerance, inferred association,
factual correction or purchase creation.

Focused reproduction after starting only the D1 loopback server:

```sh
node --test qa/scanner-d1/*.test.mjs
node qa/scanner-d1/numeric-evidence.browser.mjs
```

This checks the original low-CER false positive and rescores the existing
14 fixture/language pairs with the same real pinned reader. It saves only safe
scores to ignored `artifacts/scanner-d1/numeric-correction-browser.json`.

## Measurements and limits

The runners distinguish fresh browser-context HTTP caches from new workers
using the existing context's HTTP cache. Every recognition gets a fresh worker;
there is no persistent warm worker. JS-module caching is also recorded.
`/__metrics` exposes only allowlisted asset paths, body bytes and actual server
socket bytes written. These are loopback HTTP/1.1 bytes, not internet/TLS bytes.
Cached responses generate no server transfer. Raw Playwright size records may
have negative body estimates on cache hits; they are retained diagnostically
but are not summed as transferred-byte measurements.

Memory samples are Chromium JS heap observations only. They do not establish
total WebAssembly/image/GPU/process memory or compliance with a 200 MiB budget.
No forced GC is used. Desktop Chrome timings do not establish Safari/iPhone
performance or the proposed 20 Mbps cold-load target. Physical iPhone OCR is
pending D2 and a separately approved deployment.

See `docs/spendscape/SCANNER_D1_CHECKPOINT.md` for measured results and the
checkpoint-review gate. There is no authorization for D2, D3, E, C, commit,
push or deployment.
