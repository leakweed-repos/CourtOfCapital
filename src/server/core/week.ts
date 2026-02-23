import type { RedditClient } from "@devvit/web/server";
import { nowTs } from "../../shared/game";
import { PREFIX } from "../../shared/game";
import {
  getCurrentWeekId,
  getCurrentWeekNumber,
  getLeaderboardTop,
  getWeekMatchCount,
  getWeekNumber,
  getWeekPostId,
  newWeekIdFromDate,
  setCurrentWeekId,
  setCurrentWeekNumber,
  setWeekNumber,
  setWeekPostId,
  withLock,
  weekSummaryLine,
  type RedisLike,
} from "../game/storage";
import { createWeeklyPost, type CreateWeeklyPostContext } from "./post";
import { scheduleWeeklyIntroComment } from "./weekly-post-comment";

type WeekReddit = Pick<RedditClient, "submitCustomPost" | "getPostById">;

export interface EnsureWeekContext extends CreateWeeklyPostContext {
  redis: RedisLike;
  reddit: WeekReddit;
}

type WeekState = { weekId: string; postId: string; weekNumber: number };

type RolloverMarker = {
  fromWeekId: string;
  fromPostId: string;
  toWeekId: string;
  toPostId: string;
  toWeekNumber: number;
  committedAt: number;
};

function keyWeekRolloverMarker(): string {
  return `${PREFIX}:week:rollover:last`;
}

const WEEK_LOCK_OPTIONS = {
  ttlSeconds: 300,
  waitMs: 180_000,
  retryMs: 100,
} as const;

const ROLLOVER_IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

async function getLastRolloverMarker(redis: RedisLike): Promise<RolloverMarker | null> {
  const raw = await redis.get(keyWeekRolloverMarker());
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as RolloverMarker;
  } catch {
    return null;
  }
}

async function setLastRolloverMarker(redis: RedisLike, marker: RolloverMarker): Promise<void> {
  await redis.set(keyWeekRolloverMarker(), JSON.stringify(marker));
}

async function ensureWeekUnlocked(context: EnsureWeekContext): Promise<WeekState> {
  let weekId = await getCurrentWeekId(context.redis);
  let weekNumber = await getCurrentWeekNumber(context.redis);

  if (!weekId) {
    weekId = await newWeekIdFromDate(new Date(nowTs()));
    await setCurrentWeekId(context.redis, weekId);
    weekNumber = 0;
    await setCurrentWeekNumber(context.redis, weekNumber);
    await setWeekNumber(context.redis, weekId, weekNumber);
  }

  if (weekNumber === null) {
    weekNumber = await getWeekNumber(context.redis, weekId);
    if (weekNumber === null) {
      weekNumber = 0;
      await setWeekNumber(context.redis, weekId, weekNumber);
    }
    await setCurrentWeekNumber(context.redis, weekNumber);
  }

  const knownWeekNumber = weekNumber;
  const mappedWeekNumber = await getWeekNumber(context.redis, weekId);
  if (mappedWeekNumber === null) {
    await setWeekNumber(context.redis, weekId, knownWeekNumber);
  }

  let postId = await getWeekPostId(context.redis, weekId);
  if (!postId) {
    const post = await createWeeklyPost(context, weekId, knownWeekNumber);
    postId = post.id;
    await setWeekPostId(context.redis, weekId, post.id);
    await scheduleWeeklyIntroComment({
      redis: context.redis,
      postId: post.id,
      weekId,
      weekNumber: knownWeekNumber,
    });
  }

  return { weekId, postId, weekNumber: knownWeekNumber };
}

export async function ensureWeek(context: EnsureWeekContext): Promise<WeekState> {
  return withLock(context.redis, "week:ops", WEEK_LOCK_OPTIONS, async () => ensureWeekUnlocked(context));
}

export async function rolloverWeek(context: EnsureWeekContext): Promise<{ newWeekId: string; newPostId: string; newWeekNumber: number }> {
  return withLock(context.redis, "week:ops", WEEK_LOCK_OPTIONS, async () => {
    const current = await ensureWeekUnlocked(context);
    const marker = await getLastRolloverMarker(context.redis);
    if (
      marker &&
      marker.toWeekId === current.weekId &&
      nowTs() - marker.committedAt <= ROLLOVER_IDEMPOTENCY_WINDOW_MS
    ) {
      return {
        newWeekId: marker.toWeekId,
        newPostId: marker.toPostId,
        newWeekNumber: marker.toWeekNumber,
      };
    }

    const top3 = await getLeaderboardTop(context.redis, current.weekId, 3);
    const totalMatches = await getWeekMatchCount(context.redis, current.weekId);
    const summary = weekSummaryLine(top3, totalMatches);

    const oldPost = await context.reddit.getPostById(current.postId as `t3_${string}`);
    await oldPost.addComment({ text: summary });
    await oldPost.lock();

    let newWeekId = await newWeekIdFromDate(new Date(nowTs()));
    if (newWeekId === current.weekId) {
      newWeekId = await newWeekIdFromDate(new Date(nowTs() + 7 * 24 * 60 * 60 * 1000));
    }

    const newWeekNumber = current.weekNumber + 1;
    const existingNewPostId = await getWeekPostId(context.redis, newWeekId);
    let newPostId = existingNewPostId;
    if (!newPostId) {
      const newPost = await createWeeklyPost(context, newWeekId, newWeekNumber);
      newPostId = newPost.id;
      await setWeekPostId(context.redis, newWeekId, newPost.id);
      await scheduleWeeklyIntroComment({
        redis: context.redis,
        postId: newPost.id,
        weekId: newWeekId,
        weekNumber: newWeekNumber,
      });
    }

    await setCurrentWeekId(context.redis, newWeekId);
    await setCurrentWeekNumber(context.redis, newWeekNumber);
    await setWeekNumber(context.redis, newWeekId, newWeekNumber);

    await setLastRolloverMarker(context.redis, {
      fromWeekId: current.weekId,
      fromPostId: current.postId,
      toWeekId: newWeekId,
      toPostId: newPostId,
      toWeekNumber: newWeekNumber,
      committedAt: nowTs(),
    });

    return {
      newWeekId,
      newPostId,
      newWeekNumber,
    };
  });
}
