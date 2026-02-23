# Card Authoring (V2)

## Source of Truth
- Production cards are sourced from `src/shared/cards/catalog/generated-all.ts`, then completed by manual overrides in faction files.
- Runtime/UI compatibility adapters (`src/shared/card-catalog.ts`, `src/shared/card-effects.ts`) read from V2 data.

## Recommended Edit Path (Single Place)
1. Edit or add the card in the appropriate V2 faction file:
- `src/shared/cards/catalog/sec.ts`
- `src/shared/cards/catalog/market-makers.ts`
- `src/shared/cards/catalog/wallstreet.ts`
- `src/shared/cards/catalog/retail-mob.ts`
- `src/shared/cards/catalog/short-hedgefund.ts`
- `src/shared/cards/catalog/neutral-and-utility.ts`
2. If the card already exists in the snapshot, the faction file entry acts as an override.
3. Run `npm run cards:validate`.
4. Run `npm run test`.

## When Adding a Brand-New Card
1. Add the card to the appropriate V2 faction file (manual override).
2. If the card should enter decks, update deck/build logic if needed (`src/server/game/models.ts` / deck pools).
3. If it needs runtime behavior not expressible by current V2 trigger actions, extend:
- `src/shared/cards/schema.ts`
- `src/server/game/card-runtime.ts`
- `src/shared/cards/text-builder.ts`
- `src/shared/cards/validators.ts`
4. Run:
- `npm run cards:validate`
- `npm run cards:report`
- `npm run test`

## Card Template (Unit)
```ts
{
  id: "example_card",
  name: "Example Card",
  faction: "sec",
  kind: "unit",
  description: "One-sentence in-world description.",
  court_case:
    "A light in-world case paragraph based on the card name, faction, and description; witty, readable, and safe to show in Court Record.",
  mechanicsSummary: "Optional explicit summary while using older runtime paths or special manual wording.",
  impactTargetRule: "none",
  role: "control",
  costShares: 110,
  lane: "back",
  stats: { attack: 2, health: 4 },
  keywords: ["ranged"],
  specials: [{ kind: "resistance", exposed: 0.2 }],
  triggers: [
    {
      when: "on_hit",
      requires: ["target_survived"],
      actions: [{ kind: "apply_status", target: "hit_target", status: "exposed", turns: 2 }],
    },
  ],
}
```

## Notes
- `description` is lore/theme text.
- `court_case` is the authored Court Record paragraph (humorous, in-world, based on `description` + `name` + `faction`).
- `mechanicsSummary` is optional and useful while some cards still use older runtime paths during migration.
- `specials.resistance` values must use fractions in range `0..1` (example: `0.2` = `20%`).
- Do not use the word `legacy` in UI copy when referring to code generations/versions (allowed only if it is literal in-world lore text).
- UI label is `Court Record`.
- Court Record output format is:
- `Identikit: $description. Case: $court_case.`

## Card Template (Non-Unit)
```ts
{
  id: "example_filing",
  name: "Example Filing",
  faction: "utility",
  kind: "instrument",
  description: "One-sentence in-world description.",
  court_case: "Short humorous case paragraph tied to the filing and faction style.",
  mechanicsSummary: "Choose friendly unit: +1 attack and add 1 shield.",
  impactTargetRule: "ally-unit",
  role: "utility",
  costShares: 90,
  keywords: [],
  specials: [],
  triggers: [],
}
```

## Authoring Helpers (DX)
- Import helpers from `src/shared/cards/index.ts`.
- Use helpers for new cards and overrides when they improve readability; plain object literals are still fine.

### Example: Add A Card In One Place (Faction Override)
```ts
// src/shared/cards/catalog/retail-mob.ts
import { cheapTaunt, rangedSupport, supportCleaner } from "../index";

export const RETAIL_MOB_CARDS_V2 = [
  cheapTaunt({
    id: "crowd_barricade_intern",
    name: "Crowd Barricade Intern",
    faction: "retail_mob",
    description: "Shows up early, blocks lanes, and yells before the chart does.",
    court_case: "Filed after three microphones were used as shields and one was invoiced as crowd control.",
    costShares: 88,
    attack: 1,
    health: 4,
  }),
  rangedSupport({
    id: "mod_queue_spotter",
    name: "Mod Queue Spotter",
    faction: "retail_mob",
    description: "Pings backline threats before they trend.",
    court_case: "The docket notes accurate callouts, poor posture, and a suspiciously perfect ban-speed chart.",
    costShares: 106,
    attack: 2,
    health: 3,
    triggers: [
      {
        when: "on_hit",
        requires: ["target_survived"],
        actions: [{ kind: "apply_status", target: "hit_target", status: "exposed", turns: 2 }],
      },
    ],
    specials: [{ kind: "resistance", exposed: 0.2 }],
  }),
  supportCleaner({
    id: "apes_first_aid_mod",
    name: "Apes First Aid Mod",
    faction: "retail_mob",
    description: "Resets panic and patches the frontline before the next wave.",
    court_case: "Witnesses confirm the bandages were memes, but the recoveries were unfortunately real.",
    costShares: 112,
    attack: 1,
    health: 4,
    healAmount: 2,
  }),
];
```

## Preset Summary
- `cheapTaunt(...)`: quick frontliner with `taunt`
- `tauntTank(...)`: heavier frontliner with `taunt`
- `rangedSupport(...)`: backline `ranged` support shell
- `rushAttacker(...)`: offense shell with `rush`
- `supportCleaner(...)`: support shell with summon `heal + cleanse`
- `spellCard(...)`: non-unit helper (defaults to `instrument`)
- `upgradeCard(...)`: non-unit helper for `upgrade`
