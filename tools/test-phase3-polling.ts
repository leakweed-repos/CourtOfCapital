import assert from "node:assert/strict";
import { createInitialMatch, tickTimeoutsWithMeta } from "../src/server/game/engine.ts";
import { shouldPersistMatchState } from "../src/server/core/match-persist.ts";
import { shouldDiscardMatchResponse } from "../src/client/match-sync.ts";
import type { MatchState } from "../src/shared/game.ts";

function makeActiveMatch(): MatchState {
  const now = 1_700_000_000_000;
  const match = createInitialMatch(
    {
      weekId: "phase3-week",
      postId: "phase3-post",
      mode: "pvp",
      playerA: {
        userId: "a",
        username: "alice",
        faction: "retail_mob",
      },
      playerB: {
        userId: "b",
        username: "bob",
        faction: "sec",
      },
      seed: 123,
    },
    now,
  );
  match.status = "active";
  match.activeSide = "A";
  match.turn = 1;
  match.players.A.mulliganDone = true;
  match.players.B.mulliganDone = true;
  match.turnDeadlineAt = now + 60_000;
  match.updatedAt = now;
  return match;
}

function cloneMatch(match: MatchState): MatchState {
  return JSON.parse(JSON.stringify(match)) as MatchState;
}

function testTickTimeoutsNoOpDoesNotUpdateTimestamp(): void {
  const match = makeActiveMatch();
  const beforeUpdatedAt = match.updatedAt;
  const beforeTurn = match.turn;
  const result = tickTimeoutsWithMeta(match, beforeUpdatedAt + 1_000);
  assert.equal(result.changed, false, "tickTimeoutsWithMeta should mark no-op polling as unchanged");
  assert.equal(result.match.updatedAt, beforeUpdatedAt, "no-op polling must not touch updatedAt");
  assert.equal(result.match.turn, beforeTurn, "no-op polling must not mutate gameplay turn");
}

function testNoOpPollDoesNotPersist(): void {
  const match = makeActiveMatch();
  const beforeUpdatedAt = match.updatedAt;
  const ticked = tickTimeoutsWithMeta(match, beforeUpdatedAt + 1_000);

  let saveCalls = 0;
  if (shouldPersistMatchState(beforeUpdatedAt, ticked.match)) {
    saveCalls += 1;
  }
  assert.equal(ticked.changed, false);
  assert.equal(saveCalls, 0, "no-op polling path should skip save");
}

function testOutOfOrderResponseGuard(): void {
  const base = makeActiveMatch();
  const older = cloneMatch(base);
  older.id = "match-1";
  older.updatedAt = 100;
  const newer = cloneMatch(base);
  newer.id = "match-1";
  newer.updatedAt = 200;

  // B (newer) applied first
  const discardOlder = shouldDiscardMatchResponse({
    requestSeq: 1,
    latestAppliedRequestSeq: 2,
    allowSwitch: true,
    requestedMatchId: "match-1",
    currentMatch: newer,
    incomingMatch: older,
  });
  assert.equal(discardOlder, true, "older response arriving after newer must be discarded");

  // Same request order but stale updatedAt should also be rejected
  const discardStaleTimestamp = shouldDiscardMatchResponse({
    requestSeq: 3,
    latestAppliedRequestSeq: 2,
    allowSwitch: true,
    requestedMatchId: "match-1",
    currentMatch: newer,
    incomingMatch: older,
  });
  assert.equal(discardStaleTimestamp, true, "stale updatedAt response must be discarded");

  const acceptFresh = shouldDiscardMatchResponse({
    requestSeq: 4,
    latestAppliedRequestSeq: 2,
    allowSwitch: true,
    requestedMatchId: "match-1",
    currentMatch: newer,
    incomingMatch: { ...newer, updatedAt: 201 },
  });
  assert.equal(acceptFresh, false, "fresh response should be accepted");
}

function main(): void {
  testTickTimeoutsNoOpDoesNotUpdateTimestamp();
  testNoOpPollDoesNotPersist();
  testOutOfOrderResponseGuard();
  console.log("Phase 3 polling/stale-response regression tests passed.");
}

main();
