/**
 * Abstract key-value store for secrets. Two implementations:
 *
 * - `KeychainSecretStore` — production: macOS Keychain via `@napi-rs/keyring`.
 *   Also works on Linux (libsecret) and Windows (Credential Manager) for free.
 * - `MockSecretStore` — tests only. In-memory.
 *
 * v2+ will add 1Password / Bitwarden backends behind this same interface,
 * chosen by the user during first-run setup.
 *
 * **Never** instantiate `KeychainSecretStore` from a test. CI runs on Linux
 * without a keyring service and will hang / crash.
 */
export interface SecretStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}
