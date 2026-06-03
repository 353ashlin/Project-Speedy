import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getDb } from '../../src/server/db'
import { listPeople } from '../../src/server/queries'
import { getSettings, setupStepToUrl } from '../../src/server/settings'

export const dynamic = 'force-dynamic'

export default function PeopleIndex() {
  const settings = getSettings()
  if (settings.setupStep !== 'complete') {
    redirect(setupStepToUrl(settings.setupStep))
  }

  const summaries = listPeople(getDb())

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

      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>People</h1>

      {summaries.length === 0 ? (
        <p style={{ color: '#666' }}>No people yet — run a sync from the dashboard.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
          {summaries.map(({ person, lastInteractionAt }) => (
            <li
              key={person.id}
              style={{
                padding: '0.6rem 0.85rem',
                border: '1px solid #eee',
                borderRadius: 4,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Link
                href={`/people/${person.id}`}
                style={{ color: '#111', textDecoration: 'none', fontWeight: 500 }}
              >
                {person.displayName}
              </Link>
              <span style={{ color: '#888', fontSize: '0.85rem' }}>
                {person.relationship !== 'unknown' ? `${person.relationship} · ` : ''}
                {lastInteractionAt
                  ? `last: ${lastInteractionAt.toLocaleDateString()}`
                  : 'no interactions'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
