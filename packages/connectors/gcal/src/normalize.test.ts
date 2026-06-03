import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { calendar_v3 } from '@googleapis/calendar'
import { describe, expect, it } from 'vitest'
import { normalizeCalendarEvent, parseEventTime } from './normalize.js'

const FIXTURE_DIR = resolve(__dirname, '../__fixtures__/events')

function loadFixture(name: string): calendar_v3.Schema$Event {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), 'utf-8'))
}

describe('parseEventTime', () => {
  it('parses a timed event dateTime as UTC instant', () => {
    const result = parseEventTime({ dateTime: '2026-06-05T15:00:00-04:00' })
    expect(result.isAllDay).toBe(false)
    expect(result.at.toISOString()).toBe('2026-06-05T19:00:00.000Z')
  })

  it('parses an all-day date as midnight UTC', () => {
    const result = parseEventTime({ date: '2026-06-07' })
    expect(result.isAllDay).toBe(true)
    expect(result.at.toISOString()).toBe('2026-06-07T00:00:00.000Z')
  })

  it('returns epoch for missing or invalid time', () => {
    expect(parseEventTime(undefined).at).toEqual(new Date(0))
    expect(parseEventTime({ dateTime: 'nope' }).at).toEqual(new Date(0))
  })
})

describe('normalizeCalendarEvent', () => {
  it('normalizes a simple 1:1 timed event', () => {
    const batch = normalizeCalendarEvent(loadFixture('simple-1to1.json'))
    expect(batch.events).toHaveLength(1)
    const event = batch.events?.[0]
    expect(event?.gcalId).toBe('evt-simple-001')
    expect(event?.title).toBe('Coffee with Joe')
    expect(event?.location).toBe('Blue Bottle, downtown')
    expect(event?.isAllDay).toBe(false)
    expect(event?.attendeePersonIds).toEqual([])
    expect(event?.startAt.toISOString()).toBe('2026-06-05T19:00:00.000Z')

    expect(batch.people).toHaveLength(1)
    expect(batch.people?.[0]?.displayName).toBe('Joe Wilson')
    expect(batch.people?.[0]?.knownEmails).toEqual(['joe@example.com'])
  })

  it('dedups attendees by lowercased email and lowercases on emit', () => {
    const batch = normalizeCalendarEvent(loadFixture('multi-attendee.json'))
    expect(batch.events).toHaveLength(1)

    const emails = (batch.people ?? []).flatMap((p) => p.knownEmails ?? []).sort()
    expect(emails).toEqual(['alice@example.com', 'bob@example.com', 'me@example.com'])
  })

  it('marks all-day events with isAllDay and midnight-UTC times', () => {
    const batch = normalizeCalendarEvent(loadFixture('all-day.json'))
    const event = batch.events?.[0]
    expect(event?.isAllDay).toBe(true)
    expect(event?.startAt.toISOString()).toBe('2026-06-07T00:00:00.000Z')
    expect(event?.endAt.toISOString()).toBe('2026-06-08T00:00:00.000Z')
  })

  it('handles recurring event masters (no special-casing for v1)', () => {
    const batch = normalizeCalendarEvent(loadFixture('recurring-master.json'))
    const event = batch.events?.[0]
    expect(event?.title).toBe('Weekly 1:1 with manager')
    expect(event?.startAt.toISOString()).toBe('2026-06-08T18:00:00.000Z')
  })

  it('falls back to "(no title)" when summary is absent', () => {
    const event: calendar_v3.Schema$Event = {
      id: 'untitled',
      start: { dateTime: '2026-06-05T15:00:00Z' },
      end: { dateTime: '2026-06-05T16:00:00Z' },
    }
    const batch = normalizeCalendarEvent(event)
    expect(batch.events?.[0]?.title).toBe('(no title)')
  })

  it('is idempotent: same fixture produces equal batches', () => {
    const fx = loadFixture('multi-attendee.json')
    const a = normalizeCalendarEvent(fx)
    const b = normalizeCalendarEvent(fx)
    expect(b).toEqual(a)
  })

  it('emits no people when the event has no attendees', () => {
    const event: calendar_v3.Schema$Event = {
      id: 'solo',
      summary: 'Focus time',
      start: { dateTime: '2026-06-05T15:00:00Z' },
      end: { dateTime: '2026-06-05T16:00:00Z' },
    }
    const batch = normalizeCalendarEvent(event)
    expect(batch.people).toEqual([])
    expect(batch.events).toHaveLength(1)
  })

  it('preserves null location and description when absent', () => {
    const batch = normalizeCalendarEvent(loadFixture('all-day.json'))
    const event = batch.events?.[0]
    expect(event?.location).toBeNull()
    expect(event?.description).toBeNull()
  })
})
