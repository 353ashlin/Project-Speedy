import type { CalendarEvent, EmailMessage } from '@speedy/db'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SyncIndicator } from '../src/components/SyncIndicator'
import { getDb } from '../src/server/db'
import { getFeed, getLastSyncs } from '../src/server/queries'
import { getSettings, setupStepToUrl } from '../src/server/settings'

export const dynamic = 'force-dynamic'

export default function Home() {
  const settings = getSettings()
  if (settings.setupStep !== 'complete') {
    redirect(setupStepToUrl(settings.setupStep))
  }

  const db = getDb()
  const feed = getFeed(db, { limit: 100 })
  const syncs = getLastSyncs(db)
  const lastSyncMs = Math.max(
    syncs.gmail?.startedAt?.getTime() ?? 0,
    syncs.gcal?.startedAt?.getTime() ?? 0,
  )
  const lastSyncIso = lastSyncMs > 0 ? new Date(lastSyncMs).toISOString() : null

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #eee',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link
            href="/"
            style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111', textDecoration: 'none' }}
          >
            Project Speedy
          </Link>
          <Link href="/people" style={{ color: '#666', fontSize: '0.9rem' }}>
            People
          </Link>
        </div>
        <SyncIndicator lastSyncIso={lastSyncIso} />
      </header>

      {feed.length === 0 ? (
        <EmptyState />
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
          {feed.map((entry) => {
            if (entry.kind === 'email') {
              return (
                <li key={`email-${entry.item.id}`}>
                  <EmailCard email={entry.item} />
                </li>
              )
            }
            if (entry.kind === 'calendar_event') {
              return (
                <li key={`event-${entry.item.id}`}>
                  <EventCard event={entry.item} />
                </li>
              )
            }
            return null
          })}
        </ol>
      )}
    </main>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '3rem',
        background: '#fafafa',
        textAlign: 'center',
        color: '#666',
        borderRadius: 6,
      }}
    >
      <p style={{ margin: 0 }}>No data yet. Click "Sync now" in the header.</p>
    </div>
  )
}

function EmailCard({ email }: { email: EmailMessage }) {
  return (
    <article
      style={{
        padding: '0.75rem 1rem',
        background: '#fff',
        border: '1px solid #eee',
        borderRadius: 4,
        display: 'grid',
        gridTemplateColumns: '90px 1fr',
        gap: '1rem',
      }}
    >
      <time
        style={{
          color: '#888',
          fontSize: '0.8rem',
          fontFamily: 'ui-monospace, monospace',
          alignSelf: 'start',
        }}
      >
        {formatTime(email.receivedAt)}
      </time>
      <div>
        <div style={{ fontSize: '0.75rem', color: '#0a7', marginBottom: '0.15rem' }}>EMAIL</div>
        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
          {email.subject ?? '(no subject)'}
        </div>
        <div style={{ color: '#666', fontSize: '0.9rem' }}>
          {email.fromPersonId ? (
            <Link
              href={`/people/${email.fromPersonId}`}
              style={{ color: '#666', textDecoration: 'underline' }}
            >
              From #{email.fromPersonId}
            </Link>
          ) : (
            <span>From unknown</span>
          )}{' '}
          · {email.snippet}
        </div>
      </div>
    </article>
  )
}

function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <article
      style={{
        padding: '0.75rem 1rem',
        background: '#fff',
        border: '1px solid #eee',
        borderRadius: 4,
        display: 'grid',
        gridTemplateColumns: '90px 1fr',
        gap: '1rem',
      }}
    >
      <time
        style={{
          color: '#888',
          fontSize: '0.8rem',
          fontFamily: 'ui-monospace, monospace',
          alignSelf: 'start',
        }}
      >
        {formatTime(event.startAt)}
      </time>
      <div>
        <div style={{ fontSize: '0.75rem', color: '#06c', marginBottom: '0.15rem' }}>EVENT</div>
        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{event.title}</div>
        <div style={{ color: '#666', fontSize: '0.9rem' }}>
          {event.attendeePersonIds.length > 0 ? (
            <>{event.attendeePersonIds.length} attendees</>
          ) : (
            <>No attendees</>
          )}
          {event.location ? <> · {event.location}</> : null}
        </div>
      </div>
    </article>
  )
}

function formatTime(d: Date): string {
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
