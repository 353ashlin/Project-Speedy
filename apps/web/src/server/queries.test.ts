import { resolve } from 'node:path'
import { type DrizzleDb, calendarEvents, emailMessages, openDb, people, syncRuns } from '@speedy/db'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeed, getLastSyncs, getPersonProfile, listPeople } from './queries'

const MIGRATIONS = resolve(__dirname, '../../../../packages/db/drizzle')

describe('queries', () => {
  let db: DrizzleDb

  beforeEach(() => {
    db = openDb({ path: ':memory:', migrationsFolder: MIGRATIONS })
  })

  function makePerson(name: string, email: string) {
    return db
      .insert(people)
      .values({
        displayName: name,
        relationship: 'unknown',
        knownEmails: [email],
      })
      .returning()
      .get()
  }

  function makeEmail(opts: {
    gmailId: string
    fromPersonId: number | null
    toPersonIds?: number[]
    receivedAt: Date
    subject?: string
  }) {
    return db
      .insert(emailMessages)
      .values({
        gmailId: opts.gmailId,
        threadId: opts.gmailId,
        fromPersonId: opts.fromPersonId,
        toPersonIds: opts.toPersonIds ?? [],
        subject: opts.subject ?? 'subj',
        snippet: 'snip',
        receivedAt: opts.receivedAt,
        isRead: false,
        labels: [],
      })
      .returning()
      .get()
  }

  function makeEvent(opts: {
    gcalId: string
    startAt: Date
    endAt?: Date
    attendeePersonIds?: number[]
    title?: string
  }) {
    return db
      .insert(calendarEvents)
      .values({
        gcalId: opts.gcalId,
        title: opts.title ?? 'Meeting',
        startAt: opts.startAt,
        endAt: opts.endAt ?? new Date(opts.startAt.getTime() + 60 * 60 * 1000),
        isAllDay: false,
        location: null,
        attendeePersonIds: opts.attendeePersonIds ?? [],
        description: null,
      })
      .returning()
      .get()
  }

  describe('getFeed', () => {
    it('returns empty array when DB is empty', () => {
      expect(getFeed(db)).toEqual([])
    })

    it('merges and sorts emails and events newest-first by timestamp', () => {
      const joe = makePerson('Joe', 'joe@example.com')
      makeEmail({
        gmailId: 'old',
        fromPersonId: joe.id,
        receivedAt: new Date('2026-06-01T12:00:00Z'),
      })
      makeEmail({
        gmailId: 'new',
        fromPersonId: joe.id,
        receivedAt: new Date('2026-06-05T12:00:00Z'),
      })
      makeEvent({
        gcalId: 'evt-mid',
        startAt: new Date('2026-06-03T12:00:00Z'),
      })

      const feed = getFeed(db)
      expect(feed.map((f) => f.kind)).toEqual(['email', 'calendar_event', 'email'])
      const timestamps = feed.map((f) => f.timestamp.toISOString())
      expect(timestamps).toEqual([
        '2026-06-05T12:00:00.000Z',
        '2026-06-03T12:00:00.000Z',
        '2026-06-01T12:00:00.000Z',
      ])
    })

    it('respects the limit option', () => {
      const joe = makePerson('Joe', 'joe@example.com')
      for (let i = 0; i < 10; i++) {
        makeEmail({
          gmailId: `g-${i}`,
          fromPersonId: joe.id,
          receivedAt: new Date(2026, 5, i + 1),
        })
      }
      expect(getFeed(db, { limit: 3 })).toHaveLength(3)
    })
  })

  describe('listPeople', () => {
    it('returns an empty array when there are no people', () => {
      expect(listPeople(db)).toEqual([])
    })

    it('sorts people by last interaction descending then alpha', () => {
      const alice = makePerson('Alice', 'a@x.com')
      const bob = makePerson('Bob', 'b@x.com')
      const carol = makePerson('Carol', 'c@x.com')

      makeEmail({
        gmailId: 'g1',
        fromPersonId: bob.id,
        receivedAt: new Date('2026-06-01T00:00:00Z'),
      })
      makeEmail({
        gmailId: 'g2',
        fromPersonId: alice.id,
        receivedAt: new Date('2026-06-05T00:00:00Z'),
      })
      // Carol has no interactions.

      const list = listPeople(db)
      expect(list.map((s) => s.person.displayName)).toEqual(['Alice', 'Bob', 'Carol'])
      expect(list[0]?.lastInteractionAt?.toISOString()).toBe('2026-06-05T00:00:00.000Z')
      expect(list[2]?.lastInteractionAt).toBeNull()
    })
  })

  describe('getPersonProfile', () => {
    it('returns null for an unknown personId', () => {
      expect(getPersonProfile(db, 9999)).toBeNull()
    })

    it('collects emails where the person is From or in To', () => {
      const joe = makePerson('Joe', 'joe@example.com')
      const me = makePerson('Me', 'me@example.com')

      makeEmail({
        gmailId: 'g-from-joe',
        fromPersonId: joe.id,
        toPersonIds: [me.id],
        receivedAt: new Date('2026-06-05T12:00:00Z'),
      })
      makeEmail({
        gmailId: 'g-to-joe',
        fromPersonId: me.id,
        toPersonIds: [joe.id],
        receivedAt: new Date('2026-06-04T12:00:00Z'),
      })
      makeEmail({
        gmailId: 'g-unrelated',
        fromPersonId: me.id,
        toPersonIds: [],
        receivedAt: new Date('2026-06-03T12:00:00Z'),
      })

      const profile = getPersonProfile(db, joe.id)
      expect(profile?.recentEmails).toHaveLength(2)
      expect(profile?.recentEmails.map((e) => e.gmailId)).toEqual(['g-from-joe', 'g-to-joe'])
    })

    it('splits events into upcoming and past relative to now', () => {
      const joe = makePerson('Joe', 'joe@example.com')
      const futureAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const pastAt = new Date(Date.now() - 24 * 60 * 60 * 1000)

      makeEvent({ gcalId: 'future', startAt: futureAt, attendeePersonIds: [joe.id] })
      makeEvent({ gcalId: 'past', startAt: pastAt, attendeePersonIds: [joe.id] })
      makeEvent({ gcalId: 'unrelated', startAt: futureAt, attendeePersonIds: [] })

      const profile = getPersonProfile(db, joe.id)
      expect(profile?.upcomingEvents.map((e) => e.gcalId)).toEqual(['future'])
      expect(profile?.pastEvents.map((e) => e.gcalId)).toEqual(['past'])
    })
  })

  describe('getLastSyncs', () => {
    it('returns the most recent run per connector', () => {
      db.insert(syncRuns)
        .values([
          {
            connector: 'gmail',
            status: 'success',
            startedAt: new Date('2026-06-01T00:00:00Z'),
            itemsSynced: 1,
          },
          {
            connector: 'gmail',
            status: 'success',
            startedAt: new Date('2026-06-05T00:00:00Z'),
            itemsSynced: 5,
          },
          {
            connector: 'gcal',
            status: 'failed',
            startedAt: new Date('2026-06-03T00:00:00Z'),
            itemsSynced: 0,
          },
        ])
        .run()

      const byConnector = getLastSyncs(db)
      expect(byConnector.gmail?.itemsSynced).toBe(5)
      expect(byConnector.gcal?.status).toBe('failed')
    })
  })
})
