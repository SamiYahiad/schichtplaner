import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/ws",
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join:org", (orgId: string) => {
      socket.join(`org:${orgId}`);
    });

    socket.on("join:schedule", (scheduleId: string) => {
      socket.join(`schedule:${scheduleId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  (globalThis as any).__socketIO = io;

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
