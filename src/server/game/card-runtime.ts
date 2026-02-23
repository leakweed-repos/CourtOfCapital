import type { Lane, PlayerSide, UnitState } from "../../shared/game";
import {
  getCardV2ById,
  type CardActionDef,
  type CardStatusKind,
  type CardTriggerCondition,
  type CardTriggerDef,
  type UnitCardV2,
} from "../../shared/cards/index";

export type V2UnitRuntimeApi = {
  listSideUnitIds: (side: PlayerSide, lane?: Lane) => string[];
  getUnit: (unitId: string) => UnitState | undefined;
  randomUnitId: (unitIds: string[], label: string) => string | undefined;
  pickLowestHealthUnitId: (unitIds: string[]) => string | undefined;
  healUnit: (unit: UnitState, amount: number) => number;
  addUnitShield: (unit: UnitState, charges: number) => void;
  cleanseUnit: (unit: UnitState, statuses?: readonly CardStatusKind[]) => number;
  exposeUnitUntil: (unit: UnitState, untilTurn: number, sourceLabel: string) => boolean;
  stunUnitUntil: (unit: UnitState, untilTurn: number, sourceLabel: string) => boolean;
  applyTemporaryAttackPenalty: (unit: UnitState, amount: number, untilTurn: number, sourceLabel: string) => number;
  modifyAttack: (unit: UnitState, amount: number) => number;
  gainShares: (side: PlayerSide, amount: number) => void;
  healLeader: (side: PlayerSide, amount: number) => number;
  drawOne: (side: PlayerSide) => string | null;
  pushLog: (text: string) => void;
};

export type V2UnitRuntimeContext = {
  side: PlayerSide;
  unit: UnitState;
  turn: number;
  api: V2UnitRuntimeApi;
};

export type V2UnitCombatRuntimeContext = V2UnitRuntimeContext & {
  target: UnitState;
  targetDied: boolean;
  attackerDied: boolean;
};

type TriggerExecutionState = {
  allyTargetId?: string;
};

function getV2UnitCard(cardId: string): UnitCardV2 | undefined {
  const card = getCardV2ById(cardId);
  if (!card || card.kind !== "unit") {
    return undefined;
  }
  return card;
}

function hasTriggerCondition(ctx: V2UnitRuntimeContext | V2UnitCombatRuntimeContext, condition: CardTriggerCondition): boolean {
  if (condition === "source_survived") {
    if ("attackerDied" in ctx) {
      return !ctx.attackerDied && ctx.unit.health > 0;
    }
    return ctx.unit.health > 0;
  }

  if (!("target" in ctx)) {
    return false;
  }
  return !ctx.targetDied && ctx.target.health > 0;
}

function triggerConditionsSatisfied(
  trigger: CardTriggerDef,
  ctx: V2UnitRuntimeContext | V2UnitCombatRuntimeContext,
): boolean {
  const requires = trigger.requires ?? [];
  for (const condition of requires) {
    if (!hasTriggerCondition(ctx, condition)) {
      return false;
    }
  }
  return true;
}

function unitHasStatus(unit: UnitState, status: CardStatusKind, turn: number): boolean {
  if (status === "stun") {
    return (unit.stunnedUntilTurn ?? 0) > turn;
  }
  if (status === "exposed") {
    return (unit.exposedUntilTurn ?? -1) >= turn;
  }
  return (unit.tempAttackPenalty ?? 0) > 0 && (unit.tempAttackPenaltyUntilTurn ?? Number.NEGATIVE_INFINITY) >= turn;
}

function unitMatchesStatuses(unit: UnitState, statuses: readonly CardStatusKind[] | undefined, turn: number): boolean {
  if (!statuses || statuses.length === 0) {
    return true;
  }
  return statuses.some((status) => unitHasStatus(unit, status, turn));
}

function resolveAllyTarget(
  action: CardActionDef,
  trigger: CardTriggerDef,
  ctx: V2UnitRuntimeContext | V2UnitCombatRuntimeContext,
  state: TriggerExecutionState,
): UnitState | undefined {
  if (action.target !== "ally") {
    return undefined;
  }
  const cached = state.allyTargetId ? ctx.api.getUnit(state.allyTargetId) : undefined;
  if (cached) {
    if (action.kind !== "cleanse" || unitMatchesStatuses(cached, action.statuses, ctx.turn)) {
      return cached;
    }
  }

  const allAllyIds = ctx.api.listSideUnitIds(ctx.side);
  const allAllies = allAllyIds.map((id) => ctx.api.getUnit(id)).filter((unit): unit is UnitState => Boolean(unit));

  if (action.kind === "heal") {
    const damagedIds = allAllies.filter((ally) => ally.health < ally.maxHealth).map((ally) => ally.id);
    const targetId = ctx.api.pickLowestHealthUnitId(damagedIds);
    if (!targetId) {
      return undefined;
    }
    state.allyTargetId = targetId;
    return ctx.api.getUnit(targetId);
  }

  if (action.kind === "cleanse") {
    const candidates = allAllies.filter((ally) => unitMatchesStatuses(ally, action.statuses, ctx.turn)).map((ally) => ally.id);
    const targetId = ctx.api.randomUnitId(candidates, `v2:${ctx.unit.cardId}:${trigger.when}:cleanse:ally`);
    if (!targetId) {
      return undefined;
    }
    state.allyTargetId = targetId;
    return ctx.api.getUnit(targetId);
  }

  if (action.kind === "gain_shield") {
    const allyIds = allAllies.filter((ally) => ally.id !== ctx.unit.id).map((ally) => ally.id);
    const targetId = ctx.api.randomUnitId(allyIds, `v2:${ctx.unit.cardId}:${trigger.when}:shield:ally`);
    if (!targetId) {
      return undefined;
    }
    state.allyTargetId = targetId;
    return ctx.api.getUnit(targetId);
  }

  const fallbackId = ctx.api.randomUnitId(allAllies.map((ally) => ally.id), `v2:${ctx.unit.cardId}:${trigger.when}:ally`);
  if (!fallbackId) {
    return undefined;
  }
  state.allyTargetId = fallbackId;
  return ctx.api.getUnit(fallbackId);
}

function resolveUnitTarget(
  action: CardActionDef,
  trigger: CardTriggerDef,
  ctx: V2UnitRuntimeContext | V2UnitCombatRuntimeContext,
  state: TriggerExecutionState,
): UnitState | undefined {
  if (action.target === "self") {
    return ctx.unit;
  }
  if (action.target === "hit_target") {
    return "target" in ctx ? ctx.target : undefined;
  }
  if (action.target === "ally") {
    return resolveAllyTarget(action, trigger, ctx, state);
  }
  return undefined;
}

function executeAction(
  action: CardActionDef,
  trigger: CardTriggerDef,
  ctx: V2UnitRuntimeContext | V2UnitCombatRuntimeContext,
  state: TriggerExecutionState,
): void {
  if (action.kind === "gain_shield") {
    const target = resolveUnitTarget(action, trigger, ctx, state);
    if (!target) {
      return;
    }
    ctx.api.addUnitShield(target, action.amount);
    ctx.api.pushLog(`${ctx.unit.name} [V2]: ${target.name} gained ${action.amount} shield.`);
    return;
  }

  if (action.kind === "heal") {
    if (action.target === "leader") {
      const healed = ctx.api.healLeader(ctx.side, action.amount);
      if (healed > 0) {
        ctx.api.pushLog(`${ctx.unit.name} [V2]: leader healed for ${healed}.`);
      }
      return;
    }
    const target = resolveUnitTarget(action, trigger, ctx, state);
    if (!target) {
      return;
    }
    const healed = ctx.api.healUnit(target, action.amount);
    if (healed > 0) {
      ctx.api.pushLog(`${ctx.unit.name} [V2]: healed ${target.name} for ${healed}.`);
    }
    return;
  }

  if (action.kind === "gain_shares") {
    ctx.api.gainShares(ctx.side, action.amount);
    ctx.api.pushLog(`${ctx.unit.name} [V2]: +${action.amount} shares.`);
    return;
  }

  if (action.kind === "modify_attack") {
    const target = resolveUnitTarget(action, trigger, ctx, state);
    if (!target) {
      return;
    }
    const applied = ctx.api.modifyAttack(target, action.amount);
    if (applied !== 0) {
      const sign = applied > 0 ? "+" : "";
      ctx.api.pushLog(`${ctx.unit.name} [V2]: ${target.name} attack ${sign}${applied}.`);
    }
    return;
  }

  if (action.kind === "cleanse") {
    const target = resolveUnitTarget(action, trigger, ctx, state);
    if (!target) {
      return;
    }
    const removed = ctx.api.cleanseUnit(target, action.statuses);
    if (removed > 0) {
      ctx.api.pushLog(`${ctx.unit.name} [V2]: cleansed ${target.name} (${removed}).`);
    }
    return;
  }

  if (action.kind === "apply_status") {
    const target = resolveUnitTarget(action, trigger, ctx, state);
    if (!target) {
      return;
    }
    const untilTurn = ctx.turn + Math.max(0, action.turns);
    const sourceLabel = `${ctx.unit.name} [V2]`;
    if (action.status === "stun") {
      if (ctx.api.stunUnitUntil(target, untilTurn, sourceLabel)) {
        ctx.api.pushLog(`${ctx.unit.name} [V2]: stunned ${target.name}.`);
      }
      return;
    }
    if (action.status === "exposed") {
      if (ctx.api.exposeUnitUntil(target, untilTurn, sourceLabel)) {
        ctx.api.pushLog(`${ctx.unit.name} [V2]: exposed ${target.name}.`);
      }
      return;
    }
    ctx.api.applyTemporaryAttackPenalty(target, 1, untilTurn, sourceLabel);
    return;
  }

  if (action.kind === "draw_card") {
    let drawn = 0;
    for (let i = 0; i < action.amount; i += 1) {
      if (ctx.api.drawOne(ctx.side)) {
        drawn += 1;
      }
    }
    if (drawn > 0) {
      ctx.api.pushLog(`${ctx.unit.name} [V2]: drew ${drawn} card${drawn === 1 ? "" : "s"}.`);
    }
  }
}

function runTriggersForEvent(
  card: UnitCardV2,
  when: CardTriggerDef["when"],
  ctx: V2UnitRuntimeContext | V2UnitCombatRuntimeContext,
): boolean {
  const triggers = (card.triggers ?? []).filter((trigger) => trigger.when === when);
  if (triggers.length === 0) {
    return false;
  }

  for (const trigger of triggers) {
    if (!triggerConditionsSatisfied(trigger, ctx)) {
      continue;
    }
    const state: TriggerExecutionState = {};
    for (const action of trigger.actions) {
      executeAction(action, trigger, ctx, state);
    }
  }
  return true;
}

export function runV2UnitOnSummonTriggers(ctx: V2UnitRuntimeContext): boolean {
  const card = getV2UnitCard(ctx.unit.cardId);
  if (!card) {
    return false;
  }
  return runTriggersForEvent(card, "on_summon", ctx);
}

export function runV2UnitTurnStartTriggers(ctx: V2UnitRuntimeContext): boolean {
  const card = getV2UnitCard(ctx.unit.cardId);
  if (!card) {
    return false;
  }
  return runTriggersForEvent(card, "turn_start", ctx);
}

export function runV2UnitCombatTriggers(ctx: V2UnitCombatRuntimeContext): boolean {
  const card = getV2UnitCard(ctx.unit.cardId);
  if (!card) {
    return false;
  }

  const hasCombatTriggers = (card.triggers ?? []).some((trigger) =>
    trigger.when === "on_hit" || trigger.when === "on_kill" || trigger.when === "after_combat_survived",
  );
  if (!hasCombatTriggers) {
    return false;
  }

  runTriggersForEvent(card, "on_hit", ctx);
  if (ctx.targetDied) {
    runTriggersForEvent(card, "on_kill", ctx);
  }
  if (!ctx.attackerDied) {
    runTriggersForEvent(card, "after_combat_survived", ctx);
  }
  return true;
}
