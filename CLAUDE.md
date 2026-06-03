# CLAUDE.md — repo conventions for AI contributors

This file is loaded automatically by every Claude Code session in this repo. Read it before opening a PR.

## What this repo is

Project Speedy is a local personal "life OS" — a Next.js app that aggregates Google Calendar + Gmail (initially) into a people-graph + chronological feed. The full vision and v1 execution plan live in [`BACKLOG.md`](./BACKLOG.md). Operational playbooks live in [`RUNBOOK.md`](./RUNBOOK.md).

## Locked stack — do not change without explicit user approval

- **Package manager**: pnpm with workspaces.
- **Monorepo**: Turborepo.
- **Language**: TypeScript strict everywhere. No JavaScript files in source.
- **App framework**: Next.js 15 (App Router). Single web app at `apps/web`. **No separate worker process in v1** — sync runs in-process from the web app.
- **Database**: SQLite via `better-sqlite3` + Drizzle ORM. DB file lives at `./data/speedy.db` (gitignored).
- **Linter / formatter**: Biome (single tool). No ESLint, no Prettier.
- **Tests**: Vitest (unit) + Playwright (E2E for the dashboard).
- **Secrets**: macOS Keychain via `@napi-rs/keyring`. **Never** put secrets in `.env`. `.env.local` is for non-secret bootstrap config only.
- **LLM**: Anthropic Claude — `claude-sonnet-4-6` for reasoning, `claude-haiku-4-5-20251001` for bulk. Use prompt caching.
- **Git hooks**: lefthook runs `biome check` + `pnpm typecheck` pre-commit.
- **CI**: GitHub Actions — typecheck + biome + vitest + playwright + build.

## Design principles — non-negotiable

1. **Read-only forever.** All Google OAuth scopes are read-only (`gmail.readonly`, `gmail.metadata`, `calendar.readonly`, `calendar.events.readonly`). No AI feature ever sends, drafts, modifies, or deletes on the user's behalf. If a user request implies a write capability, push back and propose a read-only alternative.
2. **Local-first.** Data + secrets live on the user's machine. No cloud DB, no cloud secrets store.
3. **People-graph is the central abstraction.** Every email, event, payment, etc. is an edge attached to one or more `Person` nodes. Per-source dashboards are an anti-pattern here.
4. **Fixtures over live API calls in tests.** Connectors record real API responses once (`pnpm fixtures:record <connector>`) and replay them. CI never hits external APIs.
5. **No coverage-percentage gate.** Coverage is shown for visibility but does not block merge. The real gate is the PR template's "Test Plan" section + human reviewer asking *"if someone silently edited this wrong, would a test catch it?"*

## Workflow — every PR

- **One issue = one branch = one PR.** Branch name: `issue-<N>-<slug>`. Off `main`. Trunk-based.
- **Target diff: under 500 lines.** Occasional overage is OK if splitting would be artificial.
- **PR description must follow [`pull_request_template.md`](./.github/pull_request_template.md)**: Scope (in / out), Acceptance Criteria, Test Plan, Changelog entry.
- **Use `Closes #N` (or `Fixes #N`) in the PR description** to auto-close the linked issue on merge.
- **CI must be green** before merging. No skipping.
- **The user (Ashlin) is the sole reviewer** for v1.

## Never do — hard rules

- **No `--no-verify`** on commits. If a hook fails, fix the underlying issue.
- **No `git commit --amend`** on commits that have already been pushed.
- **No force-push to `main`.** Don't force-push to feature branches either unless absolutely necessary (and never silently).
- **No `git rebase -i`** in agent flows (requires interactive input).
- **No write-back features.** This is read-only forever. Don't propose `gmail.modify`, calendar create/update, draft generation, "smart reply", etc.
- **No silent scope expansion.** If you discover work that doesn't fit the issue you're on, file a follow-up issue — don't pile it into the current PR.
- **No introducing alternative tooling** to the locked stack (no Yarn, no npm, no ESLint, no Jest, no Prisma) without explicit user approval.
- **No fixture data with real PII.** The fixture recording script must redact email bodies (keep first 200 chars), phone numbers, and addresses for non-known-contacts before committing.

## Ask first — actions with high blast radius

- Modifying CI workflows or branch protection.
- Adding new top-level dependencies.
- Deleting / renaming files outside the issue's scope.
- Anything that touches the keychain or talks to a live external API.
- Migrating the database schema (always provide a forward + backward migration).

## Per-package CLAUDE.md

Each package may have its own `CLAUDE.md` describing its specific contract (e.g. the Connector interface in `packages/core`, the fixture workflow in `packages/connectors/*`). When working in a package, read that file first.

## When you're stuck

Don't guess. Flag the uncertainty to the user in chat. Prefer asking a clarifying question over making an irreversible action with shaky assumptions.
