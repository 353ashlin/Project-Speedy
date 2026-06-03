import { MockSecretStore } from '@speedy/secrets'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetupStep } from '../../../../src/server/settings'
import { handleAnthropicSetup } from './handler'

function makeDeps(opts: { validateResult: { ok: true } | { ok: false; error: string } }) {
  const setStep = vi.fn<(step: SetupStep) => void>()
  const secrets = new MockSecretStore()
  const validate = vi.fn(async (_apiKey: string) => opts.validateResult)
  return { validate, secrets, setStep }
}

describe('handleAnthropicSetup', () => {
  let deps: ReturnType<typeof makeDeps>

  beforeEach(() => {
    deps = makeDeps({ validateResult: { ok: true } })
  })

  it('returns 400 when body is not an object', async () => {
    const result = await handleAnthropicSetup(null, deps)
    expect(result.status).toBe(400)
    expect(deps.validate).not.toHaveBeenCalled()
    expect(await deps.secrets.get('anthropic_api_key')).toBeNull()
  })

  it('returns 400 when apiKey is missing', async () => {
    const result = await handleAnthropicSetup({}, deps)
    expect(result.status).toBe(400)
    expect(deps.validate).not.toHaveBeenCalled()
  })

  it('returns 400 when apiKey is the empty string', async () => {
    const result = await handleAnthropicSetup({ apiKey: '   ' }, deps)
    expect(result.status).toBe(400)
    expect(deps.validate).not.toHaveBeenCalled()
  })

  it('returns 401 when validation fails', async () => {
    deps = makeDeps({ validateResult: { ok: false, error: 'invalid_request_error' } })
    const result = await handleAnthropicSetup({ apiKey: 'sk-ant-bad' }, deps)
    expect(result.status).toBe(401)
    expect(result.body).toEqual({
      ok: false,
      error: expect.stringContaining('invalid_request_error'),
    })
    expect(await deps.secrets.get('anthropic_api_key')).toBeNull()
    expect(deps.setStep).not.toHaveBeenCalled()
  })

  it('stores key and advances setup step on success', async () => {
    const result = await handleAnthropicSetup({ apiKey: '  sk-ant-good  ' }, deps)
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true, next: '/setup/google-credentials' })
    expect(await deps.secrets.get('anthropic_api_key')).toBe('sk-ant-good')
    expect(deps.setStep).toHaveBeenCalledWith('google_credentials')
    expect(deps.setStep).toHaveBeenCalledTimes(1)
  })

  it('trims the key before storing and validating', async () => {
    await handleAnthropicSetup({ apiKey: '\n  sk-ant-good\t' }, deps)
    expect(deps.validate).toHaveBeenCalledWith('sk-ant-good')
    expect(await deps.secrets.get('anthropic_api_key')).toBe('sk-ant-good')
  })
})
