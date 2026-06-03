import Link from 'next/link'

export default function Welcome() {
  return (
    <main>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Welcome to Project Speedy</h1>
      <p style={{ color: '#444', lineHeight: 1.6 }}>
        Project Speedy aggregates your Gmail and Google Calendar into a single read-only dashboard
        that connects people, timing, and context.
      </p>
      <p style={{ color: '#444', lineHeight: 1.6, marginTop: '1rem' }}>
        Setup takes about 10 minutes. You will need:
      </p>
      <ul style={{ color: '#444', lineHeight: 1.6, paddingLeft: '1.25rem' }}>
        <li>An Anthropic API key (for entity resolution, summaries, and Q&amp;A).</li>
        <li>A Google Cloud OAuth client ID + secret (we will walk you through creating one).</li>
        <li>A Google account to read Gmail and Calendar from.</li>
      </ul>
      <Link
        href="/setup/anthropic"
        style={{
          display: 'inline-block',
          marginTop: '2rem',
          padding: '0.75rem 1.5rem',
          background: '#111',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: 4,
        }}
      >
        Get started →
      </Link>
    </main>
  )
}
