import type { GoogleCredentials } from '@speedy/google-shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetupStep } from '../../../../src/server/settings'
import { handleGoogleCredentials } from './handler'

function makeDeps() {
  const storeCredentials = vi.fn<(creds: GoogleCredentials) => Promise<void>>()
  storeCredentials.mockResolvedValue(undefined)
  const setStep = vi.fn<(step: SetupStep) => void>()
  return { storeCredentials, setStep }
}

describe('handleGoogleCredentials', () => {
  let deps: ReturnType<typeof makeDeps>

  beforeEach(() => {
    deps = makeDeps()
  })

  it('returns 400 when body is not an object', async () => {
    const result = await handleGoogleCredentials(null, deps)
    expect(result.status).toBe(400)
    expect(deps.storeCredentials).not.toHaveBeenCalled()
  })

  it('returns 400 when clientId is missing', async () => {
    const result = await handleGoogleCredentials({ clientSecret: 'csec' }, deps)
    expect(result.status).toBe(400)
  })

  it('returns 400 when clientSecret is missing', async () => {
    const result = await handleGoogleCredentials({ clientId: 'cid' }, deps)
    expect(result.status).toBe(400)
  })

  it('returns 400 when either field is whitespace-only', async () => {
    const r1 = await handleGoogleCredentials({ clientId: '   ', clientSecret: 'csec' }, deps)
    expect(r1.status).toBe(400)
    const r2 = await handleGoogleCredentials({ clientId: 'cid', clientSecret: '\t\n' }, deps)
    expect(r2.status).toBe(400)
  })

  it('stores credentials and advances setup step on success', async () => {
    const result = await handleGoogleCredentials(
      { clientId: '  cid-123  ', clientSecret: '  csec-abc  ' },
      deps,
    )
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true, next: '/setup/google-signin' })
    expect(deps.storeCredentials).toHaveBeenCalledWith({
      clientId: 'cid-123',
      clientSecret: 'csec-abc',
    })
    expect(deps.setStep).toHaveBeenCalledWith('google_signin')
  })
})
