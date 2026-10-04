# Scanner A — camera shell and local QA

## Current status reconciliation — 2026-09-09

Scanner A is completed, reviewed, committed and pushed at
`23683efcfea1151b96d940e420eafd19760626c6`. Scanner B is also completed,
reviewed, committed and pushed at `33a34afb2668f58b89431e3cb7bc5f3c292ebb8d`;
it identifies candidates only and does not create purchases. The existing Vercel
college demo is active. Physical Scanner A/B smoke testing has a user-reported
pass on iPhone 17 Pro, iOS 26.6.1 Safari, not an independently instrumented test.
See [the current handoff](CONVERSATION_HANDOFF.md#scanner-ab-and-college-demo-reconciliation)
for the exact report, limitations, deployment and deferred demo-action clarity
issue. No implementation slice is active; Scanner D/E, optional C and real
integrations remain separately gated.

## Original implementation and review history

The following records the original Scanner A scope, tests and gates; its pending
phone/deployment and next-commit statements describe that checkpoint, not current
status. Its no-frame-extraction description concerns Scanner A alone; Scanner B
later added transient local worker frames under separate approval.

Authorization: `APPROVE SPENDSCAPE SCANNER A CAMERA SHELL + LOCAL QA`.
Work remains on `feature/spendscape-rebuild`, based on
`c17595c3e1d00138c278a389367731da8f3bf644`. No commit or publication is authorized.

Subsequent bounded checkpoint review passed on 2026-09-07. See
[SCANNER_A_CHECKPOINT_REVIEW.md](SCANNER_A_CHECKPOINT_REVIEW.md) for that review
verification, original commit allowlist and separate commit approval token.
At that checkpoint, physical iPhone Safari QA was deferred until an authorized
HTTPS Preview existed; the later demo and user-reported smoke pass are recorded above.

## Delivered behavior

- Native camera preview starts only from the Start camera button. Opening
  Capture does not request permission. Microphone access is never requested.
- Explicit pending, live, stopped, denied/blocked, missing, busy, insecure,
  unsupported, interrupted and playback-failure states have English/Hebrew copy.
- Cancel remains available while permission or playback is pending. A late
  permission grant is stopped without attaching a preview.
- Stop, Close, Escape, browser Back, leaving the scanner, background/pagehide,
  track interruption and unmount release the stream and detach the video.
  Returning does not automatically restart the camera.
- Video uses inline, muted playback and object-fit containment. Orientation
  changes resize the layout without creating another stream. Compact landscape
  and small-phone layouts keep camera/manual actions accessible.
- Existing synthetic receipt/product/barcode/file-source demonstrations,
  manual entry, review/confirmation and session additions remain available.
- Preview has no shutter, recording, frame extraction, image persistence,
  uploads, barcode/OCR engine, provider, storage or new purchase mutation path.
  Live pixels stay in the browser's media stream; no photo is created by the app.

## Implementation footprint

- `src/features/capture/CaptureCamera.tsx`: native preview UI, localized states,
  Start/Stop/Cancel and existing Capture fallback actions.
- `src/features/capture/useCaptureCamera.ts`: browser/video lifecycle wiring.
- `src/features/capture/camera-session.ts`: single-stream ownership and generation
  checks for asynchronous cancellation; no repository or persistence dependency.
- `src/features/capture/CaptureExperience.tsx` and its CSS module: scanner-shell
  integration, honest camera-versus-demo copy and responsive layout.
- `src/features/capture/camera-session.test.ts`: deterministic lifecycle tests.
- `qa/spendscape-scanner-a.spec.ts` and `playwright.scanner-a.config.ts`: focused
  production-server QA with synthetic canvas streams, never a physical camera.
- `qa/spendscape-capture.spec.ts`: reduced-motion assertion now targets the
  native preview instead of the removed simulated scan-line element.
- This checkpoint and the documentation index record the bounded authority.

## Verification

- `npm run typecheck`: passed.
- `npm test`: 126 passed, including 22 camera lifecycle tests and the existing
  repository boundary, canonical data, Capture, Ask and Replay domain tests.
- `npm run build`: passed; static application routes remain unchanged.
- Focused Scanner A browser suite: 20/20 passed on the final production build,
  including fake permission outcomes,
  late grants after eight cancellation/navigation paths, track interruption,
  background/pagehide, keyboard focus, EN/HE and responsive layout.
- Existing Capture browser suite: 5 passed, including physical/online/unresolved
  synthetic additions, manual validation, history, fallback sources and nav.
- Existing Phase 2A.1 boundary browser suite: 4 passed, including snapshot-name
  injection into Capture, Inbox, Ask and Replay in English and Hebrew.
- Canonical assertions preserve 42 purchases, 12 places/pins, baseline total
  ILS 6777.38, two online and one unresolved purchase excluded from pins, and one
  MapLibre construction/instance. Scanner preview adds no purchase.
- Camera browser tests assert no write requests. Source review found no image
  capture/serialization, recording, upload, persistence or provider code.

The initial combined run passed 29 browser tests. Visual review then corrected
small-phone/landscape action placement and description styling. The affected
Scanner/Capture suites passed again (25 tests). A final startup correction lets
a temporarily muted new track initialize instead of immediately rejecting it;
its deterministic regression and final focused camera suite both passed.

Local commands (start the production server explicitly; the QA config never
starts a development server):

```sh
npm run build
npm run start -- --hostname 127.0.0.1
./node_modules/.bin/playwright test --config playwright.scanner-a.config.ts qa/spendscape-scanner-a.spec.ts
./node_modules/.bin/playwright test --config playwright.scanner-a.config.ts qa/spendscape-capture.spec.ts qa/spendscape-data-boundary.spec.ts
```

## Rendered evidence and limitations

Screenshots are local ignored artifacts under `artifacts/spendscape-scanner-a/`:
idle/live at 360x640, 390x844, 430x932 Hebrew/RTL, and 1440x900; landscape at
844x390; desktop permission/error states. QA previews show generated text and
solid-color pixels, not a receipt/product photograph or real camera feed.
Reports include `qa-report.json` and `qa-report-layout-and-capture.json`.

Visual inspection covered idle/live phone and desktop layouts, Hebrew/RTL,
landscape, denied-camera recovery and reduced motion. The initial layout issue
was fixed and re-inspected. No Blocker/High defect was found in the verified local
scope. This is not physical-phone or Safari acceptance evidence.

At the original checkpoint, physical iPhone Safari and Android Chrome checks
were still required: real
permission UI, rear-camera selection, hardware focus, busy-camera behavior,
orientation, lock/background camera indicator, repeated lifecycle stability,
VoiceOver/TalkBack and real-device performance. No phone or already-approved
trusted HTTPS test origin was used. No certificate/tool was installed and no
tunnel or deployment was created. The installed Playwright cache has no WebKit
runtime; none was downloaded. Headless Chrome viewport tests do not prove Safari.

Trusted HTTPS is required on the phone; the Mac's LAN HTTP address does not
qualify as the phone's localhost. The instruction at that checkpoint kept physical
iPhone QA pending a separately authorized HTTPS Preview deployment. That slice
does not authorize certificates, tunnels, Vercel connections or deployment.
See [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
Track muting means temporary inability to supply media; lifecycle handling uses
events, with new tracks allowed to initialize. See [MDN track muted](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/muted).

## Original cleanup and hard stop (historical)

Before this work, `next-env.d.ts` already had uncommitted `.next/dev/types/`
imports. Its exact pre-existing contents were restored and verified with `cmp`.
All QA servers started by this slice were stopped; no listener remains on port
3000. `git diff --check` passed and the staging area is empty. No commit, push,
PR, deployment, dependency installation, account or provider call occurred.
HEAD/upstream remain `c17595c3e1d00138c278a389367731da8f3bf644`; main/origin/main
remain `eee0d26b55e5061f87ac664938df0c195800b74f`.

Stop at Scanner A review with physical verification explicitly pending. Do not
begin B, OCR, Open Food Facts, session repository changes, database work or any
other later slice. Any checkpoint commit requires separate explicit approval.
`next-env.d.ts` and all generated artifacts are excluded from that future
checkpoint diff, even though `next-env.d.ts` is already a tracked file. Use the
explicit allowlist in the review; do not stage the whole working tree.
