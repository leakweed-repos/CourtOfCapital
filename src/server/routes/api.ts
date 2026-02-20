import { Hono, type Context } from "hono";
import { context, reddit, redis } from "@devvit/web/server";
import {
  type LobbyMatchSummary,
  normalizeUsername,
  nowTs,
  opponentOf,
  stableHash,
  type TutorialScenarioId,
  uniqueId,
  type InviteState,
  type MatchActionResult,
  type MatchState,
  type FactionId,
  type PlayerSide,
  type StartMatchInput,
} from "../../shared/game";
import { DEFAULT_FACTION } from "../game/models";
import { createInitialMatch, endTurn, playCard, applyMulligan, attack, repositionJudgeSpecialist, repayNakedShort, sideForUser, tickTimeouts } from "../game/engine";
import { runAiUntilHumanTurn } from "../game/ai";
import {
  acknowledgeTutorialStep,
  advanceTutorialAfterAction,
  repairTutorialIfNeeded,
  setupTutorialMatch,
  skipTutorial,
  validateTutorialAction,
} from "../game/tutorial";
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
  type LeaderboardBucket,
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

function aiLevelFromMatch(match: MatchState): 1 | 2 | 3 | undefined {
  if (match.players.A.isBot) {
    return match.players.A.botLevel;
  }
  if (match.players.B.isBot) {
    return match.players.B.botLevel;
  }
  return undefined;
}

function leaderboardBucketForMatch(match: MatchState): LeaderboardBucket | null {
  if (match.mode === "pvp") {
    return "pvp";
  }
  if (match.mode !== "pve") {
    return null;
  }
  const level = aiLevelFromMatch(match) ?? 1;
  if (level === 1) return "pve_l1";
  if (level === 2) return "pve_l2";
  return "pve_l3";
}

function toLobbyMatchSummary(match: MatchState): LobbyMatchSummary {
  return {
    matchId: match.id,
    mode: match.mode,
    status: match.status,
    updatedAt: match.updatedAt,
    aiLevel: aiLevelFromMatch(match),
    playerAUserId: match.players.A.userId,
    playerAUsername: match.players.A.username,
    playerAIsBot: match.players.A.isBot,
    playerBUserId: match.players.B.userId,
    playerBUsername: match.players.B.username,
    playerBIsBot: match.players.B.isBot,
    tutorialScenarioId: match.tutorial?.scenarioId,
  };
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
  if (match.mode === "tutorial") {
    return;
  }

  const winner = match.players[match.winnerSide];
  const loser = match.players[opponentOf(match.winnerSide)];
  const bucket = leaderboardBucketForMatch(match);

  if (!winner.isBot) {
    await recordUserOutcome(redisLike, match.weekId, { userId: winner.userId, username: winner.username }, true, bucket ?? "all");
  }
  if (!loser.isBot) {
    await recordUserOutcome(redisLike, match.weekId, { userId: loser.userId, username: loser.username }, false, bucket ?? "all");
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

async function closeActiveTutorialMatchesForUser(userId: string, now: number): Promise<void> {
  const userMatchIds = await listUserMatchIds(storageRedis, userId);
  for (const matchId of userMatchIds) {
    const one = await getMatch(storageRedis, matchId);
    if (!one || one.mode !== "tutorial" || one.status === "finished") {
      continue;
    }
    const side = sideForUser(one, userId);
    if (!side) {
      continue;
    }
    one.status = "finished";
    one.winReason = "concede";
    one.winnerSide = opponentOf(side);
    one.turnDeadlineAt = now;
    one.updatedAt = now;
    if (one.tutorial) {
      one.tutorial.paused = true;
      one.tutorial.title = "Superseded tutorial";
      one.tutorial.body = "A newer tutorial run was started.";
      one.tutorial.actionHint = "Open the latest tutorial from lobby.";
      one.tutorial.canSkip = false;
    }
    await saveMatch(storageRedis, one);
  }
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

  const quickPlayMatchSummaries: LobbyMatchSummary[] = [];
  const pvpMatchSummaries: LobbyMatchSummary[] = [];
  const tutorialMatchSummaries: LobbyMatchSummary[] = [];
  for (const matchId of userMatchIds) {
    const raw = await getMatch(storageRedis, matchId);
    if (!raw) {
      continue;
    }

    let one = raw;
    if (one.mode === "tutorial") {
      const repaired = repairTutorialIfNeeded(one);
      if (repaired.repaired) {
        one = repaired.match;
        await saveMatch(storageRedis, one);
      }
    }

    if (one.status !== "finished") {
      const summary = toLobbyMatchSummary(one);
      if (one.mode === "pvp") {
        pvpMatchSummaries.push(summary);
      } else if (one.mode === "tutorial") {
        tutorialMatchSummaries.push(summary);
      } else {
        quickPlayMatchSummaries.push(summary);
      }
    }
  }

  quickPlayMatchSummaries.sort((a, b) => b.updatedAt - a.updatedAt);
  pvpMatchSummaries.sort((a, b) => b.updatedAt - a.updatedAt);
  tutorialMatchSummaries.sort((a, b) => b.updatedAt - a.updatedAt);

  const [leaderboardPvp, leaderboardL1, leaderboardL2, leaderboardL3] = await Promise.all([
    getLeaderboardTop(storageRedis, weekState.weekId, 10, "pvp"),
    getLeaderboardTop(storageRedis, weekState.weekId, 10, "pve_l1"),
    getLeaderboardTop(storageRedis, weekState.weekId, 10, "pve_l2"),
    getLeaderboardTop(storageRedis, weekState.weekId, 10, "pve_l3"),
  ]);

  return ok(c, {
    snapshot: {
      weekId: weekState.weekId,
      postId: weekState.postId,
      pendingInvites: invites,
      quickPlayMatchSummaries,
      pvpMatchSummaries,
      tutorialMatchSummaries,
      leaderboardPvp,
      leaderboardPveByLevel: {
        l1: leaderboardL1,
        l2: leaderboardL2,
        l3: leaderboardL3,
      },
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

api.post("/tutorial/start", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const weekState = await ensureActivePost(storageRedis);
  if (!weekState.ok) {
    return fail(c, weekState.error, weekState.status);
  }

  const body = (await c.req.json()) as { scenarioId?: TutorialScenarioId; faction?: FactionId };
  const now = nowTs();
  const scenarioId: TutorialScenarioId = body.scenarioId ?? "core_basics_v1";
  await closeActiveTutorialMatchesForUser(actor.userId, now);
  const initInput: StartMatchInput = {
    weekId: weekState.weekId,
    postId: weekState.postId,
    mode: "tutorial",
    tutorialScenarioId: scenarioId,
    playerA: {
      userId: actor.userId,
      username: actor.username,
      faction: body.faction ?? DEFAULT_FACTION,
    },
    playerB: {
      userId: "tutorial_opponent",
      username: "tutorial-opponent",
      faction: "market_makers",
      isBot: false,
    },
    seed: freshMatchSeed(`${weekState.weekId}:${actor.userId}:${scenarioId}:${now}`),
  };

  const match = setupTutorialMatch(createInitialMatch(initInput, now), scenarioId, now);
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
  const repaired = repairTutorialIfNeeded(next);
  if (repaired.repaired) {
    next = repaired.match;
  }
  next = runAiUntilHumanTurn(next);
  await finalizeIfFinished(storageRedis, wasFinished, next);
  await saveMatch(storageRedis, next);

  return ok(c, { match: next });
});

api.post("/tutorial/acknowledge", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const body = (await c.req.json()) as { matchId: string };
  const loaded = await loadMatch(body.matchId);
  if (!loaded.ok) {
    return fail(c, loaded.error, loaded.status);
  }
  const side = sideForUser(loaded.match, actor.userId);
  if (!side) {
    return fail(c, "You are not a player in this match.", 403);
  }

  let next = tickTimeouts(loaded.match);
  const result = acknowledgeTutorialStep(next, side);
  next = result.match;
  await saveMatch(storageRedis, next);

  return ok(c, {
    result: {
      ok: result.ok,
      error: result.error,
      match: next,
    } satisfies MatchActionResult,
  });
});

api.post("/tutorial/skip", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const body = (await c.req.json()) as { matchId: string };
  const loaded = await loadMatch(body.matchId);
  if (!loaded.ok) {
    return fail(c, loaded.error, loaded.status);
  }
  const side = sideForUser(loaded.match, actor.userId);
  if (!side) {
    return fail(c, "You are not a player in this match.", 403);
  }

  const result = skipTutorial(loaded.match, side);
  await saveMatch(storageRedis, result.match);

  return ok(c, {
    result: {
      ok: result.ok,
      error: result.error,
      match: result.match,
    } satisfies MatchActionResult,
  });
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
  if (next.mode === "tutorial") {
    return ok(c, {
      result: {
        ok: false,
        error: "Tutorial uses scripted flow and does not include mulligan.",
        match: next,
      } satisfies MatchActionResult,
    });
  }
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
  const tutorialValidation = validateTutorialAction(next, side, "play", body.action);
  if (!tutorialValidation.ok) {
    return ok(c, {
      result: {
        ok: false,
        error: tutorialValidation.error,
        match: next,
      } satisfies MatchActionResult,
    });
  }
  const result = playCard(next, body.action);
  if (result.ok) {
    advanceTutorialAfterAction(result.match, "play");
  }
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
  const tutorialValidation = validateTutorialAction(next, side, "attack", body.action);
  if (!tutorialValidation.ok) {
    return ok(c, {
      result: {
        ok: false,
        error: tutorialValidation.error,
        match: next,
      } satisfies MatchActionResult,
    });
  }
  const result = attack(next, body.action);
  if (result.ok) {
    advanceTutorialAfterAction(result.match, "attack");
  }
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

api.post("/match/reposition-judge", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const body = (await c.req.json()) as {
    matchId: string;
    action: {
      side: PlayerSide;
      unitId: string;
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
  if (next.mode === "tutorial") {
    return ok(c, {
      result: {
        ok: false,
        error: "Tutorial step does not use Judge reposition action.",
        match: next,
      } satisfies MatchActionResult,
    });
  }
  const result = repositionJudgeSpecialist(next, body.action);
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
  const tutorialValidation = validateTutorialAction(next, side, "end-turn", body.action);
  if (!tutorialValidation.ok) {
    return ok(c, {
      result: {
        ok: false,
        error: tutorialValidation.error,
        match: next,
      } satisfies MatchActionResult,
    });
  }
  const result = endTurn(next, body.action.side);
  if (result.ok) {
    let progressed = result.match;
    if (progressed.mode === "tutorial" && progressed.status === "active" && progressed.activeSide === "B") {
      const autoPass = endTurn(progressed, "B");
      if (autoPass.ok) {
        progressed = autoPass.match;
      }
    }
    advanceTutorialAfterAction(progressed, "end-turn");
    next = progressed;
  }
  next = runAiUntilHumanTurn(next);

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
  if (next.mode === "tutorial") {
    return ok(c, {
      result: {
        ok: false,
        error: "Tutorial step does not use Naked Short repayment.",
        match: next,
      } satisfies MatchActionResult,
    });
  }
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





