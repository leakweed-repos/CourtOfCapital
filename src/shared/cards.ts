import { CARD_LIBRARY } from "./card-catalog";
import { getCardEffectDescriptor, getCardRole, type CardRole, type CardTargetRule } from "./card-effects";
import type { CardDefinition } from "./game";
import { getJudgeSpecialistSummary } from "./judge-specialists";
import { getUnitResistanceSummary } from "./resistance";
import {
  CARD_KEYWORD_DEFINITIONS,
  getCardV2ById,
  type CardActionDef,
  type CardSpecialDef,
  type CardTriggerCondition,
  type CardTriggerDef,
  type CardV2,
} from "./cards/index";

type CardRow = "1" | "2" | "1/2";

export const DEFAULT_CARD_ART_PATH = "/assets/cards/fallback_default.png";

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
  cardImpactLine: string;
  roleLine: string;
  abilitiesLine: string;
  triggersLine?: string;
  specialsLine?: string;
  judgeMechanicsLine?: string;
  factionPassiveLine: string;
  survivalLine: string;
  courtRecordText: string;
  fullEffectShortText: string;
  artPath: string;
  artFallbackPath: string;
  artFallbackPaths: string[];
};

const NO_COMBAT_ABILITIES_PLACEHOLDER = "No listed combat abilities.";
const NO_COMBAT_ABILITIES_VARIANTS = [
  "No special abilities. Just pure skill.",
  "No tricks listed. Timing does the work.",
  "No combat abilities. Clean fundamentals.",
  "No fancy text. Just board presence.",
  "No listed tech. Honest stats, honest violence.",
  "No special sauce. Only good decisions.",
  "No gimmicks here. Play it sharp.",
  "No extra buttons. Just pressure and tempo.",
  "No combat text. Raw execution only.",
];

function rowFromTraits(_cardId: string, traits: CardDefinition["traits"]): CardRow {
  if (traits.includes("back_only")) return "2";
  if (traits.includes("front_only") || traits.includes("taunt")) return "1";
  return "1/2";
}

function buildArtPaths(card: CardDefinition): { artPath: string; artFallbackPath: string; artFallbackPaths: string[] } {
  const preferredSvg = `/assets/cards/${card.faction}/${card.id}.svg`;
  const preferredPng = `/assets/cards/${card.faction}/${card.id}.png`;
  const fallbackPaths = [preferredPng, DEFAULT_CARD_ART_PATH];

  return {
    artPath: preferredSvg,
    artFallbackPath: fallbackPaths[0] ?? DEFAULT_CARD_ART_PATH,
    artFallbackPaths: fallbackPaths,
  };
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function ensureSentence(text: string): string {
  const normalized = oneLine(text);
  if (normalized.length === 0) {
    return "";
  }
  if (/[.!?]$/.test(normalized)) {
    return normalized;
  }
  return `${normalized}.`;
}

function stripTrailingPeriod(text: string): string {
  return text.replace(/\.+$/g, "").trim();
}

function sanitizeMechanicsSummaryForPreview(card: CardV2): string | undefined {
  const raw = card.mechanicsSummary;
  if (!raw) {
    return undefined;
  }
  const normalized = oneLine(raw);
  if (normalized.length === 0) {
    return undefined;
  }

  const filtered = normalized
    .split(/\.\s+/)
    .map((chunk) => stripTrailingPeriod(chunk))
    .filter((chunk) => chunk.length > 0)
    .filter(
      (chunk) =>
        !/^(Role|Faction passive|Resistance|Keywords|Specials|Triggers|Judge green|Judge blue|Judge petition action|Judge bribe action)\s*:/i.test(
          chunk,
        ),
    );

  if (filtered.length === 0) {
    return undefined;
  }
  return filtered.join(". ");
}

function targetRuleLabel(rule: CardTargetRule): string {
  if (rule === "ally-unit") return "ally unit";
  if (rule === "enemy-unit") return "enemy unit";
  if (rule === "ally-unit-or-leader") return "ally unit or leader";
  if (rule === "enemy-unit-or-leader") return "enemy unit or leader";
  return "none";
}

function laneLabel(card: CardV2, fallbackRow: CardRow): string {
  if (card.kind !== "unit") {
    if (fallbackRow === "1") return "front row";
    if (fallbackRow === "2") return "back row";
    return "both rows";
  }
  if (card.lane === "front") return "front row";
  if (card.lane === "back") return "back row";
  return "both rows";
}

function isJudgeGreenSpecialist(card: CardV2): boolean {
  if (card.kind !== "unit") {
    return false;
  }
  const keywords = card.keywords ?? [];
  return keywords.includes("prosecutor") || keywords.includes("negotiator");
}

function isJudgeBlueSpecialist(card: CardV2): boolean {
  if (card.kind !== "unit") {
    return false;
  }
  const keywords = card.keywords ?? [];
  return keywords.includes("dirty");
}

function judgeSlotLabel(card: CardV2): string | undefined {
  const isGreen = isJudgeGreenSpecialist(card);
  const isBlue = isJudgeBlueSpecialist(card);

  if (isGreen && isBlue) {
    return "Judge green/blue slot";
  }
  if (isGreen) {
    return "Judge green slot";
  }
  if (isBlue) {
    return "Judge blue slot";
  }
  return undefined;
}

function factionPassiveSummary(faction: CardDefinition["faction"]): string {
  if (faction === "sec") return "SEC audit economy + Judge-green legal pressure.";
  if (faction === "market_makers") return "Structure rewards and backline execution rebates.";
  if (faction === "wallstreet") return "Formation scaling and takedown fees.";
  if (faction === "retail_mob") return "Comeback spikes and backlash on deaths.";
  if (faction === "short_hedgefund") return "Dirty pressure siphons with Judge mood/favor tradeoffs.";
  return "No faction passive.";
}

function eventLabel(trigger: CardTriggerDef): string {
  if (trigger.when === "on_summon") return "On summon";
  if (trigger.when === "turn_start") return "Turn start";
  if (trigger.when === "on_hit") return "On hit";
  if (trigger.when === "on_kill") return "On kill";
  return "After combat (survived)";
}

function conditionLabel(condition: CardTriggerCondition): string {
  if (condition === "target_survived") return "if target survives";
  return "if self survives";
}

function triggerActionLabel(action: CardActionDef): string {
  if (action.kind === "gain_shield") {
    return `${action.target.replace("_", " ")} +${action.amount} shield`;
  }
  if (action.kind === "heal") {
    return `heal ${action.target.replace("_", " ")} ${action.amount}`;
  }
  if (action.kind === "gain_shares") {
    return `+${action.amount} shares`;
  }
  if (action.kind === "modify_attack") {
    const sign = action.amount > 0 ? "+" : "";
    return `${action.target.replace("_", " ")} ATK ${sign}${action.amount}`;
  }
  if (action.kind === "cleanse") {
    const statuses = action.statuses && action.statuses.length > 0 ? ` (${action.statuses.join(", ")})` : "";
    return `cleanse ${action.target}${statuses}`;
  }
  if (action.kind === "apply_status") {
    const status = action.status === "atk_down" ? "ATK down" : action.status;
    return `apply ${status} (${action.turns}T) to ${action.target.replace("_", " ")}`;
  }
  return `draw ${action.amount}`;
}

function compactTriggersLine(card: CardV2): string | undefined {
  const triggers = card.triggers ?? [];
  if (triggers.length === 0) {
    return undefined;
  }
  return triggers
    .map((trigger) => {
      const conditions = trigger.requires && trigger.requires.length > 0 ? ` [${trigger.requires.map(conditionLabel).join(", ")}]` : "";
      const actions = trigger.actions.map(triggerActionLabel).join("; ");
      return `${eventLabel(trigger)}${conditions}: ${actions}`;
    })
    .join(" | ");
}

function nonResistanceSpecials(specials: readonly CardSpecialDef[] | undefined): string[] {
  if (!specials) {
    return [];
  }
  const out: string[] = [];
  for (const special of specials) {
    if (special.kind === "resistance") {
      continue;
    }
    if (special.kind === "taunt") {
      out.push("Taunt");
      continue;
    }
    out.push(`Shield on summon +${special.amount}`);
  }
  return out;
}

function compactSpecialsLine(card: CardV2): string | undefined {
  const bits = nonResistanceSpecials(card.specials);
  const keywords = card.keywords ?? [];
  if (keywords.includes("flip")) {
    bits.push("Flip");
  }
  if (isJudgeGreenSpecialist(card)) {
    bits.push("Judge Green specialist");
  }
  if (isJudgeBlueSpecialist(card)) {
    bits.push("Judge Blue specialist");
  }
  if (bits.length === 0) {
    return undefined;
  }
  return bits.join(", ");
}

function compactAbilitiesLine(card: CardV2): string {
  const abilityKeys = (card.keywords ?? []).filter(
    (keyword) => keyword === "rush" || keyword === "reach" || keyword === "ranged",
  );
  if (abilityKeys.length === 0) {
    return NO_COMBAT_ABILITIES_PLACEHOLDER;
  }
  return abilityKeys.map((keyword) => CARD_KEYWORD_DEFINITIONS[keyword].label).join(", ");
}

export function getDisplayAbilitiesLine(preview: Pick<CardPreviewMeta, "abilitiesLine">): string {
  if (preview.abilitiesLine !== NO_COMBAT_ABILITIES_PLACEHOLDER) {
    return preview.abilitiesLine;
  }
  const index = Math.floor(Math.random() * NO_COMBAT_ABILITIES_VARIANTS.length);
  return NO_COMBAT_ABILITIES_VARIANTS[index] ?? NO_COMBAT_ABILITIES_PLACEHOLDER;
}

function compactResistanceLine(cardId: string): string {
  const summary = oneLine(getUnitResistanceSummary(cardId)).replace(/^Resistance:\s*/i, "").replace(/\.$/, "");
  if (/n\/a/i.test(summary)) {
    return "n/a (non-unit card)";
  }
  return summary;
}

function collectEffectTags(card: CardV2): string[] {
  const tags = new Set<string>();
  const add = (tag: string): void => {
    if (tag.trim().length > 0) {
      tags.add(tag);
    }
  };

  for (const special of card.specials ?? []) {
    if (special.kind === "taunt") add("Taunt");
    if (special.kind === "shield_on_summon") add("Shield");
  }

  for (const keyword of card.keywords ?? []) {
    if (keyword === "flip") add("Flip");
    if ((keyword === "prosecutor" || keyword === "negotiator") && isJudgeGreenSpecialist(card)) add("Judge Green");
    if (keyword === "dirty" && isJudgeBlueSpecialist(card)) add("Judge Blue");
    if (keyword === "rush") add("Rush");
    if (keyword === "reach") add("Reach");
    if (keyword === "ranged") add("Ranged");
  }

  for (const trigger of card.triggers ?? []) {
    for (const action of trigger.actions) {
      if (action.kind === "heal") add("Heal");
      if (action.kind === "gain_shield") add("Shield");
      if (action.kind === "gain_shares") add("Shares");
      if (action.kind === "draw_card") add("Draw");
      if (action.kind === "modify_attack") add("ATK");
      if (action.kind === "cleanse") add("Cleanse");
      if (action.kind === "apply_status") {
        if (action.status === "stun") add("Stun");
        if (action.status === "exposed") add("Exposed");
        if (action.status === "atk_down") add("ATK Down");
      }
    }
  }

  const summary = (card.mechanicsSummary ?? "").toLowerCase();
  if (summary.includes("heal")) add("Heal");
  if (summary.includes("shield")) add("Shield");
  if (summary.includes("stun")) add("Stun");
  if (summary.includes("exposed")) add("Exposed");
  if (summary.includes("draw")) add("Draw");
  if (summary.includes("share")) add("Shares");
  if (summary.includes("attack")) add("ATK");
  if (summary.includes("damage") || summary.includes("deal ")) add("Damage");
  if (summary.includes("cleanse") || summary.includes("clear ")) add("Cleanse");
  if (summary.includes("favor")) add("Favor");
  if (summary.includes("probation")) add("Probation");
  if (summary.includes("debt")) add("Debt");
  if (summary.includes("judge green")) add("Judge Green");
  if (summary.includes("judge blue")) add("Judge Blue");

  const ordered = [
    "Heal",
    "Shield",
    "Damage",
    "Stun",
    "Exposed",
    "ATK Down",
    "ATK",
    "Cleanse",
    "Draw",
    "Shares",
    "Favor",
    "Probation",
    "Debt",
    "Taunt",
    "Rush",
    "Reach",
    "Ranged",
    "Flip",
    "Judge Green",
    "Judge Blue",
  ];

  return ordered.filter((tag) => tags.has(tag));
}

function isDerivativeNonUnit(card: CardV2): boolean {
  if (card.kind === "unit") {
    return false;
  }
  const summary = (card.mechanicsSummary ?? "").toLowerCase();
  return card.id === "naked_shorting" || summary.includes("leverage") || summary.includes("debt");
}

function nonUnitImpactClassLabel(card: CardV2): string {
  if (card.kind === "unit") {
    return "unit";
  }
  const tags = collectEffectTags(card);
  const hasHeal = tags.includes("Heal");

  if (isDerivativeNonUnit(card)) {
    return "derivative";
  }
  if (card.kind === "upgrade") {
    return hasHeal ? "heal upgrade" : "upgrade";
  }
  return hasHeal ? "heal spell" : "spell";
}

function judgeMechanicsLine(card: CardV2): string | undefined {
  if (!isJudgeGreenSpecialist(card) && !isJudgeBlueSpecialist(card)) {
    return undefined;
  }
  const summary = oneLine(getJudgeSpecialistSummary(card.id));
  if (summary.length === 0) {
    return undefined;
  }
  return ensureSentence(summary);
}

function buildCardImpactLine(card: CardV2, row: CardRow): string {
  const summary = sanitizeMechanicsSummaryForPreview(card);
  if (card.kind !== "unit") {
    const label = nonUnitImpactClassLabel(card);
    if (summary && summary.length > 0) {
      return `${label} | ${oneLine(summary)}`;
    }
    return label;
  }
  if (summary && /^(Choose friendly unit|Choose enemy unit)\s*:/i.test(oneLine(summary))) {
    return oneLine(summary);
  }

  const parts: string[] = [judgeSlotLabel(card) ?? laneLabel(card, row)];
  if (summary && oneLine(summary).length <= 110) {
    parts.push(oneLine(summary));
  }
  return parts.join(" | ");
}

function roleLineFromRole(role: CardRole): string {
  return role;
}

function buildCourtRecordText(card: CardV2): string {
  const identikit = ensureSentence(card.description);
  const caseText = ensureSentence(card.court_case ?? "Case file pending clerk review");
  return `Identikit: ${identikit} Case: ${caseText}`;
}

function buildFullEffectShortText(card: CardV2, preview: Pick<CardPreviewMeta, "row">): string {
  const parts: string[] = [];
  if (card.kind === "unit") {
    parts.push(`Put in ${judgeSlotLabel(card) ?? laneLabel(card, preview.row)}.`);
  } else {
    parts.push(`Card class: ${nonUnitImpactClassLabel(card)}.`);
  }

  const target = card.impactTargetRule ?? "none";
  if (target !== "none") {
    parts.push(`Targeting: ${targetRuleLabel(target)}.`);
  }

  const effectTags = collectEffectTags(card);
  if (effectTags.length > 0) {
    parts.push(`Effects: ${effectTags.join(", ")}.`);
  }

  const judgeSlot = judgeSlotLabel(card);
  if (judgeSlot) {
    parts.push(`Judge slot: ${judgeSlot}.`);
  }
  const judgeSummary = judgeMechanicsLine(card);
  if (judgeSummary) {
    parts.push(`Judge mechanics: ${judgeSummary}`);
  }

  const specials = compactSpecialsLine(card);
  if (specials) {
    parts.push(`Specials: ${specials}.`);
  }

  const triggers = compactTriggersLine(card);
  if (triggers) {
    parts.push(`Triggers: ${triggers}.`);
  }

  const mechanicsSummary = sanitizeMechanicsSummaryForPreview(card);
  if (mechanicsSummary) {
    parts.push(`Mechanics: ${ensureSentence(mechanicsSummary)}`);
  }

  if (!specials && !triggers && !mechanicsSummary && effectTags.length === 0) {
    parts.push(card.kind === "unit" ? "Statline pressure card with no extra trigger text." : "Simple utility card with no extra runtime text.");
  }

  return parts.join(" ");
}

export const CARD_PREVIEW: Record<string, CardPreviewMeta> = Object.fromEntries(
  Object.values(CARD_LIBRARY).map((card) => {
    const effect = getCardEffectDescriptor(card.id);
    const flavorText = card.text.trim();
    const art = buildArtPaths(card);
    const row = rowFromTraits(card.id, card.traits);
    const role = getCardRole(card.id);
    const sourceCard = getCardV2ById(card.id);
    if (!sourceCard) {
      throw new Error(`Missing V2 preview source for card ${card.id}`);
    }
    const cardImpactLine = buildCardImpactLine(sourceCard, row);
    const abilitiesLine = compactAbilitiesLine(sourceCard);
    const triggersLine = compactTriggersLine(sourceCard);
    const specialsLine = compactSpecialsLine(sourceCard);
    const previewJudgeMechanicsLine = judgeMechanicsLine(sourceCard);
    const survivalLine = compactResistanceLine(card.id);
    const factionPassiveLine = factionPassiveSummary(card.faction);
    return [
      card.id,
      {
        id: card.id,
        name: card.name,
        faction: card.faction,
        type: card.type,
        attack: card.attack ?? null,
        defense: card.health ?? null,
        row,
        costShares: card.costShares,
        dirtyPower: card.dirtyPower ?? 0,
        role,
        effectText: effect.summary,
        resistanceText: getUnitResistanceSummary(card.id),
        flavorText,
        text: effect.summary,
        targetRule: effect.targetRule,
        traits: card.traits,
        cardImpactLine,
        roleLine: roleLineFromRole(role),
        abilitiesLine,
        ...(triggersLine ? { triggersLine } : {}),
        ...(specialsLine ? { specialsLine } : {}),
        ...(previewJudgeMechanicsLine ? { judgeMechanicsLine: previewJudgeMechanicsLine } : {}),
        factionPassiveLine,
        survivalLine,
        courtRecordText: buildCourtRecordText(sourceCard),
        fullEffectShortText: buildFullEffectShortText(sourceCard, { row }),
        artPath: art.artPath,
        artFallbackPath: art.artFallbackPath,
        artFallbackPaths: art.artFallbackPaths,
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
      cardImpactLine: "both rows",
      roleLine: "utility",
      abilitiesLine: NO_COMBAT_ABILITIES_PLACEHOLDER,
      factionPassiveLine: "No faction passive.",
      survivalLine: "n/a (non-unit card)",
      courtRecordText: "Identikit: Card metadata missing. Case: Court record unavailable.",
      fullEffectShortText: "Card metadata missing.",
      artPath: DEFAULT_CARD_ART_PATH,
      artFallbackPath: DEFAULT_CARD_ART_PATH,
      artFallbackPaths: [],
    }
  );
}
