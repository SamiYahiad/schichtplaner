# Agent notes for this repo

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
