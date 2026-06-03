'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface SyncIndicatorProps {
  lastSyncIso: string | null
  /** When true, auto-trigger a sync if the last sync is older than 2 min. */
  autoSyncOnMount?: boolean
}

const AUTO_SYNC_STALENESS_MS = 2 * 60 * 1000

export function SyncIndicator({ lastSyncIso, autoSyncOnMount = true }: SyncIndicatorProps) {
  const [lastSync, setLastSync] = useState<string | null>(lastSyncIso)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoSyncStartedRef = useRef(false)

  const triggerSync = useCallback(async () => {
    setSyncing((current) => {
      if (current) return current
      return true
    })
    setError(null)
    try {
      const res = await fetch('/api/sync/run?connector=all', { method: 'POST' })
      const body = (await res.json()) as { ok: boolean; results: Array<{ status: string }> }
      if (!body.ok) {
        setError('Sync had errors — see RUNBOOK')
      }
      setLastSync(new Date().toISOString())
      if (typeof window !== 'undefined') window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sync failed')
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    if (!autoSyncOnMount || autoSyncStartedRef.current) return
    autoSyncStartedRef.current = true
    const lastMs = lastSyncIso ? new Date(lastSyncIso).getTime() : 0
    if (Date.now() - lastMs > AUTO_SYNC_STALENESS_MS) {
      void triggerSync()
    }
  }, [autoSyncOnMount, lastSyncIso, triggerSync])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        fontSize: '0.85rem',
        color: '#666',
      }}
    >
      <span>{relativeTime(lastSync)}</span>
      <button
        type="button"
        onClick={triggerSync}
        disabled={syncing}
        style={{
          padding: '0.35rem 0.75rem',
          fontSize: '0.85rem',
          border: '1px solid #ddd',
          borderRadius: 4,
          background: '#fff',
          cursor: syncing ? 'not-allowed' : 'pointer',
          opacity: syncing ? 0.6 : 1,
        }}
      >
        {syncing ? 'Syncing…' : 'Sync now'}
      </button>
      {error && (
        <span role="alert" style={{ color: '#c00' }}>
          {error}
        </span>
      )}
    </div>
  )
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never synced'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'Synced just now'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `Synced ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Synced ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `Synced ${days}d ago`
}
