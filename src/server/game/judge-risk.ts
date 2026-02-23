import { clamp } from "../../shared/game";

export type JudgeCatchChanceInput = {
  dirtyPower: number;
  probation: number;
  judgeMood: number;
  judgeHostility: number;
};

export function computeJudgeCatchChance(input: JudgeCatchChanceInput): number {
  const base = 0.08 + input.dirtyPower * 0.09;
  const probation = Math.max(0, input.probation) * 0.07;
  const mood = clamp(input.judgeMood, -5, 5) * 0.02;
  // Hostility is now a real risk amplifier for Judge-facing / debt-heavy play patterns.
  const hostility = clamp(input.judgeHostility, 0, 8) * 0.025;
  return clamp(base + probation + mood + hostility, 0.05, 0.95);
}
