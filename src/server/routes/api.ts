import { Hono, type Context } from "hono";
import { context, reddit, redis } from "@devvit/web/server";
import {
  normalizeUsername,
  nowTs,
  opponentOf,
  stableHash,
  uniqueId,
  type InviteState,
  type MatchActionResult,
  type MatchState,
  type FactionId,
  type PlayerSide,
  type StartMatchInput,
} from "../../shared/game";
import { DEFAULT_FACTION } from "../game/models";
import { createInitialMatch, endTurn, playCard, applyMulligan, attack, repayNakedShort, sideForUser, tickTimeouts } from "../game/engine";
import { runAiUntilHumanTurn } from "../game/ai";
import {
  createRedisLike,
  getCurrentWeekId,
  getInvite,
  getLeaderboardTop,
  getMatch,
  incrementWeekMatchCount,
  indexMatchForUser,
  listPendingInvites,
  listUserMatchIds,
  recordUserOutcome,
  saveInvite,
  saveMatch,
  updateInvite,
  type RedisLike,
} from "../game/storage";
import { validateWeekOpen } from "../core/post";

interface ErrorResponse {
  ok: false;
  error: string;
}

const storageRedis = createRedisLike(redis);

type ApiStatus = 400 | 401 | 403 | 404 | 409 | 500;

function fail(c: Context, error: string, status: number = 400) {
  return c.json<ErrorResponse>({ ok: false, error }, status as ApiStatus);
}

function freshMatchSeed(base: string): number {
  return stableHash(`${base}:${nowTs()}:${Math.random().toString(36).slice(2)}`);
}

function ok<T>(c: Context, data: T) {
  return c.json({ ok: true as const, data });
}

function requireActor(): { ok: true; userId: string; username: string } | { ok: false; error: string; status: number } {
  if (!context.userId) {
    return { ok: false, status: 401, error: "User must be logged in." };
  }
  if (!context.username) {
    return { ok: false, status: 401, error: "Username is unavailable in context." };
  }
  return {
    ok: true,
    userId: context.userId,
    username: normalizeUsername(context.username),
  };
}

async function ensureActivePost(redisLike: RedisLike) {
  return validateWeekOpen({
    redis: redisLike,
    postId: context.postId,
    postData: context.postData,
  });
}

async function finalizeIfFinished(redisLike: RedisLike, wasFinished: boolean, match: MatchState): Promise<void> {
  if (wasFinished) {
    return;
  }
  if (match.status !== "finished" || !match.winnerSide) {
    return;
  }

  const winner = match.players[match.winnerSide];
  const loser = match.players[opponentOf(match.winnerSide)];

  if (!winner.isBot) {
    await recordUserOutcome(redisLike, match.weekId, { userId: winner.userId, username: winner.username }, true);
  }
  if (!loser.isBot) {
    await recordUserOutcome(redisLike, match.weekId, { userId: loser.userId, username: loser.username }, false);
  }

  await incrementWeekMatchCount(redisLike, match.weekId);
}

async function loadMatch(matchId: string): Promise<{ ok: true; match: MatchState } | { ok: false; status: number; error: string }> {
  const match = await getMatch(storageRedis, matchId);
  if (!match) {
    return { ok: false, status: 404, error: "Match not found." };
  }
  return { ok: true, match };
}

async function notifyInvite(invite: InviteState): Promise<void> {
  try {
    const post = await reddit.getPostById(invite.postId as `t3_${string}`);
    await post.addComment({
      text: `u/${invite.targetUsername} you have a Court of Capital invite from u/${invite.inviterUsername}. Open the post and Accept.`,
    });
  } catch (error) {
    console.error("Invite notification failed:", error);
  }
}

export const api = new Hono();

api.post("/lobby", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const weekState = await ensureActivePost(storageRedis);
  if (!weekState.ok) {
    return fail(c, weekState.error, weekState.status);
  }

  const invites = await listPendingInvites(storageRedis, actor.username);
  const userMatchIds = await listUserMatchIds(storageRedis, actor.userId);

  const ongoing: string[] = [];
  for (const matchId of userMatchIds) {
    const one = await getMatch(storageRedis, matchId);
    if (one && one.status !== "finished") {
      ongoing.push(matchId);
    }
  }

  const leaderboard = await getLeaderboardTop(storageRedis, weekState.weekId, 10);

  return ok(c, {
    snapshot: {
      weekId: weekState.weekId,
      postId: weekState.postId,
      pendingInvites: invites,
      ongoingMatchIds: ongoing,
      leaderboard,
    },
  });
});

api.post("/match/ai", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const weekState = await ensureActivePost(storageRedis);
  if (!weekState.ok) {
    return fail(c, weekState.error, weekState.status);
  }

  const body = (await c.req.json()) as { level: 1 | 2 | 3; faction?: FactionId };
  if (![1, 2, 3].includes(body.level)) {
    return fail(c, "Invalid AI level.");
  }

  const now = nowTs();
  const initInput: StartMatchInput = {
    weekId: weekState.weekId,
    postId: weekState.postId,
    mode: "pve",
    playerA: {
      userId: actor.userId,
      username: actor.username,
      faction: body.faction ?? DEFAULT_FACTION,
    },
    playerB: {
      userId: `bot_l${body.level}`,
      username: `courtbot-l${body.level}`,
      faction: "short_hedgefund",
      isBot: true,
      botLevel: body.level,
    },
    seed: freshMatchSeed(`${weekState.weekId}:${actor.userId}:${now}:${body.level}`),
  };

  const match = createInitialMatch(initInput, now);
  await saveMatch(storageRedis, match);
  await indexMatchForUser(storageRedis, actor.userId, match.id);

  return ok(c, {
    result: {
      ok: true,
      match,
    } satisfies MatchActionResult,
  });
});

api.post("/match/invite", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const weekState = await ensureActivePost(storageRedis);
  if (!weekState.ok) {
    return fail(c, weekState.error, weekState.status);
  }

  const body = (await c.req.json()) as { targetUsername?: string; faction?: FactionId };
  const targetUsername = normalizeUsername(body.targetUsername ?? "");
  if (!targetUsername) {
    return fail(c, "Target username is required.");
  }
  if (targetUsername === actor.username) {
    return fail(c, "You cannot invite yourself.");
  }

  const now = nowTs();
  const invite: InviteState = {
    id: uniqueId("invite", stableHash(`${actor.userId}:${targetUsername}:${now}`), 1),
    weekId: weekState.weekId,
    postId: weekState.postId,
    inviterUserId: actor.userId,
    inviterUsername: actor.username,
    inviterFaction: body.faction ?? DEFAULT_FACTION,
    targetUsername,
    status: "pending",
    createdAt: now,
  };

  await saveInvite(storageRedis, invite);
  await notifyInvite(invite);

  return ok(c, { invite });
});

api.post("/invite/accept", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const weekState = await ensureActivePost(storageRedis);
  if (!weekState.ok) {
    return fail(c, weekState.error, weekState.status);
  }

  const body = (await c.req.json()) as { inviteId: string; faction?: FactionId };
  const invite = await getInvite(storageRedis, body.inviteId);
  if (!invite) {
    return fail(c, "Invite not found.", 404);
  }
  if (invite.status !== "pending") {
    return fail(c, "Invite is not pending.");
  }

  if (invite.targetUsername !== actor.username) {
    return fail(c, "Invite does not belong to this user.", 403);
  }

  if (invite.weekId !== weekState.weekId || invite.postId !== weekState.postId) {
    return fail(c, "Invite belongs to an archived week/post.", 409);
  }

  const now = nowTs();
  const match = createInitialMatch(
    {
      weekId: invite.weekId,
      postId: invite.postId,
      mode: "pvp",
      playerA: {
        userId: invite.inviterUserId,
        username: invite.inviterUsername,
        faction: invite.inviterFaction ?? DEFAULT_FACTION,
      },
      playerB: {
        userId: actor.userId,
        username: actor.username,
        faction: body.faction ?? DEFAULT_FACTION,
        isBot: false,
      },
      seed: freshMatchSeed(`${invite.id}:${actor.userId}:${now}`),
    },
    now,
  );

  invite.status = "accepted";
  invite.acceptedAt = now;
  invite.matchId = match.id;

  await updateInvite(storageRedis, invite);
  await saveMatch(storageRedis, match);
  await indexMatchForUser(storageRedis, invite.inviterUserId, match.id);
  await indexMatchForUser(storageRedis, actor.userId, match.id);

  return ok(c, {
    invite,
    result: {
      ok: true,
      match,
    } satisfies MatchActionResult,
  });
});

api.post("/match/get", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const body = (await c.req.json()) as { matchId: string };
  const loaded = await loadMatch(body.matchId);
  if (!loaded.ok) {
    return fail(c, loaded.error, loaded.status);
  }

  if (!sideForUser(loaded.match, actor.userId)) {
    return fail(c, "You are not a player in this match.", 403);
  }

  const wasFinished = loaded.match.status === "finished";
  let next = tickTimeouts(loaded.match);
  next = runAiUntilHumanTurn(next);
  await finalizeIfFinished(storageRedis, wasFinished, next);
  await saveMatch(storageRedis, next);

  return ok(c, { match: next });
});

api.post("/match/mulligan", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const body = (await c.req.json()) as {
    matchId: string;
    action: { side: PlayerSide; replaceIndices: number[] };
  };

  const loaded = await loadMatch(body.matchId);
  if (!loaded.ok) {
    return fail(c, loaded.error, loaded.status);
  }

  const wasFinished = loaded.match.status === "finished";
  const side = sideForUser(loaded.match, actor.userId);
  if (!side) {
    return fail(c, "You are not a player in this match.", 403);
  }
  if (side !== body.action.side) {
    return fail(c, "Action side mismatch.", 403);
  }

  let next = tickTimeouts(loaded.match);
  const result = applyMulligan(next, body.action);
  next = runAiUntilHumanTurn(result.match);

  await finalizeIfFinished(storageRedis, wasFinished, next);
  await saveMatch(storageRedis, next);

  return ok(c, {
    result: {
      ok: result.ok,
      error: result.error,
      match: next,
    } satisfies MatchActionResult,
  });
});

api.post("/match/play", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const body = (await c.req.json()) as {
    matchId: string;
    action: {
      side: PlayerSide;
      handIndex: number;
      lane: "front" | "back";
      col: number;
      leverage?: 2 | 3 | 4 | 5;
      target?:
        | { kind: "ally-unit"; unitId: string }
        | { kind: "enemy-unit"; unitId: string }
        | { kind: "ally-leader" }
        | { kind: "enemy-leader" };
    };
  };

  const loaded = await loadMatch(body.matchId);
  if (!loaded.ok) {
    return fail(c, loaded.error, loaded.status);
  }

  const wasFinished = loaded.match.status === "finished";
  const side = sideForUser(loaded.match, actor.userId);
  if (!side) {
    return fail(c, "You are not a player in this match.", 403);
  }
  if (side !== body.action.side) {
    return fail(c, "Action side mismatch.", 403);
  }

  let next = tickTimeouts(loaded.match);
  const result = playCard(next, body.action);
  next = runAiUntilHumanTurn(result.match);

  await finalizeIfFinished(storageRedis, wasFinished, next);
  await saveMatch(storageRedis, next);

  return ok(c, {
    result: {
      ok: result.ok,
      error: result.error,
      match: next,
    } satisfies MatchActionResult,
  });
});

api.post("/match/attack", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const body = (await c.req.json()) as {
    matchId: string;
    action: {
      side: PlayerSide;
      attackerUnitId: string;
      target:
        | { kind: "leader" }
        | { kind: "judge" }
        | { kind: "unit"; unitId: string }
        | { kind: "event"; eventUnitId: string };
    };
  };

  const loaded = await loadMatch(body.matchId);
  if (!loaded.ok) {
    return fail(c, loaded.error, loaded.status);
  }

  const wasFinished = loaded.match.status === "finished";
  const side = sideForUser(loaded.match, actor.userId);
  if (!side) {
    return fail(c, "You are not a player in this match.", 403);
  }
  if (side !== body.action.side) {
    return fail(c, "Action side mismatch.", 403);
  }

  let next = tickTimeouts(loaded.match);
  const result = attack(next, body.action);
  next = runAiUntilHumanTurn(result.match);

  await finalizeIfFinished(storageRedis, wasFinished, next);
  await saveMatch(storageRedis, next);

  return ok(c, {
    result: {
      ok: result.ok,
      error: result.error,
      match: next,
    } satisfies MatchActionResult,
  });
});

api.post("/match/end-turn", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const body = (await c.req.json()) as {
    matchId: string;
    action: { side: PlayerSide };
  };

  const loaded = await loadMatch(body.matchId);
  if (!loaded.ok) {
    return fail(c, loaded.error, loaded.status);
  }

  const wasFinished = loaded.match.status === "finished";
  const side = sideForUser(loaded.match, actor.userId);
  if (!side) {
    return fail(c, "You are not a player in this match.", 403);
  }
  if (side !== body.action.side) {
    return fail(c, "Action side mismatch.", 403);
  }

  let next = tickTimeouts(loaded.match);
  const result = endTurn(next, body.action.side);
  next = runAiUntilHumanTurn(result.match);

  await finalizeIfFinished(storageRedis, wasFinished, next);
  await saveMatch(storageRedis, next);

  return ok(c, {
    result: {
      ok: result.ok,
      error: result.error,
      match: next,
    } satisfies MatchActionResult,
  });
});

api.post("/match/repay-naked-short", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const body = (await c.req.json()) as {
    matchId: string;
    action: { side: PlayerSide };
  };

  const loaded = await loadMatch(body.matchId);
  if (!loaded.ok) {
    return fail(c, loaded.error, loaded.status);
  }

  const wasFinished = loaded.match.status === "finished";
  const side = sideForUser(loaded.match, actor.userId);
  if (!side) {
    return fail(c, "You are not a player in this match.", 403);
  }
  if (side !== body.action.side) {
    return fail(c, "Action side mismatch.", 403);
  }

  let next = tickTimeouts(loaded.match);
  const result = repayNakedShort(next, body.action.side);
  next = runAiUntilHumanTurn(result.match);

  await finalizeIfFinished(storageRedis, wasFinished, next);
  await saveMatch(storageRedis, next);

  return ok(c, {
    result: {
      ok: result.ok,
      error: result.error,
      match: next,
    } satisfies MatchActionResult,
  });
});

api.get("/health", async (c) => {
  const weekId = await getCurrentWeekId(storageRedis);
  return ok(c, {
    status: "ok",
    weekId,
  });
});





