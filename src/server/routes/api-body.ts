import type { FactionId, PlayerSide, TutorialScenarioId } from "../../shared/game";

export type ParseOk<T> = { ok: true; value: T };
export type ParseFail = { ok: false; error: string };
export type ParseResult<T> = ParseOk<T> | ParseFail;

type JsonObject = Record<string, unknown>;

type AllyEnemyTarget =
  | { kind: "ally-unit"; unitId: string }
  | { kind: "enemy-unit"; unitId: string }
  | { kind: "ally-leader" }
  | { kind: "enemy-leader" };

type AttackTarget =
  | { kind: "leader" }
  | { kind: "judge" }
  | { kind: "unit"; unitId: string }
  | { kind: "event"; eventUnitId: string };

export type AiStartBody = { level: 1 | 2 | 3; faction?: FactionId };
export type TutorialStartBody = { scenarioId?: TutorialScenarioId; faction?: FactionId };
export type CleanupStartBody = { faction?: FactionId };
export type InviteCreateBody = { targetUsername: string; faction?: FactionId };
export type InviteAcceptBody = { inviteId: string; faction?: FactionId };
export type LobbyIdBody = { lobbyId: string };
export type PvpLobbyStartBody = { lobbyId: string; faction?: FactionId };
export type MatchIdBody = { matchId: string };
export type MulliganBody = { matchId: string; action: { side: PlayerSide; replaceIndices: number[] } };
export type PlayBody = {
  matchId: string;
  action: {
    side: PlayerSide;
    handIndex: number;
    lane: "front" | "back";
    col: number;
    leverage?: 2 | 3 | 4 | 5;
    target?: AllyEnemyTarget;
  };
};
export type AttackBody = {
  matchId: string;
  action: {
    side: PlayerSide;
    attackerUnitId: string;
    target: AttackTarget;
  };
};
export type RepositionJudgeBody = { matchId: string; action: { side: PlayerSide; unitId: string } };
export type EndTurnBody = { matchId: string; action: { side: PlayerSide } };
export type RepayNakedShortBody = { matchId: string; action: { side: PlayerSide } };

function fail<T>(error: string): ParseResult<T> {
  return { ok: false, error };
}

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(body: JsonObject, field: string): ParseResult<string> {
  const value = body[field];
  if (typeof value !== "string") {
    return fail(`Invalid body: '${field}' must be a string.`);
  }
  if (value.trim().length === 0) {
    return fail(`Invalid body: '${field}' cannot be empty.`);
  }
  return ok(value);
}

function integerField(body: JsonObject, field: string): ParseResult<number> {
  const value = body[field];
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return fail(`Invalid body: '${field}' must be an integer.`);
  }
  return ok(value);
}

function optionalFactionField(body: JsonObject, field: string): ParseResult<FactionId | undefined> {
  const value = body[field];
  if (value === undefined) {
    return ok(undefined);
  }
  if (
    value === "wallstreet" ||
    value === "sec" ||
    value === "market_makers" ||
    value === "short_hedgefund" ||
    value === "retail_mob"
  ) {
    return ok(value);
  }
  return fail(`Invalid body: '${field}' must be a valid faction.`);
}

function optionalTutorialScenarioField(body: JsonObject, field: string): ParseResult<TutorialScenarioId | undefined> {
  const value = body[field];
  if (value === undefined) {
    return ok(undefined);
  }
  if (value === "core_basics_v1" || value === "buffs_debuffs_v1" || value === "judge_dependencies_v1") {
    return ok(value);
  }
  return fail(`Invalid body: '${field}' must be a valid tutorial scenario.`);
}

function playerSideField(body: JsonObject, field: string): ParseResult<PlayerSide> {
  const value = body[field];
  if (value === "A" || value === "B") {
    return ok(value);
  }
  return fail(`Invalid body: '${field}' must be 'A' or 'B'.`);
}

function laneField(body: JsonObject, field: string): ParseResult<"front" | "back"> {
  const value = body[field];
  if (value === "front" || value === "back") {
    return ok(value);
  }
  return fail(`Invalid body: '${field}' must be 'front' or 'back'.`);
}

function parseLeverage(value: unknown): ParseResult<2 | 3 | 4 | 5 | undefined> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (value === 2 || value === 3 || value === 4 || value === 5) {
    return ok(value);
  }
  return fail("Invalid body: 'action.leverage' must be one of 2,3,4,5.");
}

function parseReplaceIndices(value: unknown): ParseResult<number[]> {
  if (!Array.isArray(value)) {
    return fail("Invalid body: 'action.replaceIndices' must be an array.");
  }
  const out: number[] = [];
  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isFinite(entry) || !Number.isInteger(entry) || entry < 0) {
      return fail("Invalid body: 'action.replaceIndices' must contain non-negative integers.");
    }
    out.push(entry);
  }
  return ok(out);
}

function parseAllyEnemyTarget(value: unknown): ParseResult<AllyEnemyTarget | undefined> {
  if (value === undefined) {
    return ok(undefined);
  }
  if (!isObject(value)) {
    return fail("Invalid body: 'action.target' must be an object.");
  }
  const kind = value.kind;
  if (kind === "ally-leader" || kind === "enemy-leader") {
    return ok({ kind });
  }
  if (kind === "ally-unit" || kind === "enemy-unit") {
    const unitId = stringField(value, "unitId");
    if (!unitId.ok) {
      return unitId;
    }
    return ok({ kind, unitId: unitId.value });
  }
  return fail("Invalid body: unsupported 'action.target.kind' for play action.");
}

function parseAttackTarget(value: unknown): ParseResult<AttackTarget> {
  if (!isObject(value)) {
    return fail("Invalid body: 'action.target' must be an object.");
  }
  const kind = value.kind;
  if (kind === "leader" || kind === "judge") {
    return ok({ kind });
  }
  if (kind === "unit") {
    const unitId = stringField(value, "unitId");
    if (!unitId.ok) {
      return unitId;
    }
    return ok({ kind, unitId: unitId.value });
  }
  if (kind === "event") {
    const eventUnitId = stringField(value, "eventUnitId");
    if (!eventUnitId.ok) {
      return eventUnitId;
    }
    return ok({ kind, eventUnitId: eventUnitId.value });
  }
  return fail("Invalid body: unsupported 'action.target.kind' for attack action.");
}

function requireObject(raw: unknown): ParseResult<JsonObject> {
  if (!isObject(raw)) {
    return fail("Invalid JSON body: expected an object.");
  }
  return ok(raw);
}

export function parseAiStartBody(raw: unknown): ParseResult<AiStartBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const level = body.value.level;
  if (level !== 1 && level !== 2 && level !== 3) {
    return fail("Invalid body: 'level' must be 1, 2, or 3.");
  }
  const faction = optionalFactionField(body.value, "faction");
  if (!faction.ok) return faction;
  return ok({ level, faction: faction.value });
}

export function parseTutorialStartBody(raw: unknown): ParseResult<TutorialStartBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const scenarioId = optionalTutorialScenarioField(body.value, "scenarioId");
  if (!scenarioId.ok) return scenarioId;
  const faction = optionalFactionField(body.value, "faction");
  if (!faction.ok) return faction;
  return ok({ scenarioId: scenarioId.value, faction: faction.value });
}

export function parseCleanupStartBody(raw: unknown): ParseResult<CleanupStartBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const faction = optionalFactionField(body.value, "faction");
  if (!faction.ok) return faction;
  return ok({ faction: faction.value });
}

export function parseInviteCreateBody(raw: unknown): ParseResult<InviteCreateBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const targetUsername = stringField(body.value, "targetUsername");
  if (!targetUsername.ok) return targetUsername;
  const faction = optionalFactionField(body.value, "faction");
  if (!faction.ok) return faction;
  return ok({ targetUsername: targetUsername.value, faction: faction.value });
}

export function parseInviteAcceptBody(raw: unknown): ParseResult<InviteAcceptBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const inviteId = stringField(body.value, "inviteId");
  if (!inviteId.ok) return inviteId;
  const faction = optionalFactionField(body.value, "faction");
  if (!faction.ok) return faction;
  return ok({ inviteId: inviteId.value, faction: faction.value });
}

export function parseLobbyIdBody(raw: unknown): ParseResult<LobbyIdBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const lobbyId = stringField(body.value, "lobbyId");
  if (!lobbyId.ok) return lobbyId;
  return ok({ lobbyId: lobbyId.value });
}

export function parsePvpLobbyStartBody(raw: unknown): ParseResult<PvpLobbyStartBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const lobbyId = stringField(body.value, "lobbyId");
  if (!lobbyId.ok) return lobbyId;
  const faction = optionalFactionField(body.value, "faction");
  if (!faction.ok) return faction;
  return ok({ lobbyId: lobbyId.value, faction: faction.value });
}

export function parseMatchIdBody(raw: unknown): ParseResult<MatchIdBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const matchId = stringField(body.value, "matchId");
  if (!matchId.ok) return matchId;
  return ok({ matchId: matchId.value });
}

export function parseMulliganBody(raw: unknown): ParseResult<MulliganBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const matchId = stringField(body.value, "matchId");
  if (!matchId.ok) return matchId;
  const actionRaw = body.value.action;
  if (!isObject(actionRaw)) {
    return fail("Invalid body: 'action' must be an object.");
  }
  const side = playerSideField(actionRaw, "side");
  if (!side.ok) return side;
  const replaceIndices = parseReplaceIndices(actionRaw.replaceIndices);
  if (!replaceIndices.ok) return replaceIndices;
  return ok({
    matchId: matchId.value,
    action: {
      side: side.value,
      replaceIndices: replaceIndices.value,
    },
  });
}

export function parsePlayBody(raw: unknown): ParseResult<PlayBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const matchId = stringField(body.value, "matchId");
  if (!matchId.ok) return matchId;
  const actionRaw = body.value.action;
  if (!isObject(actionRaw)) {
    return fail("Invalid body: 'action' must be an object.");
  }
  const side = playerSideField(actionRaw, "side");
  if (!side.ok) return side;
  const handIndex = integerField(actionRaw, "handIndex");
  if (!handIndex.ok) return handIndex;
  const lane = laneField(actionRaw, "lane");
  if (!lane.ok) return lane;
  const col = integerField(actionRaw, "col");
  if (!col.ok) return col;
  const leverage = parseLeverage(actionRaw.leverage);
  if (!leverage.ok) return leverage;
  const target = parseAllyEnemyTarget(actionRaw.target);
  if (!target.ok) return target;
  return ok({
    matchId: matchId.value,
    action: {
      side: side.value,
      handIndex: handIndex.value,
      lane: lane.value,
      col: col.value,
      leverage: leverage.value,
      target: target.value,
    },
  });
}

export function parseAttackBody(raw: unknown): ParseResult<AttackBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const matchId = stringField(body.value, "matchId");
  if (!matchId.ok) return matchId;
  const actionRaw = body.value.action;
  if (!isObject(actionRaw)) {
    return fail("Invalid body: 'action' must be an object.");
  }
  const side = playerSideField(actionRaw, "side");
  if (!side.ok) return side;
  const attackerUnitId = stringField(actionRaw, "attackerUnitId");
  if (!attackerUnitId.ok) return attackerUnitId;
  const target = parseAttackTarget(actionRaw.target);
  if (!target.ok) return target;
  return ok({
    matchId: matchId.value,
    action: {
      side: side.value,
      attackerUnitId: attackerUnitId.value,
      target: target.value,
    },
  });
}

export function parseRepositionJudgeBody(raw: unknown): ParseResult<RepositionJudgeBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const matchId = stringField(body.value, "matchId");
  if (!matchId.ok) return matchId;
  const actionRaw = body.value.action;
  if (!isObject(actionRaw)) {
    return fail("Invalid body: 'action' must be an object.");
  }
  const side = playerSideField(actionRaw, "side");
  if (!side.ok) return side;
  const unitId = stringField(actionRaw, "unitId");
  if (!unitId.ok) return unitId;
  return ok({ matchId: matchId.value, action: { side: side.value, unitId: unitId.value } });
}

export function parseEndTurnBody(raw: unknown): ParseResult<EndTurnBody> {
  const body = requireObject(raw);
  if (!body.ok) return body;
  const matchId = stringField(body.value, "matchId");
  if (!matchId.ok) return matchId;
  const actionRaw = body.value.action;
  if (!isObject(actionRaw)) {
    return fail("Invalid body: 'action' must be an object.");
  }
  const side = playerSideField(actionRaw, "side");
  if (!side.ok) return side;
  return ok({ matchId: matchId.value, action: { side: side.value } });
}

export function parseRepayNakedShortBody(raw: unknown): ParseResult<RepayNakedShortBody> {
  return parseEndTurnBody(raw);
}
