'use client'
import { useEffect, useRef, useState } from 'react'
import type { SpendscapeDataSnapshot } from '../../data/spendscape-repository'
import type { SessionPurchaseLedger } from '../capture/session-purchase-domain'
import type { SmartInboxDecision } from '../inbox/smart-inbox-domain'
import { emptyLocalPurchases, LOCAL_CHANNEL, LocalStoreError, readLocalPurchases, writeLocalPurchases, type LocalPurchases } from './local-purchase-store'

export function useLocalPurchases(context: SpendscapeDataSnapshot, onRestore: (data: LocalPurchases) => void) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'invalid' | 'unavailable' | 'conflict'>('loading')
  const [busy, setBusy] = useState(false)
  const [writeError, setWriteError] = useState(false)
  const lastFailure = useRef<'capacity' | 'storage'>('storage')
  const current = useRef(emptyLocalPurchases()), lock = useRef(false), alive = useRef(false)
  const channel = useRef<BroadcastChannel | null>(null), restore = useRef(onRestore)
  restore.current = onRestore
  useEffect(() => {
    let active = true
    alive.current = true
    const check = async (initial = false) => {
      const revisionAtStart = current.current.revision
      try {
        const data = await readLocalPurchases(context)
        if (!active) return
        if (initial) { current.current = data; restore.current(data); setPhase('ready') }
        else if (!lock.current && revisionAtStart === current.current.revision && data.revision !== current.current.revision) setPhase('conflict')
      } catch (e) { if (active && !lock.current) setPhase(e instanceof LocalStoreError && e.code === 'invalid' ? 'invalid' : 'unavailable') }
    }
    void check(true)
    try {
      channel.current = new BroadcastChannel(LOCAL_CHANNEL)
      channel.current.onmessage = () => { void check() }
    } catch { /* Focus check and atomic revision check still protect writes. */ }
    const focus = () => { void check() }
    window.addEventListener('focus', focus)
    return () => { active = false; alive.current = false; channel.current?.close(); channel.current = null; window.removeEventListener('focus', focus) }
  }, [context])
  const commit = async (ledger: SessionPurchaseLedger, decisions: readonly SmartInboxDecision[], erase = false) => {
    if (lock.current || (!erase && phase !== 'ready')) return false
    lock.current = true; lastFailure.current = 'storage'; setBusy(true); setWriteError(false)
    try {
      const next = { ...current.current, directory: ledger.directory, records: ledger.records, nextSequence: ledger.nextSequence, decisions }
      const saved = await writeLocalPurchases(next, context, erase)
      current.current = saved
      try { channel.current?.postMessage({ changed: true }) } catch { /* No data in notifications. */ }
      return alive.current
    } catch (e) {
      if (alive.current) {
        lastFailure.current = e instanceof LocalStoreError && e.code === 'capacity' ? 'capacity' : 'storage'
        setWriteError(true)
        if (e instanceof LocalStoreError && (e.code === 'conflict' || e.code === 'invalid')) setPhase(e.code)
      }
      return false
    } finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  return { phase, busy, writeError, lastFailure, commit }
}
