import type { Merchant, Place, PurchaseCategory } from '../../data/spendscape-globe'

export interface LocalMerchant extends Merchant { source: 'user-confirmed' }
export interface LocalPlace extends Place { source: 'user-confirmed'; locationMethod: 'manual-coordinates'; address: string }
export interface LocalDirectory { merchants: readonly LocalMerchant[]; places: readonly LocalPlace[] }
export interface DirectoryIntent {
  merchant?: { name: string; category: PurchaseCategory | ''; separate: boolean }
  place?: { branch: string; city: string; country: string; address: string; longitude: string; latitude: string; confirmed: boolean; separate: boolean }
}
type Context = { merchants: readonly Merchant[]; places: readonly Place[] }
const categories = ['groceries', 'food', 'retail', 'travel']
export const emptyDirectory = (): LocalDirectory => ({ merchants: [], places: [] })
// Reject getters, sparse arrays, inherited values and unknown media/metadata.
export function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false
  const own = Reflect.ownKeys(value)
  return own.length === keys.length && keys.every(k => Object.hasOwn(value, k) && Object.hasOwn(Object.getOwnPropertyDescriptor(value, k)!, 'value')) && own.every(k => typeof k === 'string' && keys.includes(k))
}
export function denseArray(value: unknown, limit: number): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > limit || Reflect.ownKeys(value).length !== value.length + 1) return false
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, String(i))!, 'value')) return false
  return true
}
const text = (value: unknown, optional = false): value is string => typeof value === 'string' && value.length <= 100 && (optional || value.trim().length > 0) && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)
const localized = (value: unknown) => exactObject(value, ['en', 'he']) && text(value.en) && value.en === value.he
const suffix = (id: string, kind: 'merchant' | 'place') => { const m = new RegExp(`^local_${kind}_([1-9][0-9]*)$`).exec(id); return m ? Number(m[1]) : NaN }
const normalized = (s: string) => s.normalize('NFC').trim().toLocaleLowerCase()
function coordinate(value: unknown, limit: number): number | null {
  if (typeof value !== 'string' || !/^-?\d{1,3}(?:\.\d{1,8})?$/.test(value)) return null
  const n = Number(value); return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}
export function validDirectoryIntent(raw: unknown): raw is DirectoryIntent {
  if (!raw || typeof raw !== 'object') return false
  const keys = Object.keys(raw)
  if (!keys.length || !exactObject(raw, keys) || keys.some(k => !['merchant', 'place'].includes(k))) return false
  const d = raw as DirectoryIntent
  if (Object.hasOwn(d, 'merchant') && (!exactObject(d.merchant, ['name', 'category', 'separate']) || typeof d.merchant.name !== 'string' || typeof d.merchant.category !== 'string' || typeof d.merchant.separate !== 'boolean')) return false
  if (Object.hasOwn(d, 'place') && (!exactObject(d.place, ['branch', 'city', 'country', 'address', 'longitude', 'latitude', 'confirmed', 'separate']) || ['branch', 'city', 'country', 'address', 'longitude', 'latitude'].some(k => typeof d.place![k as keyof NonNullable<DirectoryIntent['place']>] !== 'string') || typeof d.place.confirmed !== 'boolean' || typeof d.place.separate !== 'boolean')) return false
  return true
}
export function proposeDirectory(intent: unknown, merchantId: string, channel: string, sequence: number, context: Context): { errors: Record<string, string>; directory: LocalDirectory; merchantId: string; placeId: string } {
  const errors: Record<string, string> = {}, directory = emptyDirectory()
  if (!validDirectoryIntent(intent) || !Number.isSafeInteger(sequence) || sequence < 1) return { errors: { directory: 'required' }, directory, merchantId, placeId: '' }
  const literal = (s: string) => ({ en: s, he: s })
  let merchant = context.merchants.find(m => m.id === merchantId)
  if (intent.merchant) {
    const m = intent.merchant
    if (!text(m.name)) errors.merchantName = 'required'
    if (!categories.includes(m.category)) errors.merchantCategory = 'required'
    if (!m.separate && text(m.name) && context.merchants.some(existing => [existing.name.en, existing.name.he].some(n => normalized(n) === normalized(m.name)))) errors.merchantSeparate = 'duplicate'
    merchantId = `local_merchant_${sequence}`
    if (context.merchants.some(m => m.id === merchantId)) errors.directory = 'required'
    merchant = { id: merchantId, name: literal(m.name), category: m.category as PurchaseCategory }
    directory.merchants = [{ ...merchant, source: 'user-confirmed' }]
  }
  let placeId = ''
  if (intent.place) {
    const p = intent.place
    if (channel !== 'physical' || !merchant || merchant.onlineOnly) errors.placeId = 'place'
    for (const key of ['branch', 'city', 'country'] as const) if (!text(p[key])) errors[`place-${key}`] = 'required'
    if (!text(p.address, true)) errors['place-address'] = 'required'
    const longitude = coordinate(p.longitude, 180), latitude = coordinate(p.latitude, 90)
    if (longitude === null) errors['place-longitude'] = 'coordinate'
    if (latitude === null) errors['place-latitude'] = 'coordinate'
    if (!p.confirmed) errors['place-confirmed'] = 'location'
    if (!p.separate && context.places.some(existing => existing.merchantId === merchantId && (normalized(existing.branch.en) === normalized(p.branch) || normalized(existing.branch.he) === normalized(p.branch) || (longitude !== null && latitude !== null && existing.coordinates[0] === longitude && existing.coordinates[1] === latitude) || (p.address && normalized((existing as Place & { address?: string }).address ?? '') === normalized(p.address) && normalized(existing.city.en) === normalized(p.city) && normalized(existing.country.en) === normalized(p.country))))) errors['place-separate'] = 'duplicate'
    placeId = `local_place_${sequence}`
    if (context.places.some(p => p.id === placeId)) errors.directory = 'required'
    if (merchant) directory.places = [{ id: placeId, merchantId, name: { ...merchant.name }, branch: literal(p.branch), city: literal(p.city), country: literal(p.country), coordinates: [longitude ?? NaN, latitude ?? NaN], category: merchant.category, address: p.address, source: 'user-confirmed', locationMethod: 'manual-coordinates' }]
  } else if (channel === 'physical') errors.placeId = 'place'
  return { errors, directory, merchantId, placeId }
}
export function previewSequence(context: Context): number {
  return Math.max(0, ...context.merchants.map(m => suffix(m.id, 'merchant')).filter(Number.isSafeInteger), ...context.places.map(p => suffix(p.id, 'place')).filter(Number.isSafeInteger)) + 1
}
export function composeDirectory(context: Context, directory: LocalDirectory): Context {
  return { merchants: [...context.merchants, ...directory.merchants.map(({ source: _source, ...m }) => m)], places: [...context.places, ...directory.places] }
}
export function pruneDirectory(directory: LocalDirectory, purchases: readonly { merchantId: string; placeId: string | null }[]): LocalDirectory {
  const places = directory.places.filter(p => purchases.some(r => r.placeId === p.id))
  return { places, merchants: directory.merchants.filter(m => purchases.some(r => r.merchantId === m.id) || places.some(p => p.merchantId === m.id)) }
}
export function validateDirectory(raw: unknown, context: Context, nextSequence: number): LocalDirectory {
  if (!exactObject(raw, ['merchants', 'places']) || !denseArray(raw.merchants, 1000) || !denseArray(raw.places, 1000)) throw new Error('directory-invalid')
  const merchantIds = new Set(context.merchants.map(m => m.id)), placeIds = new Set(context.places.map(p => p.id))
  for (const rawMerchant of raw.merchants) {
    if (!exactObject(rawMerchant, ['id', 'name', 'category', 'source'])) throw new Error('directory-invalid')
    const m = rawMerchant as unknown as LocalMerchant, n = suffix(m.id, 'merchant')
    if (!Number.isSafeInteger(n) || n >= nextSequence || merchantIds.has(m.id) || !localized(m.name) || !categories.includes(m.category) || m.source !== 'user-confirmed') throw new Error('directory-invalid')
    merchantIds.add(m.id)
  }
  const merchants = [...context.merchants, ...raw.merchants as unknown as LocalMerchant[]]
  for (const rawPlace of raw.places) {
    if (!exactObject(rawPlace, ['id', 'merchantId', 'name', 'branch', 'city', 'country', 'coordinates', 'category', 'address', 'source', 'locationMethod'])) throw new Error('directory-invalid')
    const p = rawPlace as unknown as LocalPlace, n = suffix(p.id, 'place'), m = merchants.find(m => m.id === p.merchantId)
    if (!Number.isSafeInteger(n) || n >= nextSequence || placeIds.has(p.id) || !m || m.onlineOnly || !localized(p.branch) || !localized(p.city) || !localized(p.country) || !exactObject(p.name, ['en', 'he']) || p.name.en !== m.name.en || p.name.he !== m.name.he || p.category !== m.category || !text(p.address, true) || p.source !== 'user-confirmed' || p.locationMethod !== 'manual-coordinates' || !denseArray(p.coordinates, 2) || p.coordinates.length !== 2 || p.coordinates.some((c,i) => typeof c !== 'number' || !Number.isFinite(c) || Math.abs(c) > (i ? 90 : 180))) throw new Error('directory-invalid')
    placeIds.add(p.id)
  }
  return structuredClone(raw) as unknown as LocalDirectory
}
