import { calendar, type calendar_v3 } from '@googleapis/calendar'
import type { Connector, NormalizedBatch, SyncOptions } from '@speedy/core'
import type { GoogleOAuth } from '@speedy/google-shared'
import { OAuth2Client } from 'google-auth-library'
import { normalizeCalendarEvent } from './normalize.js'

const PAGE_SIZE = 250
const DEFAULT_BACKFILL_DAYS = 60

/**
 * Read-only Google Calendar connector. Mirrors the Gmail connector shape.
 *
 * Backfill: `events.list({ timeMin: since, timeMax: since + 60d })`.
 * Incremental: `events.list({ syncToken })` — exchanged on subsequent
 * runs via the cursor mechanism.
 *
 * `singleEvents: false` is set so recurring events return their master
 * record (instances are materialized later if/when we need them).
 */
export class GcalConnector implements Connector<calendar_v3.Schema$Event> {
  readonly name = 'gcal'
  private readonly oauth: GoogleOAuth
  private readonly calendarId: string

  constructor(oauth: GoogleOAuth, calendarId = 'primary') {
    this.oauth = oauth
    this.calendarId = calendarId
  }

  async auth(): Promise<void> {
    const token = await this.oauth.getAccessToken()
    if (!token) {
      throw new Error('Calendar connector: not authorized. Visit /setup/google-signin.')
    }
  }

  private async client(): Promise<calendar_v3.Calendar> {
    const token = await this.oauth.getAccessToken()
    if (!token) {
      throw new Error('Calendar connector: not authorized. Visit /setup/google-signin.')
    }
    const auth = new OAuth2Client()
    auth.setCredentials({ access_token: token })
    // Same cross-package OAuth2Client type-mismatch as in the Gmail connector;
    // cast through `unknown` because the runtime classes are identical.
    return calendar({ version: 'v3', auth: auth as unknown as calendar_v3.Options['auth'] })
  }

  async *sync(opts: SyncOptions): AsyncIterable<calendar_v3.Schema$Event> {
    const client = await this.client()

    if (opts.cursor) {
      // Incremental — syncToken cursor.
      let pageToken: string | undefined
      do {
        const response = await client.events.list({
          calendarId: this.calendarId,
          syncToken: opts.cursor,
          pageToken,
          maxResults: PAGE_SIZE,
        })
        for (const event of response.data.items ?? []) {
          yield event
        }
        pageToken = response.data.nextPageToken ?? undefined
      } while (pageToken)
      return
    }

    // Backfill — time-bounded.
    const timeMin = (opts.since ?? new Date()).toISOString()
    const timeMax = new Date(
      (opts.since?.getTime() ?? Date.now()) + DEFAULT_BACKFILL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()

    let pageToken: string | undefined
    do {
      const response = await client.events.list({
        calendarId: this.calendarId,
        timeMin,
        timeMax,
        singleEvents: false,
        pageToken,
        maxResults: PAGE_SIZE,
      })
      for (const event of response.data.items ?? []) {
        yield event
      }
      pageToken = response.data.nextPageToken ?? undefined
    } while (pageToken)
  }

  async normalize(raw: calendar_v3.Schema$Event): Promise<NormalizedBatch> {
    return normalizeCalendarEvent(raw)
  }

  async recordFixture(_opts: { outDir: string }): Promise<void> {
    throw new Error('recordFixture not yet implemented — see issue #10 follow-up.')
  }
}
