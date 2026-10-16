# Explicit receipt repeat and accurate quota errors — 2026-10-16

Base: integration/final 5a4f18c48a6dad665fd0ef4c6a70f60efb0a5b3e.

Diagnosis: the user confirmed uploading the same previously successful image. The live capability reported available, used 1/2, remaining 1, with the original expiry. The code's image digest replay guard rejects that duplicate before provider dispatch. Its Redis error was collapsed into `pilot-stopped`, incorrectly suggesting a stopped session. A read-only zero-key Redis script confirmed fixed duplicate errors arrive as HTTP 400; no counter or reservation was modified.

Fix:
- Parse bounded Redis HTTP 400 responses and preserve only a fixed rejection allowlist. Duplicate maps to `attempt-consumed`; busy/wait map to `pilot-wait`; stopped/expired/limit stay stopped. Unknown errors remain unavailable and expose no upstream text.
- Keep a duplicate image temporarily in memory for a clear explicit repeat decision. No automatic retry occurs. Closing/discarding releases it.
- Only the hosted operational UI offers “Approve reading again — uses another read” when quota remains. Local frozen/validation launchers do not offer a repeat.
- Each approved repeat has a random 128-bit submission ID combined with the content digest under the existing HMAC. Retransmitting that same ID cannot dispatch twice. The original digest remains recorded. Every explicit repeat reserves another request and its existing cost before dispatch; shared concurrency, cooldown, failure stop, total count, budget and expiry are unchanged.

Verification: production build/typecheck and whitespace checks; isolated synthetic contract checks for uncharged duplicate, exactly one charged explicit repeat, replay blocking, preserved original digest, HTTP 200/400 fixed errors, unknown-error suppression and image disposal. A mocked HTTPS mobile browser confirmed the preview and duplicate explanation remain, default Read is disabled, no repeat occurs until a separate button press, a new submission ID is sent and the editable review appears. No real receipt/provider call, real purchase save, quota reset, extension or live retry occurred. The temporary server was stopped.

The currently published old UI may still show its generic warning until this separate fix is published. The remaining real read must be triggered only by the user. This change does not increase the two-read / US$0.10 allowance or activate address search.
