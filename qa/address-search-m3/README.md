# College Milestone 3 one-search validation (local only)

Run: geoapify-college-m3-validation-20261013-one. Required HEAD
7c4ec31c74d236297791d9edbf8322cda901de0b, feature/spendscape-rebuild.
This is a new launcher; all historical launchers/freezes/reservations are preserved.

User confirms the existing Spendscape project's Free plan, one remaining daily
credit, no concurrent usage or paid overage. This is user-console evidence, not
independent key metadata verification. Official simple forward geocoding costs one
credit; expected $0 only within the confirmed Free allowance. Soft quotas are not
a hard spending cap. Sources (2026-10-13): https://www.geoapify.com/pricing/ and
https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/.

Private key entered by the user in Terminal; never chat. Launcher starts loopback
3172, never searches itself. OCR/LLM keys/flags omitted; framework logging suppressed.
Exact source/build freeze is checked before exclusive reservation and before send.
GET /api/address-search exposes only bounded lifecycle metadata.

Review the corrected commercial address in the existing purchase location form.
Explicit consent and Search once send only reviewed address and result language
plus required technical parameters (limit5,JSON,no IP-country bias,private key).
No receipt, purchase ID, items or payment data. No retries, redirects, autocomplete,
reverse search or fallback. Errors/uncertainty consume the run. Candidate selection
only proposes/previews. Verify/adjust location, branch and address before the user
checks physical confirmation and presses Confirm and save place. Current matching
does not establish historical occupancy. If uncertain, cancel and stay unresolved.

Queries/results stay transient. Only explicitly confirmed place/provenance persists
through existing atomic IndexedDB update. No changes to financial acceptance or
purchase IDs. Keep Vercel paused; never rerun a consumed launcher.
