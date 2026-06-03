import { resolve } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type DrizzleDb, openDb } from './index.js'
import {
  calendarEvents,
  emailMessages,
  extractedEvents,
  people,
  syncRuns,
  userSettings,
} from './schema.js'

const MIGRATIONS = resolve(__dirname, '../drizzle')

describe('db schema', () => {
  let db: DrizzleDb

  beforeEach(() => {
    db = openDb({ path: ':memory:', migrationsFolder: MIGRATIONS })
  })

  afterEach(() => {
    // Each test uses a fresh in-memory DB; nothing to clean up.
  })

  it('applies migrations cleanly', () => {
    const tables = db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
    )
    const names = tables.map((t) => t.name).sort()
    expect(names).toEqual([
      'calendar_events',
      'email_messages',
      'extracted_events',
      'people',
      'sync_runs',
      'user_settings',
    ])
  })

  it('round-trips a Person row', () => {
    const inserted = db
      .insert(people)
      .values({
        displayName: 'Joe Wilson',
        relationship: 'roommate',
        knownEmails: ['joe@example.com'],
      })
      .returning()
      .get()

    expect(inserted.displayName).toBe('Joe Wilson')
    expect(inserted.relationship).toBe('roommate')
    expect(inserted.knownEmails).toEqual(['joe@example.com'])
    expect(inserted.knownPhones).toEqual([])

    const fetched = db.select().from(people).where(eq(people.id, inserted.id)).get()
    expect(fetched).toEqual(inserted)
  })

  it('round-trips an EmailMessage row with FK to Person', () => {
    const joe = db.insert(people).values({ displayName: 'Joe' }).returning().get()

    const msg = db
      .insert(emailMessages)
      .values({
        gmailId: 'gmail-abc',
        threadId: 'thread-xyz',
        fromPersonId: joe.id,
        subject: 'hello',
        snippet: 'hi there',
        receivedAt: new Date('2026-06-03T12:00:00Z'),
        labels: ['INBOX'],
      })
      .returning()
      .get()

    expect(msg.fromPersonId).toBe(joe.id)
    expect(msg.labels).toEqual(['INBOX'])
    expect(msg.isRead).toBe(false)
  })

  it('enforces foreign-key constraints on email_messages.from_person_id', () => {
    expect(() =>
      db
        .insert(emailMessages)
        .values({
          gmailId: 'gmail-broken',
          threadId: 'thread-x',
          fromPersonId: 999_999,
          receivedAt: new Date(),
        })
        .run(),
    ).toThrow(/FOREIGN KEY/i)
  })

  it('enforces unique gmail_id on email_messages', () => {
    const now = new Date()
    db.insert(emailMessages).values({ gmailId: 'dup', threadId: 't', receivedAt: now }).run()
    expect(() =>
      db.insert(emailMessages).values({ gmailId: 'dup', threadId: 't2', receivedAt: now }).run(),
    ).toThrow(/UNIQUE/i)
  })

  it('cascades extracted_events when source email is deleted', () => {
    const email = db
      .insert(emailMessages)
      .values({ gmailId: 'g1', threadId: 't1', receivedAt: new Date() })
      .returning()
      .get()
    db.insert(extractedEvents)
      .values({ sourceEmailId: email.id, kind: 'payment_received', payload: { amount: 100 } })
      .run()

    expect(db.select().from(extractedEvents).all()).toHaveLength(1)

    db.delete(emailMessages).where(eq(emailMessages.id, email.id)).run()

    expect(db.select().from(extractedEvents).all()).toHaveLength(0)
  })

  it('round-trips a CalendarEvent row', () => {
    const ev = db
      .insert(calendarEvents)
      .values({
        gcalId: 'gcal-1',
        title: 'Team meeting',
        startAt: new Date('2026-06-04T15:00:00Z'),
        endAt: new Date('2026-06-04T16:00:00Z'),
        attendeePersonIds: [1, 2],
      })
      .returning()
      .get()

    expect(ev.title).toBe('Team meeting')
    expect(ev.attendeePersonIds).toEqual([1, 2])
    expect(ev.isAllDay).toBe(false)
  })

  it('round-trips a SyncRun row', () => {
    const run = db
      .insert(syncRuns)
      .values({ connector: 'gmail', status: 'success', itemsSynced: 42 })
      .returning()
      .get()

    expect(run.connector).toBe('gmail')
    expect(run.status).toBe('success')
    expect(run.itemsSynced).toBe(42)
    expect(run.startedAt).toBeInstanceOf(Date)
  })

  it('seeds user_settings with sensible defaults', () => {
    const settings = db.insert(userSettings).values({ id: 1 }).returning().get()

    expect(settings.id).toBe(1)
    expect(settings.setupStep).toBe('welcome')
    expect(settings.backfillDaysEmail).toBe(30)
    expect(settings.backfillDaysCalendar).toBe(60)
    expect(settings.pollIntervalSeconds).toBe(120)
  })
})
