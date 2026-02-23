import { CARD_CATALOG_V2, cardV2ToLegacy } from "./cards/index";
import type { CardDefinition, FactionId } from "./game";

export const SANDBOX_CLEANUP_CARD_IDS = [
  "cleanup_rubble",
  "cleanup_suit_rack",
  "cleanup_emergency_cone",
  "cleanup_wet_floor_sign",
  "cleanup_cart",
] as const;

export const CARD_LIBRARY: Record<string, CardDefinition> = Object.fromEntries(
  CARD_CATALOG_V2.map((card) => {
    const legacy = cardV2ToLegacy(card);
    return [legacy.id, legacy];
  }),
);

export const FACTION_CARD_IDS: Record<FactionId, string[]> = {
  sec: Object.values(CARD_LIBRARY)
    .filter((card) => card.faction === "sec")
    .map((card) => card.id),
  market_makers: Object.values(CARD_LIBRARY)
    .filter((card) => card.faction === "market_makers")
    .map((card) => card.id),
  wallstreet: Object.values(CARD_LIBRARY)
    .filter((card) => card.faction === "wallstreet")
    .map((card) => card.id),
  retail_mob: Object.values(CARD_LIBRARY)
    .filter((card) => card.faction === "retail_mob")
    .map((card) => card.id),
  short_hedgefund: Object.values(CARD_LIBRARY)
    .filter((card) => card.faction === "short_hedgefund")
    .map((card) => card.id),
};

const SANDBOX_CLEANUP_ID_SET = new Set<string>(SANDBOX_CLEANUP_CARD_IDS);

export const NEUTRAL_UTILITY_CARD_IDS: string[] = Object.values(CARD_LIBRARY)
  .filter((card) => (card.faction === "neutral" || card.faction === "utility") && !SANDBOX_CLEANUP_ID_SET.has(card.id))
  .map((card) => card.id);

export function getCatalogCard(cardId: string): CardDefinition {
  const card = CARD_LIBRARY[cardId];
  if (!card) {
    throw new Error(`Unknown card: ${cardId}`);
  }
  return card;
}
