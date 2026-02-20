import { stableHash } from "./game";
import { isJudgeCorruptSpecialistCard, isJudgePositiveSpecialistCard, isJudgeSpecialistCard } from "./placement";

export type JudgePrimaryEffect = "stun" | "atk_down" | "expose" | "chip";
export type JudgeSupportEffect = "heal" | "ready" | "shield";
export type JudgeBlueRider = "favor_down" | "probation_up" | "both";

export interface JudgeGreenProfile {
  feeBase: number;
  feeScale: number;
  rebatePct: number;
  primary: JudgePrimaryEffect;
  support: JudgeSupportEffect;
  petitionPrimary: JudgePrimaryEffect;
  petitionSupport: JudgeSupportEffect;
  probationBonus: boolean;
}

export interface JudgeBlueProfile {
  taxBase: number;
  taxScale: number;
  skimPct: number;
  coercion: JudgePrimaryEffect;
  rider: JudgeBlueRider;
  bribePrimary: JudgePrimaryEffect;
}

export interface JudgeSpecialistProfile {
  green?: JudgeGreenProfile;
  blue?: JudgeBlueProfile;
}

const PRIMARY_EFFECTS: readonly JudgePrimaryEffect[] = ["stun", "atk_down", "expose", "chip"];
const SUPPORT_EFFECTS: readonly JudgeSupportEffect[] = ["heal", "ready", "shield"];
const BLUE_RIDERS: readonly JudgeBlueRider[] = ["favor_down", "probation_up", "both"];

function pick<T>(arr: readonly T[], idx: number): T {
  return arr[idx % arr.length] as T;
}

function describePrimary(effect: JudgePrimaryEffect): string {
  if (effect === "stun") return "stun strongest target";
  if (effect === "atk_down") return "apply temporary -1 attack";
  if (effect === "expose") return "apply Exposed";
  return "deal 1 sanction damage";
}

function describeSupport(effect: JudgeSupportEffect): string {
  if (effect === "heal") return "heal weakest ally by 1";
  if (effect === "ready") return "ready one ally to attack now";
  return "grant 1 shield to an ally";
}

function describeBlueRider(effect: JudgeBlueRider): string {
  if (effect === "favor_down") return "enemy favor -1";
  if (effect === "probation_up") return "enemy probation +1";
  return "enemy favor -1 and probation +1";
}

export function getJudgeSpecialistProfile(cardId: string): JudgeSpecialistProfile {
  const h = stableHash(`judge-specialist:${cardId}`);
  const out: JudgeSpecialistProfile = {};

  if (isJudgePositiveSpecialistCard(cardId)) {
    out.green = {
      feeBase: 10 + ((h >>> 1) % 5) * 3,
      feeScale: 2 + ((h >>> 4) % 3),
      rebatePct: 40 + ((h >>> 7) % 4) * 5,
      primary: pick(PRIMARY_EFFECTS, h >>> 10),
      support: pick(SUPPORT_EFFECTS, h >>> 13),
      petitionPrimary: pick(PRIMARY_EFFECTS, h >>> 16),
      petitionSupport: pick(SUPPORT_EFFECTS, h >>> 19),
      probationBonus: ((h >>> 22) % 2) === 0,
    };
  }

  if (isJudgeCorruptSpecialistCard(cardId)) {
    out.blue = {
      taxBase: 12 + ((h >>> 2) % 5) * 3,
      taxScale: 2 + ((h >>> 5) % 3),
      skimPct: 60 + ((h >>> 8) % 4) * 5,
      coercion: pick(PRIMARY_EFFECTS, h >>> 11),
      rider: pick(BLUE_RIDERS, h >>> 14),
      bribePrimary: pick(PRIMARY_EFFECTS, h >>> 17),
    };
  }

  return out;
}

export function getJudgeSpecialistSummary(cardId: string): string {
  if (!isJudgeSpecialistCard(cardId)) {
    return "";
  }

  const profile = getJudgeSpecialistProfile(cardId);
  const chunks: string[] = [];

  if (profile.green) {
    const g = profile.green;
    const bonus = g.probationBonus ? ", +1 enemy probation" : "";
    chunks.push(
      `Judge green: legal fee ${g.feeBase}+atk*${g.feeScale} (you keep ${g.rebatePct}%); ` +
        `${describePrimary(g.primary)}; support: ${describeSupport(g.support)}${bonus}.`,
    );
    chunks.push(
      `Judge petition action: ${describePrimary(g.petitionPrimary)} + ${describeSupport(g.petitionSupport)}.`,
    );
  }

  if (profile.blue) {
    const b = profile.blue;
    chunks.push(
      `Judge blue: skim ${b.taxBase}+atk*${b.taxScale} (you keep ${b.skimPct}%); ` +
        `${describePrimary(b.coercion)}; rider: ${describeBlueRider(b.rider)}.`,
    );
    chunks.push(`Judge bribe action: ${describePrimary(b.bribePrimary)} plus rider.`);
  }

  return chunks.join(" ");
}
