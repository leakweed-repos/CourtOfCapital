import type { CardCatalogV2 } from "../schema";
import { assertValidCardCatalogV2 } from "../validators";
import { LEGACY_EXPLICIT_UNIT_RUNTIME_CARD_IDS } from "../legacy-explicit-unit-runtime";
import { applyCourtCasesToCatalog } from "../court-cases";
import { MARKET_MAKERS_CARDS_V2 } from "./market-makers";
import { NEUTRAL_AND_UTILITY_CARDS_V2 } from "./neutral-and-utility";
import { RETAIL_MOB_CARDS_V2 } from "./retail-mob";
import { SEC_CARDS_V2 } from "./sec";
import { SHORT_HEDGEFUND_CARDS_V2 } from "./short-hedgefund";
import { WALLSTREET_CARDS_V2 } from "./wallstreet";
import { CARD_CATALOG_V2_SNAPSHOT } from "./generated-all";

export {
  MARKET_MAKERS_CARDS_V2,
  NEUTRAL_AND_UTILITY_CARDS_V2,
  RETAIL_MOB_CARDS_V2,
  SEC_CARDS_V2,
  SHORT_HEDGEFUND_CARDS_V2,
  WALLSTREET_CARDS_V2,
};

const MANUAL_V2_OVERRIDES: CardCatalogV2 = [
  ...SEC_CARDS_V2,
  ...MARKET_MAKERS_CARDS_V2,
  ...WALLSTREET_CARDS_V2,
  ...RETAIL_MOB_CARDS_V2,
  ...SHORT_HEDGEFUND_CARDS_V2,
  ...NEUTRAL_AND_UTILITY_CARDS_V2,
];

export const GENERATED_LEGACY_CARDS_V2: CardCatalogV2 = CARD_CATALOG_V2_SNAPSHOT;

function mergeCardCatalogs(base: CardCatalogV2, overrides: CardCatalogV2): CardCatalogV2 {
  const byId = new Map<string, CardCatalogV2[number]>();
  for (const card of base) {
    byId.set(card.id, card);
  }
  for (const card of overrides) {
    byId.set(card.id, card);
  }
  return [...byId.values()];
}

export const CARD_CATALOG_V2: CardCatalogV2 = applyCourtCasesToCatalog(
  mergeCardCatalogs(CARD_CATALOG_V2_SNAPSHOT, MANUAL_V2_OVERRIDES),
);

assertValidCardCatalogV2(CARD_CATALOG_V2);

export const CARD_CATALOG_V2_BY_ID: Record<string, (typeof CARD_CATALOG_V2)[number]> = Object.fromEntries(
  CARD_CATALOG_V2.map((card) => [card.id, card]),
);

export function getCardV2ById(cardId: string): (typeof CARD_CATALOG_V2)[number] | undefined {
  return CARD_CATALOG_V2_BY_ID[cardId];
}

export function hasCardV2(cardId: string): boolean {
  return Boolean(CARD_CATALOG_V2_BY_ID[cardId]);
}

export type V2MigrationReport = {
  totalCards: number;
  legacyCatalogCards: number;
  generatedCards: number;
  manualOverrideCards: number;
  unresolvedLegacyNonUnitRuntimeCards: number;
  unresolvedLegacyExplicitUnitRuntimeCards: number;
  unresolvedLegacyExplicitUnitRuntimeIds: string[];
  unresolvedLegacyNonUnitRuntimeIds: string[];
};

export const V2_MIGRATION_REPORT: V2MigrationReport = {
  totalCards: CARD_CATALOG_V2.length,
  legacyCatalogCards: CARD_CATALOG_V2.length,
  generatedCards: GENERATED_LEGACY_CARDS_V2.length,
  manualOverrideCards: MANUAL_V2_OVERRIDES.length,
  unresolvedLegacyNonUnitRuntimeCards: CARD_CATALOG_V2.filter((card) => card.kind !== "unit").length,
  unresolvedLegacyExplicitUnitRuntimeCards: LEGACY_EXPLICIT_UNIT_RUNTIME_CARD_IDS.length,
  unresolvedLegacyExplicitUnitRuntimeIds: [...LEGACY_EXPLICIT_UNIT_RUNTIME_CARD_IDS],
  unresolvedLegacyNonUnitRuntimeIds: CARD_CATALOG_V2.filter((card) => card.kind !== "unit").map((card) => card.id),
};

export const SEC_CARDS_V2_FULL: CardCatalogV2 = CARD_CATALOG_V2.filter((card) => card.faction === "sec");
export const MARKET_MAKERS_CARDS_V2_FULL: CardCatalogV2 = CARD_CATALOG_V2.filter((card) => card.faction === "market_makers");
export const WALLSTREET_CARDS_V2_FULL: CardCatalogV2 = CARD_CATALOG_V2.filter((card) => card.faction === "wallstreet");
export const RETAIL_MOB_CARDS_V2_FULL: CardCatalogV2 = CARD_CATALOG_V2.filter((card) => card.faction === "retail_mob");
export const SHORT_HEDGEFUND_CARDS_V2_FULL: CardCatalogV2 = CARD_CATALOG_V2.filter((card) => card.faction === "short_hedgefund");
export const NEUTRAL_AND_UTILITY_CARDS_V2_FULL: CardCatalogV2 = CARD_CATALOG_V2.filter(
  (card) => card.faction === "neutral" || card.faction === "utility",
);
