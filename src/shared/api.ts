import type {
  AttackInput,
  InviteState,
  LobbySnapshot,
  MatchActionResult,
  MatchState,
  MulliganInput,
  PlayCardInput,
  WeeklyUserStats,
  FactionId,
} from "./game";

export interface ApiOk<T> {
  ok: true;
  data: T;
  error?: string;
}

export interface ApiFail {
  ok: false;
  error: string;
  data?: unknown;
}

export type ApiResponse<T> = ApiOk<T> | ApiFail;

export interface StartAiMatchRequest {
  weekId?: string;
  postId?: string;
  userId?: string;
  username?: string;
  level: 1 | 2 | 3;
  faction?: FactionId;
}

export interface StartPvpInviteRequest {
  weekId?: string;
  postId?: string;
  userId?: string;
  username?: string;
  targetUsername: string;
  faction?: FactionId;
}

export interface AcceptInviteRequest {
  inviteId: string;
  userId?: string;
  username?: string;
  faction?: FactionId;
}

export interface MatchQuery {
  matchId: string;
}

export interface MatchActionEnvelope<T> {
  matchId: string;
  actorUserId?: string;
  action: T;
}

export interface LobbyRequest {
  weekId?: string;
  postId?: string;
  userId?: string;
  username?: string;
}

export interface WeeklySummary {
  weekId: string;
  totalMatches: number;
  top3: WeeklyUserStats[];
}

export interface LobbyResponse {
  snapshot: LobbySnapshot;
}

export interface InviteResponse {
  invite: InviteState;
}

export interface MatchResponse {
  result: MatchActionResult;
}

export interface MatchDataResponse {
  match: MatchState;
}

export const API_ROUTES = {
  lobby: "/api/lobby",
  matchAi: "/api/match/ai",
  inviteCreate: "/api/match/invite",
  inviteAccept: "/api/invite/accept",
  matchGet: "/api/match/get",
  matchMulligan: "/api/match/mulligan",
  matchPlay: "/api/match/play",
  matchAttack: "/api/match/attack",
  matchEndTurn: "/api/match/end-turn",
  matchRepayNakedShort: "/api/match/repay-naked-short",
} as const;

async function parseJsonBody<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- default generic keeps postJson ergonomic at call sites
export async function postJson<TRequest, TResponse = any>(
  url: string,
  body: TRequest,
): Promise<ApiResponse<TResponse>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const parsed = await parseJsonBody<ApiResponse<TResponse>>(response);

  if (!response.ok) {
    if (parsed && !parsed.ok) {
      return parsed;
    }
    return {
      ok: false,
      error: `HTTP ${response.status}`,
    };
  }

  if (!parsed) {
    return {
      ok: false,
      error: "Invalid JSON response from server.",
    };
  }

  return parsed;
}

export type MatchActionBody =
  | MatchActionEnvelope<MulliganInput>
  | MatchActionEnvelope<PlayCardInput>
  | MatchActionEnvelope<AttackInput>;

