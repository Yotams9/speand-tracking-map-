import { describe, expect, it } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import {
  buildDevelopmentGlobeStyle,
  CLOSE_ZOOM_PIN_MIN_RADIUS,
  HEATMAP_COLOR_EXPRESSION,
  HEATMAP_INTENSITY_EXPRESSION,
  HEATMAP_OPACITY,
  HEATMAP_RADIUS_EXPRESSION,
  HEATMAP_WEIGHT_EXPRESSION,
  OPENFREEMAP_LIBERTY_STYLE_URL,
  PIN_GLOW_RADIUS_EXPRESSION,
  PIN_HOVER_RADIUS_EXPRESSION,
  PIN_RADIUS_EXPRESSION,
  PIN_SELECTION_GLOW_RADIUS_EXPRESSION,
  PIN_SELECTION_HALO_RADIUS_EXPRESSION,
  PIN_SHADOW_RADIUS_EXPRESSION,
  PIN_STROKE_WIDTH_EXPRESSION,
  RTL_TEXT_PLUGIN_URL,
  SPENDSCAPE_BLUE,
} from './globe-map-config'

describe('globe map configuration', () => {
  it('preserves Liberty provider layers while applying only globe metadata and atmosphere', () => {
    const layers = [{ id: 'provider-land', type: 'fill', paint: { 'fill-color': '#f4f1ea' } }]
    const provider = {
      version: 8,
      name: 'Liberty',
      sources: {},
      layers,
      metadata: { provider: 'OpenFreeMap' },
    } as unknown as StyleSpecification

    const result = buildDevelopmentGlobeStyle(provider)

    expect(result.layers).toBe(layers)
    expect(result.layers).toEqual(provider.layers)
    expect(result.projection).toEqual({ type: 'globe' })
    expect(result.sky).toMatchObject({
      'sky-color': '#87b4e2',
      'horizon-color': '#d7e8f7',
      'fog-color': '#f6f9fc',
    })
    expect(result.metadata).toMatchObject({
      provider: 'OpenFreeMap',
      'spendscape:sourceStyle': OPENFREEMAP_LIBERTY_STYLE_URL,
    })
  })

  it('pins the approved RTL asset and coherent base marker blue', () => {
    expect(RTL_TEXT_PLUGIN_URL).toBe('/vendor/mapbox-gl-rtl-text-0.4.0.js')
    expect(SPENDSCAPE_BLUE).toBe('#256abf')
  })

  it('keeps close-zoom spots legible and heat density visible through maximum zoom', () => {
    expect(CLOSE_ZOOM_PIN_MIN_RADIUS).toBe(14)
    expect(PIN_RADIUS_EXPRESSION).toContain(15.2)
    const pinRadiusParts = PIN_RADIUS_EXPRESSION as unknown as unknown[]
    const closeZoomStop = pinRadiusParts.indexOf(15.2)
    expect(pinRadiusParts[closeZoomStop + 1]).toEqual([
      'interpolate', ['linear'], ['to-number', ['get', 'visitCount'], 1],
      1, CLOSE_ZOOM_PIN_MIN_RADIUS, 14, 19,
    ])
    for (const expression of [
      PIN_RADIUS_EXPRESSION,
      PIN_HOVER_RADIUS_EXPRESSION,
      PIN_GLOW_RADIUS_EXPRESSION,
      PIN_SHADOW_RADIUS_EXPRESSION,
      PIN_SELECTION_GLOW_RADIUS_EXPRESSION,
      PIN_SELECTION_HALO_RADIUS_EXPRESSION,
    ]) {
      expect(expression[0]).toBe('interpolate')
      expect(expression[2]).toEqual(['zoom'])
    }
    expect(PIN_STROKE_WIDTH_EXPRESSION).toContain(2.6)

    expect(HEATMAP_WEIGHT_EXPRESSION[2]).toEqual([
      'sqrt', ['to-number', ['coalesce', ['get', 'visitCount'], ['get', 'point_count']], 1],
    ])
    expect(HEATMAP_INTENSITY_EXPRESSION).toEqual([
      'interpolate', ['linear'], ['zoom'], 2, 0.7, 12, 2.4, 16, 2.8,
    ])
    expect(HEATMAP_RADIUS_EXPRESSION).toEqual([
      'interpolate', ['linear'], ['zoom'], 2, 8, 12, 42, 16, 58,
    ])
    expect(HEATMAP_COLOR_EXPRESSION.at(-1)).toBe('#0d366b')
    expect(HEATMAP_OPACITY).toBe(0.82)
  })
})
