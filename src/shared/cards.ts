import { CARD_LIBRARY } from "./card-catalog";
import { getCardEffectDescriptor, getCardRole, type CardRole, type CardTargetRule } from "./card-effects";
import type { CardDefinition } from "./game";
import { isStrictBackOnly } from "./placement";
import { getUnitResistanceSummary } from "./resistance";

type CardRow = "1" | "2" | "1/2";

export type CardPreviewMeta = {
  id: string;
  name: string;
  faction: CardDefinition["faction"];
  type: CardDefinition["type"];
  attack: number | null;
  defense: number | null;
  row: CardRow;
  costShares: number;
  dirtyPower: number;
  role: CardRole;
  effectText: string;
  resistanceText: string;
  flavorText: string;
  text: string;
  targetRule: CardTargetRule;
  traits: CardDefinition["traits"];
  artPath: string;
};

function rowFromTraits(cardId: string, traits: CardDefinition["traits"]): CardRow {
  if (traits.includes("back_only")) return isStrictBackOnly(cardId) ? "2" : "1/2";
  if (traits.includes("front_only") || traits.includes("taunt")) return "1";
  return "1/2";
}

export const CARD_PREVIEW: Record<string, CardPreviewMeta> = Object.fromEntries(
  Object.values(CARD_LIBRARY).map((card) => {
    const effect = getCardEffectDescriptor(card.id);
    const flavorText = card.text.trim();
    return [
      card.id,
      {
        id: card.id,
        name: card.name,
        faction: card.faction,
        type: card.type,
        attack: card.attack ?? null,
        defense: card.health ?? null,
        row: rowFromTraits(card.id, card.traits),
        costShares: card.costShares,
        dirtyPower: card.dirtyPower ?? 0,
        role: getCardRole(card.id),
        effectText: effect.summary,
        resistanceText: getUnitResistanceSummary(card.id),
        flavorText,
        text: effect.summary,
        targetRule: effect.targetRule,
        traits: card.traits,
        artPath: `/assets/cards/${card.id}.png`,
      } satisfies CardPreviewMeta,
    ];
  }),
);

export function getCardPreview(cardId: string): CardPreviewMeta {
  return (
    CARD_PREVIEW[cardId] ?? {
      id: cardId,
      name: cardId,
      faction: "neutral",
      type: "unit",
      attack: null,
      defense: null,
      row: "1/2",
      costShares: 0,
      dirtyPower: 0,
      role: "utility",
      effectText: "Card metadata missing.",
      resistanceText: "Resistance: n/a (non-unit card).",
      flavorText: "",
      text: "Card metadata missing.",
      targetRule: "none",
      traits: [],
      artPath: "/assets/cards/placeholder.png",
    }
  );
}
