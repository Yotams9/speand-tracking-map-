# College Milestone 4 — qualified city price comparison

The latest approval replaces the original 5 km acceptance with two official
Shufersal branches in Petah Tikva. Radius, distances and branch pins are deferred;
no coordinate or proximity claim is made. Existing purchase pins are unchanged.

## Public source qualification

Official Stores directory: chain 7290027600007; physical branches 104 (subchain 1,
שלי פ"ת- גד מכנס, רוטשילד 180) and 285 (subchain 7, אקספרס סוקולוב פ"ת,
סוקולוב 26). Both have City 7900 and explicitly Petah Tikva branch names.
City code alone is not generalized to other directory records. The retained
Stores hash is 2ba51734a0a9c85969d5e4eb820e430e915464a2f2550a98d57de5c0bb1470e7.
Established regulator/retailer currency and reuse evidence remains in
artifacts/nearby-preview-commit-qzscphdl/SOURCE_QUALIFICATION.md.

Four new, separately counted HTTP 200 attempts: branch-104 listing/download,
branch-285 listing/download. Total 19/22 attempts consumed; three remain unused.
No new geocoding, OCR, LLM, credentials or private-location transmission.
Three retained feed files total (one Stores, two PriceFull); global byte budgets
include earlier transfers and the reserved size of the previously lost file.
Bounded raw public sources and immutable attempt records remain in isolated
artifacts, separate from IndexedDB purchase data.

PriceFull files:
- PriceFull7290027600007-001-104-20261014-121701.gz:
  SHA256 f6a9d7de8819fc3b47c037dc2922d9f938013e74460d4ad7534994b5b5a5933c;
  315,721 compressed / 5,249,234 expanded bytes; 6,147 item rows.
  Publisher HTTP Last-Modified 2026-10-14T10:18:33.000Z;
  fetched 2026-10-14T14:50:57.386Z.
- PriceFull7290027600007-007-285-20261014-121701.gz:
  SHA256 f2bf22b292ab7f58f84114a712e3f9f69ac4a76715fed43d0cdedc348daa80ab;
  176,924 compressed / 2,840,639 expanded bytes; 3,334 item rows.
  Publisher HTTP Last-Modified 2026-10-14T10:20:47.000Z;
  fetched 2026-10-14T14:53:05.720Z.

Publication clock is the publisher's HTTP Last-Modified in UTC. Filename and
item-update timestamps remain separate raw local timestamps; their timezone is
not invented. Older item-change times do not date the current full publication.
Each publication was under 24 hours old at collection. Quotes expire 24 hours
from that publication clock, without network refresh. No permanent current-price
claim is made. Chain/subchain/store, source filename and official directory must
agree. BikoretNo is numeric vendor metadata, deliberately not an identity key:
directory 7 differs from PriceFull 5/9; the discrepancy is retained.

## Ordinary comparison behavior

A read-only compiled snapshot contains four common Monster 500 ml cans, validated
GTIN/check digits, observed package count/size/unit and positive decimal ILS prices.
The catalog is explicitly limited. It does not represent the full retailer range.
A user selects the comparison city and explicitly matches product, brand, variant
and package. Matching stays temporary and never fills a missing receipt barcode,
changes a purchase, or creates a pin. Unsupported quantity units and unmatched,
expired or unqualified prices remain unavailable. Partial subtotals are labeled;
all receipt rows must be priced before a complete matched-row total appears.
There are no stock, promotion, checkout-price or historical-receipt savings claims.
The historical fictional preview remains accessible only through its existing
explicit loopback QA opt-in, never as ordinary verified data.

The user explicitly identified Mango 500 ml. Public product GTIN 5060639129102
appears in both qualified branches at ILS 9.90 per can. Three confirmed cans quote
ILS 29.70 in each branch. This confirmation does not change the saved receipt.

## Verification and scope

Evidence: artifacts/college-m4-city-7o5_9swt/.
- Isolated candidate: 42/42 focused contract/comparison tests; typecheck and
  production build passed. Root 45/45 additionally includes excluded map research.
- Offline XML parser 4/4; collector preflight 4/4; download qualification 1/1.
- Five production-browser synthetic scenarios passed (360/390/430/1280 widths,
  EN/HE, explicit matching, close/reopen/reload cleanup, expired publication,
  unchanged IndexedDB, independent totals, one map and unchanged pin).
- EN/HE mobile screenshots visually inspected: usable controls, wrapping and
  no horizontal page overflow. Screenshots contain synthetic purchases only.
- Initial test import failure and pre-build working-directory failure retained;
  corrected isolated runs are the evidence above. No production data used in QA.

Exact candidate scope: NearbyPricesReview.tsx, NearbyPricesQaReview.tsx,
city-comparison.ts, city-comparison.test.ts, city-snapshot.json,
SpendscapeGlobe.tsx (city button label only), tools/prices/qualify_city.py,
tools/prices/test_qualify_city.py, this checkpoint, and only new city status
sections in AI_HANDOFF.md and COLLEGE_FINAL_MILESTONES.md. Earlier dirty research,
branch-point preview wiring, server run configurations and handoff sections remain
outside the candidate.

## Real walkthrough — passed 2026-10-14

The previous port-3172 server was already stopped. The tested isolated build was
started on that same origin with Gemini/Geoapify/Google/Groq keys removed and
provider activation absent. No provider request occurred during the walkthrough.
The real target purchase was present once. User-confirmed Mango selection and
package confirmation produced ILS 29.70 at both branches, 1/1 rows priced. The
saved purchase detail text was identical before/after comparison and same-origin
reload. The three purchase cards, three existing pins and single map survived;
matching cleared on reload and no quote appeared until a new explicit match.
Read-only browser access to IndexedDB was unavailable; real preservation was
inspected through rehydrated purchase details/counts, while full IndexedDB equality
is covered by the isolated synthetic browser tests. No private purchase snapshots
or screenshots were persisted. No new purchase/place or receipt identifier written.

Revised city-based acceptance passes. Original radius/coordinate requirement remains
deferred, catalog coverage limited, and publications expire after 24 hours. The
provider-disabled local comparison is available at http://127.0.0.1:3172/.
Vercel stays paused. Local completion commit is authorized; no push/deployment.
