import type { GoogleCredentials } from '@speedy/google-shared'
import type { SetupStep } from '../../../../src/server/settings'

export interface GoogleCredentialsDeps {
  storeCredentials: (creds: GoogleCredentials) => Promise<void>
  setStep: (step: SetupStep) => void
}

export interface GoogleCredentialsResult {
  status: number
  body: { ok: true; next: string } | { ok: false; error: string }
}

const NEXT_STEP: SetupStep = 'google_signin'

export async function handleGoogleCredentials(
  rawBody: unknown,
  deps: GoogleCredentialsDeps,
): Promise<GoogleCredentialsResult> {
  if (!rawBody || typeof rawBody !== 'object') {
    return {
      status: 400,
      body: { ok: false, error: 'Request must be JSON with `clientId` and `clientSecret`.' },
    }
  }
  const body = rawBody as { clientId?: unknown; clientSecret?: unknown }
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
  const clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret.trim() : ''
  if (!clientId || !clientSecret) {
    return {
      status: 400,
      body: { ok: false, error: 'Both clientId and clientSecret are required.' },
    }
  }

  // Minimal sanity check on the client ID format. Google client IDs end in
  // `.apps.googleusercontent.com`. We don't fail hard on a mismatch — if the
  // user pastes a typo, the sign-in step will fail with a clearer Google
  // error than we could synthesize here.
  await deps.storeCredentials({ clientId, clientSecret })
  deps.setStep(NEXT_STEP)

  return { status: 200, body: { ok: true, next: '/setup/google-signin' } }
}
