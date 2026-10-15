import {denseArray,exactObject} from './local-structure'
export {denseArray,exactObject} from './local-structure'
import { needsPointAdjustment, validSearchProvenance, type AddressSearchProvenance } from './address-search'
import { catalogArea, catalogChainNames, catalogChains, catalogStoreIdOf, devicePlaceLabels, sameText, validCatalogProvenance, validCatalogStoreChoice, type CatalogPlaceProvenance, type CatalogStoreChoice } from './place-provenance'
import type { CatalogChain } from '../../data/price-catalog'
import type { Merchant, Place, PurchaseCategory } from '../../data/spendscape-globe'

export interface LocalMerchant extends Merchant { source: 'user-confirmed'; catalogChain?: CatalogChain }
export interface LocalPlace extends Place { source: 'user-confirmed'; locationMethod: 'manual-coordinates' | 'map-selection' | 'address-search' | 'catalog-store' | 'device-location'; address: string; addressSearch?: AddressSearchProvenance; catalogStore?: CatalogPlaceProvenance }
export interface LocalDirectory { merchants: readonly LocalMerchant[]; places: readonly LocalPlace[] }
export interface DirectoryIntent {
  merchant?: { name: string; category: PurchaseCategory | ''; separate: boolean }
  place?: { branch: string; city: string; country: string; address: string; longitude: string; latitude: string; confirmed: boolean; separate: boolean }
  // A chain branch the user chose from the published-price catalog; exclusive with merchant/place.
  catalogStore?: CatalogStoreChoice
  // Present only when the device location suggested that branch. Location is not
  // proof of a purchase, so the person must confirm it before it can be saved.
  locationSuggested?: { confirmed: boolean }
}
type Context = { merchants: readonly Merchant[]; places: readonly Place[] }
const categories = ['groceries', 'food', 'retail', 'travel', 'unknown']
const locationMethods = ['manual-coordinates', 'map-selection', 'address-search', 'catalog-store', 'device-location']
export const emptyDirectory = (): LocalDirectory => ({ merchants: [], places: [] })
const text = (value: unknown, optional = false): value is string => typeof value === 'string' && value.length <= 100 && (optional || value.trim().length > 0) && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)
const localized = (value: unknown) => exactObject(value, ['en', 'he']) && text(value.en) && value.en === value.he
const suffix = (id: string, kind: 'merchant' | 'place') => { const m = new RegExp(`^local_${kind}_([1-9][0-9]*)$`).exec(id); return m ? Number(m[1]) : NaN }
const normalized = (s: string) => s.normalize('NFC').trim().toLocaleLowerCase()
function coordinate(value: unknown, limit: number): number | null {
  if (typeof value !== 'string' || !/^-?\d{1,3}(?:\.\d{1,8})?$/.test(value)) return null
  const n = Number(value); return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}
export const catalogChainOf = (merchant: unknown): CatalogChain | undefined => {
  const chain = merchant && typeof merchant === 'object' ? (merchant as { catalogChain?: unknown }).catalogChain : undefined
  return catalogChains.includes(chain as CatalogChain) ? chain as CatalogChain : undefined
}
export function validDirectoryIntent(raw: unknown): raw is DirectoryIntent {
  if (!raw || typeof raw !== 'object') return false
  const keys = Object.keys(raw)
  if (!keys.length || !exactObject(raw, keys) || keys.some(k => !['merchant', 'place', 'catalogStore', 'locationSuggested'].includes(k))) return false
  const d = raw as DirectoryIntent
  if (Object.hasOwn(d, 'catalogStore')) return keys.every(k => k === 'catalogStore' || k === 'locationSuggested') && validCatalogStoreChoice(d.catalogStore)
    && (!Object.hasOwn(d, 'locationSuggested') || (exactObject(d.locationSuggested, ['confirmed']) && typeof d.locationSuggested.confirmed === 'boolean'))
  if (Object.hasOwn(d, 'locationSuggested')) return false
  if (Object.hasOwn(d, 'merchant') && (!exactObject(d.merchant, ['name', 'category', 'separate']) || typeof d.merchant.name !== 'string' || typeof d.merchant.category !== 'string' || typeof d.merchant.separate !== 'boolean')) return false
  if (Object.hasOwn(d, 'place') && (!exactObject(d.place, ['branch', 'city', 'country', 'address', 'longitude', 'latitude', 'confirmed', 'separate']) || ['branch', 'city', 'country', 'address', 'longitude', 'latitude'].some(k => typeof d.place![k as keyof NonNullable<DirectoryIntent['place']>] !== 'string') || typeof d.place.confirmed !== 'boolean' || typeof d.place.separate !== 'boolean')) return false
  return true
}
// One merchant per chain and one place per catalog store; a later purchase at
// the same branch reuses both, so pins and visit counts stay consistent.
function proposeCatalogPlace(choice: CatalogStoreChoice, suggested: DirectoryIntent['locationSuggested'], channel: string, sequence: number, context: Context): { errors: Record<string, string>; directory: LocalDirectory; merchantId: string; placeId: string } {
  const errors: Record<string, string> = {}, directory = emptyDirectory()
  if (channel !== 'physical') errors.placeId = 'place'
  // A branch picked from the list is the person's own choice; a suggested one needs their confirmation.
  if (suggested && !suggested.confirmed) errors['catalog-confirmed'] = 'location'
  const existing = context.places.find(p => catalogStoreIdOf(p) === choice.id)
  if (existing) return { errors, directory, merchantId: existing.merchantId, placeId: existing.id }
  let merchant = context.merchants.find(m => catalogChainOf(m) === choice.chain)
  if (!merchant) {
    merchant = { id: `local_merchant_${sequence}`, name: { ...catalogChainNames[choice.chain] }, category: 'groceries' }
    if (context.merchants.some(m => m.id === merchant!.id)) errors.directory = 'required'
    directory.merchants = [{ ...merchant, source: 'user-confirmed', catalogChain: choice.chain }]
  }
  const placeId = `local_place_${sequence}`
  if (context.places.some(p => p.id === placeId)) errors.directory = 'required'
  directory.places = [{ id: placeId, merchantId: merchant.id, name: { ...merchant.name }, branch: { en: choice.name, he: choice.name }, city: { ...catalogArea.city }, country: { ...catalogArea.country }, coordinates: [choice.coordinates[0], choice.coordinates[1]], category: merchant.category, address: choice.address, source: 'user-confirmed', locationMethod: 'catalog-store', catalogStore: { storeId: choice.id, chain: choice.chain, publishedAddress: choice.address } }]
  return { errors, directory, merchantId: merchant.id, placeId }
}
export function proposeDirectory(intent: unknown, merchantId: string, channel: string, sequence: number, context: Context): { errors: Record<string, string>; directory: LocalDirectory; merchantId: string; placeId: string } {
  const errors: Record<string, string> = {}, directory = emptyDirectory()
  if (!validDirectoryIntent(intent) || !Number.isSafeInteger(sequence) || sequence < 1) return { errors: { directory: 'required' }, directory, merchantId, placeId: '' }
  if (intent.catalogStore) return proposeCatalogPlace(intent.catalogStore, intent.locationSuggested, channel, sequence, context)
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
// Place facts depend on how the location was established. Every method keeps
// its own provenance; none can borrow another's labels or metadata.
function validPlaceFacts(p: LocalPlace, merchant: Merchant): boolean {
  if (p.locationMethod === 'catalog-store') return p.addressSearch === undefined && validCatalogProvenance(p.catalogStore) && catalogChainOf(merchant) === p.catalogStore.chain
    && localized(p.branch) && sameText(p.city, catalogArea.city) && sameText(p.country, catalogArea.country) && p.address === p.catalogStore.publishedAddress
  if (p.catalogStore !== undefined) return false
  if (p.locationMethod === 'device-location') return p.addressSearch === undefined && p.address === ''
    && sameText(p.branch, devicePlaceLabels.branch) && sameText(p.city, devicePlaceLabels.city) && sameText(p.country, devicePlaceLabels.country)
  return localized(p.branch) && localized(p.city) && localized(p.country)
    && (p.addressSearch === undefined || (validSearchProvenance(p.addressSearch) && !needsPointAdjustment(p.addressSearch))) && (p.locationMethod !== 'address-search' || p.addressSearch !== undefined)
}
export function validateDirectory(raw: unknown, context: Context, nextSequence: number): LocalDirectory {
  if (!exactObject(raw, ['merchants', 'places']) || !denseArray(raw.merchants, 1000) || !denseArray(raw.places, 1000)) throw new Error('directory-invalid')
  const merchantIds = new Set(context.merchants.map(m => m.id)), placeIds = new Set(context.places.map(p => p.id)), chains = new Set<string>(), storeIds = new Set<string>()
  const has = (value: unknown, key: string) => Boolean(value) && typeof value === 'object' && Object.hasOwn(value as object, key)
  for (const rawMerchant of raw.merchants) {
    if (!exactObject(rawMerchant, ['id', 'name', 'category', 'source', ...(has(rawMerchant, 'catalogChain') ? ['catalogChain'] : [])])) throw new Error('directory-invalid')
    const m = rawMerchant as unknown as LocalMerchant, n = suffix(m.id, 'merchant')
    const names = m.catalogChain === undefined ? localized(m.name) : catalogChains.includes(m.catalogChain) && !chains.has(m.catalogChain) && sameText(m.name, catalogChainNames[m.catalogChain]) && m.category === 'groceries'
    if (!Number.isSafeInteger(n) || n >= nextSequence || merchantIds.has(m.id) || !names || !categories.includes(m.category) || m.source !== 'user-confirmed') throw new Error('directory-invalid')
    merchantIds.add(m.id)
    if (m.catalogChain !== undefined) chains.add(m.catalogChain)
  }
  const merchants = [...context.merchants, ...raw.merchants as unknown as LocalMerchant[]]
  for (const rawPlace of raw.places) {
    if (!exactObject(rawPlace, ['id', 'merchantId', 'name', 'branch', 'city', 'country', 'coordinates', 'category', 'address', 'source', 'locationMethod', ...(['addressSearch', 'catalogStore'].filter(k => has(rawPlace, k)))])) throw new Error('directory-invalid')
    const p = rawPlace as unknown as LocalPlace, n = suffix(p.id, 'place'), m = merchants.find(m => m.id === p.merchantId)
    if (!Number.isSafeInteger(n) || n >= nextSequence || placeIds.has(p.id) || !m || m.onlineOnly || !exactObject(p.name, ['en', 'he']) || p.name.en !== m.name.en || p.name.he !== m.name.he || p.category !== m.category || !text(p.address, true) || p.source !== 'user-confirmed' || !locationMethods.includes(p.locationMethod) || !validPlaceFacts(p, m) || !denseArray(p.coordinates, 2) || p.coordinates.length !== 2 || p.coordinates.some((c,i) => typeof c !== 'number' || !Number.isFinite(c) || Math.abs(c) > (i ? 90 : 180))) throw new Error('directory-invalid')
    if (p.catalogStore) { if (storeIds.has(p.catalogStore.storeId)) throw new Error('directory-invalid'); storeIds.add(p.catalogStore.storeId) }
    placeIds.add(p.id)
  }
  return structuredClone(raw) as unknown as LocalDirectory
}
