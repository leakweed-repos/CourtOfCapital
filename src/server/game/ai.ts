import { nowTs } from "../../shared/game";
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

function botTurnDelayMsForLevel(level?: 1 | 2 | 3): number {
  if (level === 1) return 17_000;
  if (level === 2) return 13_000;
  if (level === 3) return 7_000;
  return 0;
}

function clearBotThinkDelay(match: MatchState): void {
  match.botThinkUntilAt = undefined;
  match.botThinkSide = undefined;
  match.botThinkTurn = undefined;
}

function isSameBotThinkWindow(match: MatchState): boolean {
  return (
    typeof match.botThinkUntilAt === "number" &&
    match.botThinkSide === match.activeSide &&
    match.botThinkTurn === match.turn
  );
}

export function runAiUntilHumanTurnWithStartDelay(match: MatchState, now = nowTs()): MatchState {
  if (match.status !== "active") {
    clearBotThinkDelay(match);
    return match;
  }

  const activePlayer = match.players[match.activeSide];
  if (!activePlayer.isBot || match.mode !== "pve") {
    clearBotThinkDelay(match);
    return runAiUntilHumanTurn(match);
  }

  const delayMs = botTurnDelayMsForLevel(activePlayer.botLevel);
  if (delayMs <= 0) {
    clearBotThinkDelay(match);
    return runAiUntilHumanTurn(match);
  }

  if (!isSameBotThinkWindow(match)) {
    match.botThinkUntilAt = now + delayMs;
    match.botThinkSide = match.activeSide;
    match.botThinkTurn = match.turn;
    return match;
  }

  if ((match.botThinkUntilAt ?? 0) > now) {
    return match;
  }

  clearBotThinkDelay(match);
  return runAiUntilHumanTurn(match);
}
