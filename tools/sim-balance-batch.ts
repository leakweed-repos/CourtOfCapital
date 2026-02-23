import type { FactionId } from "../src/shared/game.ts";
import { runBalanceSimulation } from "./simulate-balance.ts";

const DEFAULT_RUNS = 100;
const FACTION_ORDER: FactionId[] = ["sec", "wallstreet", "short_hedgefund", "retail_mob", "market_makers"];

type BatchTotals = {
  runs: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  totalTurns: number;
  forcedFinishes: number;
};

function parseRunsArg(argv: readonly string[]): number {
  const index = argv.findIndex((arg) => arg === "--runs");
  if (index === -1) {
    return DEFAULT_RUNS;
  }
  const raw = argv[index + 1];
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1 || !Number.isInteger(value)) {
    throw new Error(`Invalid --runs value: ${raw ?? "(missing)"}. Use a positive integer.`);
  }
  return value;
}

function hasFlag(argv: readonly string[], flag: string): boolean {
  return argv.includes(flag);
}

function emptyBatchTotals(): BatchTotals {
  return {
    runs: 0,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    totalTurns: 0,
    forcedFinishes: 0,
  };
}

function renderProgress(current: number, total: number): void {
  const safeTotal = Math.max(1, total);
  const pct = Math.max(0, Math.min(100, Math.floor((current / safeTotal) * 100)));
  const width = 30;
  const filled = Math.round((pct / 100) * width);
  const bar = `${"=".repeat(filled)}${" ".repeat(Math.max(0, width - filled))}`;
  const line = `Progress [${bar}] ${pct}% (${current}/${total})`;

  if (process.stdout.isTTY) {
    process.stdout.write(`\r${line}`);
    if (current >= total) {
      process.stdout.write("\n");
    }
    return;
  }

  // Fallback for non-interactive terminals
  console.log(line);
}

function main(): void {
  const runs = parseRunsArg(process.argv);
  const factionOnlyDecks = hasFlag(process.argv, "--faction-only");
  if (factionOnlyDecks) {
    process.env.COC_SIM_FACTION_ONLY = "1";
  }
  const totalsByFaction = new Map<FactionId, BatchTotals>(FACTION_ORDER.map((faction) => [faction, emptyBatchTotals()]));
  renderProgress(0, runs);

  for (let i = 1; i <= runs; i += 1) {
    const report = runBalanceSimulation();
    for (const row of report.factionRows) {
      const totals = totalsByFaction.get(row.faction);
      if (!totals) {
        continue;
      }
      totals.runs += 1;
      totals.games += row.games;
      totals.wins += row.wins;
      totals.losses += row.losses;
      totals.draws += row.draws;
      totals.totalTurns += row.avgTurns * row.games;
      totals.forcedFinishes += (row.forcedRatePct / 100) * row.games;
    }
    renderProgress(i, runs);
  }

  const tableRows = FACTION_ORDER.map((faction) => {
    const totals = totalsByFaction.get(faction) ?? emptyBatchTotals();
    const gamesAvg = totals.runs > 0 ? totals.games / totals.runs : 0;
    const winsAvg = totals.runs > 0 ? totals.wins / totals.runs : 0;
    const lossesAvg = totals.runs > 0 ? totals.losses / totals.runs : 0;
    const drawsAvg = totals.runs > 0 ? totals.draws / totals.runs : 0;
    const winRateAvgPct = totals.games > 0 ? (totals.wins / totals.games) * 100 : 0;
    const avgTurnsAvg = totals.games > 0 ? totals.totalTurns / totals.games : 0;
    const forcedRateAvgPct = totals.games > 0 ? (totals.forcedFinishes / totals.games) * 100 : 0;

    return {
      faction,
      runs: totals.runs,
      gamesAvg: Number(gamesAvg.toFixed(2)),
      winsAvg: Number(winsAvg.toFixed(2)),
      lossesAvg: Number(lossesAvg.toFixed(2)),
      drawsAvg: Number(drawsAvg.toFixed(2)),
      winRateAvgPct,
      winRateAvg: `${winRateAvgPct.toFixed(2)}%`,
      avgTurnsAvg: avgTurnsAvg.toFixed(3),
      forcedRateAvg: `${forcedRateAvgPct.toFixed(2)}%`,
    };
  }).sort((a, b) => {
    if (b.winRateAvgPct !== a.winRateAvgPct) {
      return b.winRateAvgPct - a.winRateAvgPct;
    }
    return a.faction.localeCompare(b.faction);
  }).map(({ winRateAvgPct: _winRateAvgPct, ...row }) => row);

  console.log("");
  console.log(`=== SIM:BALANCE (AVERAGE OF ${runs} RUNS) ===`);
  console.log(`deck mode: ${factionOnlyDecks ? "faction-only (no neutral/utility cards)" : "default (70 faction + 30 neutral/utility)"}`);
  console.table(tableRows);
}

main();
