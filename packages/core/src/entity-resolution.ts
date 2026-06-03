import type { Person } from '@speedy/db'
import type { Identity } from './types.js'

/**
 * Strip everything that isn't a digit. Used for both stored phones and
 * lookup queries so they compare apples-to-apples.
 *
 * Known v1 limitation: this is a dumb normalization. If the stored number
 * carries a country code (`+1...`) and the query doesn't (`555...`), they
 * won't match. Fixing this requires libphonenumber and is deferred to v2.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase()
}

/**
 * Find the `Person` (if any) that owns this `Identity`. Pure function over a
 * loaded list of People — the caller is responsible for fetching them from
 * the DB. For v1's expected graph size (< a few thousand) this is fine; v2+
 * can swap in a direct DB query if needed.
 *
 * Returns the first match. Multiple People claiming the same identity is a
 * data bug — entity resolution should never have created the duplicate.
 */
export function findPersonByIdentity(identity: Identity, people: Person[]): Person | null {
  for (const person of people) {
    if (matches(person, identity)) return person
  }
  return null
}

function matches(person: Person, identity: Identity): boolean {
  switch (identity.kind) {
    case 'email': {
      const target = normalizeEmail(identity.value)
      return person.knownEmails.some((e) => normalizeEmail(e) === target)
    }
    case 'phone': {
      const target = normalizePhone(identity.value)
      return person.knownPhones.some((p) => normalizePhone(p) === target)
    }
    case 'handle': {
      const target = normalizeHandle(identity.value)
      return person.knownHandles.some((h) => normalizeHandle(h) === target)
    }
  }
}
