# Spendscape — Design and Globe Specification

## Design intent

Spendscape should feel like a premium nocturnal observatory for a person's
purchase life: calm, spatial, precise, cinematic, and trustworthy. The globe
provides depth and motion; the surrounding UI stays restrained.

Use the Refero Origin Financial style as inspiration, but do not copy Origin
branding, copy, screens, or trade dress.

## Visual system

### Color and surfaces

- Near-black canvas around `#0f1011`; deeper bands around `#090a0b`.
- Elevated graphite surface around `#2e2e2e`; steel hover/pressed surface.
- White/cloud for primary text and actions; muted ash for descriptions.
- White fill with black text for the primary action.
- Restrained cyan for data signals and iris/violet for signature features.
- Full chromatic colors belong to a small number of feature/analytics surfaces,
  not decorative borders or tiny body text.
- Prefer surface steps and glass blur over stacks of drop shadows.

These reference values guide an original, accessible Spendscape token system
tested over the actual dark basemap; they are not a stylesheet to copy.

### Typography

- Editorial high-contrast display face for rare emotional headings.
- Neutral modern sans for interaction and reading.
- Monospace for compact uppercase data labels and annotations.
- Do not let oversized reference headings compete with the globe.
- Hebrew fallbacks must preserve legibility and hierarchy.

### Shape and depth

- Inputs/buttons/nav: roughly 8px radius.
- Cards/stat blocks: roughly 16px.
- Feature tiles/sheets: up to 24–30px.
- Pills only for true filters, statuses, or compact actions.
- Controlled glass blur over the globe with an opaque fallback.
- Never cover most of the map with permanent cards.

### Motion

- Motion explains spatial/state continuity; it is not decoration.
- Camera and sheet transitions are interruptible.
- Prefer transform/opacity and avoid layout thrashing.
- Reduced motion disables auto-spin and animated replay travel while preserving
  full functionality.

## Verified benchmark implementation

The public site `https://food-map-nu.vercel.app/` currently loads:

- `maplibre-gl@5.6.0`.
- `https://tiles.openfreemap.org/styles/liberty`.
- Globe projection and atmosphere/sky.
- A GeoJSON source with circle, heatmap, and close-zoom label layers.
- Auto-spin through repeated linear `easeTo` calls.
- Spin stop on mouse, wheel, touch, or drag.
- Hover tooltip, click popup, city `fitBounds`, place `flyTo`, and reset.

Phase 1 should use the current stable MapLibre release compatible with the
selected Next.js bundler, not blindly pin the benchmark's older version.
Preserve behavior, not version numbers. OpenFreeMap's public service is only a
development-style source; its use does not authorize scraping, offline tile
harvesting, or a production availability assumption. See
`TECHNOLOGY_STRATEGY.md` for the production provider gate.

## Globe states and behavior

### Initial state

- A full-world 3D globe appears behind lightweight loading UI.
- Atmosphere, land, water, and borders remain legible in the dark theme.
- Auto-rotate slowly only before interaction and when reduced motion is off.
- Stop auto-rotation after pointer, touch, wheel, drag, keyboard navigation, pin
  selection, search, AI action, or timeline interaction.

### Navigation continuum

1. **World:** curvature, country context, restrained aggregation.
2. **Region/country:** city clusters and density become legible.
3. **City:** canonical place pins separate smoothly.
4. **Street/place:** selected pin, local context, labels, and place card.

Use interruptible `flyTo`, `easeTo`, or `fitBounds`. User input during a camera
animation takes control without jumping or snapping back.

### Pin contract

- Source entity is `Place`, not `Purchase`.
- Exactly one unclustered feature per physical place ID.
- Pin aggregates visits, spend, currencies, date range, and category mix.
- Repeated purchases never form orbiting markers around one place.
- Render-time clustering is allowed at wide zoom; click zooms to bounds.
- Online purchases never enter the place GeoJSON source.
- Unresolved physical purchases stay in timeline/Smart Inbox without a fake
  coordinate or pin.
- Size/color can encode a metric, but meaning cannot rely on color alone.

### Interaction

- Desktop hover: place, total/visits, and category tooltip.
- Click/tap: persistent selected state and place detail while preserving map
  context.
- Background click/tap dismisses selection when safe.
- Mobile: reliable tap slop, one-finger navigation, pinch zoom, and no accidental
  conflict with sheet scrolling.
- Keyboard: focusable controls, Escape to dismiss, searchable places, and a
  non-map path to all information.

### Place detail

- Place/branch identity and location.
- Visits, total, average, currencies, date range, and category mix.
- Nested purchase list and receipt line items.
- Useful insight/pattern only when warranted.
- No internal confidence score in ordinary UI.

### Heatmap, filters, and state

- Toggle pins/heatmap without remounting or losing camera state.
- One shared query state updates globe, analytics, timeline, and counts.
- Empty/loading states explain results while retaining the globe surface.

### AI map control

Allow typed commands such as:

- `map.flyToPlace(placeId)`
- `map.flyToRegion(bounds)`
- `map.resetGlobe()`
- `filters.set({...})`
- `timeline.setRange(start, end)`
- `selection.openPurchase(purchaseId)`
- `analytics.open(view)`
- `replay.start(options)` / `replay.pause()`

Validate canonical IDs and allowed actions. Show what happened and provide
undo/back where meaningful. AI cannot delete, share, connect accounts, or alter
privacy settings without explicit confirmation.

## Responsive composition

### Desktop

- Full-viewport globe with minimal top navigation and search/profile chrome.
- Context panels collapse and never permanently hide the globe.
- Timeline near the lower edge; Ask AI and Add/Capture float deliberately.
- Returning from analytics restores camera/filter/selection state.

### Mobile

- Globe receives the largest area above safe-area-aware bottom nav.
- Bottom sheets use snap points, drag handle, clear close/back, and keyboard-safe
  layout.
- Universal Scanner/Add remains thumb-reachable.
- Bottom nav is Globe, Stats, AI; profile and Smart Inbox are secondary global
  destinations.

## Performance acceptance

- Avoid React re-renders on every raw map-frame event.
- Use MapLibre layers/source updates rather than one React node per place.
- Cluster/aggregate at wide zoom and query visible/needed detail.
- Lazy-load heavy analytics/scanner code and keep the globe mounted.
- Test small, typical, and large synthetic place volumes.
- Report measured device/browser, frame behavior, and interaction latency; do
  not claim “60fps” without measurement.

## Phase 1 visual acceptance

- First view unmistakably reads as Spendscape and globe-first.
- Rotation, drag, pinch/wheel, fly-to, reset, selection, and cluster behavior are
  smooth and interruptible.
- One place with many purchases renders one pin.
- Online purchases are discoverable but create no pin.
- Dark overlays remain readable over varied map areas.
- Mobile/desktop, Hebrew/RTL, keyboard, and reduced motion are intentional.
- No visible control is dead or misleading.
