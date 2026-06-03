/**
 * Domain types for Project Speedy. Re-exports the DB-shaped types and adds
 * higher-level discriminated unions used by the UI / sync orchestrator.
 *
 * If a type maps 1:1 to a DB row, it lives in `@speedy/db`. Add new types here
 * only when they describe something *between* tables (the People graph, the
 * unified feed, identity resolution).
 */

export type {
  CalendarEvent,
  EmailMessage,
  ExtractedEvent,
  NewCalendarEvent,
  NewEmailMessage,
  NewExtractedEvent,
  NewPerson,
  NewSyncRun,
  NewUserSettings,
  Person,
  SyncRun,
  UserSettings,
} from '@speedy/db'

/**
 * An identifier we use for entity resolution. Connectors emit one of these
 * for each sender / recipient / attendee, and `findPersonByIdentity`
 * decides which `Person` (if any) it belongs to.
 */
export type Identity =
  | { kind: 'email'; value: string }
  | { kind: 'phone'; value: string }
  | { kind: 'handle'; value: string }

/**
 * A discriminated union covering everything that can appear in the
 * chronological dashboard feed. Each variant carries a `timestamp` field used
 * for sorting the merged stream.
 */
import type { CalendarEvent, EmailMessage, ExtractedEvent } from '@speedy/db'

export type FeedItem =
  | { kind: 'email'; timestamp: Date; item: EmailMessage }
  | { kind: 'calendar_event'; timestamp: Date; item: CalendarEvent }
  | { kind: 'extracted_event'; timestamp: Date; item: ExtractedEvent }
