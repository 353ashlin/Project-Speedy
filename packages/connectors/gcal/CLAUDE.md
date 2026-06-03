# CLAUDE.md — packages/connectors/gcal

Read-only Google Calendar connector. Backfill via `events.list` with a time
window, incremental via `syncToken`. Mirrors the Gmail connector contract.

## Contract

- **Implements `Connector<calendar_v3.Schema$Event>`** from `@speedy/core`.
- **Read-only.** Uses only `calendar.readonly` + `calendar.events.readonly`
  scopes. Never add anything that writes to a calendar.
- **`singleEvents: false`** during backfill so recurring events come back as
  their master rule. Materializing instances is v2+.
- **Connector emits people stubs** for each attendee, deduped by lowercased
  email. Same pattern as Gmail — orchestrator resolves and patches IDs.

## Sync semantics

- **Backfill**: `sync({ since })` calls `events.list` with `timeMin: since`
  and `timeMax: since + 60 days`. Pages through all results.
- **Incremental**: `sync({ cursor: syncToken })` calls `events.list` with
  the saved `syncToken`. Google returns updated + deleted events.
- The default `calendarId` is `'primary'`. Constructor accepts an override
  for multi-calendar support later.

## Fixtures

`__fixtures__/events/*.json` — hand-curated `calendar_v3.Schema$Event`
shapes. Cover one specific case per fixture: timed 1:1, multi-attendee with
dedup case, all-day, recurring master.

## Time handling

- **Timed events** (`start.dateTime` ISO 8601): stored as `Date`, `isAllDay
  = false`.
- **All-day events** (`start.date` `YYYY-MM-DD`): parsed as midnight UTC of
  the given day, `isAllDay = true`. The "midnight UTC" choice keeps math
  stable across timezone moves; the UI is free to render in local time.
- **Missing / unparseable**: falls back to epoch (`new Date(0)`) — never
  throws, but those rows will look obviously broken on the dashboard,
  which is the right failure mode.

## v1 limitations

- **No recurring-instance materialization.** Master rules only.
- **No working hours / availability logic.**
- **No timezone awareness in the stored `Date`** — `Date` is a UTC instant,
  not zoned. If we need timezone-aware queries later we add `start_tz` and
  `end_tz` columns.
