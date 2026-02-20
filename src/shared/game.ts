export const RULES_VERSION = "v0";
export const BOARD_COLS = 5;
export const JUDGE_COL = BOARD_COLS - 1;
export const STARTING_HAND_SIZE = 4;
export const MAX_HAND_SIZE = 20;
export const DECK_SIZE = 100;
export const MULLIGAN_SECONDS = 10;
export const TURN_SECONDS = 35;

export const PREFIX = "coc:v1";

export type MatchMode = "pve" | "pvp";
export type MatchStatus = "mulligan" | "active" | "finished";
export type MatchWinReason = "leader" | "verdict" | "concede";

export type PlayerSide = "A" | "B";
export type Lane = "front" | "back";
export type CardType = "unit" | "instrument" | "upgrade";
export type FactionId = "wallstreet" | "sec" | "market_makers" | "short_hedgefund" | "retail_mob";
export type CardFaction = FactionId | "neutral" | "utility";
export type JudgePenalty = "confiscation" | "stun";

export type CardTrait =
  | "taunt"
  | "ranged"
  | "reach"
  | "rush"
  | "dirty"
  | "prosecutor"
  | "negotiator"
  | "front_only"
  | "back_only"
  | "any_row";

export interface CardDefinition {
  id: string;
  name: string;
  faction: CardFaction;
  type: CardType;
  costShares: number;
  attack?: number;
  health?: number;
  dirtyPower?: number;
  traits: CardTrait[];
  text: string;
}

export interface UnitState {
  id: string;
  owner: PlayerSide;
  cardId: string;
  name: string;
  attack: number;
  health: number;
  maxHealth: number;
  lane: Lane;
  col: number;
  traits: CardTrait[];
  cannotAttackUntilTurn: number;
  shieldCharges?: number;
  stunnedUntilTurn?: number;
  exposedUntilTurn?: number;
  tempAttackPenalty?: number;
  tempAttackPenaltyUntilTurn?: number;
}

export interface EventUnitState {
  id: string;
  name: string;
  kind?: "event" | "iron_curtain";
  ownerSide?: PlayerSide;
  blockedLane?: Lane;
  attack: number;
  health: number;
  maxHealth: number;
  col: number;
  rewardShares: number;
  rewardFavor: number;
}

export interface LeaderState {
  hp: number;
  maxHp: number;
}

export interface PlayerState {
  userId: string;
  username: string;
  faction: FactionId;
  side: PlayerSide;
  isBot: boolean;
  botLevel?: 1 | 2 | 3;
  shares: number;
  favor: number;
  probation: number;
  leader: LeaderState;
  deck: string[];
  hand: string[];
  discard: string[];
  board: {
    front: (string | null)[];
    back: (string | null)[];
  };
  nakedShortDebt: number;
  judgeHostility: number;
  blockedLane?: Lane;
  blockedCol?: number;
  curtainEventId?: string;
  mulliganDone: boolean;
}

export interface MatchLogEntry {
  at: number;
  turn: number;
  text: string;
}

export interface MatchState {
  id: string;
  weekId: string;
  postId: string;
  mode: MatchMode;
  rulesVersion: string;
  status: MatchStatus;
  createdAt: number;
  updatedAt: number;
  seed: number;
  rngCounter: number;
  turn: number;
  activeSide: PlayerSide;
  turnDeadlineAt: number;
  mulliganDeadlineAt: number;
  winnerSide?: PlayerSide;
  winReason?: MatchWinReason;
  verdictGrantedTo?: PlayerSide;
  judgeMood: number;
  eventRow: (string | null)[];
  units: Record<string, UnitState>;
  eventUnits: Record<string, EventUnitState>;
  players: {
    A: PlayerState;
    B: PlayerState;
  };
  log: MatchLogEntry[];
}

export interface InviteState {
  id: string;
  weekId: string;
  postId: string;
  inviterUserId: string;
  inviterUsername: string;
  inviterFaction?: FactionId;
  targetUsername: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  createdAt: number;
  acceptedAt?: number;
  matchId?: string;
}

export interface WeeklyUserStats {
  userId: string;
  username: string;
  wins: number;
  losses: number;
  matches: number;
}

export interface LobbySnapshot {
  weekId: string;
  postId: string;
  pendingInvites: InviteState[];
  ongoingMatchIds: string[];
  leaderboard: WeeklyUserStats[];
}

export interface StartMatchInput {
  weekId: string;
  postId: string;
  mode: MatchMode;
  playerA: {
    userId: string;
    username: string;
    faction?: FactionId;
  };
  playerB: {
    userId: string;
    username: string;
    faction?: FactionId;
    isBot: boolean;
    botLevel?: 1 | 2 | 3;
  };
  seed?: number;
}

export interface MatchActionResult {
  ok: boolean;
  match: MatchState;
  error?: string;
}

export type PlayCardTarget =
  | { kind: "ally-unit"; unitId: string }
  | { kind: "enemy-unit"; unitId: string }
  | { kind: "ally-leader" }
  | { kind: "enemy-leader" };

export interface PlayCardInput {
  side: PlayerSide;
  handIndex: number;
  lane: Lane;
  col: number;
  leverage?: 2 | 3 | 4 | 5;
  target?: PlayCardTarget;
}

export interface AttackInput {
  side: PlayerSide;
  attackerUnitId: string;
  target:
    | { kind: "leader" }
    | { kind: "judge" }
    | { kind: "unit"; unitId: string }
    | { kind: "event"; eventUnitId: string };
}

export interface MulliganInput {
  side: PlayerSide;
  replaceIndices: number[];
}

export interface EndTurnInput {
  side: PlayerSide;
}

export function opponentOf(side: PlayerSide): PlayerSide {
  return side === "A" ? "B" : "A";
}

export function nowTs(): number {
  return Date.now();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function normalizeUsername(name: string): string {
  return name.trim().replace(/^u\//i, "").toLowerCase();
}

export function calcRatio(stats: Pick<WeeklyUserStats, "wins" | "matches">): number {
  if (stats.matches <= 0) {
    return 0;
  }
  return stats.wins / stats.matches;
}

export function leaderboardScore(stats: Pick<WeeklyUserStats, "wins" | "matches">): number {
  const ratioBps = Math.round(calcRatio(stats) * 10_000);
  return stats.wins * 1_000_000 + ratioBps * 100 + stats.matches;
}

export function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hashMix(seed: number, n: number): number {
  let x = (seed ^ n) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

export function seededUnitFloat(seed: number, n: number): number {
  const mixed = hashMix(seed, n);
  return mixed / 4294967296;
}

export function chooseDeterministic<T>(seed: number, n: number, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot choose from empty list");
  }
  const idx = Math.floor(seededUnitFloat(seed, n) * items.length);
  return items[idx] as T;
}

export function uniqueId(prefix: string, seed: number, counter: number): string {
  const suffix = hashMix(seed, counter).toString(16).padStart(8, "0");
  return `${prefix}_${suffix}_${counter}`;
}


