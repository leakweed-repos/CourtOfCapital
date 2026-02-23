import { opponentOf, type MatchState } from "../../shared/game";
import {
  incrementWeekMatchCount,
  markMatchResultCommitted,
  recordUserOutcome,
  type LeaderboardBucket,
  type RedisLike,
} from "../game/storage";

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

export async function finalizeMatchResultOnce(redis: RedisLike, match: MatchState): Promise<boolean> {
  if (match.status !== "finished" || !match.winnerSide) {
    return false;
  }
  if (match.mode === "tutorial" || match.mode === "sandbox") {
    return false;
  }
  const firstCommit = await markMatchResultCommitted(redis, match.id);
  if (!firstCommit) {
    return false;
  }

  const winner = match.players[match.winnerSide];
  const loser = match.players[opponentOf(match.winnerSide)];
  const bucket = leaderboardBucketForMatch(match);

  if (!winner.isBot) {
    await recordUserOutcome(redis, match.weekId, { userId: winner.userId, username: winner.username }, true, bucket ?? "all");
  }
  if (!loser.isBot) {
    await recordUserOutcome(redis, match.weekId, { userId: loser.userId, username: loser.username }, false, bucket ?? "all");
  }
  await incrementWeekMatchCount(redis, match.weekId);
  return true;
}
