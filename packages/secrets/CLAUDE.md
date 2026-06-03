# CLAUDE.md — packages/secrets

Two-impl `SecretStore` abstraction: keychain for production, in-memory mock
for tests. Holds Anthropic API key, Google OAuth client ID + secret, Google
OAuth refresh + access tokens — anything that must never end up in `.env` or
the SQLite DB.

## Contract

- **Production code** instantiates `KeychainSecretStore`. Always.
- **Tests** instantiate `MockSecretStore`. Never the keychain.
- **Never put a secret in `.env`** (`.env.local` is reserved for non-secret
  bootstrap config like `PORT`, `NODE_ENV`).
- **Never put a secret in SQLite.** The DB is for application data only.
- **Storage keys are scoped to `com.projectspeedy`** by default. This prevents
  collisions with other apps using `@napi-rs/keyring`.

## Storage keys in use (canonical names)

- `anthropic_api_key`
- `google_client_id`
- `google_client_secret`
- `google_refresh_token`
- `google_access_token`
- `google_access_token_expires_at` (ISO 8601 string)

Add new keys here when introducing them. Use snake_case.

## v2+ backends (deferred)

The `SecretStore` interface exists specifically so v2+ can swap in
`OnePasswordSecretStore` or `BitwardenSecretStore` without changing call
sites. Pick the implementation based on the user's first-run choice.

## Cross-platform

`@napi-rs/keyring` handles macOS / Linux (libsecret) / Windows (Credential
Manager) — but v1 only tests on macOS. CI uses the mock; we never exercise
the keychain on Linux runners because they have no keyring service.

## When the postinstall fails

The `postinstall.cjs` smoke-loads the native module. If it fails:

1. Look at the error — usually a missing prebuilt for your platform/Node combo.
2. Try `pnpm install --force` to rebuild.
3. Worst case, file an issue against `@napi-rs/keyring` upstream.
