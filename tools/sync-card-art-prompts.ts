import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CARD_CATALOG_V2 } from "../src/shared/cards/index.ts";
import { getCardPreview } from "../src/shared/cards.ts";

type FactionFolder =
  | "sec"
  | "market_makers"
  | "wallstreet"
  | "retail_mob"
  | "short_hedgefund"
  | "neutral"
  | "utility";

type PromptAction = "created" | "updated" | "unchanged";

type PromptSyncRow = {
  id: string;
  faction: FactionFolder;
  kind: "unit" | "instrument" | "upgrade";
  hasArt: boolean;
  hadPrompt: boolean;
  action: PromptAction;
};

type PromptSyncSummary = {
  totalCards: number;
  promptCreated: number;
  promptUpdatedMissingArt: number;
  promptUnchanged: number;
  cardsMissingArt: number;
  cardsWithArt: number;
  promptFilesMissingBefore: number;
};

const ROOT = process.cwd();
const CARD_ASSET_ROOT = path.join(ROOT, "public", "assets", "cards");
const PROMPT_ROOT = path.join(CARD_ASSET_ROOT, "prompts");
const INCLUDE_EXISTING_ART = process.argv.includes("--include-existing-art");
const ALLOW_CREATE = process.argv.includes("--allow-create");

const FACTION_WORLD: Record<FactionFolder, string> = {
  sec: "regulatory courtroom pressure, enforcement rituals, stamped filings, disciplined legal force",
  market_makers: "exchange microstructure, order-book geometry, spread warfare, high-frequency market choreography",
  wallstreet: "institutional finance towers, deal-floor power, capital machinery, polished but predatory boardroom atmosphere",
  retail_mob: "grassroots investor energy, meme-fueled conviction, improvised street-finance tactics, community momentum",
  short_hedgefund: "covert liquidity games, shadow research ops, strategic panic engineering, elegant financial sabotage",
  neutral: "civic market infrastructure, procedural neutrality, courthouse-adjacent public systems",
  utility: "market infrastructure instruments, legal filings, procedural tools, cross-faction financial maneuvers",
};

const FACTION_FRAME_STYLE: Record<FactionFolder, string> = {
  sec: "Brushed steel frame with red enforcement accents, legal-seal detailing, institutional precision, disciplined courtroom authority.",
  market_makers: "Graphite frame with emerald liquidity accents, micro-grid etching, exchange-tech finish, precise execution feel.",
  wallstreet: "Black onyx frame with rich gold trims, executive polish, premium capital-floor gravitas, controlled contrast.",
  retail_mob: "Electric blue frame with bright cyan accents, kinetic contour notches, rebellious but readable street-finance energy.",
  short_hedgefund: "Obsidian frame with violet-magenta covert accents, surgical shadow layering, clandestine finance tone, predatory elegance.",
  neutral: "Slate-and-silver civic frame, procedural symmetry, balanced institutional mood, trustworthy infrastructure feel.",
  utility: "Gunmetal frame with amber/brass service accents, practical instrument-grade finish, modular procedural tool aesthetics.",
};

const GLOBAL_SPEC =
  "Format/spec: vertical 3:4 at 768x1024, illustration only (not a UI mockup). Visual style target: high-detail stylized digital painting / illustration with crisp edges and clean shading (not pixel art). Build a polished in-world card frame integrated with the illustration using consistent border proportions, rounded corners, beveled depth, crisp edge control, and premium finish.";

const GLOBAL_NEGATIVES =
  "No readable text, letters, numbers, UI labels, stat gems, logos, watermarks, signatures, interface overlays, random glyphs, or partial typography in props/signage. No title plaque, nameplate, bottom text panel, or printed card title. No pixel art, no 8-bit/16-bit sprite look, no voxel look, no mosaic dithering, no retro game card template. Keep setting contemporary financial-court world, not medieval fantasy armor/knights unless explicitly required by the card concept. Avoid chaotic clutter, muddy silhouettes, plastic-looking materials, and compression artifacts.";

function titleCaseFaction(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSpecials(cardId: string): string {
  const preview = getCardPreview(cardId);
  if (!preview.specialsLine) {
    return "none";
  }
  return preview.specialsLine.replace(/^Specials:\s*/i, "").trim();
}

function formatTriggers(cardId: string): string {
  const preview = getCardPreview(cardId);
  if (!preview.triggersLine) {
    return "none";
  }
  return preview.triggersLine.replace(/^Triggers:\s*/i, "").trim();
}

function formatJudgeMechanics(cardId: string): string {
  const preview = getCardPreview(cardId);
  if (!preview.judgeMechanicsLine) {
    return "none";
  }
  return preview.judgeMechanicsLine.replace(/^Judge mechanics:\s*/i, "").trim();
}

function laneForPrompt(card: (typeof CARD_CATALOG_V2)[number]): string {
  if (card.kind !== "unit") {
    return "n/a (non-unit card)";
  }
  if (card.lane === "front") return "front row only";
  if (card.lane === "back") return "back row only";
  return "both rows";
}

function roleVisualCue(role: (typeof CARD_CATALOG_V2)[number]["role"]): string {
  if (role === "offense") return "grounded, natural combat-ready posture with assertive presence and clear silhouette";
  if (role === "defense") return "stable anchored posture, protective body language, defensive mass and calm control";
  if (role === "support") return "natural assisting posture, coordination props, situational awareness and team-readiness";
  if (role === "control") return "composed procedural authority, disruption cues, measured denial-oriented staging";
  if (role === "economy") return "deliberate capital-flow props, transactional focus, resource-management atmosphere";
  return "practical tool-first staging, clear operational function, natural pose and readable environment";
}

function keywordVisualCue(keyword: string): string {
  if (keyword === "taunt") return "defensive anchor posture and broad blocking silhouette";
  if (keyword === "rush") return "coiled readiness and imminent action tension without exaggerated motion blur";
  if (keyword === "reach") return "extended striking capability shown through tool/weapon proportions and spatial setup";
  if (keyword === "ranged") return "distance precision shown through calm aim posture and ranged-tool readability";
  if (keyword === "dirty") return "subtle illicit-finance cues, clandestine props, morally ambiguous mood";
  if (keyword === "flip") return "duality or switch-state symbolism in props/pose/composition";
  if (keyword === "negotiator") return "bargaining gestures, contracts, calibrated diplomacy tension";
  if (keyword === "prosecutor") return "evidence folders, legal exhibits, strict adjudication posture";
  return keyword;
}

function classifyNonUnit(cardId: string): string {
  const preview = getCardPreview(cardId);
  const impact = preview.cardImpactLine.toLowerCase();
  if (impact.includes("derivative")) {
    return "derivative";
  }
  if (impact.includes("heal")) {
    return "heal";
  }
  if (impact.includes("upgrade")) {
    return "upgrade";
  }
  if (impact.includes("spell")) {
    return "spell";
  }
  return "spell";
}

function extractEffectsLabel(cardId: string): string {
  const preview = getCardPreview(cardId);
  const match = preview.fullEffectShortText.match(/Effects:\s*([^.]*)/i);
  if (!match) {
    return "none";
  }
  return (match[1] ?? "").trim() || "none";
}

function targetingVisualCue(targeting: string): string {
  if (targeting === "ally-unit") return "single allied unit receives the effect";
  if (targeting === "enemy-unit") return "single enemy unit is targeted";
  if (targeting === "ally-unit-or-leader") return "effect can be directed at one ally unit or the allied leader";
  if (targeting === "enemy-unit-or-leader") return "effect can be directed at one enemy unit or the enemy leader";
  return "no explicit target-selection staging required";
}

function trimSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) {
    return "";
  }
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function conciseMechanicsCue(card: (typeof CARD_CATALOG_V2)[number], cardId: string): string {
  const effects = extractEffectsLabel(cardId);
  const triggers = formatTriggers(cardId);
  const specials = formatSpecials(cardId);
  const judge = formatJudgeMechanics(cardId);
  const parts: string[] = [];

  if (effects !== "none") {
    parts.push(`Imply gameplay function through visual storytelling around ${effects.toLowerCase()}`);
  }
  if (specials !== "none") {
    const cleaned = specials.replace(/^Judge (Green|Blue) specialist.*$/i, "judge-slot specialist behavior");
    parts.push(`Show specialty traits as visual identity cues (${cleaned})`);
  }
  if (triggers !== "none") {
    parts.push(`Hint at conditional timing effects through action staging (${triggers})`);
  }
  if (judge !== "none") {
    parts.push("Include judge-dais interaction language and direct courtroom pressure dynamics");
  }
  if (parts.length === 0) {
    return "Mechanics cue: focus on strong role readability and faction flavor without explicit effect props.";
  }
  return `${parts.join(". ")}.`;
}

function gameplayFantasyLine(card: (typeof CARD_CATALOG_V2)[number], cardId: string): string {
  const effects = extractEffectsLabel(cardId).toLowerCase();
  const hasTriggers = formatTriggers(cardId) !== "none";
  const targeting = card.impactTargetRule ?? "none";

  if (card.kind !== "unit") {
    const cardClass = classifyNonUnit(cardId);
    if (cardClass === "heal") {
      return "Gameplay fantasy: a tactical support play that stabilizes your side, repairs pressure points, and swings momentum through controlled intervention.";
    }
    if (cardClass === "derivative") {
      return "Gameplay fantasy: a high-risk financial instrument that injects leverage and instability into the board state.";
    }
    if (card.kind === "upgrade") {
      return "Gameplay fantasy: a targeted enhancement package that upgrades one asset and shifts the local combat math.";
    }
    if (targeting !== "none") {
      return "Gameplay fantasy: a precise spell-like action card aimed at one target to change tempo immediately.";
    }
    return "Gameplay fantasy: a procedural action card that reshapes tempo, resources, or board pressure without adding a unit.";
  }

  if ((card.keywords ?? []).includes("taunt")) {
    return "Gameplay fantasy: a frontline anchor that draws attention, absorbs pressure, and forces the fight to happen on its terms.";
  }
  if ((card.keywords ?? []).includes("ranged")) {
    return "Gameplay fantasy: a backline specialist that projects pressure from safety and punishes exposed lanes.";
  }
  if ((card.keywords ?? []).includes("rush")) {
    return "Gameplay fantasy: an immediate tempo threat that enters hot and changes combat the same turn.";
  }
  if (hasTriggers) {
    return "Gameplay fantasy: a reactive unit whose value comes from timing, contact, and repeated conditional procs.";
  }
  if (card.role === "defense") {
    return "Gameplay fantasy: a durable board stabilizer that protects tempo and keeps your formation intact.";
  }
  if (card.role === "support" || card.role === "control") {
    return "Gameplay fantasy: a utility body that creates small edges through positioning, timing, and board interaction.";
  }
  return "Gameplay fantasy: a direct pressure unit built to contest space and push combat outcomes.";
}

function unitSubjectDirection(card: Extract<(typeof CARD_CATALOG_V2)[number], { kind: "unit" }>, factionTitle: string): string {
  const lane = laneForPrompt(card);
  const keywords = card.keywords ?? [];
  const keywordCue = keywords.length > 0 ? keywords.map(keywordVisualCue).join("; ") : "no keyword-specific pose requirement";
  const dirty = (card.dirtyPower ?? 0) > 0 ? "Include subtle legal-risk / illicit-finance undertones without cartoon villain props." : "";
  return [
    `Depict a distinct ${factionTitle} unit character or operator for ${card.name} with ${roleVisualCue(card.role)}.`,
    `Board identity cue: ${lane}.`,
    `Keyword-driven staging: ${keywordCue}.`,
    `Prefer static, natural posing and believable environment storytelling over exaggerated action poses.`,
    dirty,
  ]
    .filter((one) => one.length > 0)
    .join(" ");
}

function nonUnitSubjectDirection(card: Extract<(typeof CARD_CATALOG_V2)[number], { kind: "instrument" | "upgrade" }>): string {
  const cls = classifyNonUnit(card.id);
  const targeting = card.impactTargetRule && card.impactTargetRule !== "none" ? card.impactTargetRule : "none";
  const objectBias =
    cls === "derivative"
      ? "Show a financial instrument / leveraged contract scene with visible tension, not a creature portrait."
      : cls === "heal"
        ? "Show a support intervention, repair, patch, or restorative procedural action."
        : card.kind === "upgrade"
          ? "Show an upgrade/attachment process or enhancement tool being applied in-world."
          : "Show an in-world spell-like instrument or procedure effect as the focal event.";
  return [
    `Depict ${card.name} as a non-unit ${cls} action card event (instrument-grade illustration, not a character-only portrait).`,
    objectBias,
    `Targeting cue for composition: ${targetingVisualCue(targeting)}.`,
  ].join(" ");
}

function cardSpecificArtCues(card: (typeof CARD_CATALOG_V2)[number]): string {
  const id = card.id.toLowerCase();
  const name = card.name.toLowerCase();
  const cues: string[] = [];

  if (id.startsWith("cleanup_") || name.includes("cleanup") || name.includes("wet floor") || name.includes("emergency cone")) {
    cues.push(
      "Depict modern janitorial / maintenance operations inside a courthouse-market venue using realistic custodial tools (cart, cone, mop, caution gear) and contemporary workwear; avoid fantasy soldiers, swords, or medieval armor.",
    );
  }

  if (card.kind !== "unit" && (name.includes("committee") || name.includes("audit"))) {
    cues.push(
      "If showing people, present them as contemporary committee members / compliance staff in a modern institutional setting, with paperwork and governance props but no readable documents.",
    );
  }

  return cues.join(" ");
}

function buildPromptText(card: (typeof CARD_CATALOG_V2)[number]): string {
  const preview = getCardPreview(card.id);
  const faction = card.faction as FactionFolder;
  const factionTitle = titleCaseFaction(faction);
  const kindLabel = card.kind === "unit" ? "unit" : `${classifyNonUnit(card.id)} ${card.kind}`;
  const subjectDirection = card.kind === "unit" ? unitSubjectDirection(card, factionTitle) : nonUnitSubjectDirection(card);
  const mechanicsCue = conciseMechanicsCue(card, card.id);
  const survivalCue =
    preview.survivalLine !== "n/a (non-unit card)" ? `Defensive readability cue: ${preview.survivalLine}.` : "";
  const specificCues = cardSpecificArtCues(card);

  const promptBody = [
    `Create a production-ready collectible card illustration for online TCG Court of Capital Game for card named ${card.name}.`,
    GLOBAL_SPEC,
    `Faction for art direction: ${factionTitle}. Card type for art direction: ${kindLabel}.`,
    `Narrative of card: ${trimSentence(card.description)} Court lore: ${trimSentence(card.court_case ?? "Infer the in-world case tone from the card identity and faction.")}`,
    subjectDirection,
    specificCues,
    mechanicsCue,
    gameplayFantasyLine(card, card.id),
    survivalCue,
    `Faction frame direction: ${FACTION_FRAME_STYLE[faction]}`,
    `Faction world direction: ${FACTION_WORLD[faction]}.`,
    `Composition and production direction: one dominant focal subject/event, strong silhouette separation, readable at thumbnail size, center-weighted focal mass near upper-middle of the art window, controlled cinematic lighting, physically plausible materials, clean depth layering, premium finish.`,
    `This is art direction only; do not depict gameplay UI or text.`,
    GLOBAL_NEGATIVES,
  ]
    .filter((one) => one.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return promptBody;
}

function hasCardArt(faction: FactionFolder, cardId: string): boolean {
  const png = path.join(CARD_ASSET_ROOT, faction, `${cardId}.png`);
  const svg = path.join(CARD_ASSET_ROOT, faction, `${cardId}.svg`);
  return existsSync(png) || existsSync(svg);
}

function readTextIfExists(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, "utf8");
}

function syncPrompts(): { rows: PromptSyncRow[]; summary: PromptSyncSummary } {
  const rows: PromptSyncRow[] = [];
  let promptCreated = 0;
  let promptUpdatedMissingArt = 0;
  let promptUnchanged = 0;
  let cardsMissingArt = 0;
  let cardsWithArt = 0;
  let promptFilesMissingBefore = 0;

  for (const card of CARD_CATALOG_V2) {
    const faction = card.faction as FactionFolder;
    const promptDir = path.join(PROMPT_ROOT, faction);
    const promptPath = path.join(promptDir, `${card.id}.md`);
    const hadPrompt = existsSync(promptPath);
    const hasArt = hasCardArt(faction, card.id);

    if (hasArt) {
      cardsWithArt += 1;
    } else {
      cardsMissingArt += 1;
    }
    if (!hadPrompt) {
      promptFilesMissingBefore += 1;
    }

    let action: PromptAction = "unchanged";
    const eligibleForSync = INCLUDE_EXISTING_ART || !hasArt;
    const shouldWrite = eligibleForSync && (ALLOW_CREATE || hadPrompt);
    if (shouldWrite) {
      mkdirSync(promptDir, { recursive: true });
      const nextContent = `${buildPromptText(card)}\n`;
      const currentContent = readTextIfExists(promptPath);
      if (currentContent !== nextContent) {
        writeFileSync(promptPath, nextContent, "utf8");
      }
      if (!hadPrompt) {
        promptCreated += 1;
        action = "created";
      } else if (!hasArt || INCLUDE_EXISTING_ART) {
        promptUpdatedMissingArt += 1;
        action = "updated";
      } else {
        promptUnchanged += 1;
      }
    } else {
      promptUnchanged += 1;
    }

    rows.push({
      id: card.id,
      faction,
      kind: card.kind,
      hasArt,
      hadPrompt,
      action,
    });
  }

  return {
    rows,
    summary: {
      totalCards: CARD_CATALOG_V2.length,
      promptCreated,
      promptUpdatedMissingArt,
      promptUnchanged,
      cardsMissingArt,
      cardsWithArt,
      promptFilesMissingBefore,
    },
  };
}

function main(): void {
  const { rows, summary } = syncPrompts();
  const byFaction = new Map<FactionFolder, { created: number; updated: number; unchanged: number; missingArt: number }>();
  for (const row of rows) {
    const bucket = byFaction.get(row.faction) ?? { created: 0, updated: 0, unchanged: 0, missingArt: 0 };
    if (row.action === "created") bucket.created += 1;
    if (row.action === "updated") bucket.updated += 1;
    if (row.action === "unchanged") bucket.unchanged += 1;
    if (!row.hasArt) bucket.missingArt += 1;
    byFaction.set(row.faction, bucket);
  }

  console.log("Card art prompt sync complete.");
  console.log(`mode: ${INCLUDE_EXISTING_ART ? "all cards" : "missing-art cards only (skip cards with existing art)"}`);
  console.log(`create mode: ${ALLOW_CREATE ? "allowed (can create missing prompt files)" : "edit existing prompt files only"}`);
  console.log(JSON.stringify(summary, null, 2));
  console.table(
    [...byFaction.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([faction, counts]) => ({ faction, ...counts })),
  );
}

main();
