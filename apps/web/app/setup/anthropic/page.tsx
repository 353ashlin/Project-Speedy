'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

export default function AnthropicSetup() {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) {
      setError('Please paste your API key.')
      return
    }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/setup/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.trim() }),
    })

    if (res.ok) {
      const { next } = (await res.json()) as { next: string }
      router.push(next)
      return
    }

    const body = (await res.json().catch(() => ({}))) as { error?: string }
    setError(body.error ?? 'Failed to validate the key. Please try again.')
    setLoading(false)
  }

  return (
    <main>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Step 1: Anthropic API key</h1>
      <p style={{ color: '#444', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        Project Speedy uses Anthropic&apos;s Claude for entity resolution, summarization, and
        free-form Q&amp;A across your data. Your key is stored in the macOS Keychain, never in this
        repo or any file on disk.
      </p>
      <p style={{ color: '#444', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        Don&apos;t have a key yet? Create one at{' '}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
          style={{ color: '#0066cc' }}
        >
          console.anthropic.com/settings/keys
        </a>
        .
      </p>
      <form onSubmit={submit}>
        <label
          htmlFor="anthropic-api-key"
          style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}
        >
          API key
        </label>
        <input
          id="anthropic-api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => setApiKey((e.target as HTMLInputElement).value)}
          placeholder="sk-ant-..."
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.6rem 0.75rem',
            fontSize: '1rem',
            fontFamily: 'monospace',
            border: '1px solid #ccc',
            borderRadius: 4,
          }}
        />
        {error && (
          <p role="alert" style={{ color: '#c00', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '1.25rem',
            padding: '0.7rem 1.25rem',
            background: '#111',
            color: '#fff',
            border: 0,
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Validating…' : 'Validate and continue'}
        </button>
      </form>
    </main>
  )
}
