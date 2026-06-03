import type { DrizzleDb } from '@speedy/db'
import { type UserSettings, userSettings } from '@speedy/db'
import { eq } from 'drizzle-orm'
import { getDb } from './db'

const SETTINGS_ID = 1
export type SetupStep = UserSettings['setupStep']

const SETUP_STEP_TO_URL: Record<SetupStep, string> = {
  welcome: '/setup/welcome',
  anthropic: '/setup/anthropic',
  google_credentials: '/setup/google-credentials',
  google_signin: '/setup/google-signin',
  onboarding: '/setup/onboarding',
  backfill: '/setup/backfill',
  complete: '/',
}

/**
 * Map a `setup_step` enum value to the route the app should redirect to.
 * `complete` maps to `/` (the dashboard).
 */
export function setupStepToUrl(step: SetupStep): string {
  return SETUP_STEP_TO_URL[step]
}

/**
 * Read (and lazily create) the singleton user_settings row. Always returns a
 * fresh row with sane defaults if none exists yet.
 */
export function getSettings(db: DrizzleDb = getDb()): UserSettings {
  const existing = db.select().from(userSettings).where(eq(userSettings.id, SETTINGS_ID)).get()
  if (existing) return existing
  return db.insert(userSettings).values({ id: SETTINGS_ID }).returning().get()
}

/**
 * Advance the setup state machine. Idempotent — re-applying the same step is
 * a no-op.
 */
export function setSetupStep(step: SetupStep, db: DrizzleDb = getDb()): void {
  // Ensure row exists.
  getSettings(db)
  db.update(userSettings)
    .set({ setupStep: step, updatedAt: new Date() })
    .where(eq(userSettings.id, SETTINGS_ID))
    .run()
}
