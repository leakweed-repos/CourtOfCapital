import type { CardV2 } from "../schema";

export const WALLSTREET_CARDS_V2: readonly CardV2[] = [
  {
    id: "public_defender",
    name: "Public Defender",
    faction: "wallstreet",
    kind: "unit",
    description:
      "Durable backline counsel that shields the desk on entry, patches the leader each turn, and keeps premium Judge green support pressure online.",
    court_case:
      "Public Defender submitted a polished brief claiming pure service work, yet the court noted the shields, leader patch-ups, and billable calm arrived suspiciously on schedule.",
    role: "support",
    costShares: 120,
    lane: "back",
    stats: {
      attack: 2,
      health: 5,
    },
    keywords: ["ranged", "negotiator"],
    specials: [
      {
        kind: "resistance",
        exposed: 0.23,
        atkDown: 0.23,
      },
    ],
    triggers: [
      {
        when: "on_summon",
        actions: [
          { kind: "gain_shield", target: "self", amount: 1 },
          { kind: "gain_shield", target: "ally", amount: 1 },
        ],
        note: "Legacy parity: ally shield target is chosen by runtime.",
      },
      {
        when: "turn_start",
        actions: [
          { kind: "heal", target: "leader", amount: 1 },
          { kind: "cleanse", target: "ally", statuses: ["stun"] },
        ],
        note: "Legacy parity: cleanse is conditional on a valid stunned ally.",
      },
    ],
  },
];
