# Scanner B — local barcode and demo catalog checkpoint

## Current status reconciliation — 2026-09-09

Scanner B, including the transient invalid-frame correction, is completed,
reviewed, committed and pushed at `33a34afb2668f58b89431e3cb7bc5f3c292ebb8d`.
Scanner A is completed, reviewed, committed and pushed at
`23683efcfea1151b96d940e420eafd19760626c6`. The existing Vercel college demo is
active. Physical Scanner A/B smoke testing has a **user-reported pass** on iPhone
17 Pro, iOS 26.6.1 Safari. It is not a Codex-operated or independently
instrumented device test. See [the current handoff](CONVERSATION_HANDOFF.md#scanner-ab-and-college-demo-reconciliation)
for the exact deployment, reported checks and evidence limits.

Scanner B remains **identification only**: it does not create or save purchases.
“Try demo product” loads deterministic Demo Oats and demo barcode `2000000000015`
without a camera. Repeating it with the same candidate loaded produces no visible
change: **Low — minor UX clarity**, not a Scanner B functional failure. The
optional “Load demo product” label, disabling/hiding after loading, “Demo product
loaded — review only” feedback and later review/save-flow explanation are
recorded in the handoff for Scanner E or separately approved UI polish; none is
implemented here. No implementation slice is active. Scanner D/E, optional C,
backend, database, authentication and real providers remain separately gated.

## Original authority and baseline

The implementation/correction evidence and Git/next-gate record below describe
the pre-commit checkpoint. Later review, commit and push approvals are consumed;
old uncommitted/pending statements are historical, not the current worktree state.

The user authorized `APPROVE SPENDSCAPE SCANNER B LOCAL BARCODE + DEMO CATALOG + QA`
on 2026-09-07. Work continued into 2026-09-08, only in
`feature/spendscape-rebuild`. Implementation and local QA are authorized;
checkpoint review, commit, push, deployment and later scanners remain separate.

Following checkpoint review, the user separately authorized
`APPROVE SPENDSCAPE SCANNER B — BOUNDED TRANSIENT INVALID-FRAME CORRECTION + LOCAL QA`.
That correction is included below. It required a new checkpoint review before
commit; the later approval and completed checkpoint are recorded above.

The attached approval repeats `c17595c3e1d00138c278a389367731da8f3bf644` as
Scanner A. Live Git disproved that recorded value: HEAD, upstream and the actual
remote feature branch were all `23683efcfea1151b96d940e420eafd19760626c6`, the
previously approved and pushed Scanner A checkpoint. That live commit is this
slice's baseline. No history was rewritten. Older authority documents describe
historical gates; this latest explicit bounded approval supersedes those gates
only for Scanner B.

Remote verified read-only before implementation:
`https://github.com/Yotams9/speand-tracking-map-.git`.
Local main, origin/main and remote main were
`eee0d26b55e5061f87ac664938df0c195800b74f`.
The only initial working-tree change was generated `next-env.d.ts` drift. Its
exact bytes were saved in ignored QA evidence, with SHA-256
`0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc`.

## Implemented behavior

- Scanner A remains the sole MediaStream owner. Native video-only camera access
  still starts only through explicit Start/Retry. No microphone or second stream.
- A dedicated, lazily created module worker imports only `zxing-wasm/reader`.
  One frame is in flight at a time; the next sample waits 450 ms after completion.
- The exact visible guide is mapped into video source coordinates, accounting
  for `object-fit: contain` letterboxing. A temporary canvas crops that area and
  caps it at 960 by 640 pixels, preserving aspect ratio.
- Pixels transfer only between the page and its local worker. The canvas is
  cleared immediately, the transferred input is zeroed after decoding, and no
  image URL, encoded photo, file or persistent image store is created. ZXing's
  temporary grayscale/WASM allocations are internal ephemeral working memory.
- The worker terminates on a valid supported candidate, empty scan, infrastructure
  failure or cancellation. Camera tracks also stop on a result or terminal decoder
  state. Invalid automatic-frame results count as no-result samples within the
  same bounded scan; they do not publish an invalid status or stop the camera.
  Invalid manual input remains immediately visible, focused and terminal.
- Initialization is bounded to 12 seconds; each decode to 5 seconds; no-result
  sampling ends after 20 attempts. Retrying requires an explicit user action.
- Generation checks, worker termination, visibility/pagehide listeners and
  unmount cleanup invalidate late results. Close, Escape, browser Back, source
  navigation, manual entry, camera stop, backgrounding and reset are covered.
- Resetting existing synthetic session additions remounts only the scanner
  subtree, releasing pending work and returning focus to Capture's Close button.
  The globe is never remounted by Scanner B.
- English/Hebrew candidate review supports editable product name, manual code
  and format correction, explicit retry and clear. Barcode input stays a string,
  preserving leading zeros. Invalid entry is labelled and focus returns to it.
- Candidate review hides the stopped preview, retains a clear heading and
  reachable actions, and returns focus to Start after clear. No new navigation
  destination was added. Reduced motion retains full operation.

## Barcode and product truth

Supported formats are EAN-13, EAN-8, UPC-A and UPC-E only. Deterministic validation
checks exact ASCII digit length, UPC-E number system and the appropriate check
digit. The original accepted representation is kept alongside a normalized
GTIN-14 string. UPC-E validates over its expanded UPC-A value.

The pinned ZXing reader emits expanded EAN-13 text for UPC-E. Its documented
`extra.UPCE` field supplies the original eight digits; the adapter validates it
and cross-checks it against the expanded result. Malformed or contradictory
metadata fails closed. UPC-A's leading EAN padding is removed only when the
reader explicitly identifies UPC-A.

When EAN-13 and UPC-A are both enabled, the optically identical UPC-A / leading
zero EAN-13 symbol is reported by ZXing as EAN-13. Scanner B retains that returned
representation and maps both to the same candidate; it does not claim to infer
which digits were printed below identical bars. Manual format selection preserves
the user's explicit representation. See the pinned
[ZXing reader source](https://github.com/zxing-cpp/zxing-cpp/blob/a17fd9dc65d6aa0dd2f660fdfca7a6a6613d938f/core/src/oned/ODMultiUPCEANReader.cpp).

The separate, small `barcode-demo-catalog.ts` contains exactly six **fictional**
products with stable demo IDs, checksum-valid example codes, bilingual names,
category, package size and `synthetic-demo-only` provenance. They are not canonical
purchases or verified external product records; no GS1 allocation is asserted.
Unknown valid codes remain unknown. Only the explicit “Try demo product” action
loads a clearly labelled example; it never silently substitutes for an unknown.

No barcode creates or confirms a purchase, merchant, place or pin. There are no
barcode-derived prices, currencies, FX, dates, payment methods or purchase proof.
Edited names are ephemeral review text. They are not saved as catalog facts or
added to Purchases, Stats, Timeline, Ask, Replay, Inbox or the globe. Existing
synthetic/manual Capture demonstrations retain their separate approved flow.

## Dependency, integrity and licenses

The sole added direct dependency is **`zxing-wasm@3.1.3`**, exactly pinned in both
package manifests. Before installation, registry metadata, the declared dependency
tree and all 66 tarball paths were inspected. The downloaded archive's SHA-512
was computed and matched the registry integrity:

`sha512-3lC9BJk4fR5ZJxcGjb0hVnDFOW7KpLXHIebiBmVd4FDRQZVeObztoTKxRUPxlWwSgxrMRONK0u50hBD1aTYEKg==`

Official identity: [Sec-ant/zxing-wasm, v3.1.3](https://github.com/Sec-ant/zxing-wasm/tree/v3.1.3).
Archive: [npm registry tarball](https://registry.npmjs.org/zxing-wasm/-/zxing-wasm-3.1.3.tgz).
Registry unpacked size: 3,828,926 bytes. Install used
`npm install --save-exact --ignore-scripts --no-audit --no-fund zxing-wasm@3.1.3`.
No install hooks ran. No existing dependency changed version.

Resolved transitive dependencies, also recorded exactly with integrity in the lock:

| Package | Version | Dependency / license |
| --- | --- | --- |
| `@types/emscripten` | 1.41.6 | Type definitions, no dependencies, MIT |
| `type-fest` | 5.9.0 | Type definitions; depends on tagged-tag; MIT or CC0-1.0 |
| `tagged-tag` | 1.0.0 | Type definitions, no dependencies, MIT |

The declared minimum versions inspected before installation were Emscripten
1.41.5 and type-fest 5.8.0; their permitted ranges resolved to the versions above.
Resolved package manifests were checked for dependencies and lifecycle scripts.
All three are type-only dependencies of the reader; none adds a provider or camera
wrapper. The upstream npm archive necessarily includes unused full/writer entries;
Spendscape neither imports nor serves them. No separate writer was installed.

The unmodified reader WASM is explicitly vendored at
`public/vendor/zxing-wasm/3.1.3/zxing_reader.wasm`, a required application asset,
not a QA artifact. Its 1,093,289 bytes match both the installed package and the
published reader `ZXING_WASM_SHA256`:

`2ebda08a93eea3efcd8399cda6b276e6a0b1de4fec60b4d8988a047de4c6d1ba`

Unit tests check version, hash and byte equality. At runtime the worker fetches
only that application-origin URL, rejects redirects, verifies SHA-256 before
instantiation and supplies `wasmBinary` plus a same-origin `locateFile`. The
library's default CDN location is therefore never used. Fetch uses no credentials.
A missing or corrupted WASM asset has a visible recovery state.

Retained alongside the asset: `NOTICE.txt`, `ZXING-WASM-LICENSE.txt`,
`ZXING-CPP-LICENSE.txt`, `ZXING-WRAPPER-LICENSE.txt`, and `STB-LICENSE.txt`.
MIT requires retaining its copyright and permission notice. Apache-2.0 requires
its license, applicable notices and marking modifications; the binary is
unmodified. The wrapper's author notices are retained. The pinned C++ tree has
no root NOTICE file. Its revision is
`a17fd9dc65d6aa0dd2f660fdfca7a6a6613d938f`.

The upstream reader build disables ZXing writers and includes stb_image; its MIT
license option and notice are also retained. Upstream does not pin or publish
the resolved stb revision in this build, so no reproducible-from-source claim
is made. The published binary itself is verified byte-for-byte. Source evidence:
[reader build](https://github.com/Sec-ant/zxing-wasm/blob/v3.1.3/src/cpp/CMakeLists.txt),
[ZXing license](https://github.com/zxing-cpp/zxing-cpp/blob/a17fd9dc65d6aa0dd2f660fdfca7a6a6613d938f/LICENSE),
[bridge license](https://github.com/Sec-ant/zxing-wasm/blob/v3.1.3/src/cpp/LICENSE),
[stb license](https://github.com/nothings/stb/blob/master/LICENSE).

`npm audit --omit=dev --json` returned zero reported vulnerabilities across the
production dependency set on 2026-09-08. This is a dated registry result, not a
security guarantee.

## Bundle and static-asset measurement

Measured from the existing Scanner A production `.next/static` / `public` files
before installation and the final Scanner B production build. Values are bytes;
gzip is the sum of individually compressed files, not a claim about a particular
server's transfer encoding or the initial page's download size.

| Asset group | Baseline raw | Final raw | Raw delta | Gzip delta |
| --- | ---: | ---: | ---: | ---: |
| browser-js | 1,713,493 | 1,774,550 | +61,057 | +21,844 |
| browser-css | 305,170 | 307,525 | +2,355 | +342 |
| reader-static | 0 | 1,121,029 | +1,121,029 | +466,370 |

The reader WASM alone is 1,093,289 bytes raw / 455,913 bytes gzip. Static delta
also includes the required notices. Reader JavaScript is a separate worker chunk;
no barcode worker or WASM fetch starts on opening Capture alone. The browser
suite verifies zero barcode workers before explicit camera activation. Core
MapLibre dependencies and existing public assets are unchanged.

Evidence: ignored `baseline-assets.json`, `final-assets.json`, `asset-impact.json`,
package tarball/contents, registry audit JSON and production build log under
`artifacts/spendscape-scanner-b/`.
The corrected build's asset inventory is in
`artifacts/spendscape-scanner-b/transient-correction/final-assets.json`.


## Original implementation QA, evidence and findings

The original implementation results below are retained as historical evidence.
The subsequent review reproduced one Medium transient-frame finding. Its bounded
correction and fresh verification are recorded in the following section.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed, exit 0 |
| `npm test` | 163/163 passed across 13 files, exit 0 |
| `npm run build` | Production build passed, exit 0 |
| Focused barcode domain/session unit tests | 37/37 passed |
| `npm run qa:scanner-b` | 32/32 passed against the final production build |
| `npm run qa:data-boundary` | 4/4 passed against the final production build |
| `npm run qa:capture` | 5/5 passed against production; repeated in the final regression run |
| Broader existing feature regressions | 75/76 initially; the unchanged remaining Globe test passed in the final run |
| Final Capture / Scanner A / Globe regression run | 26/26 passed |
| `git diff --check` | Passed |

An additional check of untracked text files reports only the upstream Apache
license's existing final blank line (`ZXING-CPP-LICENSE.txt:202`). The license
is retained verbatim; this is a notice-formatting exception, not application code.

There are 117 distinct successful browser checks across Scanner B (32), the
data boundary (4), Capture (5), and the broader existing feature set (76).
After the last focus and camera-interruption status correction, all 62 directly
affected checks were repeated: 32 Scanner B, 4 boundary, and 26 regressions.
The broader set covers Globe, Purchases, Analytics, Smart Inbox, Ask, Replay,
search and responsive behavior.

The first broad run's sole failure was an existing desktop Globe wheel assertion:
24 small wheel steps produced a longitude delta of 0.024859842392061182 against
its >0.05 threshold. The same unchanged test passed in the final run. No map
implementation or assertion was changed. Record this as observed headless wheel
threshold variability; it is not hidden by an all-first-pass claim.

Checks retain 42 canonical purchases, 12 physical places and 12 pins, with two
online purchases and one unresolved purchase unpinned. Analytics remains
ILS 6,777.38. Mutated snapshot tests prove Capture, Inbox, Ask and Replay use the
same injected snapshot in both languages. Map construction and instance counts
remain one throughout scanner actions; canonical fixture and globe source files
are unchanged.

Resolved findings in the bounded QA loops:

- Adapted the pinned reader's expanded UPC-E output to validated original digits.
- Brought candidate review and its actions into view on small phones; hid the
  stopped preview and restored heading, scroll position and keyboard focus.
- Limited the short desktop/projector preview height so controls remain reachable.
- Disposed camera and worker work when resetting existing session additions.
- Kept invalid manual entry focused with accessible error association.
- Replaced stale decoder-ready status when the camera is interrupted.

Rendered evidence covers 360×640, 390×844, 430×932, 1280×800 and 1440×900.
Idle, ready, known candidate, unknown and invalid states were captured; candidate
screens at all five sizes, small-phone/projector ready and unknown states,
Hebrew invalid entry and WASM failure were visually inspected. English,
Hebrew/RTL, keyboard focus and reduced motion passed. Existing Scanner A
landscape and lifecycle coverage also passed. These are synthetic browser-media
tests, not physical-device evidence.

The real reader decodes all four formats from test-generated pixel patterns.
Browser guards cover canvas exports, object URLs, storage, IndexedDB, Cache API
and beacons; scanning succeeds without invoking those image/persistence paths.
No barcode/image logs, outgoing request bodies or non-GET requests were observed.
Requests stay on the application origin and the pre-existing OpenFreeMap tile
origin, with no barcode provider or CDN. A known code decodes after the reader
loads and the browser goes offline. Cancellation, delayed WASM completion,
repeated frames, camera cycles, worker failures and camera interruptions pass.

Evidence is kept under ignored `artifacts/spendscape-scanner-b/`: command logs,
`qa-report.json`, `regression-report.json`, `final-regression-report.json`,
`final-run-status.json`, and viewport screenshots. The final managed runner
records exit 0 for Scanner B, data boundary and final regressions. The dedicated
boundary JSON is in `artifacts/spendscape-phase-2a1/qa-report.json`.

To repeat locally with existing dependencies, run `npm run build`, start
`npm run start -- --hostname 127.0.0.1` in a separate terminal, then run
`npm run qa:scanner-b`. Its configuration requires that production server and
does not silently start development mode. Stop the server afterward and preserve
the pre-existing generated-file bytes when restoring any build drift.

## Bounded transient invalid-frame correction

The sole runtime correction changes the automatic result branch in
`barcode-session.ts`: invalid decoder output or failed deterministic validation
now schedules the next sample instead of finishing with `invalid`. Validation
still runs before acceptance. No invalid code becomes a candidate, and no state
update announces each transient frame. The existing 450 ms cadence, 20-attempt
limit, load/decode watchdogs, generation guards and terminal infrastructure
errors are unchanged. A valid supported result still terminates once.

Manual validation remains in `useCaptureBarcode.ts` and was not edited. It
cancels scanning, reports invalid input immediately, preserves `aria-invalid`
and the existing explanation, and returns focus to the input. The camera owner,
catalog, purchase boundary, navigation, map, canonical data, dependency manifests,
WASM and license files are byte-identical to the reviewed checkpoint.

New deterministic coverage reproduces the review's damaged EAN-13 frame using
the actual pinned reader: inverting the four-pixel strip at x=59 yields a
checksum failure, then an undamaged frame succeeds in the same session without
Retry. Other checks cover 20 invalid samples with no intermediate state
announcements, cancellation followed by a late valid result, and real-browser
invalid-to-valid recovery with one stream/worker and exactly one stop. The
privacy guards remain active during invalid-to-valid recovery. Browser tests
also retain invalid manual entry/focus in English and Hebrew, unsupported-format
rejection, terminal load/decode failures, and the canonical baseline.

Correction verification is recorded under ignored
`artifacts/spendscape-scanner-b/transient-correction/`.
Fresh focused unit tests: 40/40; complete unit suite: 166/166; typecheck and
production build: exit 0. Browser results:

| Check | Corrected implementation result |
| --- | --- |
| Scanner B suite | 32/33 initially; the remaining manual-form test passed 3/3 after the test synchronization correction below |
| Data boundary | 4/4 passed |
| Direct Capture / Scanner A regressions | 25/25 passed |
| Diff hygiene | `git diff --check` passed; original upstream license final blank line remains the sole untracked-text exception |

All 62 distinct browser checks in this bounded matrix ultimately passed. Logs,
JSON reports and exit codes retain the initial failure and the focused re-check;
this is not an all-first-pass claim. No application changes were made after the
successful production build. The re-check changed only test synchronization.
Both managed QA servers were stopped. `next-env.d.ts` matches the original bytes
exactly; the index is empty and the branch, HEAD, upstream and protected local
main refs retain the hashes in the Git section below.

The first browser run exposed a test synchronization race in the existing
UPC/EAN manual-correction test: it queried the form before the successful-result
effect finished closing it. The test now waits for that closure before reopening
the form. No UI implementation or validation assertion was changed for this.

The historical review's Medium finding is corrected in source and covered by
the deterministic tests above. At this handoff the revised checkpoint required
a new review; the completed later checkpoint is recorded above. No known Blocker,
High or Medium finding remained from this correction's QA.
Physical iPhone autofocus, glare, distance, orientation and scanning performance
remain unverified. The existing upstream-license final blank line is retained.
The prior Globe wheel-threshold variability is unchanged; no map behavior was
modified and no broader map rerun was necessary for this branch-only correction.

## Limitations and deferred work

- Physical iPhone Scanner A/B smoke testing now has the user-reported pass
  described above, on the existing HTTPS college demo. The original automated
  QA did not operate a physical camera. No independently instrumented device
  test, real-world success rate, autofocus benchmark, glare/distance/rotation
  coverage, Android coverage or exhaustive Safari/performance claim is made.
- Synthetic browser frames and a test-only symbol generator are used for QA.
  The reader itself is real; no writer package is used even for these fixtures.
- Offline proof covers decoding in an already loaded active reader. It does not
  establish offline cold startup for the application or globe, nor promise that
  a terminated reader can restart without its assets being available.
- No file/image import, QR navigation, Open Food Facts, OCR, receipts, LLM,
  provider account, database, Supabase, backend, auth, GPS or new place lookup.
- Scanner E purchase/session integration and Scanners C/D remain unstarted.
- A six-product demo catalog is not a global product service; unknown stays unknown.

## Original Git safety and next gate (historical)

Final local verification on 2026-09-08:

- Branch: `feature/spendscape-rebuild`.
- HEAD and upstream `origin/feature/spendscape-rebuild`:
  `23683efcfea1151b96d940e420eafd19760626c6`.
- Local `main` and `origin/main`:
  `eee0d26b55e5061f87ac664938df0c195800b74f`.
- Index is empty. The working tree intentionally contains the uncommitted
  Scanner B files plus the original `next-env.d.ts` drift.
- `next-env.d.ts` was restored byte-for-byte to its pre-slice SHA-256 recorded
  above. It is excluded from the checkpoint file manifest and any future commit.
- The managed production QA server was stopped; no listener remains on port 3000.
- No stage, commit, push, PR, deployment, merge, rebase, branch switch or main
  modification occurred. Remote refs were verified read-only at baseline;
  no remote writes were made in this slice.
- Screenshots, videos, Playwright output, build output and audit artifacts remain
  ignored. The vendored reader and license notices are intentional source assets.

The review scope is package manifests, the existing Capture camera/composition/CSS
integration, seven new barcode runtime modules, two barcode unit-test files,
the Scanner B browser suite/configuration and test-only symbol fixture, the
Scanner A focus expectation, six vendored reader/license assets, and this report
plus the README status. An ignored `checkpoint-files-sha256.json` records each
intended file after documentation is finalized. The corrected manifest is
`artifacts/spendscape-scanner-b/transient-correction/checkpoint-files-sha256.json`;
the earlier root artifact manifest remains the original reviewed snapshot.
No canonical fixture, repository,
purchase-domain or MapLibre module is part of the change.

Original next approval at this implementation handoff (subsequently consumed):
`APPROVE SPENDSCAPE SCANNER B CHECKPOINT REVIEW`

That review token does not authorize commit, push, deployment, accounts or any
later scanner slice. Implementation ends at this checkpoint.
