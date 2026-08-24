/**
 * UI copy. English is the default; Hebrew is optional and flips the document to
 * RTL when selected.
 *
 * Two locales do not justify an i18n framework, but they do justify one place
 * where every string lives — so that a Hebrew pass is a file edit rather than a
 * hunt through components.
 */

import type { Localized } from '@/data/types'

export const strings = {
  'app.name': { en: 'Ledgerline', he: 'לדג׳רליין' },
  'app.tagline': { en: 'Where your money goes', he: 'לאן הכסף שלך הולך' },

  'nav.map': { en: 'Map', he: 'מפה' },
  'nav.forYou': { en: 'For You', he: 'בשבילך' },
  'nav.capture': { en: 'Capture', he: 'הוספה' },
  'nav.inbox': { en: 'Inbox', he: 'תיבה' },
  'nav.profile': { en: 'Profile', he: 'פרופיל' },

  'demo.badge': { en: 'Demo data', he: 'נתוני הדגמה' },
  'demo.explain': {
    en: 'Every figure in this demo is synthetic. Nothing here comes from a real account, receipt, or price source.',
    he: 'כל נתון בהדגמה זו הוא סינתטי. שום דבר כאן אינו מגיע מחשבון, קבלה או מקור מחירים אמיתי.',
  },

  'common.back': { en: 'Back', he: 'חזרה' },
  'common.close': { en: 'Close', he: 'סגירה' },
  'common.done': { en: 'Done', he: 'סיום' },
  'common.cancel': { en: 'Cancel', he: 'ביטול' },
  'common.undo': { en: 'Undo', he: 'ביטול פעולה' },
  'common.est': { en: 'Est.', he: 'הערכה' },
  'common.estimated': { en: 'Estimated, based on demo data', he: 'הערכה, מבוססת על נתוני הדגמה' },
  'common.perMonth': { en: '/mo', he: '/חודש' },
  'common.viewAll': { en: 'View all', he: 'הצג הכול' },
  'common.today': { en: 'Today', he: 'היום' },
  'common.yesterday': { en: 'Yesterday', he: 'אתמול' },
  'common.visit': { en: '{n} visit', he: 'ביקור {n}' },
  'common.visits': { en: '{n} visits', he: '{n} ביקורים' },
  'common.soon': { en: 'Soon', he: 'בקרוב' },
  'common.notInThisPhase': { en: 'Not in this demo', he: 'לא בהדגמה זו' },

  'cat.all': { en: 'Everything', he: 'הכול' },
  'cat.groceries': { en: 'Groceries', he: 'מכולת' },
  'cat.food': { en: 'Food', he: 'אוכל' },
  'cat.shopping': { en: 'Shopping', he: 'קניות' },
  'cat.fuel': { en: 'Fuel', he: 'דלק' },
  'cat.pharmacy': { en: 'Pharmacy', he: 'בית מרקחת' },
  'cat.other': { en: 'Other', he: 'אחר' },

  // -- Map / Home ------------------------------------------------------------
  'map.spentLast90': { en: 'Spent in the last 90 days', he: 'הוצאות ב־90 הימים האחרונים' },
  'map.places': { en: 'places', he: 'מקומות' },
  'map.summaryMeta': {
    en: '{n} purchases · since {from}',
    he: '{n} רכישות · מאז {from}',
  },
  'map.purchases': { en: 'purchases', he: 'רכישות' },
  'map.emptyFilter': { en: 'No purchases in this category yet', he: 'אין רכישות בקטגוריה זו' },
  'map.emptyFilterHint': {
    en: 'Try another category, or log one from Capture.',
    he: 'נסה קטגוריה אחרת, או הוסף רכישה דרך ההוספה.',
  },
  'map.zoomOut': { en: 'Zoom out', he: 'התרחקות' },
  'map.zoomIn': { en: 'Zoom in', he: 'התקרבות' },
  'map.reset': { en: 'Reset view', he: 'איפוס תצוגה' },
  'map.tapCluster': { en: 'Tap a city to zoom in', he: 'הקש על עיר כדי להתקרב' },
  'map.tapMerchant': { en: 'Tap a place to see its purchases', he: 'הקש על מקום כדי לראות רכישות' },
  'map.loading': { en: 'Placing your purchases…', he: 'ממקם את הרכישות…' },
  'map.lastVisit': { en: 'Last visit', he: 'ביקור אחרון' },
  'map.avgPurchase': { en: 'Average', he: 'ממוצע' },
  'map.totalSpend': { en: 'Total', he: 'סה״כ' },
  'map.seePlace': { en: 'See this place', he: 'הצג מקום' },

  // -- For You ---------------------------------------------------------------
  'foryou.title': { en: 'For You', he: 'בשבילך' },
  'foryou.subtitle': {
    en: 'A few things worth knowing. Nothing else.',
    he: 'כמה דברים ששווה לדעת. שום דבר מעבר.',
  },
  'foryou.savingKicker': { en: 'Recurring saving', he: 'חיסכון חוזר' },
  'foryou.savingTitle': { en: 'Your weekly basket costs less nearby', he: 'הסל השבועי שלך זול יותר בקרבת מקום' },
  'foryou.savingBody': {
    en: 'The same basket at {alt} works out about {saving} cheaper, {min} minutes further along a route you already drive.',
    he: 'אותו סל ב{alt} זול בכ־{saving}, {min} דקות נוספות במסלול שאתה כבר נוסע בו.',
  },
  'foryou.savingCta': { en: 'See the comparison', he: 'הצג את ההשוואה' },

  'foryou.habitKicker': { en: 'A habit', he: 'הרגל' },
  'foryou.habitBody': {
    en: 'You have stopped at {merchant} {visits} times, almost always on {weekday} morning.',
    he: 'עצרת ב{merchant} {visits} פעמים, כמעט תמיד ב{weekday} בבוקר.',
  },

  'foryou.proactiveKicker': { en: 'Coming up', he: 'צפוי בקרוב' },
  'foryou.proactiveTitle': { en: 'Your big shop is due {weekday}', he: 'הקנייה הגדולה שלך צפויה ב{weekday}' },
  'foryou.proactiveBody': {
    en: 'Based on the last {n} weeks. The basket you are likely to need would be about {saving} less at {alt}.',
    he: 'לפי {n} השבועות האחרונים. הסל שכנראה תצטרך יעלה בכ־{saving} פחות ב{alt}.',
  },
  'foryou.proactiveCta': { en: 'See what you are likely to need', he: 'הצג מה כנראה תצטרך' },

  'foryou.trendKicker': { en: 'Trend', he: 'מגמה' },
  'foryou.trendBody': {
    en: '{category} spending is {direction} {pct}% against the previous 30 days.',
    he: 'ההוצאה על {category} {direction} ב־{pct}% ביחס ל־30 הימים הקודמים.',
  },
  'foryou.trendUp': { en: 'up', he: 'עלתה' },
  'foryou.trendDown': { en: 'down', he: 'ירדה' },

  'foryou.neededKicker': { en: 'Likely needed soon', he: 'כנראה תצטרך בקרוב' },
  'foryou.neededBody': {
    en: '{n} things you buy regularly are about due.',
    he: '{n} מוצרים שאתה קונה בקביעות עומדים להיגמר.',
  },

  // -- Capture ---------------------------------------------------------------
  'capture.title': { en: 'Add a purchase', he: 'הוספת רכישה' },
  'capture.viewfinderHint': {
    en: 'Point at a receipt, or pick another way below',
    he: 'כוון לקבלה, או בחר דרך אחרת למטה',
  },
  'capture.simulated': { en: 'Simulated camera', he: 'מצלמה מדומה' },
  'capture.scanReceipt': { en: 'Scan receipt', he: 'סריקת קבלה' },
  'capture.scanProducts': { en: 'Scan products', he: 'סריקת מוצרים' },
  'capture.scanBarcode': { en: 'Scan barcode', he: 'סריקת ברקוד' },
  'capture.upload': { en: 'Upload or share', he: 'העלאה או שיתוף' },
  'capture.quickAdd': { en: 'Quick add', he: 'הוספה מהירה' },
  'capture.processing': { en: 'Reading the receipt…', he: 'קורא את הקבלה…' },
  'capture.processingBarcode': { en: 'Looking up the barcode…', he: 'מחפש את הברקוד…' },
  'capture.processingProducts': { en: 'Identifying products…', he: 'מזהה מוצרים…' },
  'capture.processingUpload': { en: 'Reading the file…', he: 'קורא את הקובץ…' },
  'capture.reviewTitle': { en: 'Is this right?', he: 'האם זה נכון?' },
  'capture.reviewHint': {
    en: 'In the real product this step usually would not appear at all.',
    he: 'במוצר האמיתי שלב זה בדרך כלל לא היה מופיע כלל.',
  },
  'capture.confirm': { en: 'Add purchase', he: 'הוסף רכישה' },
  'capture.added': { en: 'Added', he: 'נוסף' },
  'capture.addedBody': { en: 'It is on your map.', he: 'זה על המפה שלך.' },
  'capture.seeIt': { en: 'See it', he: 'הצג' },
  'capture.autoTitle': { en: 'Most purchases will need none of this', he: 'רוב הרכישות לא ידרשו כלום מזה' },
  'capture.autoBody': {
    en: 'Email receipts, digital receipts and an optional card feed can arrive on their own. Capture is for the times they do not.',
    he: 'קבלות במייל, קבלות דיגיטליות והזנת כרטיס אופציונלית יכולות להגיע מעצמן. ההוספה נועדה למקרים שבהם לא.',
  },
  'capture.qaStore': { en: 'Store', he: 'חנות' },
  'capture.qaAmount': { en: 'Amount', he: 'סכום' },
  'capture.qaCategory': { en: 'Category', he: 'קטגוריה' },
  'capture.qaProduct': { en: 'What did you buy?', he: 'מה קנית?' },
  'capture.qaProductPlaceholder': { en: 'e.g. Cottage cheese', he: 'למשל: קוטג׳' },
  'capture.qaStorePlaceholder': { en: 'Pick a store', he: 'בחר חנות' },
  'capture.errAmount': { en: 'Enter an amount above 0', he: 'הזן סכום גדול מ־0' },
  'capture.errStore': { en: 'Pick a store', he: 'בחר חנות' },
  'capture.uploadFail': { en: 'That file could not be read', he: 'לא ניתן לקרוא את הקובץ' },
  'capture.uploadFailBody': {
    en: 'A simulated failure, so you can see how recovery reads.',
    he: 'כשל מדומה, כדי להראות איך נראית התאוששות.',
  },
  'capture.retry': { en: 'Try again', he: 'נסה שוב' },

  // -- Smart Inbox -----------------------------------------------------------
  'inbox.title': { en: 'Inbox', he: 'תיבה' },
  'inbox.oneThing': { en: 'One purchase needs you', he: 'רכישה אחת זקוקה לך' },
  'inbox.question': { en: 'Where was this purchase?', he: 'איפה בוצעה הרכישה?' },
  'inbox.whyAsking': { en: 'Why am I being asked?', he: 'למה שואלים אותי?' },
  'inbox.whyBody': {
    en: 'Your location puts you in this mall, but a location alone cannot tell one shop from another. Three here match the time and the amount, so the answer changes which habit this belongs to.',
    he: 'המיקום שלך ממקם אותך בקניון הזה, אבל מיקום לבדו לא יכול להבחין בין חנות לחנות. שלוש כאן מתאימות לשעה ולסכום, ולכן התשובה קובעת לאיזה הרגל זה שייך.',
  },
  'inbox.resolving': { en: 'Filing it…', he: 'מתייק…' },
  'inbox.resolved': { en: 'Filed to {merchant}', he: 'תויק ל{merchant}' },
  'inbox.allClear': { en: 'Everything is up to date', he: 'הכול מעודכן' },
  'inbox.allClearBody': {
    en: 'Nothing needs your attention. You will only hear from this screen when an answer would actually change something.',
    he: 'שום דבר לא דורש את תשומת לבך. תשמע מהמסך הזה רק כשתשובה באמת תשנה משהו.',
  },

  // -- Profile ---------------------------------------------------------------
  'profile.title': { en: 'Profile', he: 'פרופיל' },
  'profile.history': { en: 'Purchase history', he: 'היסטוריית רכישות' },
  'profile.frequent': { en: 'Frequent places', he: 'מקומות תכופים' },
  'profile.categories': { en: 'Categories', he: 'קטגוריות' },
  'profile.preferences': { en: 'Preferences', he: 'העדפות' },
  'profile.privacy': { en: 'Privacy', he: 'פרטיות' },
  'profile.integrations': { en: 'Automatic sources', he: 'מקורות אוטומטיים' },
  'profile.integrationsBody': {
    en: 'All optional. None is required for the product to work, and none is connected in this demo.',
    he: 'הכול אופציונלי. אף אחד אינו נדרש כדי שהמוצר יעבוד, ואף אחד אינו מחובר בהדגמה זו.',
  },
  'profile.bank': { en: 'Card or bank feed', he: 'הזנת כרטיס או בנק' },
  'profile.email': { en: 'Email receipts', he: 'קבלות במייל' },
  'profile.sms': { en: 'Message receipts', he: 'קבלות בהודעות' },
  'profile.language': { en: 'Language', he: 'שפה' },
  'profile.locationUse': { en: 'How location is used', he: 'איך נעשה שימוש במיקום' },
  'profile.locationBody': {
    en: 'Location is treated as evidence, never as proof. It narrows down where a purchase happened; it never decides on its own.',
    he: 'מיקום נחשב לראיה, לעולם לא להוכחה. הוא מצמצם היכן בוצעה רכישה; הוא לעולם לא מכריע לבדו.',
  },
  'profile.dataUse': { en: 'What is stored', he: 'מה נשמר' },
  'profile.dataBody': {
    en: 'In this demo, everything lives in your browser tab and disappears when you close it.',
    he: 'בהדגמה זו, הכול נמצא בלשונית הדפדפן ונעלם עם סגירתה.',
  },
  'profile.spentAll': { en: 'Total spent', he: 'סך ההוצאות' },
  'profile.since': { en: 'since {from}', he: 'מאז {from}' },

  // -- Purchase detail -------------------------------------------------------
  'purchase.title': { en: 'Purchase', he: 'רכישה' },
  'purchase.items': { en: 'Items', he: 'פריטים' },
  'purchase.subtotal': { en: 'Subtotal', he: 'סכום ביניים' },
  'purchase.deposit': { en: 'Bottle deposit', he: 'פיקדון בקבוקים' },
  'purchase.discount': { en: 'Discount', he: 'הנחה' },
  'purchase.total': { en: 'Total', he: 'סה״כ' },
  'purchase.noItems': { en: 'No itemised receipt', he: 'אין פירוט פריטים' },
  'purchase.noItemsBody': {
    en: 'This one arrived as a card amount. Scanning the receipt would fill in the items.',
    he: 'רכישה זו הגיעה כסכום מכרטיס. סריקת הקבלה תשלים את הפריטים.',
  },
  'purchase.insight': { en: 'About {amount} less nearby', he: 'כ־{amount} פחות בקרבת מקום' },
  'purchase.insightBody': {
    en: 'A comparable basket at {alt}, {min} minutes further on.',
    he: 'סל דומה ב{alt}, {min} דקות נוספות.',
  },
  'purchase.noInsight': { en: 'Nothing worth flagging here', he: 'אין כאן דבר שדורש התייחסות' },
  'purchase.noInsightBody': {
    en: 'No nearby alternative would have made a meaningful difference on this one.',
    he: 'שום חלופה קרובה לא הייתה משנה משמעותית ברכישה זו.',
  },
  'purchase.source': { en: 'Added by', he: 'נוסף באמצעות' },
  'src.receipt_photo': { en: 'Receipt photo', he: 'צילום קבלה' },
  'src.product_photo': { en: 'Product photo', he: 'צילום מוצר' },
  'src.barcode': { en: 'Barcode', he: 'ברקוד' },
  'src.digital_receipt': { en: 'Digital receipt', he: 'קבלה דיגיטלית' },
  'src.quick_add': { en: 'Quick add', he: 'הוספה מהירה' },
  'src.card_feed': { en: 'Card feed', he: 'הזנת כרטיס' },

  // -- Merchant detail -------------------------------------------------------
  'merchant.title': { en: 'Place', he: 'מקום' },
  'merchant.visits': { en: 'Visits', he: 'ביקורים' },
  'merchant.spend': { en: 'Total spend', he: 'סך הוצאה' },
  'merchant.avg': { en: 'Average visit', he: 'ממוצע לביקור' },
  'merchant.every': { en: 'about every {n} days', he: 'כל {n} ימים בערך' },
  'merchant.frequent': { en: 'What you usually buy', he: 'מה אתה בדרך כלל קונה' },
  'merchant.times': { en: '{n}x', he: '{n} פעמים' },
  'merchant.history': { en: 'Visits', he: 'ביקורים' },
  'merchant.savingBanner': { en: 'About {amount} a month', he: 'כ־{amount} בחודש' },
  'merchant.savingBannerBody': {
    en: 'if this basket came from {alt} instead',
    he: 'אם הסל הזה היה מגיע מ{alt} במקום',
  },

  // -- Comparison ------------------------------------------------------------
  'compare.title': { en: 'Same basket, two stores', he: 'אותו סל, שתי חנויות' },
  'compare.yourStore': { en: 'Where you shop', he: 'איפה שאתה קונה' },
  'compare.alternative': { en: 'The alternative', he: 'החלופה' },
  'compare.basketCost': { en: 'Basket', he: 'סל' },
  'compare.drive': { en: '{km} km · {min} min', he: '{km} ק״מ · {min} דק׳' },
  'compare.addedTime': { en: '{min} min further', he: '{min} דק׳ יותר' },
  'compare.perBasket': { en: 'Per basket', he: 'לסל' },
  'compare.perMonthGross': { en: 'Over a month', he: 'לאורך חודש' },
  'compare.transport': { en: 'Less the extra driving', he: 'בניכוי הנסיעה הנוספת' },
  'compare.net': { en: 'What is actually left', he: 'מה באמת נשאר' },
  'compare.frequency': {
    en: 'You shop here about {n} times a month.',
    he: 'אתה קונה כאן בערך {n} פעמים בחודש.',
  },
  'compare.itemsTitle': { en: 'Where the difference comes from', he: 'מהיכן נובע ההפרש' },
  'compare.equivTitle': { en: 'What counts as the same thing', he: 'מה נחשב לאותו דבר' },
  'compare.accepted': { en: 'Swapped', he: 'הוחלף' },
  'compare.refused': { en: 'Not swapped', he: 'לא הוחלף' },
  'compare.oneStore': {
    en: 'One basket, one store. We do not send you to three shops to save a few shekels.',
    he: 'סל אחד, חנות אחת. לא נשלח אותך לשלוש חנויות כדי לחסוך כמה שקלים.',
  },
  'compare.routeNote': {
    en: 'Distances and times are illustrative in this demo.',
    he: 'מרחקים וזמנים בהדגמה זו הם להמחשה בלבד.',
  },

  // -- Likely needed ---------------------------------------------------------
  'needed.title': { en: 'Likely needed soon', he: 'כנראה תצטרך בקרוב' },
  'needed.subtitle': {
    en: 'Worked out from how often you actually buy these. Not a list you have to keep.',
    he: 'מחושב לפי התדירות שבה אתה קונה אותם בפועל. לא רשימה שאתה צריך לתחזק.',
  },
  'needed.every': { en: 'about every {n} days', he: 'כל {n} ימים בערך' },
  'needed.lastBought': { en: 'last bought {n} days ago', he: 'נקנה לאחרונה לפני {n} ימים' },
  'needed.due': { en: 'Due', he: 'עומד להיגמר' },
  'needed.overdue': { en: 'Overdue', he: 'עבר הזמן' },
  'needed.empty': { en: 'Nothing is due right now', he: 'שום דבר לא עומד להיגמר כרגע' },
  'needed.dismissed': { en: 'Dismissed', he: 'נדחה' },
} satisfies Record<string, Localized>

export type StringKey = keyof typeof strings
