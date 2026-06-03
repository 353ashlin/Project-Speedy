import type { gmail_v1 } from '@googleapis/gmail'
import type { NormalizedBatch } from '@speedy/core'
import type { NewEmailMessage, NewPerson } from '@speedy/db'

export interface ParsedAddress {
  displayName: string
  email: string
}

/**
 * Pull a header value (case-insensitive) from a Gmail message payload.
 */
function header(message: gmail_v1.Schema$Message, name: string): string | undefined {
  const headers = message.payload?.headers ?? []
  const lower = name.toLowerCase()
  const found = headers.find((h) => h.name?.toLowerCase() === lower)
  return found?.value ?? undefined
}

/**
 * Parse an RFC-2822 address-list header into structured addresses.
 *
 * Handles the common cases:
 *   `Joe Wilson <joe@example.com>`
 *   `"Joe Wilson" <joe@example.com>`
 *   `joe@example.com`
 *   `Joe <joe@x.com>, Bob <bob@y.com>`
 *
 * Does NOT handle: group syntax, comments, escaped commas inside quoted names.
 * Those are vanishingly rare in personal email; if they bite us we add a real
 * RFC parser later.
 */
export function parseAddressList(value: string | undefined | null): ParsedAddress[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseOne)
}

function parseOne(input: string): ParsedAddress {
  const match = input.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) {
    const rawName = (match[1] ?? '').trim()
    const stripped = rawName.replace(/^"|"$/g, '').replace(/^'|'$/g, '')
    return { displayName: stripped, email: (match[2] ?? '').trim().toLowerCase() }
  }
  return { displayName: '', email: input.trim().toLowerCase() }
}

/**
 * Convert a Gmail message into a NormalizedBatch. The orchestrator is
 * responsible for resolving the emitted `NewPerson` stubs to real `Person`
 * IDs and patching `from_person_id` / `to_person_ids` on the email row.
 *
 * Connector emits:
 *   - One `NewEmailMessage` per Gmail message (with `from_person_id: null`
 *     and `to_person_ids: []` for now — the orchestrator will fill these).
 *   - Zero or more `NewPerson` rows, one per unique email address seen on
 *     the From / To / Cc lines. Always `relationship: 'unknown'`. The user
 *     can promote them via the onboarding chat (#13).
 */
export function normalizeGmailMessage(message: gmail_v1.Schema$Message): NormalizedBatch {
  const gmailId = message.id ?? ''
  const threadId = message.threadId ?? ''
  const labels = message.labelIds ?? []
  const isRead = !labels.includes('UNREAD')

  const fromAddrs = parseAddressList(header(message, 'From'))
  const toAddrs = parseAddressList(header(message, 'To'))
  const ccAddrs = parseAddressList(header(message, 'Cc'))

  const receivedAt = (() => {
    if (message.internalDate) {
      const ms = Number.parseInt(message.internalDate, 10)
      if (Number.isFinite(ms)) return new Date(ms)
    }
    const dateHeader = header(message, 'Date')
    if (dateHeader) {
      const parsed = new Date(dateHeader)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return new Date(0)
  })()

  const email: NewEmailMessage = {
    gmailId,
    threadId,
    fromPersonId: null,
    toPersonIds: [],
    subject: header(message, 'Subject') ?? null,
    snippet: message.snippet ?? null,
    receivedAt,
    isRead,
    labels,
  }

  const seenEmails = new Set<string>()
  const people: NewPerson[] = []
  for (const addr of [...fromAddrs, ...toAddrs, ...ccAddrs]) {
    if (!addr.email || seenEmails.has(addr.email)) continue
    seenEmails.add(addr.email)
    people.push({
      displayName: addr.displayName || addr.email,
      relationship: 'unknown',
      knownEmails: [addr.email],
    })
  }

  const emailLinks = [
    {
      gmailId,
      fromEmail: fromAddrs[0]?.email,
      toEmails: [...toAddrs, ...ccAddrs].map((a) => a.email),
    },
  ]

  return { people, emails: [email], emailLinks }
}
