import net from "node:net";

import { serve } from "@hono/node-server";
import { Hono } from "hono";

const DEFAULT_PORT = 3000;
const LOCALHOST = "localhost";

function parsePort(value: string | undefined, fallback: number) {
  const port = Number.parseInt(value ?? "", 10);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

function canListenOnPort(port: number) {
  return new Promise<boolean>((resolve, reject) => {
    const tester = net.createServer();

    tester.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(false);
        return;
      }

      reject(error);
    });

    tester.once("listening", () => {
      tester.close(() => {
        resolve(true);
      });
    });

    tester.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(preferredPort: number) {
  let port = preferredPort;

  while (!(await canListenOnPort(port))) {
    port += 1;
  }

  return port;
}

function shouldUpdateLocalUrl(rawUrl: string | undefined, port: number) {
  if (!rawUrl) {
    return true;
  }

  try {
    const url = new URL(rawUrl);
    return (
      (url.hostname === LOCALHOST || url.hostname === "127.0.0.1") &&
      Number.parseInt(url.port || "", 10) === port
    );
  } catch {
    return false;
  }
}

const preferredPort = parsePort(process.env.PORT, DEFAULT_PORT);
const port = await findAvailablePort(preferredPort);

if (port !== preferredPort) {
  console.warn(`Port ${preferredPort} is in use. Switching server to ${port}.`);
}

process.env.PORT = String(port);

if (shouldUpdateLocalUrl(process.env.BETTER_AUTH_URL, preferredPort)) {
  process.env.BETTER_AUTH_URL = `http://${LOCALHOST}:${port}`;
}

const [{ trpcServer }, { createContext }, { appRouter }, { auth }, { env }, { cors }, { logger }] =
  await Promise.all([
    import("@hono/trpc-server"),
    import("@my-better-t-app/api/context"),
    import("@my-better-t-app/api/routers/index"),
    import("@my-better-t-app/auth"),
    import("@my-better-t-app/env/server"),
    import("hono/cors"),
    import("hono/logger"),
  ]);

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
