# CLAUDE.md — packages/connectors/gmail

Read-only Gmail connector. Backfill via `users.messages.list`, incremental
via `users.history.list`. Normalizes raw Gmail messages into the People graph.

## Contract

- **Implements `Connector<gmail_v1.Schema$Message>`** from `@speedy/core`.
- **Read-only.** Uses only `gmail.readonly` + `gmail.metadata` scopes. Never
  add `gmail.modify`, `gmail.send`, or `gmail.compose`.
- **Connector emits people stubs.** `normalize` returns `NewPerson` rows for
  every unique email address it sees, always `relationship: 'unknown'`. The
  sync orchestrator (#11) resolves these to real `Person` IDs and patches
  `from_person_id` / `to_person_ids` on the email row.

## Fixtures

`__fixtures__/messages/*.json` — hand-curated Gmail message JSON, shaped to
match `gmail_v1.Schema$Message`. Used by contract tests and (eventually) the
`pnpm fixtures:record gmail` script.

When adding a new fixture:
1. Make it minimal — only the fields the normalizer actually reads (`id`,
   `threadId`, `labelIds`, `internalDate`, `snippet`, `payload.headers`).
2. Cover one specific edge case per fixture.
3. Add a test in `normalize.test.ts` that asserts the expected batch.

## Sync semantics

- **Backfill**: `sync({ since })` lists messages with `q: 'after:<epoch>'`,
  pages through results, fetches each message via `get`. One `yield` per
  raw message.
- **Incremental**: `sync({ cursor: historyId })` calls `users.history.list`
  with `historyTypes: ['messageAdded']`, then `get`s each added message.

Both modes yield one raw message at a time. The orchestrator batches into DB
transactions.

## Known v1 limitations

- **Address parser does not handle**: RFC group syntax, comments, escaped
  commas inside quoted display names. These are vanishingly rare in personal
  email; if they bite us we add a real RFC-2822 parser.
- **No attachments**. Filesize, MIME type, attachment metadata — all dropped
  by `normalize`. v2+.
- **No HTML / plaintext body** stored. Only `snippet` (Gmail's first ~200
  chars). v2+ if needed.
- **No event extraction**. Venmo / Stripe / bill parsers ship in PR #14.

## When the access token is missing or expired

`auth` / `client` both call `oauth.getAccessToken()`. That function refreshes
silently if the access token is expired but the refresh token is valid. If
the refresh token itself is revoked, the call returns null and the connector
throws "not authorized". The sync orchestrator catches this, marks the
`sync_run` as failed, and surfaces a "re-authorize" banner.
