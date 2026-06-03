# CLAUDE.md — packages/ai

The single LLM client for the whole app. Provider-agnostic interface so v2+
can swap in a local-model backend (Ollama / llama-cpp) without changing
call sites.

## Contract

- **`LLMClient` is the only interface consumers import.** Don't reach for the
  Anthropic SDK directly anywhere else in the repo.
- **`AnthropicLLMClient` is the production impl.** Reads the API key from
  `@speedy/secrets` (`anthropic_api_key`) lazily on first call.
- **`MockLLMClient` is the test impl.** Programmable response queue.
- **`BaseLLMClient` is an abstract base** that implements `extractJSON` on top
  of `chat`. New impls only have to implement `chat`.
- **`extractJSON` retries once on bad JSON or schema validation failure**, then
  throws. The retry is silent — callers do not see the first attempt.
- **System prompts use ephemeral prompt caching** (`cache_control: ephemeral`)
  on Anthropic so that repeated calls with the same system prompt are
  dramatically cheaper.

## Model selection

Two models. Pick by job:

| `model: 'sonnet'`                                 | `model: 'haiku'`                          |
| ------------------------------------------------- | ----------------------------------------- |
| Entity resolution                                 | Per-email classification                  |
| Conversational onboarding chat                    | Validation of pasted Anthropic API key    |
| Free-form Q&A ("did Joe pay rent in May?")        | Anything bulk / cheap / parallel          |
| Anything that needs reasoning over mixed context  | Anything you'd run >100x in a workflow    |

When in doubt: Haiku first. Only escalate to Sonnet if the output quality is
inadequate.

## Adding a new prompt

1. Land the prompt with the feature that uses it (not in this package). E.g.
   the onboarding-chat system prompt lives in `apps/web` near the onboarding
   route — close to the data shape the prompt produces.
2. Use Zod schemas for `extractJSON` outputs. Defining the schema *next to the
   prompt* makes the contract obvious and forces you to think about edge cases.
3. Add a Vitest using `MockLLMClient` that programs the canonical happy-path
   response and asserts the resulting type. This pins prompt-output contracts
   without paying API costs.

## What lives elsewhere

- The prompts themselves (live with the features that use them).
- Streaming responses (deferred to v2+).
- Local-model backend (deferred to v2+).
- Redaction layer in front of cloud calls (deferred to v2+).
