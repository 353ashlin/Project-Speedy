# RUNBOOK — operational playbook

How to perform the recurring operational tasks for Project Speedy. AI agents should follow these step-by-step rather than re-derive the process each time.

## First-time machine setup

1. Install Node 22+ and pnpm 9+:
   ```sh
   brew install node@22 pnpm
   ```
2. Clone the repo and install:
   ```sh
   git clone https://github.com/353ashlin/Project-Speedy.git
   cd Project-Speedy
   pnpm install
   ```
3. Initialize git hooks:
   ```sh
   pnpm exec lefthook install
   ```
4. Start the dev server:
   ```sh
   pnpm dev
   ```
5. Open `http://localhost:3000` and follow the in-app setup walkthrough.

## Add a new connector

Stub — filled in when the first connector ships (PR #9).

The pattern will be: create `packages/connectors/<name>/`, implement the `Connector<Raw, Normalized>` interface from `@speedy/core`, write fixture-recording + contract tests, add a row to `apps/web` connector registry.

## Record / re-record fixtures for a connector

Stub — filled in when the first connector ships (PR #9).

```sh
pnpm fixtures:record <connector-name>
```

Re-runs the connector against your real OAuth account, redacts PII, writes JSON to `packages/connectors/<name>/__fixtures__/`. Review the diff before committing.

## Regenerate Google OAuth credentials

Stub — filled in when OAuth setup ships (PR #8).

When Google revokes a client (e.g. due to inactivity or quota issues):

1. Open Google Cloud Console → APIs & Services → Credentials.
2. Delete the old OAuth client.
3. Create a new OAuth client → application type: **Desktop application**.
4. Download the client ID + secret.
5. In the app: navigate to `/setup/google-credentials` (or Settings → Re-authenticate Google in later versions) and paste the new values.
6. Complete the OAuth sign-in again.

## Rotate the Anthropic API key

Stub — filled in when AI client ships (PR #6).

1. Generate a new key at console.anthropic.com.
2. In the app: Settings → Anthropic key → paste new value.
3. App validates the key with a 1-token test call, then stores in keychain.
4. Revoke the old key in the Anthropic console.

## Debug a sync failure

Stub — filled in when sync ships (PR #11).

When the dashboard shows the "background sync is failing" banner:

1. Open `/sync/history` (or query `sync_runs` table directly via `pnpm db:studio`).
2. Find the most recent failed `sync_run` row.
3. The `error` field has the captured stack trace.
4. Common causes: expired OAuth token (re-auth), Google API quota exceeded (wait and retry), schema mismatch in a recently-updated connector (re-record fixtures).

## Ship a release

For a personal app there's no formal release — `main` is the release. But to mark a milestone:

1. Update `CHANGELOG.md` with the user-visible changes since the last entry.
2. Bump version in root `package.json` (`0.x.y` indefinitely; bump `y` per merge, `x` per milestone).
3. Tag the commit: `git tag v0.x.y && git push --tags`.

## Reset the local database (nuclear option)

```sh
rm -rf data/
pnpm dev
```

The app will treat this as a fresh first-run and walk you through setup again. **You will lose all locally cached email/calendar data and have to re-backfill.** OAuth tokens and API keys in the keychain are unaffected.
