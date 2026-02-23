import { BOARD_COLS, JUDGE_COL, MULLIGAN_SECONDS, TURN_SECONDS, nowTs, uniqueId } from "../../shared/game";
import type {
  AttackInput,
  MatchActionResult,
  MatchState,
  PlayCardInput,
  PlayerSide,
  TutorialScenarioId,
  UnitState,
} from "../../shared/game";
import { getCard } from "./models";

type TutorialActionKind = "play" | "attack" | "end-turn";

type TutorialExpectedAction =
  | {
      kind: "play";
      cardId: string;
      lane: "front" | "back";
      col: number;
      targetKind?: "ally-unit" | "enemy-unit" | "ally-leader" | "enemy-leader";
      targetCardId?: string;
    }
  | {
      kind: "attack";
      attackerCardId: string;
      targetKind: "unit" | "leader" | "judge" | "event";
      targetCardId?: string;
    }
  | {
      kind: "end-turn";
    };

type TutorialScriptStep = {
  id: string;
  title: string;
  body: string;
  actionHint: string;
  requiresAck: boolean;
  coachAnchor?:
    | { kind: "hand-card"; cardId: string }
    | { kind: "slot"; side: "ally" | "enemy"; lane: "front" | "back"; col: number }
    | { kind: "button"; buttonId: "end-turn" | "cast-card" };
  expectedAction?: TutorialExpectedAction;
};

const CORE_SCRIPT: readonly TutorialScriptStep[] = [
  {
    id: "intro",
    title: "Welcome To Court",
    body: "This is a guided real match. Timer pauses on tips and resumes only after confirmation.",
    actionHint: "Tap 'I understand' to begin.",
    requiresAck: true,
  },
  {
    id: "identify-target",
    title: "Read Current Threat",
    body: "Enemy Retail Rebel is already deployed in enemy front row, column 1. This is your first combat target.",
    actionHint: "Tap 'I understand' and prepare your first unit.",
    requiresAck: true,
    coachAnchor: { kind: "slot", side: "enemy", lane: "front", col: 0 },
  },
  {
    id: "deploy-rush",
    title: "Deploy Unit",
    body: "Play YOLO Striker to your front row, column 1.",
    actionHint: "Tap YOLO Striker in hand, then place it on highlighted slot.",
    requiresAck: true,
    coachAnchor: { kind: "hand-card", cardId: "yolo_striker" },
    expectedAction: {
      kind: "play",
      cardId: "yolo_striker",
      lane: "front",
      col: 0,
    },
  },
  {
    id: "attack-enemy",
    title: "Resolve Combat",
    body: "Use YOLO Striker to attack enemy Retail Rebel on board.",
    actionHint: "Select YOLO Striker and attack enemy Retail Rebel in enemy front row.",
    requiresAck: true,
    coachAnchor: { kind: "slot", side: "enemy", lane: "front", col: 0 },
    expectedAction: {
      kind: "attack",
      attackerCardId: "yolo_striker",
      targetKind: "unit",
      targetCardId: "retail_rebel",
    },
  },
  {
    id: "combat-explain",
    title: "Combat Rule",
    body: "Unit vs unit deals damage both ways. Your attacker also takes counter-damage from enemy attack stat.",
    actionHint: "Tap 'I understand' and continue.",
    requiresAck: true,
  },
  {
    id: "cast-liquidity",
    title: "Shares Gain",
    body: "Cast Liquidity Provider to gain shares (utility cast).",
    actionHint: "Tap Liquidity Provider, then press Cast Card.",
    requiresAck: true,
    coachAnchor: { kind: "button", buttonId: "cast-card" },
    expectedAction: {
      kind: "play",
      cardId: "liquidity_provider",
      lane: "front",
      col: 0,
    },
  },
  {
    id: "liquidity-explain",
    title: "Economy Rule",
    body: "Utility cards resolve effects through Cast Card. Liquidity Provider gives shares without board placement value.",
    actionHint: "Tap 'I understand' and continue.",
    requiresAck: true,
  },
  {
    id: "deploy-anchor",
    title: "Deploy Anchor",
    body: "Play Picket Marshal to your front row, column 2.",
    actionHint: "Tap Picket Marshal, then place it on front row column 2.",
    requiresAck: true,
    coachAnchor: { kind: "hand-card", cardId: "picket_marshal" },
    expectedAction: {
      kind: "play",
      cardId: "picket_marshal",
      lane: "front",
      col: 1,
    },
  },
  {
    id: "buff-anchor",
    title: "Targeted Buff",
    body: "Use Diamond Hands Oath on your Picket Marshal.",
    actionHint: "Tap Diamond Hands Oath, then target allied Picket Marshal.",
    requiresAck: true,
    coachAnchor: { kind: "hand-card", cardId: "diamond_hands_oath" },
    expectedAction: {
      kind: "play",
      cardId: "diamond_hands_oath",
      lane: "front",
      col: 0,
      targetKind: "ally-unit",
      targetCardId: "picket_marshal",
    },
  },
  {
    id: "buff-explain",
    title: "Buff Rule",
    body: "Diamond Hands Oath improved your unit durability and pressure. Buff effects persist on that unit.",
    actionHint: "Tap 'I understand' to add support unit.",
    requiresAck: true,
  },
  {
    id: "deploy-support",
    title: "Deploy Backline Support",
    body: "Play Community Steward to your back row, column 1.",
    actionHint: "Tap Community Steward and place it on back row column 1.",
    requiresAck: true,
    coachAnchor: { kind: "hand-card", cardId: "community_steward" },
    expectedAction: {
      kind: "play",
      cardId: "community_steward",
      lane: "back",
      col: 0,
    },
  },
  {
    id: "end-turn",
    title: "Pass Priority",
    body: "Finish your turn now.",
    actionHint: "Tap End Turn.",
    requiresAck: true,
    coachAnchor: { kind: "button", buttonId: "end-turn" },
    expectedAction: {
      kind: "end-turn",
    },
  },
  {
    id: "done",
    title: "Basics Complete",
    body: "You completed board read, deploy, attack, utility cast, targeted buff, support placement, and turn pass.",
    actionHint: "Use Back to return to lobby or continue to next tutorial.",
    requiresAck: true,
  },
];

const BUFFS_DEBUFFS_SCRIPT: readonly TutorialScriptStep[] = [
  {
    id: "intro",
    title: "Buffs & Debuffs",
    body: "This lesson teaches status flow: buff, shield, debuff, exposed, and stun.",
    actionHint: "Tap 'I understand' to start lesson.",
    requiresAck: true,
  },
  {
    id: "deploy-anchor",
    title: "Deploy Anchor",
    body: "Play Picket Marshal to front row, column 1.",
    actionHint: "Tap Picket Marshal, then place it on highlighted front slot 1.",
    requiresAck: true,
    coachAnchor: { kind: "hand-card", cardId: "picket_marshal" },
    expectedAction: {
      kind: "play",
      cardId: "picket_marshal",
      lane: "front",
      col: 0,
    },
  },
  {
    id: "deploy-support",
    title: "Deploy Support",
    body: "Play Community Steward to back row, column 1.",
    actionHint: "Tap Community Steward, then place it in your back row.",
    requiresAck: true,
    coachAnchor: { kind: "hand-card", cardId: "community_steward" },
    expectedAction: {
      kind: "play",
      cardId: "community_steward",
      lane: "back",
      col: 0,
    },
  },
  {
    id: "debuff-hotline",
    title: "Apply Debuff",
    body: "Use Compliance Hotline on enemy Meme Berserker.",
    actionHint: "Tap Compliance Hotline, then target enemy Meme Berserker.",
    requiresAck: true,
    coachAnchor: { kind: "slot", side: "enemy", lane: "front", col: 1 },
    expectedAction: {
      kind: "play",
      cardId: "compliance_hotline",
      lane: "front",
      col: 0,
      targetKind: "enemy-unit",
      targetCardId: "meme_berserker",
    },
  },
  {
    id: "debuff-explain",
    title: "Debuff Outcome",
    body: "Compliance Hotline weakens enemy pressure and increases enemy probation.",
    actionHint: "Tap 'I understand' and stack Exposed.",
    requiresAck: true,
  },
  {
    id: "expose-flashlight",
    title: "Stack Pressure",
    body: "Use Darkpool Flashlight on the same enemy to add Exposed and chip damage.",
    actionHint: "Tap Darkpool Flashlight, then target Meme Berserker again.",
    requiresAck: true,
    coachAnchor: { kind: "hand-card", cardId: "darkpool_flashlight" },
    expectedAction: {
      kind: "play",
      cardId: "darkpool_flashlight",
      lane: "front",
      col: 0,
      targetKind: "enemy-unit",
      targetCardId: "meme_berserker",
    },
  },
  {
    id: "exposed-explain",
    title: "Exposed Outcome",
    body: "Exposed increases incoming punish windows. Chip damage also pressures low HP units.",
    actionHint: "Tap 'I understand' and add shield.",
    requiresAck: true,
  },
  {
    id: "shield-anchor",
    title: "Apply Shield",
    body: "Use Crowd Shield on Picket Marshal.",
    actionHint: "Tap Crowd Shield, then target Picket Marshal.",
    requiresAck: true,
    coachAnchor: { kind: "hand-card", cardId: "crowd_shield" },
    expectedAction: {
      kind: "play",
      cardId: "crowd_shield",
      lane: "front",
      col: 0,
      targetKind: "ally-unit",
      targetCardId: "picket_marshal",
    },
  },
  {
    id: "shield-explain",
    title: "Shield Outcome",
    body: "Shield absorbs incoming damage packets before HP is reduced.",
    actionHint: "Tap 'I understand' and cast cleanse support.",
    requiresAck: true,
  },
  {
    id: "cleanse-swaplet",
    title: "Recover Ally",
    body: "Use Volatility Swaplet on your Picket Marshal for attack/shield and cleanse.",
    actionHint: "Tap Volatility Swaplet, then target Picket Marshal.",
    requiresAck: true,
    coachAnchor: { kind: "hand-card", cardId: "volatility_swaplet" },
    expectedAction: {
      kind: "play",
      cardId: "volatility_swaplet",
      lane: "front",
      col: 0,
      targetKind: "ally-unit",
      targetCardId: "picket_marshal",
    },
  },
  {
    id: "cleanse-explain",
    title: "Cleanse Outcome",
    body: "Volatility Swaplet buffs attack, grants shield, and clears exposed/stun from your unit.",
    actionHint: "Tap 'I understand' and apply hard stop.",
    requiresAck: true,
  },
  {
    id: "stun-circuit",
    title: "Hard Stop",
    body: "Use Circuit Pause on enemy Retail Rebel to apply stun and Exposed.",
    actionHint: "Tap Circuit Pause, then target enemy Retail Rebel.",
    requiresAck: true,
    coachAnchor: { kind: "hand-card", cardId: "circuit_pause" },
    expectedAction: {
      kind: "play",
      cardId: "circuit_pause",
      lane: "front",
      col: 0,
      targetKind: "enemy-unit",
      targetCardId: "retail_rebel",
    },
  },
  {
    id: "stun-explain",
    title: "Stun Outcome",
    body: "Stunned units lose action tempo and cannot attack until stun expires.",
    actionHint: "Tap 'I understand' and use team sustain.",
    requiresAck: true,
  },
  {
    id: "sustain-banana",
    title: "Team Sustain",
    body: "Cast Banana Fund to heal your board and gain shares.",
    actionHint: "Tap Banana Fund, then press Cast Card.",
    requiresAck: true,
    coachAnchor: { kind: "button", buttonId: "cast-card" },
    expectedAction: {
      kind: "play",
      cardId: "banana_fund",
      lane: "front",
      col: 0,
    },
  },
  {
    id: "end-turn",
    title: "Lock In Status",
    body: "End turn to lock this buff/debuff board state.",
    actionHint: "Tap End Turn.",
    requiresAck: true,
    coachAnchor: { kind: "button", buttonId: "end-turn" },
    expectedAction: {
      kind: "end-turn",
    },
  },
  {
    id: "finish",
    title: "Lesson Complete",
    body: "You learned layered statuses: debuff, exposed, shield, cleanse, and stun.",
    actionHint: "Use Back to return to lobby, or Skip tutorial.",
    requiresAck: true,
  },
];

const JUDGE_DEPENDENCIES_SCRIPT: readonly TutorialScriptStep[] = [
  {
    id: "intro",
    title: "Judge Dependencies",
    body: "Judge mechanics run on two specialist slots: Green (front) and Blue (back).",
    actionHint: "Tap 'I understand' to begin Judge drill.",
    requiresAck: true,
  },
  {
    id: "judge-overview",
    title: "Judge Slot Roles",
    body: "Green slot favors legal influence (prosecutor/negotiator). Blue slot favors dirty pressure. Enemy blue can tax you at turn start.",
    actionHint: "Tap 'I understand' and place Green specialist.",
    requiresAck: true,
  },
  {
    id: "green-specialist",
    title: "Green Judge Slot",
    body: "Play Petition Writer into the Green Judge slot (front row, last column).",
    actionHint: "Tap Petition Writer and place it on highlighted Green Judge slot.",
    requiresAck: true,
    coachAnchor: { kind: "slot", side: "ally", lane: "front", col: JUDGE_COL },
    expectedAction: {
      kind: "play",
      cardId: "petition_writer",
      lane: "front",
      col: JUDGE_COL,
    },
  },
  {
    id: "green-explain",
    title: "Green Slot Explained",
    body: "Green specialist can petition the Judge and applies legal pressure packages at turn start.",
    actionHint: "Tap 'I understand' and place Blue specialist.",
    requiresAck: true,
  },
  {
    id: "blue-specialist",
    title: "Blue Judge Slot",
    body: "Play Grey Pool Fixer into the Blue Judge slot (back row, last column).",
    actionHint: "Tap Grey Pool Fixer and place it on highlighted Blue Judge slot.",
    requiresAck: true,
    coachAnchor: { kind: "slot", side: "ally", lane: "back", col: JUDGE_COL },
    expectedAction: {
      kind: "play",
      cardId: "grey_pool_fixer",
      lane: "back",
      col: JUDGE_COL,
    },
  },
  {
    id: "blue-explain",
    title: "Blue Slot Explained",
    body: "Blue specialist is dirty influence. In tutorial, random Judge catch penalties are disabled for deterministic flow.",
    actionHint: "Tap 'I understand' and cycle turn.",
    requiresAck: true,
  },
  {
    id: "roll-turn",
    title: "Trigger Judge Cycle",
    body: "End turn to cycle initiative. Your next turn starts with Judge lane calculations.",
    actionHint: "Tap End Turn.",
    requiresAck: true,
    coachAnchor: { kind: "button", buttonId: "end-turn" },
    expectedAction: {
      kind: "end-turn",
    },
  },
  {
    id: "cycle-explain",
    title: "Turn Start Processing",
    body: "Judge lane effects resolve at turn start. Your Green and enemy Blue are checked automatically; owning both Green+Blue enables combo packages.",
    actionHint: "Tap 'I understand' and test Blue attack rule.",
    requiresAck: true,
  },
  {
    id: "blue-vs-green",
    title: "Blue Slot Attack Rule",
    body: "Blue-slot specialists pressure enemy Green Judge slot units, and they can also attack the enemy leader if no taunt is present.",
    actionHint: "Select Grey Pool Fixer and attack enemy Court Liaison in enemy Green slot.",
    requiresAck: true,
    coachAnchor: { kind: "slot", side: "enemy", lane: "front", col: JUDGE_COL },
    expectedAction: {
      kind: "attack",
      attackerCardId: "grey_pool_fixer",
      targetKind: "unit",
      targetCardId: "court_liaison",
    },
  },
  {
    id: "blue-rule-explain",
    title: "Blue Target Restriction",
    body: "Blue slot units cannot attack regular board units or events, but they can attack enemy Green Judge slot units and may hit the leader if no taunt is present. Green slot units keep normal attack options plus Judge petition.",
    actionHint: "Tap 'I understand' and use Green petition.",
    requiresAck: true,
  },
  {
    id: "green-petition",
    title: "Petition The Judge",
    body: "Use Petition Writer to interact with Judge directly.",
    actionHint: "Select Petition Writer and attack Judge.",
    requiresAck: true,
    coachAnchor: { kind: "slot", side: "ally", lane: "front", col: JUDGE_COL },
    expectedAction: {
      kind: "attack",
      attackerCardId: "petition_writer",
      targetKind: "judge",
    },
  },
  {
    id: "petition-explain",
    title: "Petition Outcome",
    body: "Petition path pushes favor/probation/legal pressure package. This is Green-side Judge control.",
    actionHint: "Tap 'I understand' and refresh Blue action.",
    requiresAck: true,
  },
  {
    id: "refresh-turn",
    title: "Refresh Specialists",
    body: "End turn so both specialists are ready again.",
    actionHint: "Tap End Turn.",
    requiresAck: true,
    coachAnchor: { kind: "button", buttonId: "end-turn" },
    expectedAction: {
      kind: "end-turn",
    },
  },
  {
    id: "bribe-cost-brief",
    title: "Before Bribe",
    body: "Blue bribe consumes shares first (60). Then it siphons value and applies corruption effects.",
    actionHint: "Tap 'I understand' and execute Blue bribe.",
    requiresAck: true,
  },
  {
    id: "blue-bribe",
    title: "Bribe The Judge",
    body: "Use Grey Pool Fixer on Judge to apply blue-side influence.",
    actionHint: "Select Grey Pool Fixer and attack Judge.",
    requiresAck: true,
    coachAnchor: { kind: "slot", side: "ally", lane: "back", col: JUDGE_COL },
    expectedAction: {
      kind: "attack",
      attackerCardId: "grey_pool_fixer",
      targetKind: "judge",
    },
  },
  {
    id: "bribe-explain",
    title: "Why Shares Changed",
    body: "Shares can drop because bribe has fixed entry cost (60). Net result is: stolen value minus bribe cost.",
    actionHint: "Tap 'I understand' for full dependency recap.",
    requiresAck: true,
  },
  {
    id: "finish",
    title: "Judge Mastery Complete",
    body: "You completed Green/Blue placement, slot restrictions, start-turn dependency cycle, Blue target rule, petition and bribe outcomes.",
    actionHint: "Return to lobby and continue in Quick Play or PvP.",
    requiresAck: true,
  },
];

type TutorialScenarioConfig = {
  id: TutorialScenarioId;
  title: string;
  script: readonly TutorialScriptStep[];
  playerAHand: readonly string[];
  playerADeckPool: readonly string[];
  playerBHand: readonly string[];
  playerBDeckPool: readonly string[];
  spawnedUnits: ReadonlyArray<{ side: PlayerSide; lane: "front" | "back"; col: number; cardId: string }>;
};

const SCENARIOS: Record<TutorialScenarioId, TutorialScenarioConfig> = {
  core_basics_v1: {
    id: "core_basics_v1",
    title: "Tutorial#0: Basics",
    script: CORE_SCRIPT,
    playerAHand: ["yolo_striker", "liquidity_provider", "picket_marshal", "diamond_hands_oath", "community_steward", "volatility_swaplet"],
    playerADeckPool: [
      "yolo_striker",
      "liquidity_provider",
      "picket_marshal",
      "diamond_hands_oath",
      "community_steward",
      "volatility_swaplet",
      "retail_rebel",
      "banana_fund",
      "compliance_hotline",
      "darkpool_flashlight",
      "lender_last_resort",
      "court_liaison",
      "exchange_clerk",
    ],
    playerBHand: ["retail_rebel", "exchange_clerk", "market_holiday", "proxy_lawyer"],
    playerBDeckPool: ["retail_rebel", "meme_berserker", "exchange_clerk", "market_holiday", "headline_scraper"],
    spawnedUnits: [{ side: "B", lane: "front", col: 0, cardId: "retail_rebel" }],
  },
  buffs_debuffs_v1: {
    id: "buffs_debuffs_v1",
    title: "Tutorial#1: Buffs/Debuffs",
    script: BUFFS_DEBUFFS_SCRIPT,
    playerAHand: [
      "picket_marshal",
      "community_steward",
      "compliance_hotline",
      "darkpool_flashlight",
      "crowd_shield",
      "volatility_swaplet",
      "circuit_pause",
      "banana_fund",
    ],
    playerADeckPool: [
      "picket_marshal",
      "community_steward",
      "compliance_hotline",
      "darkpool_flashlight",
      "crowd_shield",
      "volatility_swaplet",
      "circuit_pause",
      "banana_fund",
      "diamond_hands_oath",
      "audit_committee",
      "transparency_ledger",
      "headline_scraper",
      "retail_rebel",
    ],
    playerBHand: ["retail_rebel", "meme_berserker", "exchange_clerk", "market_holiday"],
    playerBDeckPool: ["retail_rebel", "meme_berserker", "discord_moderator", "exchange_clerk", "market_holiday", "headline_scraper"],
    spawnedUnits: [
      { side: "B", lane: "front", col: 0, cardId: "retail_rebel" },
      { side: "B", lane: "front", col: 1, cardId: "meme_berserker" },
      { side: "B", lane: "back", col: 0, cardId: "exchange_clerk" },
    ],
  },
  judge_dependencies_v1: {
    id: "judge_dependencies_v1",
    title: "Tutorial#2: Judge Dependencies",
    script: JUDGE_DEPENDENCIES_SCRIPT,
    playerAHand: ["petition_writer", "grey_pool_fixer", "proxy_lawyer", "liquidity_provider", "audit_committee"],
    playerADeckPool: [
      "petition_writer",
      "grey_pool_fixer",
      "proxy_lawyer",
      "liquidity_provider",
      "audit_committee",
      "court_liaison",
      "class_action_counsel",
      "transparency_ledger",
      "market_holiday",
      "retail_rebel",
    ],
    playerBHand: ["exchange_clerk", "market_holiday", "retail_rebel", "headline_scraper"],
    playerBDeckPool: ["exchange_clerk", "retail_rebel", "market_holiday", "headline_scraper", "forensic_journalist", "court_liaison"],
    spawnedUnits: [
      { side: "B", lane: "front", col: 0, cardId: "retail_rebel" },
      { side: "B", lane: "front", col: JUDGE_COL, cardId: "court_liaison" },
    ],
  },
};

type ValidateResult = { ok: true } | { ok: false; error: string };

function scriptForScenario(scenarioId: TutorialScenarioId): readonly TutorialScriptStep[] {
  return (SCENARIOS[scenarioId] ?? SCENARIOS.core_basics_v1).script;
}

function padDeckToHundred(seedCards: readonly string[]): string[] {
  const out: string[] = [];
  while (out.length < 100) {
    for (const cardId of seedCards) {
      out.push(cardId);
      if (out.length >= 100) {
        break;
      }
    }
  }
  return out;
}

function scenarioConfig(scenarioId: TutorialScenarioId): TutorialScenarioConfig {
  return SCENARIOS[scenarioId] ?? SCENARIOS.core_basics_v1;
}

const TUTORIAL_ALLOWED_FACTIONS = new Set(["retail_mob", "neutral", "utility"]);

export function getTutorialScriptStepCopy(stepId: string): { title: string; body: string } | null {
  const step = [...CORE_SCRIPT, ...JUDGE_DEPENDENCIES_SCRIPT].find((one) => one.id === stepId);
  if (!step) {
    return null;
  }
  return { title: step.title, body: step.body };
}

function isAllowedTutorialCard(cardId: string): boolean {
  try {
    const card = getCard(cardId);
    return TUTORIAL_ALLOWED_FACTIONS.has(card.faction);
  } catch {
    return false;
  }
}

export function tutorialNeedsFactionRepair(match: MatchState): boolean {
  if (match.mode !== "tutorial" || !match.tutorial) {
    return false;
  }

  const cardsToCheck: string[] = [];
  cardsToCheck.push(...match.players.A.hand, ...match.players.A.deck, ...match.players.A.discard);
  cardsToCheck.push(...match.players.B.hand, ...match.players.B.deck, ...match.players.B.discard);

  for (const unit of Object.values(match.units)) {
    cardsToCheck.push(unit.cardId);
  }

  for (const cardId of cardsToCheck) {
    if (!isAllowedTutorialCard(cardId)) {
      return true;
    }
  }

  return false;
}

export function repairTutorialIfNeeded(
  match: MatchState,
  now = nowTs(),
): { match: MatchState; repaired: boolean } {
  if (!tutorialNeedsFactionRepair(match)) {
    return { match, repaired: false };
  }

  const scenarioId = match.tutorial?.scenarioId ?? "core_basics_v1";
  const repaired = setupTutorialMatch(match, scenarioId, now);
  repaired.log = [
    {
      at: now,
      turn: 1,
      text: `Tutorial auto-refreshed to scenario ${scenarioId} (legacy mixed-faction snapshot detected).`,
    },
  ];
  repaired.updatedAt = now;
  return { match: repaired, repaired: true };
}

function assertScenarioUsesAllowedFactions(scenario: TutorialScenarioConfig): void {
  const assertCard = (cardId: string, bucket: string): void => {
    const card = getCard(cardId);
    if (!TUTORIAL_ALLOWED_FACTIONS.has(card.faction)) {
      throw new Error(
        `Tutorial scenario '${scenario.id}' has disallowed card '${cardId}' in ${bucket}. Allowed: retail_mob, neutral, utility.`,
      );
    }
  };

  for (const cardId of scenario.playerAHand) {
    assertCard(cardId, "playerAHand");
  }
  for (const cardId of scenario.playerADeckPool) {
    assertCard(cardId, "playerADeckPool");
  }
  for (const cardId of scenario.playerBHand) {
    assertCard(cardId, "playerBHand");
  }
  for (const cardId of scenario.playerBDeckPool) {
    assertCard(cardId, "playerBDeckPool");
  }
  for (const spawned of scenario.spawnedUnits) {
    assertCard(spawned.cardId, "spawnedUnits");
  }
}

function ensureExpectedPlayCardFirst(match: MatchState, cardId: string): void {
  const player = match.players[match.activeSide];
  const idx = player.hand.findIndex((id) => id === cardId);
  if (idx <= 0) {
    return;
  }
  const [card] = player.hand.splice(idx, 1);
  if (card) {
    player.hand.unshift(card);
  }
}

function currentStep(match: MatchState): TutorialScriptStep | null {
  const tutorial = match.tutorial;
  if (!tutorial) {
    return null;
  }
  const script = scriptForScenario(tutorial.scenarioId);
  if (tutorial.stepIndex < 0 || tutorial.stepIndex >= script.length) {
    return null;
  }
  return script[tutorial.stepIndex] as TutorialScriptStep;
}

function applyStepState(match: MatchState, stepIndex: number, now: number): void {
  if (!match.tutorial) {
    return;
  }
  const script = scriptForScenario(match.tutorial.scenarioId);
  const bounded = Math.max(0, Math.min(stepIndex, script.length - 1));
  const step = script[bounded] as TutorialScriptStep;
  const prevRemaining = match.tutorial.pausedRemainingMs;

  match.tutorial.stepIndex = bounded;
  match.tutorial.totalSteps = script.length;
  match.tutorial.title = step.title;
  match.tutorial.body = step.body;
  match.tutorial.actionHint = step.actionHint;
  match.tutorial.paused = step.requiresAck;
  match.tutorial.canSkip = true;
  match.tutorial.coachAnchorKind = step.coachAnchor?.kind ?? "none";
  match.tutorial.coachCardId = step.coachAnchor?.kind === "hand-card" ? step.coachAnchor.cardId : undefined;
  match.tutorial.coachSide = step.coachAnchor?.kind === "slot" ? step.coachAnchor.side : undefined;
  match.tutorial.coachLane = step.coachAnchor?.kind === "slot" ? step.coachAnchor.lane : undefined;
  match.tutorial.coachCol = step.coachAnchor?.kind === "slot" ? step.coachAnchor.col : undefined;
  match.tutorial.coachButtonId = step.coachAnchor?.kind === "button" ? step.coachAnchor.buttonId : undefined;

  if (step.expectedAction?.kind === "play") {
    ensureExpectedPlayCardFirst(match, step.expectedAction.cardId);
  }

  if (step.requiresAck) {
    const remaining = Math.max(1_000, prevRemaining ?? Math.max(1_000, match.turnDeadlineAt - now));
    match.tutorial.pausedRemainingMs = remaining;
    match.turnDeadlineAt = now + remaining;
  } else {
    const remaining = Math.max(1_000, prevRemaining ?? TURN_SECONDS * 1_000);
    match.turnDeadlineAt = now + remaining;
    match.tutorial.pausedRemainingMs = undefined;
  }
}

function spawnUnit(match: MatchState, side: PlayerSide, lane: "front" | "back", col: number, cardId: string): string {
  const card = getCard(cardId);
  const unitId = uniqueId("u", match.seed, match.rngCounter + 1_001);
  match.rngCounter += 1;

  const unit: UnitState = {
    id: unitId,
    owner: side,
    cardId,
    name: card.name,
    attack: card.attack ?? 0,
    health: card.health ?? 1,
    maxHealth: card.health ?? 1,
    lane,
    col,
    traits: [...card.traits],
    cannotAttackUntilTurn: match.turn + 1,
    shieldCharges: 0,
  };
  match.units[unitId] = unit;
  match.players[side].board[lane][col] = unitId;
  return unitId;
}

export function setupTutorialMatch(match: MatchState, scenarioId: TutorialScenarioId, now = nowTs()): MatchState {
  const scenario = scenarioConfig(scenarioId);
  assertScenarioUsesAllowedFactions(scenario);
  match.mode = "tutorial";
  match.tutorial = {
    scenarioId: scenario.id,
    stepIndex: 0,
    totalSteps: scenario.script.length,
    paused: true,
    canSkip: true,
    title: "",
    body: "",
    actionHint: "",
    pausedRemainingMs: TURN_SECONDS * 1_000,
  };

  const playerA = match.players.A;
  const playerB = match.players.B;
  playerA.isBot = false;
  playerB.isBot = false;
  playerA.botLevel = undefined;
  playerB.botLevel = undefined;

  playerA.shares = 1_000;
  playerB.shares = 1_000;
  playerA.favor = 0;
  playerB.favor = 0;
  playerA.probation = 0;
  playerB.probation = 0;
  playerA.leader.hp = playerA.leader.maxHp;
  playerB.leader.hp = playerB.leader.maxHp;
  playerA.nakedShortDebt = 0;
  playerB.nakedShortDebt = 0;
  playerA.judgeHostility = 0;
  playerB.judgeHostility = 0;
  playerA.blockedLane = undefined;
  playerB.blockedLane = undefined;
  playerA.blockedCol = undefined;
  playerB.blockedCol = undefined;
  playerA.curtainEventId = undefined;
  playerB.curtainEventId = undefined;
  playerA.mulliganDone = true;
  playerB.mulliganDone = true;

  playerA.board.front = new Array(BOARD_COLS).fill(null);
  playerA.board.back = new Array(BOARD_COLS).fill(null);
  playerB.board.front = new Array(BOARD_COLS).fill(null);
  playerB.board.back = new Array(BOARD_COLS).fill(null);

  const fullDeckA = padDeckToHundred(scenario.playerADeckPool);
  const fullDeckB = padDeckToHundred(scenario.playerBDeckPool);
  playerA.hand = [...scenario.playerAHand];
  playerB.hand = [...scenario.playerBHand];
  playerA.deck = fullDeckA.slice(playerA.hand.length);
  playerB.deck = fullDeckB.slice(playerB.hand.length);
  playerA.discard = [];
  playerB.discard = [];

  match.units = {};
  match.eventUnits = {};
  match.eventRow = new Array(BOARD_COLS).fill(null);
  for (const spawned of scenario.spawnedUnits) {
    spawnUnit(match, spawned.side, spawned.lane, spawned.col, spawned.cardId);
  }

  match.status = "active";
  match.turn = 1;
  match.activeSide = "A";
  match.mulliganDeadlineAt = now + MULLIGAN_SECONDS * 1_000;
  match.turnDeadlineAt = now + TURN_SECONDS * 1_000;
  match.winnerSide = undefined;
  match.winReason = undefined;
  match.verdictGrantedTo = undefined;
  match.judgeMood = 0;
  match.log = [{ at: now, turn: 1, text: `${scenario.title} created. Follow guided steps.` }];

  applyStepState(match, 0, now);
  match.updatedAt = now;
  return match;
}

export function tutorialTickPause(match: MatchState, now = nowTs()): MatchState {
  if (match.mode !== "tutorial" || !match.tutorial?.paused) {
    return match;
  }
  const remaining = Math.max(1_000, match.tutorial.pausedRemainingMs ?? TURN_SECONDS * 1_000);
  match.tutorial.pausedRemainingMs = remaining;
  match.turnDeadlineAt = now + remaining;
  match.updatedAt = now;
  return match;
}

export function acknowledgeTutorialStep(match: MatchState, side: PlayerSide, now = nowTs()): MatchActionResult {
  if (match.mode !== "tutorial" || !match.tutorial) {
    return { ok: false, error: "This match is not a tutorial.", match };
  }
  if (match.activeSide !== side) {
    return { ok: false, error: "Wait for your tutorial turn.", match };
  }
  const step = currentStep(match);
  if (!step) {
    return { ok: false, error: "Tutorial step is unavailable.", match };
  }
  if (!step.requiresAck || !match.tutorial.paused) {
    return { ok: false, error: "Current tutorial step does not require acknowledgement.", match };
  }

  if (step.expectedAction) {
    match.tutorial.paused = false;
    match.tutorial.pausedRemainingMs = undefined;
    match.turnDeadlineAt = now + TURN_SECONDS * 1_000;
    match.updatedAt = now;
    return { ok: true, match };
  }

  const nextIndex = Math.min(match.tutorial.stepIndex + 1, match.tutorial.totalSteps - 1);
  applyStepState(match, nextIndex, now);
  match.updatedAt = now;
  return { ok: true, match };
}

export function skipTutorial(match: MatchState, side: PlayerSide, now = nowTs()): MatchActionResult {
  if (match.mode !== "tutorial" || !match.tutorial) {
    return { ok: false, error: "This match is not a tutorial.", match };
  }
  if (match.players.A.side !== side && match.players.B.side !== side) {
    return { ok: false, error: "Invalid tutorial side.", match };
  }
  match.status = "finished";
  match.winReason = "concede";
  match.winnerSide = side === "A" ? "B" : "A";
  match.tutorial.paused = true;
  match.tutorial.title = "Tutorial skipped";
  match.tutorial.body = "You can start tutorial again from lobby any time.";
  match.tutorial.actionHint = "Return to lobby and start a new tutorial when ready.";
  match.updatedAt = now;
  return { ok: true, match };
}

function validatePlayStep(match: MatchState, step: TutorialExpectedAction & { kind: "play" }, action: PlayCardInput): ValidateResult {
  const player = match.players[action.side];
  const cardId = player.hand[action.handIndex];
  if (!cardId) {
    return { ok: false, error: "Tutorial: choose a valid card from hand." };
  }
  if (cardId !== step.cardId) {
    return { ok: false, error: `Tutorial step expects card: ${getCard(step.cardId).name}.` };
  }
  const expectedCard = getCard(step.cardId);
  if (expectedCard.type === "unit" && (action.lane !== step.lane || action.col !== step.col)) {
    return {
      ok: false,
      error: `Tutorial step expects placement at ${step.lane} row, column ${step.col + 1}.`,
    };
  }
  if (!step.targetKind) {
    return { ok: true };
  }
  if (!action.target || action.target.kind !== step.targetKind) {
    return { ok: false, error: `Tutorial step expects target: ${step.targetKind}.` };
  }
  if (!step.targetCardId) {
    return { ok: true };
  }
  if (action.target.kind === "ally-unit" || action.target.kind === "enemy-unit") {
    const targetUnit = match.units[action.target.unitId];
    if (!targetUnit || targetUnit.cardId !== step.targetCardId) {
      return { ok: false, error: `Tutorial expects target card: ${getCard(step.targetCardId).name}.` };
    }
  }
  return { ok: true };
}

function validateAttackStep(
  match: MatchState,
  step: TutorialExpectedAction & { kind: "attack" },
  action: AttackInput,
): ValidateResult {
  const attacker = match.units[action.attackerUnitId];
  if (!attacker || attacker.cardId !== step.attackerCardId) {
    return { ok: false, error: `Tutorial expects attacker: ${getCard(step.attackerCardId).name}.` };
  }
  if (action.target.kind !== step.targetKind) {
    return { ok: false, error: `Tutorial expects attack target kind: ${step.targetKind}.` };
  }
  if (step.targetKind === "unit" && step.targetCardId) {
    if (action.target.kind !== "unit") {
      return { ok: false, error: "Tutorial expects a unit target." };
    }
    const target = match.units[action.target.unitId];
    if (!target || target.cardId !== step.targetCardId) {
      return { ok: false, error: `Tutorial expects enemy unit on board: ${getCard(step.targetCardId).name}.` };
    }
  }
  return { ok: true };
}

export function validateTutorialAction(
  match: MatchState,
  side: PlayerSide,
  kind: TutorialActionKind,
  action: PlayCardInput | AttackInput | { side: PlayerSide },
): ValidateResult {
  if (match.mode !== "tutorial" || !match.tutorial) {
    return { ok: true };
  }
  if (match.activeSide !== side) {
    return { ok: false, error: "Tutorial: wait for your turn." };
  }

  const step = currentStep(match);
  if (!step) {
    return { ok: false, error: "Tutorial step unavailable." };
  }
  if (match.tutorial.paused) {
    return {
      ok: false,
      error: `Tutorial paused: ${step.title}. ${step.actionHint}`,
    };
  }
  if (!step.expectedAction) {
    return { ok: false, error: "Tutorial: this step requires acknowledgement first." };
  }
  if (step.expectedAction.kind !== kind) {
    return { ok: false, error: `Tutorial step: ${step.actionHint}` };
  }

  if (kind === "play") {
    return validatePlayStep(match, step.expectedAction as TutorialExpectedAction & { kind: "play" }, action as PlayCardInput);
  }
  if (kind === "attack") {
    return validateAttackStep(match, step.expectedAction as TutorialExpectedAction & { kind: "attack" }, action as AttackInput);
  }
  return { ok: true };
}

export function advanceTutorialAfterAction(
  match: MatchState,
  kind: TutorialActionKind,
  now = nowTs(),
): void {
  if (match.mode !== "tutorial" || !match.tutorial) {
    return;
  }
  const step = currentStep(match);
  if (!step || !step.expectedAction || step.expectedAction.kind !== kind) {
    return;
  }
  const nextIndex = Math.min(match.tutorial.stepIndex + 1, match.tutorial.totalSteps - 1);
  applyStepState(match, nextIndex, now);
  if (nextIndex >= match.tutorial.totalSteps - 1) {
    match.status = "finished";
    match.winnerSide = "A";
    match.winReason = "concede";
  }
  match.updatedAt = now;
}

export function maybeAutoPassTutorialOpponent(match: MatchState): void {
  if (match.mode !== "tutorial" || !match.tutorial) {
    return;
  }
  if (match.status !== "active") {
    return;
  }
  if (match.activeSide !== "B") {
    return;
  }
  match.activeSide = "A";
  match.turn += 1;
  match.turnDeadlineAt = nowTs() + TURN_SECONDS * 1_000;
}
