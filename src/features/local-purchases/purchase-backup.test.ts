import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { backupFixtureContext as context, fictionalBackupLedger } from '../../../qa/purchase-backup-fixtures'
import { blankReview, emptySessionLedger, saveReviewedPurchase } from '../capture/session-purchase-domain'
import { BACKUP_MAX_BYTES, exportPurchaseBackup, inspectPurchaseBackup } from './purchase-backup'
import { emptyLocalPurchases, emptyRestoreDestination } from './local-purchase-store'

// Independent signing helper lets rejection tests reach schema validation,
// rather than passing solely because the original checksum no longer matches.
const sorted = (v: any): any => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v
const seal = (v: any) => { v.checksum = createHash('sha256').update(JSON.stringify(sorted({ data: v.data, references: v.references }))).digest('hex'); return JSON.stringify(v) }

describe('strict local purchase backup', () => {
  it('round trips shared places, unresolved/online records, independent totals and original metadata', async () => {
    const source = fictionalBackupLedger(), before = structuredClone(source)
    const text = await exportPurchaseBackup(source, context), result = await inspectPurchaseBackup(text, context)
    expect(result).toMatchObject({ purchases: 4, merchants: 2, places: 1, unresolved: 1, historicalSynthetic: 0 })
    expect(result.data).toEqual(before); expect(source).toEqual(before)
    expect(text).toContain('חנות בדויה'); expect(text).toContain('מוצר בדוי')
    expect(result.data.records[0].purchase.originalAmount).toBe(12.4)
    expect(result.data.records[0].purchase.items[0].lineTotal).toBe(12.5)
    expect(result.data.directory.places[0].addressSearch).toEqual(before.directory.places[0].addressSearch)
    expect(result.data.records[2].purchase.placeId).toBeNull(); expect(result.data.records[2].purchase.resolution).toBe('unresolved')
    expect(result.data.records[3].purchase.fx.reportedBaseAmountIls).toBe(38)
  })
  it('supports empty backups and validates before exporting', async () => {
    expect((await inspectPurchaseBackup(await exportPurchaseBackup(emptyLocalPurchases(), context), context)).purchases).toBe(0)
    await expect(exportPurchaseBackup({ ...fictionalBackupLedger(), image: 'fictional-private-image' }, context)).rejects.toMatchObject({ code: 'invalid' })
  })
  it('detects malformed, unsupported, truncated, changed and oversized files', async () => {
    const text = await exportPurchaseBackup(fictionalBackupLedger(), context), raw = JSON.parse(text)
    await expect(inspectPurchaseBackup('{', context)).rejects.toMatchObject({ code: 'invalid' })
    await expect(inspectPurchaseBackup(JSON.stringify({ ...raw, version: 2 }), context)).rejects.toMatchObject({ code: 'unsupported' })
    await expect(inspectPurchaseBackup(text.slice(0, -15), context)).rejects.toMatchObject({ code: 'invalid' })
    raw.data.records[0].purchase.originalAmount = 123
    await expect(inspectPurchaseBackup(JSON.stringify(raw), context)).rejects.toMatchObject({ code: 'corrupted' })
    await expect(inspectPurchaseBackup(' '.repeat(BACKUP_MAX_BYTES + 1), context)).rejects.toMatchObject({ code: 'size' })
  })
  it('rejects complete but invalid facts despite a recomputed checksum, without partial salvage', async () => {
    const text = await exportPurchaseBackup(fictionalBackupLedger(), context)
    for (const mutate of [
      (v: any) => v.data.records[0].purchase.items[0].lineTotal = 999,
      (v: any) => v.data.records[0].purchase.timestamp = '2024-02-30T09:07:00.000Z',
      (v: any) => v.data.records.push(v.data.records[0]),
      (v: any) => v.data.directory.places[0].coordinates[0] = 181,
      (v: any) => v.data.directory.places[0].locationMethod = 'unknown',
      (v: any) => v.data.records[2].purchase.resolution = 'confirmed',
      (v: any) => v.data.records[0].evidence.label.en = 'forged provenance',
      (v: any) => v.data.records[0].credentials = 'synthetic-secret',
      (v: any) => v.data.diagnostics = { token: 'synthetic-secret' },
      (v: any) => v.data.temporaryMatches = { product: 'fictional' },
      (v: any) => v.references.merchants.push({ id: 'invented', name: { en: 'invented', he: 'invented' } }),
    ]) {
      const value = JSON.parse(text); mutate(value)
      await expect(inspectPurchaseBackup(seal(value), context)).rejects.toMatchObject({ code: 'invalid' })
    }
  })
  it('does not add address-search provenance to manual places', async () => {
    const source = fictionalBackupLedger(), place = source.directory.places[0]
    delete place.addressSearch; place.locationMethod = 'manual-coordinates'; place.address = ''
    const restored = await inspectPurchaseBackup(await exportPurchaseBackup(source, context), context)
    expect(restored.data.directory.places).toEqual(source.directory.places)
    expect(restored.data.directory.places[0]).not.toHaveProperty('addressSearch')
  })
  it('carries referenced legacy associations without promoting them to confirmed local metadata', async () => {
    const place = context.places[0]
    const ledger = saveReviewedPurchase(emptySessionLedger(), 'fictional-legacy', { ...blankReview(), source: 'manual', merchantId: place.merchantId, placeId: place.id, channel: 'physical', date: '2024-03-01T12:00', currency: 'ILS', payment: 'cash', category: 'groceries', amount: '7', lines: [] }, context, []).ledger
    const source = { version: 1, revision: 7, records: ledger.records, nextSequence: ledger.nextSequence, decisions: [] }
    const text = await exportPurchaseBackup(source, context), raw = JSON.parse(text), restored = await inspectPurchaseBackup(text, context)
    expect(raw.references.places).toEqual([place]); expect(raw.references.merchants).toHaveLength(1)
    expect(restored.data.directory.places).toEqual([]); expect(restored.data.records).toEqual(source.records)
    expect(raw.references.places[0]).not.toHaveProperty('locationMethod')
    const optionalContext = { ...context, merchants: context.merchants.map(m => ({ ...m, onlineOnly: undefined })) }
    const optionalText = await exportPurchaseBackup(source, optionalContext)
    expect((await inspectPurchaseBackup(optionalText, optionalContext)).data.records).toEqual(source.records)
    expect(JSON.parse(optionalText).references.merchants[0]).not.toHaveProperty('onlineOnly')
    const corrupted = JSON.parse(text); corrupted.references.places[0].coordinates[0] += 1
    await expect(inspectPurchaseBackup(seal(corrupted), context)).rejects.toMatchObject({ code: 'invalid' })
  })
  it('rejects future envelope versions and excessive nesting', async () => {
    const raw = JSON.parse(await exportPurchaseBackup(fictionalBackupLedger(), context)); raw.data.version = 5
    await expect(inspectPurchaseBackup(seal(raw), context)).rejects.toMatchObject({ code: 'unsupported' })
    let deep: any = {}; for (let i = 0; i < 40; i++) deep = { nested: deep }
    raw.data = deep
    await expect(inspectPurchaseBackup(seal(raw), context)).rejects.toMatchObject({ code: 'invalid' })
  })
  it('rejects duplicate or escaped-alias keys instead of silently dropping part of the file', async () => {
    const text = await exportPurchaseBackup(fictionalBackupLedger(), context)
    for (const prefix of ['"data": {"credentials":"synthetic-secret"},', '"d\\u0061ta": {},']) {
      await expect(inspectPurchaseBackup('{' + prefix + text.slice(1), context)).rejects.toMatchObject({ code: 'invalid' })
    }
    await expect(inspectPurchaseBackup(text.replace('"revision": 23', '"revision": 0, "revision": 23'), context)).rejects.toMatchObject({ code: 'invalid' })
    const rearranged = JSON.parse(text)
    expect((await inspectPurchaseBackup(JSON.stringify(sorted(rearranged)), context)).data).toEqual(fictionalBackupLedger())
  })
  it('empty means no records, directories or decisions; tombstone sequence/revision alone is allowed', () => {
    expect(emptyRestoreDestination({ ...emptyLocalPurchases(), revision: 42, nextSequence: 100 })).toBe(true)
    expect(emptyRestoreDestination(fictionalBackupLedger())).toBe(false)
    expect(emptyRestoreDestination({ ...emptyLocalPurchases(), decisions: [{ caseId: 'fictional', status: 'deferred' }] })).toBe(false)
  })
})
