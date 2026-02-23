import { CARD_KEYWORD_DEFINITIONS } from "./keywords";
import type { CardActionDef, CardCatalogV2, CardSpecialDef, CardV2 } from "./schema";

export type CardValidationIssue = {
  cardId?: string;
  path: string;
  message: string;
};

function issue(path: string, message: string, cardId?: string): CardValidationIssue {
  if (typeof cardId === "string") {
    return { cardId, path, message };
  }
  return { path, message };
}

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function pushDuplicateIssues(values: readonly string[], path: string, issues: CardValidationIssue[], cardId: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      issues.push(issue(path, `Duplicate value "${value}".`, cardId));
      continue;
    }
    seen.add(value);
  }
}

function validateResistanceSpecial(special: Extract<CardSpecialDef, { kind: "resistance" }>, cardId: string): CardValidationIssue[] {
  const issues: CardValidationIssue[] = [];
  const pairs: Array<[string, number | undefined]> = [
    ["stun", special.stun],
    ["exposed", special.exposed],
    ["atkDown", special.atkDown],
  ];
  let hasValue = false;
  for (const [key, value] of pairs) {
    if (typeof value !== "number") {
      continue;
    }
    hasValue = true;
    if (value < 0) {
      issues.push(issue(`specials.resistance.${key}`, "Resistance cannot be negative.", cardId));
    }
    if (value > 1) {
      issues.push(issue(`specials.resistance.${key}`, "Resistance must be in range 0..1 (fractional, e.g. 0.2 = 20%).", cardId));
    }
  }
  if (!hasValue) {
    issues.push(issue("specials.resistance", "Resistance special must define at least one value.", cardId));
  }
  return issues;
}

function validateSpecials(card: CardV2): CardValidationIssue[] {
  const issues: CardValidationIssue[] = [];
  const specials = card.specials ?? [];
  let tauntCount = 0;
  let resistanceCount = 0;

  for (const [i, special] of specials.entries()) {
    if (special.kind === "taunt") {
      tauntCount += 1;
      if (card.kind !== "unit") {
        issues.push(issue(`specials[${i}]`, "Taunt special is only valid on unit cards.", card.id));
      } else if (card.lane !== "front") {
        issues.push(issue(`specials[${i}]`, "Taunt units must use front lane in V2 schema.", card.id));
      }
      continue;
    }

    if (special.kind === "shield_on_summon") {
      if (card.kind !== "unit") {
        issues.push(issue(`specials[${i}]`, "Shield-on-summon special is only valid on unit cards.", card.id));
      }
      if (!isPositiveInt(special.amount)) {
        issues.push(issue(`specials[${i}].amount`, "Shield amount must be a positive integer.", card.id));
      }
      continue;
    }

    resistanceCount += 1;
    issues.push(...validateResistanceSpecial(special, card.id));
  }

  if (tauntCount > 1) {
    issues.push(issue("specials", "Only one taunt special is allowed per card.", card.id));
  }
  if (resistanceCount > 1) {
    issues.push(issue("specials", "Only one resistance special is allowed per card.", card.id));
  }

  return issues;
}

function validateAction(action: CardActionDef, cardId: string, triggerIndex: number, actionIndex: number): CardValidationIssue[] {
  const issues: CardValidationIssue[] = [];
  const path = `triggers[${triggerIndex}].actions[${actionIndex}]`;

  if (action.kind === "gain_shield" || action.kind === "heal" || action.kind === "gain_shares" || action.kind === "draw_card") {
    if (!isPositiveInt(action.amount)) {
      issues.push(issue(`${path}.amount`, "Amount must be a positive integer.", cardId));
    }
    return issues;
  }

  if (action.kind === "cleanse") {
    return issues;
  }

  if (action.kind === "apply_status") {
    if (!isPositiveInt(action.turns)) {
      issues.push(issue(`${path}.turns`, "Status turns must be a positive integer.", cardId));
    }
    return issues;
  }

  if (!Number.isInteger(action.amount) || action.amount === 0) {
    issues.push(issue(`${path}.amount`, "Attack modifier must be a non-zero integer.", cardId));
  }
  return issues;
}

function validateTriggers(card: CardV2): CardValidationIssue[] {
  const issues: CardValidationIssue[] = [];
  const triggers = card.triggers ?? [];
  const combatEvents = new Set(["on_hit", "on_kill", "after_combat_survived"]);

  for (const [i, trigger] of triggers.entries()) {
    if (trigger.actions.length === 0) {
      issues.push(issue(`triggers[${i}].actions`, "Trigger must contain at least one action.", card.id));
    }
    if ((trigger.requires ?? []).length > 0 && !combatEvents.has(trigger.when)) {
      issues.push(issue(`triggers[${i}].requires`, "Trigger conditions are only valid for combat triggers.", card.id));
    }
    for (const [j, action] of trigger.actions.entries()) {
      if (
        "target" in action &&
        action.target === "hit_target" &&
        !(trigger.when === "on_hit" || trigger.when === "on_kill" || trigger.when === "after_combat_survived")
      ) {
        issues.push(issue(`triggers[${i}].actions[${j}].target`, "hit_target can only be used in combat triggers.", card.id));
      }
      issues.push(...validateAction(action, card.id, i, j));
    }
  }

  return issues;
}

export function validateCardV2(card: CardV2): CardValidationIssue[] {
  const issues: CardValidationIssue[] = [];

  if (card.id.trim().length === 0) {
    issues.push(issue("id", "Card id is required.", card.id));
  }
  if (card.name.trim().length === 0) {
    issues.push(issue("name", "Card name is required.", card.id));
  }
  if (card.description.trim().length === 0) {
    issues.push(issue("description", "Card description is required.", card.id));
  }
  if (typeof card.court_case !== "string" || card.court_case.trim().length === 0) {
    issues.push(issue("court_case", "Card court_case is required.", card.id));
  }
  if (typeof card.mechanicsSummary === "string" && card.mechanicsSummary.trim().length === 0) {
    issues.push(issue("mechanicsSummary", "mechanicsSummary cannot be empty when provided.", card.id));
  }
  if (!Number.isInteger(card.costShares) || card.costShares < 0) {
    issues.push(issue("costShares", "costShares must be an integer >= 0.", card.id));
  }

  const keywords = card.keywords ?? [];
  pushDuplicateIssues(keywords, "keywords", issues, card.id);
  for (const keyword of keywords) {
    if (!CARD_KEYWORD_DEFINITIONS[keyword]) {
      issues.push(issue("keywords", `Unknown keyword "${keyword}".`, card.id));
    }
  }

  if (card.kind === "unit") {
    if (!isPositiveInt(card.stats.attack)) {
      issues.push(issue("stats.attack", "Unit attack must be a positive integer.", card.id));
    }
    if (!isPositiveInt(card.stats.health)) {
      issues.push(issue("stats.health", "Unit health must be a positive integer.", card.id));
    }
  }
  if (card.kind !== "unit" && card.specials && card.specials.length > 0) {
    const invalid = card.specials.filter((special) => special.kind !== "resistance");
    if (invalid.length > 0) {
      issues.push(issue("specials", "Non-unit cards cannot use unit-only specials.", card.id));
    }
  }

  issues.push(...validateSpecials(card));
  issues.push(...validateTriggers(card));
  return issues;
}

export function validateCardCatalogV2(cards: CardCatalogV2): CardValidationIssue[] {
  const issues: CardValidationIssue[] = [];
  const ids = new Set<string>();

  for (const [i, card] of cards.entries()) {
    if (ids.has(card.id)) {
      issues.push(issue(`cards[${i}].id`, `Duplicate card id "${card.id}" in catalog.`, card.id));
    } else {
      ids.add(card.id);
    }
    issues.push(...validateCardV2(card));
  }

  return issues;
}

export function assertValidCardCatalogV2(cards: CardCatalogV2): void {
  const issues = validateCardCatalogV2(cards);
  if (issues.length === 0) {
    return;
  }
  const lines = issues.map((one) => {
    const prefix = one.cardId ? `[${one.cardId}] ` : "";
    return `${prefix}${one.path}: ${one.message}`;
  });
  throw new Error(`Invalid V2 card catalog:\n${lines.join("\n")}`);
}
