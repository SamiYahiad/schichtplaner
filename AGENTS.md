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

## Form dialog reset patterns (no `useEffect` for state resets)

`react-hooks/set-state-in-effect` (and `ref-during-render`) are enforced lint errors here, so form
dialogs cannot reset their fields via a `useEffect` keyed on `open`. Two patterns replace it,
depending on who owns the `open` state:

- **Locally-owned `open` state** (e.g. `division-form.tsx`): seed the fields directly inside the
  `onOpenChange` handler instead of an effect — there is no render-time comparison needed because
  the handler only fires on an actual transition.
- **`open` as a controlled prop from the parent** (e.g. `shift-form.tsx`, `time-record-form.tsx`,
  `absence-form.tsx`, the briefing sheet in `schedule-options.tsx`): use the React-documented
  "previous prop" render-time comparison — store the previous values of `open` (and any other
  reset-relevant prop) in state, compare during render, and call `setState` conditionally inside
  that `if` block when something changed. This still counts as "resetting during render," which
  the lint rule allows; it's the synchronous `setState`-inside-`useEffect` pattern that's banned.
- **Trap: the comparison must include every value the reset depends on, not just `open`.** A form
  that pre-fills from data still loading when the dialog opens (e.g. `categoriesData` in
  `absence-form.tsx`, `currentMember`, `defaultDate`) needs that data in the compared-and-stored
  dependency set too, or the fields silently stay empty if the query resolves after the dialog is
  already open. This exact regression happened once already: the initial lint fix collapsed the
  comparison down to `open` only, which broke async-data resync, and had to be restored
  (`b62d71f`).
- **Trap: compare the stable source object, not a value derived from it with a fallback.** Comparing
  `categoriesData?.categories ?? []` instead of `categoriesData` itself caused an infinite
  re-render loop in `absence-form.tsx` — while `categoriesData` is loading, `?? []` evaluates its
  fallback branch and allocates a brand-new array literal on every single render, so the dependency
  always looks "changed" and the reset block (which itself triggers a render) never stops firing.
  Always diff against the raw query/prop value, and derive filtered/defaulted values from it
  separately, outside the comparison.

`stopwatch.tsx`'s running elapsed-time display follows the same "no setState-in-effect" rule
differently: `elapsed` is now computed directly during render as `running ? computeElapsed() : 0`
instead of being pushed into state from a `setInterval` callback. The effect only owns an
otherwise-unused tick counter (`setTick((t) => t + 1)` every second while `running`) whose sole job
is to force a re-render so the render-time `computeElapsed()` call re-evaluates against the clock.

`src/lib/socket.ts`'s `useSocketEvent` used to assign `handlerRef.current = handler` directly in
the component body, which is a ref mutation during render (also lint-banned). It's now assigned
inside a `useLayoutEffect` that runs on every render instead — `useLayoutEffect` rather than
`useEffect` so the ref is updated before any browser paint or event delivery, keeping the same
"always call the latest handler" behavior the render-time assignment used to guarantee.

## Docker production stack (docker-compose.yml / Dockerfile / Caddyfile)

A `docker compose up -d --build` from a clean checkout now comes up healthy end to end
(postgres, redis, minio, migrate, app, caddy) and is auth-safe. It did not before; the traps below
are exactly what broke and why, so they don't get re-introduced by a future edit:

- **Migrations never ran at all.** There was no entrypoint or compose step invoking `prisma migrate
  deploy`, so a fresh stack produced a completely empty database (zero tables) while the app
  container still reported healthy. Fixed with a `migrator` Dockerfile stage (full `node_modules`
  copied from the `deps` stage, since the trimmed standalone runner image has no Prisma CLI) and a
  one-shot `migrate` compose service (`prisma migrate deploy`) that `app` depends on via
  `condition: service_completed_successfully`. To seed demo data afterwards (optional, not run
  automatically — it's demo data, not something a real prod deploy should auto-seed), run
  `docker compose run --rm migrate sh -c "npx prisma generate && npx tsx prisma/seed.ts"`.
  `prisma.config.ts`'s `import "dotenv/config"` resolves fine in that stage because `dotenv` is
  present transitively (via `prisma`'s own `c12` dependency) even though it's not a direct
  `package.json` dependency.
- **`mod_requests.note` migration gap (now fixed):** the original `20260301144238_init` migration
  was missing the `note` column `prisma/schema.prisma`'s `ModRequest` model declares, so
  `GET /api/mod-requests` 500'd with `P2022`. Fixed by an additive follow-up migration
  (`20260305000000_add_mod_requests_note`) rather than editing the already-applied init migration.
- **Auth bypass: NextAuth `UntrustedHost` behind Caddy made protected pages fail open.** Self-hosting
  Auth.js behind any reverse proxy (this Caddy setup, or nginx, or anything that isn't a platform
  Auth.js auto-trusts like Vercel) throws `UntrustedHost` on every request unless `trustHost: true`
  is set in `src/lib/auth.config.ts`. Before that fix, the middleware's `!req.auth` check silently
  saw a failed auth resolution as "not applicable" and let unauthenticated requests through to
  protected pages with a 200 instead of redirecting to `/login` — i.e. the reverse-proxy deployment
  had **no working authentication at all**. Always re-verify this with a real unauthenticated
  `curl -sk https://localhost/schedule/...` (expect a 307 to `/login`) after touching
  `auth.config.ts` or the Caddy/compose networking.
- **Login redirects were dead in production even after fixing UntrustedHost.** The middleware's
  `NextResponse.redirect(new URL("/login", req.url))` resolved against `NEXTAUTH_URL`
  (`http://localhost:3000` in `.env.example`'s dev-oriented default), not the actual public
  `https://$DOMAIN` origin Caddy serves — and port 3000 isn't even published to the host, so every
  redirect 404'd/refused in a browser. Fixed by having `docker-compose.yml`'s `app` service derive
  `NEXTAUTH_URL` and `APP_URL` as `https://${DOMAIN:-localhost}` directly from the same `DOMAIN` Caddy
  uses, instead of requiring `.env` to keep two URLs in sync by hand. Do not reintroduce a
  standalone `NEXTAUTH_URL`/`APP_URL` in `.env(.production.example)` — they're compose-computed now.
- **`/api/health` must stay in `src/middleware.ts`'s `publicPaths`.** It's the Docker healthcheck
  target (`wget http://127.0.0.1:3000/api/health`); before `trustHost` was fixed it was incidentally
  reachable (auth was accidentally failing open), so this was easy to miss. With auth actually
  enforced, an unauthenticated healthcheck hitting a non-public route means the container never goes
  healthy and Caddy (which `depends_on: app: condition: service_healthy`) never starts.
- The app healthcheck itself must use `http://127.0.0.1:3000/...`, not `localhost` — inside the
  container `localhost` resolves to `::1` (IPv6) first and gets connection-refused even though the
  app is genuinely up and correct on IPv4.

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
