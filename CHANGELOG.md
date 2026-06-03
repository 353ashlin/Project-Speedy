# Changelog

All user-visible changes to Project Speedy. Each entry corresponds to a merged PR.

The format is loosely [Keep a Changelog](https://keepachangelog.com/). Version stays `0.x.y` indefinitely — bump `y` per merge, `x` per milestone (e.g. v0.1 = first connector working end-to-end).

## [Unreleased]

### Added

- Monorepo scaffold: pnpm + Turborepo + TypeScript strict + Biome + lefthook + GitHub Actions CI.
- `CLAUDE.md`, `RUNBOOK.md`, `BACKLOG.md`, PR template — AI build harness docs.
- `apps/web` Next.js 15 web app shell with App Router + placeholder home page.
- Vitest + Playwright wired up with one unit test and one E2E smoke test.
- `packages/db` Drizzle ORM + better-sqlite3 schema with six tables (`people`, `email_messages`, `calendar_events`, `extracted_events`, `sync_runs`, `user_settings`) and forward migration.
- `packages/core` shared domain types, the `Connector` interface (read-only by design), and the entity-resolution algorithm (`findPersonByIdentity`).
- `packages/secrets` `SecretStore` interface with `KeychainSecretStore` (production, OS keychain via `@napi-rs/keyring`) and `MockSecretStore` (tests).
- `packages/ai` provider-agnostic `LLMClient` interface with `AnthropicLLMClient` (Sonnet 4.6 + Haiku 4.5, prompt-cached system prompts) and `MockLLMClient`. `extractJSON` retries once on bad JSON or schema validation failure.
- First-run setup: `/setup/welcome` and `/setup/anthropic` routes. Validates a pasted Anthropic API key with a one-token test call, stores it in macOS Keychain, advances the setup state machine. `/` redirects to the current setup step until setup is complete.
- `packages/connectors/google-shared` — `GoogleOAuth` wrapper around `google-auth-library` that persists credentials + tokens via `@speedy/secrets`. Locked read-only scopes (`gmail.readonly`, `gmail.metadata`, `calendar.readonly`, `calendar.events.readonly`) verified by a unit test that scans for forbidden write words.
- First-run setup: `/setup/google-credentials` (walkthrough + paste form) and `/setup/google-signin` (Sign-in button + error display). `/api/setup/google-signin/start` initiates the Desktop loopback OAuth flow with a CSRF state cookie; `/api/setup/google-signin/callback` validates state, exchanges code for tokens, advances setup to `onboarding`.
