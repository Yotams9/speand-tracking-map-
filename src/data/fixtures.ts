/**
 * ============================================================================
 *  CANONICAL SYNTHETIC FIXTURES — Phase 1 concept demo
 * ============================================================================
 *
 *  Everything in this file is INVENTED. There is no real person, account,
 *  receipt, bank feed, card feed, location history, or price source behind any
 *  value here. Merchant names are fictional so that no fabricated price is ever
 *  attached to a real business. Coordinates point at public commercial areas
 *  and landmarks, never at a residence.
 *
 *  This file is the single source of truth for the demo. Screens must not
 *  hard-code a total, an average, a visit count, a trend, or a saving —
 *  those are computed in `derive.ts` from what is written here, and
 *  `audit.ts` re-checks the arithmetic on every dev boot.
 *
 *  Two kinds of value live here:
 *
 *    DERIVED SOURCE   line items, quantities, prices, timestamps. Everything
 *                     the UI shows about money and frequency is computed from
 *                     these.
 *
 *    STORED ESTIMATE  route distances and durations, and the per-trip transport
 *                     cost. Phase 1 has no routing engine and an LLM may never
 *                     be the source of a distance or a travel time, so these
 *                     are declared constants. They are reported as stored
 *                     estimates in the handoff and labelled in the UI.
 * ============================================================================
 */

import type { Fixtures } from './types'

/** Fixed so that "Yesterday" and "4 days ago" never drift as real time passes. */
const DEMO_TODAY = '2026-08-24'

export const fixtures: Fixtures = {
  synthetic: true,
  generatedFor: 'phase-1-concept-demo',
  demoToday: DEMO_TODAY,

  user: {
    displayName: { en: 'Demo User', he: 'משתמש הדגמה' },
    homeAreaLabel: { en: 'Central Tel Aviv', he: 'מרכז תל אביב' },
    currency: 'ILS',
    locale: 'en-IL',
  },

  // --------------------------------------------------------------------------
  // Geographic clusters
  // --------------------------------------------------------------------------
  clusters: [
    { id: 'c_tlv', name: { en: 'Tel Aviv', he: 'תל אביב' }, center: [34.7818, 32.0853] },
    { id: 'c_ptk', name: { en: 'Petah Tikva', he: 'פתח תקווה' }, center: [34.8878, 32.084] },
    { id: 'c_hrz', name: { en: 'Herzliya', he: 'הרצליה' }, center: [34.8447, 32.1624] },
  ],

  // --------------------------------------------------------------------------
  // Merchants — all fictional
  // --------------------------------------------------------------------------
  merchants: [
    {
      id: 'm_shuk',
      name: { en: 'Shuk Express', he: 'שוק אקספרס' },
      branch: null,
      category: 'groceries',
      clusterId: 'c_tlv',
      coord: [34.7735, 32.0748],
      address: { en: 'Bograshov St, Tel Aviv', he: 'בוגרשוב, תל אביב' },
    },
    {
      id: 'm_rimon',
      name: { en: 'Rimon Market', he: 'רימון מרקט' },
      branch: null,
      category: 'groceries',
      clusterId: 'c_tlv',
      coord: [34.7925, 32.0869],
      address: { en: 'Ibn Gabirol St, Tel Aviv', he: 'אבן גבירול, תל אביב' },
    },
    {
      id: 'm_nomi_tlv',
      name: { en: 'Cafe Nomi', he: 'קפה נומי' },
      branch: { en: 'Dizengoff', he: 'דיזנגוף' },
      category: 'food',
      clusterId: 'c_tlv',
      coord: [34.7745, 32.081],
      address: { en: 'Dizengoff St, Tel Aviv', he: 'דיזנגוף, תל אביב' },
    },
    // --- The three candidates inside Almog Mall. They sit within ~40 m of one
    // --- another, which is exactly why proximity alone cannot resolve a
    // --- purchase made here.
    {
      id: 'm_nomi_almog',
      name: { en: 'Cafe Nomi', he: 'קפה נומי' },
      branch: { en: 'Almog Mall', he: 'קניון אלמוג' },
      category: 'food',
      clusterId: 'c_ptk',
      coord: [34.88295, 32.08847],
      address: { en: 'Almog Mall, Level 1, Petah Tikva', he: 'קניון אלמוג, קומה 1, פתח תקווה' },
    },
    {
      id: 'm_burger_lin',
      name: { en: 'Burger Lin', he: 'בורגר לין' },
      branch: { en: 'Almog Mall', he: 'קניון אלמוג' },
      category: 'food',
      clusterId: 'c_ptk',
      coord: [34.883, 32.0885],
      address: { en: 'Almog Mall, Level 2, Petah Tikva', he: 'קניון אלמוג, קומה 2, פתח תקווה' },
    },
    {
      id: 'm_sushi_tao',
      name: { en: 'Sushi Tao', he: 'סושי טאו' },
      branch: { en: 'Almog Mall', he: 'קניון אלמוג' },
      category: 'food',
      clusterId: 'c_ptk',
      coord: [34.88308, 32.08853],
      address: { en: 'Almog Mall, Level 2, Petah Tikva', he: 'קניון אלמוג, קומה 2, פתח תקווה' },
    },
    {
      id: 'm_pharm_plus',
      name: { en: 'Pharm Plus', he: 'פארם פלוס' },
      branch: null,
      category: 'pharmacy',
      clusterId: 'c_hrz',
      coord: [34.844, 32.163],
      address: { en: 'Sokolov St, Herzliya', he: 'סוקולוב, הרצליה' },
    },
    {
      id: 'm_alfa_fuel',
      name: { en: 'Alfa Fuel', he: 'אלפא דלק' },
      branch: null,
      category: 'fuel',
      clusterId: 'c_tlv',
      coord: [34.802, 32.09],
      address: { en: 'Namir Rd, Tel Aviv', he: 'דרך נמיר, תל אביב' },
    },
    {
      id: 'm_urban_style',
      name: { en: 'Urban Style', he: 'אורבן סטייל' },
      branch: null,
      category: 'shopping',
      clusterId: 'c_hrz',
      coord: [34.8425, 32.1655],
      address: { en: 'Ben Gurion St, Herzliya', he: 'בן גוריון, הרצליה' },
    },
  ],

  // --------------------------------------------------------------------------
  // Products
  //
  // `equivalenceGroup` is what permits a substitution in a basket comparison.
  // Note that `p_cola` and `p_cola_zero` sit in DIFFERENT groups. They are the
  // same brand, the same size, and the same shelf — but zero-sugar is not a
  // substitute for regular, and the comparison engine must never treat them as
  // interchangeable to manufacture a larger saving.
  // --------------------------------------------------------------------------
  products: [
    { id: 'p_milk', name: { en: 'Milk 3%', he: 'חלב 3%' }, unit: { en: '1 L', he: '1 ליטר' }, category: 'groceries', equivalenceGroup: 'g_milk_3pct_1l' },
    { id: 'p_milk_alt', name: { en: 'Milk 3% · Meadow', he: 'חלב 3% · מדו' }, unit: { en: '1 L', he: '1 ליטר' }, category: 'groceries', equivalenceGroup: 'g_milk_3pct_1l' },
    { id: 'p_bread', name: { en: 'Whole Wheat Bread', he: 'לחם מלא' }, unit: { en: '750 g', he: '750 גרם' }, category: 'groceries', equivalenceGroup: 'g_bread_ww_750' },
    { id: 'p_eggs', name: { en: 'Eggs, Large', he: 'ביצים L' }, unit: { en: '12 pcs', he: '12 יח׳' }, category: 'groceries', equivalenceGroup: 'g_eggs_l_12' },
    { id: 'p_chicken', name: { en: 'Chicken Breast', he: 'חזה עוף' }, unit: { en: '1 kg', he: '1 ק״ג' }, category: 'groceries', equivalenceGroup: 'g_chicken_breast_1kg' },
    { id: 'p_tomato', name: { en: 'Tomatoes', he: 'עגבניות' }, unit: { en: '1 kg', he: '1 ק״ג' }, category: 'groceries', equivalenceGroup: 'g_tomato_1kg' },
    { id: 'p_cucumber', name: { en: 'Cucumbers', he: 'מלפפונים' }, unit: { en: '1 kg', he: '1 ק״ג' }, category: 'groceries', equivalenceGroup: 'g_cucumber_1kg' },
    { id: 'p_yogurt', name: { en: 'Yogurt 5%', he: 'יוגורט 5%' }, unit: { en: '200 g', he: '200 גרם' }, category: 'groceries', equivalenceGroup: 'g_yogurt_5_200' },
    { id: 'p_rice', name: { en: 'Rice', he: 'אורז' }, unit: { en: '1 kg', he: '1 ק״ג' }, category: 'groceries', equivalenceGroup: 'g_rice_1kg' },
    { id: 'p_oliveoil', name: { en: 'Olive Oil', he: 'שמן זית' }, unit: { en: '750 ml', he: '750 מ״ל' }, category: 'groceries', equivalenceGroup: 'g_oliveoil_750' },
    { id: 'p_coffee', name: { en: 'Ground Coffee', he: 'קפה טחון' }, unit: { en: '200 g', he: '200 גרם' }, category: 'groceries', equivalenceGroup: 'g_coffee_200' },
    { id: 'p_cola', name: { en: 'Cola', he: 'קולה' }, unit: { en: '1.5 L', he: '1.5 ליטר' }, category: 'groceries', equivalenceGroup: 'g_cola_regular_1500' },
    { id: 'p_cola_zero', name: { en: 'Cola Zero', he: 'קולה זירו' }, unit: { en: '1.5 L', he: '1.5 ליטר' }, category: 'groceries', equivalenceGroup: 'g_cola_zero_1500' },
    { id: 'p_paper', name: { en: 'Paper Towels', he: 'מגבות נייר' }, unit: { en: '4 rolls', he: '4 גלילים' }, category: 'groceries', equivalenceGroup: 'g_paper_towels_4' },
    { id: 'p_dish', name: { en: 'Dish Soap', he: 'נוזל כלים' }, unit: { en: '750 ml', he: '750 מ״ל' }, category: 'groceries', equivalenceGroup: 'g_dish_750' },
    { id: 'p_pasta', name: { en: 'Pasta', he: 'פסטה' }, unit: { en: '500 g', he: '500 גרם' }, category: 'groceries', equivalenceGroup: 'g_pasta_500' },
    { id: 'p_latte', name: { en: 'Latte', he: 'לאטה' }, unit: { en: 'Large', he: 'גדול' }, category: 'food', equivalenceGroup: 'g_latte' },
    { id: 'p_croissant', name: { en: 'Butter Croissant', he: 'קרואסון חמאה' }, unit: { en: '1 pc', he: '1 יח׳' }, category: 'food', equivalenceGroup: 'g_croissant' },
    { id: 'p_burger', name: { en: 'Burger Meal', he: 'ארוחת המבורגר' }, unit: { en: '1 pc', he: '1 יח׳' }, category: 'food', equivalenceGroup: 'g_burger_meal' },
    { id: 'p_shampoo', name: { en: 'Shampoo', he: 'שמפו' }, unit: { en: '400 ml', he: '400 מ״ל' }, category: 'pharmacy', equivalenceGroup: 'g_shampoo_400' },
    { id: 'p_vitc', name: { en: 'Vitamin C', he: 'ויטמין C' }, unit: { en: '60 tabs', he: '60 טבליות' }, category: 'pharmacy', equivalenceGroup: 'g_vitc_60' },
    { id: 'p_tshirt', name: { en: 'T-Shirt', he: 'חולצת טי' }, unit: { en: '1 pc', he: '1 יח׳' }, category: 'shopping', equivalenceGroup: 'g_tshirt' },
    { id: 'p_jeans', name: { en: 'Jeans', he: 'ג׳ינס' }, unit: { en: '1 pc', he: '1 יח׳' }, category: 'shopping', equivalenceGroup: 'g_jeans' },
  ],

  // --------------------------------------------------------------------------
  // Prices, in ILS, per merchant per product.
  //
  // Deliberate gaps: Rimon Market does not stock `p_milk`, only `p_milk_alt`.
  // That forces the basket comparison to go through the equivalence mechanism
  // rather than matching identical SKUs, which is the realistic case.
  //
  // Also deliberate: Rimon prices `p_cola_zero` BELOW `p_cola`. A comparison
  // that was optimising for a big headline number would swap them. This one
  // refuses, and shows the refusal.
  // --------------------------------------------------------------------------
  prices: {
    m_shuk: {
      p_milk: 7.9, p_bread: 12.5, p_eggs: 16.9, p_chicken: 42.9,
      p_tomato: 9.9, p_cucumber: 7.5, p_yogurt: 4.2, p_rice: 13.9,
      p_oliveoil: 38.9, p_coffee: 27.9, p_cola: 8.4, p_cola_zero: 8.4,
      p_paper: 23.9, p_dish: 14.9, p_pasta: 6.9,
    },
    m_rimon: {
      p_milk_alt: 6.6, p_bread: 10.9, p_eggs: 14.5, p_chicken: 35.4,
      p_tomato: 8.4, p_cucumber: 6.9, p_yogurt: 3.6, p_rice: 11.9,
      p_oliveoil: 33.9, p_coffee: 24.9, p_cola: 7.2, p_cola_zero: 6.2,
      p_paper: 20.9, p_dish: 12.4, p_pasta: 5.9,
    },
    m_nomi_tlv: { p_latte: 14.0, p_croissant: 12.0 },
    m_nomi_almog: { p_latte: 15.0, p_croissant: 13.0 },
    m_burger_lin: { p_burger: 58.0 },
    m_sushi_tao: { p_burger: 62.0 },
    m_pharm_plus: { p_shampoo: 32.9, p_vitc: 45.9 },
    m_urban_style: { p_tshirt: 79.0, p_jeans: 199.0 },
    m_alfa_fuel: {},
  },

  // --------------------------------------------------------------------------
  // Purchases — 31 records across ~3 months.
  //
  // Totals are NOT stored. Each total is computed as:
  //     sum(qty x unit price at that merchant) - discount + deposit
  // `deposit` is the refundable container charge: ILS 0.30 per cola bottle.
  // --------------------------------------------------------------------------
  purchases: [
    // ---- Shuk Express: the recurring Thursday-evening grocery run (14 visits)
    { id: 'pu_g01', merchantId: 'm_shuk', timestamp: '2026-08-20T18:52', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_rice', qty: 1 }, { productId: 'p_oliveoil', qty: 1 }, { productId: 'p_coffee', qty: 1 }, { productId: 'p_cola', qty: 2 } ] },
    { id: 'pu_g02', merchantId: 'm_shuk', timestamp: '2026-08-13T19:05', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_cola', qty: 2 } ] },
    { id: 'pu_g03', merchantId: 'm_shuk', timestamp: '2026-08-06T18:41', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.3,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_coffee', qty: 1 }, { productId: 'p_cola', qty: 1 } ] },
    { id: 'pu_g04', merchantId: 'm_shuk', timestamp: '2026-07-30T19:18', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_rice', qty: 1 }, { productId: 'p_coffee', qty: 1 }, { productId: 'p_cola', qty: 2 }, { productId: 'p_paper', qty: 1 }, { productId: 'p_pasta', qty: 2 } ] },
    { id: 'pu_g05', merchantId: 'm_shuk', timestamp: '2026-07-23T18:33', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_cola', qty: 2 } ] },
    { id: 'pu_g06', merchantId: 'm_shuk', timestamp: '2026-07-16T19:02', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_rice', qty: 1 }, { productId: 'p_coffee', qty: 1 }, { productId: 'p_cola', qty: 2 }, { productId: 'p_dish', qty: 1 } ] },
    { id: 'pu_g07', merchantId: 'm_shuk', timestamp: '2026-07-09T18:47', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_chicken', qty: 2 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_oliveoil', qty: 1 }, { productId: 'p_coffee', qty: 1 }, { productId: 'p_cola', qty: 2 }, { productId: 'p_pasta', qty: 2 } ] },
    { id: 'pu_g08', merchantId: 'm_shuk', timestamp: '2026-07-02T19:11', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_cola', qty: 2 }, { productId: 'p_paper', qty: 1 } ] },
    { id: 'pu_g09', merchantId: 'm_shuk', timestamp: '2026-06-25T18:58', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_coffee', qty: 1 }, { productId: 'p_cola', qty: 2 } ] },
    { id: 'pu_g10', merchantId: 'm_shuk', timestamp: '2026-06-18T19:24', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_rice', qty: 1 }, { productId: 'p_cola', qty: 2 }, { productId: 'p_pasta', qty: 2 } ] },
    { id: 'pu_g11', merchantId: 'm_shuk', timestamp: '2026-06-11T18:36', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_rice', qty: 1 }, { productId: 'p_coffee', qty: 1 }, { productId: 'p_cola', qty: 2 }, { productId: 'p_dish', qty: 1 } ] },
    { id: 'pu_g12', merchantId: 'm_shuk', timestamp: '2026-06-04T19:07', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_coffee', qty: 1 }, { productId: 'p_cola', qty: 2 }, { productId: 'p_paper', qty: 1 } ] },
    { id: 'pu_g13', merchantId: 'm_shuk', timestamp: '2026-05-28T18:44', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_cola', qty: 2 } ] },
    { id: 'pu_g14', merchantId: 'm_shuk', timestamp: '2026-05-21T18:55', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.6,
      items: [ { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 }, { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 }, { productId: 'p_yogurt', qty: 4 }, { productId: 'p_rice', qty: 1 }, { productId: 'p_oliveoil', qty: 1 }, { productId: 'p_coffee', qty: 1 }, { productId: 'p_cola', qty: 2 } ] },

    // ---- Cafe Nomi, Dizengoff: a Tuesday-morning habit (6 visits)
    { id: 'pu_c01', merchantId: 'm_nomi_tlv', timestamp: '2026-08-18T08:14', captureSource: 'digital_receipt', matchState: 'confirmed', items: [ { productId: 'p_latte', qty: 1 }, { productId: 'p_croissant', qty: 1 } ] },
    { id: 'pu_c02', merchantId: 'm_nomi_tlv', timestamp: '2026-08-11T08:22', captureSource: 'digital_receipt', matchState: 'confirmed', items: [ { productId: 'p_latte', qty: 1 } ] },
    { id: 'pu_c03', merchantId: 'm_nomi_tlv', timestamp: '2026-08-04T08:09', captureSource: 'digital_receipt', matchState: 'confirmed', items: [ { productId: 'p_latte', qty: 1 }, { productId: 'p_croissant', qty: 1 } ] },
    { id: 'pu_c04', merchantId: 'm_nomi_tlv', timestamp: '2026-07-28T08:31', captureSource: 'digital_receipt', matchState: 'confirmed', items: [ { productId: 'p_latte', qty: 1 } ] },
    { id: 'pu_c05', merchantId: 'm_nomi_tlv', timestamp: '2026-07-21T08:17', captureSource: 'digital_receipt', matchState: 'confirmed', items: [ { productId: 'p_latte', qty: 1 }, { productId: 'p_croissant', qty: 1 } ] },
    { id: 'pu_c06', merchantId: 'm_nomi_tlv', timestamp: '2026-07-14T08:26', captureSource: 'digital_receipt', matchState: 'confirmed', items: [ { productId: 'p_latte', qty: 1 } ] },

    // ---- The one prior visit to the alternative grocery store
    { id: 'pu_r01', merchantId: 'm_rimon', timestamp: '2026-07-05T11:40', captureSource: 'receipt_photo', matchState: 'confirmed', deposit: 0.3,
      items: [ { productId: 'p_milk_alt', qty: 1 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_cola', qty: 1 } ] },

    // ---- Occasional others
    { id: 'pu_b01', merchantId: 'm_burger_lin', timestamp: '2026-07-11T13:05', captureSource: 'quick_add', matchState: 'confirmed', items: [ { productId: 'p_burger', qty: 1 } ] },
    { id: 'pu_b02', merchantId: 'm_burger_lin', timestamp: '2026-06-13T13:42', captureSource: 'quick_add', matchState: 'confirmed', items: [ { productId: 'p_burger', qty: 1 } ] },
    { id: 'pu_p01', merchantId: 'm_pharm_plus', timestamp: '2026-08-09T16:20', captureSource: 'receipt_photo', matchState: 'confirmed', items: [ { productId: 'p_shampoo', qty: 1 }, { productId: 'p_vitc', qty: 1 } ] },
    { id: 'pu_p02', merchantId: 'm_pharm_plus', timestamp: '2026-06-28T17:05', captureSource: 'receipt_photo', matchState: 'confirmed', items: [ { productId: 'p_shampoo', qty: 1 } ] },
    { id: 'pu_u01', merchantId: 'm_urban_style', timestamp: '2026-08-08T15:30', captureSource: 'barcode', matchState: 'confirmed', items: [ { productId: 'p_tshirt', qty: 2 } ] },
    { id: 'pu_u02', merchantId: 'm_urban_style', timestamp: '2026-06-27T14:12', captureSource: 'barcode', matchState: 'confirmed', items: [ { productId: 'p_jeans', qty: 1 } ] },

    // ---- Fuel arrives from the optional card feed as an amount with no items.
    { id: 'pu_f01', merchantId: 'm_alfa_fuel', timestamp: '2026-08-15T09:12', captureSource: 'card_feed', matchState: 'confirmed', items: [], flatTotal: 264.0, rawMerchantString: 'ALFA FUEL 118 TEL AVIV' },
    { id: 'pu_f02', merchantId: 'm_alfa_fuel', timestamp: '2026-07-25T08:48', captureSource: 'card_feed', matchState: 'confirmed', items: [], flatTotal: 251.5, rawMerchantString: 'ALFA FUEL 118 TEL AVIV' },
    { id: 'pu_f03', merchantId: 'm_alfa_fuel', timestamp: '2026-06-20T10:03', captureSource: 'card_feed', matchState: 'confirmed', items: [], flatTotal: 238.9, rawMerchantString: 'ALFA FUEL 118 TEL AVIV' },

    // ---- THE AMBIGUOUS ONE.
    // A card amount, a timestamp, and a dwell inside a mall where three
    // plausible merchants sit within ~40 m. Proximity cannot settle it, and the
    // answer changes which habit this purchase belongs to — so it is worth
    // exactly one question.
    { id: 'pu_x01', merchantId: null, timestamp: '2026-08-23T13:24', captureSource: 'card_feed', matchState: 'ambiguous', items: [], flatTotal: 58.9, rawMerchantString: 'CARD PURCHASE 4821 PETAH TIKVA' },
  ],

  ambiguityCases: [
    {
      id: 'amb_01',
      purchaseId: 'pu_x01',
      candidateMerchantIds: ['m_nomi_almog', 'm_burger_lin', 'm_sushi_tao'],
      areaLabel: { en: 'Almog Mall, Petah Tikva', he: 'קניון אלמוג, פתח תקווה' },
      reason: {
        en: 'Three places here match the time and amount.',
        he: 'שלושה מקומות כאן מתאימים לשעה ולסכום.',
      },
    },
  ],

  // --------------------------------------------------------------------------
  // Route comparison.
  //
  // The two legs below are STORED MOCK ESTIMATES. Phase 1 has no routing engine
  // and must not invent a distance or a duration, so these are declared here
  // once, labelled in the UI, and listed in the handoff. Everything else about
  // this comparison — both basket prices, the per-basket difference, the
  // monthly figure, the transport offset — is computed from the price table.
  // --------------------------------------------------------------------------
  routeComparisons: [
    {
      id: 'rc_01',
      originLabel: { en: 'Rabin Square area', he: 'אזור כיכר רבין' },
      originCoord: [34.7806, 32.0809],
      currentMerchantId: 'm_shuk',
      alternativeMerchantId: 'm_rimon',
      currentLeg: {
        distanceKm: 2.4,
        durationMin: 8,
        path: [ [34.7806, 32.0809], [34.7788, 32.0791], [34.7762, 32.0771], [34.7735, 32.0748] ],
      },
      alternativeLeg: {
        distanceKm: 3.1,
        durationMin: 11,
        path: [ [34.7806, 32.0809], [34.7845, 32.0826], [34.7889, 32.0848], [34.7925, 32.0869] ],
      },
      transportCostPerTrip: 1.6,
      // The weekly basket, taken from the most recent grocery run.
      basket: [
        { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 },
        { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 },
        { productId: 'p_yogurt', qty: 4 }, { productId: 'p_rice', qty: 1 }, { productId: 'p_oliveoil', qty: 1 },
        { productId: 'p_coffee', qty: 1 }, { productId: 'p_cola', qty: 2 },
      ],
      substitutions: [
        {
          fromProductId: 'p_milk',
          toProductId: 'p_milk_alt',
          accepted: true,
          reason: {
            en: 'Same size, same 3% fat. Different brand only.',
            he: 'אותו גודל, אותם 3% שומן. רק מותג אחר.',
          },
        },
        {
          fromProductId: 'p_cola',
          toProductId: 'p_cola_zero',
          accepted: false,
          reason: {
            en: 'Zero-sugar is a different drink, not a cheaper version of this one. Priced the regular one.',
            he: 'זירו הוא משקה אחר, לא גרסה זולה יותר. תומחר המשקה הרגיל.',
          },
        },
      ],
    },
  ],

  recommendations: [
    { id: 'rec_saving', kind: 'recurring_saving', routeComparisonId: 'rc_01', merchantId: 'm_shuk' },
    { id: 'rec_habit', kind: 'habit', merchantId: 'm_nomi_tlv' },
    {
      id: 'rec_proactive',
      kind: 'proactive',
      routeComparisonId: 'rc_01',
      merchantId: 'm_shuk',
      predictedWeekday: 4, // Thursday
      predictedTimeLabel: { en: 'evening', he: 'בערב' },
      // The weekly basket plus the three items that are due again by then.
      predictedBasket: [
        { productId: 'p_milk', qty: 2 }, { productId: 'p_bread', qty: 1 }, { productId: 'p_eggs', qty: 1 },
        { productId: 'p_chicken', qty: 1 }, { productId: 'p_tomato', qty: 1 }, { productId: 'p_cucumber', qty: 1 },
        { productId: 'p_yogurt', qty: 4 }, { productId: 'p_rice', qty: 1 }, { productId: 'p_oliveoil', qty: 1 },
        { productId: 'p_coffee', qty: 1 }, { productId: 'p_cola', qty: 2 },
        { productId: 'p_paper', qty: 1 }, { productId: 'p_dish', qty: 1 }, { productId: 'p_pasta', qty: 2 },
      ],
    },
    { id: 'rec_trend', kind: 'category_trend' },
    { id: 'rec_needed', kind: 'likely_needed' },
  ],

  // --------------------------------------------------------------------------
  // Abstract basemap geometry, hand-authored in [lon, lat].
  //
  // This is a stylised impression of the Tel Aviv coastal strip, not survey
  // data. It exists to give the map a legible sense of place — sea on the west,
  // the river running east, park masses, a few arterial lines — without pulling
  // in a tile provider, an API key, or a network dependency.
  // --------------------------------------------------------------------------
  basemap: {
    coast: [
      [34.72, 31.95], [34.735, 32.0], [34.745, 32.05], [34.758, 32.08],
      [34.766, 32.1], [34.775, 32.12], [34.784, 32.145], [34.79, 32.16],
      [34.8, 32.2], [34.815, 32.24], [34.835, 32.29], [34.855, 32.34],
    ],
    sea: [
      [34.72, 31.95], [34.735, 32.0], [34.745, 32.05], [34.758, 32.08],
      [34.766, 32.1], [34.775, 32.12], [34.784, 32.145], [34.79, 32.16],
      [34.8, 32.2], [34.815, 32.24], [34.835, 32.29], [34.855, 32.34],
      [34.6, 32.34], [34.6, 31.95],
    ],
    river: [
      [34.7745, 32.0985], [34.79, 32.1005], [34.81, 32.102], [34.835, 32.1045],
      [34.862, 32.106], [34.89, 32.1075],
    ],
    parks: [
      // Yarkon park mass
      [ [34.783, 32.0965], [34.812, 32.0975], [34.836, 32.099], [34.838, 32.106], [34.81, 32.1055], [34.782, 32.104] ],
      // Herzliya green strip
      [ [34.836, 32.157], [34.851, 32.1585], [34.8525, 32.1675], [34.8375, 32.166] ],
      // Petah Tikva green
      [ [34.876, 32.0775], [34.893, 32.0785], [34.894, 32.0865], [34.877, 32.0855] ],
    ],
    arterials: [
      // Ayalon corridor
      [ [34.7885, 32.0215], [34.7905, 32.05], [34.7925, 32.078], [34.7955, 32.105], [34.799, 32.128] ],
      // Coastal route north
      [ [34.7705, 32.086], [34.7785, 32.115], [34.7885, 32.142], [34.8025, 32.168], [34.8145, 32.192] ],
      // East-west link toward Petah Tikva
      [ [34.7815, 32.0865], [34.812, 32.0855], [34.845, 32.0848], [34.877, 32.0842], [34.9, 32.0838] ],
      // Herzliya connector
      [ [34.8025, 32.168], [34.8225, 32.1665], [34.8425, 32.1648] ],
    ],
  },
}
