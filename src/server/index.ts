import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createServer, getServerPort } from "@devvit/web/server";
import { api } from "./routes/api";
import { menu } from "./routes/menu";
import { triggers } from "./routes/triggers";
import { cron } from "./routes/cron";

const app = new Hono();
const internal = new Hono();

internal.route("/menu", menu);
internal.route("/triggers", triggers);
internal.route("/cron", cron);

app.route("/api", api);
app.route("/internal", internal);

app.onError((err, c) => {
  console.error("[server] unhandled error", {
    method: c.req.method,
    path: c.req.path,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return c.json({ ok: false, error: "Internal server error" }, 500);
});

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
