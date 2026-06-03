import type { SecretStore } from '@speedy/secrets'
import { OAuth2Client } from 'google-auth-library'

/**
 * The four read-only scopes we request. Adding to this list requires
 * re-authorization. Removing requires nothing on the user's side.
 *
 * **Read-only is a design principle, not a default.** Do not add
 * `gmail.modify`, `gmail.send`, `calendar.events`, or anything that grants
 * write capability without overturning the design principle in CLAUDE.md.
 */
export const READ_ONLY_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
] as const

const ACCESS_TOKEN_BUFFER_MS = 60_000

export interface GoogleCredentials {
  clientId: string
  clientSecret: string
}

/**
 * Wrapper around Google's OAuth2Client that persists credentials and tokens
 * via `SecretStore` instead of in-memory. Used by both the setup-flow
 * routes and the Gmail / GCal connectors.
 *
 * The OAuth client is **Desktop application** type, which uses the loopback
 * flow — the redirect URI is `http://localhost:<port>/...` and Google does
 * not require it to be pre-registered.
 */
export class GoogleOAuth {
  private readonly secrets: SecretStore
  private readonly redirectUri: string

  constructor(secrets: SecretStore, redirectUri: string) {
    this.secrets = secrets
    this.redirectUri = redirectUri
  }

  async loadCredentials(): Promise<GoogleCredentials | null> {
    const clientId = await this.secrets.get('google_client_id')
    const clientSecret = await this.secrets.get('google_client_secret')
    if (!clientId || !clientSecret) return null
    return { clientId, clientSecret }
  }

  async setCredentials(creds: GoogleCredentials): Promise<void> {
    await this.secrets.set('google_client_id', creds.clientId)
    await this.secrets.set('google_client_secret', creds.clientSecret)
  }

  /**
   * Build the consent URL the user is redirected to. `state` should be a
   * cryptographically random value the caller persists (e.g. in a cookie)
   * and verifies on the callback.
   */
  async generateAuthUrl(state: string): Promise<string> {
    const creds = await this.loadCredentials()
    if (!creds) throw new Error('Google credentials not configured.')
    const client = new OAuth2Client({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      redirectUri: this.redirectUri,
    })
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: [...READ_ONLY_SCOPES],
      state,
      // `prompt: 'consent'` forces Google to re-show the consent screen even
      // for previously-authorized users — guarantees we always get a refresh
      // token back (without this, repeat auths return null refresh_token).
      prompt: 'consent',
    })
  }

  /**
   * Exchange the authorization code from the callback for tokens, persist
   * them via the SecretStore. Throws if no refresh token comes back — that
   * usually means the user already authorized this client and Google
   * suppressed the refresh; revoke at https://myaccount.google.com/permissions
   * and try again.
   */
  async exchangeCode(code: string): Promise<void> {
    const creds = await this.loadCredentials()
    if (!creds) throw new Error('Google credentials not configured.')
    const client = new OAuth2Client({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      redirectUri: this.redirectUri,
    })
    const { tokens } = await client.getToken(code)
    if (!tokens.refresh_token) {
      throw new Error(
        'Google did not return a refresh token. Revoke this app at https://myaccount.google.com/permissions and try again.',
      )
    }
    await this.secrets.set('google_refresh_token', tokens.refresh_token)
    if (tokens.access_token) {
      await this.secrets.set('google_access_token', tokens.access_token)
    }
    if (tokens.expiry_date) {
      await this.secrets.set('google_access_token_expires_at', String(tokens.expiry_date))
    }
  }

  /**
   * Returns a fresh access token, refreshing it via the stored refresh token
   * if necessary. Returns null if the user has not completed sign-in yet.
   */
  async getAccessToken(): Promise<string | null> {
    const expiresAt = await this.secrets.get('google_access_token_expires_at')
    const currentToken = await this.secrets.get('google_access_token')

    if (currentToken && expiresAt) {
      const expiry = Number.parseInt(expiresAt, 10)
      if (Number.isFinite(expiry) && expiry > Date.now() + ACCESS_TOKEN_BUFFER_MS) {
        return currentToken
      }
    }

    const creds = await this.loadCredentials()
    const refreshToken = await this.secrets.get('google_refresh_token')
    if (!creds || !refreshToken) return null

    const client = new OAuth2Client({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    })
    client.setCredentials({ refresh_token: refreshToken })
    const { credentials } = await client.refreshAccessToken()

    if (credentials.access_token) {
      await this.secrets.set('google_access_token', credentials.access_token)
      if (credentials.expiry_date) {
        await this.secrets.set('google_access_token_expires_at', String(credentials.expiry_date))
      }
      return credentials.access_token
    }

    return null
  }

  async hasValidAuth(): Promise<boolean> {
    return (await this.secrets.get('google_refresh_token')) !== null
  }
}
