import type { calendar_v3 } from '@googleapis/calendar'
import type { NormalizedBatch } from '@speedy/core'
import type { NewCalendarEvent, NewPerson } from '@speedy/db'

/**
 * Parse a Google Calendar event time field into a Date + an "all-day" flag.
 *
 * Google distinguishes timed events (`dateTime` ISO 8601 string) from all-day
 * events (`date` `YYYY-MM-DD` only). We collapse both into a `Date` and a
 * `boolean`; for all-day events the time is midnight UTC of the given day.
 */
export function parseEventTime(time: calendar_v3.Schema$EventDateTime | undefined): {
  at: Date
  isAllDay: boolean
} {
  if (time?.dateTime) {
    const parsed = new Date(time.dateTime)
    if (!Number.isNaN(parsed.getTime())) {
      return { at: parsed, isAllDay: false }
    }
  }
  if (time?.date) {
    // `YYYY-MM-DD` — parse as UTC midnight so timezone math is stable.
    const parsed = new Date(`${time.date}T00:00:00Z`)
    if (!Number.isNaN(parsed.getTime())) {
      return { at: parsed, isAllDay: true }
    }
  }
  return { at: new Date(0), isAllDay: false }
}

/**
 * Convert one Google Calendar event into a NormalizedBatch. Mirrors the
 * Gmail connector's pattern: emit a typed event row + people stubs for
 * every attendee. The orchestrator resolves person stubs and patches
 * `attendee_person_ids` after the fact.
 *
 * Recurring events: for v1 we treat the master rule like any other event
 * (storing the master start/end). Materializing instances is a v2+ concern.
 * The connector should be configured with `singleEvents: false` during list
 * — see `gcal.ts`.
 */
export function normalizeCalendarEvent(event: calendar_v3.Schema$Event): NormalizedBatch {
  const gcalId = event.id ?? ''
  const title = event.summary ?? '(no title)'
  const start = parseEventTime(event.start ?? undefined)
  const end = parseEventTime(event.end ?? undefined)

  const calendarEvent: NewCalendarEvent = {
    gcalId,
    title,
    startAt: start.at,
    endAt: end.at,
    isAllDay: start.isAllDay,
    location: event.location ?? null,
    attendeePersonIds: [],
    description: event.description ?? null,
  }

  const seenEmails = new Set<string>()
  const people: NewPerson[] = []
  for (const attendee of event.attendees ?? []) {
    const email = attendee.email?.trim().toLowerCase()
    if (!email || seenEmails.has(email)) continue
    seenEmails.add(email)
    people.push({
      displayName: attendee.displayName ?? email,
      relationship: 'unknown',
      knownEmails: [email],
    })
  }

  return { people, events: [calendarEvent] }
}
