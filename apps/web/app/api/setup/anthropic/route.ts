import { validateAnthropicApiKey } from '@speedy/ai'
import { NextResponse } from 'next/server'
import { getSecrets } from '../../../../src/server/secrets'
import { setSetupStep } from '../../../../src/server/settings'
import { handleAnthropicSetup } from './handler'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const result = await handleAnthropicSetup(body, {
    validate: validateAnthropicApiKey,
    secrets: getSecrets(),
    setStep: setSetupStep,
  })
  return NextResponse.json(result.body, { status: result.status })
}
