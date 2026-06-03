import type { Person } from '@speedy/db'
import { describe, expect, it } from 'vitest'
import { findPersonByIdentity, normalizePhone } from './entity-resolution.js'

function makePerson(overrides: Partial<Person>): Person {
  return {
    id: 1,
    displayName: 'Test',
    relationship: 'unknown',
    aliases: [],
    knownEmails: [],
    knownPhones: [],
    knownHandles: [],
    birthday: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('findPersonByIdentity', () => {
  it('finds by exact email match', () => {
    const people = [makePerson({ id: 1, knownEmails: ['joe@example.com'] })]
    const found = findPersonByIdentity({ kind: 'email', value: 'joe@example.com' }, people)
    expect(found?.id).toBe(1)
  })

  it('matches email case-insensitively and trims whitespace', () => {
    const people = [makePerson({ id: 1, knownEmails: ['joe@example.com'] })]
    const found = findPersonByIdentity({ kind: 'email', value: '  JOE@Example.COM  ' }, people)
    expect(found?.id).toBe(1)
  })

  it('returns null for unknown email', () => {
    const people = [makePerson({ id: 1, knownEmails: ['joe@example.com'] })]
    const found = findPersonByIdentity({ kind: 'email', value: 'stranger@example.com' }, people)
    expect(found).toBeNull()
  })

  it('returns the first match when multiple people claim the same email', () => {
    const people = [
      makePerson({ id: 2, knownEmails: ['joe@example.com'] }),
      makePerson({ id: 3, knownEmails: ['joe@example.com'] }),
    ]
    const found = findPersonByIdentity({ kind: 'email', value: 'joe@example.com' }, people)
    expect(found?.id).toBe(2)
  })

  it('matches phone after stripping non-digit characters', () => {
    const people = [makePerson({ id: 1, knownPhones: ['+1 (555) 123-4567'] })]
    expect(findPersonByIdentity({ kind: 'phone', value: '+1-555-123-4567' }, people)?.id).toBe(1)
    expect(findPersonByIdentity({ kind: 'phone', value: '15551234567' }, people)?.id).toBe(1)
  })

  it('does not match phone when country code differs (v1 limitation)', () => {
    const people = [makePerson({ id: 1, knownPhones: ['+1 (555) 123-4567'] })]
    expect(findPersonByIdentity({ kind: 'phone', value: '5551234567' }, people)).toBeNull()
  })

  it('matches handles case-insensitively', () => {
    const people = [makePerson({ id: 1, knownHandles: ['@joew'] })]
    expect(findPersonByIdentity({ kind: 'handle', value: '@JoeW' }, people)?.id).toBe(1)
  })

  it('returns null for empty People list', () => {
    expect(findPersonByIdentity({ kind: 'email', value: 'any@example.com' }, [])).toBeNull()
  })
})

describe('normalizePhone', () => {
  it('strips non-digit characters', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('15551234567')
    expect(normalizePhone('555.123.4567')).toBe('5551234567')
    expect(normalizePhone('abc')).toBe('')
  })
})
