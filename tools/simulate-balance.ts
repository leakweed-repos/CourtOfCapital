import { randomInt } from "node:crypto";
import { createInitialMatch, maybeRunBot, tickTimeouts } from "../src/server/game/engine.ts";
import { stableHash, type FactionId, type MatchState, type MatchWinReason, type PlayerSide } from "../src/shared/game.ts";

const FACTIONS: FactionId[] = ["wallstreet", "sec", "market_makers", "short_hedgefund", "retail_mob"];

const GAMES_PER_PAIR = Number(process.env.COC_SIM_GAMES ?? 40);
const MAX_BOT_STEPS = Number(process.env.COC_SIM_STEPS ?? 220);
const SWAP_SIDES = process.env.COC_SIM_SWAP !== "0";
const FORCE_DETERMINISTIC = process.argv.includes("--det") || process.argv.includes("--deterministic");
const RANDOMIZE_SEEDS = !FORCE_DETERMINISTIC && process.env.COC_SIM_RANDOM_SEEDS !== "0";

type Totals = {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  totalTurns: number;
  forcedFinishes: number;
};

type PairTotals = {
  left: FactionId;
  right: FactionId;
  leftWins: number;
  rightWins: number;
  draws: number;
  games: number;
  totalTurns: number;
};

type SimResult = {
  winner: PlayerSide | null;
  match: MatchState;
  forced: boolean;
};

function emptyTotals(): Totals {
  return { games: 0, wins: 0, losses: 0, draws: 0, totalTurns: 0, forcedFinishes: 0 };
}

function boardCount(match: MatchState, side: PlayerSide): number {
  return Object.values(match.units).filter((unit) => unit.owner === side).length;
}

function forceFinish(match: MatchState): SimResult {
  const a = match.players.A;
  const b = match.players.B;
  const aScore = a.leader.hp * 220 + a.shares + boardCount(match, "A") * 110 + a.favor * 20 - a.probation * 8;
  const bScore = b.leader.hp * 220 + b.shares + boardCount(match, "B") * 110 + b.favor * 20 - b.probation * 8;

  if (aScore === bScore) {
    return { winner: null, match, forced: true };
  }

  const winner: PlayerSide = aScore > bScore ? "A" : "B";
  match.status = "finished";
  match.winnerSide = winner;
  match.winReason = "concede" satisfies MatchWinReason;
  return { winner, match, forced: true };
}

function runSingle(seed: number, factionA: FactionId, factionB: FactionId): SimResult {
  const now = 1_700_000_000_000 + (seed % 10_000_000);
  let match = createInitialMatch(
    {
      weekId: "sim-week",
      postId: "sim-post",
      mode: "pvp",
      playerA: {
        userId: `sim-a-${seed}`,
        username: "simA",
        faction: factionA,
      },
      playerB: {
        userId: `sim-b-${seed}`,
        username: "simB",
        faction: factionB,
        isBot: true,
        botLevel: 3,
      },
      seed,
    },
    now,
  );

  match.players.A.isBot = true;
  match.players.A.botLevel = 3;

  let cursor = match.mulliganDeadlineAt + 1;
  match = tickTimeouts(match, cursor);

  let steps = 0;
  while (match.status === "active" && steps < MAX_BOT_STEPS) {
    steps += 1;
    match = maybeRunBot(match);
    cursor = Math.max(cursor + 50, match.turnDeadlineAt + 1);
    match = tickTimeouts(match, cursor);
  }

  if (match.status === "finished") {
    return { winner: match.winnerSide ?? null, match, forced: false };
  }
  return forceFinish(match);
}

function simSeed(left: FactionId, right: FactionId, game: number, aFaction: FactionId, bFaction: FactionId): number {
  const base = stableHash(`sim:${left}:${right}:${game}:${aFaction}:${bFaction}`);
  if (!RANDOMIZE_SEEDS) {
    return base;
  }
  return stableHash(`${base}:rand:${randomInt(0x7fffffff)}`);
}

function main(): void {
  const factionTotals = new Map<FactionId, Totals>(FACTIONS.map((f) => [f, emptyTotals()]));
  const pairTotals = new Map<string, PairTotals>();
  let sideAWins = 0;
  let sideBWins = 0;
  let sideDraws = 0;
  let sideGames = 0;

  for (let i = 0; i < FACTIONS.length; i += 1) {
    for (let j = i + 1; j < FACTIONS.length; j += 1) {
      const left = FACTIONS[i] as FactionId;
      const right = FACTIONS[j] as FactionId;
      const key = `${left}__${right}`;

      pairTotals.set(key, {
        left,
        right,
        leftWins: 0,
        rightWins: 0,
        draws: 0,
        games: 0,
        totalTurns: 0,
      });

      for (let game = 0; game < GAMES_PER_PAIR; game += 1) {
        const swapSides = SWAP_SIDES ? game % 2 === 1 : false;
        const aFaction = swapSides ? right : left;
        const bFaction = swapSides ? left : right;
        const seed = simSeed(left, right, game, aFaction, bFaction);
        const result = runSingle(seed, aFaction, bFaction);

        const aTotals = factionTotals.get(aFaction) as Totals;
        const bTotals = factionTotals.get(bFaction) as Totals;
        const pair = pairTotals.get(key) as PairTotals;

        aTotals.games += 1;
        bTotals.games += 1;
        pair.games += 1;
        sideGames += 1;
        aTotals.totalTurns += result.match.turn;
        bTotals.totalTurns += result.match.turn;
        pair.totalTurns += result.match.turn;

        if (result.forced) {
          aTotals.forcedFinishes += 1;
          bTotals.forcedFinishes += 1;
        }

        if (result.winner === "A") {
          sideAWins += 1;
          aTotals.wins += 1;
          bTotals.losses += 1;
          if (aFaction === left) {
            pair.leftWins += 1;
          } else {
            pair.rightWins += 1;
          }
        } else if (result.winner === "B") {
          sideBWins += 1;
          bTotals.wins += 1;
          aTotals.losses += 1;
          if (bFaction === left) {
            pair.leftWins += 1;
          } else {
            pair.rightWins += 1;
          }
        } else {
          sideDraws += 1;
          aTotals.draws += 1;
          bTotals.draws += 1;
          pair.draws += 1;
        }
      }
    }
  }

  const factionRows = FACTIONS.map((faction) => {
    const row = factionTotals.get(faction) as Totals;
    const winRate = row.games > 0 ? (row.wins / row.games) * 100 : 0;
    const avgTurns = row.games > 0 ? row.totalTurns / row.games : 0;
    const forcedRate = row.games > 0 ? (row.forcedFinishes / row.games) * 100 : 0;
    return {
      faction,
      games: row.games,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      winRate: `${winRate.toFixed(1)}%`,
      avgTurns: avgTurns.toFixed(1),
      forcedRate: `${forcedRate.toFixed(1)}%`,
    };
  }).sort((a, b) => Number.parseFloat(b.winRate) - Number.parseFloat(a.winRate));

  const pairRows = [...pairTotals.values()].map((pair) => {
    const leftWinRate = pair.games > 0 ? (pair.leftWins / pair.games) * 100 : 0;
    const rightWinRate = pair.games > 0 ? (pair.rightWins / pair.games) * 100 : 0;
    const drawRate = pair.games > 0 ? (pair.draws / pair.games) * 100 : 0;
    return {
      matchup: `${pair.left} vs ${pair.right}`,
      games: pair.games,
      leftWins: `${pair.leftWins} (${leftWinRate.toFixed(1)}%)`,
      rightWins: `${pair.rightWins} (${rightWinRate.toFixed(1)}%)`,
      draws: `${pair.draws} (${drawRate.toFixed(1)}%)`,
      avgTurns: (pair.totalTurns / pair.games).toFixed(1),
    };
  });

  console.log(`\nCourt of Capital balance simulation`);
  console.log(`games per unordered faction pair: ${GAMES_PER_PAIR}`);
  console.log(`max bot steps per game: ${MAX_BOT_STEPS}\n`);
  console.log(`seed mode: ${RANDOMIZE_SEEDS ? "random per game (non-deterministic)" : "deterministic (stableHash only)"}`);
  console.log(
    `side-A wins: ${sideAWins}/${sideGames} (${((sideAWins / Math.max(1, sideGames)) * 100).toFixed(1)}%) | ` +
      `side-B wins: ${sideBWins}/${sideGames} (${((sideBWins / Math.max(1, sideGames)) * 100).toFixed(1)}%) | ` +
      `draws: ${sideDraws}`,
  );
  console.log(`side swap mode: ${SWAP_SIDES ? "on" : "off"}\n`);
  console.table(factionRows);
  console.table(pairRows);
}

main();
