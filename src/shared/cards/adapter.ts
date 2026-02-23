import type { CardDefinition, CardTrait } from "../game";
import { keywordToLegacyTrait } from "./keywords";
import type { CardSpecialDef, CardV2, UnitCardV2 } from "./schema";

function pushUniqueTrait(out: CardTrait[], trait: CardTrait): void {
  if (!out.includes(trait)) {
    out.push(trait);
  }
}

function unitLaneTraits(unit: UnitCardV2): CardTrait[] {
  if (unit.lane === "front") {
    return ["front_only"];
  }
  if (unit.lane === "back") {
    return ["back_only"];
  }
  return ["any_row"];
}

function applySpecialTraits(out: CardTrait[], specials: readonly CardSpecialDef[] | undefined): void {
  if (!specials) {
    return;
  }
  for (const special of specials) {
    if (special.kind === "taunt") {
      pushUniqueTrait(out, "taunt");
      pushUniqueTrait(out, "front_only");
    }
  }
}

export function cardV2ToLegacy(card: CardV2): CardDefinition {
  const baseTraits: CardTrait[] = [];

  if (card.kind === "unit") {
    for (const trait of unitLaneTraits(card)) {
      pushUniqueTrait(baseTraits, trait);
    }
  }

  for (const keyword of card.keywords ?? []) {
    pushUniqueTrait(baseTraits, keywordToLegacyTrait(keyword));
  }

  applySpecialTraits(baseTraits, card.specials);

  if (card.kind === "unit") {
    return {
      id: card.id,
      name: card.name,
      faction: card.faction,
      type: "unit",
      costShares: card.costShares,
      attack: card.stats.attack,
      health: card.stats.health,
      dirtyPower: card.dirtyPower ?? 0,
      traits: baseTraits.length > 0 ? baseTraits : ["any_row"],
      text: card.description,
    };
  }

  return {
    id: card.id,
    name: card.name,
    faction: card.faction,
    type: card.kind,
    costShares: card.costShares,
    dirtyPower: card.dirtyPower ?? 0,
    traits: baseTraits,
    text: card.description,
  };
}

export function buildLegacyCardLibraryFromV2(cards: readonly CardV2[]): Record<string, CardDefinition> {
  const out: Record<string, CardDefinition> = {};
  for (const card of cards) {
    if (out[card.id]) {
      throw new Error(`Duplicate V2 card id in adapter: ${card.id}`);
    }
    out[card.id] = cardV2ToLegacy(card);
  }
  return out;
}
