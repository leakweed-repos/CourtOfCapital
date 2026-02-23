import type {
  CardActionDef,
  CardAuthorRole,
  CardKeyword,
  CardSpecialDef,
  CardTriggerDef,
  CardV2,
  NonUnitCardV2,
  UnitCardV2,
} from "./schema";

type SharedAuthorFields = {
  id: string;
  name: string;
  faction: CardV2["faction"];
  description: string;
  court_case?: string;
  mechanicsSummary?: string;
  impactTargetRule?: CardV2["impactTargetRule"];
  role: CardAuthorRole;
  costShares: number;
  dirtyPower?: number;
  keywords?: CardKeyword[];
  specials?: CardSpecialDef[];
  triggers?: CardTriggerDef[];
};

type UnitCardAuthorInput = SharedAuthorFields & {
  lane: UnitCardV2["lane"];
  stats: UnitCardV2["stats"];
};

type NonUnitCardAuthorInput = SharedAuthorFields & {
  kind?: NonUnitCardV2["kind"];
};

type TauntTankPresetInput = {
  id: string;
  name: string;
  faction: CardV2["faction"];
  description: string;
  role?: Extract<CardAuthorRole, "defense" | "control">;
  costShares: number;
  attack: number;
  health: number;
  court_case?: string;
  keywords?: CardKeyword[];
  specials?: CardSpecialDef[];
  triggers?: CardTriggerDef[];
  dirtyPower?: number;
};

type CheapTauntPresetInput = {
  id: string;
  name: string;
  faction: CardV2["faction"];
  description: string;
  costShares: number;
  attack: number;
  health: number;
  court_case?: string;
  keywords?: CardKeyword[];
  dirtyPower?: number;
};

type RangedSupportPresetInput = {
  id: string;
  name: string;
  faction: CardV2["faction"];
  description: string;
  costShares: number;
  attack: number;
  health: number;
  role?: Extract<CardAuthorRole, "support" | "control" | "economy">;
  court_case?: string;
  keywords?: CardKeyword[];
  specials?: CardSpecialDef[];
  triggers?: CardTriggerDef[];
  dirtyPower?: number;
};

type RushAttackerPresetInput = {
  id: string;
  name: string;
  faction: CardV2["faction"];
  description: string;
  costShares: number;
  attack: number;
  health: number;
  lane?: UnitCardV2["lane"];
  court_case?: string;
  keywords?: CardKeyword[];
  specials?: CardSpecialDef[];
  triggers?: CardTriggerDef[];
  dirtyPower?: number;
};

type SupportCleanerPresetInput = {
  id: string;
  name: string;
  faction: CardV2["faction"];
  description: string;
  costShares: number;
  attack: number;
  health: number;
  lane?: UnitCardV2["lane"];
  healAmount?: number;
  statuses?: ("stun" | "exposed" | "atk_down")[];
  court_case?: string;
  keywords?: CardKeyword[];
  specials?: CardSpecialDef[];
  dirtyPower?: number;
};

function copyKeywords(keywords: readonly CardKeyword[]): CardKeyword[] {
  return [...keywords];
}

function copySpecials(specials: readonly CardSpecialDef[]): CardSpecialDef[] {
  return [...specials];
}

function copyTriggers(triggers: readonly CardTriggerDef[]): CardTriggerDef[] {
  return [...triggers];
}

export function unitCard(input: UnitCardAuthorInput): UnitCardV2 {
  return {
    id: input.id,
    name: input.name,
    faction: input.faction,
    kind: "unit",
    description: input.description,
    ...(input.court_case ? { court_case: input.court_case } : {}),
    ...(input.mechanicsSummary ? { mechanicsSummary: input.mechanicsSummary } : {}),
    ...(input.impactTargetRule ? { impactTargetRule: input.impactTargetRule } : {}),
    role: input.role,
    costShares: input.costShares,
    ...(typeof input.dirtyPower === "number" ? { dirtyPower: input.dirtyPower } : {}),
    lane: input.lane,
    stats: { attack: input.stats.attack, health: input.stats.health },
    ...(input.keywords && input.keywords.length > 0 ? { keywords: copyKeywords(input.keywords) } : {}),
    ...(input.specials && input.specials.length > 0 ? { specials: copySpecials(input.specials) } : {}),
    ...(input.triggers && input.triggers.length > 0 ? { triggers: copyTriggers(input.triggers) } : {}),
  };
}

export function spellCard(input: NonUnitCardAuthorInput): NonUnitCardV2 {
  return {
    id: input.id,
    name: input.name,
    faction: input.faction,
    kind: input.kind ?? "instrument",
    description: input.description,
    ...(input.court_case ? { court_case: input.court_case } : {}),
    ...(input.mechanicsSummary ? { mechanicsSummary: input.mechanicsSummary } : {}),
    ...(input.impactTargetRule ? { impactTargetRule: input.impactTargetRule } : {}),
    role: input.role,
    costShares: input.costShares,
    ...(typeof input.dirtyPower === "number" ? { dirtyPower: input.dirtyPower } : {}),
    ...(input.keywords && input.keywords.length > 0 ? { keywords: copyKeywords(input.keywords) } : {}),
    ...(input.specials && input.specials.length > 0 ? { specials: copySpecials(input.specials) } : {}),
    ...(input.triggers && input.triggers.length > 0 ? { triggers: copyTriggers(input.triggers) } : {}),
  };
}

export function upgradeCard(input: Omit<NonUnitCardAuthorInput, "kind">): NonUnitCardV2 {
  return spellCard({ ...input, kind: "upgrade" });
}

export function cheapTaunt(input: CheapTauntPresetInput): UnitCardV2 {
  return unitCard({
    id: input.id,
    name: input.name,
    faction: input.faction,
    description: input.description,
    ...(input.court_case ? { court_case: input.court_case } : {}),
    role: "defense",
    costShares: input.costShares,
    lane: "front",
    stats: { attack: input.attack, health: input.health },
    ...(typeof input.dirtyPower === "number" ? { dirtyPower: input.dirtyPower } : {}),
    ...(input.keywords ? { keywords: input.keywords } : {}),
    specials: [{ kind: "taunt" }],
  });
}

export function tauntTank(input: TauntTankPresetInput): UnitCardV2 {
  return unitCard({
    id: input.id,
    name: input.name,
    faction: input.faction,
    description: input.description,
    ...(input.court_case ? { court_case: input.court_case } : {}),
    role: input.role ?? "defense",
    costShares: input.costShares,
    lane: "front",
    stats: { attack: input.attack, health: input.health },
    ...(typeof input.dirtyPower === "number" ? { dirtyPower: input.dirtyPower } : {}),
    ...(input.keywords ? { keywords: input.keywords } : {}),
    specials: [{ kind: "taunt" }, ...(input.specials ?? [])],
    ...(input.triggers ? { triggers: input.triggers } : {}),
  });
}

export function rangedSupport(input: RangedSupportPresetInput): UnitCardV2 {
  const keywords = new Set<CardKeyword>(["ranged", ...(input.keywords ?? [])]);
  return unitCard({
    id: input.id,
    name: input.name,
    faction: input.faction,
    description: input.description,
    ...(input.court_case ? { court_case: input.court_case } : {}),
    role: input.role ?? "support",
    costShares: input.costShares,
    lane: "back",
    stats: { attack: input.attack, health: input.health },
    ...(typeof input.dirtyPower === "number" ? { dirtyPower: input.dirtyPower } : {}),
    keywords: [...keywords],
    ...(input.specials ? { specials: input.specials } : {}),
    ...(input.triggers ? { triggers: input.triggers } : {}),
  });
}

export function rushAttacker(input: RushAttackerPresetInput): UnitCardV2 {
  const keywords = new Set<CardKeyword>(["rush", ...(input.keywords ?? [])]);
  return unitCard({
    id: input.id,
    name: input.name,
    faction: input.faction,
    description: input.description,
    ...(input.court_case ? { court_case: input.court_case } : {}),
    role: "offense",
    costShares: input.costShares,
    lane: input.lane ?? "both",
    stats: { attack: input.attack, health: input.health },
    ...(typeof input.dirtyPower === "number" ? { dirtyPower: input.dirtyPower } : {}),
    keywords: [...keywords],
    ...(input.specials ? { specials: input.specials } : {}),
    ...(input.triggers ? { triggers: input.triggers } : {}),
  });
}

export function supportCleaner(input: SupportCleanerPresetInput): UnitCardV2 {
  const statuses = input.statuses ?? ["stun", "exposed"];
  const actions: CardActionDef[] = [
    { kind: "heal", target: "ally", amount: input.healAmount ?? 2 },
    { kind: "cleanse", target: "ally", statuses },
  ];
  return unitCard({
    id: input.id,
    name: input.name,
    faction: input.faction,
    description: input.description,
    ...(input.court_case ? { court_case: input.court_case } : {}),
    role: "support",
    costShares: input.costShares,
    lane: input.lane ?? "back",
    stats: { attack: input.attack, health: input.health },
    ...(typeof input.dirtyPower === "number" ? { dirtyPower: input.dirtyPower } : {}),
    ...(input.keywords ? { keywords: input.keywords } : {}),
    ...(input.specials ? { specials: input.specials } : {}),
    triggers: [{ when: "on_summon", actions }],
  });
}

export const AUTHORING_PRESETS = {
  unitCard,
  spellCard,
  upgradeCard,
  cheapTaunt,
  tauntTank,
  rangedSupport,
  rushAttacker,
  supportCleaner,
} as const;
