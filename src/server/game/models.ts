import { BOARD_COLS, DECK_SIZE, JUDGE_COL, STARTING_HAND_SIZE, type CardDefinition, type FactionId } from "../../shared/game";
import { CARD_LIBRARY, FACTION_CARD_IDS, NEUTRAL_UTILITY_CARD_IDS, getCatalogCard } from "../../shared/card-catalog";
import {
  isJudgeCorruptSpecialistCard,
  isJudgePositiveSpecialistCard,
  isStrictBackOnly,
} from "../../shared/placement";

export const DEFAULT_LEADER_HP = 30;
export const DEFAULT_STARTING_SHARES = 1000;
export const DEFAULT_FACTION: FactionId = "market_makers";
export const STARTING_HAND = STARTING_HAND_SIZE;

const FACTION_DECK_COUNT = 70;
const NEUTRAL_UTILITY_DECK_COUNT = 30;

export { CARD_LIBRARY };

export function getCard(cardId: string): CardDefinition {
  return getCatalogCard(cardId);
}

function createRng(seed: number): () => number {
  let state = seed | 0;
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function maxCopiesForCard(cardId: string): number {
  return getCard(cardId).type === "unit" ? 3 : 4;
}

function pickCardsWithCap(
  pool: string[],
  count: number,
  copies: Map<string, number>,
  rng: () => number,
): string[] {
  const out: string[] = [];
  while (out.length < count) {
    const eligible = pool.filter((id) => (copies.get(id) ?? 0) < maxCopiesForCard(id));
    if (eligible.length === 0) {
      break;
    }
    const idx = Math.floor(rng() * eligible.length);
    const chosen = eligible[idx] as string;
    out.push(chosen);
    copies.set(chosen, (copies.get(chosen) ?? 0) + 1);
  }
  return out;
}

function shuffleInPlace(cards: string[], rng: () => number): void {
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j] as string, cards[i] as string];
  }
}

function reduceTopDeckStreaks(deck: string[], seed: number, topWindow: number, maxRun: number): string[] {
  const out = [...deck];
  const limit = Math.min(out.length, Math.max(0, topWindow));
  const rng = createRng(seed ^ 0x51c3);

  for (let i = 0; i < limit; i += 1) {
    let run = 1;
    while (i + run < limit && out[i + run] === out[i]) {
      run += 1;
    }
    if (run <= maxRun) {
      i += run - 1;
      continue;
    }
    for (let k = i + maxRun; k < i + run && k < limit; k += 1) {
      let swapIdx = -1;
      const start = Math.max(k + 1, limit);
      for (let probe = start; probe < out.length; probe += 1) {
        if (out[probe] !== out[i]) {
          swapIdx = probe;
          break;
        }
      }
      if (swapIdx < 0) {
        for (let probe = k + 1; probe < limit; probe += 1) {
          if (out[probe] !== out[i]) {
            swapIdx = probe;
            break;
          }
        }
      }
      if (swapIdx >= 0) {
        [out[k], out[swapIdx]] = [out[swapIdx] as string, out[k] as string];
      } else {
        const j = Math.floor(rng() * out.length);
        [out[k], out[j]] = [out[j] as string, out[k] as string];
      }
    }
    i += run - 1;
  }

  return out;
}

export function buildDeck(seed: number, faction: FactionId): string[] {
  const rng = createRng(seed ^ 0x17a9d);
  const factionPool = FACTION_CARD_IDS[faction] ?? FACTION_CARD_IDS[DEFAULT_FACTION];
  const neutralUtilityPool = NEUTRAL_UTILITY_CARD_IDS;
  const copies = new Map<string, number>();

  const factionCards = pickCardsWithCap(factionPool, FACTION_DECK_COUNT, copies, rng);
  const neutralUtilityCards = pickCardsWithCap(neutralUtilityPool, NEUTRAL_UTILITY_DECK_COUNT, copies, rng);
  const cards = [...factionCards, ...neutralUtilityCards];

  if (cards.length < DECK_SIZE) {
    const allPool = [...factionPool, ...neutralUtilityPool];
    const rest = pickCardsWithCap(allPool, DECK_SIZE - cards.length, copies, rng);
    cards.push(...rest);
  }

  shuffleInPlace(cards, rng);
  return reduceTopDeckStreaks(cards.slice(0, DECK_SIZE), seed ^ 0x7a31, 28, 2);
}

export function drawCards(deck: string[], count: number): { nextDeck: string[]; drawn: string[] } {
  const drawn = deck.slice(0, count);
  const nextDeck = deck.slice(count);
  return { nextDeck, drawn };
}

export function canPlaceCardInLane(cardId: string, lane: "front" | "back", col?: number): boolean {
  const card = getCard(cardId);
  if (card.type !== "unit") return true;
  let baseAllowed = true;
  if (card.traits.includes("taunt") || card.traits.includes("front_only")) {
    baseAllowed = lane === "front";
  } else if (card.traits.includes("back_only")) {
    baseAllowed = isStrictBackOnly(cardId) ? lane === "back" : true;
  }

  if (baseAllowed) {
    return true;
  }

  if (col !== JUDGE_COL) {
    return false;
  }
  if (lane === "front") {
    return isJudgePositiveSpecialistCard(cardId);
  }
  return isJudgeCorruptSpecialistCard(cardId);
}

export function inBoundsCol(col: number): boolean {
  return Number.isInteger(col) && col >= 0 && col < BOARD_COLS;
}

export function simpleAiPreferredCol(sideSeed: number, turn: number): number {
  const rng = createRng(sideSeed ^ turn ^ 0x3377);
  return Math.floor(rng() * BOARD_COLS);
}

export function aiPickPlayableIndex(hand: string[], shares: number): number {
  for (let i = 0; i < hand.length; i += 1) {
    const card = getCard(hand[i] as string);
    const spendCost = card.type === "unit" || card.id === "naked_shorting" ? card.costShares : 0;
    if (spendCost <= shares) return i;
  }
  return -1;
}
