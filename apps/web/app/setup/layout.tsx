import type { ReactNode } from 'react'

const STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'anthropic', label: 'Anthropic key' },
  { id: 'google_credentials', label: 'Google credentials' },
  { id: 'google_signin', label: 'Google sign-in' },
  { id: 'backfill', label: 'Sync your data' },
] as const

interface SetupLayoutProps {
  children: ReactNode
}

export default function SetupLayout({ children }: SetupLayoutProps) {
  return (
    <div
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '3rem 1.5rem',
      }}
    >
      <nav
        aria-label="Setup progress"
        style={{
          display: 'flex',
          gap: '0.5rem',
          fontSize: '0.85rem',
          color: '#888',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}
      >
        {STEPS.map((step, idx) => (
          <span key={step.id}>
            {idx > 0 && <span style={{ margin: '0 0.5rem' }}>→</span>}
            {step.label}
          </span>
        ))}
      </nav>
      {children}
    </div>
  )
}
