import assert from "node:assert/strict";
import { attack, createInitialMatch } from "../src/server/game/engine.ts";
import { JUDGE_COL, type CardTrait, type Lane, type MatchState, type PlayerSide, type UnitState } from "../src/shared/game.ts";

type UnitSeed = {
  owner: PlayerSide;
  lane: Lane;
  col: number;
  attack: number;
  health: number;
  traits?: CardTrait[];
  name?: string;
  cardId?: string;
};

let unitCounter = 0;

function makeActiveMatch(): MatchState {
  const match = createInitialMatch(
    {
      weekId: "test-week",
      postId: "test-post",
      mode: "pvp",
      playerA: {
        userId: "user-a",
        username: "userA",
        faction: "retail_mob",
      },
      playerB: {
        userId: "user-b",
        username: "userB",
        faction: "short_hedgefund",
        isBot: false,
      },
      seed: 12345,
    },
    1_700_000_000_000,
  );

  match.status = "active";
  match.turn = 1;
  match.activeSide = "A";
  match.turnDeadlineAt = Number.MAX_SAFE_INTEGER;
  match.players.A.mulliganDone = true;
  match.players.B.mulliganDone = true;
  return match;
}

function addUnit(match: MatchState, seed: UnitSeed): UnitState {
  unitCounter += 1;
  const id = `test-unit-${unitCounter}`;
  const unit: UnitState = {
    id,
    owner: seed.owner,
    cardId: seed.cardId ?? id,
    name: seed.name ?? id,
    attack: seed.attack,
    health: seed.health,
    maxHealth: seed.health,
    lane: seed.lane,
    col: seed.col,
    traits: seed.traits ? [...seed.traits] : [],
    cannotAttackUntilTurn: 0,
    shieldCharges: 0,
  };

  match.units[id] = unit;
  match.players[seed.owner].board[seed.lane][seed.col] = id;
  return unit;
}

function frontFill(match: MatchState, count: number, tauntAtIndex: number | null = null): void {
  for (let i = 0; i < count; i += 1) {
    const traits: CardTrait[] = tauntAtIndex === i ? ["taunt"] : [];
    addUnit(match, {
      owner: "B",
      lane: "front",
      col: i,
      attack: 1,
      health: 3,
      traits,
      name: `enemy-front-${i + 1}`,
    });
  }
}

function runLeaderAttack(match: MatchState, attackerId: string) {
  return attack(match, {
    side: "A",
    attackerUnitId: attackerId,
    target: { kind: "leader" },
  });
}

function expectLeaderHpDelta(match: MatchState, before: number, delta: number): void {
  const after = match.players.B.leader.hp;
  assert.equal(after, before - delta, `expected enemy leader hp delta ${delta}, got ${before - after}`);
}

function testFrontRowShieldDamageScaling(): void {
  {
    const match = makeActiveMatch();
    const attacker = addUnit(match, { owner: "A", lane: "front", col: 0, attack: 4, health: 4, name: "Front 4 ATK" });
    const before = match.players.B.leader.hp;
    const result = runLeaderAttack(match, attacker.id);
    assert.equal(result.ok, true, "0 front units should allow leader attack");
    expectLeaderHpDelta(match, before, 4);
  }

  {
    const match = makeActiveMatch();
    const attacker = addUnit(match, { owner: "A", lane: "front", col: 0, attack: 4, health: 4, name: "Front 4 ATK" });
    frontFill(match, 1);
    const before = match.players.B.leader.hp;
    const result = runLeaderAttack(match, attacker.id);
    assert.equal(result.ok, true, "1 front unit should allow leader attack");
    expectLeaderHpDelta(match, before, 3);
    assert.equal(
      match.log.some((entry) => entry.text.includes("leader damage reduced by 1 (enemy front row: 1).")),
      true,
      "expected reduction log for 1 front unit",
    );
  }

  {
    const match = makeActiveMatch();
    const attacker = addUnit(match, { owner: "A", lane: "front", col: 0, attack: 4, health: 4, name: "Front 4 ATK" });
    frontFill(match, 2);
    const before = match.players.B.leader.hp;
    const result = runLeaderAttack(match, attacker.id);
    assert.equal(result.ok, true, "2 front units should allow leader attack");
    expectLeaderHpDelta(match, before, 2);
  }

  {
    const match = makeActiveMatch();
    const attacker = addUnit(match, { owner: "A", lane: "front", col: 0, attack: 1, health: 4, name: "Front 1 ATK" });
    frontFill(match, 2);
    const before = match.players.B.leader.hp;
    const result = runLeaderAttack(match, attacker.id);
    assert.equal(result.ok, true, "2 front units should still allow attack");
    expectLeaderHpDelta(match, before, 0);
  }

  {
    const match = makeActiveMatch();
    const attacker = addUnit(match, { owner: "A", lane: "front", col: 0, attack: 4, health: 4, name: "Front 4 ATK" });
    frontFill(match, 3);
    const before = match.players.B.leader.hp;
    const result = runLeaderAttack(match, attacker.id);
    assert.equal(result.ok, false, "3 front units should block leader attack");
    assert.equal(result.error, "Enemy front row shields the leader (3 units). Clear the line first.");
    expectLeaderHpDelta(match, before, 0);
  }
}

function testBackRowNeedsReachOrRangedForLeader(): void {
  const match = makeActiveMatch();
  const attacker = addUnit(match, {
    owner: "A",
    lane: "back",
    col: 0,
    attack: 4,
    health: 3,
    traits: ["back_only"],
    name: "Backline Peon",
  });

  const result = runLeaderAttack(match, attacker.id);
  assert.equal(result.ok, false, "back-row non-ranged/non-reach should not hit leader");
  assert.equal(result.error, "Back-row unit needs reach or ranged to attack leader.");
}

function testBlueJudgeBypassesFrontShieldButNotTaunt(): void {
  {
    const match = makeActiveMatch();
    const attacker = addUnit(match, {
      owner: "A",
      lane: "back",
      col: JUDGE_COL,
      attack: 4,
      health: 4,
      name: "Blue Judge Specialist",
      traits: [],
    });
    frontFill(match, 3);
    const before = match.players.B.leader.hp;
    const result = runLeaderAttack(match, attacker.id);
    assert.equal(result.ok, true, "blue judge should bypass front-row shield");
    expectLeaderHpDelta(match, before, 4);
  }

  {
    const match = makeActiveMatch();
    const attacker = addUnit(match, {
      owner: "A",
      lane: "back",
      col: JUDGE_COL,
      attack: 4,
      health: 4,
      name: "Blue Judge Specialist",
      traits: [],
    });
    frontFill(match, 2, 0);
    const result = runLeaderAttack(match, attacker.id);
    assert.equal(result.ok, false, "blue judge should still respect taunt for leader attacks");
    assert.equal(result.error, "Blue judge slot cannot attack leader while enemy front-row taunt is active.");
  }
}

function main(): void {
  testFrontRowShieldDamageScaling();
  testBackRowNeedsReachOrRangedForLeader();
  testBlueJudgeBypassesFrontShieldButNotTaunt();
  console.log("Leader targeting regression tests passed.");
}

main();
