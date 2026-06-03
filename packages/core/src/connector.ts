import type { NewCalendarEvent, NewEmailMessage, NewExtractedEvent, NewPerson } from '@speedy/db'

/**
 * What a connector emits per raw item. A connector can produce multiple kinds
 * of records from a single source — e.g. a Gmail message becomes one
 * `NewEmailMessage` plus zero-or-more `NewPerson` rows (one per unresolved
 * sender / recipient identity) plus optionally an `NewExtractedEvent` (when a
 * known-sender parser fires).
 *
 * Fields are optional so connectors only set what they actually produce.
 * The sync orchestrator merges batches and applies them to the DB inside a
 * single transaction.
 */
export interface NormalizedBatch {
  people?: NewPerson[]
  emails?: NewEmailMessage[]
  events?: NewCalendarEvent[]
  extracted?: NewExtractedEvent[]
}

export interface SyncOptions {
  /** Time floor for backfill mode. Ignored when `cursor` is set. */
  since?: Date
  /** Connector-specific resume cursor (Gmail `historyId`, GCal `syncToken`). */
  cursor?: string
}

/**
 * The central abstraction for every data source. Each connector lives in its
 * own package under `packages/connectors/<name>/` and implements this
 * interface. Once one connector ships, adding the next is mechanical — that
 * is the whole point of the AI build loop.
 *
 * Read-only by design. There is no `send` / `update` / `delete` method, and
 * none will ever be added.
 */
export interface Connector<Raw = unknown> {
  /** Stable string identifier, e.g. `'gmail'`, `'gcal'`. Used in `sync_runs`. */
  readonly name: string

  /**
   * Ensure auth state is valid for this connector. Throws on un-recoverable
   * auth failure (e.g. revoked refresh token). Idempotent.
   */
  auth(): Promise<void>

  /**
   * Yield raw items from the upstream API. Use the cursor for incremental
   * sync; fall back to `since`-bounded fetch for first backfill.
   *
   * Implementations should batch under the hood (page through results) but
   * yield one item at a time.
   */
  sync(opts: SyncOptions): AsyncIterable<Raw>

  /**
   * Convert one raw item into the typed batch that will be persisted. Pure
   * function with respect to the raw input — no DB or network calls.
   */
  normalize(raw: Raw): Promise<NormalizedBatch>

  /**
   * Record a redacted fixture for the connector's contract tests. Calls the
   * real API once and writes JSON to `outDir`. The implementation must redact
   * PII (full email bodies, phone numbers, non-known-contact addresses) before
   * writing — never commit raw API responses.
   */
  recordFixture(opts: { outDir: string }): Promise<void>
}
