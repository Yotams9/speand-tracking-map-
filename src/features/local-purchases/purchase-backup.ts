import type { SpendscapeDataSnapshot } from '../../data/spendscape-repository'
import { exactObject } from './local-structure'
import { validateLocalPurchases, type LocalPurchases } from './local-purchase-store'

// UTF-8 bytes, including the wrapper and referenced historical directory facts.
// Each ledger keeps its 2,000,000-character bound; v5 can carry both archives.
export const BACKUP_MAX_BYTES = 8 * 1024 * 1024
export type BackupErrorCode = 'unsupported' | 'invalid' | 'corrupted' | 'size' | 'not-empty' | 'conflict' | 'storage' | 'unavailable'
export class PurchaseBackupError extends Error {
  constructor(public readonly code: BackupErrorCode) { super(code) }
}
interface References {
  merchants: SpendscapeDataSnapshot['merchants']
  places: SpendscapeDataSnapshot['places']
}
interface BackupContent { data: LocalPurchases; references: References }
export interface BackupPreview {
  data: LocalPurchases
  purchases: number
  merchants: number
  places: number
  unresolved: number
  historicalSynthetic: number
}

function references(data: LocalPurchases, context: SpendscapeDataSnapshot): References {
  const allRecords = [...data.records, ...(data.legacyMain?.records ?? [])]
  const places = new Set(allRecords.map(r => r.purchase.placeId).filter(id => id !== null))
  for (const decision of data.decisions) if (decision.status === 'resolved') places.add(decision.placeId)
  const merchants = new Set(allRecords.map(r => r.purchase.merchantId))
  const legacyPlaces = context.places.filter(p => places.has(p.id) && !data.directory.places.some(local => local.id === p.id))
  for (const place of legacyPlaces) merchants.add(place.merchantId)
  // Carry referenced historical facts verbatim, without inventing confirmation
  // metadata or copying the historical purchase/catalog baseline into the app.
  // JSON has no undefined value. Optional absent metadata must be omitted in
  // both the checksum and the file, without assigning a confirmation default.
  return JSON.parse(JSON.stringify({
    merchants: context.merchants.filter(m => merchants.has(m.id) && !data.directory.merchants.some(local => local.id === m.id)),
    places: legacyPlaces,
  })) as References
}
function canonical(value: unknown, depth = 0): string {
  if (depth > 32) throw new PurchaseBackupError('invalid')
  if (Array.isArray(value)) return '[' + value.map(v => canonical(v, depth + 1)).join(',') + ']'
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k], depth + 1)).join(',') + '}'
  return JSON.stringify(value)
}
async function checksum(value: unknown): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(canonical(value))
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  } catch (error) {
    if (error instanceof PurchaseBackupError) throw error
    throw new PurchaseBackupError('unavailable')
  }
}
// JSON.parse establishes syntax, but silently keeps the last duplicate key.
// Inspect the original valid JSON token stream too; escaped aliases count as
// the same key. Otherwise an ignored first payload could escape validation.
function uniqueJsonKeys(text: string): void {
  let index = 0
  const space = () => { while (/\s/.test(text[index] ?? '') && index < text.length) index++ }
  const string = () => {
    const start = index++
    while (text[index] !== '"') index += text[index] === '\\' ? 2 : 1
    return JSON.parse(text.slice(start, ++index)) as string
  }
  const value = (depth: number): void => {
    if (depth > 32) throw new PurchaseBackupError('invalid')
    space()
    if (text[index] === '{') {
      index++; space(); const keys = new Set<string>()
      while (text[index] !== '}') {
        const key = string()
        if (keys.has(key) || keys.size >= 64) throw new PurchaseBackupError('invalid')
        keys.add(key); space(); index++; value(depth + 1); space()
        if (text[index] !== ',') break
        index++; space()
      }
      index++
    } else if (text[index] === '[') {
      index++; space()
      while (text[index] !== ']') { value(depth + 1); space(); if (text[index] !== ',') break; index++ }
      index++
    } else if (text[index] === '"') string()
    else while (index < text.length && !/[\s,}\]]/.test(text[index])) index++
  }
  value(0)
}
export async function exportPurchaseBackup(raw: unknown, context: SpendscapeDataSnapshot): Promise<string> {
  let data: LocalPurchases
  try { data = validateLocalPurchases(raw, context) } catch { throw new PurchaseBackupError('invalid') }
  const content: BackupContent = { data, references: references(data, context) }
  const result = JSON.stringify({ format: 'spendscape-purchase-backup', version: 1, ...content, checksum: await checksum(content) }, null, 2)
  if (new TextEncoder().encode(result).length > BACKUP_MAX_BYTES) throw new PurchaseBackupError('size')
  return result
}
export async function inspectPurchaseBackup(text: string, context: SpendscapeDataSnapshot): Promise<BackupPreview> {
  if (new TextEncoder().encode(text).length > BACKUP_MAX_BYTES) throw new PurchaseBackupError('size')
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new PurchaseBackupError('invalid') }
  uniqueJsonKeys(text)
  if (!raw || typeof raw !== 'object') throw new PurchaseBackupError('invalid')
  const candidate = raw as Record<string, unknown>
  if (candidate.format !== 'spendscape-purchase-backup' || candidate.version !== 1) throw new PurchaseBackupError('unsupported')
  if (!exactObject(raw, ['format', 'version', 'data', 'references', 'checksum']) || typeof raw.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(raw.checksum)) throw new PurchaseBackupError('invalid')
  const content = { data: raw.data, references: raw.references }
  if (await checksum(content) !== raw.checksum) throw new PurchaseBackupError('corrupted')
  const version = (raw.data as { version?: unknown } | null)?.version
  if (typeof version === 'number' && ![1, 2, 3, 4, 5].includes(version)) throw new PurchaseBackupError('unsupported')
  let data: LocalPurchases
  try { data = validateLocalPurchases(raw.data, context) } catch { throw new PurchaseBackupError('invalid') }
  const expected = references(data, context)
  if (canonical(raw.references) !== canonical(expected)) throw new PurchaseBackupError('invalid')
  return {
    data,
    purchases: data.records.length + (data.legacyMain?.records.length ?? 0),
    merchants: data.directory.merchants.length + expected.merchants.length + (data.legacyMain?.merchants?.length ?? 0),
    places: data.directory.places.length + expected.places.length + (data.legacyMain?.places?.length ?? 0),
    unresolved: [...data.records, ...(data.legacyMain?.records ?? [])].filter(r => r.purchase.channel !== 'online' && r.purchase.placeId === null).length,
    historicalSynthetic: [...data.records, ...(data.legacyMain?.records ?? [])].filter(r => r.synthetic).length,
  }
}
