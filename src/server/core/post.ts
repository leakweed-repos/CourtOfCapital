import type { RedditClient } from "@devvit/web/server";
import { nowTs } from "../../shared/game";
import { getCurrentWeekId, getWeekPostId, type RedisLike } from "../game/storage";

export interface PostContext {
  redis: RedisLike;
  postId: string | undefined;
  postData: unknown;
}

export interface CreateWeeklyPostContext {
  reddit: Pick<RedditClient, "submitCustomPost">;
  subredditName: string;
}

function readWeekId(postData: unknown): string | null {
  if (!postData || typeof postData !== "object") {
    return null;
  }

  const weekId = (postData as Record<string, unknown>).weekId;
  if (typeof weekId !== "string" || weekId.trim().length === 0) {
    return null;
  }

  return weekId;
}

export async function createWeeklyPost(
  context: CreateWeeklyPostContext,
  weekId: string,
  weekNumber: number,
): Promise<{ id: string }> {
  const createdAt = nowTs();
  const post = await context.reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: `Court of Capital - Weekly Court (#${weekNumber} ${weekId})`,
    entry: "default",
    postData: {
      weekId,
      weekNumber,
      createdAt,
    },
    textFallback: {
      text: "Open this post to enter the Court of Capital weekly lobby.",
    },
  });

  return { id: post.id };
}

export async function validateWeekOpen(
  context: PostContext,
): Promise<{ ok: true; weekId: string; postId: string } | { ok: false; status: number; error: string }> {
  if (!context.postId) {
    return { ok: false, status: 400, error: "Post context is missing postId." };
  }

  const activeWeekId = await getCurrentWeekId(context.redis);
  if (!activeWeekId) {
    return { ok: false, status: 409, error: "No active week is initialized." };
  }

  const postWeekId = readWeekId(context.postData);
  if (!postWeekId) {
    return { ok: false, status: 400, error: "Post has no weekId metadata." };
  }

  if (postWeekId !== activeWeekId) {
    return {
      ok: false,
      status: 409,
      error: `Post week mismatch (${postWeekId}) vs active (${activeWeekId}).`,
    };
  }

  const activePostId = await getWeekPostId(context.redis, activeWeekId);
  if (activePostId && activePostId !== context.postId) {
    return {
      ok: false,
      status: 409,
      error: "This weekly post is archived.",
    };
  }

  return {
    ok: true,
    weekId: activeWeekId,
    postId: context.postId,
  };
}
