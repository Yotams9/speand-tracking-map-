import { createDemoAccessHandler } from '../../../server/demo-access'
export const runtime = 'nodejs'
export const maxDuration = 10
export const dynamic = 'force-dynamic'
export const POST = createDemoAccessHandler(process.env)
