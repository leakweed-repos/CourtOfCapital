import { getCatalogCard } from "./card-catalog";
import { clamp, stableHash, type CardDefinition } from "./game";

export type ResistanceKind = "stun" | "exposed" | "atk_down";

export interface UnitResistanceProfile {
  stun: number;
  exposed: number;
  atkDown: number;
  hasAny: boolean;
  summary: string;
}

const PROFILE_CACHE = new Map<string, UnitResistanceProfile>();

function pct(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}

function jitter(hash: number, shift: number): number {
  const bucket = (hash >>> shift) % 7; // 0..6
  return (bucket - 3) * 0.01; // -3%..+3%
}

function normalizeChance(raw: number): number {
  if (raw < 0.12) {
    return 0;
  }
  return clamp(Number(raw.toFixed(3)), 0, 0.45);
}

function baseByTraits(card: CardDefinition): { stun: number; exposed: number; atkDown: number } {
  let stun = 0;
  let exposed = 0;
  let atkDown = 0;

  if (card.traits.includes("taunt")) {
    stun += 0.18;
    atkDown += 0.12;
  }
  if (card.traits.includes("front_only")) {
    stun += 0.08;
  }
  if (card.traits.includes("back_only") || card.traits.includes("ranged")) {
    exposed += 0.14;
  }
  if (card.traits.includes("dirty")) {
    exposed += 0.11;
    stun += 0.05;
  }
  if (card.traits.includes("prosecutor") || card.traits.includes("negotiator")) {
    atkDown += 0.08;
    exposed += 0.08;
  }

  const hp = card.health ?? 0;
  const atk = card.attack ?? 0;
  if (hp >= 5) {
    stun += 0.08;
    atkDown += 0.08;
  }
  if (atk >= 4) {
    atkDown += 0.06;
  }

  return { stun, exposed, atkDown };
}

function factionBias(card: CardDefinition): { stun: number; exposed: number; atkDown: number } {
  if (card.faction === "sec") {
    return { stun: 0.06, exposed: 0.02, atkDown: 0.04 };
  }
  if (card.faction === "market_makers") {
    return { stun: 0.03, exposed: 0.07, atkDown: 0.04 };
  }
  if (card.faction === "wallstreet") {
    return { stun: 0.04, exposed: 0.03, atkDown: 0.07 };
  }
  if (card.faction === "retail_mob") {
    return { stun: 0.05, exposed: 0.04, atkDown: 0.03 };
  }
  if (card.faction === "short_hedgefund") {
    return { stun: 0.04, exposed: 0.08, atkDown: 0.05 };
  }
  return { stun: 0.03, exposed: 0.03, atkDown: 0.03 };
}

function buildSummary(stun: number, exposed: number, atkDown: number): string {
  const parts: string[] = [];
  if (stun > 0) parts.push(`stun ${pct(stun)}`);
  if (exposed > 0) parts.push(`exposed ${pct(exposed)}`);
  if (atkDown > 0) parts.push(`atk-down ${pct(atkDown)}`);

  if (parts.length === 0) {
    return "Resistance: none.";
  }
  return `Resistance: ${parts.join(" · ")}.`;
}

function computeProfile(cardId: string): UnitResistanceProfile {
  const card = getCatalogCard(cardId);
  if (card.type !== "unit") {
    return {
      stun: 0,
      exposed: 0,
      atkDown: 0,
      hasAny: false,
      summary: "Resistance: n/a (non-unit card).",
    };
  }

  const traits = baseByTraits(card);
  const faction = factionBias(card);
  const hash = stableHash(`resistance:${cardId}`);

  const stun = normalizeChance(traits.stun + faction.stun + jitter(hash, 2));
  const exposed = normalizeChance(traits.exposed + faction.exposed + jitter(hash, 5));
  const atkDown = normalizeChance(traits.atkDown + faction.atkDown + jitter(hash, 8));
  let tunedStun = stun;
  let tunedExposed = exposed;
  let tunedAtkDown = atkDown;

  if (tunedStun <= 0 && tunedExposed <= 0 && tunedAtkDown <= 0) {
    const fallback = (hash >>> 11) % 3;
    if (fallback === 0) tunedStun = 0.13;
    if (fallback === 1) tunedExposed = 0.13;
    if (fallback === 2) tunedAtkDown = 0.13;
  }

  const hasAny = tunedStun > 0 || tunedExposed > 0 || tunedAtkDown > 0;

  return {
    stun: tunedStun,
    exposed: tunedExposed,
    atkDown: tunedAtkDown,
    hasAny,
    summary: buildSummary(tunedStun, tunedExposed, tunedAtkDown),
  };
}

export function getUnitResistanceProfile(cardId: string): UnitResistanceProfile {
  const cached = PROFILE_CACHE.get(cardId);
  if (cached) {
    return cached;
  }
  const profile = computeProfile(cardId);
  PROFILE_CACHE.set(cardId, profile);
  return profile;
}

export function getResistanceChance(cardId: string, kind: ResistanceKind): number {
  const profile = getUnitResistanceProfile(cardId);
  if (kind === "stun") {
    return profile.stun;
  }
  if (kind === "exposed") {
    return profile.exposed;
  }
  return profile.atkDown;
}

export function getUnitResistanceSummary(cardId: string): string {
  return getUnitResistanceProfile(cardId).summary;
}
