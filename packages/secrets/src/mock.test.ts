import { beforeEach, describe, expect, it } from 'vitest'
import { MockSecretStore } from './mock.js'

describe('MockSecretStore', () => {
  let store: MockSecretStore

  beforeEach(() => {
    store = new MockSecretStore()
  })

  it('returns null for missing keys', async () => {
    expect(await store.get('missing')).toBeNull()
  })

  it('round-trips set / get', async () => {
    await store.set('anthropic_api_key', 'sk-ant-test')
    expect(await store.get('anthropic_api_key')).toBe('sk-ant-test')
  })

  it('overwrites on repeated set', async () => {
    await store.set('k', 'v1')
    await store.set('k', 'v2')
    expect(await store.get('k')).toBe('v2')
  })

  it('removes value on delete', async () => {
    await store.set('k', 'v')
    await store.delete('k')
    expect(await store.get('k')).toBeNull()
  })

  it('delete is idempotent', async () => {
    await store.delete('never-set')
    expect(await store.get('never-set')).toBeNull()
  })

  it('isolates distinct keys', async () => {
    await store.set('a', '1')
    await store.set('b', '2')
    expect(await store.get('a')).toBe('1')
    expect(await store.get('b')).toBe('2')
    expect(store.size()).toBe(2)
  })
})
