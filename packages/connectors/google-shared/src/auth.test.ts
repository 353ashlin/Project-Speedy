import { MockSecretStore } from '@speedy/secrets'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleOAuth, READ_ONLY_SCOPES } from './auth.js'

vi.mock('google-auth-library', () => {
  const getToken = vi.fn()
  const generateAuthUrl = vi.fn()
  const setCredentials = vi.fn()
  const refreshAccessToken = vi.fn()
  return {
    OAuth2Client: vi.fn().mockImplementation(() => ({
      getToken,
      generateAuthUrl,
      setCredentials,
      refreshAccessToken,
    })),
    __mocks: { getToken, generateAuthUrl, setCredentials, refreshAccessToken },
  }
})

// biome-ignore lint/suspicious/noExplicitAny: vitest mock import
const mocks = (await import('google-auth-library' as any)).__mocks as {
  getToken: ReturnType<typeof vi.fn>
  generateAuthUrl: ReturnType<typeof vi.fn>
  setCredentials: ReturnType<typeof vi.fn>
  refreshAccessToken: ReturnType<typeof vi.fn>
}

const REDIRECT = 'http://localhost:3000/api/setup/google-signin/callback'

describe('GoogleOAuth', () => {
  let secrets: MockSecretStore
  let auth: GoogleOAuth

  beforeEach(() => {
    vi.clearAllMocks()
    secrets = new MockSecretStore()
    auth = new GoogleOAuth(secrets, REDIRECT)
  })

  describe('credentials', () => {
    it('returns null when credentials are not stored', async () => {
      expect(await auth.loadCredentials()).toBeNull()
    })

    it('round-trips clientId and clientSecret', async () => {
      await auth.setCredentials({ clientId: 'cid', clientSecret: 'csec' })
      expect(await auth.loadCredentials()).toEqual({ clientId: 'cid', clientSecret: 'csec' })
      expect(await secrets.get('google_client_id')).toBe('cid')
      expect(await secrets.get('google_client_secret')).toBe('csec')
    })
  })

  describe('READ_ONLY_SCOPES', () => {
    it('contains exactly the four locked read-only scopes', () => {
      expect([...READ_ONLY_SCOPES]).toEqual([
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.metadata',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly',
      ])
    })

    it('does not include any modify or send scopes (design principle check)', () => {
      const forbidden = ['modify', 'send', 'compose', 'insert']
      for (const scope of READ_ONLY_SCOPES) {
        for (const word of forbidden) {
          expect(scope).not.toContain(word)
        }
      }
    })
  })

  describe('generateAuthUrl', () => {
    it('throws when credentials are not configured', async () => {
      await expect(auth.generateAuthUrl('s')).rejects.toThrow(/credentials not configured/i)
    })

    it('passes scopes, state, access_type, prompt to OAuth2Client', async () => {
      await auth.setCredentials({ clientId: 'cid', clientSecret: 'csec' })
      mocks.generateAuthUrl.mockReturnValueOnce('https://google.test/auth?stub')

      const url = await auth.generateAuthUrl('state-123')
      expect(url).toBe('https://google.test/auth?stub')
      expect(mocks.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: [...READ_ONLY_SCOPES],
        state: 'state-123',
        prompt: 'consent',
      })
    })
  })

  describe('exchangeCode', () => {
    it('throws when credentials are not configured', async () => {
      await expect(auth.exchangeCode('code')).rejects.toThrow(/credentials not configured/i)
    })

    it('stores refresh + access tokens on success', async () => {
      await auth.setCredentials({ clientId: 'cid', clientSecret: 'csec' })
      mocks.getToken.mockResolvedValueOnce({
        tokens: {
          refresh_token: 'rt-1',
          access_token: 'at-1',
          expiry_date: 1_900_000_000_000,
        },
      })

      await auth.exchangeCode('code-xyz')

      expect(mocks.getToken).toHaveBeenCalledWith('code-xyz')
      expect(await secrets.get('google_refresh_token')).toBe('rt-1')
      expect(await secrets.get('google_access_token')).toBe('at-1')
      expect(await secrets.get('google_access_token_expires_at')).toBe('1900000000000')
    })

    it('throws if Google returns no refresh token (already-authorized case)', async () => {
      await auth.setCredentials({ clientId: 'cid', clientSecret: 'csec' })
      mocks.getToken.mockResolvedValueOnce({
        tokens: { access_token: 'at-1' },
      })

      await expect(auth.exchangeCode('code')).rejects.toThrow(/refresh token/i)
      expect(await secrets.get('google_refresh_token')).toBeNull()
    })
  })

  describe('getAccessToken', () => {
    it('returns null when no refresh token is stored', async () => {
      await auth.setCredentials({ clientId: 'cid', clientSecret: 'csec' })
      expect(await auth.getAccessToken()).toBeNull()
    })

    it('returns the cached token when still valid', async () => {
      await auth.setCredentials({ clientId: 'cid', clientSecret: 'csec' })
      await secrets.set('google_refresh_token', 'rt')
      await secrets.set('google_access_token', 'at-cached')
      await secrets.set('google_access_token_expires_at', String(Date.now() + 600_000))

      expect(await auth.getAccessToken()).toBe('at-cached')
      expect(mocks.refreshAccessToken).not.toHaveBeenCalled()
    })

    it('refreshes when the cached token has expired', async () => {
      await auth.setCredentials({ clientId: 'cid', clientSecret: 'csec' })
      await secrets.set('google_refresh_token', 'rt')
      await secrets.set('google_access_token', 'at-old')
      await secrets.set('google_access_token_expires_at', String(Date.now() - 1000))

      mocks.refreshAccessToken.mockResolvedValueOnce({
        credentials: { access_token: 'at-new', expiry_date: Date.now() + 3_600_000 },
      })

      expect(await auth.getAccessToken()).toBe('at-new')
      expect(mocks.setCredentials).toHaveBeenCalledWith({ refresh_token: 'rt' })
      expect(await secrets.get('google_access_token')).toBe('at-new')
    })
  })

  describe('hasValidAuth', () => {
    it('returns false when no refresh token is stored', async () => {
      expect(await auth.hasValidAuth()).toBe(false)
    })

    it('returns true when a refresh token is stored', async () => {
      await secrets.set('google_refresh_token', 'rt')
      expect(await auth.hasValidAuth()).toBe(true)
    })
  })
})
