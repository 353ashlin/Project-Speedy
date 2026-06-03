'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

export default function GoogleCredentials() {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Please paste both the Client ID and the Client Secret.')
      return
    }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/setup/google-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
    })

    if (res.ok) {
      const { next } = (await res.json()) as { next: string }
      router.push(next)
      return
    }

    const body = (await res.json().catch(() => ({}))) as { error?: string }
    setError(body.error ?? 'Failed to store credentials.')
    setLoading(false)
  }

  return (
    <main>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Step 2: Google OAuth client</h1>
      <p style={{ color: '#444', lineHeight: 1.6, marginBottom: '1rem' }}>
        Project Speedy needs a Google Cloud OAuth client to read your Gmail and Calendar. You will
        create one yourself so the credentials live only in your Google account and your local
        Keychain — never anywhere else.
      </p>

      <details
        open
        style={{
          background: '#f7f7f7',
          padding: '1rem 1.25rem',
          borderRadius: 4,
          marginBottom: '1.5rem',
        }}
      >
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          One-time setup (~5 minutes)
        </summary>
        <ol style={{ paddingLeft: '1.25rem', lineHeight: 1.7 }}>
          <li>
            Open{' '}
            <a
              href="https://console.cloud.google.com/projectcreate"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#0066cc' }}
            >
              Google Cloud Console
            </a>{' '}
            and create a new project named "Project Speedy" (or use an existing one).
          </li>
          <li>
            In the project, go to <strong>APIs &amp; Services → Library</strong>. Enable
            <em> Gmail API</em> and <em>Google Calendar API</em>.
          </li>
          <li>
            Go to <strong>APIs &amp; Services → OAuth consent screen</strong>. Set User Type to
            "External", App name to "Project Speedy", and your email as the support contact. Add
            yourself as a test user. Save.
          </li>
          <li>
            Go to{' '}
            <strong>
              APIs &amp; Services → Credentials → Create Credentials → OAuth client ID
            </strong>
            .
          </li>
          <li>
            Application type: <strong>Desktop application</strong>. Name: "Project Speedy".
          </li>
          <li>Click Create. Copy the Client ID and Client Secret into the form below.</li>
        </ol>
      </details>

      <form onSubmit={submit}>
        <label
          htmlFor="client-id"
          style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}
        >
          Client ID
        </label>
        <input
          id="client-id"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={clientId}
          onChange={(e) => setClientId((e.target as HTMLInputElement).value)}
          placeholder="123-abc.apps.googleusercontent.com"
          disabled={loading}
          style={inputStyle}
        />
        <label
          htmlFor="client-secret"
          style={{
            display: 'block',
            fontSize: '0.85rem',
            color: '#666',
            marginTop: '1rem',
            marginBottom: '0.5rem',
          }}
        >
          Client Secret
        </label>
        <input
          id="client-secret"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={clientSecret}
          onChange={(e) => setClientSecret((e.target as HTMLInputElement).value)}
          placeholder="GOCSPX-..."
          disabled={loading}
          style={inputStyle}
        />
        {error && (
          <p role="alert" style={{ color: '#c00', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} style={buttonStyle(loading)}>
          {loading ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
    </main>
  )
}

const inputStyle = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  fontSize: '1rem',
  fontFamily: 'monospace',
  border: '1px solid #ccc',
  borderRadius: 4,
}

const buttonStyle = (loading: boolean) => ({
  marginTop: '1.25rem',
  padding: '0.7rem 1.25rem',
  background: '#111',
  color: '#fff',
  border: 0,
  borderRadius: 4,
  cursor: loading ? 'not-allowed' : 'pointer',
  opacity: loading ? 0.6 : 1,
})
