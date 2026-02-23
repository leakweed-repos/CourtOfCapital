import type { CardFaction } from "../game";

export type CardAuthorRole =
  | "offense"
  | "defense"
  | "support"
  | "control"
  | "economy"
  | "utility";

export type CardLaneSpec = "front" | "back" | "both";

export type CardKeyword =
  | "rush"
  | "reach"
  | "ranged"
  | "flip"
  | "dirty"
  | "prosecutor"
  | "negotiator";

export type CardStatusKind = "stun" | "exposed" | "atk_down";

export type CardImpactTargetRule =
  | "none"
  | "ally-unit"
  | "enemy-unit"
  | "ally-unit-or-leader"
  | "enemy-unit-or-leader";

export type CardTriggerEvent =
  | "on_summon"
  | "turn_start"
  | "on_hit"
  | "on_kill"
  | "after_combat_survived";

export type CardTriggerCondition = "target_survived" | "source_survived";

export type CardActionDef =
  | {
      kind: "gain_shield";
      target: "self" | "ally" | "hit_target";
      amount: number;
    }
  | {
      kind: "heal";
      target: "self" | "ally" | "leader";
      amount: number;
    }
  | {
      kind: "gain_shares";
      target: "self_player";
      amount: number;
    }
  | {
      kind: "modify_attack";
      target: "self" | "hit_target";
      amount: number;
    }
  | {
      kind: "cleanse";
      target: "self" | "ally";
      statuses?: CardStatusKind[];
    }
  | {
      kind: "apply_status";
      target: "self" | "ally" | "hit_target";
      status: CardStatusKind;
      turns: number;
    }
  | {
      kind: "draw_card";
      target: "self_player";
      amount: number;
    };

export type CardTriggerDef = {
  when: CardTriggerEvent;
  actions: CardActionDef[];
  note?: string;
  requires?: CardTriggerCondition[];
};

export type CardSpecialDef =
  | { kind: "taunt" }
  | { kind: "shield_on_summon"; amount: number }
  | {
      kind: "resistance";
      stun?: number;
      exposed?: number;
      atkDown?: number;
    };

export type UnitStatsV2 = {
  attack: number;
  health: number;
};

type CardBaseV2 = {
  id: string;
  name: string;
  faction: CardFaction;
  description: string;
  court_case?: string;
  mechanicsSummary?: string;
  impactTargetRule?: CardImpactTargetRule;
  role: CardAuthorRole;
  costShares: number;
  dirtyPower?: number;
  keywords?: CardKeyword[];
  specials?: CardSpecialDef[];
  triggers?: CardTriggerDef[];
};

export type UnitCardV2 = CardBaseV2 & {
  kind: "unit";
  lane: CardLaneSpec;
  stats: UnitStatsV2;
};

export type NonUnitCardV2 = CardBaseV2 & {
  kind: "instrument" | "upgrade";
};

export type CardV2 = UnitCardV2 | NonUnitCardV2;

export type CardCatalogV2 = readonly CardV2[];
