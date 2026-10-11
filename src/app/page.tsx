import { fixtureSpendscapeRepository } from '@/data/spendscape-repository'
import { SpendscapeGlobe } from '@/features/globe/SpendscapeGlobe'
import { headers } from 'next/headers'
import { syntheticQaAllowed, userApplicationSnapshot } from '@/data/spendscape-user'

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const history = await fixtureSpendscapeRepository.loadSnapshot()
  const requestHeaders = await headers()
  const qa = syntheticQaAllowed(process.env.SPENDSCAPE_SYNTHETIC_QA, requestHeaders.get('host') ?? '', (await searchParams).syntheticQa ?? requestHeaders.get('x-spendscape-synthetic-qa'))
  const initialData = qa ? history : userApplicationSnapshot(history)

  return <SpendscapeGlobe initialData={initialData} />
}
