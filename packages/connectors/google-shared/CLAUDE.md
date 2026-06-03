# CLAUDE.md — packages/connectors/google-shared

OAuth helpers + token storage shared by `packages/connectors/gmail` and
`packages/connectors/gcal`. Sole way the rest of the app talks to Google's
OAuth endpoints.

## Contract

- **`GoogleOAuth`** wraps `google-auth-library`'s `OAuth2Client` and uses
  `@speedy/secrets` for persistence. Construct it with `(secrets, redirectUri)`.
- **`READ_ONLY_SCOPES`** is the *only* scope set we ever request. Adding to
  this list requires explicit user approval. **Never** add `*.modify`,
  `*.send`, `*.compose`, `*.insert`, or any other write-grant scope —
  enforced by a unit test.
- **OAuth client type is "Desktop application"** — Google does not require
  pre-registration of the redirect URI for this type. Loopback is allowed.
- **`prompt: 'consent'`** is always set on the auth URL. Without it, repeat
  authorizations return `null` for `refresh_token`, which breaks long-term
  sync.

## Storage keys (in `@speedy/secrets`)

- `google_client_id`, `google_client_secret` — the OAuth client credentials.
- `google_refresh_token` — long-lived refresh token from the consent flow.
- `google_access_token`, `google_access_token_expires_at` — cached access
  token + expiry as a Unix ms timestamp string.

## Tests

`google-auth-library` is mocked with `vi.mock` so tests never hit Google.
The mocked client is shared across all tests in `auth.test.ts` — reset with
`vi.clearAllMocks()` in `beforeEach`.

## When the refresh fails

If `refreshAccessToken()` throws, the refresh token is likely revoked. The
caller (sync orchestrator) should:
1. Clear the stored tokens.
2. Surface a banner: "Google sign-in expired — re-authorize."
3. Direct the user back to `/setup/google-signin`.

This recovery flow lands in PR #11 (the sync orchestrator).
