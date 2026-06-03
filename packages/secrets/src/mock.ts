import type { SecretStore } from './store.js'

/**
 * In-memory `SecretStore` for tests. Never instantiate from production code —
 * the keychain is the source of truth and tests should not be aware of it.
 */
export class MockSecretStore implements SecretStore {
  private readonly store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  /** Test-only escape hatch. */
  size(): number {
    return this.store.size
  }
}
