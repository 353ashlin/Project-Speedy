import { NextResponse } from 'next/server'
import { getDb } from '../../../src/server/db'
import { getFeed, getLastSyncs } from '../../../src/server/queries'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed — for client-side refresh of the dashboard after a manual
 * sync without forcing a full page reload.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10)
  const db = getDb()
  const feed = getFeed(db, { limit: Number.isFinite(limit) ? limit : 100 })
  const syncs = getLastSyncs(db)
  return NextResponse.json({
    feed: feed.map((item) => ({
      kind: item.kind,
      timestamp: item.timestamp.toISOString(),
      item: item.item,
    })),
    syncs,
  })
}
