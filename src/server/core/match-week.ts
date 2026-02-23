import type { MatchState } from "../../shared/game";
import { getCurrentWeekId, type RedisLike } from "../game/storage";

export async function getArchivedWeekReadOnlyError(redis: RedisLike, match: MatchState): Promise<string | null> {
  if (match.status === "finished") {
    return null;
  }
  const activeWeekId = await getCurrentWeekId(redis);
  if (!activeWeekId || match.weekId === activeWeekId) {
    return null;
  }
  return `Archived week match is read-only (match ${match.weekId}, active ${activeWeekId}).`;
}
