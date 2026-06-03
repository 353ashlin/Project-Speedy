import { resolve } from 'node:path'
import type { Connector, NormalizedBatch, SyncOptions } from '@speedy/core'
import { type DrizzleDb, calendarEvents, emailMessages, openDb, people, syncRuns } from '@speedy/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runSync } from './orchestrator'

const MIGRATIONS = resolve(__dirname, '../../../../../packages/db/drizzle')

class FakeConnector implements Connector<NormalizedBatch> {
  readonly name = 'fake'
  constructor(private readonly batches: NormalizedBatch[]) {}

  async auth(): Promise<void> {
    /* no-op */
  }

  async *sync(_opts: SyncOptions): AsyncIterable<NormalizedBatch> {
    for (const b of this.batches) yield b
  }

  async normalize(raw: NormalizedBatch): Promise<NormalizedBatch> {
    return raw
  }

  async recordFixture(): Promise<void> {
    throw new Error('not used')
  }
}

class FailingConnector implements Connector<unknown> {
  readonly name = 'failing'

  async auth(): Promise<void> {
    throw new Error('auth busted')
  }

  async *sync(): AsyncIterable<unknown> {
    /* never reached */
  }

  async normalize(): Promise<NormalizedBatch> {
    return {}
  }

  async recordFixture(): Promise<void> {
    /* unused */
  }
}

function emailBatch(opts: {
  gmailId: string
  fromEmail: string
  toEmails: string[]
  subject?: string
}): NormalizedBatch {
  return {
    people: [
      { displayName: 'From', relationship: 'unknown', knownEmails: [opts.fromEmail] },
      ...opts.toEmails.map((e) => ({
        displayName: e,
        relationship: 'unknown' as const,
        knownEmails: [e],
      })),
    ],
    emails: [
      {
        gmailId: opts.gmailId,
        threadId: opts.gmailId,
        fromPersonId: null,
        toPersonIds: [],
        subject: opts.subject ?? null,
        snippet: null,
        receivedAt: new Date('2026-06-05T12:00:00Z'),
        isRead: true,
        labels: ['INBOX'],
      },
    ],
    emailLinks: [{ gmailId: opts.gmailId, fromEmail: opts.fromEmail, toEmails: opts.toEmails }],
  }
}

describe('runSync', () => {
  let db: DrizzleDb

  beforeEach(() => {
    db = openDb({ path: ':memory:', migrationsFolder: MIGRATIONS })
  })

  afterEach(() => {
    // in-memory DBs are discarded
  })

  it('records a successful sync_run with itemsSynced count', async () => {
    const fake = new FakeConnector([
      emailBatch({ gmailId: 'g1', fromEmail: 'joe@example.com', toEmails: ['me@example.com'] }),
      emailBatch({ gmailId: 'g2', fromEmail: 'sarah@example.com', toEmails: ['me@example.com'] }),
    ])

    const result = await runSync(fake, db)

    expect(result.status).toBe('success')
    expect(result.itemsSynced).toBe(2)
    const run = db.select().from(syncRuns).where(undefined).get()
    expect(run?.status).toBe('success')
    expect(run?.itemsSynced).toBe(2)
    expect(run?.finishedAt).toBeInstanceOf(Date)
  })

  it('inserts people, emails, and resolves from_person_id correctly', async () => {
    const fake = new FakeConnector([
      emailBatch({
        gmailId: 'g1',
        fromEmail: 'joe@example.com',
        toEmails: ['me@example.com', 'sarah@example.com'],
      }),
    ])
    await runSync(fake, db)

    const ppl = db.select().from(people).all()
    expect(ppl.map((p) => p.knownEmails[0]).sort()).toEqual([
      'joe@example.com',
      'me@example.com',
      'sarah@example.com',
    ])
    const joeId = ppl.find((p) => p.knownEmails[0] === 'joe@example.com')?.id

    const emails = db.select().from(emailMessages).all()
    expect(emails).toHaveLength(1)
    expect(emails[0]?.fromPersonId).toBe(joeId)
    expect(emails[0]?.toPersonIds).toHaveLength(2)
  })

  it('reuses an existing person when their email already lives in known_emails', async () => {
    db.insert(people)
      .values({
        displayName: 'Joe Wilson',
        relationship: 'roommate',
        knownEmails: ['joe@example.com'],
      })
      .returning()
      .get()

    const fake = new FakeConnector([
      emailBatch({ gmailId: 'g1', fromEmail: 'JOE@example.com', toEmails: ['me@example.com'] }),
    ])
    await runSync(fake, db)

    const ppl = db.select().from(people).all()
    expect(ppl).toHaveLength(2) // joe (existing) + me
    const joe = ppl.find((p) => p.relationship === 'roommate')
    expect(joe?.displayName).toBe('Joe Wilson') // preserved, not overwritten
  })

  it('is idempotent: re-running on the same batch yields no duplicates', async () => {
    const batch = emailBatch({
      gmailId: 'g-once',
      fromEmail: 'joe@example.com',
      toEmails: ['me@example.com'],
    })
    await runSync(new FakeConnector([batch]), db)
    await runSync(new FakeConnector([batch]), db)

    expect(db.select().from(emailMessages).all()).toHaveLength(1)
    // Note: people may grow on re-run if the stub email differs — but
    // the email row itself stays at 1 due to UNIQUE on gmail_id.
  })

  it('records a failed sync_run with the error message when auth throws', async () => {
    const result = await runSync(new FailingConnector(), db)
    expect(result.status).toBe('failed')
    expect(result.error).toMatch(/auth busted/)

    const run = db.select().from(syncRuns).where(undefined).get()
    expect(run?.status).toBe('failed')
    expect(run?.error).toMatch(/auth busted/)
    expect(run?.itemsSynced).toBe(0)
  })

  it('handles calendar events with attendee resolution', async () => {
    const batch: NormalizedBatch = {
      people: [
        { displayName: 'Alice', relationship: 'unknown', knownEmails: ['alice@example.com'] },
        { displayName: 'Bob', relationship: 'unknown', knownEmails: ['bob@example.com'] },
      ],
      events: [
        {
          gcalId: 'evt-1',
          title: 'Standup',
          startAt: new Date('2026-06-05T15:00:00Z'),
          endAt: new Date('2026-06-05T15:15:00Z'),
          isAllDay: false,
          location: null,
          attendeePersonIds: [],
          description: null,
        },
      ],
      eventLinks: [{ gcalId: 'evt-1', attendeeEmails: ['alice@example.com', 'bob@example.com'] }],
    }

    await runSync(new FakeConnector([batch]), db)

    const events = db.select().from(calendarEvents).all()
    expect(events).toHaveLength(1)
    expect(events[0]?.attendeePersonIds).toHaveLength(2)
  })

  it('reports progress via the onProgress callback', async () => {
    const fake = new FakeConnector([
      emailBatch({ gmailId: 'g1', fromEmail: 'a@x.com', toEmails: ['b@x.com'] }),
      emailBatch({ gmailId: 'g2', fromEmail: 'c@x.com', toEmails: ['b@x.com'] }),
    ])
    const events: string[] = []
    await runSync(fake, db, {
      onProgress: (e) => events.push(`${e.kind}:${e.itemsSynced ?? ''}`),
    })
    expect(events).toEqual(['started:', 'item:1', 'item:2', 'finished:2'])
  })
})
