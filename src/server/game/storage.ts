import type { RedisClient } from "@devvit/web/server";
import { PREFIX, calcRatio, leaderboardScore } from "../../shared/game";
import type { FactionId, InviteState, MatchState, PvpLobbyState, WeeklyUserStats } from "../../shared/game";

export type LeaderboardBucket = "all" | "pvp" | "pve_l1" | "pve_l2" | "pve_l3";

type RuntimeRedis = Pick<
  RedisClient,
  "get" | "set" | "del" | "incrBy" | "hSet" | "hKeys" | "hDel" | "zAdd" | "zRange"
>;

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  incrBy(key: string, amount: number): Promise<number>;
  sAdd(key: string, member: string): Promise<void>;
  sMembers(key: string): Promise<string[]>;
  sRem(key: string, member: string): Promise<void>;
  zAdd(key: string, score: number, member: string): Promise<void>;
  zRange(key: string, start: number, stop: number, options?: { rev?: boolean }): Promise<string[]>;
}

export function createRedisLike(runtimeRedis: RuntimeRedis): RedisLike {
  return {
    get: async (key) => (await runtimeRedis.get(key)) ?? null,
    set: async (key, value) => {
      await runtimeRedis.set(key, value);
    },
    del: async (key) => {
      await runtimeRedis.del(key);
    },
    incrBy: async (key, amount) => runtimeRedis.incrBy(key, amount),
    sAdd: async (key, member) => {
      await runtimeRedis.hSet(key, { [member]: "1" });
    },
    sMembers: async (key) => runtimeRedis.hKeys(key),
    sRem: async (key, member) => {
      await runtimeRedis.hDel(key, [member]);
    },
    zAdd: async (key, score, member) => {
      await runtimeRedis.zAdd(key, { member, score });
    },
    zRange: async (key, start, stop, options) => {
      const rows = await runtimeRedis.zRange(key, start, stop, {
        by: "rank",
        reverse: options?.rev ?? false,
      });
      return rows.map((row) => row.member);
    },
  };
}

function keyCurrentWeek(): string {
  return `${PREFIX}:week:CURRENT`;
}

function keyCurrentWeekNumber(): string {
  return `${PREFIX}:week:CURRENT:number`;
}

function keyWeekPost(weekId: string): string {
  return `${PREFIX}:week:${weekId}:post`;
}

function keyWeekNumber(weekId: string): string {
  return `${PREFIX}:week:${weekId}:number`;
}

function keyWeekLeaderboard(weekId: string, bucket: LeaderboardBucket = "all"): string {
  if (bucket === "all") {
    return `${PREFIX}:week:${weekId}:leaderboard`;
  }
  return `${PREFIX}:week:${weekId}:leaderboard:${bucket}`;
}

function keyWeekUserStats(weekId: string, userId: string, bucket: LeaderboardBucket = "all"): string {
  if (bucket === "all") {
    return `${PREFIX}:week:${weekId}:user:${userId}:stats`;
  }
  return `${PREFIX}:week:${weekId}:user:${userId}:stats:${bucket}`;
}

function keyWeekUserName(weekId: string, userId: string): string {
  return `${PREFIX}:week:${weekId}:user:${userId}:name`;
}

function keyWeekUserIndex(weekId: string, bucket: LeaderboardBucket = "all"): string {
  if (bucket === "all") {
    return `${PREFIX}:week:${weekId}:users`;
  }
  return `${PREFIX}:week:${weekId}:users:${bucket}`;
}

function keyWeekMatchCounter(weekId: string): string {
  return `${PREFIX}:week:${weekId}:matchCount`;
}

function keyMatch(matchId: string): string {
  return `${PREFIX}:match:${matchId}`;
}

function keyUserMatches(userId: string): string {
  return `${PREFIX}:user:${userId}:matches`;
}

function keyUserUnlockedFactions(userId: string): string {
  return `${PREFIX}:user:${userId}:factions:unlocked`;
}

function keyInvite(inviteId: string): string {
  return `${PREFIX}:invite:${inviteId}`;
}

function keyPendingInvitesForUsername(username: string): string {
  return `${PREFIX}:usern:${username}:invites:pending`;
}

function keyPvpLobby(lobbyId: string): string {
  return `${PREFIX}:pvp:lobby:${lobbyId}`;
}

function keyUserPvpLobbies(userId: string): string {
  return `${PREFIX}:user:${userId}:pvp:lobbies`;
}

export async function getCurrentWeekId(redis: RedisLike): Promise<string | null> {
  return redis.get(keyCurrentWeek());
}

export async function setCurrentWeekId(redis: RedisLike, weekId: string): Promise<void> {
  await redis.set(keyCurrentWeek(), weekId);
}

export async function getCurrentWeekNumber(redis: RedisLike): Promise<number | null> {
  const raw = await redis.get(keyCurrentWeekNumber());
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.floor(parsed);
}

export async function setCurrentWeekNumber(redis: RedisLike, weekNumber: number): Promise<void> {
  await redis.set(keyCurrentWeekNumber(), String(Math.max(0, Math.floor(weekNumber))));
}

export async function getWeekPostId(redis: RedisLike, weekId: string): Promise<string | null> {
  return redis.get(keyWeekPost(weekId));
}

export async function setWeekPostId(redis: RedisLike, weekId: string, postId: string): Promise<void> {
  await redis.set(keyWeekPost(weekId), postId);
}

export async function getWeekNumber(redis: RedisLike, weekId: string): Promise<number | null> {
  const raw = await redis.get(keyWeekNumber(weekId));
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.floor(parsed);
}

export async function setWeekNumber(redis: RedisLike, weekId: string, weekNumber: number): Promise<void> {
  await redis.set(keyWeekNumber(weekId), String(Math.max(0, Math.floor(weekNumber))));
}

export async function saveMatch(redis: RedisLike, match: MatchState): Promise<void> {
  await redis.set(keyMatch(match.id), JSON.stringify(match));
}

export async function getMatch(redis: RedisLike, matchId: string): Promise<MatchState | null> {
  const raw = await redis.get(keyMatch(matchId));
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as MatchState;
}

export async function indexMatchForUser(redis: RedisLike, userId: string, matchId: string): Promise<void> {
  await redis.sAdd(keyUserMatches(userId), matchId);
}

export async function listUserMatchIds(redis: RedisLike, userId: string): Promise<string[]> {
  return redis.sMembers(keyUserMatches(userId));
}

export async function unlockFactionForUser(redis: RedisLike, userId: string, faction: FactionId): Promise<void> {
  await redis.sAdd(keyUserUnlockedFactions(userId), faction);
}

export async function listUnlockedFactionsForUser(redis: RedisLike, userId: string): Promise<FactionId[]> {
  const all = await redis.sMembers(keyUserUnlockedFactions(userId));
  const out = all.filter(
    (one): one is FactionId =>
      one === "retail_mob" ||
      one === "sec" ||
      one === "market_makers" ||
      one === "wallstreet" ||
      one === "short_hedgefund",
  );
  return out;
}

export async function saveInvite(redis: RedisLike, invite: InviteState): Promise<void> {
  await redis.set(keyInvite(invite.id), JSON.stringify(invite));
  if (invite.status === "pending") {
    await redis.sAdd(keyPendingInvitesForUsername(invite.targetUsername), invite.id);
  }
}

export async function getInvite(redis: RedisLike, inviteId: string): Promise<InviteState | null> {
  const raw = await redis.get(keyInvite(inviteId));
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as InviteState;
}

export async function updateInvite(redis: RedisLike, invite: InviteState): Promise<void> {
  await redis.set(keyInvite(invite.id), JSON.stringify(invite));
  if (invite.status !== "pending") {
    await redis.sRem(keyPendingInvitesForUsername(invite.targetUsername), invite.id);
  }
}

export async function listPendingInvites(redis: RedisLike, targetUsername: string): Promise<InviteState[]> {
  const inviteIds = await redis.sMembers(keyPendingInvitesForUsername(targetUsername));
  const out: InviteState[] = [];
  for (const inviteId of inviteIds) {
    const invite = await getInvite(redis, inviteId);
    if (invite && invite.status === "pending") {
      out.push(invite);
    }
  }
  return out.sort((a, b) => a.createdAt - b.createdAt);
}

export async function savePvpLobby(redis: RedisLike, lobby: PvpLobbyState): Promise<void> {
  await redis.set(keyPvpLobby(lobby.id), JSON.stringify(lobby));
}

export async function getPvpLobby(redis: RedisLike, lobbyId: string): Promise<PvpLobbyState | null> {
  const raw = await redis.get(keyPvpLobby(lobbyId));
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as PvpLobbyState;
}

export async function indexPvpLobbyForUser(redis: RedisLike, userId: string, lobbyId: string): Promise<void> {
  await redis.sAdd(keyUserPvpLobbies(userId), lobbyId);
}

export async function unindexPvpLobbyForUser(redis: RedisLike, userId: string, lobbyId: string): Promise<void> {
  await redis.sRem(keyUserPvpLobbies(userId), lobbyId);
}

export async function listUserPvpLobbyIds(redis: RedisLike, userId: string): Promise<string[]> {
  return redis.sMembers(keyUserPvpLobbies(userId));
}

export async function deletePvpLobby(redis: RedisLike, lobby: PvpLobbyState): Promise<void> {
  await redis.del(keyPvpLobby(lobby.id));
  await unindexPvpLobbyForUser(redis, lobby.inviterUserId, lobby.id);
  if (lobby.targetUserId) {
    await unindexPvpLobbyForUser(redis, lobby.targetUserId, lobby.id);
  }
}

export async function incrementWeekMatchCount(redis: RedisLike, weekId: string): Promise<void> {
  await redis.incrBy(keyWeekMatchCounter(weekId), 1);
}

export async function getWeekMatchCount(redis: RedisLike, weekId: string): Promise<number> {
  const raw = await redis.get(keyWeekMatchCounter(weekId));
  return raw ? Number(raw) : 0;
}

async function readUserStats(
  redis: RedisLike,
  weekId: string,
  userId: string,
  bucket: LeaderboardBucket = "all",
): Promise<WeeklyUserStats> {
  const statsRaw = await redis.get(keyWeekUserStats(weekId, userId, bucket));
  const username = (await redis.get(keyWeekUserName(weekId, userId))) ?? userId;
  if (!statsRaw) {
    return {
      userId,
      username,
      wins: 0,
      losses: 0,
      matches: 0,
    };
  }

  const parsed = JSON.parse(statsRaw) as WeeklyUserStats;
  return {
    ...parsed,
    username,
  };
}

async function writeUserStats(
  redis: RedisLike,
  weekId: string,
  stats: WeeklyUserStats,
  bucket: LeaderboardBucket = "all",
): Promise<void> {
  await redis.set(keyWeekUserStats(weekId, stats.userId, bucket), JSON.stringify(stats));
  await redis.set(keyWeekUserName(weekId, stats.userId), stats.username);
  await redis.sAdd(keyWeekUserIndex(weekId, bucket), stats.userId);
  await redis.zAdd(keyWeekLeaderboard(weekId, bucket), leaderboardScore(stats), stats.userId);
}

export async function recordMatchResult(
  redis: RedisLike,
  weekId: string,
  winner: { userId: string; username: string },
  loser: { userId: string; username: string },
): Promise<void> {
  await recordUserOutcome(redis, weekId, winner, true);
  await recordUserOutcome(redis, weekId, loser, false);
}

export async function recordUserOutcome(
  redis: RedisLike,
  weekId: string,
  user: { userId: string; username: string },
  didWin: boolean,
  bucket: LeaderboardBucket = "all",
): Promise<void> {
  const allStats = await readUserStats(redis, weekId, user.userId, "all");
  allStats.username = user.username;
  allStats.matches += 1;
  if (didWin) {
    allStats.wins += 1;
  } else {
    allStats.losses += 1;
  }
  await writeUserStats(redis, weekId, allStats, "all");

  if (bucket === "all") {
    return;
  }

  const stats = await readUserStats(redis, weekId, user.userId, bucket);
  stats.username = user.username;
  stats.matches += 1;
  if (didWin) {
    stats.wins += 1;
  } else {
    stats.losses += 1;
  }
  await writeUserStats(redis, weekId, stats, bucket);
}

export async function getLeaderboardTop(
  redis: RedisLike,
  weekId: string,
  limit = 10,
  bucket: LeaderboardBucket = "all",
): Promise<WeeklyUserStats[]> {
  const userIds = await redis.zRange(keyWeekLeaderboard(weekId, bucket), 0, limit - 1, { rev: true });
  const stats: WeeklyUserStats[] = [];
  for (const userId of userIds) {
    const one = await readUserStats(redis, weekId, userId, bucket);
    stats.push(one);
  }

  stats.sort((a, b) => {
    if (a.wins !== b.wins) {
      return b.wins - a.wins;
    }
    const ratioDiff = calcRatio(b) - calcRatio(a);
    if (Math.abs(ratioDiff) > Number.EPSILON) {
      return ratioDiff > 0 ? 1 : -1;
    }
    if (a.matches !== b.matches) {
      return b.matches - a.matches;
    }
    return a.username.localeCompare(b.username);
  });

  return stats.slice(0, limit);
}

export async function newWeekIdFromDate(now: Date): Promise<string> {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function weekSummaryLine(top3: WeeklyUserStats[], totalMatches: number): string {
  if (top3.length === 0) {
    return `Weekly court summary: no completed matches yet. Total matches: ${totalMatches}.`;
  }

  const podium = top3
    .map((row, i) => {
      const ratio = row.matches > 0 ? (row.wins / row.matches).toFixed(2) : "0.00";
      return `${i + 1}. u/${row.username} (${row.wins}-${row.losses}, ratio ${ratio})`;
    })
    .join(" | ");

  return `Weekly court summary: ${podium}. Total matches: ${totalMatches}.`;
}
