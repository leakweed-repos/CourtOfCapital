import type { CardV2 } from "../schema";

export const MARKET_MAKERS_CARDS_V2: readonly CardV2[] = [
  {
    id: "spread_sniper",
    name: "Spread Sniper",
    faction: "market_makers",
    kind: "unit",
    description: "Backline marksman that tags targets with Exposed and lets the desk trade around the weakness.",
    court_case:
      "Spread Sniper is before the court for calling it \"price discovery\" while painting one target bright enough for the whole desk to monetize.",
    role: "control",
    costShares: 120,
    lane: "back",
    stats: {
      attack: 3,
      health: 3,
    },
    keywords: ["ranged"],
    specials: [
      {
        kind: "resistance",
        exposed: 0.23,
      },
    ],
    triggers: [
      {
        when: "on_hit",
        requires: ["target_survived"],
        actions: [{ kind: "apply_status", target: "hit_target", status: "exposed", turns: 2 }],
        note: "Explicit runtime skill parity.",
      },
    ],
  },
];
