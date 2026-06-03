import type { CalendarEvent, EmailMessage } from '@speedy/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getDb } from '../../../src/server/db'
import { getPersonProfile } from '../../../src/server/queries'
import { getSettings, setupStepToUrl } from '../../../src/server/settings'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PersonPage({ params }: PageProps) {
  const settings = getSettings()
  if (settings.setupStep !== 'complete') {
    redirect(setupStepToUrl(settings.setupStep))
  }

  const { id } = await params
  const personId = Number.parseInt(id, 10)
  if (!Number.isFinite(personId)) notFound()

  const profile = getPersonProfile(getDb(), personId)
  if (!profile) notFound()

  const { person, recentEmails, upcomingEvents, pastEvents } = profile

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #eee',
        }}
      >
        <Link
          href="/"
          style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111', textDecoration: 'none' }}
        >
          Project Speedy
        </Link>
        <Link href="/people" style={{ color: '#666', fontSize: '0.9rem' }}>
          People
        </Link>
      </header>

      <section style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{person.displayName}</h1>
        <div style={{ color: '#666', fontSize: '0.95rem' }}>
          {person.relationship !== 'unknown' && (
            <span style={{ marginRight: '0.5rem', color: '#333' }}>{person.relationship}</span>
          )}
          {person.birthday ? <span>· birthday {person.birthday} </span> : null}
        </div>
        {person.knownEmails.length > 0 && (
          <p
            style={{
              color: '#888',
              fontSize: '0.85rem',
              fontFamily: 'ui-monospace, monospace',
              marginTop: '0.25rem',
            }}
          >
            {person.knownEmails.join(' · ')}
          </p>
        )}
      </section>

      <Section title={`Recent emails (${recentEmails.length})`}>
        {recentEmails.length === 0 ? (
          <p style={{ color: '#888' }}>None yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
            {recentEmails.map((e) => (
              <li
                key={e.id}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #eee',
                  borderRadius: 4,
                }}
              >
                <EmailRow email={e} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Upcoming events (${upcomingEvents.length})`}>
        {upcomingEvents.length === 0 ? (
          <p style={{ color: '#888' }}>Nothing scheduled.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
            {upcomingEvents.map((e) => (
              <li
                key={e.id}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #eee',
                  borderRadius: 4,
                }}
              >
                <EventRow event={e} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Past events (${pastEvents.length})`}>
        {pastEvents.length === 0 ? (
          <p style={{ color: '#888' }}>None yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
            {pastEvents.map((e) => (
              <li
                key={e.id}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #eee',
                  borderRadius: 4,
                }}
              >
                <EventRow event={e} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1rem', color: '#444', marginBottom: '0.75rem' }}>{title}</h2>
      {children}
    </section>
  )
}

function EmailRow({ email }: { email: EmailMessage }) {
  return (
    <div>
      <div style={{ fontWeight: 500 }}>{email.subject ?? '(no subject)'}</div>
      <div style={{ color: '#888', fontSize: '0.85rem' }}>
        {email.receivedAt.toLocaleString()}
        {email.snippet ? ` · ${email.snippet}` : ''}
      </div>
    </div>
  )
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <div>
      <div style={{ fontWeight: 500 }}>{event.title}</div>
      <div style={{ color: '#888', fontSize: '0.85rem' }}>
        {event.startAt.toLocaleString()}
        {event.location ? ` · ${event.location}` : ''}
      </div>
    </div>
  )
}
