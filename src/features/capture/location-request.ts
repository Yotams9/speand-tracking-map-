// One device-location read at a time. A newer read, an edit of the store or
// place, or closing the form makes an earlier answer stale: it is ignored, so a
// late GPS fix can never replace what the person chose or typed meanwhile.
export function locationRequests() {
  let current = 0
  return {
    start: () => ++current,
    cancel: () => { current++ },
    isCurrent: (id: number) => id === current,
  }
}
