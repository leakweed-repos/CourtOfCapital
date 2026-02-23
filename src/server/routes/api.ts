import { Hono, type Context } from "hono";
import { context, reddit, redis } from "@devvit/web/server";
import {
  type LobbyMatchSummary,
  normalizeUsername,
  nowTs,
  opponentOf,
  PVP_LOBBY_RESPONSE_TIMEOUT_MS,
  type PvpLobbyState,
  type PvpLobbySummary,
  stableHash,
  type TutorialScenarioId,
  uniqueId,
  type InviteState,
  type MatchActionResult,
  type MatchState,
  type FactionId,
  type StartMatchInput,
} from "../../shared/game";
import { DEFAULT_FACTION } from "../game/models";
import { createInitialMatch, endTurn, playCard, applyMulligan, attack, repositionJudgeSpecialist, repayNakedShort, sideForUser, tickTimeoutsWithMeta } from "../game/engine";
import { runAiUntilHumanTurn } from "../game/ai";
import {
  acknowledgeTutorialStep,
  advanceTutorialAfterAction,
  repairTutorialIfNeeded,
  setupTutorialMatch,
  skipTutorial,
  validateTutorialAction,
} from "../game/tutorial";
import { setupCleanupSandboxMatch } from "../game/sandbox";
import {
  createRedisLike,
  getCurrentWeekId,
  getInvite,
  getLeaderboardTop,
  getMatch,
  getPvpLobby,
  indexPvpLobbyForUser,
  indexMatchForUser,
  isLockBusyError,
  listUnlockedFactionsForUser,
  listUserPvpLobbyIds,
  listPendingInvites,
  listUserMatchIds,
  unlockFactionForUser,
  savePvpLobby,
  saveInvite,
  saveMatch,
  deletePvpLobby,
  updateInvite,
  withLock,
  type RedisLike,
} from "../game/storage";
import { guardInviteCreate, markInviteCreateCooldown } from "../core/invite-policy";
import { getArchivedWeekReadOnlyError } from "../core/match-week";
import { shouldPersistMatchState } from "../core/match-persist";
import { finalizeMatchResultOnce } from "../core/match-results";
import {
  parseAiStartBody,
  parseAttackBody,
  parseCleanupStartBody,
  parseEndTurnBody,
  parseInviteAcceptBody,
  parseInviteCreateBody,
  parseLobbyIdBody,
  parseMatchIdBody,
  parseMulliganBody,
  parsePlayBody,
  parsePvpLobbyStartBody,
  parseRepositionJudgeBody,
  parseRepayNakedShortBody,
  parseTutorialStartBody,
  type ParseResult,
} from "./api-body";
import { resolveWeeklyPost, validateWeekOpen } from "../core/post";

interface ErrorResponse {
  ok: false;
  error: string;
}

const storageRedis = createRedisLike(redis);

type ApiStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500;

function fail(c: Context, error: string, status: number = 400) {
  return c.json<ErrorResponse>({ ok: false, error }, status as ApiStatus);
}

function freshMatchSeed(base: string): number {
  return stableHash(`${base}:${nowTs()}:${Math.random().toString(36).slice(2)}`);
}

function ok<T>(c: Context, data: T) {
  return c.json({ ok: true as const, data });
}

async function readJsonValidated<T>(
  c: Context,
  parser: (raw: unknown) => ParseResult<T>,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, response: fail(c, "Invalid JSON body.", 400) };
  }
  const parsed = parser(raw);
  if (!parsed.ok) {
    return { ok: false, response: fail(c, parsed.error, 400) };
  }
  return { ok: true, value: parsed.value };
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
    playerAFaction: match.players.A.faction,
    playerBUserId: match.players.B.userId,
    playerBUsername: match.players.B.username,
    playerBIsBot: match.players.B.isBot,
    playerBFaction: match.players.B.faction,
    tutorialScenarioId: match.tutorial?.scenarioId,
  };
}

function toPvpLobbySummary(lobby: PvpLobbyState, actor: { userId: string; username: string }): PvpLobbySummary {
  const isInviter = lobby.inviterUserId === actor.userId;
  const isTarget = lobby.targetUserId === actor.userId || (!lobby.targetUserId && lobby.targetUsername === actor.username);
  const selfReady = isInviter ? lobby.inviterReady : isTarget ? lobby.targetReady : false;
  const readyCountRaw = Number(lobby.inviterReady) + Number(lobby.targetReady);
  const readyCount = (readyCountRaw > 2 ? 2 : readyCountRaw) as 0 | 1 | 2;
  const targetJoined = Boolean(lobby.targetUserId);
  const canStart = targetJoined && !lobby.matchId && lobby.status !== "cancelled";
  return {
    lobbyId: lobby.id,
    inviteId: lobby.inviteId,
    status: lobby.status,
    inviterUsername: lobby.inviterUsername,
    targetUsername: lobby.targetUsername,
    inviterFaction: lobby.inviterFaction,
    targetFaction: lobby.targetFaction,
    targetJoined,
    readyCount,
    isInviter,
    selfReady,
    canStart,
    matchId: lobby.matchId,
    updatedAt: lobby.updatedAt,
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

async function resolvePostForLobby(redisLike: RedisLike) {
  return resolveWeeklyPost({
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
  if (match.mode === "tutorial" || match.mode === "sandbox") {
    return;
  }
  await finalizeMatchResultOnce(redisLike, match);
}

function matchLockName(matchId: string): string {
  return `match:${matchId}`;
}

function pvpLobbyLockName(lobbyId: string): string {
  return `pvp-lobby:${lobbyId}`;
}

const MATCH_LOCK_OPTIONS = {
  ttlSeconds: 20,
  waitMs: 5_000,
  retryMs: 25,
} as const;

const PVP_LOBBY_LOCK_OPTIONS = {
  ttlSeconds: 20,
  waitMs: 5_000,
  retryMs: 25,
} as const;

async function withMatchLock<T>(matchId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(storageRedis, matchLockName(matchId), MATCH_LOCK_OPTIONS, fn);
}

async function withPvpLobbyLock<T>(lobbyId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(storageRedis, pvpLobbyLockName(lobbyId), PVP_LOBBY_LOCK_OPTIONS, fn);
}

function failLockBusy(c: Context, error: unknown) {
  if (!isLockBusyError(error)) {
    return null;
  }
  return fail(c, "Request conflict: state is being updated. Please retry.", 409);
}

async function ensureMatchWeekWritable(redisLike: RedisLike, match: MatchState): Promise<null | string> {
  return getArchivedWeekReadOnlyError(redisLike, match);
}

async function saveMatchIfChanged(
  redisLike: RedisLike,
  match: MatchState,
  previousUpdatedAt: number,
  options?: { force?: boolean },
): Promise<boolean> {
  const changed = shouldPersistMatchState(previousUpdatedAt, match, options);
  if (changed) {
    await saveMatch(redisLike, match);
  }
  return changed;
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

async function closeActiveSandboxMatchesForUser(userId: string, now: number): Promise<void> {
  const userMatchIds = await listUserMatchIds(storageRedis, userId);
  for (const matchId of userMatchIds) {
    const one = await getMatch(storageRedis, matchId);
    if (!one || one.mode !== "sandbox" || one.status === "finished") {
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
    one.log.push({
      at: now,
      turn: one.turn,
      text: "Sandbox closed: a newer cleanup run was started.",
    });
    await saveMatch(storageRedis, one);
  }
}

async function notifyInvite(invite: InviteState): Promise<void> {
  const subject = "Court of Capital invite";
  const text = `You have a Court of Capital invite from u/${invite.inviterUsername} for this week's Court. Open the weekly post and tap Accept to join the match.`;
  try {
    await reddit.sendPrivateMessageAsSubreddit({
      fromSubredditName: context.subredditName,
      to: invite.targetUsername,
      subject,
      text,
    });
  } catch (error) {
    try {
      await reddit.sendPrivateMessage({
        to: invite.targetUsername,
        subject,
        text,
      });
    } catch (fallbackError) {
      console.error("Invite private-message notification failed:", fallbackError);
    }
  }
}

function isAwaitingLobbyTarget(lobby: PvpLobbyState): boolean {
  return !lobby.targetUserId && !lobby.matchId && lobby.status !== "cancelled";
}

async function expireLobbyIfTimedOutUnlocked(lobby: PvpLobbyState, now: number): Promise<boolean> {
  if (!isAwaitingLobbyTarget(lobby)) {
    return false;
  }
  if (now - lobby.createdAt < PVP_LOBBY_RESPONSE_TIMEOUT_MS) {
    return false;
  }

  const invite = await getInvite(storageRedis, lobby.inviteId);
  if (invite && invite.status === "pending") {
    invite.status = "expired";
    await updateInvite(storageRedis, invite);
  }
  await deletePvpLobby(storageRedis, lobby);
  return true;
}

async function expireLobbyIfTimedOut(
  lobby: PvpLobbyState,
  now: number,
  options?: { alreadyLocked?: boolean },
): Promise<boolean> {
  if (options?.alreadyLocked) {
    return expireLobbyIfTimedOutUnlocked(lobby, now);
  }
  try {
    return await withPvpLobbyLock(lobby.id, async () => {
      const fresh = await getPvpLobby(storageRedis, lobby.id);
      if (!fresh) {
        return true;
      }
      return expireLobbyIfTimedOutUnlocked(fresh, now);
    });
  } catch (error) {
    if (isLockBusyError(error)) {
      return false;
    }
    throw error;
  }
}

export const api = new Hono();

api.post("/lobby", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const weekState = await resolvePostForLobby(storageRedis);
  if (!weekState.ok) {
    return fail(c, weekState.error, weekState.status);
  }

  const pendingInvites = await listPendingInvites(storageRedis, actor.username);
  const userMatchIds = await listUserMatchIds(storageRedis, actor.userId);
  const userPvpLobbyIds = await listUserPvpLobbyIds(storageRedis, actor.userId);
  const unlockedFactions = await listUnlockedFactionsForUser(storageRedis, actor.userId);
  const activeWeekId = (await getCurrentWeekId(storageRedis)) ?? weekState.weekId;
  const now = nowTs();

  const quickPlayMatchSummaries: LobbyMatchSummary[] = [];
  const pvpMatchSummaries: LobbyMatchSummary[] = [];
  const tutorialMatchSummaries: LobbyMatchSummary[] = [];
  const pvpLobbies: PvpLobbySummary[] = [];
  const invites: InviteState[] = [];
  const inferredUnlocked = new Set<FactionId>();

  for (const invite of pendingInvites) {
    if (!invite.lobbyId) {
      invites.push(invite);
      continue;
    }
    const lobby = await getPvpLobby(storageRedis, invite.lobbyId);
    if (!lobby) {
      invite.status = "expired";
      await updateInvite(storageRedis, invite);
      continue;
    }
    const expired = await expireLobbyIfTimedOut(lobby, now);
    if (!expired) {
      invites.push(invite);
    }
  }

  for (const matchId of userMatchIds) {
    const raw = await getMatch(storageRedis, matchId);
    if (!raw) {
      continue;
    }

    let one = raw;
    if (one.players.A.userId === actor.userId) {
      inferredUnlocked.add(one.players.A.faction);
    }
    if (one.players.B.userId === actor.userId) {
      inferredUnlocked.add(one.players.B.faction);
    }
    if (one.mode === "tutorial") {
      const repaired = repairTutorialIfNeeded(one);
      if (repaired.repaired) {
        one = repaired.match;
        await saveMatch(storageRedis, one);
      }
    }

    if (one.status !== "finished") {
      if (one.weekId !== activeWeekId) {
        continue;
      }
      const summary = toLobbyMatchSummary(one);
      if (one.mode === "pvp") {
        pvpMatchSummaries.push(summary);
      } else if (one.mode === "tutorial" || one.mode === "sandbox") {
        tutorialMatchSummaries.push(summary);
      } else {
        quickPlayMatchSummaries.push(summary);
      }
    }
  }

  quickPlayMatchSummaries.sort((a, b) => b.updatedAt - a.updatedAt);
  pvpMatchSummaries.sort((a, b) => b.updatedAt - a.updatedAt);
  tutorialMatchSummaries.sort((a, b) => b.updatedAt - a.updatedAt);

  for (const lobbyId of userPvpLobbyIds) {
    const lobby = await getPvpLobby(storageRedis, lobbyId);
    if (!lobby) {
      continue;
    }
    const expired = await expireLobbyIfTimedOut(lobby, now);
    if (expired) {
      continue;
    }
    if (lobby.status === "cancelled") {
      continue;
    }
    if (lobby.weekId !== weekState.weekId || lobby.postId !== weekState.postId) {
      continue;
    }
    if (lobby.matchId) {
      continue;
    }
    pvpLobbies.push(toPvpLobbySummary(lobby, actor));
  }
  pvpLobbies.sort((a, b) => b.updatedAt - a.updatedAt);

  const [leaderboardPvp, leaderboardL1, leaderboardL2, leaderboardL3] = await Promise.all([
    getLeaderboardTop(storageRedis, weekState.weekId, 10, "pvp"),
    getLeaderboardTop(storageRedis, weekState.weekId, 10, "pve_l1"),
    getLeaderboardTop(storageRedis, weekState.weekId, 10, "pve_l2"),
    getLeaderboardTop(storageRedis, weekState.weekId, 10, "pve_l3"),
  ]);

  for (const faction of inferredUnlocked) {
    if (!unlockedFactions.includes(faction)) {
      unlockedFactions.push(faction);
      await unlockFactionForUser(storageRedis, actor.userId, faction);
    }
  }

  return ok(c, {
    snapshot: {
      weekId: weekState.weekId,
      postId: weekState.postId,
      isActiveWeek: weekState.isActiveWeek,
      unlockedFactions: unlockedFactions.length > 0 ? unlockedFactions : ["retail_mob"],
      pendingInvites: invites,
      pvpLobbies,
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

  const parsedBody = await readJsonValidated(c, parseAiStartBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;

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
  await unlockFactionForUser(storageRedis, actor.userId, match.players.A.faction);

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

  const parsedBody = await readJsonValidated(c, parseTutorialStartBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;
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
  await unlockFactionForUser(storageRedis, actor.userId, match.players.A.faction);

  return ok(c, {
    result: {
      ok: true,
      match,
    } satisfies MatchActionResult,
  });
});

api.post("/tutorial/cleanup/start", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const weekState = await ensureActivePost(storageRedis);
  if (!weekState.ok) {
    return fail(c, weekState.error, weekState.status);
  }

  const parsedBody = await readJsonValidated(c, parseCleanupStartBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;
  const now = nowTs();
  await closeActiveSandboxMatchesForUser(actor.userId, now);

  const initInput: StartMatchInput = {
    weekId: weekState.weekId,
    postId: weekState.postId,
    mode: "sandbox",
    playerA: {
      userId: actor.userId,
      username: actor.username,
      faction: body.faction ?? DEFAULT_FACTION,
    },
    playerB: {
      userId: "wozny",
      username: "wozny",
      faction: "market_makers",
      isBot: true,
    },
    seed: freshMatchSeed(`${weekState.weekId}:${actor.userId}:sandbox:${now}`),
  };

  const match = setupCleanupSandboxMatch(createInitialMatch(initInput, now), now);
  await saveMatch(storageRedis, match);
  await indexMatchForUser(storageRedis, actor.userId, match.id);
  await unlockFactionForUser(storageRedis, actor.userId, match.players.A.faction);

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

  const parsedBody = await readJsonValidated(c, parseInviteCreateBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;
  const targetUsername = normalizeUsername(body.targetUsername);
  if (!targetUsername) {
    return fail(c, "Target username is required.");
  }
  if (targetUsername === actor.username) {
    return fail(c, "You cannot invite yourself.");
  }

  const inviteCreateLock = `invite-create:${actor.userId}`;
  try {
    return await withLock(storageRedis, inviteCreateLock, { ttlSeconds: 10, waitMs: 5_000, retryMs: 25 }, async () => {
      const now = nowTs();
      const guard = await guardInviteCreate(storageRedis, {
        inviterUserId: actor.userId,
        targetUsername,
        weekId: weekState.weekId,
        postId: weekState.postId,
        now,
      });
      if (!guard.ok) {
        if (guard.kind === "duplicate") {
          return fail(c, "Invite already pending", 409);
        }
        if (guard.kind === "cooldown") {
          const secondsLeft = Math.max(1, Math.ceil((guard.cooldownUntil - now) / 1000));
          return fail(c, `Invite cooldown active (${secondsLeft}s remaining)`, 429);
        }
        return fail(c, "Invite rate limit exceeded", 429);
      }

      const lobbyId = uniqueId("pvp_lobby", stableHash(`${actor.userId}:${targetUsername}:${now}`), 1);
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
        lobbyId,
      };

      const lobby: PvpLobbyState = {
        id: lobbyId,
        inviteId: invite.id,
        weekId: weekState.weekId,
        postId: weekState.postId,
        inviterUserId: actor.userId,
        inviterUsername: actor.username,
        inviterFaction: body.faction ?? DEFAULT_FACTION,
        targetUsername,
        inviterReady: false,
        targetReady: false,
        status: "waiting",
        createdAt: now,
        updatedAt: now,
      };

      await saveInvite(storageRedis, invite);
      await savePvpLobby(storageRedis, lobby);
      await indexPvpLobbyForUser(storageRedis, actor.userId, lobby.id);
      await markInviteCreateCooldown(storageRedis, actor.userId, now);
      await notifyInvite(invite);

      return ok(c, { invite, lobby });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to create invite.", 500);
  }
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

  const parsedBody = await readJsonValidated(c, parseInviteAcceptBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;
  const invite = await getInvite(storageRedis, body.inviteId);
  if (!invite) {
    return fail(c, "Invite not found.", 404);
  }
  if (invite.status !== "pending" && invite.status !== "accepted") {
    return fail(c, "Invite is not active.");
  }

  if (invite.targetUsername !== actor.username) {
    return fail(c, "Invite does not belong to this user.", 403);
  }

  if (invite.weekId !== weekState.weekId || invite.postId !== weekState.postId) {
    return fail(c, "Invite belongs to an archived week/post.", 409);
  }

  if (!invite.lobbyId) {
    return fail(c, "Invite has no lobby metadata.", 409);
  }
  try {
    return await withPvpLobbyLock(invite.lobbyId, async () => {
      const latestInvite = await getInvite(storageRedis, body.inviteId);
      if (!latestInvite) {
        return fail(c, "Invite not found.", 404);
      }
      if (latestInvite.status !== "pending" && latestInvite.status !== "accepted") {
        return fail(c, "Invite is not active.");
      }
      if (latestInvite.targetUsername !== actor.username) {
        return fail(c, "Invite does not belong to this user.", 403);
      }
      if (latestInvite.weekId !== weekState.weekId || latestInvite.postId !== weekState.postId) {
        return fail(c, "Invite belongs to an archived week/post.", 409);
      }
      if (!latestInvite.lobbyId) {
        return fail(c, "Invite has no lobby metadata.", 409);
      }

      const lobby = await getPvpLobby(storageRedis, latestInvite.lobbyId);
      if (!lobby) {
        return fail(c, "Lobby not found.", 404);
      }
      if (await expireLobbyIfTimedOut(lobby, nowTs(), { alreadyLocked: true })) {
        return fail(c, "Lobby expired after 15 minutes without opponent response.", 409);
      }
      if (lobby.status === "cancelled") {
        return fail(c, "Lobby has been dismantled.", 409);
      }
      if (lobby.matchId) {
        return fail(c, "Lobby already started.", 409);
      }
      if (lobby.targetUsername !== actor.username) {
        return fail(c, "Lobby target mismatch.", 403);
      }
      if (lobby.targetUserId && lobby.targetUserId !== actor.userId) {
        return fail(c, "Lobby already joined by another user.", 409);
      }

      const now = nowTs();
      lobby.targetUserId = actor.userId;
      lobby.targetFaction = body.faction ?? lobby.targetFaction ?? DEFAULT_FACTION;
      lobby.status = "waiting";
      lobby.updatedAt = now;

      latestInvite.status = "accepted";
      latestInvite.acceptedAt = latestInvite.acceptedAt ?? now;

      await updateInvite(storageRedis, latestInvite);
      await savePvpLobby(storageRedis, lobby);
      await indexPvpLobbyForUser(storageRedis, actor.userId, lobby.id);

      return ok(c, {
        invite: latestInvite,
        lobby,
      });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to accept invite.", 500);
  }
});

api.post("/pvp/lobby/get", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const parsedBody = await readJsonValidated(c, parseLobbyIdBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;

  const lobby = await getPvpLobby(storageRedis, body.lobbyId);
  if (!lobby) {
    return fail(c, "Lobby not found.", 404);
  }
  if (await expireLobbyIfTimedOut(lobby, nowTs())) {
    return fail(c, "Lobby expired after 15 minutes without opponent response.", 409);
  }

  const allowed =
    lobby.inviterUserId === actor.userId ||
    lobby.targetUserId === actor.userId ||
    (!lobby.targetUserId && lobby.targetUsername === actor.username);
  if (!allowed) {
    return fail(c, "You are not a member of this lobby.", 403);
  }

  return ok(c, { lobby });
});

api.post("/pvp/lobby/start", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const weekState = await ensureActivePost(storageRedis);
  if (!weekState.ok) {
    return fail(c, weekState.error, weekState.status);
  }

  const parsedBody = await readJsonValidated(c, parsePvpLobbyStartBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;
  const lobbyId = body.lobbyId;

  try {
    return await withPvpLobbyLock(lobbyId, async () => {
      const lobby = await getPvpLobby(storageRedis, lobbyId);
      if (!lobby) {
        return fail(c, "Lobby not found.", 404);
      }
      if (await expireLobbyIfTimedOut(lobby, nowTs(), { alreadyLocked: true })) {
        return fail(c, "Lobby expired after 15 minutes without opponent response.", 409);
      }
      if (lobby.status === "cancelled") {
        return fail(c, "Lobby has been dismantled.", 409);
      }
      if (lobby.weekId !== weekState.weekId || lobby.postId !== weekState.postId) {
        return fail(c, "Lobby belongs to an archived week/post.", 409);
      }

      const isInviter = lobby.inviterUserId === actor.userId;
      const isTarget = lobby.targetUserId === actor.userId;
      if (!isInviter && !isTarget) {
        return fail(c, "You are not a member of this lobby.", 403);
      }

      if (!lobby.targetUserId) {
        return fail(c, "Opponent has not joined this lobby yet.", 409);
      }

      const now = nowTs();
      if (isInviter) {
        lobby.inviterFaction = body.faction ?? lobby.inviterFaction;
        lobby.inviterReady = true;
      } else {
        lobby.targetFaction = body.faction ?? lobby.targetFaction ?? DEFAULT_FACTION;
        lobby.targetReady = true;
      }

      if (!lobby.matchId && lobby.inviterReady && lobby.targetReady) {
        const match = createInitialMatch(
          {
            weekId: lobby.weekId,
            postId: lobby.postId,
            mode: "pvp",
            playerA: {
              userId: lobby.inviterUserId,
              username: lobby.inviterUsername,
              faction: lobby.inviterFaction,
            },
            playerB: {
              userId: lobby.targetUserId,
              username: lobby.targetUsername,
              faction: lobby.targetFaction ?? DEFAULT_FACTION,
              isBot: false,
            },
            seed: freshMatchSeed(`${lobby.id}:${lobby.targetUserId}:${now}`),
          },
          now,
        );
        lobby.matchId = match.id;
        lobby.status = "started";
        lobby.updatedAt = now;

        await saveMatch(storageRedis, match);
        await indexMatchForUser(storageRedis, lobby.inviterUserId, match.id);
        await indexMatchForUser(storageRedis, lobby.targetUserId, match.id);
        await unlockFactionForUser(storageRedis, lobby.inviterUserId, match.players.A.faction);
        await unlockFactionForUser(storageRedis, lobby.targetUserId, match.players.B.faction);

        const invite = await getInvite(storageRedis, lobby.inviteId);
        if (invite) {
          invite.status = "accepted";
          invite.acceptedAt = invite.acceptedAt ?? now;
          invite.matchId = match.id;
          await updateInvite(storageRedis, invite);
        }

        await savePvpLobby(storageRedis, lobby);

        return ok(c, {
          lobby,
          result: {
            ok: true,
            match,
          } satisfies MatchActionResult,
        });
      }

      lobby.status = "ready";
      lobby.updatedAt = now;
      await savePvpLobby(storageRedis, lobby);
      return ok(c, { lobby });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to update PvP lobby.", 500);
  }
});

api.post("/pvp/lobby/dismantle", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const parsedBody = await readJsonValidated(c, parseLobbyIdBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;
  const lobbyId = body.lobbyId;

  try {
    return await withPvpLobbyLock(lobbyId, async () => {
      const lobby = await getPvpLobby(storageRedis, lobbyId);
      if (!lobby) {
        return fail(c, "Lobby not found.", 404);
      }
      if (await expireLobbyIfTimedOut(lobby, nowTs(), { alreadyLocked: true })) {
        return fail(c, "Lobby expired after 15 minutes without opponent response.", 409);
      }
      if (lobby.inviterUserId !== actor.userId) {
        return fail(c, "Only inviter can dismantle this battle.", 403);
      }
      if (lobby.matchId) {
        return fail(c, "Lobby already started, dismantle is no longer available.", 409);
      }

      lobby.status = "cancelled";
      lobby.updatedAt = nowTs();
      const invite = await getInvite(storageRedis, lobby.inviteId);
      if (invite) {
        invite.status = "cancelled";
        await updateInvite(storageRedis, invite);
      }
      await deletePvpLobby(storageRedis, lobby);

      return ok(c, { success: true });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to dismantle PvP lobby.", 500);
  }
});

api.post("/match/get", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const parsedBody = await readJsonValidated(c, parseMatchIdBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;
  try {
    return await withMatchLock(body.matchId, async () => {
      const loaded = await loadMatch(body.matchId);
      if (!loaded.ok) {
        return fail(c, loaded.error, loaded.status);
      }

      if (!sideForUser(loaded.match, actor.userId)) {
        return fail(c, "You are not a player in this match.", 403);
      }
      const archivedError = await ensureMatchWeekWritable(storageRedis, loaded.match);
      if (archivedError) {
        return fail(c, archivedError, 409);
      }

      const wasFinished = loaded.match.status === "finished";
      const loadedUpdatedAt = loaded.match.updatedAt;
      const ticked = tickTimeoutsWithMeta(loaded.match);
      let next = ticked.match;
      const repaired = repairTutorialIfNeeded(next);
      if (repaired.repaired) {
        next = repaired.match;
      }
      next = runAiUntilHumanTurn(next);
      await finalizeIfFinished(storageRedis, wasFinished, next);
      await saveMatchIfChanged(storageRedis, next, loadedUpdatedAt, { force: repaired.repaired });

      return ok(c, { match: next });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to load match state.", 500);
  }
});

api.post("/tutorial/acknowledge", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const parsedBody = await readJsonValidated(c, parseMatchIdBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;
  try {
    return await withMatchLock(body.matchId, async () => {
      const loaded = await loadMatch(body.matchId);
      if (!loaded.ok) {
        return fail(c, loaded.error, loaded.status);
      }
      const side = sideForUser(loaded.match, actor.userId);
      if (!side) {
        return fail(c, "You are not a player in this match.", 403);
      }
      const archivedError = await ensureMatchWeekWritable(storageRedis, loaded.match);
      if (archivedError) {
        return fail(c, archivedError, 409);
      }

      const loadedUpdatedAt = loaded.match.updatedAt;
      const ticked = tickTimeoutsWithMeta(loaded.match);
      let next = ticked.match;
      const result = acknowledgeTutorialStep(next, side);
      next = result.match;
      await saveMatchIfChanged(storageRedis, next, loadedUpdatedAt);

      return ok(c, {
        result: {
          ok: result.ok,
          error: result.error,
          match: next,
        } satisfies MatchActionResult,
      });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to update tutorial state.", 500);
  }
});

api.post("/tutorial/skip", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const parsedBody = await readJsonValidated(c, parseMatchIdBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;
  try {
    return await withMatchLock(body.matchId, async () => {
      const loaded = await loadMatch(body.matchId);
      if (!loaded.ok) {
        return fail(c, loaded.error, loaded.status);
      }
      const side = sideForUser(loaded.match, actor.userId);
      if (!side) {
        return fail(c, "You are not a player in this match.", 403);
      }
      const archivedError = await ensureMatchWeekWritable(storageRedis, loaded.match);
      if (archivedError) {
        return fail(c, archivedError, 409);
      }

      const loadedUpdatedAt = loaded.match.updatedAt;
      const result = skipTutorial(loaded.match, side);
      await saveMatchIfChanged(storageRedis, result.match, loadedUpdatedAt);

      return ok(c, {
        result: {
          ok: result.ok,
          error: result.error,
          match: result.match,
        } satisfies MatchActionResult,
      });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to skip tutorial.", 500);
  }
});

api.post("/match/mulligan", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const parsedBody = await readJsonValidated(c, parseMulliganBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;

  try {
    return await withMatchLock(body.matchId, async () => {
      const loaded = await loadMatch(body.matchId);
      if (!loaded.ok) {
        return fail(c, loaded.error, loaded.status);
      }

      const archivedError = await ensureMatchWeekWritable(storageRedis, loaded.match);
      if (archivedError) {
        return fail(c, archivedError, 409);
      }

      const wasFinished = loaded.match.status === "finished";
      const side = sideForUser(loaded.match, actor.userId);
      if (!side) {
        return fail(c, "You are not a player in this match.", 403);
      }
      if (side !== body.action.side) {
        return fail(c, "Action side mismatch.", 403);
      }

      const loadedUpdatedAt = loaded.match.updatedAt;
      const ticked = tickTimeoutsWithMeta(loaded.match);
      let next = ticked.match;
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
      await saveMatchIfChanged(storageRedis, next, loadedUpdatedAt);

      return ok(c, {
        result: {
          ok: result.ok,
          error: result.error,
          match: next,
        } satisfies MatchActionResult,
      });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to apply mulligan.", 500);
  }
});

api.post("/match/play", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const parsedBody = await readJsonValidated(c, parsePlayBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;

  try {
    return await withMatchLock(body.matchId, async () => {
      const loaded = await loadMatch(body.matchId);
      if (!loaded.ok) {
        return fail(c, loaded.error, loaded.status);
      }

      const archivedError = await ensureMatchWeekWritable(storageRedis, loaded.match);
      if (archivedError) {
        return fail(c, archivedError, 409);
      }

      const wasFinished = loaded.match.status === "finished";
      const side = sideForUser(loaded.match, actor.userId);
      if (!side) {
        return fail(c, "You are not a player in this match.", 403);
      }
      if (side !== body.action.side) {
        return fail(c, "Action side mismatch.", 403);
      }

      const loadedUpdatedAt = loaded.match.updatedAt;
      const ticked = tickTimeoutsWithMeta(loaded.match);
      let next = ticked.match;
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
      await saveMatchIfChanged(storageRedis, next, loadedUpdatedAt);

      return ok(c, {
        result: {
          ok: result.ok,
          error: result.error,
          match: next,
        } satisfies MatchActionResult,
      });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to play card.", 500);
  }
});

api.post("/match/attack", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const parsedBody = await readJsonValidated(c, parseAttackBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;

  try {
    return await withMatchLock(body.matchId, async () => {
      const loaded = await loadMatch(body.matchId);
      if (!loaded.ok) {
        return fail(c, loaded.error, loaded.status);
      }

      const archivedError = await ensureMatchWeekWritable(storageRedis, loaded.match);
      if (archivedError) {
        return fail(c, archivedError, 409);
      }

      const wasFinished = loaded.match.status === "finished";
      const side = sideForUser(loaded.match, actor.userId);
      if (!side) {
        return fail(c, "You are not a player in this match.", 403);
      }
      if (side !== body.action.side) {
        return fail(c, "Action side mismatch.", 403);
      }

      const loadedUpdatedAt = loaded.match.updatedAt;
      const ticked = tickTimeoutsWithMeta(loaded.match);
      let next = ticked.match;
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
      await saveMatchIfChanged(storageRedis, next, loadedUpdatedAt);

      return ok(c, {
        result: {
          ok: result.ok,
          error: result.error,
          match: next,
        } satisfies MatchActionResult,
      });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to resolve attack.", 500);
  }
});

api.post("/match/reposition-judge", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const parsedBody = await readJsonValidated(c, parseRepositionJudgeBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;

  try {
    return await withMatchLock(body.matchId, async () => {
      const loaded = await loadMatch(body.matchId);
      if (!loaded.ok) {
        return fail(c, loaded.error, loaded.status);
      }

      const archivedError = await ensureMatchWeekWritable(storageRedis, loaded.match);
      if (archivedError) {
        return fail(c, archivedError, 409);
      }

      const wasFinished = loaded.match.status === "finished";
      const side = sideForUser(loaded.match, actor.userId);
      if (!side) {
        return fail(c, "You are not a player in this match.", 403);
      }
      if (side !== body.action.side) {
        return fail(c, "Action side mismatch.", 403);
      }

      const loadedUpdatedAt = loaded.match.updatedAt;
      const ticked = tickTimeoutsWithMeta(loaded.match);
      let next = ticked.match;
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
      await saveMatchIfChanged(storageRedis, next, loadedUpdatedAt);

      return ok(c, {
        result: {
          ok: result.ok,
          error: result.error,
          match: next,
        } satisfies MatchActionResult,
      });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to reposition Judge specialist.", 500);
  }
});

api.post("/match/end-turn", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const parsedBody = await readJsonValidated(c, parseEndTurnBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;

  try {
    return await withMatchLock(body.matchId, async () => {
      const loaded = await loadMatch(body.matchId);
      if (!loaded.ok) {
        return fail(c, loaded.error, loaded.status);
      }

      const archivedError = await ensureMatchWeekWritable(storageRedis, loaded.match);
      if (archivedError) {
        return fail(c, archivedError, 409);
      }

      const wasFinished = loaded.match.status === "finished";
      const side = sideForUser(loaded.match, actor.userId);
      if (!side) {
        return fail(c, "You are not a player in this match.", 403);
      }
      if (side !== body.action.side) {
        return fail(c, "Action side mismatch.", 403);
      }

      const loadedUpdatedAt = loaded.match.updatedAt;
      const ticked = tickTimeoutsWithMeta(loaded.match);
      let next = ticked.match;
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
      await saveMatchIfChanged(storageRedis, next, loadedUpdatedAt);

      return ok(c, {
        result: {
          ok: result.ok,
          error: result.error,
          match: next,
        } satisfies MatchActionResult,
      });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to end turn.", 500);
  }
});

api.post("/match/repay-naked-short", async (c) => {
  const actor = requireActor();
  if (!actor.ok) {
    return fail(c, actor.error, actor.status);
  }

  const parsedBody = await readJsonValidated(c, parseRepayNakedShortBody);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.value;

  try {
    return await withMatchLock(body.matchId, async () => {
      const loaded = await loadMatch(body.matchId);
      if (!loaded.ok) {
        return fail(c, loaded.error, loaded.status);
      }

      const archivedError = await ensureMatchWeekWritable(storageRedis, loaded.match);
      if (archivedError) {
        return fail(c, archivedError, 409);
      }

      const wasFinished = loaded.match.status === "finished";
      const side = sideForUser(loaded.match, actor.userId);
      if (!side) {
        return fail(c, "You are not a player in this match.", 403);
      }
      if (side !== body.action.side) {
        return fail(c, "Action side mismatch.", 403);
      }

      const loadedUpdatedAt = loaded.match.updatedAt;
      const ticked = tickTimeoutsWithMeta(loaded.match);
      let next = ticked.match;
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
      await saveMatchIfChanged(storageRedis, next, loadedUpdatedAt);

      return ok(c, {
        result: {
          ok: result.ok,
          error: result.error,
          match: next,
        } satisfies MatchActionResult,
      });
    });
  } catch (error) {
    return failLockBusy(c, error) ?? fail(c, "Failed to repay Naked Short debt.", 500);
  }
});

api.get("/health", async (c) => {
  const weekId = await getCurrentWeekId(storageRedis);
  return ok(c, {
    status: "ok",
    weekId,
  });
});





