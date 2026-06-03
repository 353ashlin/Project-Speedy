'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type Phase = 'gmail' | 'gcal' | 'finalize' | 'done'

interface SyncResult {
  connector: string
  itemsSynced: number
  status: 'success' | 'failed'
  error?: string
}

interface SyncResponse {
  ok: boolean
  results: SyncResult[]
}

export default function Backfill() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('gmail')
  const [gmailCount, setGmailCount] = useState<number | null>(null)
  const [gcalCount, setGcalCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const runBackfill = async () => {
      try {
        setPhase('gmail')
        const gmailRes = await fetch('/api/sync/run?connector=gmail', { method: 'POST' })
        const gmailBody = (await gmailRes.json()) as SyncResponse
        const gmail = gmailBody.results.find((r) => r.connector === 'gmail')
        if (!gmail || gmail.status !== 'success') {
          throw new Error(`Gmail sync failed: ${gmail?.error ?? 'unknown'}`)
        }
        setGmailCount(gmail.itemsSynced)

        setPhase('gcal')
        const gcalRes = await fetch('/api/sync/run?connector=gcal', { method: 'POST' })
        const gcalBody = (await gcalRes.json()) as SyncResponse
        const gcal = gcalBody.results.find((r) => r.connector === 'gcal')
        if (!gcal || gcal.status !== 'success') {
          throw new Error(`Calendar sync failed: ${gcal?.error ?? 'unknown'}`)
        }
        setGcalCount(gcal.itemsSynced)

        setPhase('finalize')
        const completeRes = await fetch('/api/setup/complete', { method: 'POST' })
        if (!completeRes.ok) {
          throw new Error('Failed to finalize setup')
        }

        setPhase('done')
        router.push('/')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error'
        setError(message)
      }
    }

    void runBackfill()
  }, [router])

  return (
    <main>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Step 4: Pulling in your data</h1>
      <p style={{ color: '#444', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        Backfilling email and calendar from your Google account. This is the only step that takes
        more than a second — could be a minute or two depending on volume.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, lineHeight: 2 }}>
        <Step
          label="Pulling Gmail"
          state={phase === 'gmail' ? 'active' : gmailCount !== null ? 'done' : 'pending'}
          detail={gmailCount !== null ? `${gmailCount} messages` : null}
        />
        <Step
          label="Pulling Google Calendar"
          state={phase === 'gcal' ? 'active' : gcalCount !== null ? 'done' : 'pending'}
          detail={gcalCount !== null ? `${gcalCount} events` : null}
        />
        <Step
          label="Finalizing"
          state={phase === 'finalize' || phase === 'done' ? 'active' : 'pending'}
          detail={null}
        />
      </ul>

      {error && (
        <p
          role="alert"
          style={{
            color: '#c00',
            marginTop: '1.25rem',
            fontSize: '0.9rem',
            background: '#fff5f5',
            padding: '0.75rem 1rem',
            borderRadius: 4,
          }}
        >
          {error}
        </p>
      )}
    </main>
  )
}

function Step({
  label,
  state,
  detail,
}: {
  label: string
  state: 'pending' | 'active' | 'done'
  detail: string | null
}) {
  const icon = state === 'done' ? '✓' : state === 'active' ? '…' : '·'
  return (
    <li
      style={{
        opacity: state === 'pending' ? 0.5 : 1,
        color: state === 'done' ? '#080' : '#222',
      }}
    >
      <span style={{ width: '1.5em', display: 'inline-block', textAlign: 'center' }}>{icon}</span>
      {label}
      {detail && <span style={{ color: '#888' }}> · {detail}</span>}
    </li>
  )
}
