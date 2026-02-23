import { buildCardImpactTextV2, getCardV2ById } from "./cards/index";

export type CardTargetRule = "none" | "ally-unit" | "enemy-unit" | "ally-unit-or-leader" | "enemy-unit-or-leader";
export type CardRole = "offensive" | "defensive" | "bureaucrat" | "utility";

export type CardEffectDescriptor = {
  targetRule: CardTargetRule;
  summary: string;
};

function roleFromV2(cardId: string): CardRole {
  const card = getCardV2ById(cardId);
  if (!card) {
    throw new Error(`Missing V2 card for effect role: ${cardId}`);
  }
  if (card.role === "defense") {
    return "defensive";
  }
  if (card.role === "support" || card.role === "control") {
    return "bureaucrat";
  }
  if (card.role === "economy" || card.role === "utility") {
    return "utility";
  }
  return "offensive";
}

export function getCardEffectDescriptor(cardId: string): CardEffectDescriptor {
  const card = getCardV2ById(cardId);
  if (!card) {
    throw new Error(`Missing V2 card for effect descriptor: ${cardId}`);
  }
  return {
    targetRule: card.impactTargetRule ?? "none",
    summary: buildCardImpactTextV2(card),
  };
}

export function getCardRole(cardId: string): CardRole {
  return roleFromV2(cardId);
}
