import assert from "node:assert/strict";
import { createInitialMatch } from "../src/server/game/engine.ts";
import type { RedisLike } from "../src/server/game/storage.ts";
import { orchestrateBotTurn } from "../src/server/game/bot-plan.ts";

class InMemoryRedis implements RedisLike {
  private readonly kv = new Map<string, string>();
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly zsets = new Map<string, Map<string, number>>();

  async get(key: string): Promise<string | null> {
    return this.kv.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.kv.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.kv.delete(key);
    this.hashes.delete(key);
    this.zsets.delete(key);
  }

  async expire(_key: string, _seconds: number): Promise<void> {}

  async incrBy(key: string, amount: number): Promise<number> {
    const next = Number(this.kv.get(key) ?? "0") + amount;
    this.kv.set(key, String(next));
    return next;
  }

  async hSetNX(key: string, field: string, value: string): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    if (hash.has(field)) {
      this.hashes.set(key, hash);
      return 0;
    }
    hash.set(field, value);
    this.hashes.set(key, hash);
    return 1;
  }

  async sAdd(key: string, member: string): Promise<void> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    hash.set(member, "1");
    this.hashes.set(key, hash);
  }

  async sMembers(key: string): Promise<string[]> {
    return [...(this.hashes.get(key)?.keys() ?? [])];
  }

  async sRem(key: string, member: string): Promise<void> {
    const hash = this.hashes.get(key);
    if (!hash) return;
    hash.delete(member);
    if (hash.size === 0) {
      this.hashes.delete(key);
      return;
    }
    this.hashes.set(key, hash);
  }

  async zAdd(key: string, score: number, member: string): Promise<void> {
    const zset = this.zsets.get(key) ?? new Map<string, number>();
    zset.set(member, score);
    this.zsets.set(key, zset);
  }

  async zRange(_key: string, _start: number, _stop: number, _options?: { rev?: boolean }): Promise<string[]> {
    return [];
  }
}

function makeBotTurnMatch(now: number) {
  const match = createInitialMatch(
    {
      weekId: "bot-plan-week",
      postId: "bot-plan-post",
      mode: "pve",
      playerA: {
        userId: "human-1",
        username: "human-1",
        faction: "retail_mob",
      },
      playerB: {
        userId: "bot-l2",
        username: "courtbot-l2",
        faction: "short_hedgefund",
        isBot: true,
        botLevel: 2,
      },
      seed: 1337,
    },
    now,
  );
  match.activeSide = "B";
  match.players.B.isBot = true;
  match.players.B.botLevel = 2;
  match.status = "active";
  match.turn = 3;
  match.turnDeadlineAt = now + 30_000;
  match.mulliganDeadlineAt = 0;
  match.updatedAt = now;
  return match;
}

function makeSandboxBotTurnMatch(now: number) {
  const match = createInitialMatch(
    {
      weekId: "bot-plan-week",
      postId: "bot-plan-post",
      mode: "sandbox",
      playerA: {
        userId: "human-1",
        username: "human-1",
        faction: "retail_mob",
      },
      playerB: {
        userId: "wozny",
        username: "wozny",
        faction: "market_makers",
        isBot: true,
      },
      seed: 7331,
    },
    now,
  );
  match.status = "active";
  match.activeSide = "B";
  match.players.B.isBot = true;
  match.turn = 2;
  match.turnDeadlineAt = now + 35_000;
  match.mulliganDeadlineAt = 0;
  match.updatedAt = now;
  return match;
}

async function testBotPlanLifecycle(): Promise<void> {
  const redis = new InMemoryRedis();
  const now = Date.now();
  const match = makeBotTurnMatch(now);

  const first = await orchestrateBotTurn(redis, match, now);
  assert.equal(first.match, match, "first orchestration should not mutate match when exposing plan");
  assert.ok(first.botPlan, "first orchestration should expose a bot plan");
  assert.equal(first.botPlan?.turn, match.turn);
  assert.equal(first.botPlan?.side, "B");
  assert.ok((first.botPlan?.timelineMs.length ?? 0) === (first.botPlan?.actions.length ?? -1));

  const beforeReady = await orchestrateBotTurn(redis, match, now + 1_000);
  assert.ok(beforeReady.botPlan, "plan should still be available before readyAt");
  assert.equal(beforeReady.botPlan?.id, first.botPlan?.id, "plan id should stay stable before readyAt");

  const afterReady = await orchestrateBotTurn(redis, match, (first.botPlan?.readyAt ?? now) + 1);
  assert.equal(afterReady.botPlan, undefined, "plan should be consumed after readyAt");
  assert.notEqual(afterReady.match.activeSide, "B", "bot turn should be committed after readyAt");
}

async function testBotPlanInvalidatesOnStateChange(): Promise<void> {
  const redis = new InMemoryRedis();
  const now = Date.now();
  const match = makeBotTurnMatch(now);

  const first = await orchestrateBotTurn(redis, match, now);
  assert.ok(first.botPlan, "initial plan expected");
  const firstPlanId = first.botPlan?.id ?? "";

  match.updatedAt += 1;
  match.rngCounter += 1;

  const rebuilt = await orchestrateBotTurn(redis, match, now + 500);
  assert.ok(rebuilt.botPlan, "plan should be rebuilt after state change");
  assert.notEqual(rebuilt.botPlan?.id, firstPlanId, "rebuilt plan should get a new id");
}

async function testSandboxBotStillActsWithoutPlanDelay(): Promise<void> {
  const redis = new InMemoryRedis();
  const now = Date.now();
  const match = makeSandboxBotTurnMatch(now);
  const result = await orchestrateBotTurn(redis, match, now);
  assert.equal(result.botPlan, undefined, "sandbox bot turn should not expose PvE bot plan");
  assert.notEqual(result.match.activeSide, "B", "sandbox bot should still execute and pass turn");
}

async function main(): Promise<void> {
  await testBotPlanLifecycle();
  await testBotPlanInvalidatesOnStateChange();
  await testSandboxBotStillActsWithoutPlanDelay();
  console.log("Bot turn planning orchestration tests passed.");
}

void main();
