import type { CardTrait } from "../game";
import type { CardKeyword } from "./schema";

export type CardKeywordDefinition = {
  key: CardKeyword;
  label: string;
  summary: string;
  legacyTrait: CardTrait;
};

export const CARD_KEYWORD_DEFINITIONS: Record<CardKeyword, CardKeywordDefinition> = {
  rush: {
    key: "rush",
    label: "Rush",
    summary: "Can attack immediately.",
    legacyTrait: "rush",
  },
  reach: {
    key: "reach",
    label: "Reach",
    summary: "Can attack enemy back row.",
    legacyTrait: "reach",
  },
  ranged: {
    key: "ranged",
    label: "Ranged",
    summary: "Backline attacker that can pressure protected targets.",
    legacyTrait: "ranged",
  },
  flip: {
    key: "flip",
    label: "Flip",
    summary: "Can deploy onto an occupied ally slot at extra cost.",
    legacyTrait: "flip",
  },
  dirty: {
    key: "dirty",
    label: "Dirty",
    summary: "Increases Judge catch risk and corruption synergies.",
    legacyTrait: "dirty",
  },
  prosecutor: {
    key: "prosecutor",
    label: "Prosecutor",
    summary: "Judge green synergy keyword.",
    legacyTrait: "prosecutor",
  },
  negotiator: {
    key: "negotiator",
    label: "Negotiator",
    summary: "Judge green synergy keyword.",
    legacyTrait: "negotiator",
  },
};

export function keywordToLegacyTrait(keyword: CardKeyword): CardTrait {
  return CARD_KEYWORD_DEFINITIONS[keyword].legacyTrait;
}
