import { KeychainSecretStore, type SecretStore } from '@speedy/secrets'

let store: SecretStore | null = null

/**
 * Singleton `SecretStore` for the production app. Always returns
 * `KeychainSecretStore`. Tests should construct `MockSecretStore` directly
 * and pass it to the function under test — do not patch this module.
 */
export function getSecrets(): SecretStore {
  if (!store) {
    store = new KeychainSecretStore()
  }
  return store
}
