# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## i18n (next-intl)

- Locales are `fr` (default), `de`, `en`, declared in `src/i18n/routing.ts`. Active locale is stored in the
  `NEXT_LOCALE` cookie (see `src/i18n/locale-cookie.ts`, `src/i18n/set-locale.ts`) and read server-side in
  `src/i18n/request.ts`. The `LocaleSwitcher` component (`src/components/layout/locale-switcher.tsx`, rendered
  from the user menu) lets a signed-in user change it.
- `User.locale` in `prisma/schema.prisma` is **dead schema** — it is set by `prisma/seed.ts` but nothing in the
  app reads it. The actual UI locale is entirely cookie-driven. Don't assume this column does anything.
- Server-side library code (anything under `src/lib/ai/*`, not just `src/app/api/**/route.ts`) can and should
  call `getTranslations()` / `getLocale()` from `next-intl/server` directly — it works from any async function
  during a request, not just top-level route handlers. Several AI helpers (`client.ts`, `chat-tools.ts`,
  `anomaly-detector.ts`) previously threw or returned hardcoded German strings that leaked straight into API
  responses and chat UI text regardless of locale; that whole class of bug is why this note exists.
- Claude system prompts that ask for free-form generated text (weekly briefing, forecast summary, auto-planner
  suggestion reasons) must not hardcode a response language. Use
  `getResponseLanguageDirective()` from `src/lib/ai/locale-instruction.ts` to get a locale-appropriate
  "respond in X" directive instead of writing `Antworte auf Deutsch` inline.
- `messages/{de,en,fr}.json` must always have identical key sets — verify with a flatten+diff before committing
  message changes; nothing enforces this automatically.
- Demo/seed content (division titles, shift titles, category names, the demo company address/employee names in
  `prisma/seed.ts`) is intentionally left in German and not routed through message keys — it's user-editable
  data, not app chrome, same category as any other org's real data.

## Known pre-existing bugs (not introduced by i18n work, still open)

- `prisma/migrations/20260301144238_init` is missing the `mod_requests.note` column that
  `prisma/schema.prisma`'s `ModRequest` model declares. Any request that queries `ModRequest` (e.g.
  `GET /api/mod-requests`, used by the wish-plan feature) 500s with `P2022: column "mod_requests.note" does
  not exist` against a freshly-migrated database. Needs a follow-up migration, not something to bundle into an
  unrelated PR.

## Local dev DB without docker/sudo

If the sandbox has no docker group membership and no passwordless sudo (common in disposable containers),
`docker compose up` for `postgres`/`redis`/`minio` won't work. A real local Postgres can still be stood up in
userspace with the `embedded-postgres` npm package (portable binary, no root needed) pointed at the same
`DATABASE_URL` from `.env`. `npx prisma migrate deploy` picks up `.env` via `prisma.config.ts` (`dotenv/config`),
but `npx tsx prisma/seed.ts` does **not** auto-load `.env` (seed.ts has no dotenv import) — pass
`DATABASE_URL=... npx tsx prisma/seed.ts` explicitly or it fails with a confusing "credentials for `(not
available)`" auth error rather than a clear "not set" error.

## Browser QA without a real Chrome install

`chrome-devtools-axi` looks for a stable-channel Chrome at a fixed path and fails if it's not there, even when
a Puppeteer-downloaded Chrome binary exists at `~/.cache/puppeteer/chrome/.../chrome`. Launch that binary
yourself with `--headless=new --remote-debugging-port=9222`, then set
`CHROME_DEVTOOLS_AXI_BROWSER_URL=http://127.0.0.1:9222` before running `chrome-devtools-axi` commands — it
connects over CDP instead of trying to launch its own browser.

## Open product question: Socket.IO server in production Docker

`server.ts` runs a custom Node HTTP server with a Socket.IO layer for the
"Live sessions" real-time features (see README's Real-Time Collaboration
section and `src/lib/socket.ts` / `src/components/schedule/live-mode.tsx`).

The production `Dockerfile` does **not** build or run `server.ts`. It uses
Next's `output: "standalone"` build, whose generated `.next/standalone/server.js`
is Next's own minimal server with no Socket.IO attached, and `CMD ["node", "server.js"]`
runs that instead. This is deliberate for this ship task (fixing the Docker
build/config) and was left as-is rather than fixed, because deciding how
real-time should run in production is a product/architecture decision,
not a config bug:

- Run `server.ts` as the container's entrypoint instead of the standalone
  `server.js` (loses some of Next's standalone-output tracing benefits,
  needs its own build step for `server.ts`), or
- Keep `next start`/standalone in Docker and run the Socket.IO server as a
  separate process/service (needs its own container + Caddy routing), or
- Drop the custom server and reimplement real-time updates on top of
  Next.js Route Handlers / Server-Sent Events instead of Socket.IO.

Until one of these is chosen, real-time "Live sessions" features will not
work in a `docker compose up -d` production deployment even though the
Caddyfile already has WebSocket-upgrade routing rules waiting for a server
that isn't there.
