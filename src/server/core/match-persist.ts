import type { MatchState } from "../../shared/game";

export function shouldPersistMatchState(
  previousUpdatedAt: number,
  match: MatchState,
  options?: { force?: boolean },
): boolean {
  return options?.force === true || match.updatedAt !== previousUpdatedAt;
}
