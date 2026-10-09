import { test, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

// WCAG AA text contrast over the app's own surfaces (map tiles excluded).
// Translucent layers are composited over the near-black canvas, which is what
// sits behind every panel when the globe is not directly underneath.
const out = 'artifacts/night-run/contrast'

async function audit(page: Page, label: string) {
  const { failures, checked } = await page.evaluate(() => {
    const parse = (value: string) => {
      const match = value.match(/rgba?\(([^)]+)\)/)
      if (!match) return null
      const [r, g, b, a = '1'] = match[1].split(/[ ,/]+/).filter(Boolean)
      return [Number(r), Number(g), Number(b), Number(a)] as [number, number, number, number]
    }
    const over = (top: number[], bottom: number[]) => top.slice(0, 3).map((channel, index) => channel * top[3] + bottom[index] * (1 - top[3]))
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const canvas = [8, 9, 12]
    const results: { text: string; ratio: number; color: string; size: number }[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const seen = new Set<Element>()
    let checked = 0
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const element = node.parentElement
      if (!element || seen.has(element) || !node.textContent?.trim()) continue
      seen.add(element)
      if (element.closest('.maplibregl-map canvas, .maplibregl-ctrl, [aria-hidden="true"], .srOnly')) continue
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      if (box.width === 0 || box.height === 0 || style.visibility === 'hidden' || Number(style.opacity) === 0) continue
      if (box.bottom < 0 || box.top > innerHeight || box.right < 0 || box.left > innerWidth) continue
      // Build the background by compositing every ancestor's background over the canvas.
      const layers: number[][] = []
      for (let current: Element | null = element; current; current = current.parentElement) {
        const bg = parse(getComputedStyle(current).backgroundColor)
        if (bg && bg[3] > 0) layers.push(bg)
      }
      let background = canvas
      for (const layer of layers.reverse()) background = over(layer, background)
      const fg = parse(style.color)
      if (!fg) continue
      checked += 1
      const color = over(fg, background)
      const [l1, l2] = [luminance(color), luminance(background)].sort((a, b) => b - a)
      const ratio = (l1 + 0.05) / (l2 + 0.05)
      const size = parseFloat(style.fontSize)
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
      if (ratio < (large ? 3 : 4.5)) results.push({ text: node.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, color: style.color, size })
    }
    return { failures: results, checked }
  })
  await writeFile(`${out}/${label}.json`, JSON.stringify({ checked, failures }, null, 2))
  expect(checked, `${label}: text elements checked`).toBeGreaterThan(10)
  return failures
}

type Qa = { ready: boolean }
test.beforeAll(async () => { await mkdir(out, { recursive: true }) })

for (const [width, height] of [[390, 844], [1440, 900]] as const) {
  for (const locale of ['he', 'en'] as const) {
    test(`text contrast ${locale} ${width}`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.addInitScript((value) => { localStorage.setItem('spendscape.locale.v1', value); localStorage.setItem('spendscape.demo-data.v1', 'on') }, locale)
      await page.setViewportSize({ width, height })
      await page.goto('/')
      await page.waitForFunction(() => (window as typeof window & { __SPENDSCAPE_QA__?: Qa }).__SPENDSCAPE_QA__?.ready)
      const mobile = width < 761
      const nav = page.getByRole('navigation', { name: mobile ? 'Mobile primary' : 'Primary', exact: true }).getByRole('button')
      const all = [
        ...(await audit(page, `${locale}-${width}-home`)),
      ]
      await nav.nth(mobile ? 2 : 2).click(); await page.waitForTimeout(400)
      all.push(...await audit(page, `${locale}-${width}-purchases`))
      await nav.nth(mobile ? 3 : 1).click(); await page.waitForTimeout(400)
      all.push(...await audit(page, `${locale}-${width}-stats`))
      expect(all, JSON.stringify(all, null, 1)).toEqual([])
    })
  }
}
