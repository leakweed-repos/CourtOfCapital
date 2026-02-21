import type { CardDefinition, CardFaction, CardTrait, FactionId } from "./game";

type UnitSeed = {
  id: string;
  name: string;
  cost: number;
  attack: number;
  health: number;
  dirty?: number;
  traits?: CardTrait[];
  text: string;
};

type NonUnitSeed = {
  id: string;
  name: string;
  type: "instrument" | "upgrade";
  cost: number;
  dirty?: number;
  traits?: CardTrait[];
  text: string;
};

function mkUnit(faction: CardFaction, seed: UnitSeed): CardDefinition {
  return {
    id: seed.id,
    name: seed.name,
    faction,
    type: "unit",
    costShares: seed.cost,
    attack: seed.attack,
    health: seed.health,
    dirtyPower: seed.dirty ?? 0,
    traits: seed.traits ?? ["any_row"],
    text: seed.text,
  };
}

function mkNonUnit(faction: CardFaction, seed: NonUnitSeed): CardDefinition {
  return {
    id: seed.id,
    name: seed.name,
    faction,
    type: seed.type,
    costShares: seed.cost,
    dirtyPower: seed.dirty ?? 0,
    traits: seed.traits ?? [],
    text: seed.text,
  };
}

const secCombat: UnitSeed[] = [
  { id: "guild_bailiff", name: "Guild Bailiff", cost: 130, attack: 3, health: 5, traits: ["taunt", "front_only"], text: "SEC shield. Taunt frontline." },
  { id: "docket_enforcer", name: "Docket Enforcer", cost: 125, attack: 3, health: 4, traits: ["front_only", "flip"], text: "Slaps fines with a stapler." },
  { id: "subpoena_rider", name: "Subpoena Rider", cost: 118, attack: 3, health: 3, traits: ["reach", "front_only"], text: "Delivers papers at melee speed." },
  { id: "halt_marshall", name: "Halt Marshall", cost: 136, attack: 2, health: 6, traits: ["taunt", "front_only"], text: "Trading halt on two legs." },
  { id: "filing_ram", name: "Filing Ram", cost: 122, attack: 4, health: 3, traits: ["front_only"], text: "Breaks through with Form 8-K." },
  { id: "disclosure_sergeant", name: "Disclosure Sergeant", cost: 124, attack: 3, health: 4, traits: ["front_only"], text: "Quarterly reports, quarterly pain." },
  { id: "compliance_bruiser", name: "Compliance Bruiser", cost: 126, attack: 4, health: 4, traits: ["any_row"], text: "No alpha, only rules." },
  { id: "ticker_sheriff", name: "Ticker Sheriff", cost: 120, attack: 3, health: 3, traits: ["any_row"], text: "Keeps the tape clean-ish." },
  { id: "hearing_gladiator", name: "Hearing Gladiator", cost: 128, attack: 4, health: 3, traits: ["any_row"], text: "Cross-examines with steel." },
  { id: "cease_desist_guard", name: "Cease & Desist Guard", cost: 132, attack: 3, health: 5, traits: ["taunt", "front_only"], text: "Walks around with giant red stamp." },
  { id: "audit_raider", name: "Audit Raider", cost: 121, attack: 4, health: 2, traits: ["any_row"], text: "Ransacks books at dawn." },
  { id: "rulebook_slasher", name: "Rulebook Slasher", cost: 116, attack: 4, health: 2, traits: ["any_row"], text: "Weaponized footnotes." },
  { id: "forensic_raider", name: "Forensic Raider", cost: 127, attack: 3, health: 4, traits: ["reach", "any_row"], text: "Finds ghosts in ledgers." },
  { id: "probation_hunter", name: "Probation Hunter", cost: 123, attack: 3, health: 4, traits: ["any_row"], text: "Tracks dirty repeat offenders." },
  { id: "freeze_order_knight", name: "Freeze Order Knight", cost: 134, attack: 3, health: 5, traits: ["front_only"], text: "Assets frozen, feelings too." },
];

const secSupport: UnitSeed[] = [
  { id: "compliance_clerk", name: "Compliance Clerk", cost: 90, attack: 1, health: 4, traits: ["back_only", "prosecutor"], text: "Prosecutor backline support." },
  { id: "civic_auditor", name: "Civic Auditor", cost: 110, attack: 2, health: 4, traits: ["prosecutor", "back_only"], text: "Audit pressure from backline." },
  { id: "whistleblower_intern", name: "Whistleblower Intern", cost: 96, attack: 1, health: 3, traits: ["back_only", "prosecutor"], text: "Anonymous tip machine." },
  { id: "risk_examiner", name: "Risk Examiner", cost: 104, attack: 2, health: 4, traits: ["back_only"], text: "Checks VaR and vibes." },
  { id: "filing_archivist", name: "Filing Archivist", cost: 98, attack: 1, health: 5, traits: ["back_only"], text: "Buffs morale with binders." },
  { id: "market_referee", name: "Market Referee", cost: 112, attack: 2, health: 4, traits: ["back_only", "negotiator", "flip"], text: "Blows whistle on spoofing." },
  { id: "policy_scribe", name: "Policy Scribe", cost: 102, attack: 2, health: 3, traits: ["back_only"], text: "Writes laws no one reads." },
  { id: "court_observer", name: "Court Observer", cost: 106, attack: 2, health: 4, traits: ["back_only", "prosecutor"], text: "Takes notes, takes souls." },
  { id: "consent_decree_agent", name: "Consent Decree Agent", cost: 111, attack: 2, health: 4, traits: ["back_only", "negotiator"], text: "Settles with scary smile." },
  { id: "integrity_analyst", name: "Integrity Analyst", cost: 107, attack: 2, health: 3, traits: ["back_only"], text: "Counts red flags per minute." },
];

const secUtilities: NonUnitSeed[] = [
  { id: "legal_firewall", name: "Legal Firewall", type: "upgrade", cost: 70, text: "Friendly unit +1 HP." },
  { id: "due_process_order", name: "Due Process Order", type: "upgrade", cost: 95, text: "Fortify unit and reduce probation." },
  { id: "disclosure_dump", name: "Disclosure Dump", type: "instrument", cost: 85, text: "Flood market with filings." },
  { id: "fine_schedule", name: "Fine Schedule", type: "instrument", cost: 90, text: "Fee menu nobody likes." },
  { id: "circuit_breaker_act", name: "Circuit Breaker Act", type: "upgrade", cost: 100, text: "Slow down the chaos." },
];

const marketCombat: UnitSeed[] = [
  { id: "market_arbiter", name: "Market Arbiter", cost: 115, attack: 2, health: 3, traits: ["ranged", "back_only", "negotiator", "flip"], text: "Negotiator marksman." },
  { id: "spread_sniper", name: "Spread Sniper", cost: 120, attack: 3, health: 3, traits: ["ranged", "back_only"], text: "Precise ranged pressure." },
  { id: "volatility_clerk", name: "Volatility Clerk", cost: 105, attack: 2, health: 4, traits: ["any_row"], text: "Stable anchor under swings." },
  { id: "orderflow_scout", name: "Orderflow Scout", cost: 95, attack: 2, health: 3, traits: ["any_row"], text: "Cheap tempo scout." },
  { id: "latency_lancer", name: "Latency Lancer", cost: 118, attack: 4, health: 2, traits: ["any_row", "flip"], text: "Shaves milliseconds and HP." },
  { id: "quote_stacker", name: "Quote Stacker", cost: 122, attack: 3, health: 4, traits: ["any_row"], text: "Builds walls of orders." },
  { id: "arb_tactician", name: "Arb Tactician", cost: 124, attack: 3, health: 4, traits: ["reach", "any_row"], text: "Finds spread, applies pressure." },
  { id: "darkpool_hunter", name: "Darkpool Hunter", cost: 127, attack: 4, health: 3, traits: ["reach", "front_only"], text: "Lights up hidden liquidity." },
  { id: "match_engine_rider", name: "Match Engine Rider", cost: 129, attack: 4, health: 3, traits: ["front_only"], text: "Clears queues violently." },
  { id: "book_depth_guard", name: "Book Depth Guard", cost: 121, attack: 3, health: 5, traits: ["taunt", "front_only"], text: "Thick book, thick armor." },
  { id: "auction_breaker", name: "Auction Breaker", cost: 126, attack: 4, health: 3, traits: ["any_row"], text: "Opens with fireworks." },
  { id: "midpoint_raider", name: "Midpoint Raider", cost: 117, attack: 3, health: 3, traits: ["any_row"], text: "Steals pennies, wins wars." },
  { id: "gamma_sweeper", name: "Gamma Sweeper", cost: 133, attack: 4, health: 4, traits: ["front_only"], text: "Options pain specialist." },
  { id: "quote_blitz", name: "Quote Blitz", cost: 116, attack: 4, health: 2, traits: ["any_row"], text: "Spoofs your patience." },
  { id: "liquidity_duelist", name: "Liquidity Duelist", cost: 128, attack: 3, health: 4, traits: ["any_row"], text: "1v1 with a price ladder." },
];

const marketSupport: UnitSeed[] = [
  { id: "settlement_liaison", name: "Settlement Liaison", cost: 108, attack: 2, health: 4, traits: ["negotiator", "back_only"], text: "Negotiates in the Judge lane." },
  { id: "clearing_router", name: "Clearing Router", cost: 101, attack: 2, health: 4, traits: ["back_only"], text: "Routes risk to someone else." },
  { id: "imbalance_reader", name: "Imbalance Reader", cost: 103, attack: 2, health: 3, traits: ["back_only"], text: "Sees open-close rituals." },
  { id: "delta_keeper", name: "Delta Keeper", cost: 106, attack: 2, health: 4, traits: ["back_only"], text: "Hedges until it hurts." },
  { id: "variance_curator", name: "Variance Curator", cost: 110, attack: 2, health: 4, traits: ["back_only", "negotiator"], text: "Sells calm at premium." },
  { id: "execution_auditor", name: "Execution Auditor", cost: 104, attack: 1, health: 5, traits: ["back_only"], text: "Best execution, best sarcasm." },
  { id: "tape_listener", name: "Tape Listener", cost: 98, attack: 1, health: 4, traits: ["back_only"], text: "Heard every whisper trade." },
  { id: "auction_clerk", name: "Auction Clerk", cost: 100, attack: 2, health: 3, traits: ["back_only"], text: "Controls opening bell mood." },
  { id: "vol_surface_monk", name: "Vol Surface Monk", cost: 109, attack: 2, health: 4, traits: ["back_only"], text: "Meditates on skew." },
  { id: "tick_mediator", name: "Tick Mediator", cost: 107, attack: 2, health: 4, traits: ["back_only", "negotiator"], text: "One-tick peace treaty." },
];

const marketUtilities: NonUnitSeed[] = [
  { id: "rebate_harvest", name: "Rebate Harvest", type: "instrument", cost: 85, text: "Collects maker rebates." },
  { id: "latency_patch", name: "Latency Patch", type: "upgrade", cost: 90, text: "Low-latency buff package." },
  { id: "cross_venue_sync", name: "Cross Venue Sync", type: "instrument", cost: 95, text: "Links fragmented books." },
  { id: "maker_incentive", name: "Maker Incentive", type: "upgrade", cost: 92, text: "Pays for tighter spreads." },
  { id: "queue_priority", name: "Queue Priority", type: "upgrade", cost: 98, text: "Front-runs with paperwork." },
];

const wallstreetCombat: UnitSeed[] = [
  { id: "clearing_knight", name: "Clearing Knight", cost: 140, attack: 4, health: 4, traits: ["reach", "front_only"], text: "Reach into backline." },
  { id: "floor_mediator", name: "Floor Mediator", cost: 125, attack: 3, health: 4, traits: ["negotiator", "front_only"], text: "Judge envoy in frontline." },
  { id: "blue_chip_raider", name: "Blue Chip Raider", cost: 135, attack: 4, health: 3, traits: ["any_row"], text: "High pressure bruiser." },
  { id: "deal_desk_titan", name: "Deal Desk Titan", cost: 138, attack: 4, health: 5, traits: ["front_only"], text: "Carries M&A in briefcase." },
  { id: "roadshow_blade", name: "Roadshow Blade", cost: 122, attack: 4, health: 2, traits: ["rush", "any_row", "flip"], text: "Pitches and stabs." },
  { id: "ipo_ram", name: "IPO Ram", cost: 130, attack: 4, health: 3, traits: ["front_only"], text: "Smashes through listing day." },
  { id: "syndicate_baron", name: "Syndicate Baron", cost: 132, attack: 3, health: 5, traits: ["taunt", "front_only"], text: "Owns half the order book." },
  { id: "bonus_chaser", name: "Bonus Chaser", cost: 116, attack: 4, health: 2, traits: ["any_row"], text: "Compensation-driven warfare." },
  { id: "derivative_spear", name: "Derivative Spear", cost: 127, attack: 4, health: 3, traits: ["reach", "any_row"], text: "Leverage in pointy form." },
  { id: "prime_broker_brawler", name: "Prime Broker Brawler", cost: 134, attack: 3, health: 5, traits: ["front_only"], text: "Margin calls with fists." },
  { id: "credit_raider", name: "Credit Raider", cost: 124, attack: 3, health: 4, traits: ["any_row"], text: "Refinances your HP away." },
  { id: "merger_hunter", name: "Merger Hunter", cost: 129, attack: 4, health: 3, traits: ["any_row"], text: "Always searching for synergies." },
  { id: "balance_sheet_ogre", name: "Balance Sheet Ogre", cost: 136, attack: 3, health: 6, traits: ["taunt", "front_only"], text: "Thick assets, thicker skull." },
  { id: "turnaround_slasher", name: "Turnaround Slasher", cost: 121, attack: 4, health: 3, traits: ["any_row"], text: "Cuts costs and throats." },
  { id: "staircase_bidder", name: "Staircase Bidder", cost: 123, attack: 3, health: 4, traits: ["any_row"], text: "Walks price up with swagger." },
];

const wallstreetSupport: UnitSeed[] = [
  { id: "public_defender", name: "Public Defender", cost: 120, attack: 2, health: 5, traits: ["ranged", "negotiator", "back_only"], text: "Durable legal support." },
  { id: "investor_relations_chief", name: "Investor Relations Chief", cost: 108, attack: 2, health: 4, traits: ["back_only", "negotiator"], text: "Guidance magician." },
  { id: "risk_modeler", name: "Risk Modeler", cost: 104, attack: 2, health: 3, traits: ["back_only"], text: "Gaussian until it breaks." },
  { id: "compliance_liaison_ws", name: "Compliance Liaison", cost: 103, attack: 1, health: 5, traits: ["back_only"], text: "Says no with a smile." },
  { id: "debt_structurer", name: "Debt Structurer", cost: 109, attack: 2, health: 4, traits: ["back_only"], text: "Turns pain into tranches." },
  { id: "research_hawk", name: "Research Hawk", cost: 101, attack: 2, health: 3, traits: ["back_only", "ranged"], text: "Downgrades your hope." },
  { id: "quant_whisperer", name: "Quant Whisperer", cost: 107, attack: 2, health: 4, traits: ["back_only"], text: "Backtests your destiny." },
  { id: "boardroom_negotiator", name: "Boardroom Negotiator", cost: 110, attack: 2, health: 4, traits: ["back_only", "negotiator", "flip"], text: "Settles over expensive water." },
  { id: "governance_warden", name: "Governance Warden", cost: 106, attack: 2, health: 4, traits: ["back_only"], text: "Committee-powered support." },
  { id: "deal_paralegal", name: "Deal Paralegal", cost: 100, attack: 1, health: 4, traits: ["back_only"], text: "Carries 900 pages and a dream." },
];

const wallstreetUtilities: NonUnitSeed[] = [
  { id: "buyback_authorization", name: "Buyback Authorization", type: "instrument", cost: 95, text: "Engineering value, allegedly." },
  { id: "earnings_guidance_spin", name: "Earnings Guidance Spin", type: "upgrade", cost: 90, text: "Narrative over numbers." },
  { id: "covenant_flex", name: "Covenant Flex", type: "upgrade", cost: 96, text: "Contract says maybe." },
  { id: "roadshow_hype", name: "Roadshow Hype", type: "instrument", cost: 88, text: "Slides with unrealistic TAM." },
  { id: "liquidity_window", name: "Liquidity Window", type: "instrument", cost: 92, text: "Opens when insiders need exits." },
];

const retailCombat: UnitSeed[] = [
  { id: "retail_rebel", name: "Retail Rebel", cost: 100, attack: 2, health: 4, traits: ["any_row"], text: "Reliable crowd fighter." },
  { id: "diamond_hand_captain", name: "Diamond Hand Captain", cost: 125, attack: 3, health: 5, traits: ["front_only"], text: "Tanky captain for pushes." },
  { id: "meme_berserker", name: "Meme Berserker", cost: 115, attack: 4, health: 2, traits: ["any_row"], text: "Glass-cannon meme charge." },
  { id: "picket_marshal", name: "Picket Marshal", cost: 110, attack: 2, health: 5, traits: ["taunt", "front_only"], text: "Taunt wall for retail line." },
  { id: "stonk_charger", name: "Stonk Charger", cost: 118, attack: 4, health: 2, traits: ["any_row"], text: "Rocket emojis as fuel." },
  { id: "bagholder_tank", name: "Bagholder Tank", cost: 128, attack: 2, health: 6, traits: ["taunt", "front_only"], text: "Heavy bags, heavy armor." },
  { id: "yolo_striker", name: "YOLO Striker", cost: 119, attack: 4, health: 3, traits: ["rush", "any_row"], text: "No thesis, only conviction." },
  { id: "gamma_ape", name: "Gamma Ape", cost: 131, attack: 4, health: 4, traits: ["front_only"], text: "Powered by OTM calls." },
  { id: "dip_buyer", name: "Dip Buyer", cost: 117, attack: 3, health: 3, traits: ["any_row"], text: "Buys every red candle." },
  { id: "thread_warrior", name: "Thread Warrior", cost: 116, attack: 3, health: 4, traits: ["any_row", "flip"], text: "Wins arguments, then fights." },
  { id: "diamond_pikeman", name: "Diamond Pikeman", cost: 122, attack: 3, health: 4, traits: ["reach", "front_only"], text: "Pierces FUD." },
  { id: "bullhorn_raider", name: "Bullhorn Raider", cost: 121, attack: 4, health: 3, traits: ["any_row"], text: "Loud alpha delivery." },
  { id: "options_gladiator", name: "Options Gladiator", cost: 127, attack: 4, health: 3, traits: ["any_row"], text: "Expires ITM in spirit." },
  { id: "volatile_knuckle", name: "Volatile Knuckle", cost: 114, attack: 4, health: 2, traits: ["any_row"], text: "One candle maniac." },
  { id: "ape_phalanx", name: "Ape Phalanx", cost: 130, attack: 3, health: 5, traits: ["front_only"], text: "Collective stubborn wall." },
];

const retailSupport: UnitSeed[] = [
  { id: "union_negotiator", name: "Union Negotiator", cost: 112, attack: 2, health: 4, traits: ["negotiator", "back_only", "flip"], text: "Represents the crowd before the Judge." },
  { id: "streaming_analyst", name: "Streaming Analyst", cost: 102, attack: 2, health: 3, traits: ["back_only"], text: "TA with rainbow lines." },
  { id: "discord_moderator", name: "Discord Moderator", cost: 99, attack: 1, health: 5, traits: ["back_only"], text: "Bans bots, spawns morale." },
  { id: "pollster_pro", name: "Pollster Pro", cost: 100, attack: 2, health: 3, traits: ["back_only"], text: "Sentiment as a service." },
  { id: "meme_editor", name: "Meme Editor", cost: 98, attack: 1, health: 4, traits: ["back_only"], text: "Buffs unit with crop and caption." },
  { id: "data_scraper", name: "Data Scraper", cost: 103, attack: 2, health: 4, traits: ["back_only"], text: "Collects public breadcrumbs." },
  { id: "floor_chatter", name: "Floor Chatter", cost: 97, attack: 2, health: 3, traits: ["back_only"], text: "Rumor turbocharger." },
  { id: "petition_writer", name: "Petition Writer", cost: 105, attack: 2, health: 4, traits: ["back_only", "negotiator"], text: "Polite pressure specialist." },
  { id: "community_steward", name: "Community Steward", cost: 106, attack: 2, health: 4, traits: ["back_only"], text: "Keeps retail line together." },
  { id: "fact_checker_ape", name: "Fact Checker Ape", cost: 108, attack: 2, health: 4, traits: ["back_only"], text: "Actually reads filings." },
];

const retailUtilities: NonUnitSeed[] = [
  { id: "diamond_hands_oath", name: "Diamond Hands Oath", type: "upgrade", cost: 88, text: "Commit to hold through chaos." },
  { id: "reddit_raid_plan", name: "Reddit Raid Plan", type: "instrument", cost: 92, text: "Coordinated meme strike." },
  { id: "rocket_fuel", name: "Rocket Fuel", type: "instrument", cost: 95, text: "Adds pure hype pressure." },
  { id: "banana_fund", name: "Banana Fund", type: "instrument", cost: 84, text: "Nutrition for sustained yolo." },
  { id: "crowd_shield", name: "Crowd Shield", type: "upgrade", cost: 90, text: "Human wall of small lots." },
];

const shortCombat: UnitSeed[] = [
  { id: "short_syndicate_runner", name: "Short Syndicate Runner", cost: 105, attack: 3, health: 2, dirty: 1, traits: ["dirty", "any_row"], text: "Dirty runner." },
  { id: "shadow_broker", name: "Shadow Broker", cost: 115, attack: 3, health: 3, dirty: 1, traits: ["dirty", "back_only"], text: "Backline manipulator." },
  { id: "bribe_courier", name: "Bribe Courier", cost: 100, attack: 2, health: 3, dirty: 2, traits: ["dirty", "any_row"], text: "Judge corruption specialist." },
  { id: "whisper_lobbyist", name: "Whisper Lobbyist", cost: 120, attack: 3, health: 4, dirty: 2, traits: ["dirty", "reach", "any_row"], text: "Reach dirty pressure." },
  { id: "locate_alchemist", name: "Locate Alchemist", cost: 124, attack: 3, health: 4, dirty: 2, traits: ["dirty", "any_row"], text: "Turns maybe-locates into certainty." },
  { id: "borrowed_shield", name: "Borrowed Shield", cost: 112, attack: 2, health: 5, dirty: 1, traits: ["dirty", "front_only"], text: "Borrow now, explain later." },
  { id: "panic_seller_agent", name: "Panic Seller Agent", cost: 118, attack: 4, health: 2, dirty: 2, traits: ["rush", "dirty", "any_row"], text: "Spreads urgency professionally." },
  { id: "fee_harvester", name: "Fee Harvester", cost: 121, attack: 3, health: 3, dirty: 2, traits: ["dirty", "any_row"], text: "Monetizes borrow pain." },
  { id: "dark_analyst", name: "Dark Analyst", cost: 116, attack: 3, health: 3, dirty: 1, traits: ["dirty", "back_only"], text: "Writes 40-page doom posts." },
  { id: "spoof_duelist", name: "Spoof Duelist", cost: 123, attack: 4, health: 3, dirty: 2, traits: ["dirty", "any_row", "flip"], text: "Order book mirage fighter." },
  { id: "narrative_assassin", name: "Narrative Assassin", cost: 126, attack: 4, health: 3, dirty: 2, traits: ["dirty", "reach", "any_row"], text: "Kills momentum with one headline." },
  { id: "panic_knight", name: "Panic Knight", cost: 127, attack: 3, health: 4, dirty: 2, traits: ["dirty", "front_only"], text: "Armored in fear." },
  { id: "rehypothecator", name: "Rehypothecator", cost: 129, attack: 3, health: 5, dirty: 3, traits: ["dirty", "front_only"], text: "One share, many owners." },
  { id: "ftd_collector", name: "FTD Collector", cost: 122, attack: 4, health: 2, dirty: 3, traits: ["dirty", "any_row"], text: "Delivers never, demands always." },
  { id: "smirk_veteran", name: "Smirk Veteran", cost: 120, attack: 3, health: 4, dirty: 2, traits: ["dirty", "any_row"], text: "Been wrong for years, still smug." },
];

const shortSupport: UnitSeed[] = [
  { id: "borrow_desk_clerk", name: "Borrow Desk Clerk", cost: 101, attack: 2, health: 4, dirty: 1, traits: ["dirty", "back_only"], text: "Finds lendable shadows." },
  { id: "synthetic_ledger_keeper", name: "Synthetic Ledger Keeper", cost: 104, attack: 2, health: 4, dirty: 1, traits: ["dirty", "back_only"], text: "Adds decimals nobody asked for." },
  { id: "doom_researcher", name: "Doom Researcher", cost: 106, attack: 2, health: 4, dirty: 2, traits: ["dirty", "back_only"], text: "Price target: zero, always." },
  { id: "options_grinder", name: "Options Grinder", cost: 107, attack: 2, health: 3, dirty: 1, traits: ["dirty", "back_only"], text: "Bleeds theta and opponents." },
  { id: "swap_architect", name: "Swap Architect", cost: 110, attack: 2, health: 4, dirty: 2, traits: ["dirty", "back_only"], text: "Exposure hidden in plain sight." },
  { id: "darkpool_accountant", name: "Darkpool Accountant", cost: 102, attack: 1, health: 5, dirty: 1, traits: ["dirty", "back_only"], text: "Reconciles invisible prints." },
  { id: "media_handler", name: "Media Handler", cost: 108, attack: 2, health: 4, dirty: 2, traits: ["dirty", "back_only", "flip"], text: "Curates panic narratives." },
  { id: "borrow_rate_whisperer", name: "Borrow Rate Whisperer", cost: 109, attack: 2, health: 4, dirty: 2, traits: ["dirty", "back_only"], text: "APR meets fear." },
  { id: "shell_operator", name: "Shell Operator", cost: 103, attack: 2, health: 3, dirty: 2, traits: ["dirty", "back_only"], text: "CEO of mailbox LLC." },
  { id: "fud_negotiator", name: "FUD Negotiator", cost: 111, attack: 2, health: 4, dirty: 2, traits: ["dirty", "back_only", "negotiator"], text: "Polite gaslighting expert." },
];

const shortUtilities: NonUnitSeed[] = [
  { id: "rumor_forge", name: "Rumor Forge", type: "instrument", cost: 80, dirty: 2, traits: ["dirty"], text: "Deal 2 to random enemy unit." },
  { id: "insider_briefcase", name: "Insider Briefcase", type: "upgrade", cost: 95, dirty: 3, traits: ["dirty"], text: "Friendly unit +2 attack." },
  { id: "shell_company_maze", name: "Shell Company Maze", type: "instrument", cost: 100, dirty: 3, traits: ["dirty"], text: "Siphon shares from opponent." },
  { id: "media_smear", name: "Media Smear", type: "upgrade", cost: 90, dirty: 2, traits: ["dirty"], text: "Reduce random enemy attack." },
  { id: "synthetic_press_release", name: "Synthetic Press Release", type: "instrument", cost: 92, dirty: 2, traits: ["dirty"], text: "Narrative pump for short side." },
];

const neutralCards: CardDefinition[] = [
  mkUnit("neutral", { id: "court_liaison", name: "Court Liaison", cost: 102, attack: 2, health: 3, traits: ["negotiator", "back_only"], text: "Neutral negotiator for Judge interactions." }),
  mkUnit("neutral", { id: "grey_pool_fixer", name: "Grey Pool Fixer", cost: 108, attack: 2, health: 3, dirty: 1, traits: ["dirty", "any_row"], text: "Neutral dirty operative for blue Judge slot." }),
  mkUnit("neutral", { id: "forensic_journalist", name: "Forensic Journalist", cost: 104, attack: 2, health: 3, traits: ["back_only"], text: "Prints receipts at dawn." }),
  mkUnit("neutral", { id: "class_action_counsel", name: "Class Action Counsel", cost: 112, attack: 2, health: 4, traits: ["back_only", "negotiator"], text: "Loves large groups and fees." }),
  mkUnit("neutral", { id: "exchange_clerk", name: "Exchange Clerk", cost: 99, attack: 1, health: 5, traits: ["back_only"], text: "Keeps the market barely legal." }),
  mkUnit("neutral", { id: "macro_commentator", name: "Macro Commentator", cost: 105, attack: 2, health: 4, traits: ["back_only"], text: "Wrong loudly, daily." }),
  mkUnit("neutral", { id: "proxy_lawyer", name: "Proxy Lawyer", cost: 107, attack: 2, health: 4, traits: ["back_only", "prosecutor"], text: "Weaponized shareholder votes." }),
  mkNonUnit("neutral", { id: "market_holiday", name: "Market Holiday", type: "instrument", cost: 80, text: "Everyone calms down briefly." }),
  mkNonUnit("neutral", { id: "audit_committee", name: "Audit Committee", type: "upgrade", cost: 86, text: "Adds governance paperwork." }),
  mkNonUnit("neutral", { id: "spreadsheet_reconciliation", name: "Spreadsheet Reconciliation", type: "instrument", cost: 82, text: "Cell by cell stability." }),
];

const globalUtilities: CardDefinition[] = [
  mkNonUnit("utility", { id: "liquidity_provider", name: "Liquidity Provider", type: "instrument", cost: 80, text: "Universal: gain shares." }),
  mkNonUnit("utility", { id: "lender_last_resort", name: "Lender of Last Resort", type: "instrument", cost: 100, text: "Universal emergency bailout." }),
  mkNonUnit("utility", { id: "transparency_ledger", name: "Transparency Ledger", type: "instrument", cost: 85, text: "Universal favor stabilizer." }),
  mkNonUnit("utility", { id: "naked_shorting", name: "Naked Shorting", type: "instrument", cost: 200, dirty: 5, traits: ["dirty"], text: "Universal leverage (1:2..1:5), creates debt and hostility." }),
  mkNonUnit("utility", { id: "liquidity_window_global", name: "Liquidity Window", type: "instrument", cost: 88, text: "Temporary access to capital." }),
  mkNonUnit("utility", { id: "circuit_pause", name: "Circuit Pause", type: "upgrade", cost: 90, text: "Small reset before chaos returns." }),
  mkNonUnit("utility", { id: "compliance_hotline", name: "Compliance Hotline", type: "instrument", cost: 84, text: "Anonymous tip and instant panic." }),
  mkNonUnit("utility", { id: "darkpool_flashlight", name: "Darkpool Flashlight", type: "upgrade", cost: 92, text: "Finds hidden prints." }),
  mkNonUnit("utility", { id: "headline_scraper", name: "Headline Scraper", type: "instrument", cost: 86, text: "Harvests sentiment shifts." }),
  mkNonUnit("utility", { id: "volatility_swaplet", name: "Volatility Swaplet", type: "upgrade", cost: 94, text: "Pocket-size risk transfer." }),
];

export const SANDBOX_CLEANUP_CARD_IDS = [
  "cleanup_rubble",
  "cleanup_suit_rack",
  "cleanup_emergency_cone",
  "cleanup_wet_floor_sign",
  "cleanup_cart",
] as const;

const sandboxCleanupCards: CardDefinition[] = [
  mkUnit("neutral", {
    id: "cleanup_rubble",
    name: "Rubble",
    cost: 0,
    attack: 3,
    health: 1,
    traits: ["any_row"],
    text: "Cleanup obstacle. No special abilities.",
  }),
  mkUnit("neutral", {
    id: "cleanup_suit_rack",
    name: "Suit Rack",
    cost: 0,
    attack: 3,
    health: 1,
    traits: ["any_row"],
    text: "Cleanup obstacle. No special abilities.",
  }),
  mkUnit("neutral", {
    id: "cleanup_emergency_cone",
    name: "Emergency Cone",
    cost: 0,
    attack: 3,
    health: 1,
    traits: ["any_row"],
    text: "Cleanup obstacle. No special abilities.",
  }),
  mkUnit("neutral", {
    id: "cleanup_wet_floor_sign",
    name: "Wet Floor Sign",
    cost: 0,
    attack: 3,
    health: 1,
    traits: ["any_row"],
    text: "Cleanup obstacle. No special abilities.",
  }),
  mkUnit("neutral", {
    id: "cleanup_cart",
    name: "Cleanup Cart",
    cost: 0,
    attack: 3,
    health: 1,
    traits: ["any_row"],
    text: "Cleanup obstacle. No special abilities.",
  }),
];

function convertFactionCards(faction: FactionId, unitsA: UnitSeed[], unitsB: UnitSeed[], utilities: NonUnitSeed[]): CardDefinition[] {
  return [
    ...unitsA.map((s) => mkUnit(faction, s)),
    ...unitsB.map((s) => mkUnit(faction, s)),
    ...utilities.map((s) => mkNonUnit(faction, s)),
  ];
}

export const CARD_LIBRARY: Record<string, CardDefinition> = Object.fromEntries(
  [
    ...convertFactionCards("sec", secCombat, secSupport, secUtilities),
    ...convertFactionCards("market_makers", marketCombat, marketSupport, marketUtilities),
    ...convertFactionCards("wallstreet", wallstreetCombat, wallstreetSupport, wallstreetUtilities),
    ...convertFactionCards("retail_mob", retailCombat, retailSupport, retailUtilities),
    ...convertFactionCards("short_hedgefund", shortCombat, shortSupport, shortUtilities),
    ...neutralCards,
    ...globalUtilities,
    ...sandboxCleanupCards,
  ].map((card) => [card.id, card]),
);

export const FACTION_CARD_IDS: Record<FactionId, string[]> = {
  sec: Object.values(CARD_LIBRARY).filter((c) => c.faction === "sec").map((c) => c.id),
  market_makers: Object.values(CARD_LIBRARY).filter((c) => c.faction === "market_makers").map((c) => c.id),
  wallstreet: Object.values(CARD_LIBRARY).filter((c) => c.faction === "wallstreet").map((c) => c.id),
  retail_mob: Object.values(CARD_LIBRARY).filter((c) => c.faction === "retail_mob").map((c) => c.id),
  short_hedgefund: Object.values(CARD_LIBRARY).filter((c) => c.faction === "short_hedgefund").map((c) => c.id),
};

const SANDBOX_CLEANUP_ID_SET = new Set<string>(SANDBOX_CLEANUP_CARD_IDS);

export const NEUTRAL_UTILITY_CARD_IDS: string[] = Object.values(CARD_LIBRARY)
  .filter(
    (c) =>
      (c.faction === "neutral" || c.faction === "utility") &&
      !SANDBOX_CLEANUP_ID_SET.has(c.id),
  )
  .map((c) => c.id);

export function getCatalogCard(cardId: string): CardDefinition {
  const card = CARD_LIBRARY[cardId];
  if (!card) {
    throw new Error(`Unknown card: ${cardId}`);
  }
  return card;
}
