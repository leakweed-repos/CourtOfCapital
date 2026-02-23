import { Hono } from "hono";
import { context, reddit, redis } from "@devvit/web/server";
import { rolloverWeek } from "../core/week";
import { processDueWeeklyIntroComments } from "../core/weekly-post-comment";
import { createRedisLike } from "../game/storage";

const storageRedis = createRedisLike(redis);

export const cron = new Hono();

cron.post("/weekly-rollover", async (c) => {
  try {
    const result = await rolloverWeek({
      redis: storageRedis,
      reddit,
      subredditName: context.subredditName,
    });

    return c.json(
      {
        ok: true,
        ...result,
      },
      200,
    );
  } catch (error) {
    console.error("weekly rollover failed:", error);
    return c.json(
      {
        ok: false,
        error: "Failed to rollover week.",
      },
      500,
    );
  }
});

cron.post("/weekly-intro-comment", async (c) => {
  try {
    const result = await processDueWeeklyIntroComments({
      redis: storageRedis,
      reddit,
    });
    return c.json(
      {
        ok: true,
        ...result,
      },
      200,
    );
  } catch (error) {
    console.error("weekly intro comment processor failed:", error);
    return c.json(
      {
        ok: false,
        error: "Failed to process weekly intro comments.",
      },
      500,
    );
  }
});
