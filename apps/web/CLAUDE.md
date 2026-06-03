# CLAUDE.md — apps/web

The Next.js 15 App Router web app. The only frontend in v1.

## Contract

- **Routes** live in `app/`. Setup-flow routes are grouped under `app/setup/`.
- **API routes** live in `app/api/`. Use route handlers (`route.ts`), not the legacy `pages/api/`.
- **No business logic in route handlers.** Route handlers parse the request, delegate to functions in `packages/*`, and shape the response. Domain rules belong in packages so they're testable in isolation.
- **No raw DB queries in components or route handlers.** Use a small adapter layer in `apps/web/src/server/` that wraps `@speedy/db`.
- **Server vs client components.** Default to server. Add `'use client'` only when you need browser APIs or interactivity (setup-flow forms will need it; static pages don't).

## Tests

- **Unit tests**: Vitest. Place test files next to the source (`page.tsx` → `page.test.tsx`). Use `@testing-library/react` for component tests.
- **E2E tests**: Playwright, in `e2e/`. The config starts `pnpm dev` automatically if no server is running.

## Local commands

- `pnpm dev` — Next dev server at `localhost:3000`.
- `pnpm test` — unit tests via Vitest.
- `pnpm test:e2e` — E2E tests via Playwright.
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm build` — production build.

## Style note (v1)

Use inline styles for the placeholder and setup screens until Tailwind lands in PR #12. Don't introduce a new styling library in the meantime — the locked stack picks Tailwind for v1.
