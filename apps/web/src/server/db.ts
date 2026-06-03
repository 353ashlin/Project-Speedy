import { type DrizzleDb, openDb } from '@speedy/db'

declare global {
  var __speedyDb: DrizzleDb | undefined
}

/**
 * Singleton Drizzle DB connection. Cached on `globalThis` so Next.js dev-mode
 * hot reloads don't spawn a fresh better-sqlite3 handle per request.
 */
export function getDb(): DrizzleDb {
  if (!globalThis.__speedyDb) {
    const path = process.env.DATABASE_URL ?? './data/speedy.db'
    globalThis.__speedyDb = openDb({ path })
  }
  return globalThis.__speedyDb
}
