import assert from "node:assert/strict";
import { createInitialMatch } from "../src/server/game/engine.ts";
import {
  getCurrentWeekId,
  getLeaderboardTop,
  getWeekMatchCount,
  setCurrentWeekId,
  type RedisLike,
} from "../src/server/game/storage.ts";
import { finalizeMatchResultOnce } from "../src/server/core/match-results.ts";
import { ensureWeek, rolloverWeek, type EnsureWeekContext } from "../src/server/core/week.ts";
import { getArchivedWeekReadOnlyError } from "../src/server/core/match-week.ts";

type SortedRow = { member: string; score: number };

class InMemoryRedis implements RedisLike {
  private readonly kv = new Map<string, string>();

  private readonly hashes = new Map<string, Map<string, string>>();

  private readonly zsets = new Map<string, Map<string, number>>();

  private readonly expirations = new Map<string, number>();

  private purgeExpired(key: string): void {
    const expiresAt = this.expirations.get(key);
    if (expiresAt === undefined || expiresAt > Date.now()) {
      return;
    }
    this.expirations.delete(key);
    this.kv.delete(key);
    this.hashes.delete(key);
    this.zsets.delete(key);
  }

  async get(key: string): Promise<string | null> {
    this.purgeExpired(key);
    return this.kv.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.purgeExpired(key);
    this.kv.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.expirations.delete(key);
    this.kv.delete(key);
    this.hashes.delete(key);
    this.zsets.delete(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    this.purgeExpired(key);
    this.expirations.set(key, Date.now() + Math.max(1, seconds) * 1_000);
  }

  async incrBy(key: string, amount: number): Promise<number> {
    this.purgeExpired(key);
    const next = Number(this.kv.get(key) ?? "0") + amount;
    this.kv.set(key, String(next));
    return next;
  }

  async hSetNX(key: string, field: string, value: string): Promise<number> {
    this.purgeExpired(key);
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
    this.purgeExpired(key);
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    hash.set(member, "1");
    this.hashes.set(key, hash);
  }

  async sMembers(key: string): Promise<string[]> {
    this.purgeExpired(key);
    return [...(this.hashes.get(key)?.keys() ?? [])];
  }

  async sRem(key: string, member: string): Promise<void> {
    this.purgeExpired(key);
    const hash = this.hashes.get(key);
    if (!hash) {
      return;
    }
    hash.delete(member);
    if (hash.size === 0) {
      this.hashes.delete(key);
      return;
    }
    this.hashes.set(key, hash);
  }

  async zAdd(key: string, score: number, member: string): Promise<void> {
    this.purgeExpired(key);
    const zset = this.zsets.get(key) ?? new Map<string, number>();
    zset.set(member, score);
    this.zsets.set(key, zset);
  }

  async zRange(key: string, start: number, stop: number, options?: { rev?: boolean }): Promise<string[]> {
    this.purgeExpired(key);
    const rows: SortedRow[] = [...(this.zsets.get(key)?.entries() ?? [])].map(([member, score]) => ({ member, score }));
    rows.sort((a, b) => (options?.rev ? b.score - a.score : a.score - b.score) || a.member.localeCompare(b.member));
    const endInclusive = stop < 0 ? rows.length + stop : stop;
    return rows.slice(start, endInclusive + 1).map((row) => row.member);
  }
}

type FakePost = {
  id: string;
  locked: boolean;
  comments: string[];
  addComment(input: { text: string }): Promise<void>;
  lock(): Promise<void>;
};

class FakeReddit {
  submitCount = 0;

  readonly posts = new Map<string, FakePost>();

  async submitCustomPost(): Promise<{ id: string }> {
    this.submitCount += 1;
    const id = `t3_fake_${this.submitCount}`;
    const post: FakePost = {
      id,
      locked: false,
      comments: [],
      addComment: async ({ text }) => {
        post.comments.push(text);
      },
      lock: async () => {
        post.locked = true;
      },
    };
    this.posts.set(id, post);
    return { id };
  }

  async getPostById(postId: `t3_${string}`): Promise<FakePost> {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error(`Post not found in fake reddit: ${postId}`);
    }
    return post;
  }
}

function makeFinishedPvpMatch() {
  const now = 1_700_000_000_000;
  const match = createInitialMatch(
    {
      weekId: "phase1-week",
      postId: "phase1-post",
      mode: "pvp",
      playerA: {
        userId: "user-a",
        username: "Alice",
        faction: "retail_mob",
      },
      playerB: {
        userId: "user-b",
        username: "Bob",
        faction: "market_makers",
      },
      seed: 42,
    },
    now,
  );
  match.status = "finished";
  match.winnerSide = "A";
  match.winReason = "leader_hp_zero";
  match.updatedAt = now + 123;
  return match;
}

async function testMatchFinalizeIdempotent(): Promise<void> {
  const redis = new InMemoryRedis();
  const match = makeFinishedPvpMatch();

  const results = await Promise.all([finalizeMatchResultOnce(redis, match), finalizeMatchResultOnce(redis, match)]);
  assert.equal(results.filter(Boolean).length, 1, "finalizeMatchResultOnce should commit exactly once");

  const matchCount = await getWeekMatchCount(redis, match.weekId);
  assert.equal(matchCount, 1, "week match counter should increment once");

  const top = await getLeaderboardTop(redis, match.weekId, 10, "pvp");
  const alice = top.find((row) => row.userId === "user-a");
  const bob = top.find((row) => row.userId === "user-b");
  assert.ok(alice, "winner stats should exist");
  assert.ok(bob, "loser stats should exist");
  assert.equal(alice.matches, 1);
  assert.equal(alice.wins, 1);
  assert.equal(bob.matches, 1);
  assert.equal(bob.losses, 1);
}

async function testRolloverIdempotentUnderConcurrentCalls(): Promise<void> {
  const redis = new InMemoryRedis();
  const reddit = new FakeReddit();
  const context: EnsureWeekContext = {
    redis,
    reddit,
    subredditName: "courtofcapital-test",
  };

  const initial = await ensureWeek(context);
  assert.equal(reddit.submitCount, 1, "ensureWeek should create exactly one post for initial week");

  const [a, b] = await Promise.all([rolloverWeek(context), rolloverWeek(context)]);
  assert.equal(a.newWeekId, b.newWeekId, "duplicate rollover should converge to one new week");
  assert.equal(a.newPostId, b.newPostId, "duplicate rollover should reuse one new weekly post");
  assert.equal(a.newWeekNumber, b.newWeekNumber, "duplicate rollover should reuse one week number");

  assert.equal(reddit.submitCount, 2, "rollover should create exactly one additional post");

  const oldPost = reddit.posts.get(initial.postId);
  assert.ok(oldPost, "old post should exist in fake reddit");
  assert.equal(oldPost.locked, true, "old post should be locked once rollover completes");
  assert.equal(oldPost.comments.length, 1, "weekly summary should be added exactly once");

  const currentWeekId = await getCurrentWeekId(redis);
  assert.equal(currentWeekId, a.newWeekId, "current week should point to rolled-over week");
}

async function testArchivedWeekMutationBlockHelper(): Promise<void> {
  const redis = new InMemoryRedis();
  await setCurrentWeekId(redis, "2026-02-22");
  const match = makeFinishedPvpMatch();
  match.status = "active";
  match.weekId = "2026-02-20";

  const error = await getArchivedWeekReadOnlyError(redis, match);
  assert.equal(
    error,
    "Archived week match is read-only (match 2026-02-20, active 2026-02-22).",
    "archived week helper should produce stable read-only message",
  );

  match.weekId = "2026-02-22";
  const sameWeekError = await getArchivedWeekReadOnlyError(redis, match);
  assert.equal(sameWeekError, null, "active week match should be writable");
}

async function main(): Promise<void> {
  await testMatchFinalizeIdempotent();
  await testRolloverIdempotentUnderConcurrentCalls();
  await testArchivedWeekMutationBlockHelper();
  console.log("Phase 1 integrity regression tests passed.");
}

await main();
