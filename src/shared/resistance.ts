import { getCardV2ById } from "./cards/index";

export type ResistanceKind = "stun" | "exposed" | "atk_down";

export type UnitResistanceProfile = {
  stun: number;
  exposed: number;
  atkDown: number;
  hasAny: boolean;
  summary: string;
};

const PROFILE_CACHE = new Map<string, UnitResistanceProfile>();

function pct(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}

function buildSummary(stun: number, exposed: number, atkDown: number): string {
  const parts: string[] = [];
  if (stun > 0) parts.push(`stun ${pct(stun)}`);
  if (exposed > 0) parts.push(`exposed ${pct(exposed)}`);
  if (atkDown > 0) parts.push(`atk-down ${pct(atkDown)}`);
  if (parts.length === 0) {
    return "Resistance: none.";
  }
  return `Resistance: ${parts.join(" | ")}.`;
}

function emptyUnitProfile(): UnitResistanceProfile {
  return {
    stun: 0,
    exposed: 0,
    atkDown: 0,
    hasAny: false,
    summary: "Resistance: none.",
  };
}

function computeProfile(cardId: string): UnitResistanceProfile {
  const card = getCardV2ById(cardId);
  if (!card) {
    return emptyUnitProfile();
  }
  if (card.kind !== "unit") {
    return {
      stun: 0,
      exposed: 0,
      atkDown: 0,
      hasAny: false,
      summary: "Resistance: n/a (non-unit card).",
    };
  }

  const resistanceSpecial = (card.specials ?? []).find((special) => special.kind === "resistance");
  if (!resistanceSpecial || resistanceSpecial.kind !== "resistance") {
    return emptyUnitProfile();
  }

  const stun = resistanceSpecial.stun ?? 0;
  const exposed = resistanceSpecial.exposed ?? 0;
  const atkDown = resistanceSpecial.atkDown ?? 0;
  const hasAny = stun > 0 || exposed > 0 || atkDown > 0;

  return {
    stun,
    exposed,
    atkDown,
    hasAny,
    summary: buildSummary(stun, exposed, atkDown),
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
