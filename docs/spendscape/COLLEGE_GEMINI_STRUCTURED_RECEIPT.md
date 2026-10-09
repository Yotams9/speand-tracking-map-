# Structured receipt preparation — offline checkpoint

2026-10-09. Ready for checkpoint review of offline preparation. No inference,
credential access, live reservation, account/billing change or publication occurred.
Real structured extraction, item coverage and real save readiness remain unverified.

## Compatibility baseline and exact request differences

The consumed `minimal-probe-20261009-one` returned HTTP 200 / `success-text`.
This proves its narrow image/plain-text request was admitted. It did not produce a
review draft or establish accuracy/save/reload. The screenshot is not a retained
provider response and was not used to manufacture fixtures or rescore extraction.
Its request hash remains
`49dd574c5e1752466299d8edbba1fd11f812b18eb57697a91848d3eb8ed5aa72`.

All three builders use `gemini-3.8-flash` and
`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`,
one `contents` entry, text followed by one `inlineData` image with `mimeType` and
base64 `data`. No project/billing override, tool or optional thinking setting is
added by this candidate.

| Serialized setting | Failed application request | Successful minimal probe | Offline candidate |
| --- | --- | --- | --- |
| `contents[0].role` | `user` | omitted | omitted |
| Text | long proposed-observation contract | short transcription instruction | small generic JSON contract |
| `generationConfig.maxOutputTokens` | 8192 | 2048 | 4096 |
| Output configuration | `responseFormat.text.mimeType: APPLICATION_JSON` and `schema: DIRECT_SCHEMA` | none; default plain text | `responseMimeType: application/json` only |
| Provider schema | complete `DIRECT_SCHEMA` | none | none |
| Result destination | existing direct review decoder | temporary text inspection | strict small-contract decoder → existing editable review |

The request tests compare these serialized structures. The current official
[generateContent reference](https://ai.google.dev/api/generate-content?hl=en)
documents `responseMimeType: application/json`; this JSON mode is the selected
structured-output method. JSON syntax is not a guarantee of contract conformance,
accuracy or completeness. Local validation remains mandatory. The reference also
documents `responseFormat`; its presence in the failed request is not evidence of
incompatibility. Several variables changed between the failed and successful
requests, so the HTTP 400 cause remains unknown. No old request/schema was repaired
or replaced, and no new request was sent.

The [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)
lists the selected model and image input. This is documentation evidence, not a new
measurement of this account's admission, quota or key association.

## Contract and review boundary

Required keys are `merchantName`, `address`, `date`, `time`, `currency`,
`finalAmount`, `lines`. Header values are original strings or null. Each row has
`name`, `quantity`, `unit`, `unitPrice`, `lineAmount`, each string or null. Optional
whole-line `discount` retains an explicitly printed amount; absent means none
printed and null means unresolved. Optional `barcode` is null or the existing
validated original/format pair. No receipt-level discount field is required.
Unknown product GTINs remain unknown; receipt/internal identifiers are excluded.
VAT/pre-VAT are outside this small contract and are not save prerequisites.

The prompt preserves original-language descriptions, printed dates and numeric
characters; excludes promotions and unrelated identifiers; never supplies the
known real receipt answers. Negative/exponent/malformed/unbounded numeric strings,
extra fields, sparse arrays, invalid supplied GTINs and malformed JSON are rejected.
Missing facts must be null; missing required keys are malformed output, not an
invitation to fill facts. At most 50 dense rows are accepted. Comma decimals may
remain observed but can require an explicit review correction in the existing
numeric editor. Unsupported currencies/units remain unresolved in review.

The decoder requires one `STOP` candidate and one ordinary JSON text part, with a
64,000-byte text limit. Truncation, refusal and malformed output cannot create a
purchase. Thought text is excluded; bounded opaque thought signatures are ignored
and discarded, consistent with Google's
[thinking guidance](https://ai.google.dev/gemini-api/docs/generate-content/thinking).
This response-side compatibility handling does not explain request HTTP 400s.

Validated observations pass directly through `receiptToReviewDraft`, existing
Capture corrections and `prepareReceiptReview`; neither OCR geometry parser is
called. Original observations stay transient and separate from user corrections.
Printed line discrepancies block save. Merchant/place, payment, category, channel,
date/time and timezone remain explicit confirmations. Unknown merchants are not
silently mapped, and unknown physical locations add no pin. No time, century,
unit, currency, discount, barcode or location is invented.

The final printed payable amount remains the purchase total. Product line amounts
remain unchanged, with their independent sum and a nonblocking difference notice.
No receipt-level difference is allocated to products. The existing v3 IndexedDB
schema, atomic save, duplicates, eight-second Undo and validated graph are reused.
Unsupported observation metadata and photos are not persisted. Saving is always
an explicit user action.

## Mock-only Capture integration

`/api/receipt-structured` has no native transport or credential reader. It is
unavailable by default and under Vercel/CI. Explicit server QA flags and the
loopback-only `receiptStructuredLocal=1` client opt-in enable fictional fixtures.
Fictional data is independent of uploaded synthetic pixels, clearly QA-only, and
does not prove OCR. Two exclusive mock slots in a fresh OS temporary namespace
exercise one-item and fifteen-item responses. No historical live reservation is
reused, reset or created. Mock records contain no provider-dispatch event.

The existing direct handler gained only an optional decoder argument whose default
is unchanged. The new intake query selects the separate candidate endpoint;
ordinary Gemini/Vision paths remain available as before. Existing preview cleanup,
cancel/background/replacement guards and stale-response suppression are reused.

## Verification actually performed

Fresh ignored evidence: `artifacts/gemini-structured-6kvbm9lq/`.

- Final guarded Vitest: **286/286**, 11 files, zero failures (`unit-verified.json`).
  Files: structured-image (27), receipt-structured server (12), direct-image (49),
  Gemini error diagnostics (31), image-session (7), Vision attempt (18), Vision
  local boundary (26), Vision run namespaces (9), receipt-review adapter (76),
  final-payable (14), local-purchase store (17).
- Production Chromium/Chrome browser: **13/13, 39.111 seconds**, no skips,
  unexpected results, retries or flaky cases (`browser-final-report.json`).
  The real local mock route was exercised; additional synthetic response controls
  exercised editing, partial facts, HTTP failure, cancel/background/replacement,
  explicit save/reload, duplicates and Undo. No provider was contacted.
- Application typecheck, focused strict typecheck of new source/tests/browser QA,
  and final production build passed. The final build lists `/api/receipt-structured`.
  This is not a claim that the pre-existing broad Scanner E QA type error is fixed.
- All **17 final fictional screenshots** inspected: headers, draft totals and
  blocking line-error states at 360×640 EN/HE, 390×844 HE, 430×932 EN and 1280×844
  EN, plus 360×640 EN/HE HTTP failures. RTL, focus/error text and scrollable narrow
  layouts were usable. Existing navigation, 12 baseline pins and one MapLibre
  instance/construction were asserted in browser QA.
- Initial unit run had **31/32** because a new test expected `receipt-line` instead
  of the existing `arithmetic` error code. Only that expectation was corrected;
  the initial output remains retained. First browser pass was 13/13 in 41.1 seconds.
  Later thought-signature handling and additional header assertions were followed
  by the final tests/build/browser results above. Sandbox bind initially returned
  EPERM; authorized loopback QA then ran successfully. No dependencies installed.
- Whitespace checks include newly created files. Owned mock servers were stopped;
  final PID 21584 exited and port 3154 has no listener. Entry `next-env.d.ts` bytes
  match both saved entry and HEAD.

Reproduction commands (mock/offline only):

```sh
NODE_OPTIONS='--import ./qa/receipt-p2d/offline-guard.mjs' ./node_modules/.bin/vitest run src/server/receipt-structured.test.ts src/server/vision-local-run.test.ts src/features/capture/final-payable.test.ts src/features/capture/receipt-review-adapter.test.ts src/features/local-purchases/local-purchase-store.test.ts src/features/receipt-image/direct-image.test.ts src/features/receipt-image/gemini-error-diagnostic.test.ts src/features/receipt-image/image-session.test.ts src/features/receipt-image/structured-image.test.ts src/features/receipt-image/vision-attempt.test.ts src/features/receipt-image/vision-local.test.ts --no-file-parallelism
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/tsc --noEmit -p artifacts/gemini-structured-6kvbm9lq/tsconfig.focused.json
./node_modules/.bin/next build
./node_modules/.bin/playwright test --config artifacts/gemini-structured-6kvbm9lq/playwright.final.config.ts
```

Browser reproduction needs a fresh mock run/server and fresh artifact destinations;
do not overwrite the retained evidence or rerun against consumed mock slots.

## Single later validation proposal and cost

Future candidate only: approved original
`/Users/testing.user/Downloads/WhatsApp Image 2026-10-08 at 18.03.31.jpeg`,
previously verified JPEG, 211,603 bytes, 918×2048; SHA256
`f309579ac77c22676d778758c1cc909bb33c0e4ab3fb7a65af180c3876360292`.
It was not sent, copied into QA or modified here. Evaluation answers stay outside
the prompt: merchant/address, printed 30/09/2013 and time, five product rows/seven
units, product sum ILS 60.45 versus payable ILS 60.50, unknown barcodes and excluded
promotions. The product sum corrects the earlier 60.55 evaluation reference; it is
not an extraction prompt or a change to printed product values.

Current [official pricing](https://ai.google.dev/gemini-api/docs/pricing), reviewed
2026-10-09, is US$0.75/M input and US$3.75/M generated tokens including thinking
through 2026-12-31. The planning estimate uses 4,000 text/overhead tokens plus 2,240
image tokens (conservative allowance above the documented default in the
[media-resolution guide](https://ai.google.dev/gemini-api/docs/generate-content/media-resolution)),
and 8,192 generated tokens for extra margin above the combined 4,096 output/thinking
cap: `6240 × 0.75/M + 8192 × 3.75/M = US$0.03540`, below US$0.10.
This is not an exact tokenizer count, measured charge or guaranteed complete output.
Thinking shares the output cap; truncation fails. Pricing must be rechecked on/after
2027-01-01 and before activation if assumptions change. No balance was accessed.

Proposed separate approval: **activate one fixed, exclusive native structured run
using this frozen candidate and this single approved crop, existing privately
verified key/project and Prepay, max one request and US$0.10 estimated maximum,
no retries/fallback/automatic save**. Activation must add/review a separate one-shot
local launcher/transport and safe error projection, freeze the final request/build,
verify readiness and image hash, then use normal Capture. This checkpoint has no
live reservation or executable native command. Existing consumed launchers cannot
be reused. Any failure consumes that future reservation and stops the run.

The existing safe error projector may report structured allowlisted details or
`rejected field unknown`. Its old field-path allowlist does not include the new
`generationConfig.responseMimeType` path; if Google identifies only that path it
will currently be unknown. Address that narrow diagnostic coverage in the separately
reviewed activation rather than retaining provider messages or assuming a cause.

## Exact task manifest and preservation

All changes remain uncommitted. Exactly 12 task files (existing unrelated changes
are not part of this manifest):

1. `src/features/receipt-image/structured-image-contract.ts` — new contract/builder/decoder/mocks/cost.
2. `src/features/receipt-image/structured-image.test.ts` — new focused controls.
3. `src/features/receipt-image/direct-image-boundary.ts` — decoder seam; existing untracked file.
4. `src/features/receipt-image/ReceiptImageIntake.tsx` — candidate query/endpoint; preserves entry edits.
5. `src/server/receipt-structured.ts` — new mock-only local handler.
6. `src/server/receipt-structured.test.ts` — new mock/privacy/reservation controls.
7. `src/app/api/receipt-structured/route.ts` — new server route.
8. `qa/spendscape-receipt-structured.spec.ts` — new synthetic production-browser checks.
9. `qa/receipt-structured/README.md` — new preparation/reproduction/gate.
10. `qa/receipt-structured/freeze.json` — new offline candidate freeze; no live reservation.
11. `docs/spendscape/COLLEGE_GEMINI_STRUCTURED_RECEIPT.md` — this new checkpoint.
12. `docs/AI_HANDOFF.md` — append-only status; earlier content preserved.

Entry snapshot: 397 non-artifact files and 100 protected artifact hashes. Apart from
the three existing task files, unrelated entry bytes remain unchanged except the
ignored generated `tsconfig.tsbuildinfo` cache refreshed by typecheck/build. It is
excluded from the task manifest. All 100 protected artifact hashes are unchanged.
Minimal original/activation freezes verify all 49/57 dependencies respectively.
The candidate freeze verifies 21 dependencies. No historical QA output was regenerated.
The minimal consumed reservation and lifecycle remain byte-identical.

Branch `feature/spendscape-rebuild`, HEAD
`52902b13a8493ed616cc35ccb084a3edeecaf590`; index empty. Protected main and cached
origin/main both `eee0d26b55e5061f87ac664938df0c195800b74f`. Cached origin feature
`66fb4204154c88789e9e0401e317f9000b6b5e18`; ahead 18 / behind 0; no remote refresh.
Final cumulative tree: 8 tracked modifications and 122 individual untracked files,
including preserved prior work. Vercel was not accessed or changed; its existing
paused state remains user-reported. No commit, push or deployment.


## Authorized native validation preparation — 2026-10-09

One request authorized on existing Prepay, maximum US$0.10. Fixed run
`structured-validation-20261009-one` has a separate exclusive record location:
`artifacts/receipt-gemini-structured-validation-20261009-one/receipt-1/`.
No arbitrary namespace/path, retry, redirect, fallback, second slot or automatic save.
A durable fsynced reservation and lifecycle precede authentication and dispatch.
Default/hosted/CI/unknown-run behavior is disabled; native origin/host/image guards
are reused. GET safe status survives disconnect/restart. Dispatch initiation is
intent, not proof of processing. Stage timings begin at diagnostic establishment;
launcher authentication/project comparison, upload and human review are outside.

The candidate contract, prompt, builder and decoder remain byte-identical. Its API
route gains native selection; unknown supplied native runs cannot fall back to QA.
Original preparation freeze remains unchanged and intentionally detects this route
activation. A separate activation freeze covers 131 source/history files and 449
production build files. Serialized request SHA256 is checked before dispatch:
`1c9420c3fded6fe371c7943c02aece82bf10fadff0e0a68c16e362e6748c833d`.
Approved crop rechecked: JPEG, 211603 bytes, 918×2048, f309579a… matches.
No known answers were added to the prompt.

The user-only launcher verifies source/build/image/Git/unused-run before the existing
read-only gcloud key/project comparison. Key/token/digest are never printed or
persisted. Intended project remains spendscape-receipt-benchmark / 376401338717.
Only a matching key enables native loopback port3156. Instructions are in
`qa/receipt-structured/activation/README.md`. The agent did not access credentials.
Native transport reuses bounded safe error projection; unsupported paths remain
`rejected field unknown`. No unrestricted provider message can enter the journal.

Official pricing/model/media/thinking documents rechecked 2026-10-09: US$0.75/M
input, US$3.75/M generated including thinking through 2026-12-31. Default image
allocation approximately1120; budget2240. Combined generation cap4096, conservative
budget8192. Input budget6240 gives **US$0.03540**, below US$0.10; estimate, not an
exact measured charge/provider dollar limiter. Current existing Prepay and
Auto-reload Off remain user-reported, reconfirmed by the private launch flags.
No account/billing/permission action.

Fresh evidence: `artifacts/gemini-structured-native-e86hs4yv/`.
**125/125 guarded unit tests**: native23, mock12, contract27, direct49, final-payable14.
**25/25 guarded Node tests**: launcher13 and existing key verification12.
Application/focused typecheck and production build pass.
**3/3 focused production-browser mocks,12.468s**: actual mock route, background late
response cleanup, partial editable/save blocking. Initial sandbox Chrome startup
failed; authorized run then had a test-invocation evidence-directory mistake (2/3).
Only that invocation setting changed; distinct artifacts/fresh mock run passed3/3.
Initial outputs retained. Mock servers stopped; historical artifacts not regenerated.
No provider calls or credential use in QA. Exact next-env entry bytes verified.

Exact activation-task manifest, all uncommitted (11 files):

1. src/features/receipt-image/structured-image-transport.ts — new frozen request transport.
2. src/server/receipt-structured-native.ts — new fixed native run/one-slot configuration.
3. src/server/receipt-structured-native.test.ts — new mock/durability/privacy tests.
4. src/app/api/receipt-structured/route.ts — native/default/mock selection.
5. qa/receipt-structured/activation/preflight.mjs — pure launch gates.
6. qa/receipt-structured/activation/preflight.test.mjs — offline launch controls.
7. qa/receipt-structured/activation/start.mjs — private user verification launcher.
8. qa/receipt-structured/activation/README.md — private instructions.
9. qa/receipt-structured/activation/freeze.json — source/history/build freeze.
10. docs/spendscape/COLLEGE_GEMINI_STRUCTURED_RECEIPT.md — appended status/result.
11. docs/AI_HANDOFF.md — appended actual status.

At preparation: **zero new inference requests; native reservation absent**.
Awaiting the user-private launcher. This is not a live outcome or verified key match.
All101 protected artifact hashes and minimal freezes'49/57 dependencies unchanged.
Main refs/HEAD/index preserved; candidate contract unchanged. Vercel untouched.
A draft must remain transient/unsaved for explicit review; HTTP success, contract
validation, field accuracy and save/reload are separate outcomes. Live results will
be appended only after the authorized single normal-Capture submission.


## 2026-10-09 — Single native structured validation consumed

The user completed the private key/project launcher; local status independently
reported native mode and an unused slot before Read. The approved original crop
and frozen request hashes above were unchanged. ONE actual Capture request was
submitted; its separate reservation is permanently consumed. Durable status:
HTTP200, parsing-complete, review-response-complete, state complete. No retry,
fallback, correction, second image or save. No geometry parser was used.

Lifecycle milliseconds: reserved0, authentication-start6, authentication-complete12,
dispatch-initiated23, provider-http11720, parsing-start11734,
parsing-complete11740, review-response-complete11746. Total11.746s covers server
key-digest verification, request/read, validation and response preparation; it
excludes private launcher gcloud/project verification, upload and human review.
Dispatch initiation alone is not evidence of Google processing; received HTTP200
and the validated response establish this request's actual provider outcome.

A real editable draft appeared. Transient comparison only, no raw OCR/provider
body or receipt screenshots retained:
- Merchant matched. Address street name, number and city matched; its prefix did
  not match the printed reference and requires user review.
- All five product descriptions matched (one apostrophe/spacing variant), all
  five quantities, unit prices and printed line amounts matched; seven units;
  promotional rows excluded; absent barcodes remained unknown.
- Printed date/time observations matched, but date was returned in DMY format;
  the existing datetime-local editor remained blank. Currency was returned in
  Hebrew notation, leaving the ISO currency select blank. These are confirmed
  observation-to-editor compatibility limits, not missing source observations.
- Units remained unresolved for all five rows. No line discount was allocated.
  Final payable matched. Reference arithmetic correction: the five approved
  printed line amounts sum to ILS60.45, not the earlier ILS60.55 reference; payable
  remains ILS60.50. No printed value was changed. The live summary/difference
  remained unresolved until explicit currency confirmation, so its rendered
  difference notice was not verified in this live run (covered by mocks).
- Timezone, merchant/place/channel, payment and category require explicit user
  confirmation. No location, identifier, century or financial fact was inferred.

The draft remains in the local Capture tab for user review; changing/hiding/closing
it follows existing transient cleanup. No purchase created; real save/reload and
baseline-after-save remain unverified. Mock persistence checks do not establish a
real saved purchase. The user-owned native server remains available for review;
owned mock servers are stopped. The consumed slot blocks another inference.

Preparation QA remains125/125 unit,25/25 Node,3/3 production-browser mocks;
application/focused typecheck and production build passed. No implementation was
changed during validation. Conservative cost boundUS$0.03540 (<US$0.10), actual
billing not measured. Vercel/account/billing untouched. Exact activation manifest
above remains11 files; all uncommitted. HEAD52902b13, index empty, protected main
refs and exact entry next-env bytes unchanged; historical evidence/locks preserved.
Next bounded gate: review this checkpoint and the DMY/Hebrew-currency/address
compatibility findings; no further provider request is authorized.

Final Git verification: 8 tracked modifications / 130 individual untracked files,
index empty, ahead18/behind0 versus cached origin feature; no fetch. All101 protected
entry artifacts and activation freeze131 source/history+449 build hashes match.
Only task docs/route and ignored tsconfig.tsbuildinfo differ from entry; unrelated
entry files preserved. next-env matches entry and HEAD. Whitespace checks pass.


## 2026-10-09 — Observation/editor compatibility prepared offline

See [COLLEGE_RECEIPT_EDITOR_COMPATIBILITY.md](COLLEGE_RECEIPT_EDITOR_COMPATIBILITY.md)
for the exact eight-file task manifest and reproducible evidence. Strict ISO/DMY
calendar conversion and narrowly recognized ILS notation now populate review
controls while preserving original observations. Time, timezone, units and place
are never inferred. Address corrections remain transient and separate from the
original; they do not confirm a place or enter purchase storage. Existing final
payable and printed-line validators remain unchanged. Evaluation reference is
product sum60.45/payable60.50; the difference remains nonblocking after review.

QA259/259 focused guarded unit,6/6 final synthetic production-browser scenarios
(25.467s), application/focused TS and isolated production build passed. The initial
browser run was2/6: four tests incorrectly expected unit-first focus; existing
validation focuses quantity while its unit is unresolved. Only the new QA
expectation changed, with keyboard access and visible unit errors verified.
EN/HE mobile screenshots contain fictional data only. No live request or new
reservation. The successful Gemini model/prompt/JSON mode/transport are unchanged.
All103 protected evidence hashes and449 native build hashes match entry. Original
freezes remain byte-identical; the activation source freeze intentionally detects
this new editor/adapter change and was not regenerated.

The user explicitly chose to leave the real draft open. Its tab and user-owned
server3156 remain intact; no Save/reload or field correction was performed here.
The loaded old UI does not acquire these changes until a later reload, which would
discard that transient draft. Real save/reload remains unverified. No further
provider call is authorized. Stop for checkpoint review; no commit/push/deployment.
