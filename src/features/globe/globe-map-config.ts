import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'

export const OPENFREEMAP_LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
export const RTL_TEXT_PLUGIN_URL = '/vendor/mapbox-gl-rtl-text-0.4.0.js'

export const SPENDSCAPE_BLUE = '#256abf'
export const SPENDSCAPE_BLUE_BRIGHT = '#2f7bd2'
export const SPENDSCAPE_BLUE_DEEP = '#174c91'

export const MAX_CANONICAL_PLACE_VISITS = 14
export const CLOSE_ZOOM_PIN_MIN_RADIUS = 14

const visitRadius = (minimum: number, maximum: number): ExpressionSpecification => [
  'interpolate', ['linear'],
  ['to-number', ['get', 'visitCount'], 1],
  1, minimum,
  MAX_CANONICAL_PLACE_VISITS, maximum,
]

const radiusStops = [
  [2, 4, 6],
  [7, 5.5, 8.5],
  [10, 7.5, 11.5],
  [13, 11, 15.5],
  [15.2, CLOSE_ZOOM_PIN_MIN_RADIUS, 19],
  [16, 15, 20],
] as const

function pinRadiusExpression(extra = 0, hoverExtra = 0): ExpressionSpecification {
  const outputs = radiusStops.flatMap(([zoom, minimum, maximum]) => {
    const base = visitRadius(minimum + extra, maximum + extra)
    const value = hoverExtra > 0
      ? [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          visitRadius(minimum + extra + hoverExtra, maximum + extra + hoverExtra),
          base,
        ] as ExpressionSpecification
      : base
    return [zoom, value]
  })
  return ['interpolate', ['linear'], ['zoom'], ...outputs]
}

export const PIN_RADIUS_EXPRESSION = pinRadiusExpression()
export const PIN_HOVER_RADIUS_EXPRESSION = pinRadiusExpression(0, 2.5)
export const PIN_GLOW_RADIUS_EXPRESSION = pinRadiusExpression(9)
export const PIN_SHADOW_RADIUS_EXPRESSION = pinRadiusExpression(1.5)
export const PIN_SELECTION_GLOW_RADIUS_EXPRESSION = pinRadiusExpression(12)
export const PIN_SELECTION_HALO_RADIUS_EXPRESSION = pinRadiusExpression(5)

export const PIN_STROKE_WIDTH_EXPRESSION: ExpressionSpecification = [
  'interpolate', ['linear'], ['zoom'],
  2, 0.8,
  7, 1.25,
  10, 1.7,
  13, 2.1,
  15.2, 2.6,
  16, 2.8,
]

export const HEATMAP_WEIGHT_EXPRESSION: ExpressionSpecification = [
  'interpolate', ['linear'],
  ['sqrt', ['to-number', ['coalesce', ['get', 'visitCount'], ['get', 'point_count']], 1]],
  1, 0.28,
  Math.sqrt(MAX_CANONICAL_PLACE_VISITS), 1,
]

export const HEATMAP_INTENSITY_EXPRESSION: ExpressionSpecification = [
  'interpolate', ['linear'], ['zoom'],
  2, 0.7,
  12, 2.4,
  16, 2.8,
]

export const HEATMAP_RADIUS_EXPRESSION: ExpressionSpecification = [
  'interpolate', ['linear'], ['zoom'],
  2, 8,
  12, 42,
  16, 58,
]

export const HEATMAP_COLOR_EXPRESSION: ExpressionSpecification = [
  'interpolate', ['linear'], ['heatmap-density'],
  0, 'rgba(109, 167, 236, 0)',
  0.2, '#9ec5f4',
  0.45, '#5598e7',
  0.7, SPENDSCAPE_BLUE,
  1, '#0d366b',
]

export const HEATMAP_OPACITY = 0.82

export function buildDevelopmentGlobeStyle(providerStyle: StyleSpecification): StyleSpecification {
  return {
    ...providerStyle,
    name: 'Spendscape OpenFreeMap Liberty development globe',
    metadata: {
      ...(providerStyle.metadata ?? {}),
      'spendscape:provider': 'OpenFreeMap',
      'spendscape:sourceStyle': OPENFREEMAP_LIBERTY_STYLE_URL,
      'spendscape:serviceQualification': 'Public development/demo service; no offline or production SLA',
    },
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#87b4e2',
      'horizon-color': '#d7e8f7',
      'fog-color': '#f6f9fc',
      'atmosphere-blend': [
        'interpolate', ['linear'], ['zoom'],
        0, 1,
        6, 1,
        8, 0,
      ],
    },
  } as StyleSpecification
}
