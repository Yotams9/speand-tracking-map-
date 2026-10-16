# Receipt review: one category and observed store/address — 2026-10-16

Base: integration/final, 5c53f20dc3996f38c1ca0413cd9ee2b53d6f808c.

The user reported a duplicate category choice and an empty store/location picker after receipt extraction.

Changes:
- Receipt review shows one category. For a proposed new merchant, its upper category selector also updates the purchase category. Existing merchants use one editable purchase category in the same store section. Manual/barcode category fields retain their behavior.
- The observed merchant appears as the selected proposed-store option. Saved merchants/places remain explicit choices; no existing merchant is matched by name automatically.
- The editable observed address is beside the store details, retaining the same temporary state and post-Save handoff. It is not duplicated above.
- New receipt merchants remain unresolved until a map point is confirmed. The physical channel becomes available when a saved place is explicitly selected; receipt entry does not require coordinates.

Verification: application typecheck, production build and whitespace check pass. One focused Hebrew mobile browser check with fictional observations confirmed the selected observed name, a single category, address prefill, category persistence, unchanged payable total, one saved purchase after reload, no pin, and name/address handoff into the optional location form. The initial harness used an obsolete readiness selector after reload; the corrected selector and IndexedDB assertions passed. No broad suite or live provider calls ran. Historical browser scenarios selecting the removed second category were not re-run in this bounded check.

Operational boundary: the current hosted session authorizes two receipt reads and zero address searches. This change does not enable Geoapify, alter quotas, create pins from text alone, change the active deployment, reload the user's open draft or mutate real purchase storage. A pin requires an explicitly confirmed map point or a separately activated address search followed by confirmation. The current receipt draft must be saved or explicitly discarded before loading a replacement UI.
