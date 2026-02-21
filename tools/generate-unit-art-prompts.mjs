import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "src", "shared", "card-catalog.ts");
const outBase = path.join(root, "public", "assets", "cards", "prompts");
const factionArg = process.argv.find((arg) => arg.startsWith("--faction="))?.split("=")[1] ?? null;

const src = fs.readFileSync(sourcePath, "utf8");

const sectionToFaction = {
  secCombat: "sec",
  secSupport: "sec",
  marketCombat: "market_makers",
  marketSupport: "market_makers",
  wallstreetCombat: "wallstreet",
  wallstreetSupport: "wallstreet",
  retailCombat: "retail_mob",
  retailSupport: "retail_mob",
  shortCombat: "short_hedgefund",
  shortSupport: "short_hedgefund",
};

/** @typedef {{id:string,name:string,faction:string,text:string,traits:string[],dirty:number}} UnitEntry */
/** @type {Map<string, UnitEntry>} */
const units = new Map();

function parseUnitObject(body, faction) {
  const id = body.match(/id:\s*"([^"]+)"/)?.[1];
  const name = body.match(/name:\s*"([^"]+)"/)?.[1];
  const text = body.match(/text:\s*"([^"]+)"/)?.[1] ?? "";
  if (!id || !name) return null;
  const traitsRaw = body.match(/traits:\s*\[([^\]]*)\]/)?.[1] ?? "";
  const traits = [...traitsRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const dirty = Number.parseInt(body.match(/dirty:\s*(\d+)/)?.[1] ?? "0", 10);
  return { id, name, faction, text, traits, dirty };
}

const sectionRegex = /const\s+(\w+):\s*UnitSeed\[\]\s*=\s*\[([\s\S]*?)\];/g;
for (const m of src.matchAll(sectionRegex)) {
  const section = m[1];
  const block = m[2];
  const faction = sectionToFaction[section];
  if (!faction) continue;
  const objRegex = /\{([\s\S]*?)\}\s*,?/g;
  for (const o of block.matchAll(objRegex)) {
    const parsed = parseUnitObject(o[1], faction);
    if (parsed) units.set(parsed.id, parsed);
  }
}

const neutralUnitRegex = /mkUnit\("neutral",\s*\{([\s\S]*?)\}\)/g;
for (const m of src.matchAll(neutralUnitRegex)) {
  const parsed = parseUnitObject(m[1], "neutral");
  if (parsed) units.set(parsed.id, parsed);
}

const factionLore = {
  sec: "regulatory courtroom pressure, enforcement rituals, stamped filings, disciplined legal force",
  market_makers: "exchange microstructure, order-book geometry, spread warfare, high-frequency market choreography",
  wallstreet: "institutional finance towers, deal-floor power, capital machinery, polished but predatory boardroom atmosphere",
  retail_mob: "grassroots investor energy, meme-fueled conviction, improvised street-finance tactics, community momentum",
  short_hedgefund: "covert liquidity games, shadow research ops, strategic panic engineering, elegant financial sabotage",
  neutral: "civic market infrastructure, procedural neutrality, courthouse-adjacent public systems",
};

const globalFrameBlueprint =
  "Create full card art in vertical 3:4 format on 384x512 canvas for mobile-first usage. Keep safe zone at least 28px from every edge. Use one stable frame architecture: outer border thickness 8px, inner border thickness 4px, corner radius 14px, inner art window inset 24px from outer edge, subtle bevel depth, clean vector-like edge quality. Do not include any stats, numbers, badges, labels, logos, symbols of UI, watermarks, signatures, letters, words, glyphs, runes, or any readable/partial text in the final image. No typographic shapes inside props either. Keep center area clean for mobile readability. No blur overload, no heavy grain, no compression artifacts. Target payload size: SVG below 90KB preferred, PNG below 140KB if raster is required.";

const factionStyleBlueprint = {
  sec: "SEC frame style: steel-blue legal frame with brushed metal texture, fine document-engraving lines, restrained cyan edge glow, sober institutional feel, high discipline and clarity.",
  market_makers:
    "Market Makers frame style: graphite and deep cobalt frame, precision micro-grid etching, subtle liquidity-wave accents, high-tech exchange feel, calm but sharp execution energy.",
  wallstreet:
    "Wallstreet frame style: dark navy with restrained gold trims, premium polished finish, executive gravitas, capital-heavy aura, elegant highlights with controlled contrast.",
  retail_mob:
    "Retail Mob frame style: electric navy frame with punchy but clean cyan accents, kinetic contour notches, rebellious street-finance vibe, energetic yet readable silhouette support.",
  short_hedgefund:
    "Short Hedgefund frame style: obsidian-blue frame with cold silver accents, covert geometric motifs, surgical shadow layering, clandestine finance tone, predatory elegance.",
  neutral:
    "Neutral frame style: balanced midnight-blue frame with clean civic-metal accents, procedural symmetry, trustworthy infrastructure mood, no extreme stylistic bias.",
};

const qualityRules =
  "Lighting should be cinematic but restrained, with controlled bloom and physically plausible materials. Keep composition readable on mobile first. Main focal object or character should sit near horizontal center and around 42 percent of image height. Preserve strong silhouette separation between foreground, midground, and background.";

function traitDirections(traits, dirty) {
  const parts = [];
  if (traits.includes("taunt")) parts.push("pose as a defensive anchor with a broad blocking stance and visible protective intent");
  if (traits.includes("rush")) parts.push("communicate sudden acceleration with directional motion trails and forward momentum");
  if (traits.includes("reach")) parts.push("show extended striking capability using long-range weapon/tool silhouettes and depth perspective");
  if (traits.includes("ranged")) parts.push("frame the subject as a precise distance attacker with aim-focused posture and ranged tool language");
  if (traits.includes("dirty")) parts.push("inject subtle illicit-finance cues, clandestine props, and morally ambiguous mood without explicit text");
  if (traits.includes("negotiator")) parts.push("add bargaining symbolism such as contracts, hand signals, or calibrated diplomacy tension");
  if (traits.includes("prosecutor")) parts.push("add prosecutorial authority cues: evidence folders, legal exhibits, strict adjudication posture");
  if (dirty > 0) parts.push("use restrained high-contrast accents suggesting elevated regulatory risk and potential sanction pressure");
  return parts.length ? parts.join(". ") + "." : "Prioritize strong silhouette clarity and role legibility at a glance.";
}

function sanitizeName(name) {
  return name.replace(/[<>:"/\\|?*]/g, "").trim();
}

function toTitleCase(value) {
  return value
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function cardPrompt(unit) {
  const faction = unit.faction in factionStyleBlueprint ? unit.faction : "neutral";
  const factionTitle = toTitleCase(faction);
  const loreLine = unit.text.trim().replace(/\.$/, "");
  const roleLine = traitDirections(unit.traits, unit.dirty);

  return [
    `Generate one production-ready collectible card illustration for Court of Capital.`,
    `Card identity for art direction only: name ${unit.name}, id ${unit.id}, faction ${factionTitle}.`,
    `Visual objective: depict this specific card as a unique scene with clear narrative intent based on this lore cue: ${loreLine}.`,
    globalFrameBlueprint,
    factionStyleBlueprint[faction],
    `Faction worldbuilding atmosphere: ${factionLore[faction] ?? factionLore.neutral}.`,
    `Role behavior cues for pose and staging: ${roleLine}`,
    qualityRules,
    `Scene design requirements: one dominant focal subject, coherent courthouse-plus-capital-markets environment, elegant depth perspective, premium finish, no placeholder feel.`,
    `Hard negative constraints: no text anywhere, no letters, no numbers, no readable signs, no UI overlays, no stat gems, no faction logos, no watermark, no random symbols, no glitched typography, no chaotic clutter, no oversaturated neon explosion.`,
  ].join(" ");
}

if (!factionArg && fs.existsSync(outBase)) {
  fs.rmSync(outBase, { recursive: true, force: true });
}

const createdDirs = new Set();

for (const unit of [...units.values()].sort((a, b) => a.faction.localeCompare(b.faction) || a.id.localeCompare(b.id))) {
  if (factionArg && unit.faction !== factionArg) {
    continue;
  }
  const factionDir = path.join(outBase, unit.faction);
  fs.mkdirSync(factionDir, { recursive: true });
  createdDirs.add(factionDir);

  const content = cardPrompt(unit);

  const filePath = path.join(factionDir, `${sanitizeName(unit.id)}.md`);
  fs.writeFileSync(filePath, content + "\n", "utf8");
}

const relDirs = [...createdDirs].map((d) => path.relative(root, d)).sort();
console.log(JSON.stringify({ unitCount: units.size, folders: relDirs }, null, 2));
