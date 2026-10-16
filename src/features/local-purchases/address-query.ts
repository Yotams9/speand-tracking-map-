// Compose only the user's reviewed fields; never infer a city or country.
export function reviewedAddressQuery(address: string, city = '', country = ''): string {
  if (!address.trim()) return ''
  const parts = address.split(',').map(part => part.trim()).filter(Boolean)
  for (const value of [city, country]) {
    const part = value.trim()
    if (part && !parts.some(existing => existing.toLocaleLowerCase() === part.toLocaleLowerCase())) parts.push(part)
  }
  return parts.join(', ')
}
