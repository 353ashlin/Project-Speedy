import { randomUUID } from 'node:crypto'
import { GoogleOAuth } from '@speedy/google-shared'
import { NextResponse } from 'next/server'
import { getSecrets } from '../../../../../src/server/secrets'

const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ?? 'http://localhost:3000/api/setup/google-signin/callback'

const STATE_COOKIE = 'google_oauth_state'
const STATE_COOKIE_MAX_AGE = 600 // 10 minutes

/**
 * Initiate the Google OAuth flow. Generates a CSRF state token, stores it
 * in an httpOnly cookie, and redirects the browser to Google's consent URL.
 */
export async function GET(req: Request) {
  const oauth = new GoogleOAuth(getSecrets(), REDIRECT_URI)
  const creds = await oauth.loadCredentials()
  if (!creds) {
    return NextResponse.redirect(
      new URL('/setup/google-credentials?error=missing_credentials', req.url),
    )
  }

  const state = randomUUID()
  const authUrl = await oauth.generateAuthUrl(state)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: STATE_COOKIE_MAX_AGE,
    path: '/',
  })
  return response
}
