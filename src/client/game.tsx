import { context, getWebViewMode } from "@devvit/web/client";
import { StrictMode, type PointerEvent as ReactPointerEvent, type SyntheticEvent as ReactSyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  API_ROUTES,
  postJson,
  type InviteLobbyResponse,
  type LobbyResponse,
  type PvpLobbyResponse,
  type PvpLobbyStartResponse,
} from "../shared/api";
import { getCardPreview, getDisplayAbilitiesLine } from "../shared/cards";
import {
  type EventUnitState,
  type BotPlannedAction,
  type BotTurnPlanPublic,
  JUDGE_COL,
  type MatchLogEntry,
  normalizeUsername,
  type FactionId,
  type InviteState,
  type LobbyMatchSummary,
  type MatchState,
  type PlayCardTarget,
  type PlayerSide,
  type PvpLobbyState,
  type PvpLobbySummary,
  type TutorialScenarioId,
} from "../shared/game";
import { isJudgeCorruptSpecialistCard, isJudgePositiveSpecialistCard, isJudgeSpecialistCard } from "../shared/placement";
import { shouldDiscardMatchResponse } from "./match-sync";
import { factionLabel, readWeekIdFromPostData, readWeekNumberFromPostData } from "./view-meta";
import "./index.css";

type UiContext = {
  weekId: string;
  weekNumber: number;
  postId: string;
  userId: string;
  username: string;
  clientName: "ANDROID" | "IOS" | "WEB";
};

type InspectEventDetails = {
  name: string;
  typeLabel: string;
  statsLabel: string;
  effectLabel: string;
  statusLabel?: string;
};

type LeaderboardRow = {
  username: string;
  wins: number;
  losses: number;
  matches: number;
};

type DragAttackState = {
  attackerUnitId: string;
  x: number;
  y: number;
};

type CoachmarkPosition = {
  left: number;
  top: number;
  placement: "top" | "bottom";
};

type LobbyTab = "quick" | "pvp" | "tutorial";

type BotGhostPreviewSlot = {
  sideLabel: "ally" | "enemy";
  lane: "front" | "back";
  col: number;
  cardId: string;
  cardName: string;
};

function botGhostSlotKey(sideLabel: "ally" | "enemy", lane: "front" | "back", col: number): string {
  return `${sideLabel}:${lane}:${col}`;
}

const FACTIONS: Array<{ id: FactionId; label: string; motto: string; tone: string }> = [
  { id: "retail_mob", label: "Retail Mob", motto: "Momentum swarms", tone: "wide board + spikes" },
  { id: "short_hedgefund", label: "Short Hedgefund", motto: "Pressure through leverage", tone: "risk + burst" },
  { id: "market_makers", label: "Market Makers", motto: "Spread and liquidity loops", tone: "value + utility" },
  { id: "sec", label: "SEC", motto: "Audits and injunctions", tone: "control + disruption" },
  { id: "wallstreet", label: "Wallstreet", motto: "Premium alpha desks", tone: "tempo + scaling" },
];

const TUTORIAL_SCENARIOS: Array<{ id: TutorialScenarioId; label: string; subtitle: string }> = [
  { id: "core_basics_v1", label: "Tutorial #0: Basics", subtitle: "Board read, deploy, attack, cast, buff, pass." },
  { id: "buffs_debuffs_v1", label: "Tutorial #1: Buffs/Debuffs", subtitle: "Layer statuses: debuff, exposed, shield, cleanse, stun." },
  { id: "judge_dependencies_v1", label: "Tutorial #2: Judge Dependencies", subtitle: "Green/Blue slots, lane rule, petition + bribe." },
];

type AttackTarget =
  | { kind: "leader" }
  | { kind: "judge" }
  | { kind: "unit"; unitId: string }
  | { kind: "event"; eventUnitId: string };

function readContext(): UiContext {
  const clientName = context.client?.name;
  return {
    weekId: readWeekIdFromPostData(context.postData),
    weekNumber: readWeekNumberFromPostData(context.postData),
    postId: context.postId ?? "",
    userId: context.userId ?? "",
    username: normalizeUsername(context.username ?? "guest"),
    clientName: clientName === "ANDROID" || clientName === "IOS" ? clientName : "WEB",
  };
}

function sideForUser(match: MatchState, userId: string): PlayerSide | null {
  if (match.players.A.userId === userId) return "A";
  if (match.players.B.userId === userId) return "B";
  return null;
}

function enemyOf(side: PlayerSide): PlayerSide {
  return side === "A" ? "B" : "A";
}

function secsLeft(deadlineAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
}

function shortId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 7)}...${id.slice(-4)}`;
}

function compactName(name: string, max = 9): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}...`;
}

function maskResumeName(name: string): string {
  if (!name) {
    return "gue***t";
  }
  if (name.length <= 1) {
    return `${name}***${name}`;
  }
  if (name.length <= 3) {
    const last = name[name.length - 1] ?? name[0] ?? "x";
    return `${name}***${last}`;
  }
  const first = name.slice(0, 3);
  const last = name[name.length - 1] ?? "x";
  return `${first}***${last}`;
}

function summarizeResumeMatch(match: LobbyMatchSummary, selfUserId: string): string {
  const myName = match.playerAUserId === selfUserId ? match.playerAUsername : match.playerBUsername;
  const opponentName = match.playerAUserId === selfUserId ? match.playerBUsername : match.playerAUsername;
  const me = maskResumeName(myName);
  const opp = maskResumeName(opponentName);
  if (match.mode === "pve") {
    const level = match.aiLevel ?? 1;
    return `AI L${level} vs. ${me}`;
  }
  if (match.mode === "pvp") {
    return `PvP: ${opp} vs. ${me}`;
  }
  if (match.mode === "sandbox") {
    return `Cleanup Playground vs. ${me}`;
  }
  return `Tutorial vs. ${me}`;
}

function tutorialScenarioLabel(id?: TutorialScenarioId): string {
  if (!id) {
    return "Tutorial";
  }
  const one = TUTORIAL_SCENARIOS.find((row) => row.id === id);
  return one?.label ?? id;
}

function tutorialResumeLabel(summary: LobbyMatchSummary): string {
  if (summary.mode === "sandbox") {
    return "Cleanup Playground";
  }
  return tutorialScenarioLabel(summary.tutorialScenarioId);
}

function roleLabel(role: "offensive" | "defensive" | "bureaucrat" | "utility"): string {
  if (role === "offensive") return "offense";
  if (role === "defensive") return "defense";
  if (role === "bureaucrat") return "bureaucrat";
  return "utility";
}

function eventInspectDetails(eventUnit: EventUnitState): InspectEventDetails {
  if (eventUnit.kind === "iron_curtain") {
    const lane = eventUnit.blockedLane === "front" ? "front" : "back";
    return {
      name: "Iron Curtain",
      typeLabel: "event · disruption",
      statsLabel: `hp ${eventUnit.health} · col ${eventUnit.col + 1}`,
      effectLabel: `Blocks ${lane} lane in this column for its owner until destroyed.`,
      statusLabel: `Owned by Side ${eventUnit.ownerSide ?? "?"}`,
    };
  }

  return {
    name: eventUnit.name || "Event Unit",
    typeLabel: "event · neutral",
    statsLabel: `hp ${eventUnit.health} · reward ${eventUnit.rewardShares} shares/${eventUnit.rewardFavor} favor`,
    effectLabel: "Neutral objective. Destroy it to claim its reward.",
  };
}

function judgeInspectDetails(): InspectEventDetails {
  return {
    name: "Judge Influence",
    typeLabel: "core slot · judge",
    statsLabel: "Center column authority node",
    effectLabel: "Cast non-unit cards here and trigger judge-related mechanics.",
  };
}

type UnitStatusTokenKey = "shield" | "atk-down" | "stun" | "exposed";
type UnitStatusToken = {
  key: UnitStatusTokenKey;
  short: string;
  title: string;
  detail?: string;
};

const STATUS_LEGEND: UnitStatusToken[] = [
  {
    key: "shield",
    short: "SH",
    title: "Shield: blocks incoming hit damage.",
    detail:
      "Each shield charge blocks one incoming hit packet before HP loss. Example: 2 SH can absorb two separate hits, regardless of source.",
  },
  {
    key: "atk-down",
    short: "ATK-",
    title: "Attack down: temporary attack reduction.",
    detail:
      "ATK- lowers the unit's attack value for the current effect window. Reduced attack lowers outgoing combat damage and counter damage.",
  },
  {
    key: "stun",
    short: "STN",
    title: "Stun: unit cannot attack this round.",
    detail:
      "Stunned units stay on board but cannot declare attacks until stun expires. They can still be targeted, damaged, buffed, or cleansed.",
  },
  {
    key: "exposed",
    short: "EXP",
    title: "Exposed: takes +1 combat damage.",
    detail:
      "Exposed increases damage taken in combat exchanges. Great for focus-fire and finishing fragile targets before they recover.",
  },
];

function unitStatusTokens(unit: MatchState["units"][string], turn: number): UnitStatusToken[] {
  const tokens: UnitStatusToken[] = [];
  const shields = unit.shieldCharges ?? 0;
  if (shields > 0) {
    const plural = shields === 1 ? "" : "s";
    tokens.push({
      key: "shield",
      short: `SH${shields}`,
      title: `Shield: blocks the next ${shields} hit${plural}.`,
    });
  }
  const baseAttack = getCardPreview(unit.cardId).attack ?? (unit.attack ?? 0);
  const currentAttack = unit.attack ?? 0;
  const totalAttackDown = Math.max(0, baseAttack - currentAttack);
  const temporaryAttackDown = (unit.tempAttackPenalty ?? 0) > 0 && (unit.tempAttackPenaltyUntilTurn ?? 0) >= turn;
  if (temporaryAttackDown || totalAttackDown > 0) {
    const shownPenalty = temporaryAttackDown ? unit.tempAttackPenalty ?? 0 : totalAttackDown;
    tokens.push({
      key: "atk-down",
      short: `ATK-${shownPenalty}`,
      title: temporaryAttackDown
        ? `Attack down: -${shownPenalty} attack until this round ends.`
        : `Attack down: current attack is ${shownPenalty} below base.`,
    });
  }
  if ((unit.stunnedUntilTurn ?? 0) > turn) {
    tokens.push({
      key: "stun",
      short: "STN",
      title: "Stun: cannot attack until next eligible turn.",
    });
  }
  if ((unit.exposedUntilTurn ?? -1) >= turn) {
    tokens.push({
      key: "exposed",
      short: "EXP",
      title: "Exposed: receives +1 damage in combat exchanges.",
    });
  }
  return tokens;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function ordinal(value: number): string {
  const abs = Math.abs(value);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = abs % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function sideUserLabel(match: MatchState, side: PlayerSide): string {
  const username = match.players[side].username || `side-${side}`;
  const p = side === "A" ? "P1" : "P2";
  return `${p}/${username}`;
}

function sideUserName(match: MatchState, side: PlayerSide): string {
  return match.players[side].username || `side-${side}`;
}

function withNamedSides(match: MatchState, text: string): string {
  return text
    .replace(/\bleader A\b/g, `leader ${sideUserName(match, "A")}`)
    .replace(/\bleader B\b/g, `leader ${sideUserName(match, "B")}`)
    .replace(/\bfor A\b/g, `for ${sideUserLabel(match, "A")}`)
    .replace(/\bfor B\b/g, `for ${sideUserLabel(match, "B")}`)
    .replace(/\bto A\b/g, `to ${sideUserLabel(match, "A")}`)
    .replace(/\bto B\b/g, `to ${sideUserLabel(match, "B")}`);
}

function formatMatchLogLine(match: MatchState, entry: MatchLogEntry): string {
  const raw = oneLine(entry.text);

  const placedBySide = raw.match(/^([AB]) played (.+?) to (front|back) (\d+)\.$/);
  if (placedBySide) {
    const side = placedBySide[1] as PlayerSide;
    const cardName = placedBySide[2] ?? "card";
    const lane = placedBySide[3] ?? "front";
    const col = Number(placedBySide[4] ?? "1");
    return `T${entry.turn} · ${sideUserLabel(match, side)}: placed ${cardName} on ${ordinal(col)} ${lane} row.`;
  }

  const woznyPlaced = raw.match(/^Wozny deployed (.+?) to (front|back) (\d+)\.$/);
  if (woznyPlaced) {
    const cardName = woznyPlaced[1] ?? "unit";
    const lane = woznyPlaced[2] ?? "front";
    const col = Number(woznyPlaced[3] ?? "1");
    return `T${entry.turn} · Bailiff AI: placed ${cardName} on ${ordinal(col)} ${lane} row.`;
  }

  const dealtLeader = raw.match(/^(.+?) hit leader ([AB]) for (\d+)\.$/);
  if (dealtLeader) {
    const attacker = dealtLeader[1] ?? "Unit";
    const targetSide = dealtLeader[2] as PlayerSide;
    const damage = dealtLeader[3] ?? "0";
    return `T${entry.turn} · ${attacker} dealt ${damage} damage to ${sideUserName(match, targetSide)} hero.`;
  }

  const leaderShieldReduced = raw.match(/^(.+?) leader damage reduced by (\d+) \(enemy front row: (\d+)\)\.$/);
  if (leaderShieldReduced) {
    const attacker = leaderShieldReduced[1] ?? "Unit";
    const reduction = leaderShieldReduced[2] ?? "0";
    const frontCount = leaderShieldReduced[3] ?? "0";
    return `T${entry.turn} · ${attacker} had hero damage reduced by ${reduction} (enemy front row: ${frontCount}).`;
  }

  const dealtUnit = raw.match(/^(.+?) dealt (\d+) to (.+?)\.$/);
  if (dealtUnit) {
    const attacker = dealtUnit[1] ?? "Unit";
    const damage = dealtUnit[2] ?? "0";
    const target = dealtUnit[3] ?? "target";
    return `T${entry.turn} · ${attacker} dealt ${damage} damage to ${target}.`;
  }

  const countered = raw.match(/^(.+?) countered (.+?) for (\d+)\.$/);
  if (countered) {
    const attacker = countered[1] ?? "Unit";
    const target = countered[2] ?? "target";
    const damage = countered[3] ?? "0";
    return `T${entry.turn} · ${attacker} countered ${target} for ${damage}.`;
  }

  const blockedByShield = raw.match(/^(.+?) blocked (.+?) with shield\.$/);
  if (blockedByShield) {
    const defender = blockedByShield[1] ?? "Unit";
    const source = blockedByShield[2] ?? "attack";
    return `T${entry.turn} · ${defender} blocked 1 shield layer (${source}).`;
  }

  const withActorPrefix = raw.match(/^([AB]) (.+)$/);
  if (withActorPrefix) {
    const side = withActorPrefix[1] as PlayerSide;
    const action = withNamedSides(match, withActorPrefix[2] ?? "");
    return `T${entry.turn} · ${sideUserLabel(match, side)}: ${action}`;
  }

  return `T${entry.turn} · ${withNamedSides(match, raw)}`;
}

function isHighSignalToastLine(line: string): boolean {
  const text = oneLine(line).toLowerCase();
  if (!text) {
    return false;
  }
  if (text.includes(": placed ")) {
    return false;
  }
  if (text.includes("start turn")) {
    return false;
  }

  const highSignalPatterns: RegExp[] = [
    /\bdealt \d+ damage\b/,
    /\bleader damage reduced\b/,
    /\bcountered\b/,
    /\bblocked 1 shield layer\b/,
    /\bshield\b/,
    /\bheal(?:ed)?\b/,
    /\bstun(?:ned)?\b/,
    /\bexposed\b/,
    /\batk-?down\b/,
    /\bprobation\b/,
    /\bshares\b/,
    /\bdebt\b/,
    /\biron curtain\b/,
    /\bconfiscat/i,
    /\bdestroyed\b/,
    /\bdefeated\b/,
    /\bverdict\b/,
    /\bwins?\b/,
  ];
  return highSignalPatterns.some((pattern) => pattern.test(text));
}

function applyArtFallback(event: ReactSyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget;
  const chainRaw = image.dataset.fallbackChain ?? "";
  const chain = chainRaw.length > 0 ? chainRaw.split("|").filter((src) => src.length > 0) : [];
  const fallbackSrc = image.dataset.fallbackSrc;
  if (fallbackSrc) {
    chain.unshift(fallbackSrc);
  }
  const currentSrc = image.getAttribute("src") ?? "";
  const indexRaw = image.dataset.fallbackIndex ?? "0";
  const parsedIndex = Number(indexRaw);
  let nextIndex = Number.isFinite(parsedIndex) ? parsedIndex : 0;
  while (nextIndex < chain.length && chain[nextIndex] === currentSrc) {
    nextIndex += 1;
  }
  if (nextIndex >= chain.length) {
    return;
  }
  image.dataset.fallbackIndex = String(nextIndex + 1);
  image.src = chain[nextIndex] ?? currentSrc;
}

type CardPreview = ReturnType<typeof getCardPreview>;
const HAND_ONBOARD_FALLBACK_PATH = "/assets/cards/fallback_default_ob.png";

function isJudgeSlot(lane: "front" | "back", col: number): boolean {
  return col === JUDGE_COL && (lane === "front" || lane === "back");
}

function canUnitCardDropTo(card: CardPreview, lane: "front" | "back", col: number, occupied: boolean): boolean {
  if (card.type !== "unit") {
    return false;
  }

  let baseAllowed = true;
  if (card.traits.includes("taunt") || card.traits.includes("front_only")) {
    baseAllowed = lane === "front";
  } else if (card.traits.includes("back_only")) {
    baseAllowed = lane === "back";
  }

  if (!baseAllowed) {
    if (col !== JUDGE_COL) {
      return false;
    }
    if (lane === "front") {
      baseAllowed = isJudgePositiveSpecialistCard(card.id);
    } else {
      baseAllowed = isJudgeCorruptSpecialistCard(card.id);
    }
  }

  if (!baseAllowed) {
    return false;
  }

  if (isJudgeSlot(lane, col)) {
    if (lane === "front" && !isJudgePositiveSpecialistCard(card.id)) {
      return false;
    }
    if (lane === "back" && !isJudgeCorruptSpecialistCard(card.id)) {
      return false;
    }
  }

  if (occupied && !card.traits.includes("flip")) {
    return false;
  }

  return true;
}

function elementCenter(el: Element): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function handOnboardArtPath(card: CardPreview): string {
  return `/assets/cards/${card.faction}/onboard/${card.id}_ob.png`;
}

function BoardUnitTile({ unit, turn }: { unit: MatchState["units"][string]; turn: number }) {
  const statuses = unitStatusTokens(unit, turn);
  const nonShieldStatuses = statuses.filter((status) => status.key !== "shield");
  const shieldCount = unit.shieldCharges ?? 0;
  const card = getCardPreview(unit.cardId);
  const avatarPath = handOnboardArtPath(card);

  return (
    <div className="slot-body board-unit-tile">
      <img
        className={`board-unit-avatar${card.traits.includes("taunt") ? " board-unit-avatar--taunt" : ""}`}
        src={avatarPath}
        data-fallback-src={HAND_ONBOARD_FALLBACK_PATH}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={applyArtFallback}
      />
      {nonShieldStatuses.length > 0 ? (
        <div className="board-unit-status-col" aria-label="Unit statuses">
          {nonShieldStatuses.map((status) => (
            <span key={`${status.key}-${status.short}`} className={`board-unit-status status-${status.key}`} title={status.title}>
              {status.short}
            </span>
          ))}
        </div>
      ) : null}
      <div className="board-unit-combat">
        <span>atk {unit.attack}</span>
        <span>hp {unit.health}</span>
      </div>
      {shieldCount > 0 ? <span className="board-unit-shield" title={`Shield: ${shieldCount}`}>{shieldCount}sh</span> : null}
      <span className="board-unit-name">{compactName(unit.name ?? "-", 11)}</span>
    </div>
  );
}

function BotGhostUnitTile({ cardId, cardName }: { cardId: string; cardName: string }) {
  const card = getCardPreview(cardId);
  const avatarPath = handOnboardArtPath(card);
  return (
    <div className="bot-ghost-tile" aria-hidden="true">
      <img
        className={`bot-ghost-avatar${card.traits.includes("taunt") ? " bot-ghost-avatar--taunt" : ""}`}
        src={avatarPath}
        data-fallback-src={HAND_ONBOARD_FALLBACK_PATH}
        alt=""
        loading="lazy"
        onError={applyArtFallback}
      />
      <span className="bot-ghost-name">{compactName(cardName || card.name || "Incoming", 11)}</span>
    </div>
  );
}

export function GameApp() {
  const ctx = useMemo(readContext, []);
  const webViewMode = getWebViewMode();
  const platformClass = ctx.clientName === "ANDROID" || ctx.clientName === "IOS" ? "platform-mobile" : "platform-desktop";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [eventToast, setEventToast] = useState("");
  const [eventToastQueue, setEventToastQueue] = useState<string[]>([]);
  const [renderNowMs, setRenderNowMs] = useState(() => Date.now());
  const [serverClockSkewMs, setServerClockSkewMs] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const [showStatusGuide, setShowStatusGuide] = useState(false);
  const [activeStatusGuideKey, setActiveStatusGuideKey] = useState<UnitStatusTokenKey>("shield");
  const [lobbyTab, setLobbyTab] = useState<LobbyTab>("quick");
  const [quickLeaderboardLevel, setQuickLeaderboardLevel] = useState<1 | 2 | 3>(1);
  const [selectedTutorialScenario, setSelectedTutorialScenario] = useState<TutorialScenarioId>("core_basics_v1");

  const [pendingInvites, setPendingInvites] = useState<InviteState[]>([]);
  const [pvpLobbies, setPvpLobbies] = useState<PvpLobbySummary[]>([]);
  const [quickMatches, setQuickMatches] = useState<LobbyMatchSummary[]>([]);
  const [pvpMatches, setPvpMatches] = useState<LobbyMatchSummary[]>([]);
  const [tutorialMatches, setTutorialMatches] = useState<LobbyMatchSummary[]>([]);
  const [leaderboardPvp, setLeaderboardPvp] = useState<LeaderboardRow[]>([]);
  const [leaderboardPveByLevel, setLeaderboardPveByLevel] = useState<{
    l1: LeaderboardRow[];
    l2: LeaderboardRow[];
    l3: LeaderboardRow[];
  }>({
    l1: [],
    l2: [],
    l3: [],
  });

  const [inviteTarget, setInviteTarget] = useState("");
  const [selectedFaction, setSelectedFaction] = useState<FactionId>("retail_mob");
  const [selectedPvpFaction, setSelectedPvpFaction] = useState<FactionId>("retail_mob");
  const [selectedTutorialFaction, setSelectedTutorialFaction] = useState<FactionId>("retail_mob");
  const [activePvpLobby, setActivePvpLobby] = useState<PvpLobbyState | null>(null);
  const [pvpJoinPulse, setPvpJoinPulse] = useState(false);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [mulliganPick, setMulliganPick] = useState<number[]>([]);

  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [dragAttack, setDragAttack] = useState<DragAttackState | null>(null);
  const [armedAttackerUnitId, setArmedAttackerUnitId] = useState<string | null>(null);
  const boardFitRef = useRef<HTMLDivElement | null>(null);
  const [boardSizePx, setBoardSizePx] = useState<number | null>(null);
  const handRailRef = useRef<HTMLDivElement | null>(null);
  const [centerHandIndex, setCenterHandIndex] = useState<number>(0);
  const [nakedLeverage, setNakedLeverage] = useState<2 | 3 | 4 | 5>(2);
  const [backArmed, setBackArmed] = useState(false);
  const [allyInspectCardId, setAllyInspectCardId] = useState<string | null>(null);
  const [enemyInspectUnitId, setEnemyInspectUnitId] = useState<string | null>(null);
  const [enemyInspectEventId, setEnemyInspectEventId] = useState<string | null>(null);
  const [enemyInspectJudge, setEnemyInspectJudge] = useState(false);
  const [botGhostPreviewByUnitId, setBotGhostPreviewByUnitId] = useState<Record<string, BotGhostPreviewSlot>>({});
  const [coachmarkPosition, setCoachmarkPosition] = useState<CoachmarkPosition | null>(null);
  const actionRequestInFlightRef = useRef(false);
  const attackInputCooldownUntilRef = useRef(0);
  const pvpJoinedPrevRef = useRef(false);
  const activePvpLobbyRef = useRef<PvpLobbyState | null>(null);
  const matchRef = useRef<MatchState | null>(null);
  const matchRequestSeqRef = useRef(0);
  const matchAppliedRequestSeqRef = useRef(0);
  const activeBotPlanIdRef = useRef<string | null>(null);
  const botPlanPreviewTimersRef = useRef<number[]>([]);
  const botPlanPreviewOverlayNodesRef = useRef<HTMLElement[]>([]);
  const botGhostSlotsByUnitIdRef = useRef<Record<string, BotGhostPreviewSlot>>({});
  const seenLogCursorRef = useRef<{ matchId: string; index: number } | null>(null);
  const battleShellRef = useRef<HTMLElement | null>(null);

  function enqueueEventToasts(lines: string[]): void {
    const sanitized = lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (sanitized.length === 0) {
      return;
    }
    setEventToastQueue((prev) => {
      const next = [...prev, ...sanitized];
      if (next.length <= 80) {
        return next;
      }
      return next.slice(next.length - 80);
    });
  }

  function openStatusGuide(key: UnitStatusTokenKey): void {
    setActiveStatusGuideKey(key);
    setShowStatusGuide(true);
  }

  function clearBotPlanPreviewTimers(): void {
    for (const timerId of botPlanPreviewTimersRef.current) {
      window.clearTimeout(timerId);
    }
    botPlanPreviewTimersRef.current = [];
  }

  function clearBotPlanPreviewOverlays(): void {
    for (const node of botPlanPreviewOverlayNodesRef.current) {
      node.remove();
    }
    botPlanPreviewOverlayNodesRef.current = [];
  }

  function stopBotPlanPreview(): void {
    activeBotPlanIdRef.current = null;
    botGhostSlotsByUnitIdRef.current = {};
    setBotGhostPreviewByUnitId({});
    clearBotPlanPreviewTimers();
    clearBotPlanPreviewOverlays();
  }

  function pulseBotPreviewElement(el: Element | null, variant: "slot" | "target" | "source" | "attack-source" = "slot"): void {
    if (!el) {
      return;
    }
    const cls =
      variant === "target"
        ? "bot-plan-preview-target"
        : variant === "attack-source"
          ? "bot-plan-preview-attack-source"
        : variant === "source"
          ? "bot-plan-preview-source"
          : "bot-plan-preview-slot";
    el.classList.add(cls);
    const removeAfterMs = variant === "target" || variant === "attack-source" ? 1000 : 420;
    const timer = window.setTimeout(() => el.classList.remove(cls), removeAfterMs);
    botPlanPreviewTimersRef.current.push(timer);
  }

  function botPlanSideLabel(planSide: PlayerSide, mySide: PlayerSide | null): "ally" | "enemy" {
    if (!mySide) {
      return "enemy";
    }
    return planSide === mySide ? "ally" : "enemy";
  }

  function findBoardSlotElementForPreview(
    sideLabel: "ally" | "enemy",
    lane: "front" | "back",
    col: number,
  ): Element | null {
    return document.querySelector(`[data-coach-slot="${sideLabel}-${lane}-${col}"]`);
  }

  function findLeaderTargetElementForPreview(targetSide: PlayerSide, mySide: PlayerSide | null): Element | null {
    const sideLabel = mySide && targetSide === mySide ? "you" : "enemy";
    return document.querySelector(`[data-leader-target="${sideLabel}"]`);
  }

  function findUnitElementForPreview(unitId: string): Element | null {
    return (
      document.querySelector(`[data-unit-id="${unitId}"]`) ??
      document.querySelector(`[data-owned-unit-id="${unitId}"]`)
    );
  }

  function resolveBotPreviewUnitCardId(unitId: string | undefined, visibleMatch: MatchState): string | null {
    if (!unitId) {
      return null;
    }
    const liveUnit = visibleMatch.units[unitId];
    if (liveUnit?.cardId) {
      return liveUnit.cardId;
    }
    const ghost = botGhostSlotsByUnitIdRef.current[unitId];
    return ghost?.cardId ?? null;
  }

  function spawnBotAttackAvatarOverlay(targetEl: Element | null, attackerCardId: string | null): void {
    if (!(targetEl instanceof HTMLElement) || !attackerCardId) {
      return;
    }
    const targetCard = getCardPreview(attackerCardId);
    const overlay = document.createElement("div");
    overlay.className = "bot-plan-attack-avatar-overlay";
    const img = document.createElement("img");
    img.className = `bot-plan-attack-avatar${targetCard.traits.includes("taunt") ? " bot-plan-attack-avatar--taunt" : ""}`;
    img.src = handOnboardArtPath(targetCard);
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    img.dataset.fallbackSrc = HAND_ONBOARD_FALLBACK_PATH;
    img.onerror = () => {
      const fallback = img.dataset.fallbackSrc;
      if (fallback && img.src !== fallback) {
        img.src = fallback;
      }
    };
    overlay.appendChild(img);
    targetEl.appendChild(overlay);
    botPlanPreviewOverlayNodesRef.current.push(overlay);
    const timer = window.setTimeout(() => {
      overlay.remove();
      botPlanPreviewOverlayNodesRef.current = botPlanPreviewOverlayNodesRef.current.filter((node) => node !== overlay);
    }, 560);
    botPlanPreviewTimersRef.current.push(timer);
  }

  function playBotPlanActionPreview(
    plan: BotTurnPlanPublic,
    action: BotPlannedAction,
    mySide: PlayerSide | null,
    visibleMatch: MatchState,
  ): void {
    const actingSideLabel = botPlanSideLabel(plan.side, mySide);

    if (action.kind === "play_unit") {
      const slotEl = findBoardSlotElementForPreview(actingSideLabel, action.lane, action.col);
      pulseBotPreviewElement(slotEl, "slot");
      if (action.unitId) {
        const unitId = action.unitId;
        const ghostSlot: BotGhostPreviewSlot = {
          sideLabel: actingSideLabel,
          lane: action.lane,
          col: action.col,
          cardId: action.cardId,
          cardName: action.cardName,
        };
        botGhostSlotsByUnitIdRef.current[unitId] = ghostSlot;
        setBotGhostPreviewByUnitId((prev) => ({ ...prev, [unitId]: ghostSlot }));
      }
      return;
    }

    if (action.kind === "play_non_unit") {
      if (action.target?.kind === "ally-unit" || action.target?.kind === "enemy-unit") {
        pulseBotPreviewElement(findUnitElementForPreview(action.target.unitId), "target");
        return;
      }
      if (action.target?.kind === "ally-leader") {
        pulseBotPreviewElement(findLeaderTargetElementForPreview(plan.side, mySide), "target");
        return;
      }
      if (action.target?.kind === "enemy-leader") {
        pulseBotPreviewElement(findLeaderTargetElementForPreview(enemyOf(plan.side), mySide), "target");
        return;
      }
      pulseBotPreviewElement(document.querySelector('[data-judge-target="true"]'), "slot");
      return;
    }

    if (action.kind === "judge_action") {
      const attackerEl = action.attackerUnitId ? findUnitElementForPreview(action.attackerUnitId) : null;
      // Reserved for future ghost-card rendering during bot previews.
      const ghost = action.attackerUnitId ? botGhostSlotsByUnitIdRef.current[action.attackerUnitId] : undefined;
      const sourceEl = attackerEl ?? (ghost ? findBoardSlotElementForPreview(ghost.sideLabel, ghost.lane, ghost.col) : null);
      pulseBotPreviewElement(sourceEl, "source");
      pulseBotPreviewElement(document.querySelector('[data-judge-target="true"]'), "target");
      return;
    }

    if (action.kind === "attack") {
      let sourceEl: Element | null = action.attackerUnitId ? findUnitElementForPreview(action.attackerUnitId) : null;
      if (!sourceEl && action.attackerUnitId) {
        const ghost = botGhostSlotsByUnitIdRef.current[action.attackerUnitId];
        if (ghost) {
          sourceEl = findBoardSlotElementForPreview(ghost.sideLabel, ghost.lane, ghost.col);
        }
      }
      pulseBotPreviewElement(sourceEl, "attack-source");
      const attackerCardId = resolveBotPreviewUnitCardId(action.attackerUnitId, visibleMatch);

      if (action.target.kind === "leader") {
        pulseBotPreviewElement(findLeaderTargetElementForPreview(enemyOf(plan.side), mySide), "target");
        return;
      }
      if (action.target.kind === "judge") {
        pulseBotPreviewElement(document.querySelector('[data-judge-target="true"]'), "target");
        return;
      }
      if (action.target.kind === "unit") {
        const targetEl = findUnitElementForPreview(action.target.unitId);
        pulseBotPreviewElement(targetEl, "target");
        spawnBotAttackAvatarOverlay(targetEl, attackerCardId);
        return;
      }
      const targetEl = document.querySelector(`[data-event-id="${action.target.eventUnitId}"]`);
      pulseBotPreviewElement(targetEl, "target");
      spawnBotAttackAvatarOverlay(targetEl, attackerCardId);
      return;
    }
  }

  function syncBotPlanPreview(plan: BotTurnPlanPublic | undefined, visibleMatch: MatchState): void {
    const mySide = sideForUser(visibleMatch, ctx.userId);
    if (!plan) {
      stopBotPlanPreview();
      return;
    }

    if (activeBotPlanIdRef.current === plan.id) {
      return;
    }

    stopBotPlanPreview();
    activeBotPlanIdRef.current = plan.id;

    const now = Date.now();
    for (let i = 0; i < plan.actions.length; i += 1) {
      const action = plan.actions[i];
      if (!action) {
        continue;
      }
      const offsetMs = Math.max(0, (plan.timelineMs[i] ?? 0) - (now - plan.createdAt));
      const timer = window.setTimeout(() => {
        if (activeBotPlanIdRef.current !== plan.id) {
          return;
        }
        playBotPlanActionPreview(plan, action, mySide, visibleMatch);
      }, offsetMs);
      botPlanPreviewTimersRef.current.push(timer);
    }

    const doneTimer = window.setTimeout(() => {
      if (activeBotPlanIdRef.current === plan.id) {
        stopBotPlanPreview();
      }
    }, Math.max(0, plan.readyAt - now) + 1200);
    botPlanPreviewTimersRef.current.push(doneTimer);
  }

  async function loadLobby(): Promise<void> {
    setLoading(true);
    setError("");

    const response = await postJson<
      { weekId: string; postId: string; userId: string; username: string },
      LobbyResponse
    >(API_ROUTES.lobby, {
      weekId: ctx.weekId,
      postId: ctx.postId,
      userId: ctx.userId,
      username: ctx.username,
    });

    setLoading(false);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    setPendingInvites(response.data.snapshot.pendingInvites ?? []);
    setPvpLobbies(response.data.snapshot.pvpLobbies ?? []);
    setQuickMatches(response.data.snapshot.quickPlayMatchSummaries ?? []);
    setPvpMatches(response.data.snapshot.pvpMatchSummaries ?? []);
    setTutorialMatches(response.data.snapshot.tutorialMatchSummaries ?? []);
    setLeaderboardPvp(response.data.snapshot.leaderboardPvp ?? []);
    setLeaderboardPveByLevel({
      l1: response.data.snapshot.leaderboardPveByLevel?.l1 ?? [],
      l2: response.data.snapshot.leaderboardPveByLevel?.l2 ?? [],
      l3: response.data.snapshot.leaderboardPveByLevel?.l3 ?? [],
    });
  }

  async function refreshMatch(matchId: string, allowSwitch = false): Promise<void> {
    if (actionRequestInFlightRef.current) {
      return;
    }
    matchRequestSeqRef.current += 1;
    const requestSeq = matchRequestSeqRef.current;
    const response = await postJson(API_ROUTES.matchGet, { matchId });
    if (actionRequestInFlightRef.current) {
      return;
    }
    if (!response.ok) {
      if (response.error.includes("Request conflict: state is being updated")) {
        return;
      }
      setError(response.error);
      return;
    }
    const nextMatch = response.data.match;
    const currentMatch = matchRef.current;
    if (
      shouldDiscardMatchResponse({
        requestSeq,
        latestAppliedRequestSeq: matchAppliedRequestSeqRef.current,
        allowSwitch,
        requestedMatchId: matchId,
        currentMatch,
        incomingMatch: nextMatch,
      })
    ) {
      return;
    }
    matchAppliedRequestSeqRef.current = requestSeq;
    matchRef.current = nextMatch;
    setMatch(nextMatch);
    syncBotPlanPreview(response.data.botPlan, nextMatch);
  }

  async function startAi(level: 1 | 2 | 3): Promise<void> {
    setLoading(true);
    setError("");

    const response = await postJson(API_ROUTES.matchAi, {
      weekId: ctx.weekId,
      postId: ctx.postId,
      userId: ctx.userId,
      username: ctx.username,
      level,
      faction: selectedFaction,
    });

    setLoading(false);

    if (!response.ok || !response.data.result.ok) {
      setError(response.ok ? response.data.result.error ?? "Failed to start AI match." : response.error);
      return;
    }

    setInfo(`Started AI level ${level}.`);
    stopBotPlanPreview();
    matchRef.current = response.data.result.match;
    setMatch(response.data.result.match);
    if (response.data.botPlan) {
      syncBotPlanPreview(response.data.botPlan, response.data.result.match);
    }
    setSelectedHandIndex(null);
  }

  async function startTutorial(scenarioId: TutorialScenarioId): Promise<void> {
    setLoading(true);
    setError("");

    const response = await postJson(API_ROUTES.tutorialStart, {
      weekId: ctx.weekId,
      postId: ctx.postId,
      userId: ctx.userId,
      username: ctx.username,
      scenarioId,
    });

    setLoading(false);

    if (!response.ok || !response.data.result.ok) {
      setError(response.ok ? response.data.result.error ?? "Failed to start tutorial." : response.error);
      return;
    }

    setInfo(`${tutorialScenarioLabel(scenarioId)} started.`);
    stopBotPlanPreview();
    matchRef.current = response.data.result.match;
    setMatch(response.data.result.match);
    setSelectedHandIndex(null);
  }

  async function startCleanupSandbox(faction: FactionId): Promise<void> {
    setLoading(true);
    setError("");

    const response = await postJson(API_ROUTES.tutorialCleanupStart, {
      weekId: ctx.weekId,
      postId: ctx.postId,
      userId: ctx.userId,
      username: ctx.username,
      faction,
    });

    setLoading(false);

    if (!response.ok || !response.data.result.ok) {
      setError(response.ok ? response.data.result.error ?? "Failed to start cleanup playground." : response.error);
      return;
    }

    setInfo("Cleanup Playground started.");
    matchRef.current = response.data.result.match;
    setMatch(response.data.result.match);
    setSelectedHandIndex(null);
  }

  async function createInvite(): Promise<void> {
    setLoading(true);
    setError("");

    const response = await postJson<
      { weekId: string; postId: string; userId: string; username: string; targetUsername: string; faction: FactionId },
      InviteLobbyResponse
    >(API_ROUTES.inviteCreate, {
      weekId: ctx.weekId,
      postId: ctx.postId,
      userId: ctx.userId,
      username: ctx.username,
      targetUsername: inviteTarget,
      faction: selectedPvpFaction,
    });

    setLoading(false);

    if (!response.ok) {
      if (response.error.includes("Request conflict: state is being updated")) {
        return;
      }
      setError(response.error);
      return;
    }

    setInviteTarget("");
    setInfo(`Invite sent to u/${response.data.invite.targetUsername}.`);
    setActivePvpLobby(response.data.lobby);
    await loadLobby();
  }

  async function acceptInvite(inviteId: string): Promise<void> {
    setLoading(true);
    setError("");

    const response = await postJson<
      { inviteId: string; userId: string; username: string; faction: FactionId },
      InviteLobbyResponse
    >(API_ROUTES.inviteAccept, {
      inviteId,
      userId: ctx.userId,
      username: ctx.username,
      faction: selectedPvpFaction,
    });

    setLoading(false);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    setInfo("Invite accepted. Joined PvP lobby.");
    setActivePvpLobby(response.data.lobby);
    setSelectedHandIndex(null);
    await loadLobby();
  }

  async function openPvpLobby(lobbyId: string): Promise<void> {
    const response = await postJson<{ lobbyId: string }, PvpLobbyResponse>(API_ROUTES.pvpLobbyGet, { lobbyId });
    if (!response.ok) {
      setError(response.error);
      if (response.error === "Lobby not found.") {
        await loadLobby();
      }
      return;
    }
    setActivePvpLobby(response.data.lobby);
  }

  async function refreshActivePvpLobby(lobbyId: string): Promise<void> {
    const response = await postJson<{ lobbyId: string }, PvpLobbyResponse>(API_ROUTES.pvpLobbyGet, { lobbyId });
    if (activePvpLobbyRef.current?.id !== lobbyId) {
      return;
    }
    if (!response.ok) {
      activePvpLobbyRef.current = null;
      setActivePvpLobby(null);
      setError(response.error);
      return;
    }

    const nextLobby = response.data.lobby;
    if (nextLobby.matchId) {
      activePvpLobbyRef.current = null;
      setActivePvpLobby(null);
      await refreshMatch(nextLobby.matchId, true);
      await loadLobby();
      return;
    }

    activePvpLobbyRef.current = nextLobby;
    setActivePvpLobby(nextLobby);
  }

  async function startActivePvpLobby(): Promise<void> {
    if (!activePvpLobby) {
      return;
    }
    setLoading(true);
    setError("");

    const response = await postJson<{ lobbyId: string; faction: FactionId }, PvpLobbyStartResponse>(API_ROUTES.pvpLobbyStart, {
      lobbyId: activePvpLobby.id,
      faction: selectedPvpFaction,
    });

    setLoading(false);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    if (response.data.result?.ok && response.data.result.match) {
      activePvpLobbyRef.current = null;
      setActivePvpLobby(null);
      stopBotPlanPreview();
      matchRef.current = response.data.result.match;
      setMatch(response.data.result.match);
      setSelectedHandIndex(null);
      await loadLobby();
      return;
    }

    const lobby = response.data.lobby;
    const readyCount = Number(lobby.inviterReady) + Number(lobby.targetReady);
    setInfo(`START GAME(${readyCount}/2) armed.`);
    setActivePvpLobby(lobby);
    await loadLobby();
  }

  async function dismantleActivePvpLobby(): Promise<void> {
    if (!activePvpLobby) {
      return;
    }

    setLoading(true);
    setError("");
    const response = await postJson<{ lobbyId: string }, { success: boolean }>(API_ROUTES.pvpLobbyDismantle, { lobbyId: activePvpLobby.id });
    setLoading(false);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    activePvpLobbyRef.current = null;
    setActivePvpLobby(null);
    setInfo("Battle dismantled.");
    await loadLobby();
  }

  async function runAction(route: string, action: Record<string, unknown>, options?: { clearArmed?: boolean }): Promise<void> {
    if (!match) return;
    actionRequestInFlightRef.current = true;
    try {
    matchRequestSeqRef.current += 1;
    const requestSeq = matchRequestSeqRef.current;

    const response = await postJson(route, {
      matchId: match.id,
      actorUserId: ctx.userId,
      action,
    });

    if (!response.ok) {
      setError(response.error);
      return;
    }

    if (!response.data.result.ok) {
      const nextMatch = response.data.result.match;
      if (
        shouldDiscardMatchResponse({
          requestSeq,
          latestAppliedRequestSeq: matchAppliedRequestSeqRef.current,
          allowSwitch: true,
          requestedMatchId: match.id,
          currentMatch: matchRef.current,
          incomingMatch: nextMatch,
        })
      ) {
        return;
      }
      setError(response.data.result.error ?? "Action failed.");
      matchAppliedRequestSeqRef.current = requestSeq;
      matchRef.current = nextMatch;
      setMatch(nextMatch);
      syncBotPlanPreview(response.data.botPlan, nextMatch);
      return;
    }

    const nextMatch = response.data.result.match;
    if (
      shouldDiscardMatchResponse({
        requestSeq,
        latestAppliedRequestSeq: matchAppliedRequestSeqRef.current,
        allowSwitch: true,
        requestedMatchId: match.id,
        currentMatch: matchRef.current,
        incomingMatch: nextMatch,
      })
    ) {
      return;
    }
    setError("");

    matchAppliedRequestSeqRef.current = requestSeq;
    matchRef.current = nextMatch;
    setMatch(nextMatch);
    syncBotPlanPreview(response.data.botPlan, nextMatch);
    if (options?.clearArmed !== false) {
      setArmedAttackerUnitId(null);
    }
    } finally {
      actionRequestInFlightRef.current = false;
    }
  }

  async function acknowledgeTutorialTip(): Promise<void> {
    if (!match) return;
    const response = await postJson(API_ROUTES.tutorialAcknowledge, { matchId: match.id });
    if (!response.ok) {
      setError(response.error);
      return;
    }
    if (!response.data.result.ok) {
      setError(response.data.result.error ?? "Tutorial acknowledge failed.");
      setMatch(response.data.result.match);
      return;
    }
    setError("");
    setMatch(response.data.result.match);
  }

  async function skipTutorialMatch(): Promise<void> {
    if (!match) return;
    const response = await postJson(API_ROUTES.tutorialSkip, { matchId: match.id });
    if (!response.ok) {
      setError(response.error);
      return;
    }
    if (!response.data.result.ok) {
      setError(response.data.result.error ?? "Failed to skip tutorial.");
      setMatch(response.data.result.match);
      return;
    }
    setInfo("Tutorial skipped.");
    stopBotPlanPreview();
    setMatch(null);
    setSelectedHandIndex(null);
    setMulliganPick([]);
    setExpandedCardId(null);
    setDragAttack(null);
    setArmedAttackerUnitId(null);
    setAllyInspectCardId(null);
    setEnemyInspectUnitId(null);
    setEnemyInspectEventId(null);
    setEnemyInspectJudge(false);
    await loadLobby();
  }

  function findAttackElements(attackerUnitId: string, target: AttackTarget): { attacker: Element; target: Element } | null {
    const attackerEl = document.querySelector(`[data-owned-unit-id="${attackerUnitId}"]`);
    if (!attackerEl) {
      return null;
    }

    let targetEl: Element | null = null;
    if (target.kind === "leader") {
      targetEl = document.querySelector('[data-leader-target="enemy"]');
    } else if (target.kind === "judge") {
      targetEl = document.querySelector('[data-judge-target="true"]');
    } else if (target.kind === "unit") {
      targetEl = document.querySelector(`[data-unit-id="${target.unitId}"]`);
    } else {
      targetEl = document.querySelector(`[data-event-id="${target.eventUnitId}"]`);
    }

    if (!targetEl) {
      return null;
    }

    return { attacker: attackerEl, target: targetEl };
  }

  async function playAttackAnimation(attackerUnitId: string, target: AttackTarget): Promise<void> {
    const pair = findAttackElements(attackerUnitId, target);
    if (!pair) {
      return;
    }

    const start = elementCenter(pair.attacker);
    const end = elementCenter(pair.target);
    const flyer = document.createElement("div");
    flyer.className = "attack-flyer";
    flyer.textContent = "⚔";
    flyer.style.transform = `translate(${start.x - 14}px, ${start.y - 14}px) scale(0.92)`;
    document.body.appendChild(flyer);

    const out = flyer.animate(
      [
        { transform: `translate(${start.x - 14}px, ${start.y - 14}px) scale(0.92)` },
        { transform: `translate(${end.x - 14}px, ${end.y - 14}px) scale(1.08)` },
      ],
      { duration: 210, easing: "cubic-bezier(0.22, 0.85, 0.25, 1)", fill: "forwards" },
    );
    await out.finished.catch(() => undefined);
    pair.target.classList.add("hit-flash");
    window.setTimeout(() => pair.target.classList.remove("hit-flash"), 180);

    const back = flyer.animate(
      [
        { transform: `translate(${end.x - 14}px, ${end.y - 14}px) scale(1.08)` },
        { transform: `translate(${start.x - 14}px, ${start.y - 14}px) scale(0.92)` },
      ],
      { duration: 190, easing: "cubic-bezier(0.42, 0, 0.58, 1)", fill: "forwards" },
    );
    await back.finished.catch(() => undefined);
    flyer.remove();
  }

  async function runAttackWithAnimation(side: PlayerSide, attackerUnitId: string, target: AttackTarget): Promise<void> {
    const now = Date.now();
    if (now < attackInputCooldownUntilRef.current) {
      return;
    }
    attackInputCooldownUntilRef.current = now + 160;

    // Disarm only the attacker being used now; keep any later quick re-selection intact.
    setArmedAttackerUnitId((prev) => (prev === attackerUnitId ? null : prev));
    const actionPromise = runAction(
      API_ROUTES.matchAttack,
      {
        side,
        attackerUnitId,
        target,
      },
      { clearArmed: false },
    );
    await playAttackAnimation(attackerUnitId, target);
    await actionPromise;
  }

  function clearActiveSelection(options?: { clearEnemyInspect?: boolean }): void {
    setSelectedHandIndex(null);
    setExpandedCardId(null);
    setArmedAttackerUnitId(null);
    setAllyInspectCardId(null);
    if (options?.clearEnemyInspect) {
      setEnemyInspectUnitId(null);
      setEnemyInspectEventId(null);
      setEnemyInspectJudge(false);
    }
  }

  function handleGlobalBattleDeselectClick(target: EventTarget | null): void {
    if (!target || !(target instanceof Element)) {
      return;
    }
    const hasActiveSelection = selectedHandIndex !== null || armedAttackerUnitId !== null || allyInspectCardId !== null;
    if (!hasActiveSelection) {
      return;
    }

    const keepSelectionSelectors = [
      ".slot",
      ".hand-card",
      ".leader-pill",
      ".judge-avatar",
      ".action-btn",
      ".close-btn",
      ".leverage-btn",
      ".badge-btn",
      ".status-chip-btn",
      ".hud-timer-orb",
      ".text-input",
      ".tutorial-coach-bubble",
      ".battle-log-modal",
      ".full-preview",
      ".mulligan-card",
    ].join(", ");

    if (target.closest(keepSelectionSelectors)) {
      return;
    }
    clearActiveSelection();
  }

  function onHandCardTap(idx: number, cardId: string): void {
    setExpandedCardId(null);
    setArmedAttackerUnitId(null);
    setAllyInspectCardId(cardId);
    centerHandCard(idx);
    if (selectedHandIndex === idx) {
      setExpandedCardId(cardId);
      return;
    }
    setSelectedHandIndex(idx);
  }

  function beginDragAttack(e: ReactPointerEvent<HTMLElement>, attackerUnitId: string): void {
    setDragAttack({ attackerUnitId, x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveDragAttack(e: ReactPointerEvent<HTMLElement>): void {
    if (!dragAttack) return;
    setDragAttack((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
  }

  function endDragAttack(e: ReactPointerEvent<HTMLElement>, mySide: PlayerSide): void {
    if (!dragAttack) return;

    const targetElement = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const target = targetElement?.closest("[data-attack-target]") as HTMLElement | null;

    if (target) {
      const kind = target.dataset.attackTarget;
      if (kind === "leader") {
        void runAttackWithAnimation(mySide, dragAttack.attackerUnitId, { kind: "leader" });
      }

      if (kind === "judge") {
        void runAttackWithAnimation(mySide, dragAttack.attackerUnitId, { kind: "judge" });
      }

      if (kind === "unit" && target.dataset.unitId) {
        void runAttackWithAnimation(mySide, dragAttack.attackerUnitId, { kind: "unit", unitId: target.dataset.unitId });
      }

      if (kind === "event" && target.dataset.eventId) {
        void runAttackWithAnimation(mySide, dragAttack.attackerUnitId, { kind: "event", eventUnitId: target.dataset.eventId });
      }
    }

    setDragAttack(null);
  }

  useEffect(() => {
    void loadLobby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  useEffect(() => {
    activePvpLobbyRef.current = activePvpLobby;
  }, [activePvpLobby]);

  useEffect(() => {
    if (!match) {
      seenLogCursorRef.current = null;
      setEventToast("");
      setEventToastQueue([]);
      setShowLog(false);
      return;
    }
    const cursor = seenLogCursorRef.current;
    if (!cursor || cursor.matchId !== match.id) {
      seenLogCursorRef.current = { matchId: match.id, index: match.log.length };
      setEventToast("");
      setEventToastQueue([]);
      return;
    }
    if (match.log.length <= cursor.index) {
      seenLogCursorRef.current = { matchId: match.id, index: match.log.length };
      return;
    }
    const newLines = match.log.slice(cursor.index).map((entry) => formatMatchLogLine(match, entry));
    const keyLines = newLines.filter(isHighSignalToastLine);
    seenLogCursorRef.current = { matchId: match.id, index: match.log.length };
    enqueueEventToasts(keyLines);
  }, [match]);

  useEffect(() => {
    if (!match) return;
    if (enemyInspectUnitId && !match.units[enemyInspectUnitId]) {
      setEnemyInspectUnitId(null);
    }
    if (enemyInspectEventId && !match.eventUnits[enemyInspectEventId]) {
      setEnemyInspectEventId(null);
    }
  }, [match, enemyInspectUnitId, enemyInspectEventId]);

  const activeMatchId = match?.id ?? null;
  const activeMatchUpdatedAt = match?.updatedAt ?? null;

  useEffect(() => {
    if (!activeMatchId) return;
    const id = window.setInterval(() => {
      setRenderNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [activeMatchId]);

  useEffect(() => {
    if (typeof activeMatchUpdatedAt !== "number") return;
    const sampleSkew = activeMatchUpdatedAt - Date.now();
    setServerClockSkewMs((prev) => Math.round(prev * 0.7 + sampleSkew * 0.3));
  }, [activeMatchUpdatedAt]);

  useEffect(() => {
    if (!match) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refreshMatch(match.id);
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id]);

  useEffect(() => {
    if (match || !activePvpLobby) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refreshActivePvpLobby(activePvpLobby.id);
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, activePvpLobby?.id]);

  useEffect(() => {
    if (!match) return;
    if (match.status === "finished") return;
    const deadlineAt = match.status === "mulligan" ? match.mulliganDeadlineAt : match.turnDeadlineAt;
    const syncedNow = Date.now() + serverClockSkewMs;
    const delayMs = Math.max(80, deadlineAt - syncedNow + 40);
    const id = window.setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      void refreshMatch(match.id);
    }, delayMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, match?.status, match?.turn, match?.turnDeadlineAt, match?.mulliganDeadlineAt, serverClockSkewMs]);

  useEffect(() => {
    const joinedNow = Boolean(activePvpLobby?.targetUserId);
    const inviterUserId = activePvpLobby?.inviterUserId;
    const hasLobby = Boolean(activePvpLobby?.id);
    const joinedBefore = pvpJoinedPrevRef.current;
    if (hasLobby && inviterUserId === ctx.userId && joinedNow && !joinedBefore) {
      setInfo("Opponent joined lobby.");
      setPvpJoinPulse(true);
    }
    pvpJoinedPrevRef.current = joinedNow;
    if (!hasLobby) {
      pvpJoinedPrevRef.current = false;
    }
  }, [activePvpLobby?.id, activePvpLobby?.targetUserId, activePvpLobby?.inviterUserId, ctx.userId]);

  useEffect(() => {
    if (!pvpJoinPulse) return;
    const id = window.setTimeout(() => setPvpJoinPulse(false), 1200);
    return () => window.clearTimeout(id);
  }, [pvpJoinPulse]);

  useEffect(() => {
    if (!info) return;
    const id = window.setTimeout(() => setInfo(""), 3000);
    return () => window.clearTimeout(id);
  }, [info]);

  useEffect(() => {
    if (eventToast || eventToastQueue.length === 0) return;
    const [next, ...rest] = eventToastQueue;
    setEventToast(next ?? "");
    setEventToastQueue(rest);
  }, [eventToast, eventToastQueue]);

  useEffect(() => {
    if (!eventToast) return;
    const id = window.setTimeout(() => setEventToast(""), 3000);
    return () => window.clearTimeout(id);
  }, [eventToast]);

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(""), 3000);
    return () => window.clearTimeout(id);
  }, [error]);

  useEffect(() => {
    if (!backArmed) return;
    const id = window.setTimeout(() => setBackArmed(false), 1800);
    return () => window.clearTimeout(id);
  }, [backArmed]);

  useEffect(() => {
    const node = boardFitRef.current;
    if (!node) return;

    const updateSize = () => {
      const nextSize = Math.floor(Math.min(node.clientWidth, node.clientHeight));
      setBoardSizePx(nextSize > 120 ? nextSize : null);
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(node);
    window.addEventListener("resize", updateSize);
    window.addEventListener("orientationchange", updateSize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("orientationchange", updateSize);
    };
  }, [match?.id]);

  useEffect(() => {
    updateCenterHandIndex();
  }, [match?.id, match?.updatedAt]);

  useEffect(() => {
    setAllyInspectCardId(null);
    setEnemyInspectUnitId(null);
    setEnemyInspectEventId(null);
    setEnemyInspectJudge(false);
  }, [match?.id]);

  const mySide = match ? sideForUser(match, ctx.userId) : null;
  const enemySide = mySide ? enemyOf(mySide) : null;
  const myPlayer = mySide && match ? match.players[mySide] : null;
  const enemyPlayer = enemySide && match ? match.players[enemySide] : null;

  const syncedNowMs = renderNowMs + serverClockSkewMs;
  const mulliganSeconds = match ? secsLeft(match.mulliganDeadlineAt, syncedNowMs) : 0;
  const turnSeconds = match ? secsLeft(match.turnDeadlineAt, syncedNowMs) : 0;
  const isMyTurn = Boolean(match && mySide && match.status === "active" && match.activeSide === mySide);

  const selectedCardId =
    selectedHandIndex !== null && myPlayer && myPlayer.hand[selectedHandIndex]
      ? myPlayer.hand[selectedHandIndex]
      : null;

  const selectedCard = selectedCardId ? getCardPreview(selectedCardId) : null;
  const expandedCard = expandedCardId ? getCardPreview(expandedCardId) : null;
  const expandedAbilitiesLine = useMemo(
    () => (expandedCardId ? getDisplayAbilitiesLine(getCardPreview(expandedCardId)) : ""),
    [expandedCardId],
  );
  const allyInspectCard = selectedCard ?? (allyInspectCardId ? getCardPreview(allyInspectCardId) : null);
  const enemyInspectUnit =
    enemyInspectUnitId && match && enemySide && match.units[enemyInspectUnitId]?.owner === enemySide
      ? match.units[enemyInspectUnitId]
      : null;
  const enemyInspectCard = enemyInspectUnit ? getCardPreview(enemyInspectUnit.cardId) : null;
  const enemyInspectStatuses = enemyInspectUnit && match ? unitStatusTokens(enemyInspectUnit, match.turn) : [];
  const enemyInspectEvent = enemyInspectEventId && match ? match.eventUnits[enemyInspectEventId] ?? null : null;
  const enemyInspectEventDetails = enemyInspectEvent
    ? eventInspectDetails(enemyInspectEvent)
    : enemyInspectJudge
      ? judgeInspectDetails()
      : null;
  const isFinished = Boolean(match?.status === "finished");
  const didWin = Boolean(match && mySide && match.winnerSide === mySide);
  const selectedTargetRule = selectedCard?.targetRule ?? "none";
  const selectedCardIsUnit = selectedCard?.type === "unit";
  const canPlaySelected = Boolean(isMyTurn && mySide && myPlayer && selectedHandIndex !== null && selectedCardId);
  const canJudgeCastSelected = Boolean(canPlaySelected && !selectedCardIsUnit && selectedTargetRule === "none");
  const expectsAllyUnitTarget = Boolean(canPlaySelected && !selectedCardIsUnit && (selectedTargetRule === "ally-unit" || selectedTargetRule === "ally-unit-or-leader"));
  const expectsEnemyUnitTarget = Boolean(canPlaySelected && !selectedCardIsUnit && (selectedTargetRule === "enemy-unit" || selectedTargetRule === "enemy-unit-or-leader"));
  const expectsAllyLeaderTarget = Boolean(canPlaySelected && !selectedCardIsUnit && selectedTargetRule === "ally-unit-or-leader");
  const expectsEnemyLeaderTarget = Boolean(canPlaySelected && !selectedCardIsUnit && selectedTargetRule === "enemy-unit-or-leader");
  const armedOwnedUnit = armedAttackerUnitId && match ? match.units[armedAttackerUnitId] ?? null : null;

  const canDropSelectedToSlot = (lane: "front" | "back", col: number, occupied: boolean): boolean => {
    if (!canPlaySelected || !selectedCardIsUnit || !selectedCard || !myPlayer) {
      return false;
    }
    if (!canUnitCardDropTo(selectedCard, lane, col, occupied)) {
      return false;
    }
    return true;
  };

  const findRepositionLaneForUnit = (unit: MatchState["units"][string] | null): "front" | "back" | null => {
    if (!unit || !myPlayer || unit.owner !== mySide || !isJudgeSpecialistCard(unit.cardId)) {
      return null;
    }
    const canGreen = isJudgePositiveSpecialistCard(unit.cardId);
    const canBlue = isJudgeCorruptSpecialistCard(unit.cardId);
    const preferred: Array<"front" | "back"> = [];
    if (canGreen && canBlue) {
      preferred.push(unit.lane === "front" ? "front" : "back");
    }
    if (canGreen && !preferred.includes("front")) preferred.push("front");
    if (canBlue && !preferred.includes("back")) preferred.push("back");

    for (const lane of preferred) {
      if (unit.lane === lane && unit.col === JUDGE_COL) continue;
      if (myPlayer.board[lane][JUDGE_COL] === null) {
        return lane;
      }
    }
    return null;
  };

  const repositionLane = findRepositionLaneForUnit(armedOwnedUnit);
  const canRepositionArmed = Boolean(
    isMyTurn &&
      mySide &&
      armedOwnedUnit &&
      armedOwnedUnit.owner === mySide &&
      !(armedOwnedUnit.stunnedUntilTurn && armedOwnedUnit.stunnedUntilTurn > (match?.turn ?? 0)) &&
      !armedOwnedUnit.judgeRepositionUsed &&
      repositionLane,
  );

  const showMulligan = Boolean(match && mySide && match.status === "mulligan" && !match.players[mySide].mulliganDone);
  const selectedFactionInfo = FACTIONS.find((f) => f.id === selectedFaction) ?? FACTIONS[0]!;
  const selectedPvpFactionInfo = FACTIONS.find((f) => f.id === selectedPvpFaction) ?? FACTIONS[0]!;
  const selectedTutorialFactionInfo = FACTIONS.find((f) => f.id === selectedTutorialFaction) ?? FACTIONS[0]!;
  const activePvpReadyCount = activePvpLobby ? Number(activePvpLobby.inviterReady) + Number(activePvpLobby.targetReady) : 0;
  const activePvpIsInviter = Boolean(activePvpLobby && activePvpLobby.inviterUserId === ctx.userId);
  const activePvpSelfReady = Boolean(activePvpLobby && (activePvpIsInviter ? activePvpLobby.inviterReady : activePvpLobby.targetReady));
  const activePvpTargetJoined = Boolean(activePvpLobby?.targetUserId);
  const activePvpCanStart = Boolean(activePvpLobby && activePvpTargetJoined && !activePvpLobby.matchId && !activePvpSelfReady);
  const activePvpTitle = activePvpLobby
    ? activePvpLobby.targetUserId
      ? `${activePvpLobby.inviterUsername} vs ${activePvpLobby.targetUsername}`
      : `${activePvpLobby.inviterUsername} vs waiting for opponent ${activePvpLobby.targetUsername}`
    : "";
  const quickLeaderboardRows =
    quickLeaderboardLevel === 1 ? leaderboardPveByLevel.l1 : quickLeaderboardLevel === 2 ? leaderboardPveByLevel.l2 : leaderboardPveByLevel.l3;
  const tutorialState = match?.mode === "tutorial" ? match.tutorial : null;
  const tutorialCoachHandIndex =
    tutorialState?.coachAnchorKind === "hand-card" && tutorialState.coachCardId && myPlayer
      ? myPlayer.hand.findIndex((cardId) => cardId === tutorialState.coachCardId)
      : -1;
  const tutorialCoachSelector =
    tutorialState?.coachAnchorKind === "hand-card" && tutorialCoachHandIndex >= 0
      ? `[data-hand-index="${tutorialCoachHandIndex}"]`
      : tutorialState?.coachAnchorKind === "hand-card" && tutorialState.coachCardId
        ? `[data-hand-card-id="${tutorialState.coachCardId}"]`
      : tutorialState?.coachAnchorKind === "slot" &&
          tutorialState.coachSide &&
          tutorialState.coachLane &&
          typeof tutorialState.coachCol === "number"
        ? `[data-coach-slot="${tutorialState.coachSide}-${tutorialState.coachLane}-${tutorialState.coachCol}"]`
        : tutorialState?.coachAnchorKind === "button" && tutorialState.coachButtonId
          ? `[data-coach-button="${tutorialState.coachButtonId}"]`
          : null;
  const formattedBattleLog = useMemo(() => {
    if (!match) {
      return [];
    }
    return match.log.map((entry) => formatMatchLogLine(match, entry));
  }, [match]);
  const hudTurnLabel = `Turn ${match?.turn ?? 0}`;
  const hudFlowLabel = isMyTurn ? "Your turn" : `Side ${match?.activeSide ?? "-"}`;
  const activeStatusGuide = STATUS_LEGEND.find((status) => status.key === activeStatusGuideKey) || STATUS_LEGEND[0];
  const botGhostPreviewBySlot = useMemo(() => {
    const bySlot: Record<string, BotGhostPreviewSlot> = {};
    for (const ghost of Object.values(botGhostPreviewByUnitId)) {
      bySlot[botGhostSlotKey(ghost.sideLabel, ghost.lane, ghost.col)] = ghost;
    }
    return bySlot;
  }, [botGhostPreviewByUnitId]);

  useEffect(() => () => {
    activeBotPlanIdRef.current = null;
    botGhostSlotsByUnitIdRef.current = {};
    setBotGhostPreviewByUnitId({});
    for (const timerId of botPlanPreviewTimersRef.current) {
      window.clearTimeout(timerId);
    }
    botPlanPreviewTimersRef.current = [];
    for (const node of botPlanPreviewOverlayNodesRef.current) {
      node.remove();
    }
    botPlanPreviewOverlayNodesRef.current = [];
  }, []);

  useEffect(() => {
    if (!match) {
      activeBotPlanIdRef.current = null;
      botGhostSlotsByUnitIdRef.current = {};
      setBotGhostPreviewByUnitId({});
      for (const timerId of botPlanPreviewTimersRef.current) {
        window.clearTimeout(timerId);
      }
      botPlanPreviewTimersRef.current = [];
      for (const node of botPlanPreviewOverlayNodesRef.current) {
        node.remove();
      }
      botPlanPreviewOverlayNodesRef.current = [];
    }
  }, [match]);

  useEffect(() => {
    if (!tutorialState?.paused) {
      return;
    }
    if (tutorialCoachHandIndex < 0) {
      return;
    }
    centerHandCard(tutorialCoachHandIndex);
    setSelectedHandIndex(tutorialCoachHandIndex);
  }, [tutorialState?.paused, tutorialCoachHandIndex]);

  useEffect(() => {
    if (!tutorialState || !battleShellRef.current) {
      setCoachmarkPosition(null);
      return;
    }

    const shell = battleShellRef.current;
    const updateCoach = () => {
      if (!shell) {
        setCoachmarkPosition(null);
        return;
      }
      const shellRect = shell.getBoundingClientRect();
      const bubbleWidth = Math.min(shellRect.width * 0.76, 290);
      const bubbleHeight = 220;
      const minX = bubbleWidth / 2 + 8;
      const maxX = shellRect.width - bubbleWidth / 2 - 8;
      const fallbackLeft = shellRect.width / 2;
      const fallbackTop = Math.min(86, Math.max(56, shellRect.height * 0.18));

      if (!tutorialCoachSelector) {
        setCoachmarkPosition({ left: fallbackLeft, top: fallbackTop, placement: "bottom" });
        return;
      }

      const target = shell.querySelector(tutorialCoachSelector) as HTMLElement | null;
      if (!target) {
        setCoachmarkPosition({ left: fallbackLeft, top: fallbackTop, placement: "bottom" });
        return;
      }

      const rect = target.getBoundingClientRect();
      const targetCenterX = rect.left - shellRect.left + rect.width / 2;
      const topGap = rect.top - shellRect.top;
      const bottomGap = shellRect.bottom - rect.bottom;
      let placement: "top" | "bottom" = bottomGap > topGap ? "bottom" : "top";
      let anchorY = placement === "top" ? rect.top - shellRect.top - 8 : rect.bottom - shellRect.top + 8;
      if (placement === "top" && anchorY - bubbleHeight < 8) {
        placement = "bottom";
        anchorY = rect.bottom - shellRect.top + 8;
      }
      if (placement === "bottom" && anchorY + bubbleHeight > shellRect.height - 8) {
        placement = "top";
        anchorY = rect.top - shellRect.top - 8;
      }

      const clampedX = Math.max(minX, Math.min(maxX, targetCenterX));
      const clampedY =
        placement === "top"
          ? Math.max(bubbleHeight + 8, Math.min(shellRect.height - 8, anchorY))
          : Math.max(8, Math.min(shellRect.height - bubbleHeight - 8, anchorY));

      setCoachmarkPosition({
        left: clampedX,
        top: clampedY,
        placement,
      });
    };

    updateCoach();
    const raf = window.requestAnimationFrame(updateCoach);
    window.addEventListener("resize", updateCoach);
    window.addEventListener("orientationchange", updateCoach);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateCoach);
      window.removeEventListener("orientationchange", updateCoach);
    };
  }, [tutorialState, tutorialCoachSelector, match?.updatedAt, selectedHandIndex, centerHandIndex, webViewMode]);

  function tryAttackTarget(target: AttackTarget): void {
    if (!mySide || !isMyTurn || !armedAttackerUnitId) return;
    void runAttackWithAnimation(mySide, armedAttackerUnitId, target);
  }

  function playSelectedTo(lane: "front" | "back", col: number, target?: PlayCardTarget): void {
    if (!isMyTurn || !mySide || selectedHandIndex === null || !myPlayer) return;
    const cardId = myPlayer.hand[selectedHandIndex];
    if (!cardId) return;
    const card = getCardPreview(cardId);
    if (card.type === "unit") {
      const occupiedUnitId = myPlayer.board[lane][col];
      const flipSurcharge = occupiedUnitId && card.traits.includes("flip")
        ? Math.max(1, Math.ceil(card.costShares * 0.25))
        : 0;
      const totalCost = card.costShares + flipSurcharge;
      if (myPlayer.shares < totalCost) {
        setError(`Not enough shares to play ${card.name} (${myPlayer.shares}/${totalCost}).`);
        return;
      }
    }
    const action: {
      side: PlayerSide;
      handIndex: number;
      lane: "front" | "back";
      col: number;
      leverage?: 2 | 3 | 4 | 5;
      target?: PlayCardTarget;
    } = {
      side: mySide,
      handIndex: selectedHandIndex,
      lane,
      col,
    };
    if (target) {
      action.target = target;
    }
    if (cardId === "naked_shorting") {
      action.leverage = nakedLeverage;
    }
    void runAction(API_ROUTES.matchPlay, action);
    setSelectedHandIndex(null);
  }

  function playSelectedOnTarget(target: PlayCardTarget): void {
    playSelectedTo("front", 0, target);
  }

  function castSelectedWithoutTarget(): void {
    if (!canPlaySelected || selectedCardIsUnit || selectedTargetRule !== "none") return;
    playSelectedTo("front", 0);
  }

  function repositionArmedToJudge(): void {
    if (!canRepositionArmed || !mySide || !armedOwnedUnit) {
      return;
    }
    void runAction(API_ROUTES.matchRepositionJudge, {
      side: mySide,
      unitId: armedOwnedUnit.id,
    });
  }

  function updateCenterHandIndex(): void {
    const rail = handRailRef.current;
    if (!rail) return;
    const cards = Array.from(rail.querySelectorAll<HTMLElement>("[data-hand-index]"));
    if (cards.length === 0) return;

    const railRect = rail.getBoundingClientRect();
    const centerX = railRect.left + railRect.width / 2;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const dist = Math.abs(cardCenter - centerX);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIndex = Number(card.dataset.handIndex ?? 0);
      }
    }

    setCenterHandIndex(bestIndex);
  }

  function centerHandCard(idx: number): void {
    const rail = handRailRef.current;
    if (!rail) return;
    const target = rail.querySelector<HTMLElement>(`[data-hand-index="${idx}"]`);
    if (!target) return;
    const railRect = rail.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const delta = targetRect.left - railRect.left - railRect.width / 2 + targetRect.width / 2;
    const nextLeft = Math.max(0, rail.scrollLeft + delta);
    rail.scrollTo({ left: nextLeft, behavior: "smooth" });
  }

  return (
    <div className="game-root">
      <div className={`app-shell ${match ? "app-shell--battle" : "app-shell--lobby"} wv-${webViewMode} ${platformClass}`}>
        {error ? <div className="status-toast error">{error}</div> : null}
        {info ? <div className="status-toast info">{info}</div> : null}
        {eventToast ? <div className="status-toast info event">{eventToast}</div> : null}

        {!match ? (
          <>
          <section className="lobby-screen">
            <header className="topbar lobby-topbar">
              <h1>Court of Capital</h1>
              <p>Week #{ctx.weekNumber} {ctx.weekId} · Serve the Justice or be the Justice</p>
              <div className="status-row">
                <span className="badge">Deck 100</span>
                <span className="badge">Turn 35s</span>
                <span className="badge">Mobile-first</span>
              </div>
            </header>
            <nav className="lobby-tabs" aria-label="Lobby sections">
              <button className={`lobby-tab ${lobbyTab === "quick" ? "active" : ""}`} onClick={() => setLobbyTab("quick")}>
                Quick Play
              </button>
              <button className={`lobby-tab ${lobbyTab === "pvp" ? "active" : ""}`} onClick={() => setLobbyTab("pvp")}>
                PvP Play
              </button>
              <button className={`lobby-tab ${lobbyTab === "tutorial" ? "active" : ""}`} onClick={() => setLobbyTab("tutorial")}>
                Tutorial
              </button>
            </nav>

            {lobbyTab === "quick" ? (
              <>
                <article className="card-block lobby-main lobby-main--quick">
                  <div className="panel-head">
                    <h2>Quick Play</h2>
                    <p className="subtle">Pick your faction, then open an AI court instantly.</p>
                  </div>
                  <div className="faction-picker faction-grid">
                    {FACTIONS.map((f) => (
                      <button
                        key={f.id}
                        className={`faction-btn faction-btn--rich ${selectedFaction === f.id ? "active" : ""}`}
                        onClick={() => setSelectedFaction(f.id)}
                      >
                        <strong>{f.label}</strong>
                        <span>{f.motto}</span>
                        <small>{f.tone}</small>
                      </button>
                    ))}
                  </div>
                  <div className="grid-3 queue-grid">
                    <button className="action-btn action-btn--primary" disabled={loading} onClick={() => void startAi(1)}>
                      <span>AI L1</span>
                      <small>Rookie court</small>
                    </button>
                    <button className="action-btn action-btn--primary" disabled={loading} onClick={() => void startAi(2)}>
                      <span>AI L2</span>
                      <small>Balanced rival</small>
                    </button>
                    <button className="action-btn action-btn--primary" disabled={loading} onClick={() => void startAi(3)}>
                      <span>AI L3</span>
                      <small>Hard pressure</small>
                    </button>
                  </div>
                </article>

                <div className="lobby-side-grid">
                  <article className="card-block small resume-block">
                    <h3>Resume Match</h3>
                    <ul className="simple-list">
                      {quickMatches.length === 0 ? <li>No active AI matches.</li> : null}
                      {quickMatches.map((summary) => (
                        <li key={summary.matchId}>
                          <span>{summarizeResumeMatch(summary, ctx.userId)}</span>
                          <button className="action-btn" onClick={() => void refreshMatch(summary.matchId, true)}>Open</button>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="card-block small">
                    <h3>AI Leaderboard</h3>
                    <div className="status-row">
                      <button
                        className={`badge-btn ${quickLeaderboardLevel === 1 ? "active" : ""}`}
                        onClick={() => setQuickLeaderboardLevel(1)}
                      >
                        L1
                      </button>
                      <button
                        className={`badge-btn ${quickLeaderboardLevel === 2 ? "active" : ""}`}
                        onClick={() => setQuickLeaderboardLevel(2)}
                      >
                        L2
                      </button>
                      <button
                        className={`badge-btn ${quickLeaderboardLevel === 3 ? "active" : ""}`}
                        onClick={() => setQuickLeaderboardLevel(3)}
                      >
                        L3
                      </button>
                    </div>
                    <ol className="ranking-list">
                      {quickLeaderboardRows.length === 0 ? <li>No finished matches yet.</li> : null}
                      {quickLeaderboardRows.map((row) => (
                        <li key={`quick-${quickLeaderboardLevel}-${row.username}`}>u/{row.username} · W{row.wins} L{row.losses} · M{row.matches}</li>
                      ))}
                    </ol>
                  </article>

                  <article className="card-block small">
                    <h3>Deck Focus</h3>
                    <p className="subtle">{selectedFactionInfo.label} · {selectedFactionInfo.motto}</p>
                    <p className="subtle">{selectedFactionInfo.tone}</p>
                  </article>
                </div>
              </>
            ) : null}

            {lobbyTab === "pvp" ? (
              <>
                <article className="card-block lobby-main lobby-main--invite">
                  <div className="panel-head">
                    <h2>Invite PvP</h2>
                    <p className="subtle">Ping a username without `u/` and start a direct trial.</p>
                  </div>
                  <div className="faction-picker faction-grid">
                    {FACTIONS.map((f) => (
                      <button
                        key={`pvp-${f.id}`}
                        className={`faction-btn faction-btn--rich ${selectedPvpFaction === f.id ? "active" : ""}`}
                        onClick={() => setSelectedPvpFaction(f.id)}
                      >
                        <strong>{f.label}</strong>
                        <span>{f.motto}</span>
                        <small>{f.tone}</small>
                      </button>
                    ))}
                  </div>
                  <div className="inline-input">
                    <input className="text-input" placeholder="username" value={inviteTarget} onChange={(e) => setInviteTarget(e.target.value)} />
                    <button className="action-btn action-btn--primary" onClick={() => void createInvite()} disabled={loading || inviteTarget.trim().length < 2}>Send Subpoena</button>
                  </div>
                  <p className="subtle">Selected deck: {selectedPvpFactionInfo.label} · {selectedPvpFactionInfo.motto}</p>
                </article>

                <div className="lobby-side-grid">
                  <article className="card-block small">
                    <h3>Pending Invites</h3>
                    <ul className="simple-list">
                      {pendingInvites.length === 0 ? <li>No pending invites.</li> : null}
                      {pendingInvites.map((invite) => (
                        <li key={invite.id}>
                          <span>u/{invite.inviterUsername}</span>
                          <button className="action-btn" onClick={() => void acceptInvite(invite.id)}>Accept</button>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="card-block small">
                    <h3>Open Lobbies</h3>
                    <ul className="simple-list">
                      {pvpLobbies.length === 0 ? <li>No open lobbies.</li> : null}
                      {pvpLobbies.map((lobby) => (
                        <li key={lobby.lobbyId}>
                          <span>
                            {lobby.targetJoined
                              ? `${maskResumeName(lobby.inviterUsername)} vs ${maskResumeName(lobby.targetUsername)}`
                              : `${maskResumeName(lobby.inviterUsername)} vs waiting ${maskResumeName(lobby.targetUsername)}`} · START GAME({lobby.readyCount}/2)
                          </span>
                          <button className="action-btn" onClick={() => void openPvpLobby(lobby.lobbyId)}>Open</button>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="card-block small resume-block">
                    <h3>Resume Match</h3>
                    <ul className="simple-list">
                      {pvpMatches.length === 0 ? <li>No active PvP matches.</li> : null}
                      {pvpMatches.map((summary) => (
                        <li key={summary.matchId}>
                          <span>{summarizeResumeMatch(summary, ctx.userId)}</span>
                          <button className="action-btn" onClick={() => void refreshMatch(summary.matchId, true)}>Open</button>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="card-block small">
                    <h3>Leaderboard</h3>
                    <ol className="ranking-list">
                      {leaderboardPvp.length === 0 ? <li>No finished matches yet.</li> : null}
                      {leaderboardPvp.map((row) => (
                        <li key={`pvp-${row.username}`}>u/{row.username} · W{row.wins} L{row.losses} · M{row.matches}</li>
                      ))}
                    </ol>
                  </article>
                </div>
              </>
            ) : null}

            {lobbyTab === "tutorial" ? (
              <>
                <article className="card-block lobby-main">
                  <div className="panel-head">
                    <h2>Tutorial Arena</h2>
                    <p className="subtle">Scripted real match. Timer pauses for tip, then hides during task execution.</p>
                  </div>
                  <div className="status-row">
                    <span className="badge">Tutorial #0 Basics</span>
                    <span className="badge">Tutorial #1 Buffs/Debuffs</span>
                    <span className="badge">Tutorial #2 Judge Dependencies</span>
                    <span className="badge">Sandbox Playground</span>
                  </div>
                  <div className="faction-picker faction-grid">
                    {TUTORIAL_SCENARIOS.map((scenario) => (
                      <button
                        key={scenario.id}
                        className={`faction-btn faction-btn--rich ${selectedTutorialScenario === scenario.id ? "active" : ""}`}
                        onClick={() => setSelectedTutorialScenario(scenario.id)}
                      >
                        <strong>{scenario.label}</strong>
                        <span>{scenario.subtitle}</span>
                      </button>
                    ))}
                  </div>
                  <div className="panel-head">
                    <h3>Sandbox Faction</h3>
                    <p className="subtle">Used only by Clean-up the courtroom.</p>
                  </div>
                  <div className="faction-picker faction-grid">
                    {FACTIONS.map((f) => (
                      <button
                        key={`tutorial-sandbox-${f.id}`}
                        className={`faction-btn faction-btn--rich ${selectedTutorialFaction === f.id ? "active" : ""}`}
                        onClick={() => setSelectedTutorialFaction(f.id)}
                      >
                        <strong>{f.label}</strong>
                        <span>{f.motto}</span>
                        <small>{f.tone}</small>
                      </button>
                    ))}
                  </div>
                  <p className="subtle">Sandbox deck: {selectedTutorialFactionInfo.label} · {selectedTutorialFactionInfo.motto}</p>
                  <div className="queue-grid tutorial-queue-grid">
                    <button className="action-btn action-btn--primary" disabled={loading} onClick={() => void startTutorial(selectedTutorialScenario)}>
                      <span>Start Selected Tutorial</span>
                      <small>{tutorialScenarioLabel(selectedTutorialScenario)}</small>
                    </button>
                    <button className="action-btn action-btn--primary" disabled={loading} onClick={() => void startCleanupSandbox(selectedTutorialFaction)}>
                      <span>Clean-up the courtroom</span>
                      <small>Sandbox · 10000 shares · Wozny boss</small>
                    </button>
                  </div>
                </article>

                <div className="lobby-side-grid">
                  <article className="card-block small resume-block">
                    <h3>Resume Tutorial</h3>
                    <ul className="simple-list">
                      {tutorialMatches.length === 0 ? <li>No active tutorial or sandbox match.</li> : null}
                      {tutorialMatches.map((summary) => (
                        <li key={summary.matchId}>
                          <span>{shortId(summary.matchId)} · {tutorialResumeLabel(summary)}</span>
                          <button className="action-btn" onClick={() => void refreshMatch(summary.matchId, true)}>Open</button>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="card-block small">
                    <h3>Step Flow</h3>
                    <ol className="ranking-list">
                      <li>#0 Basics: board read, deploy, attack, utility cast, targeted buff.</li>
                      <li>#1 Buffs/Debuffs: shield stack, exposed/debuff pressure, cleanse and stun.</li>
                      <li>#2 Judge: Green/Blue setup, blue lane rule, petition and bribe actions.</li>
                    </ol>
                  </article>

                  <article className="card-block small">
                    <h3>Why This Exists</h3>
                    <p className="subtle">Tutorial and sandbox matches are excluded from weekly stats and leaderboard.</p>
                    <p className="subtle">You can skip any time and restart from this tab.</p>
                  </article>
                </div>
              </>
            ) : null}
          </section>
          {activePvpLobby ? (
            <div className="pvp-lobby-overlay">
              <article className="pvp-lobby-popup card-block">
                <div className="panel-head">
                  <h2>PvP Lobby</h2>
                  <p className="subtle">{activePvpTitle}</p>
                </div>
                <div className="status-row">
                  <span className="badge">Ready {activePvpReadyCount}/2</span>
                  <span className="badge">{activePvpIsInviter ? "Host" : "Guest"}</span>
                  <span className={`badge pvp-joined-badge ${pvpJoinPulse ? "joined-pulse" : ""}`}>
                    {activePvpTargetJoined ? "Opponent joined" : "Waiting for opponent"}
                  </span>
                </div>
                <div className="queue-grid pvp-lobby-actions">
                  <button
                    className="action-btn action-btn--primary"
                    disabled={loading || !activePvpCanStart}
                    onClick={() => void startActivePvpLobby()}
                  >
                    START GAME({activePvpReadyCount}/2)
                  </button>
                  <button
                    className="action-btn secondary"
                    onClick={() => {
                      setActivePvpLobby(null);
                      void loadLobby();
                    }}
                  >
                    LEAVE LOBBY
                  </button>
                  {activePvpIsInviter ? (
                    <button className="action-btn secondary" onClick={() => void dismantleActivePvpLobby()}>
                      DISMANTLE BATTLE
                    </button>
                  ) : null}
                </div>
              </article>
            </div>
          ) : null}
          </>
        ) : (
          <section className="battle-shell landscape" ref={battleShellRef}>
            <div
              className="battle-screen"
              onClick={(event) => {
                handleGlobalBattleDeselectClick(event.target);
              }}
            >
              <div className="battle-hud">
                <div className="hud-grid">
                  <button
                    className="action-btn secondary hud-back"
                    onClick={() => {
                      if (!backArmed) {
                        setBackArmed(true);
                        setInfo("Tap Back again to leave match.");
                        return;
                      }
                      setBackArmed(false);
                      setMatch(null);
                      setSelectedHandIndex(null);
                      setMulliganPick([]);
                      setExpandedCardId(null);
                      setDragAttack(null);
                      setArmedAttackerUnitId(null);
                      setAllyInspectCardId(null);
                      setEnemyInspectUnitId(null);
                      setEnemyInspectEventId(null);
                      setEnemyInspectJudge(false);
                      void loadLobby();
                    }}
                  >
                    {backArmed ? "Confirm Back" : "Back"}
                  </button>
                  <div className="status-legend hud-legend-row" aria-label="Status legend primary">
                    {STATUS_LEGEND.slice(0, 2).map((status) => (
                      <button
                        key={`legend-top-${status.key}`}
                        type="button"
                        className={`status-chip status-chip-btn status-${status.key}`}
                        title={status.title}
                        onClick={() => openStatusGuide(status.key)}
                      >
                        {status.short}
                      </button>
                    ))}
                  </div>
                  <div className="hud-turn-stack" aria-label="Turn info">
                    <span className="badge">{hudTurnLabel}</span>
                    <span className="badge">{hudFlowLabel}</span>
                  </div>
                  <button
                    className={`hud-timer-orb ${turnSeconds <= 5 ? "is-danger" : ""}`}
                    onClick={() => setShowLog(true)}
                    title="Open full log"
                  >
                    <span>{turnSeconds}</span>
                    <small>s</small>
                  </button>
                  <button className="action-btn secondary hud-log" onClick={() => setShowLog(true)}>
                    Show log
                  </button>
                  <div className="status-legend hud-legend-row" aria-label="Status legend secondary">
                    {STATUS_LEGEND.slice(2).map((status) => (
                      <button
                        key={`legend-bottom-${status.key}`}
                        type="button"
                        className={`status-chip status-chip-btn status-${status.key}`}
                        title={status.title}
                        onClick={() => openStatusGuide(status.key)}
                      >
                        {status.short}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {myPlayer && enemyPlayer ? (
                <>
                  <div className="leaders-row">
                    <button
                      className={`leader-pill enemy ${armedAttackerUnitId ? "attack-target" : ""} ${expectsEnemyLeaderTarget ? "effect-target" : ""}`}
                      data-attack-target="leader"
                      data-leader-target="enemy"
                      onClick={() => {
                        if (expectsEnemyLeaderTarget) {
                          playSelectedOnTarget({ kind: "enemy-leader" });
                          return;
                        }
                        tryAttackTarget({ kind: "leader" });
                      }}
                    >
                      <strong>Enemy {enemyPlayer.leader.hp} HP</strong>
                      <span>{enemyPlayer.shares} shares</span>
                    </button>
                    <div className="judge-avatar" aria-hidden="true">
                      <span className="judge-face" />
                      <span>Judge</span>
                    </div>
                    <button
                      type="button"
                      className={`leader-pill you ${expectsAllyLeaderTarget ? "effect-target" : ""}`}
                      data-leader-target="you"
                      onClick={() => {
                        if (!expectsAllyLeaderTarget) return;
                        playSelectedOnTarget({ kind: "ally-leader" });
                      }}
                    >
                      <strong>You {myPlayer.leader.hp} HP</strong>
                      <span>{myPlayer.shares} shares</span>
                    </button>
                  </div>

                  <div className="board-fit" ref={boardFitRef}>
                    <div className="board-grid compact-all" style={boardSizePx ? { width: "100%" } : undefined}>
                      {/* Ghost cards are preview-only placeholders for upcoming bot plays; real units still come from match state. */}
                      {enemyPlayer.board.back.map((unitId, col) => (
                        <button
                          key={`enemy-b-${col}`}
                          className={`slot enemy ${col === JUDGE_COL ? "judge-blue" : ""} ${armedAttackerUnitId && unitId ? "attack-target" : ""} ${expectsEnemyUnitTarget && unitId ? "effect-target" : ""} ${tutorialState?.coachAnchorKind === "slot" && tutorialState.coachSide === "enemy" && tutorialState.coachLane === "back" && tutorialState.coachCol === col ? "tutorial-emphasis" : ""}`}
                          data-attack-target={unitId ? "unit" : undefined}
                          data-unit-id={unitId ?? undefined}
                          data-coach-slot={`enemy-back-${col}`}
                          data-slot-owner={unitId ? enemySide ?? undefined : undefined}
                          data-slot-name={unitId ? match.units[unitId]?.name ?? undefined : undefined}
                          onClick={() => {
                            if (!unitId) {
                              clearActiveSelection({ clearEnemyInspect: true });
                              return;
                            }
                            if (expectsEnemyUnitTarget) {
                              playSelectedOnTarget({ kind: "enemy-unit", unitId });
                              return;
                            }
                            if (armedAttackerUnitId && isMyTurn) {
                              tryAttackTarget({ kind: "unit", unitId });
                              return;
                            }
                            setEnemyInspectUnitId(unitId);
                            setEnemyInspectEventId(null);
                            setEnemyInspectJudge(false);
                          }}
                        >
                          {unitId && match.units[unitId] ? (
                            <BoardUnitTile unit={match.units[unitId]!} turn={match.turn} />
                          ) : botGhostPreviewBySlot[botGhostSlotKey("enemy", "back", col)] ? (
                            <BotGhostUnitTile
                              cardId={botGhostPreviewBySlot[botGhostSlotKey("enemy", "back", col)]!.cardId}
                              cardName={botGhostPreviewBySlot[botGhostSlotKey("enemy", "back", col)]!.cardName}
                            />
                          ) : (
                            "-"
                          )}
                        </button>
                      ))}

                      {enemyPlayer.board.front.map((unitId, col) => (
                        <button
                          key={`enemy-f-${col}`}
                          className={`slot enemy ${col === JUDGE_COL ? "judge-green" : ""} ${armedAttackerUnitId && unitId ? "attack-target" : ""} ${expectsEnemyUnitTarget && unitId ? "effect-target" : ""} ${tutorialState?.coachAnchorKind === "slot" && tutorialState.coachSide === "enemy" && tutorialState.coachLane === "front" && tutorialState.coachCol === col ? "tutorial-emphasis" : ""}`}
                          data-attack-target={unitId ? "unit" : undefined}
                          data-unit-id={unitId ?? undefined}
                          data-coach-slot={`enemy-front-${col}`}
                          data-slot-owner={unitId ? enemySide ?? undefined : undefined}
                          data-slot-name={unitId ? match.units[unitId]?.name ?? undefined : undefined}
                          onClick={() => {
                            if (!unitId) {
                              clearActiveSelection({ clearEnemyInspect: true });
                              return;
                            }
                            if (expectsEnemyUnitTarget) {
                              playSelectedOnTarget({ kind: "enemy-unit", unitId });
                              return;
                            }
                            if (armedAttackerUnitId && isMyTurn) {
                              tryAttackTarget({ kind: "unit", unitId });
                              return;
                            }
                            setEnemyInspectUnitId(unitId);
                            setEnemyInspectEventId(null);
                            setEnemyInspectJudge(false);
                          }}
                        >
                          {unitId && match.units[unitId] ? (
                            <BoardUnitTile unit={match.units[unitId]!} turn={match.turn} />
                          ) : botGhostPreviewBySlot[botGhostSlotKey("enemy", "front", col)] ? (
                            <BotGhostUnitTile
                              cardId={botGhostPreviewBySlot[botGhostSlotKey("enemy", "front", col)]!.cardId}
                              cardName={botGhostPreviewBySlot[botGhostSlotKey("enemy", "front", col)]!.cardName}
                            />
                          ) : (
                            "-"
                          )}
                        </button>
                      ))}

                      {match.eventRow.map((eventId, col) => (
                        <button
                          key={`event-${col}`}
                          className={`slot event ${col === JUDGE_COL ? "judge-core" : ""} ${armedAttackerUnitId && eventId ? "attack-target" : ""} ${col === JUDGE_COL && canJudgeCastSelected ? "effect-target" : ""}`}
                          data-attack-target={col === JUDGE_COL ? "judge" : eventId ? "event" : undefined}
                          data-judge-target={col === JUDGE_COL ? "true" : undefined}
                          data-event-id={col === JUDGE_COL ? undefined : eventId ?? undefined}
                          onClick={() => {
                            if (col === JUDGE_COL) {
                              if (canJudgeCastSelected) {
                                castSelectedWithoutTarget();
                                return;
                              }
                              if (armedAttackerUnitId && isMyTurn) {
                                tryAttackTarget({ kind: "judge" });
                                return;
                              }
                              setEnemyInspectJudge(true);
                              setEnemyInspectUnitId(null);
                              setEnemyInspectEventId(null);
                              return;
                            }
                            if (eventId) {
                              if (armedAttackerUnitId && isMyTurn) {
                                tryAttackTarget({ kind: "event", eventUnitId: eventId });
                                return;
                              }
                              setEnemyInspectEventId(eventId);
                              setEnemyInspectJudge(false);
                              setEnemyInspectUnitId(null);
                              return;
                            }
                            clearActiveSelection({ clearEnemyInspect: true });
                          }}
                        >
                          {col === JUDGE_COL ? (
                            <div className="slot-body judge-body">
                              <span className="slot-name">Judge</span>
                              <span className="slot-stats">influence</span>
                            </div>
                          ) : eventId && match.eventUnits[eventId] ? (
                            <div className="slot-body">
                              <span className="slot-name">{compactName(match.eventUnits[eventId]?.name ?? "-", 11)}</span>
                              <span className="slot-stats">hp {match.eventUnits[eventId]?.health}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </button>
                      ))}

                      {myPlayer.board.front.map((unitId, col) => {
                        if (!unitId) {
                          const legalDrop = canDropSelectedToSlot("front", col, false);
                          const ghost = botGhostPreviewBySlot[botGhostSlotKey("ally", "front", col)];
                          return (
                            <button
                              key={`my-f-${col}`}
                              className={`slot friendly ${col === JUDGE_COL ? "judge-green" : ""} ${legalDrop ? "drop" : ""} ${tutorialState?.coachAnchorKind === "slot" && tutorialState.coachSide === "ally" && tutorialState.coachLane === "front" && tutorialState.coachCol === col ? "tutorial-emphasis" : ""}`}
                              data-coach-slot={`ally-front-${col}`}
                              onClick={() => {
                                if (legalDrop) {
                                  playSelectedTo("front", col);
                                  return;
                                }
                                clearActiveSelection({ clearEnemyInspect: true });
                              }}
                            >
                              {ghost ? <BotGhostUnitTile cardId={ghost.cardId} cardName={ghost.cardName} /> : "+"}
                            </button>
                          );
                        }

                        const unit = match.units[unitId]!;
                        const spentAttack = unit.cannotAttackUntilTurn > match.turn;
                        return (
                          <button
                            key={`my-f-${col}`}
                            className={`slot friendly own ${col === JUDGE_COL ? "judge-green" : ""} ${armedAttackerUnitId === unitId ? "armed" : ""} ${spentAttack ? "spent-attack" : ""} ${expectsAllyUnitTarget ? "effect-target" : ""} ${canDropSelectedToSlot("front", col, true) ? "flip-target" : ""} ${tutorialState?.coachAnchorKind === "slot" && tutorialState.coachSide === "ally" && tutorialState.coachLane === "front" && tutorialState.coachCol === col ? "tutorial-emphasis" : ""}`}
                            data-owned-unit-id={unitId}
                            data-coach-slot={`ally-front-${col}`}
                            data-slot-owner={mySide ?? undefined}
                            data-slot-name={unit.name ?? undefined}
                            onClick={() => {
                              if (canDropSelectedToSlot("front", col, true)) {
                                playSelectedTo("front", col);
                                return;
                              }
                              if (expectsAllyUnitTarget) {
                                playSelectedOnTarget({ kind: "ally-unit", unitId });
                                return;
                              }
                              setAllyInspectCardId(unit.cardId ?? null);
                              setSelectedHandIndex(null);
                              setArmedAttackerUnitId((prev) => (prev === unitId ? null : unitId));
                            }}
                            onPointerDown={(e) => {
                              if (canPlaySelected && selectedCardIsUnit) return;
                              if (!isMyTurn || !mySide) return;
                              beginDragAttack(e, unitId);
                            }}
                            onPointerMove={moveDragAttack}
                            onPointerUp={(e) => {
                              if (canPlaySelected && selectedCardIsUnit) return;
                              if (!mySide) return;
                              endDragAttack(e, mySide);
                            }}
                          >
                            <BoardUnitTile unit={unit} turn={match.turn} />
                          </button>
                        );
                      })}

                      {myPlayer.board.back.map((unitId, col) => {
                        if (!unitId) {
                          const legalDrop = canDropSelectedToSlot("back", col, false);
                          const ghost = botGhostPreviewBySlot[botGhostSlotKey("ally", "back", col)];
                          return (
                            <button
                              key={`my-b-${col}`}
                              className={`slot friendly ${col === JUDGE_COL ? "judge-blue" : ""} ${legalDrop ? "drop" : ""} ${tutorialState?.coachAnchorKind === "slot" && tutorialState.coachSide === "ally" && tutorialState.coachLane === "back" && tutorialState.coachCol === col ? "tutorial-emphasis" : ""}`}
                              data-coach-slot={`ally-back-${col}`}
                              onClick={() => {
                                if (legalDrop) {
                                  playSelectedTo("back", col);
                                  return;
                                }
                                clearActiveSelection({ clearEnemyInspect: true });
                              }}
                            >
                              {ghost ? <BotGhostUnitTile cardId={ghost.cardId} cardName={ghost.cardName} /> : "+"}
                            </button>
                          );
                        }

                        const unit = match.units[unitId]!;
                        const spentAttack = unit.cannotAttackUntilTurn > match.turn;
                        return (
                          <button
                            key={`my-b-${col}`}
                            className={`slot friendly own ${col === JUDGE_COL ? "judge-blue" : ""} ${armedAttackerUnitId === unitId ? "armed" : ""} ${spentAttack ? "spent-attack" : ""} ${expectsAllyUnitTarget ? "effect-target" : ""} ${canDropSelectedToSlot("back", col, true) ? "flip-target" : ""} ${tutorialState?.coachAnchorKind === "slot" && tutorialState.coachSide === "ally" && tutorialState.coachLane === "back" && tutorialState.coachCol === col ? "tutorial-emphasis" : ""}`}
                            data-owned-unit-id={unitId}
                            data-coach-slot={`ally-back-${col}`}
                            data-slot-owner={mySide ?? undefined}
                            data-slot-name={unit.name ?? undefined}
                            onClick={() => {
                              if (canDropSelectedToSlot("back", col, true)) {
                                playSelectedTo("back", col);
                                return;
                              }
                              if (expectsAllyUnitTarget) {
                                playSelectedOnTarget({ kind: "ally-unit", unitId });
                                return;
                              }
                              setAllyInspectCardId(unit.cardId ?? null);
                              setSelectedHandIndex(null);
                              setArmedAttackerUnitId((prev) => (prev === unitId ? null : unitId));
                            }}
                            onPointerDown={(e) => {
                              if (canPlaySelected && selectedCardIsUnit) return;
                              if (!isMyTurn || !mySide) return;
                              beginDragAttack(e, unitId);
                            }}
                            onPointerMove={moveDragAttack}
                            onPointerUp={(e) => {
                              if (canPlaySelected && selectedCardIsUnit) return;
                              if (!mySide) return;
                              endDragAttack(e, mySide);
                            }}
                          >
                            <BoardUnitTile unit={unit} turn={match.turn} />
                          </button>
                        );
                      })}
                      </div>
                    </div>

                  <div className="inspect-vs-row">
                    <article className="inspect-card ally">
                      {allyInspectCard ? (
                        <>
                          <h4>{allyInspectCard.name}</h4>
                          <p>{factionLabel(allyInspectCard.faction)} · {allyInspectCard.type} · {roleLabel(allyInspectCard.role)}</p>
                          <p>atk {allyInspectCard.attack ?? "-"} · hp {allyInspectCard.defense ?? "-"} · cost {allyInspectCard.costShares}</p>
                          <p>Use: {allyInspectCard.fullEffectShortText}</p>
                          <p>Survival: {allyInspectCard.survivalLine}</p>
                        </>
                      ) : (
                        <p>Tap your hand card or your unit to inspect details.</p>
                      )}
                    </article>
                    <div className="inspect-vs">VS</div>
                    <article className="inspect-card enemy">
                      {enemyInspectCard && enemyInspectUnit ? (
                        <>
                          <h4>{enemyInspectCard.name}</h4>
                          <p>{factionLabel(enemyInspectCard.faction)} · {enemyInspectCard.type} · {roleLabel(enemyInspectCard.role)}</p>
                          <p>atk {enemyInspectUnit.attack} · hp {enemyInspectUnit.health} · cost {enemyInspectCard.costShares}</p>
                          {enemyInspectStatuses.length > 0 ? <p>Status: {enemyInspectStatuses.map((status) => status.title).join(" | ")}</p> : null}
                          <p>Use: {enemyInspectCard.fullEffectShortText}</p>
                          <p>Survival: {enemyInspectCard.survivalLine}</p>
                        </>
                      ) : enemyInspectEventDetails ? (
                        <>
                          <h4>{enemyInspectEventDetails.name}</h4>
                          <p>{enemyInspectEventDetails.typeLabel}</p>
                          <p>{enemyInspectEventDetails.statsLabel}</p>
                          {enemyInspectEventDetails.statusLabel ? <p>{enemyInspectEventDetails.statusLabel}</p> : null}
                          <p>Effect: {enemyInspectEventDetails.effectLabel}</p>
                        </>
                      ) : (
                        <p>Tap enemy unit or middle-row slot to inspect full details.</p>
                      )}
                    </article>
                  </div>

                  <div className="hand-area">
                    <div
                      className="hand-roller"
                      role="list"
                      aria-label="Your hand"
                      ref={handRailRef}
                      onScroll={() => {
                        updateCenterHandIndex();
                      }}
                    >
                      {myPlayer.hand.map((cardId, idx) => {
                        const card = getCardPreview(cardId);
                        const displayCost = card.type === "unit" || card.id === "naked_shorting" ? card.costShares : 0;
                        const onboardArtPath = handOnboardArtPath(card);
                        return (
                          <button
                            key={`${cardId}-${idx}`}
                            className={`hand-card has-onboard ${card.traits.includes("taunt") ? "hand-card--taunt" : ""} ${selectedHandIndex === idx ? "selected" : ""} ${centerHandIndex === idx ? "centered" : ""} ${tutorialState?.coachAnchorKind === "hand-card" && tutorialState.coachCardId === cardId ? "tutorial-emphasis" : ""}`}
                            data-hand-index={idx}
                            data-hand-card-id={cardId}
                            onClick={() => onHandCardTap(idx, cardId)}
                          >
                            <img
                              key={`${card.id}-onboard`}
                              className="hand-card-onboard"
                              src={onboardArtPath}
                              data-fallback-src={HAND_ONBOARD_FALLBACK_PATH}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                              onError={applyArtFallback}
                            />
                            <div className="hand-card-body">
                              <div className="hand-card-top">
                                <div className="hand-title-wrap">
                                  <strong>{compactName(card.name, 14)}</strong>
                                  <span className="hand-type">{card.type}</span>
                                </div>
                                <span className="hand-cost">{displayCost}</span>
                              </div>
                              <div className="hand-card-meta">
                                <span className={`faction-chip ${card.faction}`}>{factionLabel(card.faction)}</span>
                                <span className="combat-chip">{card.attack ?? "-"} / {card.defense ?? "-"}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedCard?.id === "naked_shorting" ? (
                      <div className="naked-chooser">
                        <span>Naked Short Leverage</span>
                        {[2, 3, 4, 5].map((lv) => (
                          <button
                            key={`naked-lv-${lv}`}
                            className={`leverage-btn ${nakedLeverage === lv ? "active" : ""}`}
                            onClick={() => setNakedLeverage(lv as 2 | 3 | 4 | 5)}
                          >
                            1:{lv}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="battle-footer">
                      <button
                        className={`action-btn ${tutorialState?.coachAnchorKind === "button" && tutorialState.coachButtonId === "end-turn" ? "tutorial-emphasis" : ""}`}
                        data-coach-button="end-turn"
                        onClick={() => {
                          if (!mySide) return;
                          void runAction(API_ROUTES.matchEndTurn, { side: mySide });
                        }}
                      >
                        End Turn
                      </button>
                      {canPlaySelected && !selectedCardIsUnit && selectedTargetRule === "none" ? (
                        <button
                          className={`action-btn secondary ${tutorialState?.coachAnchorKind === "button" && tutorialState.coachButtonId === "cast-card" ? "tutorial-emphasis" : ""}`}
                          data-coach-button="cast-card"
                          onClick={castSelectedWithoutTarget}
                        >
                          Cast Card
                        </button>
                      ) : null}
                      {myPlayer && myPlayer.nakedShortDebt > 0 ? (
                        <button
                          className="action-btn secondary"
                          onClick={() => {
                            if (!mySide) return;
                            void runAction(API_ROUTES.matchRepayNakedShort, { side: mySide });
                          }}
                        >
                          Repay {myPlayer.nakedShortDebt}
                        </button>
                      ) : null}
                      {canRepositionArmed ? (
                        <button className="action-btn secondary" onClick={repositionArmedToJudge}>
                          Move {repositionLane === "front" ? "Green" : "Blue"} Judge
                        </button>
                      ) : null}
                    <div className="selected-preview">
                      {selectedCard ? (
                        <>
                          <p>
                            {selectedCard.name} · {factionLabel(selectedCard.faction)} · atk {selectedCard.attack ?? "-"} · def {selectedCard.defense ?? "-"} · row {selectedCard.row}
                          </p>
                          <p>
                            {selectedCard.type === "unit" && (isJudgePositiveSpecialistCard(selectedCard.id) || isJudgeCorruptSpecialistCard(selectedCard.id))
                              ? "Can be placed on Judge slot"
                              : "Cannot be placed on Judge slot"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p>Tap card to select. Tap same card again for fullscreen art.</p>
                        </>
                      )}
                    </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {tutorialState?.paused ? (
              <div className="tutorial-coach-layer">
                <div
                  className={`tutorial-coach-bubble is-${coachmarkPosition?.placement ?? "bottom"} ${tutorialState.paused ? "paused" : ""}`}
                  style={{
                    left: coachmarkPosition ? `${coachmarkPosition.left}px` : "50%",
                    top: coachmarkPosition ? `${coachmarkPosition.top}px` : "72px",
                  }}
                  role="dialog"
                  aria-modal="false"
                  aria-label="Tutorial coach"
                >
                  <div className="tutorial-coach__head">
                    <strong>Tutorial {tutorialState.stepIndex + 1}/{tutorialState.totalSteps}</strong>
                    <span className="badge">{tutorialState.paused ? "Paused" : "Live"}</span>
                  </div>
                  <h3>{tutorialState.title}</h3>
                  <p>{tutorialState.body}</p>
                  <p className="subtle">{tutorialState.actionHint}</p>
                  <div className="tutorial-coach__actions">
                    <button className="action-btn action-btn--primary" onClick={() => void acknowledgeTutorialTip()}>
                      I understand
                    </button>
                    {tutorialState.canSkip ? (
                      <button className="action-btn secondary" onClick={() => void skipTutorialMatch()}>
                        Skip tutorial
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            {showLog ? (
              <div className="battle-log-overlay" onClick={() => setShowLog(false)}>
                <article className="battle-log-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="battle-log-head">
                    <h3>Match Log</h3>
                    <div className="status-row">
                      <span className="badge">{formattedBattleLog.length} entries</span>
                      <button className="close-btn" onClick={() => setShowLog(false)}>Close</button>
                    </div>
                  </div>
                  <ul className="log-list battle-log-list" aria-label="Full battle log">
                    {formattedBattleLog.length === 0 ? (
                      <li className="battle-log-item">
                        <span className="log-line">No actions logged yet.</span>
                      </li>
                    ) : (
                      formattedBattleLog.map((line, idx) => (
                        <li key={`battle-log-${idx}`} className="battle-log-item">
                          <span className="badge">#{idx + 1}</span>
                          <span className="log-line">{line}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </article>
              </div>
            ) : null}
            {showStatusGuide ? (
              <div className="status-guide-overlay" onClick={() => setShowStatusGuide(false)}>
                <article className="status-guide-modal" onClick={(event) => event.stopPropagation()}>
                  <div className="status-guide-head">
                    <h3>Status Guide</h3>
                    <button className="close-btn" onClick={() => setShowStatusGuide(false)}>Close</button>
                  </div>
                  <div className="status-guide-layout">
                    <nav className="status-guide-nav" aria-label="Status list">
                      {STATUS_LEGEND.map((status) => (
                        <button
                          key={`status-guide-${status.key}`}
                          type="button"
                          className={`status-guide-tab ${activeStatusGuideKey === status.key ? "active" : ""}`}
                          onClick={() => setActiveStatusGuideKey(status.key)}
                          title={status.title}
                        >
                          <span className={`status-chip status-${status.key}`}>{status.short}</span>
                        </button>
                      ))}
                    </nav>
                    <article className="status-guide-content">
                      {activeStatusGuide ? (
                        <>
                          <div className="status-guide-title-row">
                            <span className={`status-chip status-${activeStatusGuide.key}`}>{activeStatusGuide.short}</span>
                            <h4>{activeStatusGuide.title}</h4>
                          </div>
                          <p>{activeStatusGuide.detail ?? activeStatusGuide.title}</p>
                        </>
                      ) : null}
                    </article>
                  </div>
                </article>
              </div>
            ) : null}
            {isFinished ? (
              <div className="match-end-overlay">
                <article className="match-end-modal">
                  <h2>{didWin ? "Victory" : "Defeat"}</h2>
                  <p className="subtle">{match.winReason ? `Win condition: ${match.winReason}.` : "Match finished."}</p>
                  <div className="status-row">
                    <span className="badge">Mode {match.mode.toUpperCase()}</span>
                    <span className="badge">Turn {match.turn}</span>
                    {match.winnerSide ? <span className="badge">Winner Side {match.winnerSide}</span> : null}
                  </div>
                  <div className="queue-grid">
                    <button
                      className="action-btn action-btn--primary"
                      onClick={() => {
                        const nextTab: LobbyTab = match.mode === "pvp" ? "pvp" : match.mode === "tutorial" || match.mode === "sandbox" ? "tutorial" : "quick";
                        setLobbyTab(nextTab);
                        setMatch(null);
                        setSelectedHandIndex(null);
                        setMulliganPick([]);
                        setExpandedCardId(null);
                        setDragAttack(null);
                        setArmedAttackerUnitId(null);
                        setAllyInspectCardId(null);
                        setEnemyInspectUnitId(null);
                        setEnemyInspectEventId(null);
                        setEnemyInspectJudge(false);
                        void loadLobby();
                      }}
                    >
                      {match.mode === "pvp" ? "Back to PvP Play" : match.mode === "sandbox" ? "Back to Tutorial" : "Back to Lobby"}
                    </button>
                  </div>
                </article>
              </div>
            ) : null}
          </section>
        )}

        {dragAttack ? (
          <div className="drag-token" style={{ left: dragAttack.x, top: dragAttack.y }}>
            {compactName(match?.units[dragAttack.attackerUnitId]?.name ?? "Attack", 12)}
          </div>
        ) : null}

        {expandedCard ? (
          <div className="full-preview-overlay" onClick={() => setExpandedCardId(null)}>
            <div className="full-preview" onClick={(e) => e.stopPropagation()}>
              <button className="close-btn" onClick={() => setExpandedCardId(null)}>Close</button>
              <div className="full-preview-head">
                <h2>{expandedCard.name}</h2>
                <p className="subtle">{factionLabel(expandedCard.faction).toUpperCase()} · {expandedCard.type.toUpperCase()} · COST {expandedCard.costShares} · ROW {expandedCard.row}</p>
              </div>
              <div className="full-preview-main">
                <div className="full-art-wrap">
                  <img
                    key={expandedCard.id}
                    className="full-art"
                    src={expandedCard.artPath}
                    data-fallback-src={expandedCard.artFallbackPath}
                    data-fallback-chain={expandedCard.artFallbackPaths.join("|")}
                    alt={expandedCard.name}
                    loading="lazy"
                    onError={applyArtFallback}
                  />
                </div>
                <div className="full-card-data">
                  <div className="full-stats">
                    <span>ATK {expandedCard.attack ?? "-"}</span>
                    <span>HP {expandedCard.defense ?? "-"}</span>
                    <span>DIRTY {expandedCard.dirtyPower}</span>
                  </div>
                  <p className="full-copy"><strong>Card impact:</strong> {expandedCard.cardImpactLine}</p>
                  <p className="full-copy"><strong>Role:</strong> {expandedCard.roleLine}</p>
                  <p className="full-copy"><strong>Abilities:</strong> {expandedAbilitiesLine}</p>
                  {expandedCard.triggersLine ? (
                    <p className="full-copy"><strong>Triggers:</strong> {expandedCard.triggersLine}</p>
                  ) : null}
                  {expandedCard.specialsLine ? (
                    <p className="full-copy"><strong>Specials:</strong> {expandedCard.specialsLine}</p>
                  ) : null}
                  <p className="full-copy"><strong>Faction passive:</strong> {expandedCard.factionPassiveLine}</p>
                  <p className="full-copy"><strong>Survival:</strong> {expandedCard.survivalLine}</p>
                </div>
              </div>
              <div className="full-preview-foot">
                <article className="full-copy-block">
                  <h3>Court Record</h3>
                  <p>{expandedCard.courtRecordText}</p>
                </article>
                <article className="full-copy-block">
                  <h3>Full effect text</h3>
                  <p>{expandedCard.fullEffectShortText}</p>
                </article>
              </div>
            </div>
          </div>
        ) : null}

        {showMulligan && match && myPlayer && mySide ? (
          <div className="mulligan-modal">
            <div className="mulligan-card">
              <h2>Mulligan ({mulliganSeconds}s)</h2>
              <div className="hand-grid">
                {myPlayer.hand.map((cardId, idx) => {
                  const card = getCardPreview(cardId);
                  return (
                    <button
                      key={`mulligan-${idx}`}
                      className={`hand-card ${card.traits.includes("taunt") ? "hand-card--taunt" : ""} ${mulliganPick.includes(idx) ? "selected" : ""}`}
                      onClick={() => {
                        setMulliganPick((prev) => (prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]));
                      }}
                    >
                      <strong>{card.name}</strong>
                      <span>{card.type}</span>
                    </button>
                  );
                })}
              </div>
              <button
                className="action-btn"
                onClick={() => {
                  void runAction(API_ROUTES.matchMulligan, { side: mySide, replaceIndices: mulliganPick });
                  setMulliganPick([]);
                }}
              >
                Confirm Mulligan
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element for Court of Capital game.");
}

createRoot(rootEl).render(
  <StrictMode>
    <GameApp />
  </StrictMode>,
);
