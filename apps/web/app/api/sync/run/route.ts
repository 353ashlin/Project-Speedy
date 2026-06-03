import { NextResponse } from 'next/server'
import { runAllConnectors } from '../../../../src/server/sync/run-all'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sync/run?connector=gmail|gcal|all (default all)
 *
 * Runs the sync to completion synchronously and returns the per-connector
 * results. v1 deliberately avoids SSE for simplicity — the client shows
 * a spinner with a status string, not a streaming progress bar.
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const connectorParam = url.searchParams.get('connector')
  const filter: 'gmail' | 'gcal' | undefined =
    connectorParam === 'gmail' || connectorParam === 'gcal' ? connectorParam : undefined

  const results = await runAllConnectors(filter)
  const allOk = results.every((r) => r.status === 'success')
  return NextResponse.json(
    {
      ok: allOk,
      results: results.map((r) => ({
        connector: r.connector,
        itemsSynced: r.itemsSynced,
        status: r.status,
        error: r.error,
      })),
    },
    { status: allOk ? 200 : 207 },
  )
}
