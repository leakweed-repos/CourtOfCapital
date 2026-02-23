import type { CardV2 } from "../schema";

export const SHORT_HEDGEFUND_CARDS_V2: readonly CardV2[] = [
  {
    id: "shadow_broker",
    name: "Shadow Broker",
    faction: "short_hedgefund",
    kind: "unit",
    description:
      "Dirty backline operator that skims shares on contact, manipulates pressure lanes, and doubles as a Judge blue profiteer.",
    court_case:
      "Shadow Broker denies everything except \"market efficiency,\" but the record still shows lane manipulation, contact skims, and a blue-slot grin whenever the Judge looks away.",
    role: "control",
    costShares: 115,
    dirtyPower: 1,
    lane: "back",
    stats: {
      attack: 3,
      health: 3,
    },
    keywords: ["dirty", "ranged"],
    specials: [
      {
        kind: "resistance",
        exposed: 0.33,
      },
    ],
    triggers: [
      {
        when: "on_hit",
        requires: ["source_survived"],
        actions: [{ kind: "gain_shares", target: "self_player", amount: 14 }],
        note: "Legacy fallback signature parity (combat-fee).",
      },
    ],
  },
];
