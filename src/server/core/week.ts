import type { RedditClient } from "@devvit/web/server";
import { nowTs } from "../../shared/game";
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
  weekSummaryLine,
  type RedisLike,
} from "../game/storage";
import { createWeeklyPost, type CreateWeeklyPostContext } from "./post";

type WeekReddit = Pick<RedditClient, "submitCustomPost" | "getPostById">;

export interface EnsureWeekContext extends CreateWeeklyPostContext {
  redis: RedisLike;
  reddit: WeekReddit;
}

export async function ensureWeek(context: EnsureWeekContext): Promise<{ weekId: string; postId: string; weekNumber: number }> {
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
  }

  return { weekId, postId, weekNumber: knownWeekNumber };
}

export async function rolloverWeek(context: EnsureWeekContext): Promise<{ newWeekId: string; newPostId: string; newWeekNumber: number }> {
  const current = await ensureWeek(context);

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
  const newPost = await createWeeklyPost(context, newWeekId, newWeekNumber);

  await setCurrentWeekId(context.redis, newWeekId);
  await setCurrentWeekNumber(context.redis, newWeekNumber);
  await setWeekNumber(context.redis, newWeekId, newWeekNumber);
  await setWeekPostId(context.redis, newWeekId, newPost.id);

  return {
    newWeekId,
    newPostId: newPost.id,
    newWeekNumber,
  };
}
