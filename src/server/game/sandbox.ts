import {
  BOARD_COLS,
  MAX_HAND_SIZE,
  nowTs,
  type MatchState,
  type PlayerSide,
  type UnitState,
  uniqueId,
} from "../../shared/game";
import { SANDBOX_CLEANUP_CARD_IDS } from "../../shared/card-catalog";
import { getCard } from "./models";

const SANDBOX_HAND_SIZE = 12;
const SANDBOX_PLAYER_SHARES = 10_000;
const SANDBOX_BAILIFF_LEADER_HP = 100;
const SANDBOX_TURN_SECONDS_PLAYER = 90;
const BOARD_LANES: Array<"front" | "back"> = ["front", "back"];

const CLEANUP_CARD_ID_SET = new Set<string>(SANDBOX_CLEANUP_CARD_IDS);

function repeatedCleanupDeck(size: number): string[] {
  const out: string[] = [];
  while (out.length < size) {
    for (const cardId of SANDBOX_CLEANUP_CARD_IDS) {
      out.push(cardId);
      if (out.length >= size) {
        break;
      }
    }
  }
  return out;
}

function drawToHandSize(match: MatchState, side: PlayerSide, desiredHandSize: number): void {
  const player = match.players[side];
  while (player.hand.length < desiredHandSize && player.hand.length < MAX_HAND_SIZE && player.deck.length > 0) {
    const cardId = player.deck.shift();
    if (!cardId) {
      break;
    }
    player.hand.push(cardId);
  }
}

function spawnCleanupUnit(
  match: MatchState,
  side: PlayerSide,
  lane: "front" | "back",
  col: number,
  cardId: string,
  shieldCharges = 3,
): string {
  const card = getCard(cardId);
  const unitId = uniqueId("u", match.seed, match.rngCounter + 2_001);
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
    cannotAttackUntilTurn: match.turn + 1,
    shieldCharges,
  };

  match.units[unitId] = unit;
  match.players[side].board[lane][col] = unitId;
  return unitId;
}

function fillBailiffBoard(match: MatchState): void {
  let cursor = 0;
  for (const lane of BOARD_LANES) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const cardId =
        SANDBOX_CLEANUP_CARD_IDS[cursor % SANDBOX_CLEANUP_CARD_IDS.length] ??
        SANDBOX_CLEANUP_CARD_IDS[0];
      if (!cardId) {
        continue;
      }
      cursor += 1;
      spawnCleanupUnit(match, "B", lane, col, cardId, 3);
    }
  }
}

export function isSandboxCleanupCard(cardId: string): boolean {
  return CLEANUP_CARD_ID_SET.has(cardId);
}

export function setupCleanupSandboxMatch(match: MatchState, now = nowTs()): MatchState {
  const playerA = match.players.A;
  const playerB = match.players.B;

  match.mode = "sandbox";
  match.tutorial = undefined;
  match.turnSecondsBySide = {
    A: SANDBOX_TURN_SECONDS_PLAYER,
  };
  match.status = "active";
  match.turn = 1;
  match.activeSide = "A";
  match.winnerSide = undefined;
  match.winReason = undefined;
  match.verdictGrantedTo = undefined;
  match.judgeMood = 0;

  playerA.isBot = false;
  playerA.botLevel = undefined;
  playerA.shares = SANDBOX_PLAYER_SHARES;
  playerA.favor = 0;
  playerA.probation = 0;
  playerA.leader.hp = playerA.leader.maxHp;
  playerA.nakedShortDebt = 0;
  playerA.judgeHostility = 0;
  playerA.blockedLane = undefined;
  playerA.blockedCol = undefined;
  playerA.curtainEventId = undefined;
  playerA.mulliganDone = true;
  playerA.discard = [];
  playerA.board.front = new Array(BOARD_COLS).fill(null);
  playerA.board.back = new Array(BOARD_COLS).fill(null);
  drawToHandSize(match, "A", SANDBOX_HAND_SIZE);

  playerB.isBot = true;
  playerB.botLevel = undefined;
  playerB.shares = 0;
  playerB.favor = 0;
  playerB.probation = 0;
  playerB.leader.maxHp = SANDBOX_BAILIFF_LEADER_HP;
  playerB.leader.hp = SANDBOX_BAILIFF_LEADER_HP;
  playerB.nakedShortDebt = 0;
  playerB.judgeHostility = 0;
  playerB.blockedLane = undefined;
  playerB.blockedCol = undefined;
  playerB.curtainEventId = undefined;
  playerB.mulliganDone = true;
  playerB.hand = [];
  playerB.deck = repeatedCleanupDeck(100);
  playerB.discard = [];
  playerB.board.front = new Array(BOARD_COLS).fill(null);
  playerB.board.back = new Array(BOARD_COLS).fill(null);

  match.units = {};
  match.eventUnits = {};
  match.eventRow = new Array(BOARD_COLS).fill(null);
  fillBailiffBoard(match);

  match.mulliganDeadlineAt = now;
  match.turnDeadlineAt = now + SANDBOX_TURN_SECONDS_PLAYER * 1_000;
  match.log = [
    {
      at: now,
      turn: 1,
      text: "Cleanup sandbox started. Clear the courtroom and test your faction loadout.",
    },
  ];
  match.updatedAt = now;

  return match;
}
