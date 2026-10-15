// Resolve only explicitly chosen wall-clock facts and an explicit IANA zone.
// Round trips detect DST gaps/overlaps; no current date, midnight or offset guess.
export function receiptTimeCandidates(wall: string, zone: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall) || !zone || zone.length > 100) return []
  const anchor = Date.parse(`${wall}:00Z`)
  if (!Number.isFinite(anchor) || new Date(anchor).toISOString().slice(0, 16) !== wall || +wall.slice(0, 4) < 1900 || +wall.slice(0, 4) > 2100) return []
  try {
    const format = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    const local = (ms: number) => {
      const parts = Object.fromEntries(format.formatToParts(ms).map(p => [p.type, p.value]))
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
    }
    const offsets = new Set<number>()
    for (let hour = -16; hour <= 16; hour++) {
      const sample = anchor + hour * 3600000
      offsets.add(Date.parse(`${local(sample)}:00Z`) - sample)
    }
    return [...offsets].map(offset => anchor - offset).filter(ms => local(ms) === wall)
      .sort((a, b) => a - b).map(ms => new Date(ms).toISOString().slice(0, 16))
  } catch { return [] }
}
