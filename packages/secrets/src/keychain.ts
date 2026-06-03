import { Entry } from '@napi-rs/keyring'
import type { SecretStore } from './store.js'

const DEFAULT_SERVICE = 'com.projectspeedy'

/**
 * OS-native secret store backed by `@napi-rs/keyring`. On macOS this is the
 * system Keychain; on Linux it's libsecret; on Windows it's Credential Manager.
 * v1 only ships and tests on macOS.
 *
 * Keys are scoped to a service identifier (defaults to `com.projectspeedy`)
 * so secrets from other applications using the same library never collide.
 */
export class KeychainSecretStore implements SecretStore {
  private readonly serviceName: string

  constructor(serviceName: string = DEFAULT_SERVICE) {
    this.serviceName = serviceName
  }

  async get(key: string): Promise<string | null> {
    const entry = new Entry(this.serviceName, key)
    return entry.getPassword()
  }

  async set(key: string, value: string): Promise<void> {
    const entry = new Entry(this.serviceName, key)
    entry.setPassword(value)
  }

  async delete(key: string): Promise<void> {
    const entry = new Entry(this.serviceName, key)
    try {
      entry.deletePassword()
    } catch {
      // Already absent — treat as success (idempotent delete).
    }
  }
}
