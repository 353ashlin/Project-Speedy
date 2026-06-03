# Project Speedy — v1 backlog

Twelve PRs that take an empty repo to a working dashboard showing your Gmail + Google Calendar, with people-graph and chronological feed views. After PR #12 the v1 milestone is hit; PRs #13+ are post-MVP polish.

**Conventions for every PR (from `CLAUDE.md`):**
- Trunk-based: branch `issue-<N>-<slug>` off `main`, PR to `main`.
- Target diff < 500 lines (occasional overage OK if splitting is artificial).
- PR body uses the `.github/pull_request_template.md` sections: **Scope (in/out)**, **Acceptance Criteria**, **Test Plan**, **Changelog entry**.
- No `--no-verify`, no force-push, no amend-after-push, no write-back features.
- One issue = one branch = one PR. No scope creep — if you discover a new sub-task, file a follow-up issue.

**Locked stack (from project memory):**
pnpm + Turborepo + TypeScript strict + Next.js 15 App Router + SQLite/Drizzle + Biome + Vitest + Playwright + `@napi-rs/keyring` + Anthropic Claude (Sonnet 4.6 + Haiku 4.5) + GitHub Actions. Read-only Google scopes always. No worker process in v1.

**Dependency graph:**

```
#1 ─┬─> #2 ──────────────────────────────> #7 ─> #8 ─┬─> #9  ─┐
    ├─> #3 ───────────────────────────────────────────┴─> #10 ─┴─> #11 ─> #12
    ├─> #4
    └─> #5 ─> #6 ─> #7
```

After #1 lands, #2 / #3 / #4 / #5 can all be picked up in parallel by separate Claude Code sessions.

---

## #1 — Monorepo skeleton + CI + harness docs

**Scope — In:**
- Root `package.json`: `private: true`, `packageManager: pnpm@9.x`, scripts `dev`, `build`, `typecheck`, `test`, `lint`, `format`.
- `pnpm-workspace.yaml` covering `apps/*` and `packages/*`.
- `turbo.json` with pipelines for `build`, `typecheck`, `test`, `lint`.
- `biome.json` with TypeScript + JSX rules; 2-space indent, single quotes, semicolons-as-needed.
- Root `tsconfig.json` (base): strict mode, `target: ES2022`, `moduleResolution: bundler`, workspace path aliases.
- `lefthook.yml`: pre-commit runs `biome check --staged` and `pnpm typecheck` on changed packages.
- `.github/workflows/ci.yml`: `typecheck` + `biome check` + `vitest run` + `playwright test` + `build`. Node 22, pnpm 9.
- `.github/pull_request_template.md` — four sections: **Scope**, **Acceptance Criteria**, **Test Plan**, **Changelog entry**.
- Root `CLAUDE.md` — repo conventions, "never do" list (no `--no-verify`, no force-push, no write-back features, ask before destructive, one PR per task, < 500 lines diff), architecture overview, where to find per-package CLAUDE.mds.
- `RUNBOOK.md` — stub sections for: add a connector, regenerate Google OAuth credentials, rotate Anthropic key, ship a release.
- `README.md` — one-paragraph project description + pointers to RUNBOOK and BACKLOG.
- `.gitignore` covering `node_modules/`, `.next/`, `.turbo/`, `.DS_Store`, `data/`, `*.local`, `coverage/`.
- `apps/.gitkeep` and `packages/.gitkeep`.

**Scope — Out:**
- Any app or package code.
- Branch protection rules on `main` (set manually via GitHub settings after this merges).
- Claude PR review GitHub Action (post-MVP issue).

**Acceptance Criteria:**
- `pnpm install` succeeds on a clean clone.
- `pnpm typecheck` exits 0.
- `pnpm lint` exits 0.
- `pnpm test` exits 0 (no tests yet = trivially passes).
- The CI workflow runs and goes green on the PR.
- `CLAUDE.md` references the locked stack, the < 500 line PR convention, and the never-do list.
- Opening Claude Code in the repo loads `CLAUDE.md` automatically.

**Test Plan:**
- Automated: the CI workflow on the PR is the test. Must be green.
- Manual: clone fresh, `pnpm install && pnpm lint && pnpm typecheck && pnpm test`, all clean.
- Manual: open a new Claude Code session in the repo dir, verify `CLAUDE.md` shows in context.

**Depends on:** —

---

## #2 — Next.js 15 web app shell

**Scope — In:**
- `apps/web/package.json`: Next.js 15.x, React 19.x.
- `apps/web/next.config.ts`.
- `apps/web/tsconfig.json` extending root.
- `apps/web/app/layout.tsx` — minimal root layout.
- `apps/web/app/page.tsx` — placeholder "Project Speedy — coming soon".
- `apps/web/CLAUDE.md` — package contract: routes live in `app/`, API in `app/api/`, no business logic in route handlers (delegate to `packages/*`).
- Vitest configured (`vitest.config.ts`).
- One trivial unit test (`app/page.test.tsx` rendering the placeholder).
- Playwright configured (`playwright.config.ts`).
- One trivial E2E (`e2e/smoke.spec.ts` opening `/` and asserting the placeholder text appears).
- Turborepo pipeline wiring so root `pnpm dev` starts the web app.

**Scope — Out:**
- Any setup-flow routes (those are #7, #8).
- DB integration (that's #3 / later).

**Acceptance Criteria:**
- `pnpm dev` from repo root boots `apps/web` on `localhost:3000`.
- Browser hitting `localhost:3000` shows the placeholder.
- `pnpm test` runs both Vitest and Playwright cleanly.
- CI now actually exercises something — confirm CI is green.

**Test Plan:**
- Unit: `app/page.test.tsx` renders, asserts placeholder text.
- E2E: `e2e/smoke.spec.ts` opens `/`, asserts placeholder visible.
- Manual: `pnpm dev` → open browser → confirm.

**Depends on:** #1

---

## #3 — `packages/db` — Drizzle + SQLite schema

**Scope — In:**
- `packages/db/package.json`.
- `packages/db/src/schema.ts` — Drizzle table definitions:
  - `people` — `id`, `display_name`, `relationship` enum (roommate / family / friend / coworker / unknown), `aliases` JSON, `known_emails` JSON, `known_phones` JSON, `known_handles` JSON, `birthday`, `created_at`, `updated_at`.
  - `email_messages` — `id`, `gmail_id`, `thread_id`, `from_person_id` FK, `to_person_ids` JSON, `subject`, `snippet`, `received_at`, `is_read`, `labels` JSON.
  - `calendar_events` — `id`, `gcal_id`, `title`, `start_at`, `end_at`, `location`, `attendee_person_ids` JSON, `description`.
  - `extracted_events` — `id`, `source_email_id` FK, `kind` enum (payment_received / payment_sent / bill_due / package_tracking / etc.), `payload` JSON, `from_person_id` FK nullable.
  - `sync_runs` — `id`, `connector`, `started_at`, `finished_at`, `status` enum, `error`, `items_synced`.
  - `user_settings` — single-row key/value or single-row typed columns; includes `setup_step`, `backfill_days_email`, `backfill_days_calendar`, `poll_interval_seconds`.
- `packages/db/drizzle.config.ts`.
- `packages/db/src/index.ts` — exports `getDb()` pointing at `./data/speedy.db` (created if missing).
- `packages/db/migrations/` — initial migration generated by Drizzle Kit.
- Vitest tests: schema migration applies cleanly to a temp SQLite file; insert + select round-trips for each table; foreign-key constraints enforced.

**Scope — Out:**
- Any sync logic (that's #9, #10).
- Entity resolution algorithm (basic exact-match in #4).

**Acceptance Criteria:**
- `pnpm --filter @speedy/db migrate` applies cleanly.
- Tests pass.
- `getDb()` returns a Drizzle instance with all tables visible via `select`.
- Foreign-key checks enforced (insert with bad FK fails).

**Test Plan:**
- Unit: temp-file DB, apply migrations, insert sample rows for each table, assert FKs reject bad references.
- Unit: rollback test — apply migration, drop, re-apply, data integrity preserved.

**Depends on:** #1

---

## #4 — `packages/core` — shared types + Connector interface

**Scope — In:**
- `packages/core/package.json`.
- `packages/core/src/types.ts` — domain TS types matching the DB schema: `Person`, `EmailMessage`, `CalendarEvent`, `ExtractedEvent`, `FeedItem` (discriminated union), `Identity` (an email / phone / handle reference for entity resolution).
- `packages/core/src/connector.ts` — the central abstraction:
  ```ts
  export interface Connector<Raw, Normalized> {
    name: string;
    auth(): Promise<void>;
    sync(opts: { since?: Date; cursor?: string }): AsyncIterable<Raw>;
    normalize(raw: Raw): Promise<Normalized[]>;
    recordFixture(opts: { outDir: string }): Promise<void>;
  }
  ```
- `packages/core/src/entity-resolution.ts` — `resolvePerson(identity: Identity): Promise<Person | null>` doing exact-match against `known_emails` / `known_phones` / `known_handles`. Returns null if no match (caller decides whether to create).
- `packages/core/CLAUDE.md` — explains the Connector interface, the resolution stub, where to add normalization helpers.
- Unit tests for `resolvePerson` covering hit, miss, and case-insensitive email matching.

**Scope — Out:**
- Fuzzy / AI-driven entity resolution (v2+ via "interactive resolution prompts" feature).
- Anything connector-specific.

**Acceptance Criteria:**
- Types match the schema fields exactly (compiler-enforced via Drizzle inferred types).
- `resolvePerson` works for exact-match cases.
- All tests pass.

**Test Plan:**
- Unit: seed a `Person` row with `known_emails: ['joe@gmail.com']`, call `resolvePerson({ kind: 'email', value: 'JOE@GMAIL.COM' })`, expect hit.
- Unit: `resolvePerson` returns null for unknown identity.
- Type-level test: import `EmailMessage` from `@speedy/core` and `@speedy/db`, assert assignability.

**Depends on:** #1, #3

---

## #5 — `packages/secrets` — keychain-backed SecretStore

**Scope — In:**
- `packages/secrets/package.json` with `@napi-rs/keyring` dep.
- `packages/secrets/src/index.ts` — `SecretStore` interface:
  ```ts
  export interface SecretStore {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  }
  ```
- `packages/secrets/src/keychain.ts` — `KeychainSecretStore` impl using `@napi-rs/keyring`, namespace `com.projectspeedy`.
- `packages/secrets/src/mock.ts` — in-memory impl for tests.
- `packages/secrets/CLAUDE.md` — explains: only `KeychainSecretStore` in app code, `MockSecretStore` only in tests. v2+ will add 1Password / Bitwarden backends behind the same interface.
- A `postinstall` script that imports `@napi-rs/keyring` once and exits — fails loudly if native module didn't build.
- Vitest: round-trip get/set/delete on `MockSecretStore`. (Skip keychain tests in CI — they require macOS user session.)

**Scope — Out:**
- 1Password / Bitwarden backends (deferred per locked decision).

**Acceptance Criteria:**
- `KeychainSecretStore.set('test', 'x')` followed by `.get('test')` returns `'x'` on a developer macOS machine.
- `postinstall` smoke check passes after `pnpm install`.
- Tests pass.

**Test Plan:**
- Unit: `MockSecretStore` round-trip.
- Manual: developer runs a one-line script that sets and reads a value via `KeychainSecretStore`, verifies the entry appears in Keychain Access.app.

**Depends on:** #1

---

## #6 — `packages/ai` — Anthropic LLM client

**Scope — In:**
- `packages/ai/package.json` with `@anthropic-ai/sdk`.
- `packages/ai/src/client.ts` — `LLMClient` interface:
  ```ts
  export interface LLMClient {
    chat(opts: { system?: string; messages: Msg[]; model: 'sonnet' | 'haiku' }): Promise<string>;
    extractJSON<T>(opts: { system?: string; prompt: string; schema: ZodSchema<T>; model: 'sonnet' | 'haiku' }): Promise<T>;
  }
  ```
- `packages/ai/src/anthropic.ts` — Anthropic impl using `claude-sonnet-4-6` and `claude-haiku-4-5-20251001`. Reads API key from `SecretStore.get('anthropic_api_key')`. Prompt caching enabled on system prompts.
- `packages/ai/src/mock.ts` — deterministic stub for tests.
- `packages/ai/CLAUDE.md` — model selection guidance (Sonnet for reasoning, Haiku for bulk), how to add a new prompt, how to mock for tests.
- `extractJSON` validates output with Zod and retries once on validation failure.
- Vitest: `MockLLMClient` returns programmable responses; verify `extractJSON` retry behavior.

**Scope — Out:**
- Specific prompts (those land with the features that use them — onboarding chat #13, summarization).
- Streaming responses (v2+).
- Local-model backend (v2+).

**Acceptance Criteria:**
- Smoke test: `AnthropicLLMClient.chat({ messages: [{role:'user', content:'reply "ok"'}], model:'haiku' })` returns a string containing "ok" (smoke test gated behind `RUN_LIVE_LLM_TESTS=1` env var so CI skips it).
- `extractJSON` returns parsed-and-validated output for a happy-path test.

**Test Plan:**
- Unit: Mock client round-trips.
- Unit: `extractJSON` retry on bad JSON.
- Manual (one-time): live test with real Anthropic key in keychain, verify cost is ~$0.0001.

**Depends on:** #1, #5

---

## #7 — Anthropic API key setup screen

**Scope — In:**
- Routes:
  - `/setup/welcome` — landing page describing the three setup steps, "Get started" button → `/setup/anthropic`.
  - `/setup/anthropic` — paste form for API key. Submit → `/api/setup/anthropic` POST.
- `apps/web/app/api/setup/anthropic/route.ts` — receives key, calls `AnthropicLLMClient.chat({ messages:[{role:'user',content:'reply "ok"'}], model:'haiku' })` to validate, stores via `SecretStore.set('anthropic_api_key', key)`, advances `user_settings.setup_step` to `google_credentials`.
- A `<SetupShell>` layout used by all setup routes — progress indicator (1 of N), consistent styling.
- Middleware: if `setup_step` is not `complete`, redirect any non-`/setup/*` request to the current setup step. (So you can't visit `/` until setup is done.)
- Vitest: API route returns 400 on missing key, 401 on invalid key (mocking the LLM client), 200 on valid.
- Playwright E2E: visit `/setup/anthropic`, fill the form, mock the validation, confirm redirect.

**Scope — Out:**
- Google credentials form (#8).
- A "reset setup" affordance (post-MVP).

**Acceptance Criteria:**
- Fresh DB → opening `/` redirects to `/setup/welcome`.
- Submitting a valid key advances setup step and redirects.
- Submitting an invalid key shows an inline error and does not advance.
- API key is stored in keychain, not the DB or `.env`.

**Test Plan:**
- Unit: route handler with mocked LLM client (200 / 401 / 400 cases).
- E2E: full flow with mocked LLM.
- Manual: real API key validates successfully.

**Depends on:** #2, #3, #5, #6

---

## #8 — Google OAuth setup + sign-in

**Scope — In:**
- New shared utility `packages/connectors/google-shared/` — token storage + auto-refresh client wrapped around `google-auth-library`. Reads/writes via `SecretStore` (`google_client_id`, `google_client_secret`, `google_refresh_token`, `google_access_token`, `google_access_token_expires_at`).
- Routes:
  - `/setup/google-credentials` — walkthrough page with step-by-step instructions for creating a GCP project + OAuth client (Desktop application type) + enabling Gmail + Calendar APIs. Includes a paste form for client ID + secret.
  - `/setup/google-signin` — single "Sign in with Google" button that initiates the Desktop loopback OAuth flow on a local port (e.g. `http://127.0.0.1:5712/oauth/callback`), opens the consent URL in the user's browser, captures the code, exchanges for tokens, stores in keychain, advances `setup_step` to `onboarding`.
- Scopes requested: `gmail.readonly`, `gmail.metadata`, `calendar.readonly`, `calendar.events.readonly`. Explicitly no `modify`/`send` scopes.
- API routes: `/api/setup/google-credentials` (POST), `/api/setup/google-signin/start`, `/api/setup/google-signin/callback`.
- `RUNBOOK.md` entry: "Regenerate Google OAuth credentials" — step-by-step.
- Vitest: token-refresh logic against a stubbed token endpoint (use `nock` or `msw`).
- E2E: stub the OAuth dance with fixture tokens, walk through the screens.

**Scope — Out:**
- Actually using the tokens for sync (#9, #10).

**Acceptance Criteria:**
- After `/setup/google-signin` completes, `SecretStore.get('google_refresh_token')` returns a non-null string.
- `setup_step` advances to `onboarding`.
- The `google-shared` client auto-refreshes an expired access token on next use.
- Read-only scopes only — verify the consent URL includes only the four locked scopes.

**Test Plan:**
- Unit: token refresh hits the right endpoint, stores updated access token.
- Unit: consent URL includes exact read-only scopes only.
- E2E: stubbed full flow including callback.
- Manual: real Google account, real consent screen, verify tokens land in keychain.

**Depends on:** #5, #7

---

## #9 — `packages/connectors/gmail` — sync + normalize + fixtures

**Scope — In:**
- `packages/connectors/gmail/package.json`.
- `packages/connectors/gmail/src/index.ts` — `GmailConnector` implementing `Connector`:
  - `sync({ since, cursor })` — uses `users.history.list` if `cursor` (historyId) present, else `users.messages.list` for backfill. Yields raw `gmail_v1.Schema$Message` objects.
  - `normalize(raw)` — maps to `EmailMessage` rows, calls `resolvePerson` for sender + recipients, creates new `Person` rows with `relationship: 'unknown'` for unmatched identities, returns the persisted rows.
  - `recordFixture({ outDir })` — calls the real API and writes redacted JSON files to `__fixtures__/`. Redaction script strips: full email bodies (keep first 200 chars), all phone numbers, all addresses other than the user's known contacts.
- `packages/connectors/gmail/__fixtures__/` — checked-in fixtures for at least: a regular reply, a thread with multiple participants, a Venmo notification email, a calendar invite forwarded as email.
- `packages/connectors/gmail/src/sync.test.ts` — contract tests replaying each fixture, asserting normalized output.
- `packages/connectors/gmail/CLAUDE.md` — describes the fixture-driven workflow and how to add a new fixture.
- Add `pnpm fixtures:record gmail` to root scripts.

**Scope — Out:**
- Known-sender parsers (Venmo extraction → `ExtractedEvent`) — that's #14.
- Attachment handling (v2+).
- Calendar events embedded in invite emails (v2+ — they'll arrive via Calendar API anyway).

**Acceptance Criteria:**
- `pnpm test` runs the contract tests, all green, using only fixtures.
- Backfill mode (no cursor, with `since`) fetches messages from the last N days; incremental mode (with cursor) fetches only new history.
- `normalize` produces `EmailMessage` rows with correct `from_person_id` resolution.
- Re-running `sync` is idempotent — no duplicate `email_messages` rows.

**Test Plan:**
- Unit: `normalize` on each fixture, snapshot the resulting rows.
- Unit: idempotency — run sync twice on the same fixture, assert row count unchanged.
- Manual: `pnpm fixtures:record gmail` against real account, verify fixtures are redacted before commit.

**Depends on:** #3, #4, #5, #8

---

## #10 — `packages/connectors/gcal` — sync + normalize + fixtures

**Scope — In:**
- `packages/connectors/gcal/package.json`.
- `packages/connectors/gcal/src/index.ts` — `GcalConnector` implementing `Connector`:
  - `sync({ since, cursor })` — uses `events.list` with `syncToken` for incremental, falls back to time-bounded listing for first backfill.
  - `normalize(raw)` — maps to `CalendarEvent` rows, resolves attendees to `Person`s via email match, creates `unknown` people for unmatched.
  - `recordFixture` — same shape as Gmail; redacts attendee data outside the known-contact set.
- `__fixtures__/` for: simple 1:1 event, multi-attendee event, all-day event, recurring event single instance.
- `gcal/src/sync.test.ts` contract tests.
- `gcal/CLAUDE.md`.
- Add to root `pnpm fixtures:record gcal`.

**Scope — Out:**
- Recurring-event expansion (just store the master rule for v1; future PRs can materialize instances).
- Attachment / Drive integration.

**Acceptance Criteria:**
- Contract tests green using only fixtures.
- Incremental sync via `syncToken` works (fixture for the "second sync" case).
- Idempotent re-sync.

**Test Plan:**
- Unit: normalize per fixture.
- Unit: idempotency.
- Manual: record fixtures against real account, verify redaction.

**Depends on:** #3, #4, #5, #8

---

## #11 — Backfill UI + `/api/sync/run` + auto-sync on mount

**Scope — In:**
- Routes:
  - `/setup/backfill` — full-screen first-run sync. Shows progress: "Pulling last 30 days of email… 142 / ~3,500", "Pulling next 60 days of calendar… 7 / 48", "Resolving people…". On completion, advance `setup_step: 'complete'` and redirect to `/`.
  - API: `POST /api/sync/run?connector=gmail|gcal|all` — triggers a sync, returns a stream (Server-Sent Events) of progress updates.
- Sync orchestrator in `apps/web/src/sync/run-sync.ts` — given a connector, opens an async iterable, batches normalized output into DB transactions, records `sync_run` row.
- `<SyncIndicator />` component on the dashboard layout — shows "Last synced Xm ago" + manual "Sync now" button + spinner during sync.
- Dashboard mount effect: if `Date.now() - last_sync_finished_at > 2 min`, trigger background sync.
- Error surfacing: 5 consecutive failed sync attempts shows a red banner "Background sync is failing — open RUNBOOK to debug".
- Vitest: orchestrator with mocked connector AsyncIterable.
- Playwright: open `/setup/backfill` with fixtures-mode connectors, watch progress, land on `/`.

**Scope — Out:**
- Worker process (deferred to v2).
- Sync history view (post-MVP).

**Acceptance Criteria:**
- First-run flow ends at `/` with rows in `email_messages` and `calendar_events`.
- "Sync now" button triggers a fresh poll and updates the last-synced indicator.
- Auto-sync triggers on mount when stale; doesn't trigger when fresh.
- A failing connector surfaces an error banner without crashing the dashboard.

**Test Plan:**
- Unit: orchestrator commits one transaction per N items, records `sync_run` row with correct status.
- Unit: auto-sync trigger logic (fresh vs stale) tested in isolation.
- E2E: full first-run flow with fixture-mode connectors, assert DB rows after, assert dashboard renders.

**Depends on:** #9, #10

---

## #12 — Feed + person profile pages (v1 demo milestone)

**Scope — In:**
- `/` (feed) — chronological merged stream of `EmailMessage` + `CalendarEvent` items. Each item is a card showing time, source icon, primary participant(s) as clickable links, snippet/title. Today's calendar pinned at the top. Infinite scroll back through history (or paginate, whichever is simpler).
- `/people/[id]` (person profile) — header with name + relationship + known handles + birthday. Tabs / sections: recent emails (last 20), upcoming events (next 5), past events (last 10), known identities. Click an email → opens detail modal with full body. Click an event → detail modal with all attendees.
- `/people` (people index) — searchable list of all `Person` rows, sortable by recent-interaction or alphabetical.
- Tailwind for styling (add Tailwind to `apps/web` if not already in #2; otherwise call it out). Minimal aesthetic: clean, monospaced timestamps, readable, no fancy.
- Vitest snapshot of feed sorting logic.
- Playwright: full first-run flow with fixtures, navigate to feed, click a person, verify profile renders with their data.

**Scope — Out:**
- AI summarization of threads (post-MVP).
- "Ask anything" Q&A box (post-MVP).
- Filtering / search beyond the people index.
- Dark mode (post-MVP).

**Acceptance Criteria:**
- Fresh first-run completes and `/` shows a chronological feed.
- Clicking any participant name navigates to `/people/[id]` and shows their data.
- `/people` lists every `Person` row with last-interaction timestamps.
- Empty states for "no events", "no emails" render cleanly.

**Test Plan:**
- Unit: feed-merge function correctly interleaves emails and events by timestamp.
- Unit: person-profile data assembly returns expected shape.
- E2E: load fixtures, render feed, click a person, render profile, click an email, see modal.
- Manual: real first-run on the developer's own Google account; verify it doesn't look terrible.

**Depends on:** #11

---

## Post-MVP polish (PRs #13+, not part of v1 milestone)

- **#13** — Conversational AI onboarding chat (`/setup/onboarding`). Uses `LLMClient.chat` with system prompt seeded by the relationship taxonomy. Asks for roommates, family, close friends. Creates `Person` rows.
- **#14** — Known-sender email parsers: Venmo received, Venmo sent, Stripe receipts, Amazon orders, common bill alerts. Each parser is a table-driven test with ≥ 5 fixtures.
- **#15** — Settings page (`/settings`) — backfill window, poll cadence, rotate Anthropic key, re-auth Google.
- **#16** — Claude PR review GitHub Action.
- **#17** — Dashboard "Ask anything" Q&A box (uses `LLMClient.chat` with the user's recent feed + person summaries as context).
- **#18** — Daily digest view ("This morning's summary"), still on-demand for v1; v2 could push notifications.
