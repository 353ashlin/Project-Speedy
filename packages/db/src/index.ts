import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema.js'

export * from './schema.js'

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

const DEFAULT_DB_PATH = './data/speedy.db'
const DEFAULT_MIGRATIONS_PATH = resolve(import.meta.dirname ?? __dirname, '../drizzle')

export interface OpenDbOptions {
  /** Path to the SQLite file. Use `':memory:'` for an in-memory test database. */
  path?: string
  /** Path to the Drizzle migrations folder. */
  migrationsFolder?: string
  /** If true, apply migrations on open. Defaults to true. */
  runMigrations?: boolean
}

/**
 * Open (and migrate) the local SQLite database.
 *
 * - Creates the parent directory if it does not exist.
 * - Enables foreign-key enforcement (off by default in SQLite).
 * - Applies any pending migrations from the `drizzle/` folder.
 */
export function openDb(options: OpenDbOptions = {}): DrizzleDb {
  const path = options.path ?? DEFAULT_DB_PATH
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })

  if (options.runMigrations !== false) {
    const migrationsFolder = options.migrationsFolder ?? DEFAULT_MIGRATIONS_PATH
    migrate(db, { migrationsFolder })
  }

  return db
}
