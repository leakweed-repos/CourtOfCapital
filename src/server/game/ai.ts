import type { BotPlannedAction, MatchState } from "../../shared/game";
import { maybeRunBot, tickTimeouts, type BotActionRecorder } from "./engine";

export function runAiUntilHumanTurn(match: MatchState): MatchState {
  let guard = 0;
  let next = match;

  while (guard < 8) {
    guard += 1;
    next = tickTimeouts(next);
    if (next.status !== "active") {
      break;
    }
    if (!next.players[next.activeSide].isBot) {
      break;
    }
    next = maybeRunBot(next);
  }

  return next;
}

export function runAiUntilHumanTurnWithTrace(match: MatchState): { match: MatchState; actions: BotPlannedAction[] } {
  const actions: BotPlannedAction[] = [];
  const recorder: BotActionRecorder = {
    record(action) {
      actions.push(action);
    },
  };

  let guard = 0;
  let next = match;

  while (guard < 8) {
    guard += 1;
    next = tickTimeouts(next);
    if (next.status !== "active") {
      break;
    }
    if (!next.players[next.activeSide].isBot) {
      break;
    }
    next = maybeRunBot(next, recorder);
  }

  return { match: next, actions };
}

export function botTurnDelayMsForLevel(level?: 1 | 2 | 3): number {
  if (level === 1) return 17_000;
  if (level === 2) return 13_000;
  if (level === 3) return 7_000;
  return 0;
}
