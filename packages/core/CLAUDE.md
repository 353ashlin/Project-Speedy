# CLAUDE.md — packages/core

Shared domain types, the `Connector` interface, and the entity resolution
algorithm. Pure TypeScript — no I/O, no DB, no network. Safe to import from
anywhere in the monorepo.

## Contract

- **Re-export DB types**, do not duplicate them. If a type maps 1:1 to a DB
  row, it lives in `@speedy/db/schema`. `packages/core` re-exports for
  ergonomics so consumers can `import type { Person } from '@speedy/core'`.
- **Add new types here only when they describe something *between* tables** —
  the People graph, the unified feed (`FeedItem`), identity resolution
  (`Identity`).
- **`Connector<Raw>` is the central abstraction.** Every connector under
  `packages/connectors/*` implements it. The interface is intentionally read-only:
  `auth`, `sync`, `normalize`, `recordFixture`. Don't add `send`, `update`, or
  `delete` — those would violate the read-only design principle.
- **Entity resolution is a pure function over a loaded list of People.** The
  caller fetches People from the DB, then passes them to
  `findPersonByIdentity`. For v1 graph sizes (< a few thousand) this is fine.

## Conventions

- **Imports use `import type`** for type-only references (root tsconfig has
  `verbatimModuleSyntax: true`).
- **All `.js` extensions** in import paths — Node ESM requires them, even when
  importing TypeScript. `import { x } from './foo.js'` resolves to `./foo.ts`
  at build time.

## Known v1 limitations (documented in code)

- **Phone normalization is a dumb digit-strip.** Numbers with mismatched
  country codes won't match. libphonenumber is v2+.
- **Entity resolution is exact-match only.** No fuzzy / nickname / LLM-driven
  resolution. The "interactive resolution prompts" feature in BACKLOG.md
  covers the smarter v2+ version.

## When you add a new domain type

1. Add it to `src/types.ts` and re-export via `src/index.ts`.
2. If it has identity semantics (variants, normalization rules), write tests.
3. Don't put it in `packages/db` unless it's literally a table row shape.
