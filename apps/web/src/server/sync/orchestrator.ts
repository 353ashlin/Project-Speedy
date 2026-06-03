import type { Connector, NormalizedBatch } from '@speedy/core'
import type { DrizzleDb, Person } from '@speedy/db'
import { calendarEvents, emailMessages, people, syncRuns } from '@speedy/db'
import { eq, sql } from 'drizzle-orm'

export interface SyncProgressEvent {
  kind: 'started' | 'item' | 'finished' | 'failed'
  connector: string
  itemsSynced?: number
  error?: string
}

export interface SyncOptions {
  since?: Date
  cursor?: string
  onProgress?: (event: SyncProgressEvent) => void
}

export interface SyncResult {
  connector: string
  itemsSynced: number
  syncRunId: number
  status: 'success' | 'failed'
  error?: string
}

/**
 * Run one connector end-to-end against the DB. The orchestrator:
 *
 * 1. Records a `sync_runs` row in `running` state.
 * 2. Calls `connector.auth()` (throws if not authorized).
 * 3. Iterates `connector.sync(opts)`, calls `normalize` per raw item.
 * 4. Applies each `NormalizedBatch` inside `applyBatch` — which upserts
 *    People by email, then inserts emails / events with their
 *    `from_person_id` / `to_person_ids` / `attendee_person_ids` resolved.
 * 5. Marks the `sync_runs` row `success` (or `failed` with the error).
 *
 * Idempotent: re-running yields no duplicate emails / events thanks to the
 * UNIQUE constraints on `gmail_id` / `gcal_id`.
 */
export async function runSync<Raw>(
  connector: Connector<Raw>,
  db: DrizzleDb,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const onProgress = options.onProgress ?? noop
  const run = db
    .insert(syncRuns)
    .values({ connector: connector.name, status: 'running' })
    .returning()
    .get()

  onProgress({ kind: 'started', connector: connector.name })
  let itemsSynced = 0

  try {
    await connector.auth()
    for await (const raw of connector.sync({ since: options.since, cursor: options.cursor })) {
      const batch = await connector.normalize(raw)
      applyBatch(batch, db)
      itemsSynced += 1
      onProgress({ kind: 'item', connector: connector.name, itemsSynced })
    }

    db.update(syncRuns)
      .set({ status: 'success', finishedAt: new Date(), itemsSynced })
      .where(eq(syncRuns.id, run.id))
      .run()
    onProgress({ kind: 'finished', connector: connector.name, itemsSynced })
    return {
      connector: connector.name,
      itemsSynced,
      syncRunId: run.id,
      status: 'success',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    db.update(syncRuns)
      .set({ status: 'failed', finishedAt: new Date(), error: message, itemsSynced })
      .where(eq(syncRuns.id, run.id))
      .run()
    onProgress({ kind: 'failed', connector: connector.name, error: message })
    return {
      connector: connector.name,
      itemsSynced,
      syncRunId: run.id,
      status: 'failed',
      error: message,
    }
  }
}

function noop(): void {
  /* progress callback default */
}

/**
 * Apply one normalized batch to the DB. Resolves people by email, inserts /
 * upserts everything, returns mapping for later use.
 */
function applyBatch(batch: NormalizedBatch, db: DrizzleDb): void {
  const emailToPersonId = resolvePeople(batch, db)

  // Emails
  const emailsByGmailId = new Map((batch.emailLinks ?? []).map((link) => [link.gmailId, link]))
  for (const emailStub of batch.emails ?? []) {
    const link = emailsByGmailId.get(emailStub.gmailId)
    const fromPersonId = link?.fromEmail
      ? (emailToPersonId.get(link.fromEmail.toLowerCase()) ?? null)
      : null
    const toPersonIds = (link?.toEmails ?? [])
      .map((e) => emailToPersonId.get(e.toLowerCase()))
      .filter((id): id is number => typeof id === 'number')

    db.insert(emailMessages)
      .values({
        ...emailStub,
        fromPersonId,
        toPersonIds,
      })
      .onConflictDoNothing()
      .run()
  }

  // Calendar events
  const eventsByGcalId = new Map((batch.eventLinks ?? []).map((link) => [link.gcalId, link]))
  for (const eventStub of batch.events ?? []) {
    const link = eventsByGcalId.get(eventStub.gcalId)
    const attendeePersonIds = (link?.attendeeEmails ?? [])
      .map((e) => emailToPersonId.get(e.toLowerCase()))
      .filter((id): id is number => typeof id === 'number')

    db.insert(calendarEvents)
      .values({ ...eventStub, attendeePersonIds })
      .onConflictDoNothing()
      .run()
  }
}

/**
 * Upsert each person stub in the batch. Returns a map from lowercased email
 * to person id, covering both newly-inserted and pre-existing people.
 */
function resolvePeople(batch: NormalizedBatch, db: DrizzleDb): Map<string, number> {
  const out = new Map<string, number>()
  for (const stub of batch.people ?? []) {
    const email = stub.knownEmails?.[0]?.toLowerCase()
    if (!email) continue
    if (out.has(email)) continue

    const existing = findPersonByEmail(db, email)
    if (existing) {
      out.set(email, existing.id)
      continue
    }
    const inserted = db.insert(people).values(stub).returning().get()
    out.set(email, inserted.id)
  }
  return out
}

/**
 * SQLite JSON search: `EXISTS(SELECT 1 FROM json_each(people.known_emails)
 * WHERE LOWER(value) = LOWER(:email))`. Drizzle exposes raw SQL for this
 * since `known_emails` is a JSON array column.
 */
function findPersonByEmail(db: DrizzleDb, email: string): Person | undefined {
  const rows = db.all<Person>(
    sql`SELECT * FROM ${people}
        WHERE EXISTS (
          SELECT 1 FROM json_each(${people.knownEmails})
          WHERE lower(value) = lower(${email})
        )
        LIMIT 1`,
  )
  const first = rows[0]
  if (!first) return undefined
  // SQLite returns timestamps as ints; coerce to Date so downstream consumers
  // get the same shape as a direct `select().get()`.
  return {
    ...first,
    createdAt:
      first.createdAt instanceof Date ? first.createdAt : new Date(Number(first.createdAt) * 1000),
    updatedAt:
      first.updatedAt instanceof Date ? first.updatedAt : new Date(Number(first.updatedAt) * 1000),
    aliases: typeof first.aliases === 'string' ? JSON.parse(first.aliases) : first.aliases,
    knownEmails:
      typeof first.knownEmails === 'string' ? JSON.parse(first.knownEmails) : first.knownEmails,
    knownPhones:
      typeof first.knownPhones === 'string' ? JSON.parse(first.knownPhones) : first.knownPhones,
    knownHandles:
      typeof first.knownHandles === 'string' ? JSON.parse(first.knownHandles) : first.knownHandles,
  }
}
