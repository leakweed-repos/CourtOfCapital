# Court of Capital — Game Spec (for Codex)

> **Purpose of this document**
> This file is the single source of truth for new Codex chats working on this repo.
> It describes the game in detail, without proposing implementation code.
> Treat this as a product + rules specification.

---

## 0) One-liner

A turn-based, satirical courtroom card battler: two sides fight for victory in a “Court of Capital” where the **Judge** can reward, punish, and even (rarely) grant an alternate win condition.

---

## 1) Tone, Setting, and Safety

### 1.1 Tone
- Lightly humorous, meme-aware, but readable and “adult clever”.
- Feedback text can be playful; rules must be crisp.

### 1.2 Setting
- Fictional, satirical world inspired by global finance.
- **No real institution names, no real people, no direct accusations.**
- Factions/archetypes are generic and stylized (e.g., “Clearing Guild”, “Short Syndicate”, “Regulatory Choir”, “Market Makers”, “Fraudsters”, “Retail Rebels”, etc.).

### 1.3 Core fantasy
- Players are courtroom “operators” backing a leader (main character).
- Units, instruments, and tactics represent financial behaviors and schemes.
- The Judge is a living system: trades, oversight, punishments, reputation, and rare “Verdict”.

---

## 2) High-Level Gameplay Loop

1. Open weekly game post.
2. Lobby: choose AI match or invite a user by username.
3. Pre-match: Mulligan (10 seconds).
4. Match: alternating turns (27 seconds each).
5. Win by:
   - reducing opponent leader HP to 0, OR
   - obtaining an ultra-rare Judge-based alternate win (“Verdict”) condition.

---

## 3) Board Layout

### 3.1 Default board dimensions
- Columns: **5** (possible future variant: 6; keep rules compatible)
- Rows:
  - Player A: 2 rows (Front, Back)
  - Center: 1 row (Event Row; neutral)
  - Player B: 2 rows (Front, Back)

So total: **5 rows × 5 columns**.

### 3.2 Conceptual “courtroom seating”
- Visually evokes courtroom benches (like “seating blocks”), rotated 90° vs typical “two sides”.
- Leaders are represented on the left side of the UI.
- The Judge is on the right side of the UI (interactive).

### 3.3 Row meanings
- **Front row**: primary frontline, melee/taunt zone.
- **Back row**: supports, ranged, instruments, fragile units.
- **Event row (center)**:
  - Not directly placeable by players.
  - Spawns neutral “event units” or “event tokens”.
  - Both sides can attack / interact with these entities depending on rules.

---

## 4) Cards and Objects

### 4.1 Card families (MVP concept)
Cards are grouped by “what they represent”:

1) **Units**
- Placed on the board (front/back).
- Have stats and traits.

2) **Instruments**
- Finance-flavored “boosts” instead of classic spells.
- Examples of conceptual subtypes:
  - “Stocks” and “Bonds” as buffs/attachments
  - “Long/Short” tactical actions
- Some instruments may be attachable to units, some may be “instant” actions (still not called “spells” in UI).

3) **Gear / Upgrades**
- Persistent attachments or role modifiers.
- Lore-consistent (e.g., “Legal Firewall”, “Insider Briefcase”, “Compliance Badge” as a satire version).

4) **Dirty Play (Nieczyste zagranie)**
- A flagged class of cards (or a trait) representing unethical tactics.
- Stronger impact but triggers risk of being caught by the Judge.

> Note: The exact card set and balance is handled separately; this document defines mechanics and structure only.

### 4.2 Card metadata (conceptual fields)
Each playable card conceptually has:
- Name, rarity (optional for MVP)
- Cost in **Shares** or other action-currency
- Type (Unit / Instrument / Upgrade / Dirty Play)
- Traits (Taunt, Ranged, etc.)
- Dirty Power (how likely Judge catches it)
- Rules text

---

## 5) Resources and Economy

### 5.1 Primary resource: Shares
- Instead of mana, players have **Shares** (default: 1000 at match start).
- Shares are spent on:
  - playing cards
  - performing certain actions (movement/attacks if action-costed)
  - trading with the Judge (boosters, special effects)
- Shares are gained from:
  - defeating enemy units
  - dealing damage to enemy leader
  - defeating event-row units (optional, if designed that way)

### 5.2 Secondary resource: Favor (Judge reputation)
- Optional but recommended for the Judge system:
  - Increases or decreases based on “clean play” vs “dirty play”
  - May influence catch chance, booster prices, or access to rare Judge offers
- Favor can be shared publicly or hidden; design choice.

---

## 6) Match Structure and Timing

### 6.1 Phases
A match consists of:
1) **Mulligan phase** (10s)
2) **Active gameplay** (turn-based)

### 6.2 Mulligan rules
- Duration: **10 seconds**
- Default starting hand: **4 cards**
- Deck size: **42 cards**
- If player does nothing in 10s: auto-accept current hand.
- Mulligan behavior:
  - Player may select some cards to replace
  - Replaced cards go back into deck (shuffle) and new cards are drawn
  - Final hand size remains 4

### 6.3 Turn rules
- Turn timer: **27 seconds**
- If timer runs out: auto-pass / end turn.
- Default turn structure:
  1) Start-of-turn triggers (events, Judge checks, ongoing effects)
  2) Player actions (play cards, attack, trade with Judge)
  3) End turn (manual or timeout)

---

## 7) Positioning Rules (Front/Back, Columns)

### 7.1 Placement
- Units can be placed into an empty slot in either Front or Back row, depending on their trait restrictions.

### 7.2 Trait-based placement restrictions
- **Taunt**: may be placed **only in Front row** (rule: “Taunt belongs in the benches”).
- **Ranged**: may be restricted by card trait:
  - Some ranged can be placed only in Back row
  - Some can be placed in either row
- Future extensibility: “Siege” units that must be in Front, “Artillery” must be in Back, etc.

### 7.3 Column identity
- Columns matter for readability and some effects (e.g., “hit same column”, “shield adjacent”).
- Adjacent definition:
  - Horizontal adjacency within the same row: col-1, col+1
  - Vertical adjacency within same side: front/back same column
  - Event row is neutral; adjacency to event row is not automatic unless specified.

---

## 8) Combat System (Minimal, coherent MVP)

### 8.1 Attacking basics
- Units can attack during the active player’s turn unless restricted (summoning sickness optional).
- Each attack chooses a target following targeting rules.
- Damage is simultaneous or unilateral depending on design:
  - MVP suggestion: attacker deals damage to target; target deals back damage only if it is a unit and has “counter” enabled.
  - Define clearly per ruleset version.

### 8.2 Targeting rules (with Taunt)
1) If opponent has any **Taunt** unit in Front row:
   - Attacks that could hit opponent units must target a Taunt first.
2) If no Taunt exists:
   - Front row units can be targeted normally.
3) Back row targeting:
   - Back row can only be attacked by:
     - Instruments/actions that specify backline access, OR
     - Units with Ranged/Reach-like trait that allows it, OR
     - Effects that ignore row protections.
4) Leader targeting:
   - Leader can be attacked only if:
     - no Taunt in opponent front row, AND
     - rules permit direct leader attacks (common), OR by special effects.

### 8.3 Front/back meaning
- Front row is “protected zone”:
  - It protects the Back row and often the Leader.
- Back row is “support zone”:
  - Usually safer; vulnerable to specific access effects.

### 8.4 Death and removal
- If a unit’s HP reaches 0, it is removed from the board.
- Removal grants Shares reward to the killer’s side (exact values handled by balance).

---

## 9) The Judge System

### 9.1 Judge as interactive NPC
The Judge provides:
- A “shop” where players can spend Shares (and/or Favor) to buy boosters.
- Oversight: catches Dirty Plays.
- Rare “Verdict” offers: alternate win condition.

### 9.2 Boosters (Judge shop)
- Booster types are thematic (e.g., “Compliance Pack”, “Volatility Pack”, “Liquidity Pack”).
- Booster outcomes:
  - card draw
  - temporary buffs
  - special tokens
  - single-use protections against penalties
- Shop availability can be:
  - always open, or
  - open only on certain turns, or
  - influenced by Favor/mood.

### 9.3 Dirty Play (“Nieczyste zagranie”)
Dirty Play is defined by:
- A trait/tag OR a card family type.
- A numeric **Dirty Power** rating.

When a Dirty Play is executed:
- A detection roll occurs:
  - higher Dirty Power = higher catch chance
  - repeated dirty play may increase chance further (“probation”)
  - Judge mood/favor can modulate chance

### 9.4 Penalties (MVP: 2 punishments)
When caught, the Judge applies one of two penalties (pick 2 as MVP and keep consistent):
1) **Confiscation**: lose Shares (flat or %)
2) **Stun**: the played unit (or a random friendly unit) cannot attack next turn

Optional future penalties:
- forced discard
- “public warning” that increases catch chance next time
- temporary shop ban

### 9.5 Judge Favor / Mood
- Favor/mood drifts as the game progresses.
- It may:
  - reduce booster prices
  - reduce/increase catch chance
  - unlock rare shop options

---

## 10) Random Events (Deterministic)

### 10.1 Event trigger timing
- Events are evaluated at **start of turn** (before the active player acts).
- Frequency can be:
  - every turn,
  - or every N turns,
  - or based on probability.

### 10.2 Determinism requirement
- Events must be deterministic across clients:
  - Each match has a fixed RNG seed.
  - Event rolls depend on (seed, turn number, maybe a counter).
  - Refreshing the UI must not change outcomes.

### 10.3 Event row behavior
- Event spawns place neutral units/tokens onto the Event row.
- Example event concept:
  - “Activist Protest”: spawns a neutral unit on Event row for both players to defeat.
- Event entities can:
  - be attackable by both sides,
  - reward Shares/Favor when defeated,
  - apply a global aura until cleared.

---

## 11) Modes

### 11.1 PvE (vs AI)
- AI has 3 difficulty levels.
- AI is “fair”:
  - ideally same resources
  - difficulty changes decision quality, not hidden cheating (unless explicitly desired later)

### 11.2 PvP (invite)
- Inviter enters target username (without `u/`).
- Invited user receives a notification:
  - Minimum reliable channel: a comment ping in the weekly post.
  - Additional best-effort: inbox message (optional).
- Accepting invite creates a match.

### 11.3 Match visibility
- Matches are associated with the weekly post.
- Players can have multiple matches per week.
- Old weeks are locked and cannot create new matches.

---

## 12) Weekly Leaderboard System

### 12.1 What is tracked
- Per user (weekly):
  - Wins (W)
  - Losses (L)
  - Win ratio = W / (W+L) (define 0/0 handling)
- Optional: total matches, streak.

### 12.2 Weekly reset
- Each week:
  - A new post is created.
  - New leaderboard starts from empty.
  - Previous week post is locked (no new matches).
  - Summary is posted under old post:
    - total matches
    - top 3 players
    - final W/L/ratio stats

### 12.3 Ranking policy
- Primary: wins
- Tie-breakers (suggested):
  1) higher ratio
  2) more matches (or fewer losses)
  3) deterministic fallback (username)

---

## 13) UI/UX Flow Requirements (Devvit Web)

### 13.1 Lobby (inside weekly post)
Must show:
- “Play vs AI” buttons (L1/L2/L3)
- “Invite user” input (username without `u/`)
- Pending invites list with Accept button
- Your ongoing matches list with status + whose turn
- Optional: weekly leaderboard preview

### 13.2 Match screen
Must show:
- Board (5 columns × 5 rows) with clear row labels
- Your hand (cards), selectable
- Action panel:
  - play selected card into chosen slot
  - end turn
  - judge shop interaction
- Timers:
  - turn countdown (27s)
  - mulligan countdown (10s) at match start
- Log feed (last N events)

### 13.3 Mulligan modal
- Appears at match start.
- Shows your 4 cards.
- Lets you select cards to replace.
- Timer 10 seconds; auto-accept if time expires.

---

## 14) Win Conditions

### 14.1 Standard win
- Opponent leader HP reaches 0 → you win.

### 14.2 Rare win (“Verdict”)
- A rare game state (“Judge’s Verdict”) can instantly win the match.
- This should be:
  - extremely uncommon
  - well-telegraphed when possible
  - tied to Judge system (favor/mood/shop drop)
- Exact acquisition:
  - via extremely rare artifact, or
  - via special Judge offer after certain conditions

---

## 15) Constraints and Non-Goals

### 15.1 Constraints
- Turn timers must be enforced server-side.
- Deterministic events must not depend on client refresh.
- PvP invites must not assume instant real-time; async-friendly.

### 15.2 Non-goals (for MVP)
- Full card set and balance design is handled separately.
- No external backend required.
- No trading economy between players (outside match) in MVP.

---

## 16) Versioning of Rules
- This spec is “Rules v0”.
- Any future change to:
  - board size (5→6),
  - timing,
  - targeting,
  - Judge penalties,
should increment a rules version so old matches remain consistent.

---

## 17) Glossary
- **Leader**: main character HP pool; losing it loses the match.
- **Shares**: primary action currency (replaces mana).
- **Favor**: judge reputation metric (optional but recommended).
- **Dirty Power**: numeric risk rating for Dirty Play.
- **Event Row**: neutral row that spawns random deterministic events/entities.
- **Verdict**: rare alternate win condition tied to the Judge.

---
End of document.
