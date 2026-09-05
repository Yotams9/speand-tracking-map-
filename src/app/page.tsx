import { fixtureSpendscapeRepository } from '@/data/spendscape-repository'
import { SpendscapeGlobe } from '@/features/globe/SpendscapeGlobe'

export default async function HomePage() {
  const initialData = await fixtureSpendscapeRepository.loadSnapshot()

  return <SpendscapeGlobe initialData={initialData} />
}
