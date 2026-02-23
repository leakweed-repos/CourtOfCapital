import type { CardV2 } from "../schema";

export const RETAIL_MOB_CARDS_V2: readonly CardV2[] = [
  {
    id: "stonk_charger",
    name: "Stonk Charger",
    faction: "retail_mob",
    kind: "unit",
    description: "Rocket emojis train that can swing immediately and spear the backline before the candles cool.",
    court_case:
      "Stonk Charger entered the hearing at full speed, tagged the back row before roll call ended, and then insisted the rocket trail was merely community enthusiasm.",
    role: "offense",
    costShares: 163,
    lane: "both",
    stats: {
      attack: 4,
      health: 2,
    },
    keywords: ["rush", "reach"],
    specials: [
      {
        kind: "resistance",
        stun: 0.13,
      },
    ],
    triggers: [
      {
        when: "on_hit",
        requires: ["target_survived"],
        actions: [{ kind: "apply_status", target: "hit_target", status: "exposed", turns: 2 }],
        note: "Legacy fallback signature parity (combat-expose).",
      },
    ],
  },
  {
    id: "picket_marshal",
    name: "Picket Marshal",
    faction: "retail_mob",
    kind: "unit",
    description: "Retail frontline wall that taunts traffic and self-cleanses to keep the protest line standing.",
    court_case:
      "Picket Marshal was cited for obstructing tempo with a smile, washing off debuffs between chants, and treating the front row like a legally protected picket line.",
    role: "defense",
    costShares: 110,
    lane: "front",
    stats: {
      attack: 2,
      health: 5,
    },
    specials: [
      { kind: "taunt" },
      {
        kind: "resistance",
        stun: 0.4,
        atkDown: 0.26,
      },
    ],
    triggers: [
      {
        when: "turn_start",
        actions: [
          { kind: "cleanse", target: "self" },
          { kind: "heal", target: "self", amount: 2 },
        ],
        note: "Legacy fallback signature parity (turn-cleanse).",
      },
    ],
  },
];
