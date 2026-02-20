import { Hono } from "hono";
import type { MenuItemRequest, UiResponse } from "@devvit/web/shared";
import { context, reddit, redis } from "@devvit/web/server";
import { ensureWeek } from "../core/week";
import { createRedisLike } from "../game/storage";

const storageRedis = createRedisLike(redis);

export const menu = new Hono();

menu.post("/post-create", async (c) => {
  await c.req.json<MenuItemRequest>();

  try {
    const week = await ensureWeek({
      redis: storageRedis,
      reddit,
      subredditName: context.subredditName,
    });

    return c.json<UiResponse>(
      {
        navigateTo: `https://www.reddit.com/r/${context.subredditName}/comments/${week.postId}`,
      },
      200,
    );
  } catch (error) {
    console.error("Failed to open/create weekly post:", error);
    return c.json<UiResponse>(
      {
        showToast: "Failed to open weekly Court post.",
      },
      500,
    );
  }
});
