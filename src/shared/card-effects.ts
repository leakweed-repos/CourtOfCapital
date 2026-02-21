import { getCatalogCard } from "./card-catalog";
import type { CardDefinition } from "./game";
import { getJudgeSpecialistSummary } from "./judge-specialists";
import { getUnitResistanceSummary } from "./resistance";
import { getUnitSignatureProfile, unitSignatureSummary } from "./unit-signatures";

export type CardTargetRule = "none" | "ally-unit" | "enemy-unit" | "ally-unit-or-leader" | "enemy-unit-or-leader";
export type CardRole = "offensive" | "defensive" | "bureaucrat" | "utility";

export interface CardEffectDescriptor {
  targetRule: CardTargetRule;
  summary: string;
}

const SPECIAL_CARD_EFFECTS: Record<string, CardEffectDescriptor> = {
  liquidity_provider: { targetRule: "none", summary: "Gain +120 shares." },
  lender_last_resort: {
    targetRule: "ally-unit-or-leader",
    summary: "Choose your unit or leader: heal 3 and gain +180 shares, then lose 1 favor.",
  },
  transparency_ledger: {
    targetRule: "none",
    summary: "Gain +60 shares, +2 favor, and remove 1 probation.",
  },
  naked_shorting: {
    targetRule: "none",
    summary: "Pick leverage 1:2 to 1:5. Gain leveraged shares, add debt, and increase Judge hostility.",
  },
  liquidity_window_global: {
    targetRule: "none",
    summary: "Gain +100 shares, draw 1 card, and reduce debt by 30.",
  },
  circuit_pause: {
    targetRule: "enemy-unit",
    summary: "Choose enemy unit: stun for one turn cycle and apply Exposed.",
  },
  compliance_hotline: {
    targetRule: "enemy-unit",
    summary: "Choose enemy unit: -1 attack and enemy gains +1 probation.",
  },
  darkpool_flashlight: {
    targetRule: "enemy-unit",
    summary: "Choose enemy unit: apply Exposed and deal 1 damage.",
  },
  headline_scraper: {
    targetRule: "enemy-unit-or-leader",
    summary: "Choose enemy unit or leader. Unit: -1 attack + Exposed. Leader: steal up to 80 shares.",
  },
  volatility_swaplet: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +1 attack, +1 shield, and clear Exposed.",
  },

  legal_firewall: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +1 max HP, heal 1, and add 1 shield.",
  },
  due_process_order: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +2 max HP, heal 2, add 1 shield, and remove 1 probation.",
  },
  disclosure_dump: {
    targetRule: "none",
    summary: "Enemy loses up to 90 shares, gains 1 probation; you gain 1 favor.",
  },
  fine_schedule: {
    targetRule: "enemy-unit",
    summary: "Choose enemy unit: -2 attack, stun for one turn cycle, and enemy loses 60 shares.",
  },
  circuit_breaker_act: {
    targetRule: "none",
    summary: "Stun all enemy front-row units for one turn cycle.",
  },
  guild_bailiff: {
    targetRule: "none",
    summary: "On summon: gains 1 shield. Frontline Taunt anchor.",
  },
  civic_auditor: {
    targetRule: "none",
    summary: "Start of your turn (up to 2 auditors): enemy -25 shares and +1 probation.",
  },
  halt_marshall: {
    targetRule: "none",
    summary: "On hit: stuns the target for one turn cycle.",
  },
  compliance_clerk: {
    targetRule: "none",
    summary: "On summon and start of your turn: heals a damaged ally for 2 and cleanses stun/exposed.",
  },
  market_referee: {
    targetRule: "none",
    summary: "On summon: stuns random dirty enemy.",
  },

  rebate_harvest: {
    targetRule: "none",
    summary: "Gain 30-110 shares (scales with your Market-Makers in back row).",
  },
  latency_patch: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +1 attack, heal 1, and clear stun.",
  },
  cross_venue_sync: {
    targetRule: "none",
    summary: "Gain +70 shares and draw 1 card.",
  },
  maker_incentive: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +1 attack and +1 shield.",
  },
  queue_priority: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +1 attack and make it ready to attack immediately.",
  },
  market_arbiter: {
    targetRule: "none",
    summary: "On summon in back row: +1 attack. After each attack: gain shares equal to atk x10 (max 30).",
  },
  spread_sniper: {
    targetRule: "none",
    summary: "On hit: applies Exposed to target.",
  },
  settlement_liaison: {
    targetRule: "none",
    summary: "Support anchor with healing and favor upkeep.",
  },
  proxy_lawyer: {
    targetRule: "none",
    summary: "Specialist litigator focused on Judge petitions and injunction pressure.",
  },
  clearing_router: {
    targetRule: "none",
    summary: "On summon and start of your turn: cleanses stun/exposed from a friendly unit.",
  },

  buyback_authorization: {
    targetRule: "none",
    summary: "Gain +130 shares and heal your leader for 2.",
  },
  earnings_guidance_spin: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +2 attack. You lose 1 favor.",
  },
  covenant_flex: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +2 max HP, heal 2, and add 1 shield.",
  },
  roadshow_hype: {
    targetRule: "none",
    summary: "Gain 70-180 shares (scales with your Wallstreet units).",
  },
  liquidity_window: {
    targetRule: "none",
    summary: "Gain +90 shares and draw 1 card.",
  },
  clearing_knight: {
    targetRule: "none",
    summary: "On summon with another Wallstreet frontliner: +1 attack and +1 shield. On kill: +1 attack.",
  },
  syndicate_baron: {
    targetRule: "none",
    summary: "Start of your turn in front row: +20 shares.",
  },
  floor_mediator: {
    targetRule: "none",
    summary: "If in Judge green slot at start of your turn: Judge mood improves and enemy favor -1.",
  },
  public_defender: {
    targetRule: "none",
    summary: "On summon: grants shield to self and ally. At turn start: heals leader by 1 and can cleanse stun ally.",
  },
  investor_relations_chief: {
    targetRule: "none",
    summary: "On summon: +35 shares (and +1 favor with 3+ Wallstreet units). Start of your turn: passive share income.",
  },
  roadshow_blade: {
    targetRule: "none",
    summary: "Rush. With 3+ Wallstreet units on summon: gains +1 attack.",
  },

  diamond_hands_oath: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +1 attack, +1 max HP, heal 1, and add 1 shield.",
  },
  reddit_raid_plan: {
    targetRule: "none",
    summary: "Deal 1 damage to all enemy units.",
  },
  rocket_fuel: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +2 attack. If it has 2 HP or less, add 1 shield.",
  },
  banana_fund: {
    targetRule: "none",
    summary: "Heal all friendly units by 1 and gain +50 shares.",
  },
  crowd_shield: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: add 2 shield.",
  },
  retail_rebel: {
    targetRule: "none",
    summary: "Start of your turn while outnumbered: gains +1 attack.",
  },
  diamond_hand_captain: {
    targetRule: "none",
    summary: "On summon: gains 1 shield and grants 1 shield to a random retail ally.",
  },
  meme_berserker: {
    targetRule: "none",
    summary: "If outnumbered on summon: +1 attack. After each combat survived: +1 attack.",
  },
  yolo_striker: {
    targetRule: "none",
    summary: "Rush. If outnumbered on summon: gains 1 shield.",
  },
  meme_editor: {
    targetRule: "none",
    summary: "On summon and start of your turn: cleanses ally debuffs and grants +1 attack.",
  },

  rumor_forge: {
    targetRule: "enemy-unit",
    summary: "Choose enemy unit: deal 2 damage. If it dies, gain +80 shares.",
  },
  insider_briefcase: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +2 attack.",
  },
  shell_company_maze: {
    targetRule: "none",
    summary: "Steal up to 120 shares from enemy leader.",
  },
  media_smear: {
    targetRule: "enemy-unit",
    summary: "Choose enemy unit: -2 attack and apply Exposed.",
  },
  synthetic_press_release: {
    targetRule: "none",
    summary: "Gain +90 shares, enemy gains 1 probation, and Judge mood worsens.",
  },
  whisper_lobbyist: {
    targetRule: "none",
    summary: "On hit: applies Exposed to target.",
  },
  bribe_courier: {
    targetRule: "none",
    summary: "Corruption runner that amplifies Judge blue pressure.",
  },
  rehypothecator: {
    targetRule: "none",
    summary: "On summon: gains 2 shield, enemy probation +1, own favor -1.",
  },
  ftd_collector: {
    targetRule: "none",
    summary: "On kill: gain +70 shares.",
  },
  narrative_assassin: {
    targetRule: "none",
    summary: "On hit: target loses 1 attack.",
  },
  panic_seller_agent: {
    targetRule: "none",
    summary: "Rush. On summon: applies Exposed to random enemy.",
  },
  fud_negotiator: {
    targetRule: "none",
    summary: "Blue-slot negotiator that weaponizes favor and probation swings.",
  },

  market_holiday: {
    targetRule: "none",
    summary: "Stun all units on both sides for one turn cycle.",
  },
  cleanup_rubble: {
    targetRule: "none",
    summary: "Sandbox obstacle. No special effect.",
  },
  cleanup_suit_rack: {
    targetRule: "none",
    summary: "Sandbox obstacle. No special effect.",
  },
  cleanup_emergency_cone: {
    targetRule: "none",
    summary: "Sandbox obstacle. No special effect.",
  },
  cleanup_wet_floor_sign: {
    targetRule: "none",
    summary: "Sandbox obstacle. No special effect.",
  },
  cleanup_cart: {
    targetRule: "none",
    summary: "Sandbox obstacle. No special effect.",
  },
  audit_committee: {
    targetRule: "ally-unit",
    summary: "Choose friendly unit: +1 max HP, heal 1, add 1 shield; you gain 1 favor and remove 1 probation.",
  },
  spreadsheet_reconciliation: {
    targetRule: "none",
    summary: "Gain +70 shares and reduce debt by up to 80.",
  },
};

function factionPassiveSummary(card: CardDefinition): string {
  if (card.faction === "sec") {
    return "SEC audit economy + Judge-green legal pressure (favor gain and enemy probation)";
  }
  if (card.faction === "market_makers") {
    return "Market Makers reward front+back structure with value flow and backline execution rebates";
  }
  if (card.faction === "wallstreet") {
    return "Wallstreet scales attack from front formation and monetizes takedowns";
  }
  if (card.faction === "retail_mob") {
    return "Retail spikes in comeback states and can trigger backlash on deaths";
  }
  if (card.faction === "short_hedgefund") {
    return "Short deck siphons via dirty pressure, but worsens Judge mood and own favor over time";
  }
  return "neutral body with no faction passive";
}

function traitKeywords(card: CardDefinition): string[] {
  const out: string[] = [];
  if (card.traits.includes("taunt")) out.push("Taunt");
  if (card.traits.includes("ranged")) out.push("Ranged (hits backline)");
  if (card.traits.includes("reach")) out.push("Reach (frontline can hit backline)");
  if (card.traits.includes("rush")) out.push("Rush (can attack same turn)");
  if (card.traits.includes("flip")) out.push("Flip (replace friendly unit by paying +25% cost)");
  if (card.traits.includes("dirty")) out.push("Dirty (higher Judge catch risk)");
  if (card.traits.includes("prosecutor")) out.push("Prosecutor (Judge green synergy)");
  if (card.traits.includes("negotiator")) out.push("Negotiator (Judge green synergy)");
  return out;
}

function unitRoleLabel(card: CardDefinition): CardRole {
  if (card.type !== "unit") {
    return "utility";
  }
  if (card.traits.includes("prosecutor") || card.traits.includes("negotiator") || card.traits.includes("back_only")) {
    return "bureaucrat";
  }
  if (card.traits.includes("taunt") || (card.health ?? 0) >= 5) {
    return "defensive";
  }
  if (card.traits.includes("rush") || (card.attack ?? 0) >= 4) {
    return "offensive";
  }
  return "offensive";
}

function defaultCardEffect(card: CardDefinition): CardEffectDescriptor {
  if (card.type === "unit") {
    const signature = getUnitSignatureProfile(card.id);
    const keywords = traitKeywords(card);
    const chunks = [`Role: ${unitRoleLabel(card)}.`, unitSignatureSummary(signature)];
    if (keywords.length > 0) {
      chunks.push(`Keywords: ${keywords.join("; ")}.`);
    }
    chunks.push(`Faction passive: ${factionPassiveSummary(card)}.`);
    return {
      targetRule: "none",
      summary: chunks.join(" "),
    };
  }

  if (card.type === "upgrade") {
    return {
      targetRule: "ally-unit",
      summary: "Choose friendly unit. It gains +1 HP or +1 attack (50/50).",
    };
  }

  if (card.traits.includes("dirty")) {
    return {
      targetRule: "none",
      summary: "Gain 70-124 shares and add 1 probation.",
    };
  }

  return {
    targetRule: "none",
    summary: "Gain 70-124 shares.",
  };
}

function withJudgeSummary(cardId: string, descriptor: CardEffectDescriptor): CardEffectDescriptor {
  const judgeSummary = getJudgeSpecialistSummary(cardId);
  if (!judgeSummary) {
    return descriptor;
  }

  return {
    targetRule: descriptor.targetRule,
    summary: `${descriptor.summary} ${judgeSummary}`,
  };
}

function withResistanceSummary(cardId: string, descriptor: CardEffectDescriptor): CardEffectDescriptor {
  const card = getCatalogCard(cardId);
  if (card.type !== "unit") {
    return descriptor;
  }

  const resistanceSummary = getUnitResistanceSummary(cardId);
  if (!resistanceSummary || descriptor.summary.includes("Resistance:")) {
    return descriptor;
  }

  return {
    targetRule: descriptor.targetRule,
    summary: `${descriptor.summary} ${resistanceSummary}`,
  };
}

function withFlipSummary(cardId: string, descriptor: CardEffectDescriptor): CardEffectDescriptor {
  const card = getCatalogCard(cardId);
  if (card.type !== "unit" || !card.traits.includes("flip")) {
    return descriptor;
  }
  if (descriptor.summary.includes("Flip:")) {
    return descriptor;
  }
  return {
    targetRule: descriptor.targetRule,
    summary:
      `${descriptor.summary} ` +
      "Flip: deploy onto an occupied friendly slot for +25% cost. Displaced ally returns to hand (burns if full).",
  };
}

export function getCardEffectDescriptor(cardId: string): CardEffectDescriptor {
  const special = SPECIAL_CARD_EFFECTS[cardId];
  if (special) {
    return withResistanceSummary(cardId, withFlipSummary(cardId, withJudgeSummary(cardId, special)));
  }
  const card = getCatalogCard(cardId);
  return withResistanceSummary(cardId, withFlipSummary(cardId, withJudgeSummary(cardId, defaultCardEffect(card))));
}

export function getCardRole(cardId: string): CardRole {
  const card = getCatalogCard(cardId);
  return unitRoleLabel(card);
}
