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
- `packages/connectors/gmail` — `GmailConnector` implementing the `Connector<gmail_v1.Schema$Message>` interface. Backfill via `users.messages.list`, incremental via `users.history.list`, RFC-2822 address-list parsing, dedup of People stubs, normalization into `NewEmailMessage` + `NewPerson[]` batches. 4 committed message fixtures (regular reply, multi-participant, Venmo notification, calendar invite). 13 vitest contract + parser tests.
- `packages/connectors/gcal` — `GcalConnector` implementing `Connector<calendar_v3.Schema$Event>`. Backfill via time-windowed `events.list`, incremental via `syncToken`. Handles timed events (UTC instant) and all-day events (midnight UTC + `isAllDay`). 4 committed event fixtures + 11 vitest tests.
- Sync orchestrator (`apps/web/src/server/sync/orchestrator.ts`): generic `runSync(connector, db, opts)` that records `sync_runs`, resolves people via SQLite `json_each` lookup against `known_emails`, inserts emails / events with resolved IDs, idempotent via UNIQUE constraints. 7 vitest tests.
- `/setup/backfill` page — Gmail then Calendar sequential sync with per-connector status, completion indicator, error display. Redirects to `/` on success.
- `POST /api/sync/run?connector=gmail|gcal|all` — single-shot sync runner.
- `POST /api/setup/complete` — advances setup state machine to `complete`.
- `Connector` contract extended with optional `emailLinks` / `eventLinks` arrays so the orchestrator can resolve person IDs after upserting people.
- **v1 demo milestone**: `/` dashboard renders a chronological feed (emails + calendar events newest-first), `/people` lists everyone in the graph sorted by recent interaction, `/people/[id]` shows a person profile with recent emails + upcoming events + past events.
- `SyncIndicator` header component — "Last synced X ago" + Sync now button + auto-sync on mount when data is > 2 min stale.
- `GET /api/feed` — JSON endpoint for client-side refresh of the dashboard.
- 9 vitest tests for the queries layer (`getFeed`, `listPeople`, `getPersonProfile`, `getLastSyncs`).
