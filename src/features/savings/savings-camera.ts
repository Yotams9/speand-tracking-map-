// Where to put a flown-to store so it is not hidden under an open panel:
// above it on a phone (bottom sheet), beside it on wider screens (either side, RTL included).
export function offsetBesidePanel(panel: DOMRect | null, viewport: { width: number; height: number }, headerBottom = 64): [number, number] {
  if (!panel || panel.width === 0) return [0, 0]
  if (viewport.width <= 760) {
    const visibleTop = Math.min(headerBottom, panel.top), visibleBottom = Math.max(visibleTop, panel.top)
    return [0, Math.round((visibleTop + visibleBottom) / 2 - viewport.height / 2)]
  }
  const freeStart = panel.left > viewport.width / 2 ? 0 : panel.right
  const freeEnd = panel.left > viewport.width / 2 ? panel.left : viewport.width
  return [Math.round((freeStart + freeEnd) / 2 - viewport.width / 2), 0]
}
