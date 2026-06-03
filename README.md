# Project Speedy

A local "life OS" — a personal dashboard that aggregates Google Calendar and Gmail (with more sources in later versions) into a single interface that connects people, timing, and context. Read-only by design. Local-first. Built collaboratively with AI agents.

The v1 demo: you open `localhost:3000`, complete a ~10 minute setup, and see a chronological feed of everything happening in your life across email + calendar, plus per-person profiles that aggregate every interaction you've had with each person.

## Quick start

```sh
pnpm install
pnpm dev
```

Open `http://localhost:3000` and follow the first-run setup walkthrough. Setup needs an Anthropic API key and a Google Cloud OAuth client (Desktop application type) — the in-app walkthrough guides you through each.

Requires: Node 22+, pnpm 9+, macOS (for keychain integration).

## Documentation

- [`BACKLOG.md`](./BACKLOG.md) — full v1 plan and post-MVP roadmap. Twelve PRs to a working dashboard.
- [`RUNBOOK.md`](./RUNBOOK.md) — operational playbook: setup, add a connector, debug sync, rotate credentials.
- [`CLAUDE.md`](./CLAUDE.md) — repo conventions for AI contributors. Required reading before opening a PR.

## Project structure

```
apps/
  web/              Next.js 15 App Router — UI + API routes
packages/
  db/               Drizzle schema + migrations (SQLite)
  core/             Shared domain types, Connector interface, entity resolution
  secrets/          OS keychain wrapper (@napi-rs/keyring)
  ai/               Anthropic LLM client
  connectors/
    google-shared/  OAuth + token refresh for Google APIs
    gmail/          Gmail connector
    gcal/           Google Calendar connector
```

## Design principles

- **Read-only, always.** The app observes; it never sends, drafts, or modifies. All OAuth scopes are read-only. No AI feature has write capability.
- **Local-first.** Data lives in a SQLite file on your machine. Secrets in the OS keychain. Nothing in `.env`.
- **People-graph.** Email threads, calendar events, and (in later versions) payments and messages attach to person nodes, not sources. The killer feature is "everything about Joe" in one place.
- **Cloud LLM, on-demand.** Claude (Sonnet 4.6 + Haiku 4.5) is called when the user asks something or runs entity resolution. No preemptive batch summarization.

## License

Personal project. No license offered.
