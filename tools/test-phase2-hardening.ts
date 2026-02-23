import assert from "node:assert/strict";
import { postJson } from "../src/shared/api.ts";
import {
  parseAiStartBody,
  parseInviteCreateBody,
  parseMatchIdBody,
  parsePlayBody,
} from "../src/server/routes/api-body.ts";
import { guardInviteCreate, markInviteCreateCooldown } from "../src/server/core/invite-policy.ts";
import {
  indexPvpLobbyForUser,
  saveInvite,
  savePvpLobby,
  type RedisLike,
} from "../src/server/game/storage.ts";
import type { InviteState, PvpLobbyState } from "../src/shared/game.ts";

class InMemoryRedis implements RedisLike {
  private readonly kv = new Map<string, string>();
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly zsets = new Map<string, Map<string, number>>();
  private readonly expirations = new Map<string, number>();

  private purgeExpired(key: string): void {
    const expiry = this.expirations.get(key);
    if (expiry === undefined || expiry > Date.now()) return;
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
    this.expirations.set(key, Date.now() + Math.max(1, seconds) * 1000);
  }
  async incrBy(key: string, amount: number): Promise<number> {
    const next = Number((await this.get(key)) ?? "0") + amount;
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
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    hash.set(member, "1");
    this.hashes.set(key, hash);
  }
  async sMembers(key: string): Promise<string[]> {
    this.purgeExpired(key);
    return [...(this.hashes.get(key)?.keys() ?? [])];
  }
  async sRem(key: string, member: string): Promise<void> {
    const hash = this.hashes.get(key);
    if (!hash) return;
    hash.delete(member);
    this.hashes.set(key, hash);
  }
  async zAdd(key: string, score: number, member: string): Promise<void> {
    const z = this.zsets.get(key) ?? new Map<string, number>();
    z.set(member, score);
    this.zsets.set(key, z);
  }
  async zRange(key: string, start: number, stop: number, options?: { rev?: boolean }): Promise<string[]> {
    const rows = [...(this.zsets.get(key)?.entries() ?? [])]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => {
        const diff = options?.rev ? b.score - a.score : a.score - b.score;
        return diff || a.member.localeCompare(b.member);
      });
    const end = stop < 0 ? rows.length + stop : stop;
    return rows.slice(start, end + 1).map((row) => row.member);
  }
}

function testApiBodyValidators(): void {
  const aiBad = parseAiStartBody({ level: 7 });
  assert.equal(aiBad.ok, false, "invalid AI level should be rejected");

  const inviteBad = parseInviteCreateBody({ targetUsername: 123 });
  assert.equal(inviteBad.ok, false, "invite targetUsername must be string");

  const playBad = parsePlayBody({
    matchId: "m1",
    action: { side: "A", handIndex: 0, lane: "front", col: 1, target: { kind: "enemy-unit" } },
  });
  assert.equal(playBad.ok, false, "play action target missing unitId should be rejected");

  const matchIdBad = parseMatchIdBody({ matchId: "" });
  assert.equal(matchIdBad.ok, false, "empty matchId should be rejected");
}

async function seedPendingInvite(redis: RedisLike): Promise<{ invite: InviteState; lobby: PvpLobbyState }> {
  const invite: InviteState = {
    id: "invite-1",
    weekId: "2026-02-22",
    postId: "t3_week",
    inviterUserId: "user-1",
    inviterUsername: "alice",
    inviterFaction: "retail_mob",
    targetUsername: "bob",
    status: "pending",
    createdAt: 1_700_000_000_000,
    lobbyId: "lobby-1",
  };
  const lobby: PvpLobbyState = {
    id: "lobby-1",
    inviteId: "invite-1",
    weekId: "2026-02-22",
    postId: "t3_week",
    inviterUserId: "user-1",
    inviterUsername: "alice",
    inviterFaction: "retail_mob",
    targetUsername: "bob",
    inviterReady: false,
    targetReady: false,
    status: "waiting",
    createdAt: invite.createdAt,
    updatedAt: invite.createdAt,
  };
  await saveInvite(redis, invite);
  await savePvpLobby(redis, lobby);
  await indexPvpLobbyForUser(redis, invite.inviterUserId, lobby.id);
  return { invite, lobby };
}

async function testInvitePolicyDuplicateCooldownAndLimit(): Promise<void> {
  {
    const redis = new InMemoryRedis();
    await seedPendingInvite(redis);
    const result = await guardInviteCreate(redis, {
      inviterUserId: "user-1",
      targetUsername: "bob",
      weekId: "2026-02-22",
      postId: "t3_week",
      now: 1_700_000_000_500,
    });
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("unreachable");
    assert.equal(result.kind, "duplicate", "same target + post/week should dedupe");
  }

  {
    const redis = new InMemoryRedis();
    await seedPendingInvite(redis);
    const result = await guardInviteCreate(redis, {
      inviterUserId: "user-1",
      targetUsername: "charlie",
      weekId: "2026-02-22",
      postId: "t3_week",
      now: 1_700_000_000_500,
    });
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("unreachable");
    assert.equal(result.kind, "rate_limit", "one active pending invite per user/post should be enforced");
  }

  {
    const redis = new InMemoryRedis();
    const now = 1_700_000_000_000;
    await markInviteCreateCooldown(redis, "user-1", now);
    const result = await guardInviteCreate(redis, {
      inviterUserId: "user-1",
      targetUsername: "bob",
      weekId: "2026-02-22",
      postId: "t3_week",
      now: now + 1_000,
    });
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("unreachable");
    assert.equal(result.kind, "cooldown", "invite cooldown should block rapid repeated invite creates");
  }
}

async function testPostJsonNetworkErrorHandled(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const failingFetch: typeof fetch = async () => {
    throw new Error("offline");
  };
  globalThis.fetch = failingFetch;
  try {
    const response = await postJson("/api/test", { hello: "world" });
    assert.equal(response.ok, false, "network error should return ApiFail");
    if (!response.ok) {
      assert.equal(response.error.startsWith("Network error:"), true);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main(): Promise<void> {
  testApiBodyValidators();
  await testInvitePolicyDuplicateCooldownAndLimit();
  await testPostJsonNetworkErrorHandled();
  console.log("Phase 2 hardening regression tests passed.");
}

await main();
