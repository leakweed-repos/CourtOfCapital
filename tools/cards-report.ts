import { CARD_CATALOG_V2, V2_MIGRATION_REPORT } from "../src/shared/cards/index.ts";

function countBy(items: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    out[item] = (out[item] ?? 0) + 1;
  }
  return out;
}

function printRecord(title: string, record: Record<string, number>): void {
  console.log(`\n${title}`);
  for (const [key, value] of Object.entries(record).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`- ${key}: ${value}`);
  }
}

type FactionReadabilityRow = {
  faction: string;
  total: number;
  units: number;
  nonUnits: number;
  taunt: number;
  ranged: number;
  reach: number;
  rush: number;
  backlineUnits: number;
  backlineCounterUnits: number;
};

function hasTaunt(card: (typeof CARD_CATALOG_V2)[number]): boolean {
  return (card.specials ?? []).some((special) => special.kind === "taunt");
}

function hasKeyword(card: (typeof CARD_CATALOG_V2)[number], keyword: "ranged" | "reach" | "rush"): boolean {
  return (card.keywords ?? []).includes(keyword);
}

function readabilityRows(): FactionReadabilityRow[] {
  const factions = [...new Set(CARD_CATALOG_V2.map((card) => card.faction))].sort((a, b) => a.localeCompare(b));
  return factions.map((faction) => {
    const cards = CARD_CATALOG_V2.filter((card) => card.faction === faction);
    const units = cards.filter((card) => card.kind === "unit");
    const nonUnits = cards.filter((card) => card.kind !== "unit");
    const backlineUnits = units.filter((card) => card.lane === "back").length;
    const backlineCounterUnits = units.filter((card) => hasKeyword(card, "ranged") || hasKeyword(card, "reach")).length;
    return {
      faction,
      total: cards.length,
      units: units.length,
      nonUnits: nonUnits.length,
      taunt: units.filter(hasTaunt).length,
      ranged: units.filter((card) => hasKeyword(card, "ranged")).length,
      reach: units.filter((card) => hasKeyword(card, "reach")).length,
      rush: units.filter((card) => hasKeyword(card, "rush")).length,
      backlineUnits,
      backlineCounterUnits,
    };
  });
}

function printCounterplayWarnings(rows: readonly FactionReadabilityRow[]): void {
  const warnings: string[] = [];
  for (const row of rows) {
    if (row.faction === "neutral" || row.faction === "utility") {
      continue;
    }
    if (row.taunt < 3) {
      warnings.push(`${row.faction}: low taunt density (${row.taunt})`);
    }
    if (row.ranged + row.reach < 3) {
      warnings.push(`${row.faction}: low backline counter density (ranged+reach=${row.ranged + row.reach})`);
    }
    if (row.backlineUnits >= 4 && row.ranged === 0) {
      warnings.push(`${row.faction}: heavy backline roster (${row.backlineUnits}) with zero ranged units`);
    }
  }

  console.log("\nCounterplay Warnings");
  if (warnings.length === 0) {
    console.log("- none");
    return;
  }
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

function main(): void {
  const units = CARD_CATALOG_V2.filter((card) => card.kind === "unit");
  const nonUnits = CARD_CATALOG_V2.filter((card) => card.kind !== "unit");
  const keywordCounts = countBy(units.flatMap((card) => card.keywords ?? []));
  const roleCounts = countBy(CARD_CATALOG_V2.map((card) => card.role));
  const factionCounts = countBy(CARD_CATALOG_V2.map((card) => card.faction));

  const tauntUnits = units.filter((card) => (card.specials ?? []).some((special) => special.kind === "taunt")).length;
  const resistanceUnits = units.filter((card) => (card.specials ?? []).some((special) => special.kind === "resistance")).length;
  const triggerUnits = units.filter((card) => (card.triggers ?? []).length > 0).length;

  console.log("Court of Capital V2 Cards Report");
  console.log(`- Total cards: ${CARD_CATALOG_V2.length}`);
  console.log(`- Units: ${units.length}`);
  console.log(`- Non-units: ${nonUnits.length}`);
  console.log(`- Unit cards with triggers: ${triggerUnits}`);
  console.log(`- Unit cards with taunt special: ${tauntUnits}`);
  console.log(`- Unit cards with resistance special: ${resistanceUnits}`);
  console.log(`- Residual legacy explicit-unit runtime: ${V2_MIGRATION_REPORT.unresolvedLegacyExplicitUnitRuntimeCards}`);
  console.log(`- Residual legacy non-unit runtime: ${V2_MIGRATION_REPORT.unresolvedLegacyNonUnitRuntimeCards}`);

  printRecord("By Faction", factionCounts);
  printRecord("By Role", roleCounts);
  printRecord("Keywords", keywordCounts);
  console.log("\nFaction Readability / Counterplay Snapshot");
  console.table(readabilityRows());
  printCounterplayWarnings(readabilityRows());

  console.log("\nResidual Legacy Runtime (explicit units)");
  for (const id of V2_MIGRATION_REPORT.unresolvedLegacyExplicitUnitRuntimeIds) {
    console.log(`- ${id}`);
  }

  console.log("\nResidual Legacy Runtime (non-units)");
  for (const id of V2_MIGRATION_REPORT.unresolvedLegacyNonUnitRuntimeIds) {
    console.log(`- ${id}`);
  }
}

main();
