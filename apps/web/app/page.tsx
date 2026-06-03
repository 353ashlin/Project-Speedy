import { redirect } from 'next/navigation'
import { getSettings, setupStepToUrl } from '../src/server/settings'

// The dashboard reads runtime DB state. Don't prerender at build time.
export const dynamic = 'force-dynamic'

export default function Home() {
  const settings = getSettings()
  if (settings.setupStep !== 'complete') {
    redirect(setupStepToUrl(settings.setupStep))
  }
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Project Speedy</h1>
      <p style={{ color: '#666' }}>Dashboard coming soon.</p>
    </main>
  )
}
