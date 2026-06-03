import { NextResponse } from 'next/server'
import { setSetupStep } from '../../../../src/server/settings'

export const dynamic = 'force-dynamic'

/**
 * POST /api/setup/complete
 *
 * Called by the backfill page after all initial syncs have finished
 * successfully. Advances setup_step to 'complete'.
 */
export async function POST() {
  setSetupStep('complete')
  return NextResponse.json({ ok: true, next: '/' })
}
