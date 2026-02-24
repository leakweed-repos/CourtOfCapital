import { PREFIX, nowTs } from "../../shared/game";
import type { BotPlannedAction, BotTurnPlanPublic, MatchState, PlayerSide } from "../../shared/game";
import type { RedisLike } from "./storage";
import { botTurnDelayMsForLevel, runAiUntilHumanTurn, runAiUntilHumanTurnWithTrace } from "./ai";

type BotTurnPlanStored = BotTurnPlanPublic & {
  baseUpdatedAt: number;
  baseRngCounter: number;
  baseTurn: number;
  baseActiveSide: PlayerSide;
};

type BotTurnOrchestrationResult = {
  match: MatchState;
  botPlan?: BotTurnPlanPublic;
};

const BOT_PLAN_TTL_SECONDS = 120;
type JsonRecord = Record<string, unknown>;
type PlannedPlayTarget = Extract<BotPlannedAction, { kind: "play_non_unit" }>["target"];

function keyBotTurnPlan(matchId: string): string {
  return `${PREFIX}:match:${matchId}:botplan`;
}

function clearLegacyBotThinkFields(match: MatchState): void {
  match.botThinkUntilAt = undefined;
  match.botThinkSide = undefined;
  match.botThinkTurn = undefined;
}

function asJsonRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

function parsePlayerSide(value: unknown): PlayerSide | null {
  if (value === "A" || value === "B") {
    return value;
  }
  return null;
}

function parseLane(value: unknown): "front" | "back" | null {
  if (value === "front" || value === "back") {
    return value;
  }
  return null;
}

function parsePlayTarget(value: unknown): PlannedPlayTarget | null {
  if (value === undefined) {
    return undefined;
  }
  const record = asJsonRecord(value);
  if (!record) {
    return null;
  }
  const kind = record.kind;
  if (kind === "ally-leader" || kind === "enemy-leader") {
    return { kind };
  }
  if (kind === "ally-unit" || kind === "enemy-unit") {
    if (typeof record.unitId !== "string") {
      return null;
    }
    return { kind, unitId: record.unitId };
  }
  return null;
}

function parseAttackTarget(value: unknown): Extract<BotPlannedAction, { kind: "attack" }>["target"] | null {
  const record = asJsonRecord(value);
  if (!record) {
    return null;
  }
  const kind = record.kind;
  if (kind === "leader" || kind === "judge") {
    return { kind };
  }
  if (kind === "unit") {
    if (typeof record.unitId !== "string") {
      return null;
    }
    return { kind, unitId: record.unitId };
  }
  if (kind === "event") {
    if (typeof record.eventUnitId !== "string") {
      return null;
    }
    return { kind, eventUnitId: record.eventUnitId };
  }
  return null;
}

function parseBotPlannedAction(value: unknown): BotPlannedAction | null {
  const record = asJsonRecord(value);
  if (!record) {
    return null;
  }
  if (record.kind === "end_turn") {
    return { kind: "end_turn" };
  }
  if (record.kind === "play_unit") {
    const lane = parseLane(record.lane);
    if (
      typeof record.cardId !== "string" ||
      typeof record.cardName !== "string" ||
      lane === null ||
      typeof record.col !== "number" ||
      !Number.isInteger(record.col)
    ) {
      return null;
    }
    const unitId = typeof record.unitId === "string" ? record.unitId : undefined;
    return {
      kind: "play_unit",
      cardId: record.cardId,
      cardName: record.cardName,
      lane,
      col: record.col,
      unitId,
    };
  }
  if (record.kind === "play_non_unit") {
    if (typeof record.cardId !== "string" || typeof record.cardName !== "string") {
      return null;
    }
    const target = parsePlayTarget(record.target);
    if (target === null) {
      return null;
    }
    const leverage =
      record.leverage === undefined || record.leverage === 2 || record.leverage === 3 || record.leverage === 4 || record.leverage === 5
        ? record.leverage
        : null;
    if (leverage === null) {
      return null;
    }
    return {
      kind: "play_non_unit",
      cardId: record.cardId,
      cardName: record.cardName,
      target,
      leverage,
    };
  }
  if (record.kind === "judge_action") {
    if (
      typeof record.attackerName !== "string" ||
      (record.judgeSlot !== "green" && record.judgeSlot !== "blue")
    ) {
      return null;
    }
    const attackerUnitId = typeof record.attackerUnitId === "string" ? record.attackerUnitId : undefined;
    return {
      kind: "judge_action",
      attackerName: record.attackerName,
      attackerUnitId,
      judgeSlot: record.judgeSlot,
    };
  }
  if (record.kind === "attack") {
    if (typeof record.attackerName !== "string") {
      return null;
    }
    const target = parseAttackTarget(record.target);
    if (target === null) {
      return null;
    }
    const attackerUnitId = typeof record.attackerUnitId === "string" ? record.attackerUnitId : undefined;
    return {
      kind: "attack",
      attackerName: record.attackerName,
      attackerUnitId,
      target,
    };
  }
  return null;
}

function parseBotPlannedActions(value: unknown): BotPlannedAction[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const actions: BotPlannedAction[] = [];
  for (const entry of value) {
    const parsed = parseBotPlannedAction(entry);
    if (!parsed) {
      return null;
    }
    actions.push(parsed);
  }
  return actions;
}

function parseTimelineMs(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const out: number[] = [];
  for (const entry of value) {
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry < 0) {
      return null;
    }
    out.push(Math.round(entry));
  }
  return out;
}

function safeParseBotPlan(raw: string): BotTurnPlanStored | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const candidate = asJsonRecord(parsed);
    if (!candidate) {
      return null;
    }
    const matchId = typeof candidate.matchId === "string" ? candidate.matchId : null;
    const id = typeof candidate.id === "string" ? candidate.id : null;
    if (matchId === null || id === null) {
      return null;
    }
    const actions = parseBotPlannedActions(candidate.actions);
    const timelineMs = parseTimelineMs(candidate.timelineMs);
    if (!actions || !timelineMs) {
      return null;
    }
    const readyAt = typeof candidate.readyAt === "number" && Number.isFinite(candidate.readyAt) ? candidate.readyAt : null;
    const createdAt =
      typeof candidate.createdAt === "number" && Number.isFinite(candidate.createdAt) ? candidate.createdAt : null;
    if (readyAt === null || createdAt === null) {
      return null;
    }
    const side = parsePlayerSide(candidate.side);
    const baseActiveSide = parsePlayerSide(candidate.baseActiveSide);
    if (side === null || baseActiveSide === null) {
      return null;
    }
    const turn = typeof candidate.turn === "number" && Number.isInteger(candidate.turn) ? candidate.turn : null;
    const botLevel = candidate.botLevel === 1 || candidate.botLevel === 2 || candidate.botLevel === 3 ? candidate.botLevel : null;
    const baseUpdatedAt =
      typeof candidate.baseUpdatedAt === "number" && Number.isFinite(candidate.baseUpdatedAt) ? candidate.baseUpdatedAt : null;
    const baseRngCounter =
      typeof candidate.baseRngCounter === "number" && Number.isInteger(candidate.baseRngCounter) ? candidate.baseRngCounter : null;
    const baseTurn = typeof candidate.baseTurn === "number" && Number.isInteger(candidate.baseTurn) ? candidate.baseTurn : null;
    if (
      turn === null ||
      botLevel === null ||
      baseUpdatedAt === null ||
      baseRngCounter === null ||
      baseTurn === null
    ) {
      return null;
    }
    if (timelineMs.length !== actions.length) {
      return null;
    }
    return {
      id,
      matchId,
      side,
      turn,
      botLevel,
      createdAt,
      readyAt,
      actions,
      timelineMs,
      baseUpdatedAt,
      baseRngCounter,
      baseTurn,
      baseActiveSide,
    };
  } catch {
    return null;
  }
}

async function getStoredBotTurnPlan(redis: RedisLike, matchId: string): Promise<BotTurnPlanStored | null> {
  const raw = await redis.get(keyBotTurnPlan(matchId));
  if (!raw) {
    return null;
  }
  return safeParseBotPlan(raw);
}

async function saveStoredBotTurnPlan(redis: RedisLike, plan: BotTurnPlanStored): Promise<void> {
  await redis.set(keyBotTurnPlan(plan.matchId), JSON.stringify(plan));
  await redis.expire(keyBotTurnPlan(plan.matchId), BOT_PLAN_TTL_SECONDS);
}

async function deleteStoredBotTurnPlan(redis: RedisLike, matchId: string): Promise<void> {
  await redis.del(keyBotTurnPlan(matchId));
}

function isEligibleBotTurn(match: MatchState): boolean {
  if (match.status !== "active" || match.mode !== "pve") {
    return false;
  }
  return Boolean(match.players[match.activeSide].isBot);
}

function isAnyActiveBotTurn(match: MatchState): boolean {
  return match.status === "active" && Boolean(match.players[match.activeSide].isBot);
}

function buildTimelineOffsets(delayMs: number, actions: readonly BotPlannedAction[]): number[] {
  if (actions.length === 0) {
    return [];
  }
  const earliest = Math.min(600, Math.max(250, Math.floor(delayMs * 0.12)));
  const latest = Math.max(earliest, delayMs - 450);
  if (actions.length === 1) {
    return [Math.min(latest, Math.max(earliest, Math.floor(delayMs * 0.5)))];
  }
  const span = Math.max(0, latest - earliest);
  return actions.map((_, idx) => Math.round(earliest + (span * idx) / (actions.length - 1)));
}

function buildBotTurnPlan(match: MatchState, now: number): BotTurnPlanStored | null {
  if (!isEligibleBotTurn(match)) {
    return null;
  }
  const botLevel = match.players[match.activeSide].botLevel ?? 3;
  const delayMs = botTurnDelayMsForLevel(botLevel);
  if (delayMs <= 0) {
    return null;
  }

  const planningMatch: MatchState = structuredClone(match);
  clearLegacyBotThinkFields(planningMatch);
  const traced = runAiUntilHumanTurnWithTrace(planningMatch);
  const timelineMs = buildTimelineOffsets(delayMs, traced.actions);
  const planId = `${match.id}:${match.turn}:${now}`;

  return {
    id: planId,
    matchId: match.id,
    side: match.activeSide,
    turn: match.turn,
    botLevel,
    createdAt: now,
    readyAt: now + delayMs,
    actions: traced.actions,
    timelineMs,
    baseUpdatedAt: match.updatedAt,
    baseRngCounter: match.rngCounter,
    baseTurn: match.turn,
    baseActiveSide: match.activeSide,
  };
}

function planMatchesCurrentState(plan: BotTurnPlanStored, match: MatchState): boolean {
  return (
    plan.matchId === match.id &&
    plan.baseUpdatedAt === match.updatedAt &&
    plan.baseRngCounter === match.rngCounter &&
    plan.baseTurn === match.turn &&
    plan.baseActiveSide === match.activeSide &&
    plan.turn === match.turn &&
    plan.side === match.activeSide
  );
}

function toPublicPlan(plan: BotTurnPlanStored): BotTurnPlanPublic {
  const { baseUpdatedAt: _baseUpdatedAt, baseRngCounter: _baseRngCounter, baseTurn: _baseTurn, baseActiveSide: _baseActiveSide, ...rest } =
    plan;
  return rest;
}

export async function orchestrateBotTurn(redis: RedisLike, match: MatchState, now = nowTs()): Promise<BotTurnOrchestrationResult> {
  clearLegacyBotThinkFields(match);

  if (!isAnyActiveBotTurn(match)) {
    await deleteStoredBotTurnPlan(redis, match.id);
    return { match };
  }

  if (match.mode !== "pve") {
    await deleteStoredBotTurnPlan(redis, match.id);
    const next = runAiUntilHumanTurn(match);
    clearLegacyBotThinkFields(next);
    return { match: next };
  }

  const plan = await getStoredBotTurnPlan(redis, match.id);
  if (!plan || !planMatchesCurrentState(plan, match)) {
    if (plan) {
      await deleteStoredBotTurnPlan(redis, match.id);
    }
    const rebuilt = buildBotTurnPlan(match, now);
    if (!rebuilt) {
      return { match };
    }
    await saveStoredBotTurnPlan(redis, rebuilt);
    return { match, botPlan: toPublicPlan(rebuilt) };
  }

  if (plan.readyAt > now) {
    return { match, botPlan: toPublicPlan(plan) };
  }

  await deleteStoredBotTurnPlan(redis, match.id);
  const next = runAiUntilHumanTurn(match);
  clearLegacyBotThinkFields(next);
  return { match: next };
}
