import { it, expect, vi } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { visionNativeRunDirectory, VISION_VALIDATION_RUN, VISION_POST_PARSER_RUN } from './vision-local-run'
import { visionReservation } from './vision-local-reservation'
import { visionAttemptRecord } from './vision-attempt-record'
it('only permits the historical default and the fixed approved namespaces', () => {
  expect(visionNativeRunDirectory(undefined)).toBe('receipt-vision-local-capture')
  expect(visionNativeRunDirectory(VISION_VALIDATION_RUN)).toBe('receipt-vision-local-validation-20261006-one')
  expect(visionNativeRunDirectory(VISION_POST_PARSER_RUN)).toBe('receipt-vision-local-validation-20261006-two')
  for (const invalid of ['', '../escape', '/tmp/override', 'validation-20261006-three']) expect(visionNativeRunDirectory(invalid)).toBeNull()
})
it.each([VISION_VALIDATION_RUN,VISION_POST_PARSER_RUN])('separates consumed history; concurrency and restart cannot reserve another dispatch for %s', async run => {
  const dir = await mkdtemp(join(tmpdir(), 'vision-run-offline-'))
  vi.stubGlobal('fetch', () => { throw new Error('OFFLINE_NETWORK_GUARD') })
  try {
    const old = join(dir, visionNativeRunDirectory(undefined)!, 'attempt-one.reservation.json')
    await visionReservation(old).reserve()
    const before = await readFile(old)
    const path = join(dir, visionNativeRunDirectory(run)!, 'attempt-one.reservation.json')
    const results = await Promise.allSettled([visionReservation(path).reserve(), visionReservation(path).reserve()])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(await visionReservation(path).consumed()).toBe(true)
    await expect(visionReservation(path).reserve()).rejects.toThrow('attempt-consumed')
    const record = join(dir, visionNativeRunDirectory(run)!, 'attempt-one.lifecycle.jsonl')
    const session = await visionAttemptRecord(record).start()
    await session.emit('authentication-start')
    expect((await visionAttemptRecord(record).status())?.state).toBe('incomplete')
    await expect(visionAttemptRecord(record).start()).rejects.toThrow()
    expect(await readFile(old)).toEqual(before)
  } finally { vi.unstubAllGlobals(); await rm(dir, {recursive:true}) }
})
