import type { CardV2 } from "../schema";

export const SEC_CARDS_V2: readonly CardV2[] = [
  {
    id: "compliance_clerk",
    name: "Compliance Clerk",
    faction: "sec",
    kind: "unit",
    description:
      "Backline prosecutor support that patches up allies, clears debuffs, and still carries the whole Judge green paperwork stack.",
    court_case:
      "The clerk filed Compliance Clerk under \"indispensable and mildly terrifying\" after witnesses confirmed it healed the room, cleaned the record, and still demanded every form be initialed twice.",
    role: "support",
    costShares: 90,
    lane: "back",
    stats: {
      attack: 1,
      health: 4,
    },
    keywords: ["prosecutor"],
    specials: [
      {
        kind: "resistance",
        exposed: 0.24,
        atkDown: 0.14,
      },
    ],
    triggers: [
      {
        when: "on_summon",
        actions: [
          { kind: "heal", target: "ally", amount: 2 },
          { kind: "cleanse", target: "ally", statuses: ["stun", "exposed"] },
        ],
        note: "Legacy parity: targets a damaged ally when possible.",
      },
      {
        when: "turn_start",
        actions: [
          { kind: "heal", target: "ally", amount: 2 },
          { kind: "cleanse", target: "ally", statuses: ["stun", "exposed"] },
        ],
        note: "Legacy parity: repeats on a damaged ally when possible.",
      },
    ],
  },
];
