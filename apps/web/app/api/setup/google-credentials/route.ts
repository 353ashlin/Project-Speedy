import { GoogleOAuth } from '@speedy/google-shared'
import { NextResponse } from 'next/server'
import { getSecrets } from '../../../../src/server/secrets'
import { setSetupStep } from '../../../../src/server/settings'
import { handleGoogleCredentials } from './handler'

const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ?? 'http://localhost:3000/api/setup/google-signin/callback'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const oauth = new GoogleOAuth(getSecrets(), REDIRECT_URI)
  const result = await handleGoogleCredentials(body, {
    storeCredentials: (creds) => oauth.setCredentials(creds),
    setStep: setSetupStep,
  })
  return NextResponse.json(result.body, { status: result.status })
}
