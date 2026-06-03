import type { SecretStore } from '@speedy/secrets'
import type { SetupStep } from '../../../../src/server/settings'

export interface AnthropicSetupDeps {
  /** Validates the key against the real Anthropic endpoint. */
  validate: (apiKey: string) => Promise<{ ok: true } | { ok: false; error: string }>
  /** Where to persist the validated key. */
  secrets: SecretStore
  /** Advance the user_settings.setup_step field. */
  setStep: (step: SetupStep) => void
}

export interface AnthropicSetupResult {
  status: number
  body: { ok: true; next: string } | { ok: false; error: string }
}

const NEXT_STEP: SetupStep = 'google_credentials'

export async function handleAnthropicSetup(
  rawBody: unknown,
  deps: AnthropicSetupDeps,
): Promise<AnthropicSetupResult> {
  if (
    !rawBody ||
    typeof rawBody !== 'object' ||
    typeof (rawBody as { apiKey?: unknown }).apiKey !== 'string'
  ) {
    return {
      status: 400,
      body: { ok: false, error: 'Request must be JSON with a string `apiKey` field.' },
    }
  }

  const apiKey = ((rawBody as { apiKey: string }).apiKey ?? '').trim()
  if (!apiKey) {
    return { status: 400, body: { ok: false, error: 'apiKey is required.' } }
  }

  const result = await deps.validate(apiKey)
  if (!result.ok) {
    return {
      status: 401,
      body: {
        ok: false,
        error: `Anthropic rejected the key: ${result.error}`,
      },
    }
  }

  await deps.secrets.set('anthropic_api_key', apiKey)
  deps.setStep(NEXT_STEP)

  return { status: 200, body: { ok: true, next: '/setup/google-credentials' } }
}
