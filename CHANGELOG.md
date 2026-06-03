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
