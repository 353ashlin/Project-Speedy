# CLAUDE.md — packages/db

Drizzle ORM schema + migrations for the local SQLite database. The single
source of truth for what data Project Speedy persists.

## Contract

- **Schema lives in `src/schema.ts`.** All table definitions. Inferred types
  (`Person`, `NewPerson`, etc.) are exported from this file and re-exported
  from `src/index.ts`.
- **Migrations are generated, not hand-written.** Edit `src/schema.ts`, then
  run `pnpm --filter @speedy/db db:generate` to produce a new file in
  `drizzle/`. Commit both the schema change and the generated SQL.
- **Migrations apply automatically on `openDb()`** unless `runMigrations: false`
  is passed (tests use this for finer-grained control).
- **`openDb({ path })`** is the only way app code touches SQLite.
  - Pass `':memory:'` in tests.
  - Pass an absolute path in production. The directory is created if missing.
  - Foreign-key enforcement and WAL mode are always on.

## Conventions

- **Single-row `user_settings`.** Always insert / update with `id: 1`. There is
  one user, period.
- **Soft references via JSON `*_person_ids` arrays.** For multi-attendee
  relationships (event attendees, email recipients) we store a JSON array of
  person IDs rather than a join table. This is a deliberate denormalization —
  most queries fan out from a single person and care about the FROM/PRIMARY
  side anyway. Revisit only if a join-heavy query proves slow.
- **Timestamps**: stored as Unix epoch seconds (`integer { mode: 'timestamp' }`),
  exposed to TypeScript as `Date`. Defaults use SQLite's `unixepoch()`.
- **Booleans**: stored as `INTEGER` 0/1 (`integer { mode: 'boolean' }`).
- **JSON columns**: stored as TEXT, parsed by Drizzle. Always default to
  `'[]'` for array columns so reads never return `null`.

## When you add a new table

1. Add the table definition to `src/schema.ts`.
2. Export `$inferSelect` and `$inferInsert` types alongside the others at the
   bottom of `schema.ts`.
3. Run `pnpm --filter @speedy/db db:generate`.
4. Review the generated SQL — Drizzle Kit sometimes produces destructive
   migrations on column type changes. Edit if needed (but record why).
5. Add round-trip + FK tests to `src/index.test.ts`.

## When you change a column type

Stop. Migrations on SQLite are limited — column-type changes usually require
table recreation. Talk to the user before generating a destructive migration.

## What lives elsewhere

- Domain types that aren't 1:1 with a DB row: `@speedy/core`.
- Entity resolution algorithm: `@speedy/core/entity-resolution`.
- Anything that talks to a remote API: `@speedy/connectors/*`.
