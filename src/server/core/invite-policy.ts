import type { InviteState, PvpLobbyState } from "../../shared/game";
import {
  getInvite,
  getInviteCreateCooldownUntil,
  getPvpLobby,
  listUserPvpLobbyIds,
  setInviteCreateCooldown,
  type RedisLike,
} from "../game/storage";

export const INVITE_CREATE_COOLDOWN_SECONDS = 180;
export const INVITE_ACTIVE_LIMIT_PER_USER_POST = 1;

export type InviteCreateGuardResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      kind: "duplicate";
      invite: InviteState;
      lobby: PvpLobbyState | null;
    }
  | {
      ok: false;
      kind: "cooldown";
      cooldownUntil: number;
    }
  | {
      ok: false;
      kind: "rate_limit";
      activePendingCount: number;
    };

type PendingInviteWithLobby = {
  invite: InviteState;
  lobby: PvpLobbyState | null;
};

async function collectPendingInvitesForInviterPost(
  redis: RedisLike,
  inviterUserId: string,
  weekId: string,
  postId: string,
): Promise<PendingInviteWithLobby[]> {
  const lobbyIds = await listUserPvpLobbyIds(redis, inviterUserId);
  const out: PendingInviteWithLobby[] = [];
  for (const lobbyId of lobbyIds) {
    const lobby = await getPvpLobby(redis, lobbyId);
    if (!lobby) {
      continue;
    }
    if (lobby.weekId !== weekId || lobby.postId !== postId) {
      continue;
    }
    if (lobby.status === "cancelled" || lobby.matchId) {
      continue;
    }
    const invite = await getInvite(redis, lobby.inviteId);
    if (!invite || invite.status !== "pending") {
      continue;
    }
    out.push({ invite, lobby });
  }
  return out;
}

export async function guardInviteCreate(
  redis: RedisLike,
  input: {
    inviterUserId: string;
    targetUsername: string;
    weekId: string;
    postId: string;
    now: number;
  },
): Promise<InviteCreateGuardResult> {
  const pendingForPost = await collectPendingInvitesForInviterPost(redis, input.inviterUserId, input.weekId, input.postId);
  const duplicate = pendingForPost.find((row) => row.invite.targetUsername === input.targetUsername);
  if (duplicate) {
    return { ok: false, kind: "duplicate", invite: duplicate.invite, lobby: duplicate.lobby };
  }

  if (pendingForPost.length >= INVITE_ACTIVE_LIMIT_PER_USER_POST) {
    return { ok: false, kind: "rate_limit", activePendingCount: pendingForPost.length };
  }

  const cooldownUntil = await getInviteCreateCooldownUntil(redis, input.inviterUserId);
  if (cooldownUntil && cooldownUntil > input.now) {
    return { ok: false, kind: "cooldown", cooldownUntil };
  }

  return { ok: true };
}

export async function markInviteCreateCooldown(redis: RedisLike, inviterUserId: string, now: number): Promise<number> {
  const cooldownUntil = now + INVITE_CREATE_COOLDOWN_SECONDS * 1000;
  await setInviteCreateCooldown(redis, inviterUserId, cooldownUntil, INVITE_CREATE_COOLDOWN_SECONDS);
  return cooldownUntil;
}
