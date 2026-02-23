import { CARD_KEYWORD_DEFINITIONS } from "./keywords";
import type { CardActionDef, CardAuthorRole, CardSpecialDef, CardTriggerDef, CardV2 } from "./schema";

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.`;
}

function roleLabel(role: CardAuthorRole): string {
  if (role === "offense") return "offensive";
  if (role === "defense") return "defensive";
  if (role === "support") return "support";
  if (role === "control") return "control";
  if (role === "economy") return "economy";
  return "utility";
}

function factionPassiveSummary(faction: CardV2["faction"]): string | undefined {
  if (faction === "sec") {
    return "SEC audit economy and Judge-green legal pressure.";
  }
  if (faction === "market_makers") {
    return "Market Makers reward board structure and backline execution rebates.";
  }
  if (faction === "wallstreet") {
    return "Wallstreet scales from formation and monetizes takedowns.";
  }
  if (faction === "retail_mob") {
    return "Retail spikes in comeback states and can trigger backlash on deaths.";
  }
  if (faction === "short_hedgefund") {
    return "Short side siphons via dirty pressure while stressing Judge mood and favor.";
  }
  return undefined;
}

function formatPercent(value: number): string {
  if (value <= 1) {
    return `${Math.round(value * 100)}%`;
  }
  return `${Math.round(value)}%`;
}

function specialSummary(special: CardSpecialDef): string {
  if (special.kind === "taunt") {
    return "Taunt (frontline guard)";
  }
  if (special.kind === "shield_on_summon") {
    return `On summon gains ${special.amount} shield`;
  }

  const parts: string[] = [];
  if (typeof special.stun === "number") {
    parts.push(`stun ${formatPercent(special.stun)}`);
  }
  if (typeof special.exposed === "number") {
    parts.push(`exposed ${formatPercent(special.exposed)}`);
  }
  if (typeof special.atkDown === "number") {
    parts.push(`atk-down ${formatPercent(special.atkDown)}`);
  }

  if (parts.length === 0) {
    return "Resistance profile (custom)";
  }
  return `Resistance: ${parts.join(" | ")}`;
}

function triggerLabel(trigger: CardTriggerDef): string {
  if (trigger.when === "on_summon") return "On summon";
  if (trigger.when === "turn_start") return "Turn start";
  if (trigger.when === "on_hit") return "On hit";
  if (trigger.when === "on_kill") return "On kill";
  return "After surviving combat";
}

function actionSummary(action: CardActionDef): string {
  if (action.kind === "gain_shield") {
    return `${action.target} gains ${action.amount} shield`;
  }
  if (action.kind === "heal") {
    return `heal ${action.target} for ${action.amount}`;
  }
  if (action.kind === "gain_shares") {
    return `gain +${action.amount} shares`;
  }
  if (action.kind === "modify_attack") {
    const sign = action.amount >= 0 ? "+" : "";
    return `${action.target} attack ${sign}${action.amount}`;
  }
  if (action.kind === "cleanse") {
    if (!action.statuses || action.statuses.length === 0) {
      return `cleanse ${action.target}`;
    }
    return `cleanse ${action.target} (${action.statuses.join(", ")})`;
  }
  if (action.kind === "apply_status") {
    return `apply ${action.status} to ${action.target} for ${action.turns} turn(s)`;
  }
  return `draw ${action.amount} card(s)`;
}

function triggerSummary(trigger: CardTriggerDef): string {
  const actions = trigger.actions.map(actionSummary).join("; ");
  const note = trigger.note ? ` (${trigger.note})` : "";
  return `${triggerLabel(trigger)}: ${actions}${note}`;
}

export function buildCardImpactTextV2(card: CardV2): string {
  const chunks: string[] = [];
  chunks.push(`Role: ${roleLabel(card.role)}.`);

  const description = ensureSentence(card.description);
  if (description) {
    chunks.push(`Description: ${description}`);
  }

  if (card.mechanicsSummary && card.mechanicsSummary.trim().length > 0) {
    chunks.push(`Mechanics: ${ensureSentence(card.mechanicsSummary)}`);
  }

  const keywordEntries = (card.keywords ?? []).map((keyword) => CARD_KEYWORD_DEFINITIONS[keyword]);
  if (keywordEntries.length > 0) {
    chunks.push(`Keywords: ${keywordEntries.map((entry) => `${entry.label} (${entry.summary})`).join("; ")}.`);
  }

  if ((card.specials ?? []).length > 0) {
    chunks.push(`Specials: ${(card.specials ?? []).map(specialSummary).join("; ")}.`);
  }

  if ((card.triggers ?? []).length > 0) {
    chunks.push(`Triggers: ${(card.triggers ?? []).map(triggerSummary).join("; ")}.`);
  }

  const passive = factionPassiveSummary(card.faction);
  if (passive) {
    chunks.push(`Faction passive: ${passive}`);
  }

  return chunks.join(" ");
}
