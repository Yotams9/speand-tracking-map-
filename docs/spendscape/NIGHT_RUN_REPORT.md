# Night run report — 2026-10-09/10

Branch: `feature/gal-cleanup-and-look` (from `main` at `69506d2`). Pushed; **not merged
into `main`**, nothing deployed, Vercel untouched, `.env.local` neither read nor committed.
No AI chat or Gemini work. Nothing under `src/features/receipt/**` or
`src/app/api/receipt/**` was created or edited.

## בקצרה (Hebrew summary)

- **שלב 1 (ניקיון):** האפליקציה נפתחת בעברית; נתוני הדמו מוסתרים כברירת מחדל,
  ויש כפתור "טען נתוני דמו" שזוכר את הבחירה. יש מסכים ריקים ידידותיים.
  "בית עסק" הוחלף ב"חנות". כשבוחרים סניף של רשת והתאריך ריק, נכנס "עכשיו"
  (שעון מקומי, אפשר לשנות). תוקן `next.config` כדי שרשימת הסניפים תעבוד ב־Vercel.
- **שלב 2 (מנוע תובנות):** חישובים קבועים בלי AI: סה״כ, לפי חנות, לפי קטגוריה,
  לפי חודש, החנות המובילה, הרכישות הגדולות, השוואת חודשים, המוצרים הנקנים ביותר
  וסל ממוצע. כל תוצאה זוכרת מאילו רכישות היא חושבה. במסך הנתונים יש כרטיס "החודש".
- **שלב 3 (עיצוב):** גופן Heebo, צבע הדגשה אחד (מנטה) רק ל"הכי זול" ולחיסכון,
  סכומים גדולים, כרטיסים שקופים מעל המפה, כפתורים בגודל 44px, ובדיקת ניגודיות
  AA שעברה בכל המסכים.

## Commits

| Phase | Commit | Summary |
|---|---|---|
| 1 | `d7ff802` | Hebrew default, demo data opt-in, Store wording, "now" date, Vercel tracing fix, CLAUDE.md |
| 2 | `f457b40` | Deterministic insights engine + "this month" card in Analytics |
| 3 | `22fa935` | "Premium night" visual polish + contrast audit |
| — | (this report) | Night-run report |

## Phase 1 — Cleanup

Plan: rewrite the outdated authorization text, fix the stores route tracing, fill
"now" for chain stores, rename user-facing Merchant→Store, make demo data opt-in
with empty states, default to Hebrew. Keep existing QA by opting suites into
demo + English rather than deleting tests.

Done:

1. **CLAUDE.md** now describes the real app (Next.js, MapLibre, Tel Aviv catalog,
   device storage, insights engine) and the task-by-task way of working; the
   product truths are kept and tightened (editable auto-fill, barcode-only
   comparison, no FX invention).
2. **`next.config.ts`**: `/api/catalog/stores` traces `./data/catalog/*.json`, same
   as `/api/catalog/[gtin]`.
3. **Purchase form date**: choosing a chain store (catalog store, or a chain store
   already on the map) fills an empty date with the current minute. The field
   now shows and accepts **local time** (it was labelled UTC); the stored value
   stays UTC, so validation and saved data are unchanged. A typed date is never
   replaced. Tests: `catalog-stores.test.ts` (fill/keep/round-trip/partial text)
   and `qa/spendscape-first-run.spec.ts` (fills ≈ now, stays editable).
4. **Merchant → Store / בית עסק → חנות** in every user-facing string (review form,
   capture, barcode note, validation errors, the "unidentified store" demo
   merchant). Code identifiers and stored keys are unchanged.
5. **Demo data opt-in** (`src/data/demo-visibility.ts`):
   - Off by default; `spendscape.demo-data.v1` = `on|off` in `localStorage`.
   - Toggle in the header ("טען נתוני דמו" / "הסתר נתוני דמו", also on mobile),
     in the Purchases panel, and in every empty state.
   - With demo off: no demo purchases, evidence or inbox questions (the Inbox
     button hides when there is nothing to ask); fictional demo stores leave the
     purchase form, except any store the person's saved purchases already use and
     the "store not identified" option. Real catalog stores and saved purchases
     always show. Lookups/validation still use the full directory, so nothing
     saved is lost.
   - Empty states: home card ("עוד אין רכישות" + add + load demo), Purchases panel,
     Analytics first-run card; the old "no places match" overlay no longer shows
     when nothing is saved.
   - Existing QA suites opt in via `qa/demo-storage.ts` (Playwright
     `storageState`: demo on + English); one storage assertion in Scanner E now
     ignores the two preference keys.
6. **Hebrew default**: `<html lang="he" dir="rtl">`, initial locale `he`; the
   language choice is remembered in `spendscape.locale.v1`. English switch kept.

## Phase 2 — Spending insights engine

`src/features/insights/insights-domain.ts` (+ `insights-domain.test.ts`, 17 tests):

- `totalSpent`, `spendByStore`, `spendByCategory`, `spendByMonth`, `topStore`
  (optionally per category), `topCategory`, `biggestPurchases(n)`,
  `compareMonths(a, b)`, `mostBoughtItems(n)`, `averageBasket(store?)`,
  `thisMonthSummary`.
- Ranges: this month, last month, last 30 days (today + 29 local days), this
  year, all, custom local dates (inclusive). Boundaries are computed in
  `Asia/Jerusalem` with DST handled (tested across the 25 Oct 2026 change).
- Money is integer minor units (agorot); totals are per currency; ranking uses
  one currency (default ILS) and never converts others.
- Every result carries the exact `purchaseIds` it was computed from.
- "Store" = merchant (a chain across its branches). Items are grouped by
  normalized name only; nothing is matched across different products.
- Analytics shows a **"this month"** card (total, top store, top category,
  change vs last month; less spending is shown in mint). It always uses the whole
  month, independent of filters, and includes demo purchases only when the demo
  toggle is on. No chat UI.

## Phase 3 — Visual polish

- Fonts: Heebo (Hebrew subset) + Inter (Latin subset) via `next/font`; the old
  serif display face is gone.
- Colour: neutral greys everywhere; **mint only** for the cheapest price, the
  "less than last month" change, and savings. Groceries category colour moved
  off mint. The live-status dot is neutral.
- Large amounts: purchase rows, a new hero amount + date on purchase detail,
  the scan price list, the Analytics month card.
- Scan result: one row per store; the cheapest row(s) get a mint outline and a
  "הכי זול / Cheapest" badge (same barcode, same unit; ties all marked).
- Frosted translucent panels, 16 px radius tokens, 4/8 px spacing tokens,
  44 px controls, minimum 0.7 rem text, transitions ≤ 200 ms (reduced motion
  still collapses them).
- Map: chain store dots get a quiet per-chain tint (Shufersal / Rami Levy /
  Osher Ad), no logos.
- Copy: "Globe checkpoint" wording removed; bottom nav is
  גלובוס / הוספה / רכישות / נתונים (Globe / Add / Purchases / Stats).

## Verification

- `npm run typecheck`: clean.
- `npm test`: **241 passed / 20 files** (start of night: 212 / 18).
- `npm run build`: passes (production build used for all browser QA).
- Playwright, Chrome, production server on 127.0.0.1:3000:

| Suite | Result |
|---|---|
| `spendscape-first-run` (new) | 4/4 |
| `spendscape-contrast` (new, WCAG AA, he/en × 390/1440, home/purchases/stats) | 4/4, 0 failures over 12–51 text elements per screen |
| `spendscape-night-shots` (new, screenshot walk-through) | 8/8 |
| `spendscape-scanner-e` | 28/28 |
| `spendscape-scanner-b` | 33/33 |
| `spendscape-search-layout` | 4/4 |
| `spendscape-replay*` | 28/29 (1 = baseline; 3 label fixes re-run: stationary 6/6) |
| `spendscape-inbox` | 3/4 (1 = baseline) |
| `spendscape-data-boundary` | 2/4 (2 = baseline) |
| `spendscape-ask` | 10/12 (2 = ffmpeg) |
| `spendscape-capture` | 3/5 (2 = ffmpeg) |
| `spendscape-globe` | 1/3 (2 = ffmpeg) |
| `spendscape-analytics` | 0/2 (2 = ffmpeg) |
| `spendscape-slice-1d1` | 0/2 (2 = ffmpeg) |

Every failure matches the machine's known baseline: the tests that record video
cannot start without `ms-playwright/ffmpeg-1011` (so their assertions did not run
tonight), the inbox focus-offset check, the Replay "Capture and Inbox composition"
click timeout, and the data-boundary Replay-open click. No new failures remain.

Screenshots (git-ignored) in `artifacts/night-run/`:
`before/` (start of night), `p1/`, `p2/`, `p3a/`, `p3b/` (final). Each set covers
he/en × 390×844/1440×900 × empty/demo: home, purchases, purchase detail, stats,
capture, scan result, review form, saved, home with purchase, stats with
purchase, purchases with purchase, own purchase detail. Contrast JSON per screen
is in `artifacts/night-run/contrast/`.

## Issues found and fixed during the loops

- The new home empty card overlapped the old "No places match this view" card.
- A global `!important` 44 px rule shrank the 70 px purchase rows on mobile (rows
  overlapped); replaced by a default rule plus targeted 44 px values.
- Analytics showed "Totals combine demo data…" and "illustrative ILS" with demo off.
- Mobile hero title wrapped to three lines in Heebo.
- Four QA files still expected the old nav label "Capture/קליטה".

## Skipped or not done

- Purchase pins and clusters on the globe stay blue: they are part of the
  accepted globe fidelity and its tests; changing them felt out of scope.
- The 10 video-recording tests did not run (ffmpeg missing); installing it needs
  a download, which I did not do unasked.
- Contrast is audited over the app's own surfaces, not over map tiles.

## Open questions for you

1. Should the globe pins also turn neutral (white/grey), or stay blue?
2. Is "הוספה" right for the middle nav button (it was "קליטה")?
3. Is the demo button in the header OK, or should it move into a settings area?
4. May I run `npx playwright install ffmpeg` (free download) so the video tests run again?
5. Purchase lists format dates in UTC; a purchase just after midnight Israel time
   can show the previous day. Fix it next time?

## Next steps

1. **Tomorrow: in-app chat on top of the insights engine.** The chat only picks
   which deterministic function to call and how to phrase the answer; every
   number and date comes from `insights-domain.ts`, with its `purchaseIds` shown
   as sources.
2. Then the **savings engine**: whole basket at one store (never split), compared
   only by identical barcode, using the Tel Aviv published prices, labelled as
   estimated.
3. Open a PR from `feature/gal-cleanup-and-look` when you are happy with it.
