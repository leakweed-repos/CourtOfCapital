export const LEGACY_EXPLICIT_UNIT_RUNTIME_CARD_IDS = [
  "guild_bailiff",
  "market_arbiter",
  "compliance_clerk",
  "market_referee",
  "clearing_router",
  "public_defender",
  "investor_relations_chief",
  "clearing_knight",
  "diamond_hand_captain",
  "meme_berserker",
  "meme_editor",
  "roadshow_blade",
  "yolo_striker",
  "panic_seller_agent",
  "rehypothecator",
  "bribe_courier",
  "civic_auditor",
  "settlement_liaison",
  "syndicate_baron",
  "floor_mediator",
  "retail_rebel",
  "discord_moderator",
  "fud_negotiator",
  "doom_researcher",
  "borrow_rate_whisperer",
  "halt_marshall",
  "spread_sniper",
  "whisper_lobbyist",
  "ftd_collector",
  "narrative_assassin",
] as const;

export const LEGACY_EXPLICIT_UNIT_RUNTIME_CARD_ID_SET = new Set<string>(LEGACY_EXPLICIT_UNIT_RUNTIME_CARD_IDS);

export function hasLegacyExplicitUnitRuntime(cardId: string): boolean {
  return LEGACY_EXPLICIT_UNIT_RUNTIME_CARD_ID_SET.has(cardId);
}
