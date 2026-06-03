import { GoogleOAuth } from '@speedy/google-shared'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSecrets } from '../../../../../src/server/secrets'
import { setSetupStep } from '../../../../../src/server/settings'

const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ?? 'http://localhost:3000/api/setup/google-signin/callback'

const STATE_COOKIE = 'google_oauth_state'

function failureRedirect(req: Request, reason: string): NextResponse {
  const url = new URL('/setup/google-signin', req.url)
  url.searchParams.set('error', reason)
  return NextResponse.redirect(url)
}

/**
 * Google redirects here after the user consents. Validates the state token
 * against the cookie set by /start, then exchanges the code for tokens via
 * google-auth-library.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    return failureRedirect(req, errorParam)
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(STATE_COOKIE)?.value
  if (!state || !expectedState || state !== expectedState) {
    return failureRedirect(req, 'state_mismatch')
  }
  if (!code) {
    return failureRedirect(req, 'missing_code')
  }

  try {
    const oauth = new GoogleOAuth(getSecrets(), REDIRECT_URI)
    await oauth.exchangeCode(code)
    setSetupStep('onboarding')
    const response = NextResponse.redirect(new URL('/setup/onboarding', req.url))
    response.cookies.delete(STATE_COOKIE)
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return failureRedirect(req, message)
  }
}
