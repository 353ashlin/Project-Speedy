import { GcalConnector } from '@speedy/gcal'
import { GmailConnector } from '@speedy/gmail'
import { GoogleOAuth } from '@speedy/google-shared'
import { getDb } from '../db'
import { getSecrets } from '../secrets'
import { getSettings } from '../settings'
import { type SyncProgressEvent, type SyncResult, runSync } from './orchestrator'

const REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ?? 'http://localhost:3000/api/setup/google-signin/callback'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function backfillSince(days: number): Date {
  return new Date(Date.now() - days * MS_PER_DAY)
}

/**
 * Run both Gmail and Calendar syncs sequentially. Returns per-connector
 * results. Used by `/api/sync/run` and the backfill orchestration page.
 *
 * For first-run backfill, derives `since` from `user_settings`:
 *   - Gmail: `backfill_days_email` (default 30) → ago.
 *   - Calendar: `backfill_days_calendar` (default 60) → ago. The connector
 *     itself extends `timeMax` 60 days into the future from `since`.
 */
export async function runAllConnectors(
  connectorFilter?: 'gmail' | 'gcal',
  onProgress?: (event: SyncProgressEvent) => void,
): Promise<SyncResult[]> {
  const db = getDb()
  const settings = getSettings(db)
  const oauth = new GoogleOAuth(getSecrets(), REDIRECT_URI)
  const results: SyncResult[] = []

  if (!connectorFilter || connectorFilter === 'gmail') {
    const gmail = new GmailConnector(oauth)
    results.push(
      await runSync(gmail, db, {
        since: backfillSince(settings.backfillDaysEmail),
        onProgress,
      }),
    )
  }

  if (!connectorFilter || connectorFilter === 'gcal') {
    const gcal = new GcalConnector(oauth)
    results.push(
      await runSync(gcal, db, {
        since: backfillSince(settings.backfillDaysCalendar),
        onProgress,
      }),
    )
  }

  return results
}
