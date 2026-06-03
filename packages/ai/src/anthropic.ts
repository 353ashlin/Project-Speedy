import Anthropic from '@anthropic-ai/sdk'
import type { SecretStore } from '@speedy/secrets'
import { BaseLLMClient, type ChatOptions, type Model } from './client.js'

const MODEL_IDS: Record<Model, string> = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
}

const DEFAULT_MAX_TOKENS = 4096

/**
 * Anthropic-backed `LLMClient`. The API key is read from the `SecretStore`
 * (key: `anthropic_api_key`) lazily on first call — constructing this client
 * does not require the key to exist yet, which lets us instantiate it during
 * first-run setup before the user has pasted their key.
 *
 * System prompts use ephemeral prompt caching (`cache_control: ephemeral`)
 * so that repeated calls with the same system prompt are dramatically cheaper
 * and faster.
 */
export class AnthropicLLMClient extends BaseLLMClient {
  private readonly secrets: SecretStore
  private clientPromise: Promise<Anthropic> | null = null

  constructor(secrets: SecretStore) {
    super()
    this.secrets = secrets
  }

  private async client(): Promise<Anthropic> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const apiKey = await this.secrets.get('anthropic_api_key')
        if (!apiKey) {
          throw new Error('Anthropic API key not configured. Run setup to paste your key.')
        }
        return new Anthropic({ apiKey })
      })()
    }
    return this.clientPromise
  }

  override async chat(opts: ChatOptions): Promise<string> {
    const client = await this.client()
    const response = await client.messages.create({
      model: MODEL_IDS[opts.model],
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: opts.system
        ? [
            {
              type: 'text' as const,
              text: opts.system,
              cache_control: { type: 'ephemeral' as const },
            },
          ]
        : undefined,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    })

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
  }

  /** Test-only escape hatch — lets us null the cached client mid-test. */
  resetClient(): void {
    this.clientPromise = null
  }
}

/**
 * One-shot validation of a proposed Anthropic API key. Used during first-run
 * setup to verify the user pasted a real, working key before persisting it
 * to the keychain. Uses Haiku for the cheapest possible round-trip.
 */
export async function validateAnthropicApiKey(
  apiKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!apiKey || typeof apiKey !== 'string') {
    return { ok: false, error: 'API key must be a non-empty string.' }
  }
  try {
    const client = new Anthropic({ apiKey })
    await client.messages.create({
      model: MODEL_IDS.haiku,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'reply ok' }],
    })
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
