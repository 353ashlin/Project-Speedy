import type { ZodType } from 'zod'

export type Role = 'user' | 'assistant'

export interface Msg {
  role: Role
  content: string
}

/**
 * Model identifier. Map to concrete model IDs inside the implementation
 * so consumers don't need to know the long versioned names.
 *
 * - `sonnet` — `claude-sonnet-4-6`. Reasoning, entity resolution, free-form Q&A.
 * - `haiku` — `claude-haiku-4-5-20251001`. Bulk summarization / classification.
 */
export type Model = 'sonnet' | 'haiku'

export interface ChatOptions {
  /** Optional system prompt. Cached aggressively in `AnthropicLLMClient`. */
  system?: string
  messages: Msg[]
  model: Model
  /** Defaults to 4096. */
  maxTokens?: number
}

export interface ExtractJSONOptions<T> {
  /** Optional system prompt (will be augmented with JSON-only instruction). */
  system?: string
  /** User prompt describing what to extract. */
  prompt: string
  /** Zod schema validated against the returned JSON. */
  schema: ZodType<T>
  model: Model
  maxTokens?: number
}

/**
 * The provider-agnostic interface used by everything in the app that wants
 * to talk to an LLM. v1 ships an Anthropic implementation; v2+ can add a
 * local-model (Ollama) backend behind this same interface as a config switch.
 *
 * `extractJSON` is implemented on top of `chat` in the shared base class —
 * impls only have to define `chat`.
 */
export interface LLMClient {
  chat(opts: ChatOptions): Promise<string>
  extractJSON<T>(opts: ExtractJSONOptions<T>): Promise<T>
}

/**
 * Shared `extractJSON` retry logic. Both `AnthropicLLMClient` and
 * `MockLLMClient` extend this and only have to implement `chat`.
 */
export abstract class BaseLLMClient implements LLMClient {
  abstract chat(opts: ChatOptions): Promise<string>

  async extractJSON<T>(opts: ExtractJSONOptions<T>): Promise<T> {
    const baseSystem = opts.system?.trim() ?? ''
    const jsonInstruction =
      'Respond with ONLY a single JSON value matching the requested schema. No prose, no markdown, no code fences.'
    const system = baseSystem ? `${baseSystem}\n\n${jsonInstruction}` : jsonInstruction

    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.chat({
        system,
        messages: [{ role: 'user', content: opts.prompt }],
        model: opts.model,
        maxTokens: opts.maxTokens,
      })
      try {
        return opts.schema.parse(JSON.parse(raw.trim()))
      } catch (err) {
        lastError = err
      }
    }
    const detail = lastError instanceof Error ? lastError.message : String(lastError)
    throw new Error(`extractJSON failed after retry: ${detail}`)
  }
}
