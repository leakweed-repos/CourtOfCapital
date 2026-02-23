import assert from "node:assert/strict";
import { getTutorialScriptStepCopy } from "../src/server/game/tutorial.ts";
import { computeJudgeCatchChance } from "../src/server/game/judge-risk.ts";
import { getInvite, getMatch, getPvpLobby, recordUserOutcome, type RedisLike } from "../src/server/game/storage.ts";
import { validateCardCatalogV2 } from "../src/shared/cards/validators.ts";
import { CARD_CATALOG_V2 } from "../src/shared/cards/index.ts";
import { PREFIX } from "../src/shared/game.ts";

type MemorySortedSet = Map<string, number>;

function createMemoryRedis(seed: Record<string, string> = {}): RedisLike {
  const kv = new Map<string, string>(Object.entries(seed));
  const hashes = new Map<string, Map<string, string>>();
  const zsets = new Map<string, MemorySortedSet>();

  return {
    async get(key) {
      return kv.get(key) ?? null;
    },
    async set(key, value) {
      kv.set(key, value);
    },
    async del(key) {
      kv.delete(key);
      hashes.delete(key);
      zsets.delete(key);
    },
    async expire() {},
    async incrBy(key, amount) {
      const current = Number(kv.get(key) ?? "0");
      const next = Number.isFinite(current) ? current + amount : amount;
      kv.set(key, String(next));
      return next;
    },
    async hSetNX(key, field, value) {
      let h = hashes.get(key);
      if (!h) {
        h = new Map<string, string>();
        hashes.set(key, h);
      }
      if (h.has(field)) {
        return 0;
      }
      h.set(field, value);
      return 1;
    },
    async sAdd(key, member) {
      let h = hashes.get(key);
      if (!h) {
        h = new Map<string, string>();
        hashes.set(key, h);
      }
      h.set(member, "1");
    },
    async sMembers(key) {
      return [...(hashes.get(key)?.keys() ?? [])];
    },
    async sRem(key, member) {
      hashes.get(key)?.delete(member);
    },
    async zAdd(key, score, member) {
      let z = zsets.get(key);
      if (!z) {
        z = new Map<string, number>();
        zsets.set(key, z);
      }
      z.set(member, score);
    },
    async zRange(key, start, stop, options) {
      const z = zsets.get(key);
      if (!z) {
        return [];
      }
      const rows = [...z.entries()]
        .sort((a, b) => {
          if (a[1] === b[1]) {
            return a[0].localeCompare(b[0]);
          }
          return (options?.rev ?? false) ? b[1] - a[1] : a[1] - b[1];
        })
        .slice(start, stop < 0 ? undefined : stop + 1)
        .map(([member]) => member);
      return rows;
    },
  };
}

function testTutorialCopyMatchesBlueJudgeLeaderRule(): void {
  const step = getTutorialScriptStepCopy("blue-rule-explain");
  assert.ok(step, "tutorial step blue-rule-explain should exist");
  assert.match(step.body, /leader/i);
  assert.match(step.body, /taunt/i, "tutorial copy should mention taunt gate for blue leader attack");
}

function testJudgeHostilityAffectsCatchChance(): void {
  const base = computeJudgeCatchChance({
    dirtyPower: 1,
    probation: 0,
    judgeMood: 0,
    judgeHostility: 0,
  });
  const hostile = computeJudgeCatchChance({
    dirtyPower: 1,
    probation: 0,
    judgeMood: 0,
    judgeHostility: 4,
  });
  assert.ok(hostile > base, "judgeHostility should increase catch chance");

  const capped = computeJudgeCatchChance({
    dirtyPower: 1,
    probation: 0,
    judgeMood: 0,
    judgeHostility: 500,
  });
  assert.ok(capped <= 0.95, "catch chance must remain clamped");
}

async function testStorageSoftFallbackOnCorruptJson(): Promise<void> {
  const redis = createMemoryRedis({
    [`${PREFIX}:match:broken`]: "{oops",
    [`${PREFIX}:invite:broken`]: "{oops",
    [`${PREFIX}:pvp:lobby:broken`]: "{oops",
    [`${PREFIX}:week:w1:user:u1:stats`]: "{oops",
    [`${PREFIX}:week:w1:user:u1:name`]: "alice",
  });

  const match = await getMatch(redis, "broken");
  const invite = await getInvite(redis, "broken");
  const lobby = await getPvpLobby(redis, "broken");
  assert.equal(match, null, "corrupt match JSON should soft-fallback to null");
  assert.equal(invite, null, "corrupt invite JSON should soft-fallback to null");
  assert.equal(lobby, null, "corrupt lobby JSON should soft-fallback to null");

  await recordUserOutcome(redis, "w1", { userId: "u1", username: "alice" }, true);
  const storedStats = await redis.get(`${PREFIX}:week:w1:user:u1:stats`);
  assert.ok(storedStats, "stats should be rewritten after soft fallback");
  assert.match(storedStats, /\"wins\":1/);
}

function testResistanceValidatorRejectsPercentStyleValues(): void {
  const card = CARD_CATALOG_V2.find((one) => one.kind === "unit");
  assert.ok(card, "expected at least one unit card");

  const issues = validateCardCatalogV2([
    {
      ...card,
      id: `${card.id}_bad_resistance_test`,
      specials: [{ kind: "resistance", stun: 50 }],
    },
  ]);
  assert.ok(
    issues.some((one) => one.path === "specials.resistance.stun" && /0\.\.1/.test(one.message)),
    "validator should reject resistance values outside 0..1 range",
  );
}

async function main(): Promise<void> {
  testTutorialCopyMatchesBlueJudgeLeaderRule();
  testJudgeHostilityAffectsCatchChance();
  await testStorageSoftFallbackOnCorruptJson();
  testResistanceValidatorRejectsPercentStyleValues();
  console.log("Phase 4 consistency/hardening regression tests passed.");
}

await main();
