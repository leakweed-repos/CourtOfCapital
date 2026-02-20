import { getCatalogCard } from "./card-catalog";

const STRICT_BACK_ONLY = new Set<string>([
  "spread_sniper",
  "research_hawk",
  "dark_analyst",
  "forensic_journalist",
  "macro_commentator",
  "borrow_desk_clerk",
  "synthetic_ledger_keeper",
  "doom_researcher",
  "media_handler",
]);

export function isStrictBackOnly(cardId: string): boolean {
  return STRICT_BACK_ONLY.has(cardId);
}

export function isJudgePositiveSpecialistCard(cardId: string): boolean {
  const card = getCatalogCard(cardId);
  if (card.type !== "unit") {
    return false;
  }
  return card.traits.includes("prosecutor") || card.traits.includes("negotiator");
}

export function isJudgeCorruptSpecialistCard(cardId: string): boolean {
  const card = getCatalogCard(cardId);
  if (card.type !== "unit") {
    return false;
  }
  return card.traits.includes("dirty");
}

export function isJudgeSpecialistCard(cardId: string): boolean {
  return isJudgePositiveSpecialistCard(cardId) || isJudgeCorruptSpecialistCard(cardId);
}
