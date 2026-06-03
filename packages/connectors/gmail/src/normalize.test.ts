import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { gmail_v1 } from '@googleapis/gmail'
import { describe, expect, it } from 'vitest'
import { normalizeGmailMessage, parseAddressList } from './normalize.js'

const FIXTURE_DIR = resolve(__dirname, '../__fixtures__/messages')

function loadFixture(name: string): gmail_v1.Schema$Message {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, name), 'utf-8'))
}

describe('parseAddressList', () => {
  it('returns empty array for null / undefined / empty', () => {
    expect(parseAddressList(undefined)).toEqual([])
    expect(parseAddressList(null)).toEqual([])
    expect(parseAddressList('')).toEqual([])
  })

  it('parses Joe Wilson <joe@example.com>', () => {
    expect(parseAddressList('Joe Wilson <joe@example.com>')).toEqual([
      { displayName: 'Joe Wilson', email: 'joe@example.com' },
    ])
  })

  it('strips quotes around display name', () => {
    expect(parseAddressList('"Joe Wilson" <joe@example.com>')).toEqual([
      { displayName: 'Joe Wilson', email: 'joe@example.com' },
    ])
  })

  it('handles bare email without angle brackets', () => {
    expect(parseAddressList('joe@example.com')).toEqual([
      { displayName: '', email: 'joe@example.com' },
    ])
  })

  it('splits a comma-separated list', () => {
    expect(parseAddressList('Joe <joe@x.com>, Bob <bob@y.com>, jane@z.com')).toEqual([
      { displayName: 'Joe', email: 'joe@x.com' },
      { displayName: 'Bob', email: 'bob@y.com' },
      { displayName: '', email: 'jane@z.com' },
    ])
  })

  it('lowercases email addresses', () => {
    expect(parseAddressList('JOE@EXAMPLE.COM')).toEqual([
      { displayName: '', email: 'joe@example.com' },
    ])
  })
})

describe('normalizeGmailMessage', () => {
  it('normalizes a regular 1:1 reply', () => {
    const batch = normalizeGmailMessage(loadFixture('regular-reply.json'))
    expect(batch.emails).toHaveLength(1)
    const email = batch.emails?.[0]
    expect(email?.gmailId).toBe('192abc1234')
    expect(email?.threadId).toBe('192abc1234')
    expect(email?.subject).toBe('Re: Dinner Friday?')
    expect(email?.isRead).toBe(true)
    expect(email?.labels).toEqual(['INBOX', 'CATEGORY_PERSONAL'])
    expect(email?.fromPersonId).toBeNull()
    expect(email?.toPersonIds).toEqual([])
    expect(email?.receivedAt).toEqual(new Date(1_748_880_000_000))

    expect(batch.people).toHaveLength(2)
    const joe = batch.people?.find((p) => p.knownEmails?.includes('joe@example.com'))
    expect(joe?.displayName).toBe('Joe Wilson')
    expect(joe?.relationship).toBe('unknown')
  })

  it('extracts every unique From/To/Cc address from a multi-participant thread', () => {
    const batch = normalizeGmailMessage(loadFixture('multi-participant.json'))
    expect(batch.emails).toHaveLength(1)
    expect(batch.emails?.[0]?.isRead).toBe(false)

    const emails = (batch.people ?? []).flatMap((p) => p.knownEmails ?? []).sort()
    expect(emails).toEqual([
      'bob@example.com',
      'joe@example.com',
      'me@example.com',
      'sarah@example.com',
    ])

    const sarah = batch.people?.find((p) => p.knownEmails?.includes('sarah@example.com'))
    expect(sarah?.displayName).toBe('Sarah Chen')
  })

  it('handles bare-email From header (Venmo)', () => {
    const batch = normalizeGmailMessage(loadFixture('venmo-notification.json'))
    expect(batch.emails?.[0]?.subject).toBe('Joe Wilson paid you $850.00')
    const venmo = batch.people?.find((p) => p.knownEmails?.includes('venmo@venmo.com'))
    expect(venmo?.displayName).toBe('Venmo')
  })

  it('handles calendar invite email metadata', () => {
    const batch = normalizeGmailMessage(loadFixture('calendar-invite-email.json'))
    expect(batch.emails?.[0]?.subject).toMatch(/Invitation: Team standup/)
  })

  it('is idempotent: same fixture produces equal batches', () => {
    const fx = loadFixture('regular-reply.json')
    const a = normalizeGmailMessage(fx)
    const b = normalizeGmailMessage(fx)
    expect(b).toEqual(a)
  })

  it('does not duplicate people when the same email appears in From and To', () => {
    const message: gmail_v1.Schema$Message = {
      id: 'x',
      threadId: 'x',
      labelIds: ['INBOX'],
      internalDate: '1748880000000',
      snippet: 's',
      payload: {
        headers: [
          { name: 'From', value: 'Joe <joe@x.com>' },
          { name: 'To', value: 'Joe <joe@x.com>' },
          { name: 'Subject', value: 's' },
        ],
      },
    }
    const batch = normalizeGmailMessage(message)
    expect(batch.people).toHaveLength(1)
  })

  it('falls back to epoch for missing date headers', () => {
    const message: gmail_v1.Schema$Message = {
      id: 'no-date',
      threadId: 't',
      labelIds: [],
      snippet: 's',
      payload: { headers: [{ name: 'From', value: 'a@b.com' }] },
    }
    const batch = normalizeGmailMessage(message)
    expect(batch.emails?.[0]?.receivedAt).toEqual(new Date(0))
  })
})
