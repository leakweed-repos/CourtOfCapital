import {
  BOARD_COLS,
  JUDGE_COL,
  MAX_HAND_SIZE,
  MULLIGAN_SECONDS,
  RULES_VERSION,
  TURN_SECONDS,
  clamp,
  nowTs,
  opponentOf,
  seededUnitFloat,
  stableHash,
  uniqueId,
} from "../../shared/game";
import type {
  AttackInput,
  FactionId,
  MatchActionResult,
  MatchState,
  MulliganInput,
  PlayCardInput,
  PlayerSide,
  RepositionJudgeInput,
  StartMatchInput,
  UnitState,
} from "../../shared/game";
import {
  DEFAULT_LEADER_HP,
  DEFAULT_FACTION,
  DEFAULT_STARTING_SHARES,
  STARTING_HAND,
  buildDeck,
  canPlaceCardInLane,
  drawCards,
  getCard,
  inBoundsCol,
  simpleAiPreferredCol,
} from "./models";
import { getCardEffectDescriptor, type CardTargetRule } from "../../shared/card-effects";
import { SANDBOX_CLEANUP_CARD_IDS } from "../../shared/card-catalog";
import {
  getJudgeSpecialistProfile,
  type JudgeBlueRider,
  type JudgePrimaryEffect,
  type JudgeSupportEffect,
} from "../../shared/judge-specialists";
import { getResistanceChance, type ResistanceKind } from "../../shared/resistance";
import { getUnitSignatureProfile } from "../../shared/unit-signatures";
import { isJudgeCorruptSpecialistCard, isJudgePositiveSpecialistCard, isJudgeSpecialistCard } from "../../shared/placement";
import { tutorialTickPause } from "./tutorial";
import { isSandboxCleanupCard } from "./sandbox";

const MAX_LOG = 60;
const BOARD_LANES: Array<"front" | "back"> = ["front", "back"];
const EXPLICIT_UNIT_SKILL_IDS = new Set<string>([
  "guild_bailiff",
  "market_arbiter",
  "compliance_clerk",
  "market_referee",
  "clearing_router",
  "public_defender",
  "investor_relations_chief",
  "clearing_knight",
  "diamond_hand_captain",
  "meme_berserker",
  "meme_editor",
  "roadshow_blade",
  "yolo_striker",
  "panic_seller_agent",
  "rehypothecator",
  "bribe_courier",
  "civic_auditor",
  "settlement_liaison",
  "syndicate_baron",
  "floor_mediator",
  "retail_rebel",
  "discord_moderator",
  "fud_negotiator",
  "doom_researcher",
  "borrow_rate_whisperer",
  "halt_marshall",
  "spread_sniper",
  "whisper_lobbyist",
  "ftd_collector",
  "narrative_assassin",
]);

function pushLog(match: MatchState, text: string): void {
  match.log.push({ at: nowTs(), turn: match.turn, text });
  if (match.log.length > MAX_LOG) {
    match.log = match.log.slice(match.log.length - MAX_LOG);
  }
}

function nextRoll(match: MatchState, label: string): number {
  const salt = stableHash(`${label}:${match.turn}:${match.rngCounter}`);
  const out = seededUnitFloat(match.seed, salt);
  match.rngCounter += 1;
  return out;
}

function turnSecondsForSide(match: MatchState, side: PlayerSide): number {
  const override = match.turnSecondsBySide?.[side];
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return Math.max(1, Math.floor(override));
  }
  return TURN_SECONDS;
}

function drawOne(match: MatchState, side: PlayerSide): string | null {
  const player = match.players[side];
  if (player.deck.length === 0) {
    return null;
  }
  const cardId = player.deck.shift() as string;
  if (player.hand.length >= MAX_HAND_SIZE) {
    player.discard.push(cardId);
    pushLog(match, `${side} burned ${getCard(cardId).name} (hand limit ${MAX_HAND_SIZE}).`);
    return null;
  }
  player.hand.push(cardId);
  return cardId;
}

function returnCardToHandOrBurn(match: MatchState, side: PlayerSide, cardId: string, reason: string): void {
  const player = match.players[side];
  if (player.hand.length >= MAX_HAND_SIZE) {
    player.discard.push(cardId);
    pushLog(match, `${side} burned ${getCard(cardId).name} (${reason}, hand limit ${MAX_HAND_SIZE}).`);
    return;
  }
  player.hand.push(cardId);
  pushLog(match, `${side} recovered ${getCard(cardId).name} to hand (${reason}).`);
}

function isUnitCard(cardId: string): boolean {
  return getCard(cardId).type === "unit";
}

function rebalanceOpeningHand(player: MatchState["players"]["A"], seed: number): void {
  let unitCount = player.hand.filter((id) => isUnitCard(id)).length;
  let salt = 700;

  while (unitCount < 2) {
    const utilityIdx = player.hand.findIndex((id) => !isUnitCard(id));
    if (utilityIdx < 0) break;

    const unitInDeckIdx = player.deck.findIndex((id) => isUnitCard(id));
    if (unitInDeckIdx < 0) break;

    const outgoing = player.hand[utilityIdx] as string;
    const incoming = player.deck.splice(unitInDeckIdx, 1)[0] as string;
    player.hand[utilityIdx] = incoming;

    const insertAt = Math.floor(seededUnitFloat(seed, salt) * (player.deck.length + 1));
    salt += 1;
    player.deck.splice(insertAt, 0, outgoing);
    unitCount += 1;
  }

  if (player.deck.length > 0 && player.hand.length > 0) {
    const roll = seededUnitFloat(seed, 777);
    if (roll > 0.45) {
      const handIdx = Math.floor(seededUnitFloat(seed, 778) * player.hand.length);
      const deckIdx = Math.floor(seededUnitFloat(seed, 779) * player.deck.length);
      const fromHand = player.hand[handIdx] as string;
      player.hand[handIdx] = player.deck[deckIdx] as string;
      player.deck[deckIdx] = fromHand;
    }
  }
}

function makePlayer(
  side: PlayerSide,
  input: StartMatchInput["playerA"] | StartMatchInput["playerB"],
  deckSeed: number,
): MatchState["players"]["A"] {
  const faction = input.faction ?? DEFAULT_FACTION;
  const deck = buildDeck(deckSeed, faction);
  const drawn = drawCards(deck, STARTING_HAND);
  const player: MatchState["players"]["A"] = {
    userId: input.userId,
    username: input.username,
    faction,
    side,
    isBot: "isBot" in input ? input.isBot : false,
    botLevel: "botLevel" in input ? input.botLevel : undefined,
    shares: DEFAULT_STARTING_SHARES,
    favor: 0,
    probation: 0,
    leader: {
      hp: DEFAULT_LEADER_HP,
      maxHp: DEFAULT_LEADER_HP,
    },
    deck: drawn.nextDeck,
    hand: drawn.drawn,
    discard: [],
    board: {
      front: new Array(BOARD_COLS).fill(null),
      back: new Array(BOARD_COLS).fill(null),
    },
    nakedShortDebt: 0,
    judgeHostility: 0,
    blockedLane: undefined,
    blockedCol: undefined,
    curtainEventId: undefined,
    mulliganDone: false,
  };
  rebalanceOpeningHand(player, deckSeed ^ 0x52a1);
  return player;
}

export function createInitialMatch(input: StartMatchInput, now = nowTs()): MatchState {
  const seed = input.seed ?? stableHash(`${input.weekId}:${input.playerA.userId}:${input.playerB.userId}:${now}`);
  const pA = makePlayer("A", input.playerA, seed ^ 0xaaa111);
  const pB = makePlayer("B", input.playerB, seed ^ 0xbbb222);

  return {
    id: uniqueId("match", seed, 1),
    weekId: input.weekId,
    postId: input.postId,
    mode: input.mode,
    rulesVersion: RULES_VERSION,
    status: "mulligan",
    createdAt: now,
    updatedAt: now,
    seed,
    rngCounter: 2,
    turn: 0,
    activeSide: "A",
    turnDeadlineAt: 0,
    mulliganDeadlineAt: now + MULLIGAN_SECONDS * 1000,
    judgeMood: 0,
    eventRow: new Array(BOARD_COLS).fill(null),
    units: {},
    eventUnits: {},
    players: {
      A: pA,
      B: pB,
    },
    log: [{ at: now, turn: 0, text: "Match created. Mulligan started." }],
  };
}

function slotUnit(
  match: MatchState,
  side: PlayerSide,
  lane: "front" | "back",
  col: number,
  cardId: string,
): UnitState {
  const card = getCard(cardId);
  const unitId = uniqueId("u", match.seed, match.rngCounter + 101);
  match.rngCounter += 1;
  const unit: UnitState = {
    id: unitId,
    owner: side,
    cardId,
    name: card.name,
    attack: card.attack ?? 0,
    health: card.health ?? 1,
    maxHealth: card.health ?? 1,
    lane,
    col,
    traits: [...card.traits],
    cannotAttackUntilTurn: card.traits.includes("rush") ? match.turn : match.turn + 1,
    shieldCharges: 0,
  };

  match.units[unitId] = unit;
  match.players[side].board[lane][col] = unitId;
  return unit;
}

function removeUnit(match: MatchState, unitId: string): void {
  const unit = match.units[unitId];
  if (!unit) {
    return;
  }
  const board = match.players[unit.owner].board[unit.lane];
  if (board[unit.col] === unitId) {
    board[unit.col] = null;
  }
  delete match.units[unitId];
}

function removeEventUnit(match: MatchState, eventUnitId: string): void {
  const eventUnit = match.eventUnits[eventUnitId];
  if (!eventUnit) {
    return;
  }
  if (match.eventRow[eventUnit.col] === eventUnitId) {
    match.eventRow[eventUnit.col] = null;
  }
  delete match.eventUnits[eventUnitId];
}

function healUnit(unit: UnitState, amount: number): number {
  if (amount <= 0) return 0;
  const before = unit.health;
  unit.health = Math.min(unit.maxHealth, unit.health + amount);
  return unit.health - before;
}

function addUnitShield(unit: UnitState, charges = 1): void {
  unit.shieldCharges = (unit.shieldCharges ?? 0) + Math.max(0, charges);
}

function resistanceLabel(kind: ResistanceKind): string {
  if (kind === "stun") return "stun";
  if (kind === "exposed") return "expose";
  return "attack-down";
}

function resistedDebuff(
  match: MatchState | undefined,
  unit: UnitState,
  kind: ResistanceKind,
  sourceLabel?: string,
): boolean {
  if (!match || !sourceLabel) {
    return false;
  }
  const chance = getResistanceChance(unit.cardId, kind);
  if (chance <= 0) {
    return false;
  }
  const roll = nextRoll(match, `resist:${kind}:${unit.id}:${sourceLabel}`);
  if (roll < chance) {
    pushLog(match, `${unit.name} resisted ${resistanceLabel(kind)} (${Math.round(chance * 100)}%).`);
    return true;
  }
  return false;
}

function stunUnitUntil(
  unit: UnitState,
  untilTurn: number,
  match?: MatchState,
  sourceLabel?: string,
): boolean {
  if (resistedDebuff(match, unit, "stun", sourceLabel)) {
    return false;
  }
  unit.stunnedUntilTurn = Math.max(unit.stunnedUntilTurn ?? 0, untilTurn);
  unit.cannotAttackUntilTurn = Math.max(unit.cannotAttackUntilTurn, untilTurn);
  return true;
}

function exposeUnitUntil(
  unit: UnitState,
  untilTurn: number,
  match?: MatchState,
  sourceLabel?: string,
): boolean {
  if (resistedDebuff(match, unit, "exposed", sourceLabel)) {
    return false;
  }
  unit.exposedUntilTurn = Math.max(unit.exposedUntilTurn ?? 0, untilTurn);
  return true;
}

function clearNegativeEffects(unit: UnitState, turn: number): number {
  let removed = 0;
  if ((unit.stunnedUntilTurn ?? 0) > turn) {
    unit.stunnedUntilTurn = turn;
    unit.cannotAttackUntilTurn = Math.min(unit.cannotAttackUntilTurn, turn);
    removed += 1;
  }
  if ((unit.exposedUntilTurn ?? -1) >= turn) {
    unit.exposedUntilTurn = undefined;
    removed += 1;
  }
  return removed;
}

function isUnitExposed(match: MatchState, unit: UnitState): boolean {
  return typeof unit.exposedUntilTurn === "number" && unit.exposedUntilTurn >= match.turn;
}

function applyUnitDamage(match: MatchState, unit: UnitState, damage: number, sourceLabel: string): number {
  if (damage <= 0) {
    return 0;
  }
  const shield = unit.shieldCharges ?? 0;
  if (shield > 0) {
    unit.shieldCharges = shield - 1;
    pushLog(match, `${unit.name} blocked ${sourceLabel} with shield.`);
    return 0;
  }
  unit.health -= damage;
  return damage;
}

function applyTemporaryAttackPenalty(
  match: MatchState,
  unit: UnitState,
  amount: number,
  untilTurn: number,
  sourceLabel: string,
): number {
  if (resistedDebuff(match, unit, "atk_down", sourceLabel)) {
    return 0;
  }
  const allowed = Math.max(0, (unit.attack ?? 0) - 1);
  const applied = Math.min(Math.max(0, amount), allowed);
  if (applied <= 0) {
    return 0;
  }

  unit.attack -= applied;
  unit.tempAttackPenalty = (unit.tempAttackPenalty ?? 0) + applied;
  unit.tempAttackPenaltyUntilTurn = Math.max(unit.tempAttackPenaltyUntilTurn ?? 0, untilTurn);
  pushLog(match, `${unit.name} lost ${applied} attack (${sourceLabel}) until turn ${untilTurn}.`);
  return applied;
}

function expireTemporaryAttackPenalties(match: MatchState): void {
  for (const unit of Object.values(match.units)) {
    const penalty = unit.tempAttackPenalty ?? 0;
    if (penalty <= 0) {
      continue;
    }
    if ((unit.tempAttackPenaltyUntilTurn ?? Number.POSITIVE_INFINITY) > match.turn) {
      continue;
    }

    unit.attack += penalty;
    pushLog(match, `${unit.name} recovered ${penalty} temporary attack.`);
    unit.tempAttackPenalty = undefined;
    unit.tempAttackPenaltyUntilTurn = undefined;
  }
}

function clearIronCurtainForSide(match: MatchState, side: PlayerSide): void {
  const player = match.players[side];
  if (!player.curtainEventId) {
    player.blockedLane = undefined;
    player.blockedCol = undefined;
    return;
  }
  const curtain = match.eventUnits[player.curtainEventId];
  if (curtain && curtain.kind === "iron_curtain") {
    removeEventUnit(match, curtain.id);
  }
  player.curtainEventId = undefined;
  player.blockedLane = undefined;
  player.blockedCol = undefined;
}

function listSideUnitIds(match: MatchState, side: PlayerSide, lane?: "front" | "back"): string[] {
  const board = match.players[side].board;
  if (lane) {
    return board[lane].filter((id): id is string => Boolean(id));
  }
  return [...board.front, ...board.back].filter((id): id is string => Boolean(id));
}

function unitFaction(unit: UnitState): FactionId | "neutral" | "utility" {
  return getCard(unit.cardId).faction;
}

function listFactionUnitIds(match: MatchState, side: PlayerSide, faction: FactionId): string[] {
  return listSideUnitIds(match, side).filter((id) => {
    const unit = match.units[id];
    return Boolean(unit) && unitFaction(unit as UnitState) === faction;
  });
}

function randomUnitId(match: MatchState, ids: string[], label: string): string | undefined {
  if (ids.length === 0) return undefined;
  return ids[Math.floor(nextRoll(match, label) * ids.length)] as string;
}
function hasExplicitUnitSkill(cardId: string): boolean {
  return EXPLICIT_UNIT_SKILL_IDS.has(cardId);
}

function applyFallbackUnitOnSummonSkill(match: MatchState, side: PlayerSide, unit: UnitState): void {
  const signature = getUnitSignatureProfile(unit.cardId);
  if (signature.kind === "entry-shield") {
    addUnitShield(unit, signature.valueA);
    pushLog(match, `${unit.name} signature: entered with ${signature.valueA} shield.`);
    return;
  }

  if (signature.kind === "entry-heal") {
    const allyId = pickLowestHealthUnitId(match, listSideUnitIds(match, side));
    if (!allyId) {
      return;
    }
    const ally = match.units[allyId];
    if (!ally) {
      return;
    }
    const healed = healUnit(ally, signature.valueA);
    if (healed > 0) {
      pushLog(match, `${unit.name} signature: healed ${ally.name} for ${healed}.`);
    }
  }
}

function applyFallbackUnitTurnStartSkill(match: MatchState, side: PlayerSide, unit: UnitState): void {
  const signature = getUnitSignatureProfile(unit.cardId);
  if (signature.kind === "turn-income") {
    match.players[side].shares += signature.valueA;
    pushLog(match, `${unit.name} signature: +${signature.valueA} shares.`);
    return;
  }

  if (signature.kind === "turn-cleanse") {
    const cleaned = clearNegativeEffects(unit, match.turn);
    const healed = healUnit(unit, signature.valueA);
    if (cleaned > 0 || healed > 0) {
      pushLog(match, `${unit.name} signature: cleanse ${cleaned}, heal ${healed}.`);
    }
  }
}

function applyFallbackUnitCombatSkill(
  match: MatchState,
  side: PlayerSide,
  attacker: UnitState,
  target: UnitState,
  targetDied: boolean,
  attackerDied: boolean,
): void {
  const signature = getUnitSignatureProfile(attacker.cardId);

  if (signature.kind === "combat-expose" && !targetDied) {
    exposeUnitUntil(target, match.turn + signature.valueA, match, `${attacker.name} signature expose`);
    pushLog(match, `${attacker.name} signature: exposed ${target.name}.`);
    return;
  }

  if (signature.kind === "combat-fee" && !attackerDied) {
    match.players[side].shares += signature.valueA;
    pushLog(match, `${attacker.name} signature: +${signature.valueA} shares on contact.`);
    return;
  }

  if (signature.kind === "combat-snowball" && !attackerDied) {
    attacker.attack += signature.valueA;
    pushLog(match, `${attacker.name} signature: +${signature.valueA} attack after combat.`);
  }
}

function applyRetailBacklash(match: MatchState, deadSide: PlayerSide, enemySide: PlayerSide): void {
  const enemyUnitIds = listSideUnitIds(match, enemySide);
  if (enemyUnitIds.length > 0) {
    const targetId = randomUnitId(match, enemyUnitIds, `retail:backlash:${deadSide}`);
    if (!targetId) return;
    const target = match.units[targetId];
    if (!target) return;
    const dealt = applyUnitDamage(match, target, 2, "retail backlash");
    pushLog(match, `Retail backlash: ${target.name} took ${dealt} damage.`);
    if (target.health <= 0) {
      removeUnit(match, target.id);
      pushLog(match, `${target.name} folded under meme pressure.`);
    }
    return;
  }

  dealDamageToLeader(match, enemySide, 2);
  pushLog(match, "Retail backlash nicked the enemy leader for 2.");
}

function applyUnitOnSummonSkill(match: MatchState, side: PlayerSide, unit: UnitState): void {
  const enemy = opponentOf(side);
  const enemyPlayer = match.players[enemy];
  const ownPlayer = match.players[side];
  const ownUnits = listSideUnitIds(match, side);
  const enemyUnits = listSideUnitIds(match, enemy);

  if (unit.traits.includes("rush")) {
    pushLog(match, `${unit.name} deployed with Rush and can attack immediately.`);
  }

  if (!hasActiveJudgeSkillContext(unit)) {
    pushLog(match, `${unit.name} is outside its Judge slot and acts as a stat-only unit.`);
    return;
  }

  if (unit.cardId === "guild_bailiff") {
    addUnitShield(unit, 1);
    pushLog(match, "Guild Bailiff entered with +1 shield.");
    return;
  }

  if (unit.cardId === "market_arbiter" && unit.lane === "back") {
    unit.attack += 1;
    pushLog(match, "Market Arbiter calibration: +1 attack from backline setup.");
    return;
  }

  if (unit.cardId === "settlement_liaison") {
    const damagedAllies = ownUnits.filter((id) => {
      const ally = match.units[id];
      return Boolean(ally) && (ally as UnitState).health < (ally as UnitState).maxHealth;
    });
    const targetId = pickLowestHealthUnitId(match, damagedAllies);
    if (!targetId) {
      pushLog(match, "Settlement Liaison entered: no ally needed immediate patching.");
      return;
    }
    const target = match.units[targetId];
    if (!target) {
      pushLog(match, "Settlement Liaison entered: patch target disappeared.");
      return;
    }
    const healed = healUnit(target, 1);
    pushLog(match, `Settlement Liaison entered: healed ${target.name} for ${healed}.`);
    return;
  }

  if (unit.cardId === "compliance_clerk") {
    const damaged = ownUnits.filter((id) => {
      const ally = match.units[id];
      return Boolean(ally) && (ally as UnitState).health < (ally as UnitState).maxHealth;
    });
    const healId = pickLowestHealthUnitId(match, damaged);
    if (healId) {
      const healTarget = match.units[healId];
      if (healTarget) {
        const healed = healUnit(healTarget, 2);
        const cleaned = clearNegativeEffects(healTarget, match.turn);
        pushLog(match, `Compliance Clerk patched ${healTarget.name}: healed ${healed}, cleansed ${cleaned} debuffs.`);
        return;
      }
    }
    pushLog(match, "Compliance Clerk found no damaged unit to patch.");
    return;
  }

  if (unit.cardId === "market_referee") {
    const dirtyEnemyIds = enemyUnits.filter((id) => {
      const enemyUnit = match.units[id];
      return Boolean(enemyUnit) && (enemyUnit as UnitState).traits.includes("dirty");
    });
    const targetId = randomUnitId(match, dirtyEnemyIds, "referee:summon:target");
    if (targetId) {
      const target = match.units[targetId];
      if (target) {
        stunUnitUntil(target, match.turn + 2, match, "Market Referee whistle");
        pushLog(match, `Market Referee whistled ${target.name}: stunned.`);
        return;
      }
    }
    pushLog(match, "Market Referee entered but found no dirty target.");
    return;
  }

  if (unit.cardId === "clearing_router") {
    const debuffedAllies = ownUnits.filter((id) => {
      const ally = match.units[id];
      return Boolean(ally) && (((ally as UnitState).stunnedUntilTurn ?? 0) > match.turn || ((ally as UnitState).exposedUntilTurn ?? -1) >= match.turn);
    });
    const cleanseId = randomUnitId(match, debuffedAllies, "router:summon:cleanse");
    if (cleanseId) {
      const cleanseTarget = match.units[cleanseId];
      if (cleanseTarget) {
        const cleaned = clearNegativeEffects(cleanseTarget, match.turn);
        const healed = healUnit(cleanseTarget, 1);
        pushLog(match, `Clearing Router rerouted ${cleanseTarget.name}: cleansed ${cleaned}, healed ${healed}.`);
        return;
      }
    }
    pushLog(match, "Clearing Router had no debuffed ally to reroute.");
    return;
  }

  if (unit.cardId === "public_defender") {
    addUnitShield(unit, 1);
    const allyId = randomUnitId(match, ownUnits.filter((id) => id !== unit.id), "public:defender:shield");
    if (allyId) {
      const ally = match.units[allyId];
      if (ally) {
        addUnitShield(ally, 1);
        pushLog(match, `Public Defender formed legal cover: ${unit.name} and ${ally.name} gained shield.`);
        return;
      }
    }
    pushLog(match, "Public Defender entered with +1 shield.");
    return;
  }

  if (unit.cardId === "investor_relations_chief") {
    ownPlayer.shares += 35;
    if (listFactionUnitIds(match, side, "wallstreet").length >= 3) {
      ownPlayer.favor = clamp(ownPlayer.favor + 1, -20, 20);
      pushLog(match, "Investor Relations spin cycle: +35 shares and +1 favor.");
      return;
    }
    pushLog(match, "Investor Relations spin cycle: +35 shares.");
    return;
  }

  if (unit.cardId === "clearing_knight") {
    const wallstreetFront = listSideUnitIds(match, side, "front").filter((id) => {
      const ally = match.units[id];
      return Boolean(ally) && unitFaction(ally as UnitState) === "wallstreet" && id !== unit.id;
    });
    if (wallstreetFront.length > 0) {
      unit.attack += 1;
      addUnitShield(unit, 1);
      pushLog(match, "Clearing Knight coordinated entry: +1 attack and +1 shield.");
    }
    return;
  }

  if (unit.cardId === "diamond_hand_captain") {
    addUnitShield(unit, 1);
    const retailAllies = listFactionUnitIds(match, side, "retail_mob").filter((id) => id !== unit.id);
    const allyId = randomUnitId(match, retailAllies, "retail:captain:escort");
    if (allyId) {
      const ally = match.units[allyId];
      if (ally) {
        addUnitShield(ally, 1);
        pushLog(match, `Diamond Hand Captain rallied ${ally.name}: both gained shield.`);
        return;
      }
    }
    pushLog(match, "Diamond Hand Captain entered with +1 shield.");
    return;
  }

  if (unit.cardId === "meme_berserker") {
    const ownCount = listSideUnitIds(match, side).length;
    const enemyCount = listSideUnitIds(match, enemy).length;
    if (enemyCount > ownCount) {
      unit.attack += 1;
      pushLog(match, "Meme Berserker went underdog mode: +1 attack.");
    }
    return;
  }

  if (unit.cardId === "meme_editor") {
    const exposedAllies = ownUnits.filter((id) => {
      const ally = match.units[id];
      return Boolean(ally) && ((ally as UnitState).exposedUntilTurn ?? -1) >= match.turn;
    });
    const targetId = randomUnitId(match, exposedAllies, "meme:editor:cleanse");
    if (targetId) {
      const target = match.units[targetId];
      if (target) {
        const cleaned = clearNegativeEffects(target, match.turn);
        target.attack += 1;
        pushLog(match, `Meme Editor refreshed ${target.name}: +1 attack, cleansed ${cleaned}.`);
        return;
      }
    }
    pushLog(match, "Meme Editor dropped morale packet (+no exposed target).");
    return;
  }

  if (unit.cardId === "roadshow_blade") {
    const wallstreetCount = listFactionUnitIds(match, side, "wallstreet").length;
    if (wallstreetCount >= 3) {
      unit.attack += 1;
      pushLog(match, "Roadshow Blade entered with momentum: +1 attack.");
    }
    return;
  }

  if (unit.cardId === "yolo_striker") {
    if (enemyUnits.length > ownUnits.length) {
      addUnitShield(unit, 1);
      pushLog(match, "YOLO Striker underdog shield: +1 shield.");
    }
    return;
  }

  if (unit.cardId === "panic_seller_agent") {
    const targetId = randomUnitId(match, enemyUnits, "panic:seller:summon");
    if (targetId) {
      const target = match.units[targetId];
      if (target) {
        exposeUnitUntil(target, match.turn + 2, match, "Panic Seller summon");
        pushLog(match, `Panic Seller Agent tagged ${target.name} as exposed.`);
      }
    }
    return;
  }

  if (unit.cardId === "rehypothecator") {
    addUnitShield(unit, 2);
    enemyPlayer.probation += 1;
    ownPlayer.favor = clamp(ownPlayer.favor - 1, -20, 20);
    pushLog(match, "Rehypothecator entered: +2 shield, enemy probation +1, own favor -1.");
    return;
  }

  if (unit.cardId === "bribe_courier" && isJudgeBadSlot(unit.lane, unit.col)) {
    enemyPlayer.judgeHostility += 1;
    pushLog(match, "Bribe Courier in blue Judge slot: enemy Judge hostility +1.");
    return;
  }

  if (unit.cardId === "fud_negotiator" && isJudgeBadSlot(unit.lane, unit.col)) {
    enemyPlayer.probation += 1;
    enemyPlayer.favor = clamp(enemyPlayer.favor - 1, -20, 20);
    pushLog(match, "FUD Negotiator entered blue Judge slot: enemy probation +1 and favor -1.");
    return;
  }

  if (!hasExplicitUnitSkill(unit.cardId)) {
    applyFallbackUnitOnSummonSkill(match, side, unit);
  }
}

function applyFactionOnSummon(match: MatchState, side: PlayerSide, unit: UnitState): void {
  const faction = unitFaction(unit);
  const player = match.players[side];
  const enemy = opponentOf(side);

  if (faction === "sec") {
    const secAllies = listFactionUnitIds(match, side, "sec");
    if ((unit.traits.includes("prosecutor") || unit.traits.includes("negotiator")) && secAllies.length >= 2) {
      unit.maxHealth += 1;
      unit.health += 1;
      pushLog(match, `SEC network: ${unit.name} entered with +1 HP.`);
    }
    if (isJudgeGoodSlot(unit.lane, unit.col) && (unit.traits.includes("prosecutor") || unit.traits.includes("negotiator"))) {
      player.favor = clamp(player.favor + 1, -20, 20);
      player.shares += 30;
      pushLog(match, `SEC hearing room bonus: +1 favor and +30 shares.`);
    }
    applyUnitOnSummonSkill(match, side, unit);
    return;
  }

  if (faction === "market_makers") {
    if (unit.lane === "back" && (unit.traits.includes("ranged") || unit.traits.includes("back_only"))) {
      player.shares += 10;
      pushLog(match, `Maker rebate: ${unit.name} refunded +10 shares.`);
    }
    const lanePeers = listSideUnitIds(match, side, unit.lane).filter((id) => id !== unit.id).filter((id) => {
      const peer = match.units[id];
      return Boolean(peer) && unitFaction(peer as UnitState) === "market_makers";
    });
    if (lanePeers.length > 0) {
      unit.attack += 1;
      pushLog(match, `Spread pairing: ${unit.name} gained +1 attack.`);
    }
    applyUnitOnSummonSkill(match, side, unit);
    return;
  }

  if (faction === "wallstreet") {
    const frontWallstreet = listSideUnitIds(match, side, "front").filter((id) => {
      const ally = match.units[id];
      return Boolean(ally) && unitFaction(ally as UnitState) === "wallstreet";
    });
    if (unit.lane === "front" && frontWallstreet.length >= 2) {
      unit.attack += 1;
      unit.maxHealth += 1;
      unit.health += 1;
      pushLog(match, `Deal desk momentum: ${unit.name} gained +1/+1.`);
    }
    applyUnitOnSummonSkill(match, side, unit);
    return;
  }

  if (faction === "retail_mob") {
    const retailAllies = listFactionUnitIds(match, side, "retail_mob");
    if (retailAllies.length >= 3) {
      unit.attack += 1;
      pushLog(match, `Crowd surge: ${unit.name} gained +1 attack.`);
    }
    applyUnitOnSummonSkill(match, side, unit);
    return;
  }

  if (faction === "short_hedgefund") {
    if (unit.traits.includes("dirty")) {
      match.players[enemy].probation += 1;
      player.favor = clamp(player.favor - 1, -20, 20);
      match.judgeMood = clamp(match.judgeMood + 1, -5, 5);
      pushLog(match, `Short desk pressure: enemy probation +1, Judge mood worsened.`);
    }
    if (isJudgeBadSlot(unit.lane, unit.col)) {
      match.players[enemy].judgeHostility += 1;
      pushLog(match, `Blue-slot whisper campaign: enemy judge hostility +1.`);
    }
    applyUnitOnSummonSkill(match, side, unit);
  }
}

function applyUnitTurnStartSkills(match: MatchState, side: PlayerSide): void {
  const player = match.players[side];
  const enemy = opponentOf(side);
  const enemyPlayer = match.players[enemy];
  const ownUnits = listSideUnitIds(match, side);
  const enemyUnits = listSideUnitIds(match, enemy);

  let civicAuditorProcs = 0;
  for (const id of ownUnits) {
    const unit = match.units[id];
    if (!unit) continue;

    if (!hasActiveJudgeSkillContext(unit)) {
      continue;
    }

    if (unit.cardId === "civic_auditor" && civicAuditorProcs < 2) {
      const tax = Math.min(25, enemyPlayer.shares);
      enemyPlayer.shares -= tax;
      enemyPlayer.probation += 1;
      civicAuditorProcs += 1;
      pushLog(match, `Civic Auditor pressure: enemy -${tax} shares and +1 probation.`);
      continue;
    }

    if (unit.cardId === "compliance_clerk") {
      const damagedAllies = ownUnits.filter((id) => {
        const ally = match.units[id];
        return Boolean(ally) && (ally as UnitState).health < (ally as UnitState).maxHealth;
      });
      const targetId = pickLowestHealthUnitId(match, damagedAllies);
      if (targetId) {
        const target = match.units[targetId];
        if (target) {
          const healed = healUnit(target, 2);
          const cleaned = clearNegativeEffects(target, match.turn);
          pushLog(match, `Compliance Clerk upkeep: ${target.name} healed ${healed}, cleansed ${cleaned}.`);
          continue;
        }
      }
    }

    if (unit.cardId === "clearing_router") {
      const debuffedAllies = ownUnits.filter((id) => {
        const ally = match.units[id];
        return Boolean(ally) && (((ally as UnitState).stunnedUntilTurn ?? 0) > match.turn || ((ally as UnitState).exposedUntilTurn ?? -1) >= match.turn);
      });
      const targetId = randomUnitId(match, debuffedAllies, "router:turn:cleanse");
      if (targetId) {
        const target = match.units[targetId];
        if (target) {
          const cleaned = clearNegativeEffects(target, match.turn);
          pushLog(match, `Clearing Router upkeep: cleansed ${target.name} (${cleaned} statuses).`);
          continue;
        }
      }
    }

    if (unit.cardId === "syndicate_baron" && unit.lane === "front") {
      player.shares += 20;
      pushLog(match, "Syndicate Baron fee stream: +20 shares.");
      continue;
    }

    if (unit.cardId === "public_defender") {
      const healed = Math.min(1, player.leader.maxHp - player.leader.hp);
      if (healed > 0) {
        player.leader.hp += healed;
      }
      const debuffedAllies = ownUnits.filter((id) => {
        const ally = match.units[id];
        return Boolean(ally) && ((ally as UnitState).stunnedUntilTurn ?? 0) > match.turn;
      });
      const targetId = randomUnitId(match, debuffedAllies, "public:defender:cleanse");
      if (targetId) {
        const target = match.units[targetId];
        if (target) {
          const cleaned = clearNegativeEffects(target, match.turn);
          pushLog(match, `Public Defender upkeep: leader +${healed} HP, ${target.name} cleansed (${cleaned}).`);
          continue;
        }
      }
      if (healed > 0) {
        pushLog(match, `Public Defender upkeep: leader +${healed} HP.`);
      }
      continue;
    }

    if (unit.cardId === "settlement_liaison") {
      const woundedAllies = ownUnits.filter((candidateId) => {
        const ally = match.units[candidateId];
        return Boolean(ally) && (ally as UnitState).health < (ally as UnitState).maxHealth;
      });
      const healTargetId = randomUnitId(match, woundedAllies, "liaison:upkeep:heal");
      let healText = "no ally needed healing";
      if (healTargetId) {
        const healTarget = match.units[healTargetId];
        if (healTarget) {
          const healed = healUnit(healTarget, 1);
          healText = `healed ${healTarget.name} for ${healed}`;
        }
      }
      if (isJudgeGoodSlot(unit.lane, unit.col)) {
        player.favor = clamp(player.favor + 1, -20, 20);
        pushLog(match, `Settlement Liaison upkeep (green Judge slot): +1 favor, ${healText}.`);
      } else {
        pushLog(match, `Settlement Liaison upkeep: ${healText}.`);
      }
      continue;
    }

    if (unit.cardId === "floor_mediator") {
      if (isJudgeGoodSlot(unit.lane, unit.col)) {
        match.judgeMood = clamp(match.judgeMood - 1, -5, 5);
        enemyPlayer.favor = clamp(enemyPlayer.favor - 1, -20, 20);
        pushLog(match, "Floor Mediator hearing cycle: Judge mood improved, enemy favor -1.");
      }
      continue;
    }

    if (unit.cardId === "fud_negotiator") {
      if (isJudgeBadSlot(unit.lane, unit.col)) {
        enemyPlayer.favor = clamp(enemyPlayer.favor - 1, -20, 20);
        enemyPlayer.probation += 1;
        match.judgeMood = clamp(match.judgeMood + 1, -5, 5);
        pushLog(match, "FUD Negotiator pressure cycle: enemy favor -1, enemy probation +1, Judge mood worsened.");
      }
      continue;
    }

    if (unit.cardId === "investor_relations_chief") {
      const gain = Math.min(30, 10 + listFactionUnitIds(match, side, "wallstreet").length * 4);
      player.shares += gain;
      pushLog(match, `Investor Relations narrative cycle: +${gain} shares.`);
      continue;
    }

    if (unit.cardId === "retail_rebel" && ownUnits.length < enemyUnits.length) {
      unit.attack += 1;
      pushLog(match, "Retail Rebel comeback: +1 attack.");
      continue;
    }

    if (unit.cardId === "meme_editor") {
      const targetId = randomUnitId(match, ownUnits, "meme:editor:buff");
      if (targetId) {
        const target = match.units[targetId];
        if (target) {
          target.attack += 1;
          const cleaned = clearNegativeEffects(target, match.turn);
          pushLog(match, `Meme Editor upkeep: ${target.name} +1 attack, cleansed ${cleaned}.`);
          continue;
        }
      }
    }

    if (unit.cardId === "discord_moderator" && player.probation > 0) {
      player.probation = Math.max(0, player.probation - 1);
      pushLog(match, "Discord Moderator cleanup: -1 own probation.");
      continue;
    }

    if (unit.cardId === "doom_researcher") {
      const targetId = randomUnitId(match, enemyUnits, "short:doom:expose");
      if (targetId) {
        const target = match.units[targetId];
        if (target) {
          exposeUnitUntil(target, match.turn + 1, match, "Doom Researcher");
          pushLog(match, `Doom Researcher exposed ${target.name}.`);
        }
      }
      continue;
    }

    if (unit.cardId === "borrow_rate_whisperer") {
      const siphon = Math.min(25, enemyPlayer.shares);
      enemyPlayer.shares -= siphon;
      player.shares += siphon;
      pushLog(match, `Borrow Rate Whisperer carry: siphoned ${siphon} shares.`);
      continue;
    }

    if (!hasExplicitUnitSkill(unit.cardId)) {
      applyFallbackUnitTurnStartSkill(match, side, unit);
    }
  }
}

function applyFactionTurnStart(match: MatchState, side: PlayerSide): void {
  const player = match.players[side];
  const enemy = opponentOf(side);
  const enemyPlayer = match.players[enemy];

  const secUnits = listFactionUnitIds(match, side, "sec");
  if (secUnits.length > 0) {
    const prosecutors = secUnits.filter((id) => {
      const unit = match.units[id];
      return Boolean(unit) && (unit as UnitState).traits.includes("prosecutor");
    }).length;
    const stipend = Math.min(80, prosecutors * 20);
    if (stipend > 0) {
      player.shares += stipend;
      pushLog(match, `SEC audit stipend: +${stipend} shares.`);
    }
    const greenJudgeSec = secUnits.find((id) => {
      const unit = match.units[id];
      return Boolean(unit) && isJudgeGoodSlot((unit as UnitState).lane, (unit as UnitState).col);
    });
    if (greenJudgeSec) {
      player.favor = clamp(player.favor + 1, -20, 20);
      player.shares += 30;
      const pressure = Math.min(30, enemyPlayer.shares);
      enemyPlayer.shares -= pressure;
      enemyPlayer.probation += 1;
      pushLog(match, `SEC hearing leverage: +1 favor, +30 shares, enemy probation +1, enemy -${pressure} shares.`);
    }

    const enemyMakerUnits = listFactionUnitIds(match, enemy, "market_makers").length;
    if (enemyMakerUnits >= 2) {
      const auditDrain = Math.min(enemyPlayer.shares, 4 + enemyMakerUnits);
      enemyPlayer.shares -= auditDrain;
      pushLog(match, `SEC maker audit: drained ${auditDrain} shares from Market Makers.`);
    }
  }

  const makerFront = listSideUnitIds(match, side, "front").filter((id) => {
    const unit = match.units[id];
    return Boolean(unit) && unitFaction(unit as UnitState) === "market_makers";
  });
  const makerBack = listSideUnitIds(match, side, "back").filter((id) => {
    const unit = match.units[id];
    return Boolean(unit) && unitFaction(unit as UnitState) === "market_makers";
  });
  if (makerFront.length >= 2 && makerBack.length >= 2) {
    player.shares += 15;
    const boostId = randomUnitId(match, makerBack, "maker:start:boost");
    if (boostId && match.units[boostId]) {
      match.units[boostId].attack += 1;
    }
    pushLog(match, "Market-making spread engine: +15 shares and one backliner gained +1 attack.");
  }

  const wallstreetFront = listSideUnitIds(match, side, "front").filter((id) => {
    const unit = match.units[id];
    return Boolean(unit) && unitFaction(unit as UnitState) === "wallstreet";
  });
  const wallstreetTotal = listFactionUnitIds(match, side, "wallstreet");
  if (wallstreetFront.length >= 2) {
    const bolsterId = randomUnitId(match, wallstreetFront, "wallstreet:start:bolster");
    if (bolsterId && match.units[bolsterId]) {
      match.units[bolsterId].attack += 1;
    }
    pushLog(match, "Wallstreet structure: frontline gained +1 attack.");
  }
  if (wallstreetTotal.length >= 3) {
    player.shares += 20;
    pushLog(match, "Wallstreet fee stream: +20 shares.");
  }

  const retailUnits = listFactionUnitIds(match, side, "retail_mob");
  const ownUnits = listSideUnitIds(match, side).length;
  const enemyUnits = listSideUnitIds(match, enemy).length;
  if (retailUnits.length > 0 && ownUnits <= enemyUnits) {
    const hypeId = randomUnitId(match, retailUnits, "retail:start:hype");
    if (hypeId && match.units[hypeId]) {
      match.units[hypeId].attack += 1;
      if (enemyUnits - ownUnits >= 2) {
        addUnitShield(match.units[hypeId], 1);
      }
    }
    player.shares += 15;
    pushLog(match, "Retail hype cycle: +1 attack (and shield when outnumbered hard) and +15 shares.");
  }
  if (retailUnits.length >= 4) {
    player.shares += 25;
    pushLog(match, "Crowdfunded momentum: +25 shares.");
  }

  const shortUnits = listFactionUnitIds(match, side, "short_hedgefund");
  const dirtyShort = shortUnits.filter((id) => {
    const unit = match.units[id];
    return Boolean(unit) && (unit as UnitState).traits.includes("dirty");
  });
  if (dirtyShort.length >= 2) {
    const siphon = Math.min(enemyPlayer.shares, 6 + dirtyShort.length * 3);
    enemyPlayer.shares -= siphon;
    player.shares += siphon;
    pushLog(match, `Short borrow carry: siphoned ${siphon} shares.`);
  }
  if (dirtyShort.length >= 3) {
    match.judgeMood = clamp(match.judgeMood + 1, -5, 5);
    player.favor = clamp(player.favor - 1, -20, 20);
    pushLog(match, "Judge annoyance increased by short desk noise (and own favor -1).");
  }

  applyUnitTurnStartSkills(match, side);
}

function applyFactionCombatHooks(
  match: MatchState,
  side: PlayerSide,
  attacker: UnitState,
  target: UnitState,
  targetDied: boolean,
  attackerDied: boolean,
): void {
  const enemy = opponentOf(side);
  const attackerFaction = unitFaction(attacker);
  const targetFaction = unitFaction(target);
  const activeJudgeSkillContext = hasActiveJudgeSkillContext(attacker);

  if (attackerFaction === "market_makers" && attacker.lane === "back" && (attacker.traits.includes("ranged") || attacker.traits.includes("back_only"))) {
    match.players[side].shares += 8;
    pushLog(match, `Maker execution rebate: ${attacker.name} generated +8 shares.`);
  }

  if (attackerFaction === "sec" && target.traits.includes("dirty") && !attackerDied) {
    match.players[side].shares += 12;
    match.players[target.owner].probation += 1;
    pushLog(match, `SEC enforcement bonus: ${attacker.name} extracted +12 shares and raised enemy probation.`);
  }

  if (attackerFaction === "short_hedgefund" && attacker.traits.includes("dirty") && !targetDied && target.health > 0) {
    target.attack = Math.max(1, target.attack - 1);
    pushLog(match, `Short smear: ${target.name} lost 1 attack.`);
  }

  if (targetDied && attackerFaction === "wallstreet") {
    match.players[side].shares += 40;
    pushLog(match, "Wallstreet deal fee: +40 shares on takedown.");
  }

  if (targetDied && targetFaction === "retail_mob") {
    applyRetailBacklash(match, target.owner, side);
  }

  if (attackerDied && attackerFaction === "retail_mob") {
    applyRetailBacklash(match, side, enemy);
  }

  if (activeJudgeSkillContext && attacker.cardId === "halt_marshall" && !targetDied) {
    stunUnitUntil(target, match.turn + 2, match, "Halt Marshall hit");
    pushLog(match, `Halt Marshall locked ${target.name}: stunned.`);
  }

  if (activeJudgeSkillContext && attacker.cardId === "market_arbiter") {
    const payout = Math.min(30, attacker.attack * 10);
    match.players[side].shares += payout;
    pushLog(match, `Market Arbiter arbitration fee: +${payout} shares.`);
  }

  if (activeJudgeSkillContext && attacker.cardId === "spread_sniper" && !targetDied) {
    exposeUnitUntil(target, match.turn + 2, match, "Spread Sniper hit");
    pushLog(match, `Spread Sniper exposed ${target.name}.`);
  }

  if (activeJudgeSkillContext && attacker.cardId === "clearing_knight" && targetDied && !attackerDied) {
    attacker.attack += 1;
    pushLog(match, "Clearing Knight chain-clear: +1 attack.");
  }

  if (activeJudgeSkillContext && attacker.cardId === "meme_berserker" && !attackerDied) {
    attacker.attack += 1;
    pushLog(match, "Meme Berserker snowball: +1 attack.");
  }

  if (activeJudgeSkillContext && attacker.cardId === "whisper_lobbyist" && !targetDied) {
    exposeUnitUntil(target, match.turn + 2, match, "Whisper Lobbyist hit");
    pushLog(match, `Whisper Lobbyist marked ${target.name} as exposed.`);
  }

  if (activeJudgeSkillContext && attacker.cardId === "ftd_collector" && targetDied) {
    match.players[side].shares += 70;
    pushLog(match, "FTD Collector fee extraction: +70 shares.");
  }

  if (activeJudgeSkillContext && attacker.cardId === "narrative_assassin" && !targetDied) {
    target.attack = Math.max(1, target.attack - 1);
    pushLog(match, `Narrative Assassin pressure: ${target.name} lost 1 attack.`);
    return;
  }

  if (activeJudgeSkillContext && !hasExplicitUnitSkill(attacker.cardId)) {
    applyFallbackUnitCombatSkill(match, side, attacker, target, targetDied, attackerDied);
  }
}

type LeaderFrontShield = {
  frontCount: number;
  blocked: boolean;
  damagePenalty: number;
};

function leaderFrontShield(match: MatchState, attackerSide: PlayerSide): LeaderFrontShield {
  const enemy = opponentOf(attackerSide);
  const frontCount = listSideUnitIds(match, enemy, "front").length;
  if (frontCount >= 3) {
    return {
      frontCount,
      blocked: true,
      damagePenalty: 0,
    };
  }

  return {
    frontCount,
    blocked: false,
    damagePenalty: frontCount <= 0 ? 0 : frontCount === 1 ? 1 : 2,
  };
}

function canReachBackline(attacker: UnitState): boolean {
  return attacker.traits.includes("ranged") || attacker.traits.includes("reach");
}

function isJudgeGoodSlot(lane: "front" | "back", col: number): boolean {
  return lane === "front" && col === JUDGE_COL;
}

function isJudgeBadSlot(lane: "front" | "back", col: number): boolean {
  return lane === "back" && col === JUDGE_COL;
}

function isPositiveJudgeCard(cardId: string): boolean {
  return isJudgePositiveSpecialistCard(cardId);
}

function isCorruptJudgeCard(cardId: string): boolean {
  return isJudgeCorruptSpecialistCard(cardId);
}

function isBlueJudgeUnit(unit: UnitState): boolean {
  return isJudgeBadSlot(unit.lane, unit.col);
}

function isGreenJudgeUnit(unit: UnitState): boolean {
  return isJudgeGoodSlot(unit.lane, unit.col);
}

function hasActiveJudgeSkillContext(unit: UnitState): boolean {
  if (!isJudgeSpecialistCard(unit.cardId)) {
    return true;
  }
  if (isJudgeGoodSlot(unit.lane, unit.col) && isJudgePositiveSpecialistCard(unit.cardId)) {
    return true;
  }
  if (isJudgeBadSlot(unit.lane, unit.col) && isJudgeCorruptSpecialistCard(unit.cardId)) {
    return true;
  }
  return false;
}

function preferredJudgeLaneForUnit(unit: UnitState): "front" | "back" | undefined {
  const canGreen = isJudgePositiveSpecialistCard(unit.cardId);
  const canBlue = isJudgeCorruptSpecialistCard(unit.cardId);
  if (canGreen && canBlue) {
    return unit.lane === "front" ? "front" : "back";
  }
  if (canGreen) {
    return "front";
  }
  if (canBlue) {
    return "back";
  }
  return undefined;
}

function findJudgeRepositionLane(match: MatchState, side: PlayerSide, unit: UnitState): "front" | "back" | undefined {
  const canGreen = isJudgePositiveSpecialistCard(unit.cardId);
  const canBlue = isJudgeCorruptSpecialistCard(unit.cardId);
  if (!canGreen && !canBlue) {
    return undefined;
  }

  const preferredLane = preferredJudgeLaneForUnit(unit);
  const candidates: Array<"front" | "back"> = [];

  if (preferredLane === "front" && canGreen) {
    candidates.push("front");
  }
  if (preferredLane === "back" && canBlue) {
    candidates.push("back");
  }
  if (canGreen && !candidates.includes("front")) {
    candidates.push("front");
  }
  if (canBlue && !candidates.includes("back")) {
    candidates.push("back");
  }

  for (const lane of candidates) {
    if (lane === unit.lane && unit.col === JUDGE_COL) {
      continue;
    }
    if (match.players[side].board[lane][JUDGE_COL] === null) {
      return lane;
    }
  }

  return undefined;
}

function judgeSlotUnit(match: MatchState, side: PlayerSide, lane: "front" | "back"): UnitState | undefined {
  const unitId = match.players[side].board[lane][JUDGE_COL];
  if (!unitId) {
    return undefined;
  }
  return match.units[unitId];
}

function applyJudgePrimaryEffect(
  match: MatchState,
  targetSide: PlayerSide,
  effect: JudgePrimaryEffect,
  sourceLabel: string,
): string {
  const targetId = pickHighestAttackUnitId(match, listSideUnitIds(match, targetSide));
  if (!targetId) {
    return "no target unit";
  }

  const target = match.units[targetId];
  if (!target) {
    return "no target unit";
  }

  if (effect === "stun") {
    stunUnitUntil(target, match.turn + 2, match, sourceLabel);
    return `${target.name} stunned`;
  }

  if (effect === "atk_down") {
    const reduced = applyTemporaryAttackPenalty(match, target, 1, match.turn + 2, sourceLabel);
    if (reduced > 0) {
      return `${target.name} -1 attack`;
    }
    return `${target.name} resisted attack down`;
  }

  if (effect === "expose") {
    exposeUnitUntil(target, match.turn + 1, match, sourceLabel);
    return `${target.name} exposed`;
  }

  const dealt = applyUnitDamage(match, target, 1, sourceLabel);
  if (target.health <= 0) {
    removeUnit(match, target.id);
    return `${target.name} took ${dealt} damage and collapsed`;
  }
  return `${target.name} took ${dealt} damage`;
}

function applyJudgeSupportEffect(
  match: MatchState,
  side: PlayerSide,
  sourceUnitId: string,
  effect: JudgeSupportEffect,
  sourceLabel: string,
): string {
  const allyIds = listSideUnitIds(match, side).filter((id) => id !== sourceUnitId);

  if (effect === "heal") {
    const damagedAllyIds = allyIds.filter((id) => {
      const ally = match.units[id];
      return Boolean(ally) && (ally as UnitState).health < (ally as UnitState).maxHealth;
    });
    const healId = pickLowestHealthUnitId(match, damagedAllyIds);
    if (!healId) {
      return "no damaged ally to heal";
    }
    const healTarget = match.units[healId];
    if (!healTarget) {
      return "no damaged ally to heal";
    }
    const healed = healUnit(healTarget, 1);
    return `healed ${healTarget.name} by ${healed}`;
  }

  if (effect === "ready") {
    const readyCandidates = allyIds.filter((id) => {
      const ally = match.units[id];
      if (!ally) return false;
      if ((ally.stunnedUntilTurn ?? 0) > match.turn) return false;
      return ally.cannotAttackUntilTurn > match.turn;
    });
    const readyId = randomUnitId(match, readyCandidates, `${sourceLabel}:ready`);
    if (!readyId) {
      return "no ally needed fast-track";
    }
    const readyUnit = match.units[readyId];
    if (!readyUnit) {
      return "no ally needed fast-track";
    }
    readyUnit.cannotAttackUntilTurn = match.turn;
    return `readied ${readyUnit.name}`;
  }

  const shieldTargets = [sourceUnitId, ...allyIds];
  const shieldId = randomUnitId(match, shieldTargets, `${sourceLabel}:shield`) ?? sourceUnitId;
  const shieldTarget = match.units[shieldId];
  if (!shieldTarget) {
    return "no ally received shield";
  }
  addUnitShield(shieldTarget, 1);
  return `${shieldTarget.name} gained shield`;
}

function applyJudgeBlueRider(match: MatchState, targetSide: PlayerSide, rider: JudgeBlueRider): string {
  const target = match.players[targetSide];
  if (rider === "favor_down") {
    target.favor = clamp(target.favor - 1, -20, 20);
    return "enemy favor -1";
  }
  if (rider === "probation_up") {
    target.probation += 1;
    return "enemy probation +1";
  }
  target.favor = clamp(target.favor - 1, -20, 20);
  target.probation += 1;
  return "enemy favor -1, probation +1";
}

function applyJudgeOwnerCombo(
  match: MatchState,
  side: PlayerSide,
  greenUnit: UnitState,
  blueUnit: UnitState,
): void {
  const enemy = opponentOf(side);
  const player = match.players[side];
  const enemyPlayer = match.players[enemy];
  const comboRoll = stableHash(`judge:combo:${greenUnit.cardId}:${blueUnit.cardId}`) % 5;

  if (comboRoll === 0) {
    const siphon = Math.min(55, enemyPlayer.shares);
    const keep = Math.floor(siphon * 0.6);
    enemyPlayer.shares -= siphon;
    player.shares += keep;
    enemyPlayer.probation += 1;
    pushLog(
      match,
      `Judge duo combo [fee loop]: ${greenUnit.name}+${blueUnit.name} drained ${siphon} shares (kept ${keep}) and enemy probation +1.`,
    );
    return;
  }

  if (comboRoll === 1) {
    addUnitShield(greenUnit, 1);
    addUnitShield(blueUnit, 1);
    const healTargetId = randomUnitId(match, listSideUnitIds(match, side), "judge:combo:heal");
    let healText = "no ally healed";
    if (healTargetId) {
      const healTarget = match.units[healTargetId];
      if (healTarget) {
        const healed = healUnit(healTarget, 1);
        healText = `${healTarget.name} healed by ${healed}`;
      }
    }
    pushLog(
      match,
      `Judge duo combo [protective order]: both Judge specialists gained shield; ${healText}.`,
    );
    return;
  }

  if (comboRoll === 2) {
    const targetId = pickHighestAttackUnitId(match, listSideUnitIds(match, enemy));
    if (!targetId) {
      enemyPlayer.favor = clamp(enemyPlayer.favor - 1, -20, 20);
      pushLog(match, `Judge duo combo [injunction lock]: no unit target, enemy favor -1.`);
      return;
    }
    const target = match.units[targetId];
    if (!target) {
      enemyPlayer.favor = clamp(enemyPlayer.favor - 1, -20, 20);
      pushLog(match, `Judge duo combo [injunction lock]: no unit target, enemy favor -1.`);
      return;
    }
    stunUnitUntil(target, match.turn + 2, match, "Judge combo injunction");
    pushLog(match, `Judge duo combo [injunction lock]: ${target.name} stunned.`);
    return;
  }

  if (comboRoll === 3) {
    const targetId = randomUnitId(match, listSideUnitIds(match, enemy), "judge:combo:expose");
    if (!targetId) {
      enemyPlayer.probation += 1;
      pushLog(match, "Judge duo combo [narrative hit]: no unit target, enemy probation +1.");
      return;
    }
    const target = match.units[targetId];
    if (!target) {
      enemyPlayer.probation += 1;
      pushLog(match, "Judge duo combo [narrative hit]: no unit target, enemy probation +1.");
      return;
    }
    exposeUnitUntil(target, match.turn + 1, match, "Judge combo narrative");
    const reduced = applyTemporaryAttackPenalty(match, target, 1, match.turn + 2, "Judge combo narrative");
    pushLog(match, `Judge duo combo [narrative hit]: ${target.name} exposed and attack reduced by ${reduced}.`);
    return;
  }

  player.favor = clamp(player.favor + 1, -20, 20);
  player.probation = Math.max(0, player.probation - 1);
  player.shares += 35;
  pushLog(match, "Judge duo combo [settlement engine]: +35 shares, +1 favor, -1 probation.");
}

function applyJudgeLaneInfluence(match: MatchState, activeSide: PlayerSide): void {
  const enemySide = opponentOf(activeSide);
  const activePlayer = match.players[activeSide];
  const enemyPlayer = match.players[enemySide];

  const ownGreen = judgeSlotUnit(match, activeSide, "front");
  const ownBlue = judgeSlotUnit(match, activeSide, "back");
  const greenProfile = ownGreen ? getJudgeSpecialistProfile(ownGreen.cardId).green : undefined;
  const blueProfileOwn = ownBlue ? getJudgeSpecialistProfile(ownBlue.cardId).blue : undefined;

  if (ownGreen && greenProfile && ownBlue && blueProfileOwn) {
    applyJudgeOwnerCombo(match, activeSide, ownGreen, ownBlue);
  }

  if (ownGreen && greenProfile) {
    activePlayer.favor = clamp(activePlayer.favor + 1, -20, 20);
    match.judgeMood = clamp(match.judgeMood - 1, -5, 5);

    const legalFee = Math.min(
      enemyPlayer.shares,
      greenProfile.feeBase + ownGreen.attack * greenProfile.feeScale,
    );
    const rebate = Math.floor((legalFee * greenProfile.rebatePct) / 100);
    enemyPlayer.shares -= legalFee;
    activePlayer.shares += rebate;

    const controlOutcome = applyJudgePrimaryEffect(
      match,
      enemySide,
      greenProfile.primary,
      `${ownGreen.name} judge-green control`,
    );
    const supportOutcome = applyJudgeSupportEffect(
      match,
      activeSide,
      ownGreen.id,
      greenProfile.support,
      `${ownGreen.name} judge-green support`,
    );

    let probationText = "";
    if (greenProfile.probationBonus) {
      enemyPlayer.probation += 1;
      probationText = "; enemy probation +1";
    }

    pushLog(
      match,
      `Judge green control: ${ownGreen.name} extracted ${legalFee} shares (rebate ${rebate}); ${controlOutcome}; ${supportOutcome}${probationText}.`,
    );
  }

  const enemyBlue = judgeSlotUnit(match, enemySide, "back");
  const blueProfile = enemyBlue ? getJudgeSpecialistProfile(enemyBlue.cardId).blue : undefined;
  if (enemyBlue && blueProfile) {
    const tax = Math.min(
      activePlayer.shares,
      blueProfile.taxBase + enemyBlue.attack * blueProfile.taxScale,
    );
    const skimmed = Math.floor((tax * blueProfile.skimPct) / 100);
    activePlayer.shares -= tax;
    enemyPlayer.shares += skimmed;
    activePlayer.probation += 1;
    match.judgeMood = clamp(match.judgeMood + 1, -5, 5);

    const coercionOutcome = applyJudgePrimaryEffect(
      match,
      activeSide,
      blueProfile.coercion,
      `${enemyBlue.name} judge-blue coercion`,
    );
    const riderOutcome = applyJudgeBlueRider(match, activeSide, blueProfile.rider);

    pushLog(
      match,
      `Judge blue corruption: ${enemyBlue.name} siphoned ${tax} shares (kept ${skimmed}); ${coercionOutcome}; ${riderOutcome}.`,
    );
  }
}

function interactWithJudge(match: MatchState, side: PlayerSide, attacker: UnitState): MatchActionResult {
  const enemy = opponentOf(side);

  if (!(isBlueJudgeUnit(attacker) || isGreenJudgeUnit(attacker))) {
    return { ok: false, error: "Only units in judge slots can interact with Judge.", match };
  }

  if (isGreenJudgeUnit(attacker)) {
    const p = match.players[side];
    const greenProfile = getJudgeSpecialistProfile(attacker.cardId).green;
    if (!greenProfile) {
      return { ok: false, error: "This unit has no Judge-green petition package.", match };
    }
    p.favor = clamp(p.favor + 2, -20, 20);
    p.probation = Math.max(0, p.probation - 1);
    match.judgeMood = clamp(match.judgeMood - 1, -5, 5);

    const petitionOutcome = applyJudgePrimaryEffect(
      match,
      enemy,
      greenProfile.petitionPrimary,
      `${attacker.name} judge petition`,
    );
    const supportOutcome = applyJudgeSupportEffect(
      match,
      side,
      attacker.id,
      greenProfile.petitionSupport,
      `${attacker.name} judge petition`,
    );

    let probationText = "";
    if (greenProfile.probationBonus) {
      match.players[enemy].probation += 1;
      probationText = "; enemy probation +1";
    }

    pushLog(
      match,
      `${attacker.name} petitioned the Judge: +2 favor, -1 probation; ${petitionOutcome}; ${supportOutcome}${probationText}.`,
    );
    return { ok: true, match };
  }

  const p = match.players[side];
  const blueProfile = getJudgeSpecialistProfile(attacker.cardId).blue;
  if (!blueProfile) {
    return { ok: false, error: "This unit has no Judge-blue bribe package.", match };
  }
  if (p.shares < 60) {
    return { ok: false, error: "Not enough shares to bribe the Judge (60).", match };
  }

  p.shares -= 60;
  const enemyPlayer = match.players[enemy];
  match.judgeMood = clamp(match.judgeMood + 1, -5, 5);

  const bribePool = Math.min(
    enemyPlayer.shares,
    blueProfile.taxBase + attacker.attack * blueProfile.taxScale,
  );
  const stolen = Math.floor((bribePool * blueProfile.skimPct) / 100);
  enemyPlayer.shares -= bribePool;
  p.shares += stolen;
  enemyPlayer.probation += 1;

  const bribeOutcome = applyJudgePrimaryEffect(
    match,
    enemy,
    blueProfile.bribePrimary,
    `${attacker.name} judge bribe`,
  );
  const riderOutcome = applyJudgeBlueRider(match, enemy, blueProfile.rider);

  pushLog(
    match,
    `${attacker.name} bribed the Judge (paid 60): siphoned ${bribePool} shares (kept ${stolen}); ${bribeOutcome}; ${riderOutcome}.`,
  );
  return { ok: true, match };
}

function dealDamageToLeader(match: MatchState, side: PlayerSide, damage: number): void {
  const leader = match.players[side].leader;
  leader.hp = Math.max(0, leader.hp - damage);
  if (leader.hp <= 0) {
    const winner = opponentOf(side);
    match.status = "finished";
    match.winnerSide = winner;
    match.winReason = "leader";
    pushLog(match, `Leader of ${side} fell. ${winner} wins.`);
  }
}

function judgeCatchChance(match: MatchState, side: PlayerSide, dirtyPower: number): number {
  const p = match.players[side];
  const base = 0.08 + dirtyPower * 0.09;
  const probation = p.probation * 0.07;
  const mood = clamp(match.judgeMood, -5, 5) * 0.02;
  return clamp(base + probation + mood, 0.05, 0.95);
}

function applyJudgePenalty(
  match: MatchState,
  side: PlayerSide,
  dirtyPower: number,
  preferredUnitId?: string,
): void {
  const p = match.players[side];
  const chance = judgeCatchChance(match, side, dirtyPower);
  const roll = nextRoll(match, "judge:catch");

  if (roll >= chance) {
    p.favor = clamp(p.favor - 1, -20, 20);
    pushLog(match, `Dirty play slipped through for ${side} (roll ${roll.toFixed(2)} vs ${chance.toFixed(2)}).`);
    return;
  }

  p.probation += 1;
  p.favor = clamp(p.favor - 2, -20, 20);
  match.judgeMood = clamp(match.judgeMood + 1, -5, 5);

  const penaltyRoll = nextRoll(match, "judge:penalty");
  if (penaltyRoll < 0.5) {
    const confiscation = Math.max(70, Math.floor(p.shares * 0.15));
    p.shares = Math.max(0, p.shares - confiscation);
    pushLog(match, `Judge caught ${side}: confiscation (${confiscation} shares).`);
    return;
  }

  const friendly = listSideUnitIds(match, side);
  let unitId = preferredUnitId;
  if (!unitId || !match.units[unitId]) {
    unitId = friendly.length > 0 ? friendly[Math.floor(nextRoll(match, "judge:stun") * friendly.length)] : undefined;
  }

  if (unitId) {
    const unit = match.units[unitId];
    if (unit) {
      // Judge penalty is absolute by design: it bypasses resistance checks.
      stunUnitUntil(unit, match.turn + 3);
      pushLog(match, `Judge caught ${side}: ${unit.name} is stunned for one own turn.`);
      return;
    }
  }

  const confiscation = Math.max(50, Math.floor(p.shares * 0.1));
  p.shares = Math.max(0, p.shares - confiscation);
  pushLog(match, `Judge had no stun target, fallback confiscation (${confiscation} shares).`);
}

function validatePlayTarget(
  match: MatchState,
  side: PlayerSide,
  cardId: string,
  target?: PlayCardInput["target"],
): { ok: true } | { ok: false; error: string } {
  const targetRule: CardTargetRule = getCardEffectDescriptor(cardId).targetRule;
  if (targetRule === "none") {
    return { ok: true };
  }

  const enemy = opponentOf(side);

  if (targetRule === "ally-unit") {
    if (!target || target.kind !== "ally-unit") {
      return { ok: false, error: "Select a friendly unit target." };
    }
    const unit = match.units[target.unitId];
    if (!unit || unit.owner !== side) {
      return { ok: false, error: "Selected friendly target is not valid anymore." };
    }
    return { ok: true };
  }

  if (targetRule === "enemy-unit") {
    if (!target || target.kind !== "enemy-unit") {
      return { ok: false, error: "Select an enemy unit target." };
    }
    const unit = match.units[target.unitId];
    if (!unit || unit.owner !== enemy) {
      return { ok: false, error: "Selected enemy target is not valid anymore." };
    }
    return { ok: true };
  }

  if (targetRule === "ally-unit-or-leader") {
    if (!target) {
      return { ok: false, error: "Select a friendly unit or your leader." };
    }
    if (target.kind === "ally-leader") {
      return { ok: true };
    }
    if (target.kind !== "ally-unit") {
      return { ok: false, error: "Select a friendly unit or your leader." };
    }
    const unit = match.units[target.unitId];
    if (!unit || unit.owner !== side) {
      return { ok: false, error: "Selected friendly target is not valid anymore." };
    }
    return { ok: true };
  }

  if (!target) {
    return { ok: false, error: "Select an enemy unit or enemy leader." };
  }
  if (target.kind === "enemy-leader") {
    return { ok: true };
  }
  if (target.kind !== "enemy-unit") {
    return { ok: false, error: "Select an enemy unit or enemy leader." };
  }

  const unit = match.units[target.unitId];
  if (!unit || unit.owner !== enemy) {
    return { ok: false, error: "Selected enemy target is not valid anymore." };
  }
  return { ok: true };
}

function resolveInstrument(
  match: MatchState,
  side: PlayerSide,
  cardId: string,
  target?: PlayCardInput["target"],
  leverage?: 2 | 3 | 4 | 5,
): void {
  const player = match.players[side];
  const enemySide = opponentOf(side);
  const enemyPlayer = match.players[enemySide];
  const allyUnitTarget = target && target.kind === "ally-unit" ? match.units[target.unitId] : undefined;
  const enemyUnitTarget = target && target.kind === "enemy-unit" ? match.units[target.unitId] : undefined;
  const drawWithLog = (count: number): number => {
    let drawn = 0;
    for (let i = 0; i < count; i += 1) {
      const nextId = drawOne(match, side);
      if (nextId) {
        drawn += 1;
      }
    }
    return drawn;
  };

  if (cardId === "liquidity_provider") {
    player.shares += 120;
    pushLog(match, `${side} played Liquidity Provider (+120 shares).`);
    return;
  }

  if (cardId === "lender_last_resort") {
    if (target?.kind === "ally-unit" && allyUnitTarget) {
      const healed = healUnit(allyUnitTarget, 3);
      pushLog(match, `${side} stabilized ${allyUnitTarget.name} for 3 HP.`);
      if (healed <= 0) {
        addUnitShield(allyUnitTarget, 1);
        pushLog(match, `${allyUnitTarget.name} converted excess aid into 1 shield.`);
      }
    } else if (target?.kind === "ally-leader") {
      const leader = player.leader;
      leader.hp = Math.min(leader.maxHp, leader.hp + 3);
      pushLog(match, `${side} stabilized own leader for 3 HP.`);
    }
    player.shares += 180;
    player.favor = clamp(player.favor - 1, -20, 20);
    pushLog(match, `${side} invoked Lender of Last Resort (+180 shares, -1 favor, emergency heal).`);
    return;
  }

  if (cardId === "rumor_forge") {
    if (!enemyUnitTarget || enemyUnitTarget.owner !== enemySide) {
      pushLog(match, `${side} played Rumor Forge but target disappeared.`);
      return;
    }
    const dealt = applyUnitDamage(match, enemyUnitTarget, 2, "Rumor Forge");
    pushLog(match, `${side} played Rumor Forge: ${enemyUnitTarget.name} takes ${dealt}.`);
    if (enemyUnitTarget.health <= 0) {
      removeUnit(match, enemyUnitTarget.id);
      player.shares += 80;
      pushLog(match, `${enemyUnitTarget.name} removed. ${side} gains 80 shares.`);
    }
    return;
  }

  if (cardId === "legal_firewall") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} played Legal Firewall but target disappeared.`);
      return;
    }
    allyUnitTarget.maxHealth += 1;
    healUnit(allyUnitTarget, 1);
    addUnitShield(allyUnitTarget, 1);
    pushLog(match, `${side} played Legal Firewall: ${allyUnitTarget.name} +1 max HP and +1 shield.`);
    return;
  }

  if (cardId === "insider_briefcase") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} played Insider Briefcase but target disappeared.`);
      return;
    }
    allyUnitTarget.attack += 2;
    pushLog(match, `${side} played Insider Briefcase: ${allyUnitTarget.name} +2 attack.`);
    return;
  }

  if (cardId === "transparency_ledger") {
    player.shares += 60;
    player.favor = clamp(player.favor + 2, -20, 20);
    player.probation = Math.max(0, player.probation - 1);
    pushLog(match, `${side} played Transparency Ledger (+60 shares, +2 favor, -1 probation).`);
    return;
  }

  if (cardId === "due_process_order") {
    if (allyUnitTarget && allyUnitTarget.owner === side) {
      allyUnitTarget.maxHealth += 2;
      healUnit(allyUnitTarget, 2);
      addUnitShield(allyUnitTarget, 1);
      player.probation = Math.max(0, player.probation - 1);
      pushLog(match, `${side} issued Due Process Order: ${allyUnitTarget.name} fortified (+2 HP, +1 shield).`);
      return;
    }
    pushLog(match, `${side} issued Due Process Order but had no valid target.`);
    return;
  }

  if (cardId === "disclosure_dump") {
    const confiscated = Math.min(90, enemyPlayer.shares);
    enemyPlayer.shares -= confiscated;
    player.favor = clamp(player.favor + 1, -20, 20);
    enemyPlayer.probation += 1;
    pushLog(match, `${side} dropped disclosure dump: enemy -${confiscated} shares, enemy probation +1.`);
    return;
  }

  if (cardId === "fine_schedule") {
    if (!enemyUnitTarget || enemyUnitTarget.owner !== enemySide) {
      pushLog(match, `${side} posted Fine Schedule but target disappeared.`);
      return;
    }
    enemyUnitTarget.attack = Math.max(1, enemyUnitTarget.attack - 2);
    stunUnitUntil(enemyUnitTarget, match.turn + 2, match, "Fine Schedule");
    enemyPlayer.shares = Math.max(0, enemyPlayer.shares - 60);
    pushLog(match, `${side} fined ${enemyUnitTarget.name}: -2 attack, stunned, enemy -60 shares.`);
    return;
  }

  if (cardId === "circuit_breaker_act") {
    const frontEnemies = listSideUnitIds(match, enemySide, "front");
    if (frontEnemies.length === 0) {
      pushLog(match, `${side} triggered Circuit Breaker Act but enemy front row was empty.`);
      return;
    }
    for (const id of frontEnemies) {
      const unit = match.units[id];
      if (!unit) continue;
      stunUnitUntil(unit, match.turn + 2, match, "Circuit Breaker Act");
    }
    pushLog(match, `${side} triggered Circuit Breaker Act: enemy front row stunned.`);
    return;
  }

  if (cardId === "shell_company_maze") {
    const stolen = Math.min(120, match.players[enemySide].shares);
    match.players[enemySide].shares -= stolen;
    player.shares += stolen;
    pushLog(match, `${side} played Shell Company Maze: siphoned ${stolen} shares.`);
    return;
  }

  if (cardId === "naked_shorting") {
    const lv = clamp(leverage ?? 2, 2, 5) as 2 | 3 | 4 | 5;
    const cost = getCard(cardId).costShares;
    const payout = cost * lv;
    const debt = payout - cost;
    player.shares += payout;
    player.nakedShortDebt += debt;
    player.judgeHostility += lv - 1;
    pushLog(match, `${side} executed Naked Shorting x${lv}. +${payout} shares, debt +${debt}.`);
    return;
  }

  if (cardId === "media_smear") {
    if (enemyUnitTarget && enemyUnitTarget.owner === enemySide) {
      enemyUnitTarget.attack = Math.max(1, enemyUnitTarget.attack - 2);
      exposeUnitUntil(enemyUnitTarget, match.turn + 2, match, "Media Smear");
      pushLog(match, `${side} played Media Smear: ${enemyUnitTarget.name} loses 2 attack and is exposed.`);
      return;
    }
    pushLog(match, `${side} played Media Smear but target disappeared.`);
    return;
  }

  if (cardId === "rebate_harvest") {
    const makerBackline = listSideUnitIds(match, side, "back").filter((id) => {
      const unit = match.units[id];
      return Boolean(unit) && unitFaction(unit as UnitState) === "market_makers";
    }).length;
    const gain = Math.min(110, 30 + makerBackline * 15);
    player.shares += gain;
    pushLog(match, `${side} harvested rebates (+${gain} shares).`);
    return;
  }

  if (cardId === "latency_patch") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} applied Latency Patch but target disappeared.`);
      return;
    }
    allyUnitTarget.attack += 1;
    healUnit(allyUnitTarget, 1);
    if ((allyUnitTarget.stunnedUntilTurn ?? 0) > match.turn) {
      allyUnitTarget.stunnedUntilTurn = match.turn;
      allyUnitTarget.cannotAttackUntilTurn = Math.min(allyUnitTarget.cannotAttackUntilTurn, match.turn);
      pushLog(match, `${side} patched ${allyUnitTarget.name}: +1 attack, +1 HP, stun cleared.`);
      return;
    }
    pushLog(match, `${side} patched ${allyUnitTarget.name}: +1 attack, +1 HP.`);
    return;
  }

  if (cardId === "cross_venue_sync") {
    player.shares += 70;
    const drawn = drawWithLog(1);
    pushLog(match, `${side} synced venues: +70 shares, drew ${drawn} card.`);
    return;
  }

  if (cardId === "maker_incentive") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} posted Maker Incentive but target disappeared.`);
      return;
    }
    allyUnitTarget.attack += 1;
    addUnitShield(allyUnitTarget, 1);
    pushLog(match, `${side} incentivized ${allyUnitTarget.name}: +1 attack and +1 shield.`);
    return;
  }

  if (cardId === "queue_priority") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} bought Queue Priority but target disappeared.`);
      return;
    }
    allyUnitTarget.attack += 1;
    allyUnitTarget.stunnedUntilTurn = match.turn;
    allyUnitTarget.cannotAttackUntilTurn = Math.min(allyUnitTarget.cannotAttackUntilTurn, match.turn);
    pushLog(match, `${side} gave ${allyUnitTarget.name} queue priority: +1 attack and instant readiness.`);
    return;
  }

  if (cardId === "buyback_authorization") {
    player.shares += 130;
    player.leader.hp = Math.min(player.leader.maxHp, player.leader.hp + 2);
    pushLog(match, `${side} executed buyback: +130 shares and leader healed for 2.`);
    return;
  }

  if (cardId === "earnings_guidance_spin") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} spun guidance but target disappeared.`);
      return;
    }
    allyUnitTarget.attack += 2;
    player.favor = clamp(player.favor - 1, -20, 20);
    pushLog(match, `${side} spun guidance: ${allyUnitTarget.name} +2 attack, favor -1.`);
    return;
  }

  if (cardId === "covenant_flex") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} flexed covenant but target disappeared.`);
      return;
    }
    allyUnitTarget.maxHealth += 2;
    healUnit(allyUnitTarget, 2);
    addUnitShield(allyUnitTarget, 1);
    pushLog(match, `${side} flexed covenant: ${allyUnitTarget.name} +2 max HP and +1 shield.`);
    return;
  }

  if (cardId === "roadshow_hype") {
    const wsUnits = listFactionUnitIds(match, side, "wallstreet").length;
    const gain = Math.min(180, 70 + wsUnits * 20);
    player.shares += gain;
    pushLog(match, `${side} ran roadshow hype (+${gain} shares).`);
    return;
  }

  if (cardId === "liquidity_window") {
    player.shares += 90;
    const drawn = drawWithLog(1);
    pushLog(match, `${side} opened liquidity window: +90 shares, drew ${drawn} card.`);
    return;
  }

  if (cardId === "diamond_hands_oath") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} cast Diamond Hands Oath but target disappeared.`);
      return;
    }
    allyUnitTarget.attack += 1;
    allyUnitTarget.maxHealth += 1;
    healUnit(allyUnitTarget, 1);
    addUnitShield(allyUnitTarget, 1);
    pushLog(match, `${side} swore Diamond Hands: ${allyUnitTarget.name} +1/+1 and +1 shield.`);
    return;
  }

  if (cardId === "reddit_raid_plan") {
    const targets = listSideUnitIds(match, enemySide);
    if (targets.length === 0) {
      pushLog(match, `${side} launched Reddit Raid Plan but no enemy units existed.`);
      return;
    }
    let removed = 0;
    for (const id of targets) {
      const unit = match.units[id];
      if (!unit) continue;
      applyUnitDamage(match, unit, 1, "Reddit Raid");
      if (unit.health <= 0) {
        removeUnit(match, unit.id);
        removed += 1;
      }
    }
    pushLog(match, `${side} launched Reddit Raid Plan: all enemy units took 1 damage (removed ${removed}).`);
    return;
  }

  if (cardId === "rocket_fuel") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} injected Rocket Fuel but target disappeared.`);
      return;
    }
    allyUnitTarget.attack += 2;
    if (allyUnitTarget.health <= 2) {
      addUnitShield(allyUnitTarget, 1);
      pushLog(match, `${side} injected Rocket Fuel: ${allyUnitTarget.name} +2 attack and emergency shield.`);
      return;
    }
    pushLog(match, `${side} injected Rocket Fuel: ${allyUnitTarget.name} +2 attack.`);
    return;
  }

  if (cardId === "banana_fund") {
    const allies = listSideUnitIds(match, side);
    let healedTargets = 0;
    for (const id of allies) {
      const unit = match.units[id];
      if (!unit) continue;
      const healed = healUnit(unit, 1);
      if (healed > 0) {
        healedTargets += 1;
      }
    }
    player.shares += 50;
    pushLog(match, `${side} deployed Banana Fund: healed ${healedTargets} units and gained +50 shares.`);
    return;
  }

  if (cardId === "crowd_shield") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} raised Crowd Shield but target disappeared.`);
      return;
    }
    addUnitShield(allyUnitTarget, 2);
    pushLog(match, `${side} raised Crowd Shield on ${allyUnitTarget.name} (+2 shield).`);
    return;
  }

  if (cardId === "synthetic_press_release") {
    player.shares += 90;
    enemyPlayer.probation += 1;
    match.judgeMood = clamp(match.judgeMood + 1, -5, 5);
    pushLog(match, `${side} dropped Synthetic Press Release: +90 shares, enemy probation +1, Judge mood worsened.`);
    return;
  }

  if (cardId === "market_holiday") {
    const allUnits = Object.values(match.units);
    if (allUnits.length === 0) {
      pushLog(match, `${side} called Market Holiday but no units were on board.`);
      return;
    }
    for (const unit of allUnits) {
      stunUnitUntil(unit, match.turn + 2, match, "Market Holiday");
    }
    pushLog(match, `${side} called Market Holiday: all units are stunned for one turn cycle.`);
    return;
  }

  if (cardId === "audit_committee") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} formed Audit Committee but target disappeared.`);
      return;
    }
    allyUnitTarget.maxHealth += 1;
    healUnit(allyUnitTarget, 1);
    addUnitShield(allyUnitTarget, 1);
    player.favor = clamp(player.favor + 1, -20, 20);
    player.probation = Math.max(0, player.probation - 1);
    pushLog(match, `${side} formed Audit Committee: ${allyUnitTarget.name} fortified and favor +1.`);
    return;
  }

  if (cardId === "spreadsheet_reconciliation") {
    player.shares += 70;
    const reduced = Math.min(80, player.nakedShortDebt);
    player.nakedShortDebt -= reduced;
    pushLog(match, `${side} reconciled spreadsheets: +70 shares, debt reduced by ${reduced}.`);
    return;
  }

  if (cardId === "liquidity_window_global") {
    player.shares += 100;
    const reduced = Math.min(30, player.nakedShortDebt);
    player.nakedShortDebt -= reduced;
    const drawn = drawWithLog(1);
    pushLog(match, `${side} used global Liquidity Window: +100 shares, drew ${drawn}, debt -${reduced}.`);
    return;
  }

  if (cardId === "circuit_pause") {
    if (!enemyUnitTarget || enemyUnitTarget.owner !== enemySide) {
      pushLog(match, `${side} triggered Circuit Pause but target disappeared.`);
      return;
    }
    stunUnitUntil(enemyUnitTarget, match.turn + 2, match, "Circuit Pause");
    exposeUnitUntil(enemyUnitTarget, match.turn + 1, match, "Circuit Pause");
    pushLog(match, `${side} triggered Circuit Pause on ${enemyUnitTarget.name}: stunned and exposed.`);
    return;
  }

  if (cardId === "compliance_hotline") {
    if (!enemyUnitTarget || enemyUnitTarget.owner !== enemySide) {
      pushLog(match, `${side} rang Compliance Hotline but target disappeared.`);
      return;
    }
    enemyUnitTarget.attack = Math.max(1, enemyUnitTarget.attack - 1);
    enemyPlayer.probation += 1;
    pushLog(match, `${side} rang Compliance Hotline: ${enemyUnitTarget.name} -1 attack, enemy probation +1.`);
    return;
  }

  if (cardId === "darkpool_flashlight") {
    if (!enemyUnitTarget || enemyUnitTarget.owner !== enemySide) {
      pushLog(match, `${side} flashed darkpool spotlight but target disappeared.`);
      return;
    }
    exposeUnitUntil(enemyUnitTarget, match.turn + 2, match, "Darkpool Flashlight");
    const dealt = applyUnitDamage(match, enemyUnitTarget, 1, "Darkpool Flashlight");
    pushLog(match, `${side} flashed ${enemyUnitTarget.name}: exposed and took ${dealt} damage.`);
    if (enemyUnitTarget.health <= 0) {
      removeUnit(match, enemyUnitTarget.id);
      pushLog(match, `${enemyUnitTarget.name} collapsed under spotlight.`);
    }
    return;
  }

  if (cardId === "headline_scraper") {
    if (target?.kind === "enemy-leader") {
      const skim = Math.min(80, enemyPlayer.shares);
      enemyPlayer.shares -= skim;
      player.shares += skim;
      player.favor = clamp(player.favor + 1, -20, 20);
      pushLog(match, `${side} scraped headlines: stole ${skim} shares from enemy leader.`);
      return;
    }
    if (enemyUnitTarget && enemyUnitTarget.owner === enemySide) {
      enemyUnitTarget.attack = Math.max(1, enemyUnitTarget.attack - 1);
      exposeUnitUntil(enemyUnitTarget, match.turn + 1, match, "Headline Scraper");
      pushLog(match, `${side} scraped headlines on ${enemyUnitTarget.name}: -1 attack and exposed.`);
      return;
    }
    pushLog(match, `${side} scraped headlines but target disappeared.`);
    return;
  }

  if (cardId === "volatility_swaplet") {
    if (!allyUnitTarget || allyUnitTarget.owner !== side) {
      pushLog(match, `${side} applied Volatility Swaplet but target disappeared.`);
      return;
    }
    allyUnitTarget.attack += 1;
    addUnitShield(allyUnitTarget, 1);
    allyUnitTarget.exposedUntilTurn = undefined;
    pushLog(match, `${side} applied Volatility Swaplet: ${allyUnitTarget.name} +1 attack, +1 shield, exposure cleared.`);
    return;
  }

  const card = getCard(cardId);
  if (card.type === "instrument") {
    const gain = 70 + Math.floor(nextRoll(match, `generic:instrument:${cardId}`) * 55);
    player.shares += gain;
    if (card.traits.includes("dirty")) {
      player.probation += 1;
      pushLog(match, `${side} played ${card.name}: +${gain} shares, +1 probation.`);
      return;
    }
    pushLog(match, `${side} played ${card.name}: +${gain} shares.`);
    return;
  }

  if (card.type === "upgrade") {
    if (allyUnitTarget && allyUnitTarget.owner === side) {
      if (nextRoll(match, `generic:upgrade:buff:${cardId}`) < 0.5) {
        allyUnitTarget.health += 1;
        allyUnitTarget.maxHealth += 1;
        pushLog(match, `${side} played ${card.name}: ${allyUnitTarget.name} +1 HP.`);
      } else {
        allyUnitTarget.attack += 1;
        pushLog(match, `${side} played ${card.name}: ${allyUnitTarget.name} +1 attack.`);
      }
      return;
    }
    pushLog(match, `${side} played ${card.name} but had no target.`);
    return;
  }

  pushLog(match, `${side} played ${card.name}.`);
}

function startTurn(match: MatchState): void {
  if (match.status !== "active") {
    return;
  }
  expireTemporaryAttackPenalties(match);

  const active = match.activeSide;
  const player = match.players[active];
  player.blockedLane = undefined;
  player.blockedCol = undefined;

  if (player.nakedShortDebt > 0) {
    const hostileUnits = listSideUnitIds(match, active);
    if (hostileUnits.length > 0) {
      const idx = Math.floor(nextRoll(match, "naked:tick:unit") * hostileUnits.length);
      const targetId = hostileUnits[idx] as string;
      const target = match.units[targetId];
      if (target) {
        const dealt = applyUnitDamage(match, target, 1, "Judge pressure");
        pushLog(match, `Judge pressure: ${target.name} took ${dealt} damage (Naked Short debt).`);
        if (target.health <= 0) {
          removeUnit(match, target.id);
          pushLog(match, `${target.name} collapsed under debt pressure.`);
        }
      }
    }

    const activeCurtain = player.curtainEventId ? match.eventUnits[player.curtainEventId] : undefined;
    if (activeCurtain && activeCurtain.kind === "iron_curtain") {
      player.blockedLane = activeCurtain.blockedLane;
      player.blockedCol = activeCurtain.col;
    } else {
      const lockRoll = nextRoll(match, "naked:tick:lock");
      if (lockRoll < 0.4) {
        const lane = nextRoll(match, "naked:tick:lane") < 0.5 ? "front" : "back";
        const freeCols: number[] = [];
        for (let col = 0; col < BOARD_COLS; col += 1) {
          if (col === JUDGE_COL) continue;
          if (!match.eventRow[col]) freeCols.push(col);
        }
        if (freeCols.length > 0) {
          const col = freeCols[Math.floor(nextRoll(match, "naked:tick:curtain-col") * freeCols.length)] as number;
          const curtainId = uniqueId("event", match.seed, match.rngCounter + 730);
          match.rngCounter += 1;
          match.eventUnits[curtainId] = {
            id: curtainId,
            kind: "iron_curtain",
            ownerSide: active,
            blockedLane: lane,
            name: "Iron Curtain",
            attack: 0,
            health: 3,
            maxHealth: 3,
            col,
            rewardShares: 0,
            rewardFavor: 0,
          };
          match.eventRow[col] = curtainId;
          player.blockedLane = lane;
          player.blockedCol = col;
          player.curtainEventId = curtainId;
          pushLog(match, `Iron Curtain deployed in column ${col + 1}: units in that column are blocked until curtain falls.`);
        }
      }
    }
  } else {
    clearIronCurtainForSide(match, active);
  }

  applyJudgeLaneInfluence(match, active);
  applyFactionTurnStart(match, active);
  drawOne(match, active);
  if (match.mode !== "tutorial" && match.mode !== "sandbox") {
    applyRandomEvent(match);
    if ((match.status as string) === "finished") {
      return;
    }

    maybeGrantVerdict(match, active);
    if ((match.status as string) === "finished") {
      return;
    }

    const driftRoll = nextRoll(match, "judge:mood:drift");
    if (driftRoll < 0.34) {
      match.judgeMood = clamp(match.judgeMood - 1, -5, 5);
    } else if (driftRoll > 0.66) {
      match.judgeMood = clamp(match.judgeMood + 1, -5, 5);
    }
  }

  match.turnDeadlineAt = nowTs() + turnSecondsForSide(match, active) * 1000;
  pushLog(match, `Turn ${match.turn} started for ${active}.`);
}

function maybeGrantVerdict(match: MatchState, side: PlayerSide): void {
  const player = match.players[side];
  if (player.favor < 8) {
    return;
  }

  const rareRoll = nextRoll(match, "judge:verdict");
  if (rareRoll < 0.01) {
    match.status = "finished";
    match.winnerSide = side;
    match.winReason = "verdict";
    match.verdictGrantedTo = side;
    pushLog(match, `Judge granted Verdict to ${side}. Alternate win triggered.`);
  }
}

function applyRandomEvent(match: MatchState): void {
  if (match.status !== "active") {
    return;
  }

  const triggerRoll = nextRoll(match, "event:trigger");
  if (triggerRoll > 0.55) {
    return;
  }

  const eventRoll = nextRoll(match, "event:type");
  if (eventRoll < 0.34) {
    const freeCols: number[] = [];
    for (let col = 0; col < BOARD_COLS; col += 1) {
      if (col === JUDGE_COL) {
        continue;
      }
      if (!match.eventRow[col]) {
        freeCols.push(col);
      }
    }
    if (freeCols.length === 0) {
      pushLog(match, "Event skipped: event row is full.");
      return;
    }
    const col = freeCols[Math.floor(nextRoll(match, "event:protest:col") * freeCols.length)] as number;
    const eventId = uniqueId("event", match.seed, match.rngCounter + 700);
    match.rngCounter += 1;
    match.eventUnits[eventId] = {
      id: eventId,
      name: "Activist Protest",
      attack: 0,
      health: 4,
      maxHealth: 4,
      col,
      rewardShares: 90,
      rewardFavor: 1,
    };
    match.eventRow[col] = eventId;
    pushLog(match, `Random Event: Activist Protest appeared in event column ${col + 1}.`);
    return;
  }

  if (eventRoll < 0.67) {
    match.players.A.shares = Math.max(0, match.players.A.shares - 60);
    match.players.B.shares = Math.max(0, match.players.B.shares - 60);
    pushLog(match, "Random Event: Margin Call Drill (-60 shares for both players).");
    return;
  }

  const allUnits = Object.values(match.units);
  if (allUnits.length === 0) {
    pushLog(match, "Random Event: Media Frenzy fizzled (no units)." );
    return;
  }

  const target = allUnits[Math.floor(nextRoll(match, "event:media:target") * allUnits.length)] as UnitState;
  const buff = nextRoll(match, "event:media:buff") >= 0.5;
  if (buff) {
    target.attack += 1;
    pushLog(match, `Random Event: Media Frenzy buffed ${target.name} (+1 attack).`);
  } else {
    target.attack = Math.max(1, target.attack - 1);
    pushLog(match, `Random Event: Media Frenzy nerfed ${target.name} (-1 attack).`);
  }
}

function endTurnInternal(match: MatchState): void {
  if (match.status !== "active") {
    return;
  }
  match.activeSide = opponentOf(match.activeSide);
  match.turn += 1;
  startTurn(match);
}

function startActiveFromMulligan(match: MatchState): void {
  const openingSide: PlayerSide = nextRoll(match, "opening:side") < 0.5 ? "A" : "B";
  const responseSide = opponentOf(openingSide);
  const responsePlayer = match.players[responseSide];

  match.status = "active";
  match.turn = 1;
  match.activeSide = openingSide;

  responsePlayer.shares += 65;

  pushLog(
    match,
    `Mulligan finished. Opening side: ${openingSide}. ${responseSide} gains +65 shares as coin compensation.`,
  );
  startTurn(match);
}

export function tickTimeouts(match: MatchState, now = nowTs()): MatchState {
  if (match.mode === "tutorial" && match.tutorial?.paused) {
    return tutorialTickPause(match, now);
  }

  if (match.status === "mulligan" && now >= match.mulliganDeadlineAt) {
    for (const side of ["A", "B"] as const) {
      const player = match.players[side];
      if (!player.mulliganDone) {
        player.mulliganDone = true;
        pushLog(match, `Mulligan auto-accepted for ${side}.`);
      }
    }
    startActiveFromMulligan(match);
  }

  if (match.status === "active" && now >= match.turnDeadlineAt) {
    pushLog(match, `Turn timeout for ${match.activeSide}. Auto-pass.`);
    endTurnInternal(match);
  }

  match.updatedAt = now;
  return match;
}

export function applyMulligan(match: MatchState, input: MulliganInput): MatchActionResult {
  if (match.status !== "mulligan") {
    return { ok: false, error: "Mulligan phase already closed.", match };
  }

  const player = match.players[input.side];
  if (player.mulliganDone) {
    return { ok: false, error: "Mulligan already submitted.", match };
  }

  const uniqueIndices = [...new Set(input.replaceIndices)]
    .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < player.hand.length)
    .sort((a, b) => a - b);

  const returning: string[] = [];
  for (let i = uniqueIndices.length - 1; i >= 0; i -= 1) {
    const idx = uniqueIndices[i] as number;
    const [removed] = player.hand.splice(idx, 1);
    if (removed) {
      returning.push(removed);
    }
  }

  if (returning.length > 0) {
    player.deck.push(...returning);
    for (let i = player.deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(nextRoll(match, "mulligan:shuffle") * (i + 1));
      [player.deck[i], player.deck[j]] = [player.deck[j] as string, player.deck[i] as string];
    }

    const drawn = drawCards(player.deck, returning.length);
    player.deck = drawn.nextDeck;
    player.hand.push(...drawn.drawn);
  }

  player.mulliganDone = true;
  pushLog(match, `${input.side} confirmed mulligan (${returning.length} replaced).`);

  if (match.players.A.mulliganDone && match.players.B.mulliganDone) {
    startActiveFromMulligan(match);
  }

  match.updatedAt = nowTs();
  return { ok: true, match };
}

export function playCard(match: MatchState, input: PlayCardInput): MatchActionResult {
  if (match.status !== "active") {
    return { ok: false, error: "Match is not active.", match };
  }
  if (match.activeSide !== input.side) {
    return { ok: false, error: "Not your turn.", match };
  }

  const player = match.players[input.side];
  const cardId = player.hand[input.handIndex];
  if (!cardId) {
    return { ok: false, error: "Invalid hand index.", match };
  }

  const card = getCard(cardId);
  const targetValidation = validatePlayTarget(match, input.side, card.id, input.target);
  if (!targetValidation.ok) {
    return { ok: false, error: targetValidation.error, match };
  }

  let flipSourceUnitId: string | undefined;
  let usesFlip = false;

  if (card.type === "unit") {
    if (!inBoundsCol(input.col)) {
      return { ok: false, error: "Column out of bounds.", match };
    }
    if (!canPlaceCardInLane(card.id, input.lane, input.col)) {
      return { ok: false, error: "Card cannot be placed in this row.", match };
    }
    if (isJudgeGoodSlot(input.lane, input.col) && !isPositiveJudgeCard(card.id)) {
      return { ok: false, error: "Judge green slot accepts only prosecutor/negotiator units.", match };
    }
    if (isJudgeBadSlot(input.lane, input.col) && !isCorruptJudgeCard(card.id)) {
      return { ok: false, error: "Judge blue slot accepts only dirty units.", match };
    }
    const occupiedUnitId = player.board[input.lane][input.col];
    if (occupiedUnitId) {
      if (!card.traits.includes("flip")) {
        return { ok: false, error: "Slot is occupied.", match };
      }
      const occupiedUnit = match.units[occupiedUnitId];
      if (!occupiedUnit || occupiedUnit.owner !== input.side) {
        return { ok: false, error: "Flip can only replace your own unit.", match };
      }
      usesFlip = true;
      flipSourceUnitId = occupiedUnitId;
    }
  }

  const baseCost = card.type === "unit" || card.id === "naked_shorting" ? card.costShares : 0;
  const flipSurcharge = usesFlip ? Math.max(1, Math.ceil(card.costShares * 0.25)) : 0;
  const spendCost = baseCost + flipSurcharge;
  if (player.shares < spendCost) {
    return { ok: false, error: "Not enough shares.", match };
  }

  player.hand.splice(input.handIndex, 1);
  player.shares -= spendCost;
  player.discard.push(card.id);

  let playedUnitId: string | undefined;

  if (card.type === "unit") {
    if (usesFlip && flipSourceUnitId) {
      const flippedOut = match.units[flipSourceUnitId];
      if (flippedOut) {
        removeUnit(match, flipSourceUnitId);
        returnCardToHandOrBurn(match, input.side, flippedOut.cardId, "Flip swap");
      }
      pushLog(match, `${input.side} paid +${flipSurcharge} shares to use Flip swap.`);
    }

    const unit = slotUnit(match, input.side, input.lane, input.col, card.id);
    if (usesFlip) {
      unit.traits = unit.traits.filter((trait) => trait !== "flip");
    }
    playedUnitId = unit.id;
    pushLog(match, `${input.side} played ${card.name} to ${input.lane} ${input.col + 1}.`);
    applyFactionOnSummon(match, input.side, unit);
  } else {
    resolveInstrument(match, input.side, card.id, input.target, input.leverage);
  }

  if ((card.dirtyPower ?? 0) > 0 || card.traits.includes("dirty")) {
    if (match.mode !== "tutorial") {
      applyJudgePenalty(match, input.side, card.dirtyPower ?? 1, playedUnitId);
    }
  } else {
    player.favor = clamp(player.favor + 1, -20, 20);
    player.probation = Math.max(0, player.probation - 1);
  }

  match.updatedAt = nowTs();
  return { ok: true, match };
}

export function attack(match: MatchState, input: AttackInput): MatchActionResult {
  if (match.status !== "active") {
    return { ok: false, error: "Match is not active.", match };
  }
  if (match.activeSide !== input.side) {
    return { ok: false, error: "Not your turn.", match };
  }

  const attacker = match.units[input.attackerUnitId];
  if (!attacker || attacker.owner !== input.side) {
    return { ok: false, error: "Attacker not available.", match };
  }

  if (attacker.cannotAttackUntilTurn > match.turn) {
    if ((attacker.stunnedUntilTurn ?? 0) > match.turn) {
      return { ok: false, error: "This unit is stunned.", match };
    }
    return { ok: false, error: "This unit cannot attack this turn.", match };
  }

  const blockedCol = match.players[input.side].blockedCol;
  const blockedLane = match.players[input.side].blockedLane;
  if (typeof blockedCol === "number" && attacker.col === blockedCol && (!blockedLane || attacker.lane === blockedLane)) {
    if (blockedLane) {
      return {
        ok: false,
        error: `Iron Curtain blocks your ${blockedLane} row, column ${attacker.col + 1} this turn.`,
        match,
      };
    }
    return { ok: false, error: `Iron Curtain blocks your column ${attacker.col + 1} this turn.`, match };
  }

  const enemy = opponentOf(input.side);
  const enemyTauntFront = listSideUnitIds(match, enemy, "front").filter((id) =>
    match.units[id]?.traits.includes("taunt"),
  );

  const damage = attacker.attack;

  if (input.target.kind === "judge") {
    const judgeInteraction = interactWithJudge(match, input.side, attacker);
    if (!judgeInteraction.ok) {
      return judgeInteraction;
    }
    attacker.cannotAttackUntilTurn = match.turn + 1;
    match.updatedAt = nowTs();
    return { ok: true, match };
  }

  if (input.target.kind === "leader") {
    const enemyHasFrontTaunt = enemyTauntFront.length > 0;

    if (isBlueJudgeUnit(attacker)) {
      if (enemyHasFrontTaunt) {
        return { ok: false, error: "Blue judge slot cannot attack leader while enemy front-row taunt is active.", match };
      }
      dealDamageToLeader(match, enemy, damage);
      pushLog(match, `${attacker.name} hit leader ${enemy} for ${damage}.`);
    } else {
      if (enemyHasFrontTaunt) {
        return { ok: false, error: "Taunt in enemy front row must be attacked first.", match };
      }
      if (attacker.lane === "back" && !canReachBackline(attacker)) {
        return { ok: false, error: "Back-row unit needs reach or ranged to attack leader.", match };
      }

      const shield = leaderFrontShield(match, input.side);
      if (shield.blocked) {
        return {
          ok: false,
          error: `Enemy front row shields the leader (${shield.frontCount} units). Clear the line first.`,
          match,
        };
      }

      const leaderDamage = Math.max(0, damage - shield.damagePenalty);
      if (shield.damagePenalty > 0) {
        pushLog(
          match,
          `${attacker.name} leader damage reduced by ${shield.damagePenalty} (enemy front row: ${shield.frontCount}).`,
        );
      }
      dealDamageToLeader(match, enemy, leaderDamage);
      pushLog(match, `${attacker.name} hit leader ${enemy} for ${leaderDamage}.`);
    }
  }

  if (input.target.kind === "unit") {
    const target = match.units[input.target.unitId];
    if (!target || target.owner !== enemy) {
      return { ok: false, error: "Target unit not valid.", match };
    }

    if (isBlueJudgeUnit(attacker)) {
      if (!(isJudgeGoodSlot(target.lane, target.col) && target.owner === enemy)) {
        return { ok: false, error: "Blue judge slot can only attack enemy green judge slot.", match };
      }
    }

    if (enemyTauntFront.length > 0 && !target.traits.includes("taunt")) {
      return { ok: false, error: "Taunt in enemy front row must be attacked first.", match };
    }

    if (target.lane === "back" && !canReachBackline(attacker)) {
      return { ok: false, error: "Attacker cannot hit backline.", match };
    }

    const bonusToTarget = isUnitExposed(match, target) ? 1 : 0;
    const outgoingDamage = damage + bonusToTarget;
    const dealt = applyUnitDamage(match, target, outgoingDamage, `${attacker.name} attack`);
    pushLog(match, `${attacker.name} dealt ${dealt} to ${target.name}.`);

    const bonusToAttacker = isUnitExposed(match, attacker) ? 1 : 0;
    const counterDamage = target.attack + bonusToAttacker;
    const counterDealt = applyUnitDamage(match, attacker, counterDamage, `${target.name} counter`);
    pushLog(match, `${target.name} countered ${attacker.name} for ${counterDealt}.`);

    const targetDied = target.health <= 0;
    const attackerDied = attacker.health <= 0;
    applyFactionCombatHooks(match, input.side, attacker, target, targetDied, attackerDied);

    if (targetDied) {
      removeUnit(match, target.id);
      const killReward = match.mode === "sandbox" && isSandboxCleanupCard(target.cardId) ? 25 : 90;
      match.players[input.side].shares += killReward;
      pushLog(match, `${target.name} removed. ${input.side} gains ${killReward} shares.`);
    }

    if (attackerDied) {
      removeUnit(match, attacker.id);
      pushLog(match, `${attacker.name} was removed in counterattack.`);
      match.updatedAt = nowTs();
      return { ok: true, match };
    }
  }

  if (input.target.kind === "event") {
    if (isBlueJudgeUnit(attacker)) {
      return { ok: false, error: "Blue judge slot cannot attack events.", match };
    }
    const target = match.eventUnits[input.target.eventUnitId];
    if (!target) {
      return { ok: false, error: "Event target not found.", match };
    }

    if (target.kind === "iron_curtain" && target.ownerSide !== input.side) {
      return { ok: false, error: "Only the indebted side may attack its Iron Curtain.", match };
    }
    target.health -= damage;
    pushLog(match, `${attacker.name} hit event ${target.name} for ${damage}.`);

    if (target.health <= 0) {
      const rewardShares = target.rewardShares;
      const rewardFavor = target.rewardFavor;
      const curtainOwner = target.kind === "iron_curtain" ? target.ownerSide : undefined;
      removeEventUnit(match, target.id);
      if (curtainOwner) {
        const owner = match.players[curtainOwner];
        if (owner.curtainEventId === target.id) {
          owner.curtainEventId = undefined;
          owner.blockedLane = undefined;
          owner.blockedCol = undefined;
        }
      }
      match.players[input.side].shares += rewardShares;
      match.players[input.side].favor = clamp(match.players[input.side].favor + rewardFavor, -20, 20);
      pushLog(match, `${target.name} cleared. ${input.side} gains ${rewardShares} shares and ${rewardFavor} favor.`);
    }
  }

  attacker.cannotAttackUntilTurn = match.turn + 1;
  match.updatedAt = nowTs();
  return { ok: true, match };
}

export function repositionJudgeSpecialist(match: MatchState, input: RepositionJudgeInput): MatchActionResult {
  if (match.status !== "active") {
    return { ok: false, error: "Match is not active.", match };
  }
  if (match.activeSide !== input.side) {
    return { ok: false, error: "Not your turn.", match };
  }

  const unit = match.units[input.unitId];
  if (!unit || unit.owner !== input.side) {
    return { ok: false, error: "Unit not available.", match };
  }
  if (!isJudgeSpecialistCard(unit.cardId)) {
    return { ok: false, error: "Only Judge specialist units can reposition.", match };
  }
  if (unit.judgeRepositionUsed) {
    return { ok: false, error: "This specialist already used its Judge reposition.", match };
  }
  if ((unit.stunnedUntilTurn ?? 0) > match.turn) {
    return { ok: false, error: "Stunned unit cannot reposition.", match };
  }
  if (unit.col === JUDGE_COL) {
    return { ok: false, error: "Unit is already in a Judge slot.", match };
  }

  const targetLane = findJudgeRepositionLane(match, input.side, unit);
  if (!targetLane) {
    return { ok: false, error: "No valid free Judge slot for this specialist.", match };
  }
  if (match.players[input.side].board[targetLane][JUDGE_COL] !== null) {
    return { ok: false, error: "Target Judge slot is occupied.", match };
  }

  match.players[input.side].board[unit.lane][unit.col] = null;
  unit.lane = targetLane;
  unit.col = JUDGE_COL;
  unit.judgeRepositionUsed = true;
  unit.cannotAttackUntilTurn = Math.max(unit.cannotAttackUntilTurn, match.turn + 1);
  match.players[input.side].board[targetLane][JUDGE_COL] = unit.id;
  pushLog(match, `${unit.name} repositioned into ${targetLane} Judge slot. Attack action consumed this turn.`);

  match.updatedAt = nowTs();
  return { ok: true, match };
}

export function repayNakedShort(match: MatchState, side: PlayerSide): MatchActionResult {
  if (match.status !== "active") {
    return { ok: false, error: "Match is not active.", match };
  }
  if (match.activeSide !== side) {
    return { ok: false, error: "Not your turn.", match };
  }

  const player = match.players[side];
  const debt = player.nakedShortDebt;
  if (debt <= 0) {
    return { ok: false, error: "No active Naked Short debt.", match };
  }
  if (player.shares < debt) {
    return { ok: false, error: `Not enough shares to repay debt (${debt}).`, match };
  }

  player.shares -= debt;
  player.nakedShortDebt = 0;
  player.judgeHostility = 0;
  clearIronCurtainForSide(match, side);
  pushLog(match, `${side} repaid Naked Short debt (${debt}). Judge hostility cleared.`);
  match.updatedAt = nowTs();
  return { ok: true, match };
}

export function endTurn(match: MatchState, side: PlayerSide): MatchActionResult {
  if (match.status !== "active") {
    return { ok: false, error: "Match is not active.", match };
  }
  if (match.activeSide !== side) {
    return { ok: false, error: "Not your turn.", match };
  }

  pushLog(match, `${side} ended turn.`);
  endTurnInternal(match);
  match.updatedAt = nowTs();
  return { ok: true, match };
}

export function sideForUser(match: MatchState, userId: string): PlayerSide | null {
  if (match.players.A.userId === userId) {
    return "A";
  }
  if (match.players.B.userId === userId) {
    return "B";
  }
  return null;
}

function pickLowestHealthUnitId(match: MatchState, unitIds: string[]): string | undefined {
  let bestId: string | undefined;
  let bestHp = Number.POSITIVE_INFINITY;
  for (const id of unitIds) {
    const unit = match.units[id];
    if (!unit) continue;
    if (unit.health < bestHp) {
      bestHp = unit.health;
      bestId = id;
    }
  }
  return bestId;
}

function pickHighestAttackUnitId(match: MatchState, unitIds: string[]): string | undefined {
  let bestId: string | undefined;
  let bestAtk = Number.NEGATIVE_INFINITY;
  let bestHp = Number.NEGATIVE_INFINITY;
  for (const id of unitIds) {
    const unit = match.units[id];
    if (!unit) continue;
    if (unit.attack > bestAtk || (unit.attack === bestAtk && unit.health > bestHp)) {
      bestAtk = unit.attack;
      bestHp = unit.health;
      bestId = id;
    }
  }
  return bestId;
}

function pickPriorityEnemyUnitId(match: MatchState, side: PlayerSide): string | undefined {
  const tauntFront = listSideUnitIds(match, side, "front").filter((id) => match.units[id]?.traits.includes("taunt"));
  if (tauntFront.length > 0) {
    return tauntFront[0];
  }
  const front = listSideUnitIds(match, side, "front");
  if (front.length > 0) {
    return front[0];
  }
  const any = listSideUnitIds(match, side);
  return any[0];
}

function botPickPlayTarget(
  match: MatchState,
  side: PlayerSide,
  cardId: string,
): { ok: true; target?: PlayCardInput["target"] } | { ok: false } {
  const targetRule = getCardEffectDescriptor(cardId).targetRule;
  const enemy = opponentOf(side);

  if (targetRule === "none") {
    return { ok: true };
  }

  if (targetRule === "ally-unit") {
    const allies = listSideUnitIds(match, side);
    const targetId = pickLowestHealthUnitId(match, allies);
    if (!targetId) {
      return { ok: false };
    }
    return { ok: true, target: { kind: "ally-unit", unitId: targetId } };
  }

  if (targetRule === "enemy-unit") {
    const targetId = pickPriorityEnemyUnitId(match, enemy);
    if (!targetId) {
      return { ok: false };
    }
    return { ok: true, target: { kind: "enemy-unit", unitId: targetId } };
  }

  if (targetRule === "ally-unit-or-leader") {
    const player = match.players[side];
    if (player.leader.hp <= player.leader.maxHp - 2) {
      return { ok: true, target: { kind: "ally-leader" } };
    }
    const allies = listSideUnitIds(match, side);
    const damagedAlly = pickLowestHealthUnitId(
      match,
      allies.filter((id) => {
        const unit = match.units[id];
        return Boolean(unit) && (unit as UnitState).health < (unit as UnitState).maxHealth;
      }),
    );
    if (damagedAlly) {
      return { ok: true, target: { kind: "ally-unit", unitId: damagedAlly } };
    }
    if (allies.length > 0) {
      return { ok: true, target: { kind: "ally-unit", unitId: allies[0] as string } };
    }
    return { ok: true, target: { kind: "ally-leader" } };
  }

  const enemyTargetId = pickPriorityEnemyUnitId(match, enemy);
  if (enemyTargetId) {
    return { ok: true, target: { kind: "enemy-unit", unitId: enemyTargetId } };
  }
  return { ok: true, target: { kind: "enemy-leader" } };
}

export function maybeRunBot(match: MatchState): MatchState {
  if (match.status !== "active") {
    return match;
  }

  const side = match.activeSide;
  const player = match.players[side];
  if (!player.isBot) {
    return match;
  }

  if (match.mode === "sandbox" && side === "B") {
    const freeSlots: Array<{ lane: "front" | "back"; col: number }> = [];
    for (const lane of BOARD_LANES) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        if (player.board[lane][col] === null) {
          freeSlots.push({ lane, col });
        }
      }
    }

    if (freeSlots.length > 0) {
      const slotIdx = Math.floor(nextRoll(match, "sandbox:spawn:slot") * freeSlots.length);
      const slot = freeSlots[slotIdx];
      const cardIdx = Math.floor(nextRoll(match, "sandbox:spawn:card") * SANDBOX_CLEANUP_CARD_IDS.length);
      const cardId = SANDBOX_CLEANUP_CARD_IDS[cardIdx] ?? SANDBOX_CLEANUP_CARD_IDS[0];
      if (slot && cardId) {
        const spawned = slotUnit(match, side, slot.lane, slot.col, cardId);
        spawned.shieldCharges = 3;
        pushLog(match, `Wozny deployed ${spawned.name} to ${slot.lane} ${slot.col + 1}.`);
      }
    } else {
      pushLog(match, "Wozny found no free cleanup slot this turn.");
    }

    if (match.status === "active" && match.activeSide === side) {
      endTurn(match, side);
    }
    return match;
  }

  const preferredCol = simpleAiPreferredCol(match.seed ^ 0x3377, match.turn);
  const handOrder = player.hand
    .map((cardId, idx) => ({ idx, card: getCard(cardId) }))
    .filter(({ card }) => {
      const spendCost = card.type === "unit" || card.id === "naked_shorting" ? card.costShares : 0;
      return spendCost <= player.shares;
    })
    .sort((a, b) => {
      if (a.card.type === b.card.type) return 0;
      return a.card.type === "unit" ? -1 : 1;
    });

  for (const pick of handOrder) {
    const card = pick.card;
    if (card.type !== "unit") {
      const targetPlan = botPickPlayTarget(match, side, card.id);
      if (!targetPlan.ok) {
        continue;
      }
      const played = playCard(match, {
        side,
        handIndex: pick.idx,
        lane: "front",
        col: 0,
        leverage: card.id === "naked_shorting" ? 3 : undefined,
        target: targetPlan.target,
      });
      if (played.ok) {
        break;
      }
      continue;
    }

    const canFront = canPlaceCardInLane(card.id, "front") || canPlaceCardInLane(card.id, "front", JUDGE_COL);
    const canBack = canPlaceCardInLane(card.id, "back") || canPlaceCardInLane(card.id, "back", JUDGE_COL);

    const targetLaneOrder: Array<"front" | "back"> = [];
    if (card.traits.includes("back_only")) {
      if (canBack) targetLaneOrder.push("back");
      if (canFront) targetLaneOrder.push("front");
    } else if (card.traits.includes("front_only") || card.traits.includes("taunt")) {
      if (canFront) targetLaneOrder.push("front");
      if (canBack) targetLaneOrder.push("back");
    } else if (card.traits.includes("ranged") || card.traits.includes("negotiator") || card.traits.includes("prosecutor")) {
      if (canBack) targetLaneOrder.push("back");
      if (canFront) targetLaneOrder.push("front");
    } else {
      if (canFront) targetLaneOrder.push("front");
      if (canBack) targetLaneOrder.push("back");
    }

    if (targetLaneOrder.length === 0) {
      continue;
    }

    const colOrder = [preferredCol, ...new Array(BOARD_COLS).fill(0).map((_, i) => i).filter((c) => c !== preferredCol)];
    let playedUnit = false;

    for (const lane of targetLaneOrder) {
      for (const col of colOrder) {
        if (!canPlaceCardInLane(card.id, lane, col)) {
          continue;
        }
        if (player.board[lane][col] !== null) {
          continue;
        }
        if (col === JUDGE_COL) {
          if (lane === "front" && !isPositiveJudgeCard(card.id)) {
            continue;
          }
          if (lane === "back" && !isCorruptJudgeCard(card.id)) {
            continue;
          }
        }

        const played = playCard(match, {
          side,
          handIndex: pick.idx,
          lane,
          col,
        });

        if (played.ok) {
          playedUnit = true;
          break;
        }
      }
      if (playedUnit) {
        break;
      }
    }

    if (playedUnit) {
      break;
    }
  }

  const attackers = listSideUnitIds(match, side).filter((unitId) => {
    const u = match.units[unitId];
    return u && u.cannotAttackUntilTurn <= match.turn;
  });

  for (const attackerUnitId of attackers) {
    const enemySide = opponentOf(side);
    const taunts = listSideUnitIds(match, enemySide, "front").filter((unitId) =>
      match.units[unitId]?.traits.includes("taunt"),
    );

    if (taunts.length > 0) {
      attack(match, {
        side,
        attackerUnitId,
        target: { kind: "unit", unitId: taunts[0] as string },
      });
      continue;
    }

    const frontUnits = listSideUnitIds(match, enemySide, "front");
    if (frontUnits.length > 0) {
      attack(match, {
        side,
        attackerUnitId,
        target: { kind: "unit", unitId: frontUnits[0] as string },
      });
      continue;
    }

    attack(match, {
      side,
      attackerUnitId,
      target: { kind: "leader" },
    });

    if ((match.status as string) === "finished") {
      break;
    }
  }

  if (match.status === "active" && match.activeSide === side) {
    endTurn(match, side);
  }

  return match;
}




