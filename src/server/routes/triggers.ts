import { Hono } from "hono";
import type { OnAppInstallRequest, TriggerResponse } from "@devvit/web/shared";
import { context, reddit, redis } from "@devvit/web/server";
import { ensureWeek } from "../core/week";
import { createRedisLike } from "../game/storage";

const storageRedis = createRedisLike(redis);

export const triggers = new Hono();

triggers.post("/on-app-install", async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();

  try {
    const week = await ensureWeek({
      redis: storageRedis,
      reddit,
      subredditName: context.subredditName,
    });

    return c.json<TriggerResponse>(
      {
        status: "success",
        message: `Initialized week ${week.weekId} with post ${week.postId} (${input.type}).`,
      },
      200,
    );
  } catch (error) {
    console.error("onAppInstall initialization failed:", error);
    return c.json<TriggerResponse>(
      {
        status: "error",
        message: "Failed to initialize weekly Court post.",
      },
      500,
    );
  }
});
