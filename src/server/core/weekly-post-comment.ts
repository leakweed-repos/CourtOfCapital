import type { RedditClient } from "@devvit/web/server";
import { nowTs, PREFIX } from "../../shared/game";
import { withLock, type RedisLike } from "../game/storage";

type WeeklyIntroCommentJob = {
  postId: string;
  weekId: string;
  weekNumber: number;
  dueAt: number;
  createdAt: number;
};

type WeeklyIntroCommentContext = {
  redis: RedisLike;
  reddit: Pick<RedditClient, "getPostById">;
};

type WeeklyIntroCommentScheduleInput = {
  redis: RedisLike;
  postId: string;
  weekId: string;
  weekNumber: number;
  createdAt?: number;
};

const WEEKLY_INTRO_COMMENT_DELAY_MS = 5 * 60 * 1000;

const WEEKLY_INTRO_COMMENT_TEXT = `Welcome to Court of Capital (Weekly Court)

- Tap Enter Court to play the current week.
- Older weekly posts are archived (leaderboard only, no new matches).
- Weekly leaderboard resets each new Court.
- Judge slots (Green/Blue) give some units special interactions.

If you hit a bug, please reply with:
Platform + what happened + what you expected + cards involved + match type (+ screenshot if possible).

Feedback on balance/UI/tutorial is very welcome. I'm actively patching based on comments.`;

const WEEKLY_INTRO_COMMENT_LOCK_OPTIONS = {
  ttlSeconds: 30,
  waitMs: 10_000,
  retryMs: 50,
} as const;

function keyWeeklyIntroCommentPendingSet(): string {
  return `${PREFIX}:week:intro-comment:pending`;
}

function keyWeeklyIntroCommentJob(postId: string): string {
  return `${PREFIX}:week:intro-comment:job:${postId}`;
}

function keyWeeklyIntroCommentPosted(postId: string): string {
  return `${PREFIX}:week:intro-comment:posted:${postId}`;
}

function parseWeeklyIntroCommentJob(raw: string): WeeklyIntroCommentJob | null {
  try {
    const parsedUnknown: unknown = JSON.parse(raw);
    if (!parsedUnknown || typeof parsedUnknown !== "object") {
      return null;
    }
    const postId = Reflect.get(parsedUnknown, "postId");
    const weekId = Reflect.get(parsedUnknown, "weekId");
    const weekNumber = Reflect.get(parsedUnknown, "weekNumber");
    const dueAt = Reflect.get(parsedUnknown, "dueAt");
    const createdAt = Reflect.get(parsedUnknown, "createdAt");
    if (
      typeof postId !== "string" ||
      typeof weekId !== "string" ||
      typeof weekNumber !== "number" ||
      typeof dueAt !== "number" ||
      typeof createdAt !== "number"
    ) {
      return null;
    }
    return {
      postId,
      weekId,
      weekNumber,
      dueAt,
      createdAt,
    };
  } catch {
    return null;
  }
}

export async function scheduleWeeklyIntroComment(input: WeeklyIntroCommentScheduleInput): Promise<void> {
  const createdAt = input.createdAt ?? nowTs();
  const job: WeeklyIntroCommentJob = {
    postId: input.postId,
    weekId: input.weekId,
    weekNumber: input.weekNumber,
    createdAt,
    dueAt: createdAt + WEEKLY_INTRO_COMMENT_DELAY_MS,
  };
  await input.redis.set(keyWeeklyIntroCommentJob(input.postId), JSON.stringify(job));
  await input.redis.sAdd(keyWeeklyIntroCommentPendingSet(), input.postId);
}

async function isWeeklyIntroCommentPosted(redis: RedisLike, postId: string): Promise<boolean> {
  const raw = await redis.get(keyWeeklyIntroCommentPosted(postId));
  return raw === "1";
}

async function markWeeklyIntroCommentPosted(redis: RedisLike, postId: string): Promise<void> {
  await redis.set(keyWeeklyIntroCommentPosted(postId), "1");
  await redis.expire(keyWeeklyIntroCommentPosted(postId), 90 * 24 * 60 * 60);
}

async function clearWeeklyIntroCommentJob(redis: RedisLike, postId: string): Promise<void> {
  await redis.del(keyWeeklyIntroCommentJob(postId));
  await redis.sRem(keyWeeklyIntroCommentPendingSet(), postId);
}

export async function processDueWeeklyIntroComments(context: WeeklyIntroCommentContext): Promise<{
  scanned: number;
  due: number;
  posted: number;
  skippedAlreadyPosted: number;
  failed: number;
}> {
  return withLock(context.redis, "week:intro-comments", WEEKLY_INTRO_COMMENT_LOCK_OPTIONS, async () => {
    const pendingPostIds = await context.redis.sMembers(keyWeeklyIntroCommentPendingSet());
    const now = nowTs();
    let due = 0;
    let posted = 0;
    let skippedAlreadyPosted = 0;
    let failed = 0;

    for (const postId of pendingPostIds) {
      const raw = await context.redis.get(keyWeeklyIntroCommentJob(postId));
      if (!raw) {
        await context.redis.sRem(keyWeeklyIntroCommentPendingSet(), postId);
        continue;
      }
      const job = parseWeeklyIntroCommentJob(raw);
      if (!job) {
        console.warn(`[weekly-intro-comment] Invalid job payload for post ${postId}, clearing.`);
        await clearWeeklyIntroCommentJob(context.redis, postId);
        continue;
      }
      if (job.dueAt > now) {
        continue;
      }

      due += 1;

      if (await isWeeklyIntroCommentPosted(context.redis, job.postId)) {
        skippedAlreadyPosted += 1;
        await clearWeeklyIntroCommentJob(context.redis, job.postId);
        continue;
      }

      try {
        const post = await context.reddit.getPostById(job.postId as `t3_${string}`);
        await post.addComment({ text: WEEKLY_INTRO_COMMENT_TEXT });
        await markWeeklyIntroCommentPosted(context.redis, job.postId);
        await clearWeeklyIntroCommentJob(context.redis, job.postId);
        posted += 1;
      } catch (error) {
        failed += 1;
        console.error(`[weekly-intro-comment] Failed to comment on ${job.postId} (week ${job.weekId}):`, error);
      }
    }

    return {
      scanned: pendingPostIds.length,
      due,
      posted,
      skippedAlreadyPosted,
      failed,
    };
  });
}
