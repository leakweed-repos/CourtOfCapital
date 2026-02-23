import type { CardCatalogV2 } from "../schema";

export const CARD_CATALOG_V2_SNAPSHOT: CardCatalogV2 = [
  {
    "id": "filing_shield_deputy",
    "name": "Filing Shield Deputy",
    "faction": "sec",
    "description": "Budget taunt with clipboard courage.",
    "role": "defense",
    "costShares": 108,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.35,
        "atkDown": 0.18
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "source_survived"
        ],
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 14
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "guild_bailiff",
    "name": "Guild Bailiff",
    "faction": "sec",
    "description": "SEC shield. Taunt frontline.",
    "role": "defense",
    "costShares": 130,
    "impactTargetRule": "none",
    "mechanicsSummary": "On summon: gains 1 shield. Frontline Taunt anchor. Resistance: stun 41% · atk-down 24%.",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 5
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.41,
        "atkDown": 0.24
      }
    ],
    "triggers": []
  },
  {
    "id": "docket_enforcer",
    "name": "Docket Enforcer",
    "faction": "sec",
    "description": "Slaps fines with a stapler.",
    "role": "offense",
    "costShares": 125,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "flip"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.17
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "source_survived"
        ],
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 18
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "subpoena_rider",
    "name": "Subpoena Rider",
    "faction": "sec",
    "description": "Delivers papers at melee speed.",
    "role": "control",
    "costShares": 118,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 3
    },
    "keywords": [
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.14
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 20
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "halt_marshall",
    "name": "Halt Marshall",
    "faction": "sec",
    "description": "Trading halt on two legs.",
    "role": "defense",
    "costShares": 136,
    "impactTargetRule": "none",
    "mechanicsSummary": "On hit: stuns the target for one turn cycle. Resistance: stun 40% · atk-down 21%.",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 6
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.4,
        "atkDown": 0.21
      }
    ],
    "triggers": []
  },
  {
    "id": "filing_ram",
    "name": "Filing Ram",
    "faction": "sec",
    "description": "Breaks through with Form 8-K.",
    "role": "offense",
    "costShares": 122,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.15
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "disclosure_sergeant",
    "name": "Disclosure Sergeant",
    "faction": "sec",
    "description": "Quarterly reports, quarterly pain.",
    "role": "offense",
    "costShares": 124,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "compliance_bruiser",
    "name": "Compliance Bruiser",
    "faction": "sec",
    "description": "No alpha, only rules.",
    "role": "offense",
    "costShares": 126,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "ticker_sheriff",
    "name": "Ticker Sheriff",
    "faction": "sec",
    "description": "Keeps the tape clean-ish.",
    "role": "offense",
    "costShares": 120,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "hearing_gladiator",
    "name": "Hearing Gladiator",
    "faction": "sec",
    "description": "Cross-examines with steel.",
    "role": "offense",
    "costShares": 128,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "source_survived"
        ],
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 14
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "cease_desist_guard",
    "name": "Cease & Desist Guard",
    "faction": "sec",
    "description": "Walks around with giant red stamp.",
    "role": "defense",
    "costShares": 132,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 5
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.38,
        "atkDown": 0.27
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "audit_raider",
    "name": "Audit Raider",
    "faction": "sec",
    "description": "Ransacks books at dawn.",
    "role": "offense",
    "costShares": 121,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 2
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "rulebook_slasher",
    "name": "Rulebook Slasher",
    "faction": "sec",
    "description": "Weaponized footnotes.",
    "role": "offense",
    "costShares": 116,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 2
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "forensic_raider",
    "name": "Forensic Raider",
    "faction": "sec",
    "description": "Finds ghosts in ledgers.",
    "role": "control",
    "costShares": 127,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "injunction_captain",
    "name": "Injunction Captain",
    "faction": "sec",
    "description": "Frontline taunt that feeds prosecutor pressure.",
    "role": "defense",
    "costShares": 126,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "prosecutor",
      "reach"
    ],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.32,
        "exposed": 0.13,
        "atkDown": 0.24
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "probation_hunter",
    "name": "Probation Hunter",
    "faction": "sec",
    "description": "Tracks dirty repeat offenders.",
    "role": "offense",
    "costShares": 123,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "freeze_order_knight",
    "name": "Freeze Order Knight",
    "faction": "sec",
    "description": "Assets frozen, feelings too.",
    "role": "offense",
    "costShares": 134,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 5
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.24
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "federal_receiver",
    "name": "Federal Receiver",
    "faction": "sec",
    "description": "Confiscates tempo by existing heavily.",
    "role": "defense",
    "costShares": 144,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 8
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.42,
        "atkDown": 0.21
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "compliance_clerk",
    "name": "Compliance Clerk",
    "faction": "sec",
    "kind": "unit",
    "description": "Backline prosecutor support that patches up allies, clears debuffs, and still carries the whole Judge green paperwork stack.",
    "role": "support",
    "costShares": 90,
    "lane": "back",
    "stats": {
      "attack": 1,
      "health": 4
    },
    "keywords": [
      "prosecutor",
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.24,
        "atkDown": 0.14
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          },
          {
            "kind": "cleanse",
            "target": "ally",
            "statuses": [
              "stun",
              "exposed"
            ]
          }
        ],
        "note": "Legacy parity: targets a damaged ally when possible."
      },
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          },
          {
            "kind": "cleanse",
            "target": "ally",
            "statuses": [
              "stun",
              "exposed"
            ]
          }
        ],
        "note": "Legacy parity: repeats on a damaged ally when possible."
      }
    ]
  },
  {
    "id": "civic_auditor",
    "name": "Civic Auditor",
    "faction": "sec",
    "description": "Audit pressure from backline.",
    "role": "support",
    "costShares": 110,
    "impactTargetRule": "none",
    "mechanicsSummary": "Start of your turn (up to 2 auditors): enemy -25 shares and +1 probation. Judge green: legal fee 19+atk*3 (you keep 45%); apply temporary -1 attack; support: grant 1 shield to an ally. Judge petition action: apply temporary -1 attack + ready one ally to attack now. Resistance: exposed 26% · atk-down 14%.",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "prosecutor",
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.26,
        "atkDown": 0.14
      }
    ],
    "triggers": []
  },
  {
    "id": "whistleblower_intern",
    "name": "Whistleblower Intern",
    "faction": "sec",
    "description": "Anonymous tip machine.",
    "role": "support",
    "costShares": 96,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 1,
      "health": 3
    },
    "keywords": [
      "prosecutor",
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.24
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "risk_examiner",
    "name": "Risk Examiner",
    "faction": "sec",
    "description": "Checks VaR and vibes.",
    "role": "support",
    "costShares": 104,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "reach"
    ],    
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.17
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "surveillance_marksman",
    "name": "Surveillance Marksman",
    "faction": "sec",
    "description": "Finds spoofers across the tape.",
    "role": "support",
    "costShares": 112,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "ranged",
      "prosecutor"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.26
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "filing_archivist",
    "name": "Filing Archivist",
    "faction": "sec",
    "description": "Buffs morale with binders.",
    "role": "support",
    "costShares": 98,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 1,
      "health": 5
    },
    "keywords": [
      "ranged",
      "rush"
    ],    
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.14,
        "exposed": 0.16,
        "atkDown": 0.12
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "market_referee",
    "name": "Market Referee",
    "faction": "sec",
    "description": "Blows whistle on spoofing.",
    "role": "support",
    "costShares": 112,
    "impactTargetRule": "none",
    "mechanicsSummary": "On summon: stuns random dirty enemy. Judge green: legal fee 22+atk*3 (you keep 50%); deal 1 sanction damage; support: grant 1 shield to an ally, +1 enemy probation. Judge petition action: stun strongest target + grant 1 shield to an ally. Flip: deploy onto an occupied friendly slot for +25% cost. Displaced ally returns to hand (burns if full). Resistance: exposed 21% · atk-down 12%.",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "negotiator",
      "flip",
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.21,
        "atkDown": 0.12
      }
    ],
    "triggers": []
  },
  {
    "id": "policy_scribe",
    "name": "Policy Scribe",
    "faction": "sec",
    "description": "Writes laws no one reads.",
    "role": "support",
    "costShares": 102,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "ranged"
    ],    
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.19
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "court_observer",
    "name": "Court Observer",
    "faction": "sec",
    "description": "Takes notes, takes souls.",
    "role": "support",
    "costShares": 106,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "ranged",
      "prosecutor"
    ],    
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.27,
        "atkDown": 0.14
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "consent_decree_agent",
    "name": "Consent Decree Agent",
    "faction": "sec",
    "description": "Settles with scary smile.",
    "role": "support",
    "costShares": 111,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "ranged",
      "negotiator"

    ],    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.21
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "integrity_analyst",
    "name": "Integrity Analyst",
    "faction": "sec",
    "description": "Counts red flags per minute.",
    "role": "support",
    "costShares": 107,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "ranged",
      "flip"
    ],    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "source_survived"
        ],
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 18
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "legal_firewall",
    "name": "Legal Firewall",
    "faction": "sec",
    "description": "Friendly unit +1 HP.",
    "role": "utility",
    "costShares": 70,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +1 max HP, heal 1, and add 1 shield.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "due_process_order",
    "name": "Due Process Order",
    "faction": "sec",
    "description": "Fortify unit and reduce probation.",
    "role": "utility",
    "costShares": 95,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +2 max HP, heal 2, add 1 shield, and remove 1 probation.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "disclosure_dump",
    "name": "Disclosure Dump",
    "faction": "sec",
    "description": "Flood market with filings.",
    "role": "utility",
    "costShares": 85,
    "impactTargetRule": "none",
    "mechanicsSummary": "Enemy loses up to 90 shares, gains 1 probation; you gain 1 favor.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "fine_schedule",
    "name": "Fine Schedule",
    "faction": "sec",
    "description": "Fee menu nobody likes.",
    "role": "utility",
    "costShares": 90,
    "impactTargetRule": "enemy-unit",
    "mechanicsSummary": "Choose enemy unit: -2 attack, stun for one turn cycle, and enemy loses 60 shares.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "circuit_breaker_act",
    "name": "Circuit Breaker Act",
    "faction": "sec",
    "description": "Slow down the chaos.",
    "role": "utility",
    "costShares": 100,
    "impactTargetRule": "none",
    "mechanicsSummary": "Stun all enemy front-row units for one turn cycle.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "queue_guard_junior",
    "name": "Queue Guard Junior",
    "faction": "market_makers",
    "description": "Cheap depth sponge for thin books.",
    "role": "defense",
    "costShares": 109,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.26,
        "atkDown": 0.19
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "market_arbiter",
    "name": "Market Arbiter",
    "faction": "market_makers",
    "description": "Negotiator marksman.",
    "role": "support",
    "costShares": 115,
    "impactTargetRule": "none",
    "mechanicsSummary": "On summon in back row: +1 attack. After each attack: gain shares equal to atk x10 (max 30). Judge green: legal fee 13+atk*4 (you keep 55%); stun strongest target; support: ready one ally to attack now, +1 enemy probation. Judge petition action: apply temporary -1 attack + grant 1 shield to an ally. Flip: deploy onto an occupied friendly slot for +25% cost. Displaced ally returns to hand (burns if full). Resistance: exposed 32%.",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "ranged",
      "negotiator",
      "flip"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.32
      }
    ],
    "triggers": []
  },
  {
    "id": "spread_sniper",
    "name": "Spread Sniper",
    "faction": "market_makers",
    "kind": "unit",
    "description": "Backline marksman that tags targets with Exposed and lets the desk trade around the weakness.",
    "role": "control",
    "costShares": 120,
    "lane": "back",
    "stats": {
      "attack": 3,
      "health": 3
    },
    "keywords": [
      "ranged"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.23
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Explicit runtime skill parity."
      }
    ]
  },
  {
    "id": "volatility_clerk",
    "name": "Volatility Clerk",
    "faction": "market_makers",
    "description": "Stable anchor under swings.",
    "role": "offense",
    "costShares": 105,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "orderflow_scout",
    "name": "Orderflow Scout",
    "faction": "market_makers",
    "description": "Cheap tempo scout.",
    "role": "offense",
    "costShares": 95,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "latency_lancer",
    "name": "Latency Lancer",
    "faction": "market_makers",
    "description": "Shaves milliseconds and HP.",
    "role": "offense",
    "costShares": 118,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 2
    },
    "keywords": [
      "flip"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "quote_stacker",
    "name": "Quote Stacker",
    "faction": "market_makers",
    "description": "Builds walls of orders.",
    "role": "offense",
    "costShares": 122,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "arb_tactician",
    "name": "Arb Tactician",
    "faction": "market_makers",
    "description": "Finds spread, applies pressure.",
    "role": "control",
    "costShares": 124,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "darkpool_hunter",
    "name": "Darkpool Hunter",
    "faction": "market_makers",
    "description": "Lights up hidden liquidity.",
    "role": "offense",
    "costShares": 127,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.12
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "match_engine_rider",
    "name": "Match Engine Rider",
    "faction": "market_makers",
    "description": "Clears queues violently.",
    "role": "offense",
    "costShares": 129,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 20
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "book_depth_guard",
    "name": "Book Depth Guard",
    "faction": "market_makers",
    "description": "Thick book, thick armor.",
    "role": "defense",
    "costShares": 121,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 5
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.37,
        "atkDown": 0.22
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "halt_auction_warden",
    "name": "Halt Auction Warden",
    "faction": "market_makers",
    "description": "Taunts first, reprices the fight after.",
    "role": "defense",
    "costShares": 124,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "negotiator",
      "flip"
    ],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.29,
        "exposed": 0.13,
        "atkDown": 0.21
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 15
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "auction_breaker",
    "name": "Auction Breaker",
    "faction": "market_makers",
    "description": "Opens with fireworks.",
    "role": "offense",
    "costShares": 126,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.12
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "midpoint_raider",
    "name": "Midpoint Raider",
    "faction": "market_makers",
    "description": "Steals pennies, wins wars.",
    "role": "offense",
    "costShares": 117,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "gamma_sweeper",
    "name": "Gamma Sweeper",
    "faction": "market_makers",
    "description": "Options pain specialist.",
    "role": "offense",
    "costShares": 133,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 4,
      "health": 4
    },
    "keywords": [
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.14
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "quote_blitz",
    "name": "Quote Blitz",
    "faction": "market_makers",
    "description": "Spoofs your patience.",
    "role": "offense",
    "costShares": 116,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 2
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.12
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "liquidity_duelist",
    "name": "Liquidity Duelist",
    "faction": "market_makers",
    "description": "1v1 with a price ladder.",
    "role": "offense",
    "costShares": 128,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "liquidity_bulkhead",
    "name": "Liquidity Bulkhead",
    "faction": "market_makers",
    "description": "When spreads widen, this stays.",
    "role": "defense",
    "costShares": 142,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 8
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.36,
        "atkDown": 0.21
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "settlement_liaison",
    "name": "Settlement Liaison",
    "faction": "market_makers",
    "description": "Negotiates in the Judge lane.",
    "role": "support",
    "costShares": 108,
    "impactTargetRule": "none",
    "mechanicsSummary": "Support anchor with healing and favor upkeep. Judge green: legal fee 10+atk*4 (you keep 55%); apply Exposed; support: heal weakest ally by 1. Judge petition action: deal 1 sanction damage + ready one ally to attack now. Resistance: exposed 32% · atk-down 15%.",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "negotiator",
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.32,
        "atkDown": 0.15
      }
    ],
    "triggers": []
  },
  {
    "id": "sweep_router",
    "name": "Sweep Router",
    "faction": "market_makers",
    "description": "Routes pressure into hidden liquidity.",
    "role": "support",
    "costShares": 113,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "ranged"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.23
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "source_survived"
        ],
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "clearing_router",
    "name": "Clearing Router",
    "faction": "market_makers",
    "description": "Routes risk to someone else.",
    "role": "support",
    "costShares": 131,
    "impactTargetRule": "none",
    "mechanicsSummary": "On summon and start of your turn: cleanses stun/exposed from a friendly unit. Resistance: exposed 22%.",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    
    "keywords": [
      "ranged",
      "rush"
    ],    
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.22
      }
    ],
    "triggers": []
  },
  {
    "id": "imbalance_reader",
    "name": "Imbalance Reader",
    "faction": "market_makers",
    "description": "Sees open-close rituals. Heals.",
    "role": "support",
    "costShares": 103,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "reach",
      "rush"
    ],     "specials": [
      {
        "kind": "resistance",
        "exposed": 0.22
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "delta_keeper",
    "name": "Delta Keeper",
    "faction": "market_makers",
    "description": "Hedges until it hurts.",
    "role": "support",
    "costShares": 106,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "reach"
    ],     "specials": [
      {
        "kind": "resistance",
        "exposed": 0.21
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "variance_curator",
    "name": "Variance Curator",
    "faction": "market_makers",
    "description": "Sells calm at premium.",
    "role": "support",
    "costShares": 110,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "negotiator",
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.28
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "execution_auditor",
    "name": "Execution Auditor",
    "faction": "market_makers",
    "description": "Best execution, best sarcasm.",
    "role": "support",
    "costShares": 144,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 1,
      "health": 5
    },
    "keywords": [
      "ranged",
      "rush"
    ],     
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.12,
        "exposed": 0.2,
        "atkDown": 0.15
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "tape_listener",
    "name": "Tape Listener",
    "faction": "market_makers",
    "description": "Heard every whisper trade.",
    "role": "support",
    "costShares": 98,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 1,
      "health": 4
    },
    "keywords": [
      "reach"
    ],     
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.18
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "auction_clerk",
    "name": "Auction Clerk",
    "faction": "market_makers",
    "description": "Controls opening bell mood.",
    "role": "support",
    "costShares": 100,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": ["ranged"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.22
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "vol_surface_monk",
    "name": "Vol Surface Monk",
    "faction": "market_makers",
    "description": "Meditates on skew.",
    "role": "support",
    "costShares": 109,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": ["ranged"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.21
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 15
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "tick_mediator",
    "name": "Tick Mediator",
    "faction": "market_makers",
    "description": "One-tick peace treaty.",
    "role": "support",
    "costShares": 107,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "negotiator", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.32,
        "atkDown": 0.15
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "rebate_harvest",
    "name": "Rebate Harvest",
    "faction": "market_makers",
    "description": "Collects maker rebates.",
    "role": "utility",
    "costShares": 85,
    "impactTargetRule": "none",
    "mechanicsSummary": "Gain 30-110 shares (scales with your Market-Makers in back row).",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "latency_patch",
    "name": "Latency Patch",
    "faction": "market_makers",
    "description": "Low-latency buff package.",
    "role": "utility",
    "costShares": 90,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +1 attack, heal 1, and clear stun.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "cross_venue_sync",
    "name": "Cross Venue Sync",
    "faction": "market_makers",
    "description": "Links fragmented books.",
    "role": "utility",
    "costShares": 95,
    "impactTargetRule": "none",
    "mechanicsSummary": "Gain +70 shares and draw 1 card.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "maker_incentive",
    "name": "Maker Incentive",
    "faction": "market_makers",
    "description": "Pays for tighter spreads.",
    "role": "utility",
    "costShares": 92,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +1 attack and +1 shield.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "queue_priority",
    "name": "Queue Priority",
    "faction": "market_makers",
    "description": "Front-runs with paperwork.",
    "role": "utility",
    "costShares": 98,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +1 attack and make it ready to attack immediately.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "compliance_doorman_ws",
    "name": "Compliance Doorman",
    "faction": "wallstreet",
    "description": "Smiles, stalls, and soaks damage.",
    "role": "defense",
    "costShares": 110,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.32,
        "atkDown": 0.16
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "clearing_knight",
    "name": "Clearing Knight",
    "faction": "wallstreet",
    "description": "Reach into backline.",
    "role": "offense",
    "costShares": 140,
    "impactTargetRule": "none",
    "mechanicsSummary": "On summon with another Wallstreet frontliner: +1 attack and +1 shield. On kill: +1 attack. Resistance: exposed 13%.",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 4,
      "health": 4
    },
    "keywords": [
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.13
      }
    ],
    "triggers": []
  },
  {
    "id": "floor_mediator",
    "name": "Floor Mediator",
    "faction": "wallstreet",
    "description": "Judge envoy in frontline.",
    "role": "offense",
    "costShares": 125,
    "impactTargetRule": "none",
    "mechanicsSummary": "If in Judge green slot at start of your turn: Judge mood improves and enemy favor -1. Judge green: legal fee 10+atk*4 (you keep 45%); apply temporary -1 attack; support: grant 1 shield to an ally. Judge petition action: deal 1 sanction damage + ready one ally to attack now. Resistance: stun 12% · atk-down 15%.",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "negotiator"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.12,
        "atkDown": 0.15
      }
    ],
    "triggers": []
  },
  {
    "id": "blue_chip_raider",
    "name": "Blue Chip Raider",
    "faction": "wallstreet",
    "description": "High pressure bruiser.",
    "role": "offense",
    "costShares": 135,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "deal_desk_titan",
    "name": "Deal Desk Titan",
    "faction": "wallstreet",
    "description": "Carries M&A in briefcase.",
    "role": "offense",
    "costShares": 138,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 4,
      "health": 5
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.18,
        "atkDown": 0.18
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "roadshow_blade",
    "name": "Roadshow Blade",
    "faction": "wallstreet",
    "description": "Pitches and stabs.",
    "role": "offense",
    "costShares": 122,
    "impactTargetRule": "none",
    "mechanicsSummary": "Rush. With 3+ Wallstreet units on summon: gains +1 attack. Flip: deploy onto an occupied friendly slot for +25% cost. Displaced ally returns to hand (burns if full). Resistance: atk-down 16%.",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 2
    },
    "keywords": [
      "rush",
      "flip"
    ],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.16
      }
    ],
    "triggers": []
  },
  {
    "id": "ipo_ram",
    "name": "IPO Ram",
    "faction": "wallstreet",
    "description": "Smashes through listing day.",
    "role": "offense",
    "costShares": 130,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.15
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "syndicate_baron",
    "name": "Syndicate Baron",
    "faction": "wallstreet",
    "description": "Owns half the order book.",
    "role": "defense",
    "costShares": 132,
    "impactTargetRule": "none",
    "mechanicsSummary": "Start of your turn in front row: +20 shares. Resistance: stun 35% · atk-down 25%.",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 5
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.35,
        "atkDown": 0.25
      }
    ],
    "triggers": []
  },
  {
    "id": "poison_pill_chair",
    "name": "Poison Pill Chair",
    "faction": "wallstreet",
    "description": "Taunt plus boardroom leverage package.",
    "role": "defense",
    "costShares": 128,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 5
    },
    "keywords": [
      "negotiator",
      "flip"
    ],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.4,
        "atkDown": 0.34
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "bonus_chaser",
    "name": "Bonus Chaser",
    "faction": "wallstreet",
    "description": "Compensation-driven warfare.",
    "role": "offense",
    "costShares": 116,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 2
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "derivative_spear",
    "name": "Derivative Spear",
    "faction": "wallstreet",
    "description": "Leverage in pointy form.",
    "role": "offense",
    "costShares": 127,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "prime_broker_brawler",
    "name": "Prime Broker Brawler",
    "faction": "wallstreet",
    "description": "Margin calls with fists.",
    "role": "offense",
    "costShares": 134,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 5
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.19,
        "atkDown": 0.15
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "credit_raider",
    "name": "Credit Raider",
    "faction": "wallstreet",
    "description": "Refinances your HP away.",
    "role": "offense",
    "costShares": 124,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "merger_hunter",
    "name": "Merger Hunter",
    "faction": "wallstreet",
    "description": "Always searching for synergies.",
    "role": "offense",
    "costShares": 129,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.12
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "balance_sheet_ogre",
    "name": "Balance Sheet Ogre",
    "faction": "wallstreet",
    "description": "Thick assets, thicker skull.",
    "role": "defense",
    "costShares": 136,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 6
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.37,
        "atkDown": 0.3
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "capital_adequacy_titan",
    "name": "Capital Adequacy Titan",
    "faction": "wallstreet",
    "description": "Regulatory capital made flesh.",
    "role": "defense",
    "costShares": 146,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 8
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.4,
        "atkDown": 0.27
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "turnaround_slasher",
    "name": "Turnaround Slasher",
    "faction": "wallstreet",
    "description": "Cuts costs and throats.",
    "role": "offense",
    "costShares": 121,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.15
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "dealbook_lancer",
    "name": "Dealbook Lancer",
    "faction": "wallstreet",
    "description": "Finds the soft target in page 417.",
    "role": "control",
    "costShares": 114,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 3
    },
    "keywords": [
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 15
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "staircase_bidder",
    "name": "Staircase Bidder",
    "faction": "wallstreet",
    "description": "Walks price up with swagger.",
    "role": "offense",
    "costShares": 123,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 20
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "public_defender",
    "name": "Public Defender",
    "faction": "wallstreet",
    "kind": "unit",
    "description": "Durable backline counsel that shields the desk on entry, patches the leader each turn, and keeps premium Judge green support pressure online.",
    "role": "support",
    "costShares": 120,
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 5
    },
    "keywords": [
      "ranged",
      "negotiator"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.23,
        "atkDown": 0.23
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 1
          },
          {
            "kind": "gain_shield",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy parity: ally shield target is chosen by runtime."
      },
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "heal",
            "target": "leader",
            "amount": 1
          },
          {
            "kind": "cleanse",
            "target": "ally",
            "statuses": [
              "stun"
            ]
          }
        ],
        "note": "Legacy parity: cleanse is conditional on a valid stunned ally."
      }
    ]
  },
  {
    "id": "investor_relations_chief",
    "name": "Investor Relations Chief",
    "faction": "wallstreet",
    "description": "Guidance magician.",
    "role": "support",
    "costShares": 108,
    "impactTargetRule": "none",
    "mechanicsSummary": "On summon: +35 shares (and +1 favor with 3+ Wallstreet units). Start of your turn: passive share income. Judge green: legal fee 19+atk*4 (you keep 55%); stun strongest target; support: grant 1 shield to an ally, +1 enemy probation. Judge petition action: apply Exposed + heal weakest ally by 1. Resistance: exposed 24% · atk-down 14%.",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "negotiator", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.24,
        "atkDown": 0.14
      }
    ],
    "triggers": []
  },
  {
    "id": "risk_modeler",
    "name": "Risk Modeler",
    "faction": "wallstreet",
    "description": "Gaussian until it breaks.",
    "role": "support",
    "costShares": 134,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": ["ranged", "rush"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.2
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "compliance_liaison_ws",
    "name": "Compliance Liaison",
    "faction": "wallstreet",
    "description": "Says no with a smile.",
    "role": "support",
    "costShares": 103,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 1,
      "health": 5
    },
    "keywords": ["reach", "rush"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.14,
        "atkDown": 0.18
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "debt_structurer",
    "name": "Debt Structurer",
    "faction": "wallstreet",
    "description": "Turns pain into tranches.",
    "role": "support",
    "costShares": 109,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": ["reach"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.15
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "research_hawk",
    "name": "Research Hawk",
    "faction": "wallstreet",
    "description": "Downgrades your hope.",
    "role": "support",
    "costShares": 101,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "ranged"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.15
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "quant_whisperer",
    "name": "Quant Whisperer",
    "faction": "wallstreet",
    "description": "Backtests your destiny.",
    "role": "support",
    "costShares": 107,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.19
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "boardroom_negotiator",
    "name": "Boardroom Negotiator",
    "faction": "wallstreet",
    "description": "Settles over expensive water.",
    "role": "support",
    "costShares": 110,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "negotiator",
      "flip", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.25,
        "atkDown": 0.15
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "source_survived"
        ],
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "governance_warden",
    "name": "Governance Warden",
    "faction": "wallstreet",
    "description": "Committee-powered support.",
    "role": "support",
    "costShares": 106,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": ["reach"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.17
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "deal_paralegal",
    "name": "Deal Paralegal",
    "faction": "wallstreet",
    "description": "Carries 900 pages and a dream.",
    "role": "support",
    "costShares": 100,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 1,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.15
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "buyback_authorization",
    "name": "Buyback Authorization",
    "faction": "wallstreet",
    "description": "Engineering value, allegedly.",
    "role": "utility",
    "costShares": 95,
    "impactTargetRule": "none",
    "mechanicsSummary": "Gain +130 shares and heal your leader for 2.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "earnings_guidance_spin",
    "name": "Earnings Guidance Spin",
    "faction": "wallstreet",
    "description": "Narrative over numbers.",
    "role": "utility",
    "costShares": 90,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +2 attack. You lose 1 favor.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "covenant_flex",
    "name": "Covenant Flex",
    "faction": "wallstreet",
    "description": "Contract says maybe.",
    "role": "utility",
    "costShares": 96,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +2 max HP, heal 2, and add 1 shield.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "roadshow_hype",
    "name": "Roadshow Hype",
    "faction": "wallstreet",
    "description": "Slides with unrealistic TAM.",
    "role": "utility",
    "costShares": 88,
    "impactTargetRule": "none",
    "mechanicsSummary": "Gain 70-180 shares (scales with your Wallstreet units).",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "liquidity_window",
    "name": "Liquidity Window",
    "faction": "wallstreet",
    "description": "Opens when insiders need exits.",
    "role": "utility",
    "costShares": 92,
    "impactTargetRule": "none",
    "mechanicsSummary": "Gain +90 shares and draw 1 card.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "banner_holder",
    "name": "Banner Holder",
    "faction": "retail_mob",
    "description": "Cheap frontline taunt for the crowd.",
    "role": "defense",
    "costShares": 106,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.3,
        "atkDown": 0.15
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "retail_rebel",
    "name": "Retail Rebel",
    "faction": "retail_mob",
    "description": "Reliable crowd fighter.",
    "role": "offense",
    "costShares": 100,
    "impactTargetRule": "none",
    "mechanicsSummary": "Start of your turn while outnumbered: gains +1 attack. Resistance: atk-down 13%.",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": []
  },
  {
    "id": "diamond_hand_captain",
    "name": "Diamond Hand Captain",
    "faction": "retail_mob",
    "description": "Tanky captain for pushes.",
    "role": "offense",
    "costShares": 125,
    "impactTargetRule": "none",
    "mechanicsSummary": "On summon: gains 1 shield and grants 1 shield to a random retail ally. Resistance: stun 20%.",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 5
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.2
      }
    ],
    "triggers": []
  },
  {
    "id": "meme_berserker",
    "name": "Meme Berserker",
    "faction": "retail_mob",
    "description": "Glass-cannon meme charge.",
    "role": "offense",
    "costShares": 115,
    "impactTargetRule": "none",
    "mechanicsSummary": "If outnumbered on summon: +1 attack. After each combat survived: +1 attack. Resistance: exposed 13%.",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 2
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.13
      }
    ],
    "triggers": []
  },
  {
    "id": "picket_marshal",
    "name": "Picket Marshal",
    "faction": "retail_mob",
    "kind": "unit",
    "description": "Retail frontline wall that taunts traffic and self-cleanses to keep the protest line standing.",
    "role": "defense",
    "costShares": 110,
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 5
    },
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.4,
        "atkDown": 0.26
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (turn-cleanse)."
      }
    ]
  },
  {
    "id": "diamond_chant_captain",
    "name": "Diamond Chant Captain",
    "faction": "retail_mob",
    "description": "Taunts first, swings harder on crowd momentum.",
    "role": "defense",
    "costShares": 123,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "flip"
    ],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.34,
        "atkDown": 0.14
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "stonk_charger",
    "name": "Stonk Charger",
    "faction": "retail_mob",
    "kind": "unit",
    "description": "Rocket emojis train that can swing immediately and spear the backline before the candles cool.",
    "role": "offense",
    "costShares": 163,
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 2
    },
    "keywords": [
      "rush",
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity (combat-expose)."
      }
    ]
  },
  {
    "id": "bagholder_tank",
    "name": "Bagholder Tank",
    "faction": "retail_mob",
    "description": "Heavy bags, heavy armor.",
    "role": "defense",
    "costShares": 128,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 6
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.36,
        "atkDown": 0.21
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "yolo_striker",
    "name": "YOLO Striker",
    "faction": "retail_mob",
    "description": "No thesis, only conviction.",
    "role": "offense",
    "costShares": 119,
    "impactTargetRule": "none",
    "mechanicsSummary": "Rush. If outnumbered on summon: gains 1 shield. Resistance: stun 13%.",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [
      "rush"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": []
  },
  {
    "id": "gamma_ape",
    "name": "Gamma Ape",
    "faction": "retail_mob",
    "description": "Powered by OTM calls.",
    "role": "offense",
    "costShares": 131,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 4,
      "health": 4
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "dip_buyer",
    "name": "Dip Buyer",
    "faction": "retail_mob",
    "description": "Buys every red candle.",
    "role": "offense",
    "costShares": 117,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 20
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "thread_warrior",
    "name": "Thread Warrior",
    "faction": "retail_mob",
    "description": "Wins arguments, then fights.",
    "role": "offense",
    "costShares": 116,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "flip"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "diamond_pikeman",
    "name": "Diamond Pikeman",
    "faction": "retail_mob",
    "description": "Pierces FUD.",
    "role": "control",
    "costShares": 122,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 20
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "laser_pointer_ape",
    "name": "Laser Pointer Ape",
    "faction": "retail_mob",
    "description": "Calls targets for the whole subreddit.",
    "role": "support",
    "costShares": 113,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "ranged"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.2
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 20
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "bullhorn_raider",
    "name": "Bullhorn Raider",
    "faction": "retail_mob",
    "description": "Loud alpha delivery.",
    "role": "offense",
    "costShares": 121,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "options_gladiator",
    "name": "Options Gladiator",
    "faction": "retail_mob",
    "description": "Expires ITM in spirit.",
    "role": "offense",
    "costShares": 127,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "volatile_knuckle",
    "name": "Volatile Knuckle",
    "faction": "retail_mob",
    "description": "One candle maniac.",
    "role": "offense",
    "costShares": 114,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 2
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "ape_phalanx",
    "name": "Ape Phalanx",
    "faction": "retail_mob",
    "description": "Collective stubborn wall.",
    "role": "offense",
    "costShares": 130,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 5
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.24,
        "atkDown": 0.12
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "diamond_barricade",
    "name": "Diamond Barricade",
    "faction": "retail_mob",
    "description": "A wall built from conviction and screenshots.",
    "role": "defense",
    "costShares": 142,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 8
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.4,
        "atkDown": 0.2
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "union_negotiator",
    "name": "Union Negotiator",
    "faction": "retail_mob",
    "description": "Represents the crowd before the Judge.",
    "role": "support",
    "costShares": 112,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "negotiator",
      "flip", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.28,
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 20
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "streaming_analyst",
    "name": "Streaming Analyst",
    "faction": "retail_mob",
    "description": "TA with rainbow lines.",
    "role": "support",
    "costShares": 102,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": ["ranged", "rush"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.2
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "discord_moderator",
    "name": "Discord Moderator",
    "faction": "retail_mob",
    "description": "Bans bots, spawns morale.",
    "role": "support",
    "costShares": 99,
    "impactTargetRule": "none",
    "mechanicsSummary": "Role: bureaucrat. Faction passive: Retail spikes in comeback states and can trigger backlash on deaths. Resistance: stun 14% · exposed 19% · atk-down 12%.",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 1,
      "health": 5
    },
    "keywords": ["reach"],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.14,
        "exposed": 0.19,
        "atkDown": 0.12
      }
    ],
    "triggers": []
  },
  {
    "id": "pollster_pro",
    "name": "Pollster Pro",
    "faction": "retail_mob",
    "description": "Sentiment as a service.",
    "role": "support",
    "costShares": 100,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": ["ranged"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.17
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "source_survived"
        ],
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "meme_editor",
    "name": "Meme Editor",
    "faction": "retail_mob",
    "description": "Buffs unit with crop and caption.",
    "role": "support",
    "costShares": 98,
    "impactTargetRule": "none",
    "mechanicsSummary": "On summon and start of your turn: cleanses ally debuffs and grants +1 attack. Resistance: exposed 16%.",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 1,
      "health": 4
    },
    "keywords": ["ranged"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.16
      }
    ],
    "triggers": []
  },
  {
    "id": "data_scraper",
    "name": "Data Scraper",
    "faction": "retail_mob",
    "description": "Collects public breadcrumbs.",
    "role": "support",
    "costShares": 103,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "ranged"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.17
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "floor_chatter",
    "name": "Floor Chatter",
    "faction": "retail_mob",
    "description": "Rumor turbocharger.",
    "role": "support",
    "costShares": 97,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": ["reach"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.15
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "petition_writer",
    "name": "Petition Writer",
    "faction": "retail_mob",
    "description": "Polite pressure specialist.",
    "role": "support",
    "costShares": 105,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "negotiator", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.29,
        "atkDown": 0.12
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "community_steward",
    "name": "Community Steward",
    "faction": "retail_mob",
    "description": "Keeps retail line together.",
    "role": "support",
    "costShares": 106,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": ["reach"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.18
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 15
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "fact_checker_ape",
    "name": "Fact Checker Ape",
    "faction": "retail_mob",
    "description": "Actually reads filings.",
    "role": "support",
    "costShares": 108,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": ["ranged"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.2
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "diamond_hands_oath",
    "name": "Diamond Hands Oath",
    "faction": "retail_mob",
    "description": "Commit to hold through chaos.",
    "role": "utility",
    "costShares": 88,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +1 attack, +1 max HP, heal 1, and add 1 shield.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "reddit_raid_plan",
    "name": "Reddit Raid Plan",
    "faction": "retail_mob",
    "description": "Coordinated meme strike.",
    "role": "utility",
    "costShares": 92,
    "impactTargetRule": "none",
    "mechanicsSummary": "Deal 1 damage to all enemy units.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "rocket_fuel",
    "name": "Rocket Fuel",
    "faction": "retail_mob",
    "description": "Adds pure hype pressure.",
    "role": "utility",
    "costShares": 95,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +2 attack. If it has 2 HP or less, add 1 shield.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "banana_fund",
    "name": "Banana Fund",
    "faction": "retail_mob",
    "description": "Nutrition for sustained yolo.",
    "role": "utility",
    "costShares": 84,
    "impactTargetRule": "none",
    "mechanicsSummary": "Heal all friendly units by 1 and gain +50 shares.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "crowd_shield",
    "name": "Crowd Shield",
    "faction": "retail_mob",
    "description": "Human wall of small lots.",
    "role": "utility",
    "costShares": 90,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: add 2 shield.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "compliance_scapegoat",
    "name": "Compliance Scapegoat",
    "faction": "short_hedgefund",
    "description": "Disposable taunt with a legal-looking tie.",
    "role": "defense",
    "costShares": 107,
    "impactTargetRule": "none",
    "dirtyPower": 1,
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.35,
        "exposed": 0.16,
        "atkDown": 0.14
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "short_syndicate_runner",
    "name": "Short Syndicate Runner",
    "faction": "short_hedgefund",
    "description": "Dirty runner.",
    "role": "control",
    "costShares": 105,
    "impactTargetRule": "none",
    "dirtyPower": 1,
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 2
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.21
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 20
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "shadow_broker",
    "name": "Shadow Broker",
    "faction": "short_hedgefund",
    "kind": "unit",
    "description": "Dirty backline operator that skims shares on contact, manipulates pressure lanes, and doubles as a Judge blue profiteer.",
    "role": "control",
    "costShares": 115,
    "dirtyPower": 1,
    "lane": "back",
    "stats": {
      "attack": 3,
      "health": 3
    },
    "keywords": [
      "dirty",
      "ranged"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.33
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "source_survived"
        ],
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 14
          }
        ],
        "note": "Legacy fallback signature parity (combat-fee)."
      }
    ]
  },
  {
    "id": "bribe_courier",
    "name": "Bribe Courier",
    "faction": "short_hedgefund",
    "description": "Judge corruption specialist.",
    "role": "control",
    "costShares": 100,
    "impactTargetRule": "none",
    "mechanicsSummary": "Corruption runner that amplifies Judge blue pressure. Judge blue: skim 24+atk*4 (you keep 70%); stun strongest target; rider: enemy probation +1. Judge bribe action: stun strongest target plus rider. Resistance: exposed 18%.",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.18
      }
    ],
    "triggers": []
  },
  {
    "id": "whisper_lobbyist",
    "name": "Whisper Lobbyist",
    "faction": "short_hedgefund",
    "description": "Reach dirty pressure.",
    "role": "control",
    "costShares": 120,
    "impactTargetRule": "none",
    "mechanicsSummary": "On hit: applies Exposed to target. Judge blue: skim 24+atk*3 (you keep 65%); stun strongest target; rider: enemy favor -1 and probation +1. Judge bribe action: deal 1 sanction damage plus rider. Resistance: stun 12% · exposed 20%.",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "dirty",
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.12,
        "exposed": 0.2
      }
    ],
    "triggers": []
  },
  {
    "id": "synthetic_decoy",
    "name": "Synthetic Decoy",
    "faction": "short_hedgefund",
    "description": "Taunts while the real position moves elsewhere.",
    "role": "defense",
    "costShares": 123,
    "impactTargetRule": "none",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "dirty",
      "flip"
    ],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.34,
        "exposed": 0.21,
        "atkDown": 0.19
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "locate_alchemist",
    "name": "Locate Alchemist",
    "faction": "short_hedgefund",
    "description": "Turns maybe-locates into certainty.",
    "role": "control",
    "costShares": 124,
    "impactTargetRule": "none",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.12,
        "exposed": 0.2
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "borrowed_shield",
    "name": "Borrowed Shield",
    "faction": "short_hedgefund",
    "description": "Borrow now, explain later.",
    "role": "control",
    "costShares": 112,
    "impactTargetRule": "none",
    "dirtyPower": 1,
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 5
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.28,
        "exposed": 0.22
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 15
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "panic_seller_agent",
    "name": "Panic Seller Agent",
    "faction": "short_hedgefund",
    "description": "Spreads urgency professionally.",
    "role": "offense",
    "costShares": 118,
    "impactTargetRule": "none",
    "mechanicsSummary": "Rush. On summon: applies Exposed to random enemy. Judge blue: skim 15+atk*2 (you keep 65%); stun strongest target; rider: enemy favor -1. Judge bribe action: stun strongest target plus rider. Resistance: stun 12% · exposed 17%.",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 2
    },
    "keywords": [
      "rush",
      "dirty"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.12,
        "exposed": 0.17
      }
    ],
    "triggers": []
  },
  {
    "id": "fee_harvester",
    "name": "Fee Harvester",
    "faction": "short_hedgefund",
    "description": "Monetizes borrow pain.",
    "role": "control",
    "costShares": 121,
    "impactTargetRule": "none",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 3
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.12,
        "exposed": 0.19
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "dark_analyst",
    "name": "Dark Analyst",
    "faction": "short_hedgefund",
    "description": "Writes 40-page doom posts.",
    "role": "control",
    "costShares": 116,
    "impactTargetRule": "none",
    "dirtyPower": 1,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 3,
      "health": 3
    },
    "keywords": [
      "dirty", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.34
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "spoof_duelist",
    "name": "Spoof Duelist",
    "faction": "short_hedgefund",
    "description": "Order book mirage fighter.",
    "role": "offense",
    "costShares": 123,
    "impactTargetRule": "none",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [
      "dirty",
      "flip"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.22,
        "atkDown": 0.14
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "source_survived"
        ],
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "narrative_assassin",
    "name": "Narrative Assassin",
    "faction": "short_hedgefund",
    "description": "Kills momentum with one headline.",
    "role": "offense",
    "costShares": 126,
    "impactTargetRule": "none",
    "mechanicsSummary": "On hit: target loses 1 attack. Judge blue: skim 12+atk*4 (you keep 75%); deal 1 sanction damage; rider: enemy probation +1. Judge bribe action: apply temporary -1 attack plus rider. Resistance: exposed 19%.",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 3
    },
    "keywords": [
      "dirty",
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.19
      }
    ],
    "triggers": []
  },
  {
    "id": "panic_knight",
    "name": "Panic Knight",
    "faction": "short_hedgefund",
    "description": "Armored in fear.",
    "role": "control",
    "costShares": 127,
    "impactTargetRule": "none",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.15,
        "exposed": 0.21
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "rehypothecator",
    "name": "Rehypothecator",
    "faction": "short_hedgefund",
    "description": "One share, many owners.",
    "role": "control",
    "costShares": 129,
    "impactTargetRule": "none",
    "mechanicsSummary": "On summon: gains 2 shield, enemy probation +1, own favor -1. Judge blue: skim 18+atk*4 (you keep 65%); apply temporary -1 attack; rider: enemy probation +1. Judge bribe action: apply temporary -1 attack plus rider. Resistance: stun 25% · exposed 19%.",
    "dirtyPower": 3,
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 3,
      "health": 5
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.25,
        "exposed": 0.19
      }
    ],
    "triggers": []
  },
  {
    "id": "collateral_bunker",
    "name": "Collateral Bunker",
    "faction": "short_hedgefund",
    "description": "Fortified by everyone else's collateral.",
    "role": "defense",
    "costShares": 143,
    "impactTargetRule": "none",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 8
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "stun": 0.4,
        "exposed": 0.16,
        "atkDown": 0.23
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "ftd_collector",
    "name": "FTD Collector",
    "faction": "short_hedgefund",
    "description": "Delivers never, demands always.",
    "role": "offense",
    "costShares": 122,
    "impactTargetRule": "none",
    "mechanicsSummary": "On kill: gain +70 shares. Judge blue: skim 21+atk*2 (you keep 70%); apply temporary -1 attack; rider: enemy favor -1 and probation +1. Judge bribe action: apply Exposed plus rider. Resistance: exposed 16%.",
    "dirtyPower": 3,
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 4,
      "health": 2
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.16
      }
    ],
    "triggers": []
  },
  {
    "id": "smirk_veteran",
    "name": "Smirk Veteran",
    "faction": "short_hedgefund",
    "description": "Been wrong for years, still smug.",
    "role": "control",
    "costShares": 120,
    "impactTargetRule": "none",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 4
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.18
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "hit_piece_sniper",
    "name": "Hit Piece Sniper",
    "faction": "short_hedgefund",
    "description": "Backline fear management specialist.",
    "role": "support",
    "costShares": 112,
    "impactTargetRule": "none",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "dirty",
      "ranged"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.31
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "borrow_desk_clerk",
    "name": "Borrow Desk Clerk",
    "faction": "short_hedgefund",
    "description": "Finds lendable shadows.",
    "role": "support",
    "costShares": 101,
    "impactTargetRule": "none",
    "dirtyPower": 1,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "dirty", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.3
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "synthetic_ledger_keeper",
    "name": "Synthetic Ledger Keeper",
    "faction": "short_hedgefund",
    "description": "Adds decimals nobody asked for.",
    "role": "support",
    "costShares": 104,
    "impactTargetRule": "none",
    "dirtyPower": 1,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "dirty", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.35
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "doom_researcher",
    "name": "Doom Researcher",
    "faction": "short_hedgefund",
    "description": "Price target: zero, always.",
    "role": "support",
    "costShares": 106,
    "impactTargetRule": "none",
    "mechanicsSummary": "Role: bureaucrat. Keywords: Dirty (higher Judge catch risk). Faction passive: Short deck siphons via dirty pressure, but worsens Judge mood and own favor over time. Judge blue: skim 12+atk*4 (you keep 70%); stun strongest target; rider: enemy favor -1. Judge bribe action: apply temporary -1 attack plus rider. Resistance: exposed 32%.",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "dirty", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.32
      }
    ],
    "triggers": []
  },
  {
    "id": "options_grinder",
    "name": "Options Grinder",
    "faction": "short_hedgefund",
    "description": "Bleeds theta and opponents.",
    "role": "support",
    "costShares": 107,
    "impactTargetRule": "none",
    "dirtyPower": 1,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "dirty", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.33
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "swap_architect",
    "name": "Swap Architect",
    "faction": "short_hedgefund",
    "description": "Exposure hidden in plain sight.",
    "role": "support",
    "costShares": 110,
    "impactTargetRule": "none",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "dirty", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.31
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "darkpool_accountant",
    "name": "Darkpool Accountant",
    "faction": "short_hedgefund",
    "description": "Reconciles invisible prints.",
    "role": "support",
    "costShares": 102,
    "impactTargetRule": "none",
    "dirtyPower": 1,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 1,
      "health": 5
    },
    "keywords": [
      "dirty", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.16,
        "exposed": 0.31
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "media_handler",
    "name": "Media Handler",
    "faction": "short_hedgefund",
    "description": "Curates panic narratives.",
    "role": "support",
    "costShares": 148,
    "impactTargetRule": "none",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "dirty",
      "flip", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.12,
        "exposed": 0.31
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "source_survived"
        ],
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 14
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "borrow_rate_whisperer",
    "name": "Borrow Rate Whisperer",
    "faction": "short_hedgefund",
    "description": "APR meets fear.",
    "role": "support",
    "costShares": 109,
    "impactTargetRule": "none",
    "mechanicsSummary": "Role: bureaucrat. Keywords: Dirty (higher Judge catch risk). Faction passive: Short deck siphons via dirty pressure, but worsens Judge mood and own favor over time. Judge blue: skim 15+atk*3 (you keep 75%); stun strongest target; rider: enemy favor -1. Judge bribe action: stun strongest target plus rider. Resistance: exposed 30%.",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "dirty", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.3
      }
    ],
    "triggers": []
  },
  {
    "id": "shell_operator",
    "name": "Shell Operator",
    "faction": "short_hedgefund",
    "description": "CEO of mailbox LLC.",
    "role": "support",
    "costShares": 103,
    "impactTargetRule": "none",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "dirty", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.34
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "fud_negotiator",
    "name": "FUD Negotiator",
    "faction": "short_hedgefund",
    "description": "Polite gaslighting expert.",
    "role": "support",
    "costShares": 111,
    "impactTargetRule": "none",
    "mechanicsSummary": "Blue-slot negotiator that weaponizes favor and probation swings. Judge green: legal fee 16+atk*3 (you keep 55%); deal 1 sanction damage; support: heal weakest ally by 1, +1 enemy probation. Judge petition action: deal 1 sanction damage + grant 1 shield to an ally. Judge blue: skim 15+atk*4 (you keep 65%); deal 1 sanction damage; rider: enemy probation +1. Judge bribe action: apply temporary -1 attack plus rider. Resistance: exposed 44% · atk-down 14%.",
    "dirtyPower": 2,
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "dirty",
      "negotiator", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.44,
        "atkDown": 0.14
      }
    ],
    "triggers": []
  },
  {
    "id": "rumor_forge",
    "name": "Rumor Forge",
    "faction": "short_hedgefund",
    "description": "Deal 2 to random enemy unit.",
    "role": "control",
    "costShares": 80,
    "impactTargetRule": "enemy-unit",
    "mechanicsSummary": "Choose enemy unit: deal 2 damage. If it dies, gain +80 shares.",
    "dirtyPower": 2,
    "kind": "instrument",
    "keywords": [
      "dirty"
    ],
    "specials": [],
    "triggers": []
  },
  {
    "id": "insider_briefcase",
    "name": "Insider Briefcase",
    "faction": "short_hedgefund",
    "description": "Friendly unit +2 attack.",
    "role": "control",
    "costShares": 95,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +2 attack.",
    "dirtyPower": 3,
    "kind": "upgrade",
    "keywords": [
      "dirty"
    ],
    "specials": [],
    "triggers": []
  },
  {
    "id": "shell_company_maze",
    "name": "Shell Company Maze",
    "faction": "short_hedgefund",
    "description": "Siphon shares from opponent.",
    "role": "control",
    "costShares": 100,
    "impactTargetRule": "none",
    "mechanicsSummary": "Steal up to 120 shares from enemy leader.",
    "dirtyPower": 3,
    "kind": "instrument",
    "keywords": [
      "dirty"
    ],
    "specials": [],
    "triggers": []
  },
  {
    "id": "media_smear",
    "name": "Media Smear",
    "faction": "short_hedgefund",
    "description": "Reduce random enemy attack.",
    "role": "control",
    "costShares": 90,
    "impactTargetRule": "enemy-unit",
    "mechanicsSummary": "Choose enemy unit: -2 attack and apply Exposed.",
    "dirtyPower": 2,
    "kind": "upgrade",
    "keywords": [
      "dirty"
    ],
    "specials": [],
    "triggers": []
  },
  {
    "id": "synthetic_press_release",
    "name": "Synthetic Press Release",
    "faction": "short_hedgefund",
    "description": "Narrative pump for short side.",
    "role": "control",
    "costShares": 92,
    "impactTargetRule": "none",
    "mechanicsSummary": "Gain +90 shares, enemy gains 1 probation, and Judge mood worsens.",
    "dirtyPower": 2,
    "kind": "instrument",
    "keywords": [
      "dirty"
    ],
    "specials": [],
    "triggers": []
  },
  {
    "id": "court_liaison",
    "name": "Court Liaison",
    "faction": "neutral",
    "description": "Neutral negotiator for Judge interactions.",
    "role": "support",
    "costShares": 102,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "negotiator", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.22
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "grey_pool_fixer",
    "name": "Grey Pool Fixer",
    "faction": "neutral",
    "description": "Neutral dirty operative for blue Judge slot.",
    "role": "control",
    "costShares": 108,
    "impactTargetRule": "none",
    "dirtyPower": 1,
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [
      "dirty"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.12
      }
    ],
    "triggers": [
      {
        "when": "after_combat_survived",
        "actions": [
          {
            "kind": "modify_attack",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "forensic_journalist",
    "name": "Forensic Journalist",
    "faction": "neutral",
    "description": "Prints receipts at dawn.",
    "role": "support",
    "costShares": 224,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "front",
    "stats": {
      "attack": 2,
      "health": 3
    },
    "keywords": [],
    "specials": [
      {
        "kind": "taunt"
      },
      {
        "kind": "resistance",
        "exposed": 0.22,
        "stun": 0.36
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "gain_shield",
            "target": "self",
            "amount": 3
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "class_action_counsel",
    "name": "Class Action Counsel",
    "faction": "neutral",
    "description": "Loves large groups and fees.",
    "role": "support",
    "costShares": 112,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "negotiator", "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.28,
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "exchange_clerk",
    "name": "Exchange Clerk",
    "faction": "neutral",
    "description": "Keeps the market barely legal.",
    "role": "support",
    "costShares": 107,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 1,
      "health": 5
    },
    "keywords": [
       "reach", "rush"
    ],    
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.2,
        "atkDown": 0.12
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "macro_commentator",
    "name": "Macro Commentator",
    "faction": "neutral",
    "description": "Wrong loudly, daily.",
    "role": "support",
    "costShares": 105,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": ["ranged"],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.18
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "source_survived"
        ],
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 24
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "proxy_lawyer",
    "name": "Proxy Lawyer",
    "faction": "neutral",
    "description": "Weaponized shareholder votes.",
    "role": "support",
    "costShares": 107,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "back",
    "stats": {
      "attack": 2,
      "health": 4
    },
    "keywords": [
      "prosecutor",
      "reach"
    ],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.25
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 2
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "market_holiday",
    "name": "Market Holiday",
    "faction": "neutral",
    "description": "Everyone calms down briefly.",
    "role": "utility",
    "costShares": 80,
    "impactTargetRule": "none",
    "mechanicsSummary": "Stun all units on both sides for one turn cycle.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "audit_committee",
    "name": "Audit Committee",
    "faction": "neutral",
    "description": "Adds governance paperwork.",
    "role": "utility",
    "costShares": 86,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +1 max HP, heal 1, add 1 shield; you gain 1 favor and remove 1 probation.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "spreadsheet_reconciliation",
    "name": "Spreadsheet Reconciliation",
    "faction": "neutral",
    "description": "Cell by cell stability.",
    "role": "utility",
    "costShares": 35,
    "impactTargetRule": "none",
    "mechanicsSummary": "Gain +70 shares and reduce debt by up to 80.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "liquidity_provider",
    "name": "Liquidity Provider",
    "faction": "utility",
    "description": "Universal: gain shares.",
    "role": "utility",
    "costShares": 80,
    "impactTargetRule": "none",
    "mechanicsSummary": "Gain +120 shares.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "lender_last_resort",
    "name": "Lender of Last Resort",
    "faction": "utility",
    "description": "Universal emergency bailout.",
    "role": "utility",
    "costShares": 100,
    "impactTargetRule": "ally-unit-or-leader",
    "mechanicsSummary": "Choose your unit or leader: heal 3 and gain +180 shares, then lose 1 favor.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "transparency_ledger",
    "name": "Transparency Ledger",
    "faction": "utility",
    "description": "Universal favor stabilizer.",
    "role": "utility",
    "costShares": 85,
    "impactTargetRule": "none",
    "mechanicsSummary": "Gain +60 shares, +2 favor, and remove 1 probation.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "naked_shorting",
    "name": "Naked Shorting",
    "faction": "utility",
    "description": "Universal leverage (1:2..1:5), creates debt and hostility.",
    "role": "control",
    "costShares": 200,
    "impactTargetRule": "none",
    "mechanicsSummary": "Pick leverage 1:2 to 1:5. Gain leveraged shares, add debt, and increase Judge hostility.",
    "dirtyPower": 5,
    "kind": "instrument",
    "keywords": [
      "dirty"
    ],
    "specials": [],
    "triggers": []
  },
  {
    "id": "liquidity_window_global",
    "name": "Liquidity Window",
    "faction": "utility",
    "description": "Temporary access to capital.",
    "role": "utility",
    "costShares": 88,
    "impactTargetRule": "none",
    "mechanicsSummary": "Gain +100 shares, draw 1 card, and reduce debt by 30.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "circuit_pause",
    "name": "Circuit Pause",
    "faction": "utility",
    "description": "Small reset before chaos returns.",
    "role": "utility",
    "costShares": 90,
    "impactTargetRule": "enemy-unit",
    "mechanicsSummary": "Choose enemy unit: stun for one turn cycle and apply Exposed.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "compliance_hotline",
    "name": "Compliance Hotline",
    "faction": "utility",
    "description": "Anonymous tip and instant panic.",
    "role": "utility",
    "costShares": 84,
    "impactTargetRule": "enemy-unit",
    "mechanicsSummary": "Choose enemy unit: -1 attack and enemy gains +1 probation.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "darkpool_flashlight",
    "name": "Darkpool Flashlight",
    "faction": "utility",
    "description": "Finds hidden prints.",
    "role": "utility",
    "costShares": 92,
    "impactTargetRule": "enemy-unit",
    "mechanicsSummary": "Choose enemy unit: apply Exposed and deal 1 damage.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "headline_scraper",
    "name": "Headline Scraper",
    "faction": "utility",
    "description": "Harvests sentiment shifts.",
    "role": "utility",
    "costShares": 86,
    "impactTargetRule": "enemy-unit-or-leader",
    "mechanicsSummary": "Choose enemy unit or leader. Unit: -1 attack + Exposed. Leader: steal up to 80 shares.",
    "kind": "instrument",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "volatility_swaplet",
    "name": "Volatility Swaplet",
    "faction": "utility",
    "description": "Pocket-size risk transfer.",
    "role": "utility",
    "costShares": 94,
    "impactTargetRule": "ally-unit",
    "mechanicsSummary": "Choose friendly unit: +1 attack, +1 shield, and clear Exposed.",
    "kind": "upgrade",
    "keywords": [],
    "specials": [],
    "triggers": []
  },
  {
    "id": "cleanup_rubble",
    "name": "Rubble",
    "faction": "neutral",
    "description": "Cleanup obstacle. No special abilities.",
    "role": "offense",
    "costShares": 0,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 1
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "cleanup_suit_rack",
    "name": "Suit Rack",
    "faction": "neutral",
    "description": "Cleanup obstacle. No special abilities.",
    "role": "offense",
    "costShares": 0,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 1
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "exposed": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "cleanse",
            "target": "self"
          },
          {
            "kind": "heal",
            "target": "self",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "cleanup_emergency_cone",
    "name": "Emergency Cone",
    "faction": "neutral",
    "description": "Cleanup obstacle. No special abilities.",
    "role": "offense",
    "costShares": 0,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 1
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_summon",
        "actions": [
          {
            "kind": "heal",
            "target": "ally",
            "amount": 1
          }
        ],
        "note": "Legacy fallback signature parity (weakest damaged ally)."
      }
    ]
  },
  {
    "id": "cleanup_wet_floor_sign",
    "name": "Wet Floor Sign",
    "faction": "neutral",
    "description": "Cleanup obstacle. No special abilities.",
    "role": "offense",
    "costShares": 0,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 1
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "stun": 0.13
      }
    ],
    "triggers": [
      {
        "when": "on_hit",
        "requires": [
          "target_survived"
        ],
        "actions": [
          {
            "kind": "apply_status",
            "target": "hit_target",
            "status": "exposed",
            "turns": 1
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  },
  {
    "id": "cleanup_cart",
    "name": "Cleanup Cart",
    "faction": "neutral",
    "description": "Cleanup obstacle. No special abilities.",
    "role": "offense",
    "costShares": 0,
    "impactTargetRule": "none",
    "kind": "unit",
    "lane": "both",
    "stats": {
      "attack": 3,
      "health": 1
    },
    "keywords": [],
    "specials": [
      {
        "kind": "resistance",
        "atkDown": 0.13
      }
    ],
    "triggers": [
      {
        "when": "turn_start",
        "actions": [
          {
            "kind": "gain_shares",
            "target": "self_player",
            "amount": 10
          }
        ],
        "note": "Legacy fallback signature parity."
      }
    ]
  }
];
