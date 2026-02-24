import type {
  AttackInput,
  InviteState,
  LobbySnapshot,
  MatchActionResult,
  BotTurnPlanPublic,
  MatchState,
  MulliganInput,
  PlayCardInput,
  PvpLobbyState,
  RepositionJudgeInput,
  TutorialScenarioId,
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

export interface StartTutorialMatchRequest {
  weekId?: string;
  postId?: string;
  userId?: string;
  username?: string;
  scenarioId?: TutorialScenarioId;
}

export interface StartCleanupSandboxRequest {
  weekId?: string;
  postId?: string;
  userId?: string;
  username?: string;
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

export interface PvpLobbyQuery {
  lobbyId: string;
}

export interface PvpLobbyStartRequest {
  lobbyId: string;
  faction?: FactionId;
}

export interface PvpLobbyDismantleRequest {
  lobbyId: string;
}

export interface MatchQuery {
  matchId: string;
}

export interface TutorialStepRequest {
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

export interface InviteLobbyResponse {
  invite: InviteState;
  lobby: PvpLobbyState;
}

export interface PvpLobbyResponse {
  lobby: PvpLobbyState;
}

export interface PvpLobbyStartResponse {
  lobby: PvpLobbyState;
  result?: MatchActionResult;
}

export interface MatchResponse {
  result: MatchActionResult;
  botPlan?: BotTurnPlanPublic;
}

export interface MatchDataResponse {
  match: MatchState;
  botPlan?: BotTurnPlanPublic;
}

export const API_ROUTES = {
  lobby: "/api/lobby",
  matchAi: "/api/match/ai",
  tutorialStart: "/api/tutorial/start",
  tutorialCleanupStart: "/api/tutorial/cleanup/start",
  tutorialAcknowledge: "/api/tutorial/acknowledge",
  tutorialSkip: "/api/tutorial/skip",
  inviteCreate: "/api/match/invite",
  inviteAccept: "/api/invite/accept",
  pvpLobbyGet: "/api/pvp/lobby/get",
  pvpLobbyStart: "/api/pvp/lobby/start",
  pvpLobbyDismantle: "/api/pvp/lobby/dismantle",
  matchGet: "/api/match/get",
  matchMulligan: "/api/match/mulligan",
  matchPlay: "/api/match/play",
  matchAttack: "/api/match/attack",
  matchRepositionJudge: "/api/match/reposition-judge",
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

const POST_JSON_TIMEOUT_MS = 15_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- default generic keeps postJson ergonomic at call sites
export async function postJson<TRequest, TResponse = any>(
  url: string,
  body: TRequest,
): Promise<ApiResponse<TResponse>> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId =
    controller === null
      ? null
      : setTimeout(() => {
          controller.abort();
        }, POST_JSON_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller?.signal ?? null,
    });
  } catch (error) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "Network timeout while contacting server."
          : `Network error: ${error.message}`
        : "Network error while contacting server.";
    return {
      ok: false,
      error: message,
    };
  }
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
  }

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
  | MatchActionEnvelope<AttackInput>
  | MatchActionEnvelope<RepositionJudgeInput>;

