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

type PostWeekResultOk = {
  ok: true;
  weekId: string;
  postId: string;
  isActiveWeek: boolean;
};

type PostWeekResultFail = {
  ok: false;
  status: number;
  error: string;
};

const LEGAL_MONTH_ABBREVIATIONS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."] as const;

function ordinalSuffix(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return "th";
  }
  const mod10 = day % 10;
  if (mod10 === 1) return "st";
  if (mod10 === 2) return "nd";
  if (mod10 === 3) return "rd";
  return "th";
}

function formatWeeklyCaseDateFromWeekId(weekId: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekId);
  if (!match) {
    return null;
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  // Week IDs are Sunday anchors; display the Monday date in title copy.
  const displayDate = new Date(Date.UTC(year, month - 1, day + 1));
  if (Number.isNaN(displayDate.getTime())) {
    return null;
  }
  const monthLabel = LEGAL_MONTH_ABBREVIATIONS[displayDate.getUTCMonth()];
  const displayDay = displayDate.getUTCDate();
  const displayYearShort = String(displayDate.getUTCFullYear()).slice(-2);
  return `${monthLabel} ${displayDay}${ordinalSuffix(displayDay)} '${displayYearShort}`;
}

function weeklyPostTitle(weekId: string, weekNumber: number): string {
  const formattedDate = formatWeeklyCaseDateFromWeekId(weekId);
  if (!formattedDate) {
    return `Court of Capital - Weekly Case (#${weekNumber}, ${weekId})`;
  }
  return `Court of Capital - Weekly Case (#${weekNumber}, ${formattedDate})`;
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
    title: weeklyPostTitle(weekId, weekNumber),
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
  const resolved = await resolveWeeklyPost(context);
  if (!resolved.ok) {
    return resolved;
  }

  if (!resolved.isActiveWeek) {
    const activeWeekId = await getCurrentWeekId(context.redis);
    return {
      ok: false,
      status: 409,
      error: `Post week mismatch (${resolved.weekId}) vs active (${activeWeekId ?? "unknown"}).`,
    };
  }

  return {
    ok: true,
    weekId: resolved.weekId,
    postId: resolved.postId,
  };
}

export async function resolveWeeklyPost(context: PostContext): Promise<PostWeekResultOk | PostWeekResultFail> {
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

  const isActiveWeek = postWeekId === activeWeekId;
  if (isActiveWeek) {
    const activePostId = await getWeekPostId(context.redis, activeWeekId);
    if (activePostId && activePostId !== context.postId) {
      return {
        ok: false,
        status: 409,
        error: "This weekly post is archived.",
      };
    }
  }

  const registeredPostId = await getWeekPostId(context.redis, postWeekId);
  if (!registeredPostId) {
    return {
      ok: false,
      status: 409,
      error: `Week post mapping is missing for ${postWeekId}.`,
    };
  }
  if (registeredPostId !== context.postId) {
    return {
      ok: false,
      status: 409,
      error: "This weekly post is archived.",
    };
  }

  return {
    ok: true,
    weekId: postWeekId,
    postId: context.postId,
    isActiveWeek,
  };
}
