import type { MatchState } from "../shared/game";

export type MatchResponseGuardInput = {
  requestSeq: number;
  latestAppliedRequestSeq: number;
  allowSwitch: boolean;
  requestedMatchId: string;
  currentMatch: MatchState | null;
  incomingMatch: MatchState;
};

export function shouldDiscardMatchResponse(input: MatchResponseGuardInput): boolean {
  if (input.requestSeq < input.latestAppliedRequestSeq) {
    return true;
  }

  if (!input.allowSwitch) {
    if (!input.currentMatch || input.currentMatch.id !== input.requestedMatchId) {
      return true;
    }
  }

  if (input.currentMatch && input.currentMatch.id === input.incomingMatch.id) {
    if (input.incomingMatch.updatedAt < input.currentMatch.updatedAt) {
      return true;
    }
  }

  return false;
}
