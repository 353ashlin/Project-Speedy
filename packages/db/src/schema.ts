import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * People — the central nodes in the graph. Every email, calendar event, and
 * (in later versions) message / payment attaches to one or more `Person` rows.
 *
 * `known_emails`, `known_phones`, `known_handles` are the identity anchors used
 * for entity resolution by `@speedy/core/entity-resolution`.
 */
export const people = sqliteTable('people', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull(),
  relationship: text('relationship', {
    enum: ['roommate', 'family', 'friend', 'coworker', 'unknown'],
  })
    .notNull()
    .default('unknown'),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  knownEmails: text('known_emails', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  knownPhones: text('known_phones', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  knownHandles: text('known_handles', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  birthday: text('birthday'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

/**
 * Email messages from Gmail. `gmail_id` is Gmail's internal message ID
 * (idempotency key for sync). `from_person_id` is resolved via entity
 * resolution; null while unresolved.
 */
export const emailMessages = sqliteTable('email_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gmailId: text('gmail_id').notNull().unique(),
  threadId: text('thread_id').notNull(),
  fromPersonId: integer('from_person_id').references(() => people.id),
  toPersonIds: text('to_person_ids', { mode: 'json' })
    .$type<number[]>()
    .notNull()
    .default(sql`'[]'`),
  subject: text('subject'),
  snippet: text('snippet'),
  receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  labels: text('labels', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

/**
 * Calendar events from Google Calendar. `gcal_id` is the canonical event ID.
 * For recurring events v1 stores only the master rule; instances are derived
 * at query time (full materialization is v2+).
 */
export const calendarEvents = sqliteTable('calendar_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gcalId: text('gcal_id').notNull().unique(),
  title: text('title').notNull(),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp' }).notNull(),
  isAllDay: integer('is_all_day', { mode: 'boolean' }).notNull().default(false),
  location: text('location'),
  attendeePersonIds: text('attendee_person_ids', { mode: 'json' })
    .$type<number[]>()
    .notNull()
    .default(sql`'[]'`),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

/**
 * Structured events extracted from semi-structured emails (Venmo, Stripe, bill
 * alerts, etc.). The parser is deterministic per known sender — no LLM call.
 */
export const extractedEvents = sqliteTable('extracted_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceEmailId: integer('source_email_id')
    .notNull()
    .references(() => emailMessages.id, { onDelete: 'cascade' }),
  kind: text('kind', {
    enum: [
      'payment_received',
      'payment_sent',
      'bill_due',
      'package_tracking',
      'subscription_renewal',
      'receipt',
      'other',
    ],
  }).notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  fromPersonId: integer('from_person_id').references(() => people.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

/**
 * Sync run audit log. One row per sync attempt — the dashboard reads this
 * to display "last synced" + error banners.
 */
export const syncRuns = sqliteTable('sync_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  connector: text('connector').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
  status: text('status', { enum: ['running', 'success', 'failed'] })
    .notNull()
    .default('running'),
  error: text('error'),
  itemsSynced: integer('items_synced').notNull().default(0),
})

/**
 * Single-row settings table. Convention: id is always 1. App layer enforces.
 */
export const userSettings = sqliteTable('user_settings', {
  id: integer('id').primaryKey(),
  setupStep: text('setup_step', {
    enum: [
      'welcome',
      'anthropic',
      'google_credentials',
      'google_signin',
      'onboarding',
      'backfill',
      'complete',
    ],
  })
    .notNull()
    .default('welcome'),
  backfillDaysEmail: integer('backfill_days_email').notNull().default(30),
  backfillDaysCalendar: integer('backfill_days_calendar').notNull().default(60),
  pollIntervalSeconds: integer('poll_interval_seconds').notNull().default(120),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
})

export type Person = typeof people.$inferSelect
export type NewPerson = typeof people.$inferInsert
export type EmailMessage = typeof emailMessages.$inferSelect
export type NewEmailMessage = typeof emailMessages.$inferInsert
export type CalendarEvent = typeof calendarEvents.$inferSelect
export type NewCalendarEvent = typeof calendarEvents.$inferInsert
export type ExtractedEvent = typeof extractedEvents.$inferSelect
export type NewExtractedEvent = typeof extractedEvents.$inferInsert
export type SyncRun = typeof syncRuns.$inferSelect
export type NewSyncRun = typeof syncRuns.$inferInsert
export type UserSettings = typeof userSettings.$inferSelect
export type NewUserSettings = typeof userSettings.$inferInsert
