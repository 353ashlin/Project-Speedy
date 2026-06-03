import type { FeedItem } from '@speedy/core'
import {
  type CalendarEvent,
  type DrizzleDb,
  type EmailMessage,
  type Person,
  type SyncRun,
  calendarEvents,
  emailMessages,
  people,
  syncRuns,
} from '@speedy/db'
import { asc, desc, eq } from 'drizzle-orm'

/**
 * Read-side queries that the dashboard / person pages use. All are pure
 * functions over a `DrizzleDb`; no caching, no globals, no I/O beyond the
 * passed-in DB handle. v1 graph sizes are small enough that loading all
 * emails / events into memory is fine — when this stops being true we add
 * indexes + push filters into SQL.
 */

export interface FeedQueryOptions {
  /** Hard cap on the returned feed length. Default 100. */
  limit?: number
}

/**
 * Chronological merged stream of email + calendar event signals, newest first.
 * Today's events sort by their start time; emails sort by received time.
 */
export function getFeed(db: DrizzleDb, options: FeedQueryOptions = {}): FeedItem[] {
  const limit = options.limit ?? 100

  const emails = db
    .select()
    .from(emailMessages)
    .orderBy(desc(emailMessages.receivedAt))
    .limit(limit)
    .all()

  const events = db
    .select()
    .from(calendarEvents)
    .orderBy(desc(calendarEvents.startAt))
    .limit(limit)
    .all()

  const merged: FeedItem[] = [
    ...emails.map((item) => ({ kind: 'email' as const, timestamp: item.receivedAt, item })),
    ...events.map((item) => ({
      kind: 'calendar_event' as const,
      timestamp: item.startAt,
      item,
    })),
  ]
  merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  return merged.slice(0, limit)
}

export interface PersonSummary {
  person: Person
  lastInteractionAt: Date | null
}

/**
 * All People with their most-recent interaction (email received or event).
 * Sorted by recency: most recently interacted with first, then alphabetical
 * by name for those with no interaction yet.
 */
export function listPeople(db: DrizzleDb): PersonSummary[] {
  const allPeople = db.select().from(people).orderBy(asc(people.displayName)).all()
  const allEmails = db.select().from(emailMessages).all()
  const allEvents = db.select().from(calendarEvents).all()

  const summaries: PersonSummary[] = allPeople.map((person) => {
    let lastInteractionAt: Date | null = null

    for (const email of allEmails) {
      if (email.fromPersonId === person.id || email.toPersonIds.includes(person.id)) {
        if (!lastInteractionAt || email.receivedAt > lastInteractionAt) {
          lastInteractionAt = email.receivedAt
        }
      }
    }
    for (const event of allEvents) {
      if (event.attendeePersonIds.includes(person.id)) {
        if (!lastInteractionAt || event.startAt > lastInteractionAt) {
          lastInteractionAt = event.startAt
        }
      }
    }

    return { person, lastInteractionAt }
  })

  summaries.sort((a, b) => {
    if (a.lastInteractionAt && b.lastInteractionAt) {
      return b.lastInteractionAt.getTime() - a.lastInteractionAt.getTime()
    }
    if (a.lastInteractionAt) return -1
    if (b.lastInteractionAt) return 1
    return a.person.displayName.localeCompare(b.person.displayName)
  })
  return summaries
}

export interface PersonProfile {
  person: Person
  recentEmails: EmailMessage[]
  upcomingEvents: CalendarEvent[]
  pastEvents: CalendarEvent[]
}

/**
 * Person profile = the person record + their recent / upcoming interactions.
 * Returns null when the personId is unknown.
 */
export function getPersonProfile(db: DrizzleDb, personId: number): PersonProfile | null {
  const person = db.select().from(people).where(eq(people.id, personId)).get()
  if (!person) return null

  const allEmails = db.select().from(emailMessages).all()
  const personEmails = allEmails
    .filter((e) => e.fromPersonId === personId || e.toPersonIds.includes(personId))
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
    .slice(0, 20)

  const allEvents = db.select().from(calendarEvents).all()
  const personEvents = allEvents.filter((e) => e.attendeePersonIds.includes(personId))
  const now = Date.now()
  const upcomingEvents = personEvents
    .filter((e) => e.startAt.getTime() > now)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .slice(0, 5)
  const pastEvents = personEvents
    .filter((e) => e.startAt.getTime() <= now)
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime())
    .slice(0, 10)

  return { person, recentEmails: personEmails, upcomingEvents, pastEvents }
}

/**
 * Most recent sync_run per connector. Used to render the "Last synced X" indicator
 * and detect stale-data state for auto-sync.
 */
export function getLastSyncs(db: DrizzleDb): Record<string, SyncRun | undefined> {
  const runs = db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).all()
  const byConnector: Record<string, SyncRun | undefined> = {}
  for (const run of runs) {
    if (!byConnector[run.connector]) {
      byConnector[run.connector] = run
    }
  }
  return byConnector
}
