/**
 * ============================================================================
 *  FIXTURE AUDIT
 * ============================================================================
 *
 *  Recomputes everything the fixtures claim and reports anything that does not
 *  reconcile. Runs once on boot in dev and prints to the console.
 *
 *  This is not a test framework and is not a substitute for looking at the
 *  screen. It exists because the one failure mode that visual QA cannot catch
 *  is a number that is wrong but plausible.
 * ============================================================================
 */

import { fixtures } from './fixtures'
import {
  DEPOSIT_PER_BOTTLE, compare, depositForBasket, getMerchant, getProduct,
  linesOf, merchantStats, priceOf, repurchaseFacts, round2, totalOf,
} from './derive'

export interface AuditIssue {
  severity: 'error' | 'warning' | 'note'
  area: string
  message: string
}

export function auditFixtures(): AuditIssue[] {
  const issues: AuditIssue[] = []
  const err = (area: string, message: string) => issues.push({ severity: 'error', area, message })
  const warn = (area: string, message: string) => issues.push({ severity: 'warning', area, message })
  const note = (area: string, message: string) => issues.push({ severity: 'note', area, message })

  // -- 1. Referential integrity ---------------------------------------------

  const clusterIds = new Set(fixtures.clusters.map((c) => c.id))
  for (const m of fixtures.merchants) {
    if (!clusterIds.has(m.clusterId)) err('merchants', `${m.id} points at unknown cluster ${m.clusterId}`)
  }

  const merchantIds = new Set(fixtures.merchants.map((m) => m.id))
  const productIds = new Set(fixtures.products.map((p) => p.id))

  for (const [merchantId, table] of Object.entries(fixtures.prices)) {
    if (!merchantIds.has(merchantId)) err('prices', `price table for unknown merchant ${merchantId}`)
    for (const productId of Object.keys(table)) {
      if (!productIds.has(productId)) err('prices', `${merchantId} prices unknown product ${productId}`)
    }
  }

  for (const p of fixtures.purchases) {
    if (p.merchantId && !merchantIds.has(p.merchantId)) {
      err('purchases', `${p.id} points at unknown merchant ${p.merchantId}`)
    }
    if (p.flatTotal !== undefined && p.items.length > 0) {
      err('purchases', `${p.id} has both a flat total and line items; one must win`)
    }
    if (p.flatTotal === undefined && p.items.length === 0) {
      err('purchases', `${p.id} has neither a flat total nor line items`)
    }
    if (p.matchState === 'ambiguous' && p.merchantId !== null) {
      err('purchases', `${p.id} is ambiguous but already attached to a merchant`)
    }
    for (const entry of p.items) {
      if (!productIds.has(entry.productId)) {
        err('purchases', `${p.id} references unknown product ${entry.productId}`)
      } else if (p.merchantId && priceOf(p.merchantId, entry.productId) === undefined) {
        err('purchases', `${p.id}: ${entry.productId} has no price at ${p.merchantId}`)
      }
      if (entry.qty <= 0) err('purchases', `${p.id}: non-positive quantity for ${entry.productId}`)
    }
  }

  // -- 2. Arithmetic ---------------------------------------------------------

  for (const p of fixtures.purchases) {
    if (p.flatTotal !== undefined) continue

    // Totals must equal the sum of their parts.
    const lines = linesOf(p)
    const recomputed = round2(
      lines.reduce((s, l) => s + l.lineTotal, 0) - (p.discount ?? 0) + (p.deposit ?? 0),
    )
    if (Math.abs(recomputed - totalOf(p)) > 0.005) {
      err('totals', `${p.id}: total ${totalOf(p)} does not equal recomputed ${recomputed}`)
    }
    if (lines.length !== p.items.length) {
      err('totals', `${p.id}: ${p.items.length - lines.length} line(s) dropped while pricing`)
    }

    // The stored deposit must match the single deposit rule.
    const expectedDeposit = depositForBasket(p.items)
    if (Math.abs(expectedDeposit - (p.deposit ?? 0)) > 0.005) {
      err(
        'deposit',
        `${p.id}: deposit ${p.deposit ?? 0} does not match the rule ` +
          `(${DEPOSIT_PER_BOTTLE}/bottle => ${expectedDeposit})`,
      )
    }
  }

  // -- 3. Dates --------------------------------------------------------------

  for (const p of fixtures.purchases) {
    const d = new Date(p.timestamp)
    if (Number.isNaN(d.getTime())) {
      err('dates', `${p.id}: unparseable timestamp ${p.timestamp}`)
      continue
    }
    if (p.timestamp.slice(0, 10) > fixtures.demoToday) {
      err('dates', `${p.id} is dated after the demo's today (${fixtures.demoToday})`)
    }
  }

  // -- 4. Product equivalence ------------------------------------------------
  //
  // The rule that keeps the product honest: a substitution may only be ACCEPTED
  // between two products in the same equivalence group. A refused substitution
  // must cross groups — otherwise it is not really a refusal.

  for (const rc of fixtures.routeComparisons) {
    for (const sub of rc.substitutions) {
      const from = getProduct(sub.fromProductId)
      const to = getProduct(sub.toProductId)
      if (!from || !to) {
        err('equivalence', `${rc.id}: substitution references an unknown product`)
        continue
      }
      const sameGroup = from.equivalenceGroup === to.equivalenceGroup
      if (sub.accepted && !sameGroup) {
        err(
          'equivalence',
          `${rc.id}: ACCEPTS ${from.id} -> ${to.id} across different equivalence groups`,
        )
      }
      if (!sub.accepted && sameGroup) {
        warn(
          'equivalence',
          `${rc.id}: refuses ${from.id} -> ${to.id} although they share a group`,
        )
      }
    }
  }

  // -- 5. Comparisons --------------------------------------------------------

  for (const rc of fixtures.routeComparisons) {
    const result = compare(rc.id)
    if (!result) {
      err('comparison', `${rc.id} could not be computed`)
      continue
    }

    if (result.current.basket.unavailable.length > 0) {
      err(
        'comparison',
        `${rc.id}: ${result.current.basket.unavailable.length} basket item(s) unpriced at the current store`,
      )
    }
    if (result.alternative.basket.unavailable.length > 0) {
      err(
        'comparison',
        `${rc.id}: ${result.alternative.basket.unavailable.map((p) => p.id).join(', ')} ` +
          `unavailable at the alternative; the saving would be overstated`,
      )
    }
    if (result.perBasketSaving <= 0) {
      warn('comparison', `${rc.id}: the alternative is not actually cheaper`)
    }
    if (result.addedTravelMin < 0) {
      warn('comparison', `${rc.id}: the alternative is closer, so "added travel" reads oddly`)
    }
    if (result.netMonthlySaving <= 0) {
      warn('comparison', `${rc.id}: transport wipes out the saving; this should not be recommended`)
    }

    // The recommendation must not split the basket across stores.
    const pricedAtAlt = result.alternative.basket.lines.length
    if (pricedAtAlt !== rc.basket.length) {
      err('comparison', `${rc.id}: only ${pricedAtAlt}/${rc.basket.length} items priced at one store`)
    }
  }

  // -- 6. Story coverage -----------------------------------------------------
  //
  // The demo has to be able to tell every story the brief asks for. If a
  // fixture edit quietly removes one, this is where it surfaces.

  const ambiguous = fixtures.purchases.filter((p) => p.matchState === 'ambiguous')
  if (ambiguous.length === 0) err('coverage', 'no ambiguous purchase, so Smart Inbox has nothing to resolve')

  for (const c of fixtures.ambiguityCases) {
    if (!fixtures.purchases.some((p) => p.id === c.purchaseId)) {
      err('coverage', `ambiguity case ${c.id} points at a missing purchase`)
    }
    if (c.candidateMerchantIds.length < 2) {
      err('coverage', `ambiguity case ${c.id} needs at least two candidates to be ambiguous`)
    }
    for (const id of c.candidateMerchantIds) {
      if (!getMerchant(id)) err('coverage', `ambiguity case ${c.id} lists unknown merchant ${id}`)
    }
  }

  const usedClusters = new Set(
    fixtures.merchants
      .filter((m) => fixtures.purchases.some((p) => p.merchantId === m.id))
      .map((m) => m.clusterId),
  )
  if (usedClusters.size < 2) err('coverage', 'purchases occupy fewer than two geographic clusters')

  const usedCategories = new Set(
    fixtures.merchants
      .filter((m) => fixtures.purchases.some((p) => p.merchantId === m.id))
      .map((m) => m.category),
  )
  if (usedCategories.size < 3) warn('coverage', `only ${usedCategories.size} categories have purchases`)

  if (fixtures.routeComparisons.length === 0) err('coverage', 'no route comparison')
  if (!fixtures.recommendations.some((r) => r.kind === 'proactive')) {
    err('coverage', 'no proactive recommendation')
  }
  if (!fixtures.recommendations.some((r) => r.kind === 'recurring_saving')) {
    err('coverage', 'no recurring-savings recommendation')
  }

  const due = repurchaseFacts().filter((f) => f.ratio >= 0.85)
  if (due.length === 0) warn('coverage', '"Likely needed soon" would be empty')

  const hasAcceptedSub = fixtures.routeComparisons.some((rc) => rc.substitutions.some((s) => s.accepted))
  const hasRefusedSub = fixtures.routeComparisons.some((rc) => rc.substitutions.some((s) => !s.accepted))
  if (!hasAcceptedSub) err('coverage', 'no valid product equivalent is demonstrated')
  if (!hasRefusedSub) err('coverage', 'no non-equivalent contrast is demonstrated')

  // -- 7. Orphans ------------------------------------------------------------

  for (const m of fixtures.merchants) {
    const isCandidate = fixtures.ambiguityCases.some((c) => c.candidateMerchantIds.includes(m.id))
    const stats = merchantStats(m.id)
    if ((stats?.visits ?? 0) === 0 && !isCandidate) {
      warn('orphans', `${m.id} has no purchases and is not an ambiguity candidate`)
    }
  }

  const referenced = new Set<string>()
  for (const p of fixtures.purchases) for (const e of p.items) referenced.add(e.productId)
  for (const rc of fixtures.routeComparisons) {
    for (const e of rc.basket) referenced.add(e.productId)
    for (const s of rc.substitutions) { referenced.add(s.fromProductId); referenced.add(s.toProductId) }
  }
  for (const r of fixtures.recommendations) {
    for (const e of r.predictedBasket ?? []) referenced.add(e.productId)
  }
  for (const p of fixtures.products) {
    if (!referenced.has(p.id)) warn('orphans', `product ${p.id} is never used`)
  }

  // -- 8. Values that are declared rather than derived ------------------------
  //
  // Reported every run so they can never quietly become invisible.

  for (const rc of fixtures.routeComparisons) {
    note(
      'stored-estimates',
      `${rc.id}: route legs (${rc.currentLeg.distanceKm} km / ${rc.currentLeg.durationMin} min vs ` +
        `${rc.alternativeLeg.distanceKm} km / ${rc.alternativeLeg.durationMin} min) and transport cost ` +
        `(${rc.transportCostPerTrip}/trip) are STORED MOCK ESTIMATES - Phase 1 has no routing engine`,
    )
  }

  return issues
}

/** Prints the audit once, on boot, in dev only. */
export function runAudit(): void {
  const issues = auditFixtures()
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const notes = issues.filter((i) => i.severity === 'note')

  const label = `fixture audit — ${errors.length} error(s), ${warnings.length} warning(s)`

  /* eslint-disable no-console */
  if (errors.length > 0) {
    console.group(`%c${label}`, 'color:#e5484d;font-weight:600')
    errors.forEach((i) => console.error(`[${i.area}] ${i.message}`))
    warnings.forEach((i) => console.warn(`[${i.area}] ${i.message}`))
    notes.forEach((i) => console.info(`[${i.area}] ${i.message}`))
    console.groupEnd()
    return
  }

  console.groupCollapsed(`%c${label}`, 'color:#1f9d55;font-weight:600')
  warnings.forEach((i) => console.warn(`[${i.area}] ${i.message}`))
  notes.forEach((i) => console.info(`[${i.area}] ${i.message}`))
  console.groupEnd()
  /* eslint-enable no-console */
}
