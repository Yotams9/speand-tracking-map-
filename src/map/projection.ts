/**
 * Web Mercator projection.
 *
 * The coordinates in the fixtures are real longitude/latitude pairs and this is
 * the real projection, which matters for one reason: when this demo is replaced
 * by a production map engine, the data does not change and neither does any
 * screen. Only `MapSurface` gets swapped.
 *
 * Zoom follows the usual slippy-map convention — world width at zoom z is
 * 256 * 2^z pixels — so a MapLibre or Mapbox camera can be initialised from the
 * same numbers.
 */

export type LonLat = [number, number]
export interface Point { x: number; y: number }
export interface MapView { center: LonLat; zoom: number }
export interface Size { width: number; height: number }

const TILE = 256
const MAX_LAT = 85.05112878

export const worldSize = (zoom: number): number => TILE * Math.pow(2, zoom)

/** Longitude/latitude to normalised world coordinates in the unit square. */
export function toWorld([lon, lat]: LonLat): Point {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
  const rad = (clamped * Math.PI) / 180
  return {
    x: (lon + 180) / 360,
    y: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2,
  }
}

export function fromWorld({ x, y }: Point): LonLat {
  const lon = x * 360 - 180
  const n = Math.PI * (1 - 2 * y)
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  return [lon, lat]
}

/** Longitude/latitude to pixels inside a viewport of the given size. */
export function toScreen(lonLat: LonLat, view: MapView, size: Size): Point {
  const scale = worldSize(view.zoom)
  const p = toWorld(lonLat)
  const c = toWorld(view.center)
  return {
    x: (p.x - c.x) * scale + size.width / 2,
    y: (p.y - c.y) * scale + size.height / 2,
  }
}

export function fromScreen(point: Point, view: MapView, size: Size): LonLat {
  const scale = worldSize(view.zoom)
  const c = toWorld(view.center)
  return fromWorld({
    x: (point.x - size.width / 2) / scale + c.x,
    y: (point.y - size.height / 2) / scale + c.y,
  })
}

/** Metres per pixel at a latitude, used to size the scale bar honestly. */
export function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
}

export const clampZoom = (z: number, min = 8.5, max = 17): number =>
  Math.max(min, Math.min(max, z))

/**
 * Semantic zoom tiers.
 *
 * The map answers a different question at each distance: which cities, then
 * which places, then which individual purchases. Nothing is hidden — the
 * question just gets narrower.
 */
export type ZoomTier = 'clusters' | 'merchants' | 'purchases'

export const CLUSTER_TIER_MAX = 12
export const MERCHANT_TIER_MAX = 14.5

export function tierFor(zoom: number): ZoomTier {
  if (zoom < CLUSTER_TIER_MAX) return 'clusters'
  if (zoom < MERCHANT_TIER_MAX) return 'merchants'
  return 'purchases'
}

/** A view that fits every supplied point, with padding, inside `size`. */
export function fitBounds(points: LonLat[], size: Size, padding = 64): MapView {
  if (points.length === 0) return { center: [34.8, 32.1], zoom: 11 }
  if (points.length === 1) return { center: points[0], zoom: 14 }

  const worlds = points.map(toWorld)
  const minX = Math.min(...worlds.map((w) => w.x))
  const maxX = Math.max(...worlds.map((w) => w.x))
  const minY = Math.min(...worlds.map((w) => w.y))
  const maxY = Math.max(...worlds.map((w) => w.y))

  const center = fromWorld({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 })

  const spanX = Math.max(maxX - minX, 1e-9)
  const spanY = Math.max(maxY - minY, 1e-9)
  const usableW = Math.max(size.width - padding * 2, 40)
  const usableH = Math.max(size.height - padding * 2, 40)

  const zoomX = Math.log2(usableW / (spanX * TILE))
  const zoomY = Math.log2(usableH / (spanY * TILE))

  return { center, zoom: clampZoom(Math.min(zoomX, zoomY)) }
}

/** Builds an SVG path from a list of coordinates. */
export function pathFor(
  coords: LonLat[],
  view: MapView,
  size: Size,
  close = false,
): string {
  if (coords.length === 0) return ''
  const d = coords
    .map((c, i) => {
      const p = toScreen(c, view, size)
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    })
    .join(' ')
  return close ? `${d} Z` : d
}
