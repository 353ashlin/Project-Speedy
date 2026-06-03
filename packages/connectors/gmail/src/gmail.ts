import { gmail, type gmail_v1 } from '@googleapis/gmail'
import type { Connector, NormalizedBatch, SyncOptions } from '@speedy/core'
import type { GoogleOAuth } from '@speedy/google-shared'
import { OAuth2Client } from 'google-auth-library'
import { normalizeGmailMessage } from './normalize.js'

const PAGE_SIZE = 100

/**
 * Read-only Gmail connector. Backfill via `users.messages.list`, incremental
 * via `users.history.list`. Always read-only — never adds modify, send, or
 * compose scopes / calls.
 */
export class GmailConnector implements Connector<gmail_v1.Schema$Message> {
  readonly name = 'gmail'
  private readonly oauth: GoogleOAuth

  constructor(oauth: GoogleOAuth) {
    this.oauth = oauth
  }

  async auth(): Promise<void> {
    const token = await this.oauth.getAccessToken()
    if (!token) {
      throw new Error('Gmail connector: not authorized. Visit /setup/google-signin.')
    }
  }

  private async client(): Promise<gmail_v1.Gmail> {
    const token = await this.oauth.getAccessToken()
    if (!token) {
      throw new Error('Gmail connector: not authorized. Visit /setup/google-signin.')
    }
    const auth = new OAuth2Client()
    auth.setCredentials({ access_token: token })
    // `@googleapis/gmail` bundles its own google-auth-library copy whose
    // `OAuth2Client` type differs structurally from ours. The runtime is
    // identical, so cast through `unknown` to satisfy both type worlds.
    return gmail({ version: 'v1', auth: auth as unknown as gmail_v1.Options['auth'] })
  }

  async *sync(opts: SyncOptions): AsyncIterable<gmail_v1.Schema$Message> {
    const client = await this.client()

    if (opts.cursor) {
      // Incremental — historyId cursor.
      let pageToken: string | undefined
      do {
        const history = await client.users.history.list({
          userId: 'me',
          startHistoryId: opts.cursor,
          pageToken,
          historyTypes: ['messageAdded'],
        })
        for (const entry of history.data.history ?? []) {
          for (const messageRef of entry.messagesAdded ?? []) {
            const id = messageRef.message?.id
            if (!id) continue
            const full = await client.users.messages.get({ userId: 'me', id })
            yield full.data
          }
        }
        pageToken = history.data.nextPageToken ?? undefined
      } while (pageToken)
      return
    }

    // Backfill — list + get.
    const query = opts.since ? `after:${Math.floor(opts.since.getTime() / 1000)}` : ''
    let pageToken: string | undefined
    do {
      const list = await client.users.messages.list({
        userId: 'me',
        q: query,
        pageToken,
        maxResults: PAGE_SIZE,
      })
      for (const message of list.data.messages ?? []) {
        if (!message.id) continue
        const full = await client.users.messages.get({ userId: 'me', id: message.id })
        yield full.data
      }
      pageToken = list.data.nextPageToken ?? undefined
    } while (pageToken)
  }

  async normalize(raw: gmail_v1.Schema$Message): Promise<NormalizedBatch> {
    return normalizeGmailMessage(raw)
  }

  async recordFixture(_opts: { outDir: string }): Promise<void> {
    // Filled in when we wire `pnpm fixtures:record gmail` at the root in a
    // later PR. For v1 the committed fixtures in `__fixtures__/messages/` are
    // hand-curated; the recorder will help maintain them once real data is
    // flowing.
    throw new Error('recordFixture not yet implemented — see issue #9 follow-up.')
  }
}
