import type { MatchState } from "../../shared/game";
import { maybeRunBot, tickTimeouts } from "./engine";

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
