interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function GoogleSignin({ searchParams }: PageProps) {
  const { error } = await searchParams

  return (
    <main>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Step 3: Sign in with Google</h1>
      <p style={{ color: '#444', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        Click below to sign in with the Google account whose Gmail and Calendar you want Project
        Speedy to read. You will be asked to grant <strong>read-only</strong> access.
      </p>

      <p
        style={{
          fontSize: '0.85rem',
          color: '#666',
          background: '#fafafa',
          padding: '0.75rem 1rem',
          borderRadius: 4,
          marginBottom: '1.5rem',
        }}
      >
        Scopes requested: <code>gmail.readonly</code>, <code>gmail.metadata</code>,{' '}
        <code>calendar.readonly</code>, <code>calendar.events.readonly</code>. No write capability
        is ever requested.
      </p>

      <a
        href="/api/setup/google-signin/start"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          background: '#111',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: 4,
        }}
      >
        Sign in with Google
      </a>

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
          Sign-in failed: {decodeURIComponent(error)}
        </p>
      )}
    </main>
  )
}
