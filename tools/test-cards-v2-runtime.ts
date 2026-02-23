import assert from "node:assert/strict";
import { attack, createInitialMatch, endTurn, playCard } from "../src/server/game/engine.ts";
import { runAiUntilHumanTurn } from "../src/server/game/ai.ts";
import { JUDGE_COL, type CardTrait, type Lane, type MatchState, type PlayerSide, type UnitState } from "../src/shared/game.ts";
import { getCatalogCard } from "../src/shared/card-catalog.ts";

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

function makeActiveMatch(activeSide: PlayerSide = "A"): MatchState {
  const match = createInitialMatch(
    {
      weekId: "phase3-test-week",
      postId: "phase3-test-post",
      mode: "sandbox",
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
      seed: 54321,
    },
    1_700_000_000_000,
  );

  match.status = "active";
  match.turn = 1;
  match.activeSide = activeSide;
  match.turnDeadlineAt = Number.MAX_SAFE_INTEGER;
  match.players.A.mulliganDone = true;
  match.players.B.mulliganDone = true;
  return match;
}

function addUnit(match: MatchState, seed: UnitSeed): UnitState {
  unitCounter += 1;
  const id = `phase3-unit-${unitCounter}`;
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

function addCatalogUnit(
  match: MatchState,
  side: PlayerSide,
  lane: Lane,
  col: number,
  cardId: string,
  overrides?: Partial<Pick<UnitState, "attack" | "health" | "maxHealth" | "name">>,
): UnitState {
  const card = getCatalogCard(cardId);
  const baseHealth = overrides?.maxHealth ?? overrides?.health ?? card.health ?? 1;
  return addUnit(match, {
    owner: side,
    lane,
    col,
    cardId,
    name: overrides?.name ?? card.name,
    attack: overrides?.attack ?? card.attack ?? 0,
    health: overrides?.health ?? baseHealth,
    traits: card.traits,
  });
}

function hasLog(match: MatchState, text: string): boolean {
  return match.log.some((entry) => entry.text.includes(text));
}

function testOnSummonV2RuntimeForComplianceClerk(): void {
  const match = makeActiveMatch("A");
  const ally = addCatalogUnit(match, "A", "front", 0, "rulebook_slasher", { health: 3, maxHealth: 5, name: "Wounded Ally" });
  ally.maxHealth = 5;
  ally.stunnedUntilTurn = match.turn + 2;
  ally.exposedUntilTurn = match.turn + 2;

  match.players.A.hand = ["compliance_clerk"];
  match.players.A.shares = 999;

  const result = playCard(match, {
    side: "A",
    handIndex: 0,
    lane: "front",
    col: JUDGE_COL,
  });

  assert.equal(result.ok, true, "compliance_clerk should be playable into green judge slot");
  assert.equal(ally.health, 5, "compliance_clerk V2 on_summon should heal damaged ally for 2");
  assert.equal((ally.stunnedUntilTurn ?? 0) <= match.turn, true, "compliance_clerk V2 on_summon should cleanse stun");
  assert.equal((ally.exposedUntilTurn ?? -1) < match.turn, true, "compliance_clerk V2 on_summon should cleanse exposed");
  assert.equal(hasLog(match, "Compliance Clerk [V2]:"), true, "expected V2 runtime log for compliance_clerk on_summon");
}

function testTurnStartV2RuntimeForPicketMarshalWithoutSignatureFallback(): void {
  const match = makeActiveMatch("B");
  const picket = addCatalogUnit(match, "A", "front", 0, "picket_marshal", { health: 3, maxHealth: 5 });
  picket.maxHealth = 5;
  picket.stunnedUntilTurn = 7;
  picket.exposedUntilTurn = 7;
  picket.cannotAttackUntilTurn = 7;

  const result = endTurn(match, "B");
  assert.equal(result.ok, true, "ending B turn should start A turn");
  assert.equal(match.activeSide, "A");
  assert.equal(match.turn, 2);
  assert.equal(picket.health, 5, "picket_marshal V2 turn_start should heal self for 2");
  assert.equal((picket.stunnedUntilTurn ?? 0) <= match.turn, true, "picket_marshal V2 turn_start should cleanse stun");
  assert.equal((picket.exposedUntilTurn ?? -1) < match.turn, true, "picket_marshal V2 turn_start should cleanse exposed");
  assert.equal(hasLog(match, "Picket Marshal [V2]:"), true, "expected V2 runtime log for picket_marshal turn_start");
  assert.equal(hasLog(match, "Picket Marshal signature:"), false, "V2 card should not use legacy fallback signature at turn_start");
}

function testCombatV2RuntimeForStonkChargerWithoutSignatureFallback(): void {
  const match = makeActiveMatch("A");
  const attacker = addCatalogUnit(match, "A", "front", 0, "stonk_charger", { health: 2, maxHealth: 2 });
  const target = addCatalogUnit(match, "B", "front", 0, "rulebook_slasher", { name: "Target Dummy", attack: 1, health: 6 });
  target.maxHealth = 6;

  const result = attack(match, {
    side: "A",
    attackerUnitId: attacker.id,
    target: { kind: "unit", unitId: target.id },
  });

  assert.equal(result.ok, true, "stonk_charger attack should resolve");
  const expectedExposeUntil = match.turn + 2;
  assert.equal(target.health > 0, true, "target must survive to validate on_hit target_survived trigger");
  assert.equal(target.exposedUntilTurn, expectedExposeUntil, "stonk_charger V2 on_hit should apply exposed for 2 turns");
  assert.equal(hasLog(match, "Stonk Charger [V2]:"), true, "expected V2 runtime log for stonk_charger on_hit");
  assert.equal(hasLog(match, "Stonk Charger signature:"), false, "V2 card should not use legacy fallback signature in combat");
}

function testOnSummonV2RuntimeForNeutralForensicJournalist(): void {
  const match = makeActiveMatch("A");
  match.players.A.hand = ["forensic_journalist"];
  match.players.A.shares = 999;

  const result = playCard(match, {
    side: "A",
    handIndex: 0,
    lane: "front",
    col: 0,
  });

  assert.equal(result.ok, true, "forensic_journalist should be playable");
  const unitId = match.players.A.board.front[0];
  assert.equal(typeof unitId, "string", "forensic_journalist should be placed on board");
  const unit = unitId ? match.units[unitId] : undefined;
  assert.ok(unit, "forensic_journalist unit state should exist");
  assert.equal(unit?.shieldCharges ?? 0, 3, "forensic_journalist V2 on_summon should grant +3 shield");
  assert.equal(hasLog(match, "Forensic Journalist [V2]:"), true, "expected V2 runtime log for forensic_journalist on_summon");
}

function testBotPrioritizesBlueJudgeSlotForCorruptSpecialist(): void {
  const match = createInitialMatch(
    {
      weekId: "phase3-ai-week",
      postId: "phase3-ai-post",
      mode: "pvp",
      playerA: {
        userId: "bot-a",
        username: "botA",
        faction: "short_hedgefund",
        isBot: true,
        botLevel: 3,
      },
      playerB: {
        userId: "human-b",
        username: "humanB",
        faction: "retail_mob",
        isBot: false,
      },
      seed: 424242,
    },
    1_700_000_000_000,
  );
  match.status = "active";
  match.turn = 1;
  match.activeSide = "A";
  match.turnDeadlineAt = Number.MAX_SAFE_INTEGER;
  match.players.A.mulliganDone = true;
  match.players.B.mulliganDone = true;
  match.players.A.hand = ["borrowed_shield"];
  match.players.A.shares = 999;
  match.players.B.hand = [];

  runAiUntilHumanTurn(match);

  const blueJudgeUnitId = match.players.A.board.back[JUDGE_COL];
  assert.equal(typeof blueJudgeUnitId, "string", "AI should prioritize blue Judge slot for corrupt specialist unit");
  assert.equal(blueJudgeUnitId ? match.units[blueJudgeUnitId]?.cardId : undefined, "borrowed_shield");
}

function testBotCanPlayMultipleCardsInOneTurn(): void {
  const match = createInitialMatch(
    {
      weekId: "phase3-ai-multiplay-week",
      postId: "phase3-ai-multiplay-post",
      mode: "pvp",
      playerA: {
        userId: "bot-a",
        username: "botA",
        faction: "short_hedgefund",
        isBot: true,
        botLevel: 3,
      },
      playerB: {
        userId: "human-b",
        username: "humanB",
        faction: "retail_mob",
        isBot: false,
      },
      seed: 777777,
    },
    1_700_000_000_000,
  );
  match.status = "active";
  match.turn = 1;
  match.activeSide = "A";
  match.turnDeadlineAt = Number.MAX_SAFE_INTEGER;
  match.players.A.mulliganDone = true;
  match.players.B.mulliganDone = true;
  match.players.A.hand = ["borrowed_shield", "bribe_courier"];
  match.players.A.shares = 999;
  match.players.B.hand = [];

  runAiUntilHumanTurn(match);

  const aUnits = Object.values(match.units).filter((u) => u.owner === "A");
  assert.equal(aUnits.length >= 2, true, "Higher-level AI should be able to deploy more than one card in a turn when budget and slots allow");
}

function main(): void {
  testOnSummonV2RuntimeForComplianceClerk();
  testTurnStartV2RuntimeForPicketMarshalWithoutSignatureFallback();
  testCombatV2RuntimeForStonkChargerWithoutSignatureFallback();
  testOnSummonV2RuntimeForNeutralForensicJournalist();
  testBotPrioritizesBlueJudgeSlotForCorruptSpecialist();
  testBotCanPlayMultipleCardsInOneTurn();
  console.log("V2 runtime trigger regression tests passed.");
}

main();
