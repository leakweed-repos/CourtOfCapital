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
import { getCardPreview } from "../shared/cards";
import {
  type EventUnitState,
  JUDGE_COL,
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
import { isJudgeCorruptSpecialistCard, isJudgePositiveSpecialistCard, isJudgeSpecialistCard, isStrictBackOnly } from "../shared/placement";
import "./index.css";

type UiContext = {
  weekId: string;
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

const FACTIONS: Array<{ id: FactionId; label: string; motto: string; tone: string }> = [
  { id: "wallstreet", label: "Wallstreet", motto: "Premium alpha desks", tone: "tempo + scaling" },
  { id: "sec", label: "SEC", motto: "Audits and injunctions", tone: "control + disruption" },
  { id: "market_makers", label: "Market Makers", motto: "Spread and liquidity loops", tone: "value + utility" },
  { id: "short_hedgefund", label: "Short Hedgefund", motto: "Pressure through leverage", tone: "risk + burst" },
  { id: "retail_mob", label: "Retail Mob", motto: "Momentum swarms", tone: "wide board + spikes" },
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

type RemoteAction =
  | { kind: "play" }
  | { kind: "attack"; attackerName: string; target: { kind: "leader" } | { kind: "unit"; name: string } | { kind: "event"; name: string } };

function readWeekIdFromPostData(): string {
  if (!context.postData || typeof context.postData !== "object") {
    return "unknown-week";
  }
  const weekId = (context.postData as Record<string, unknown>).weekId;
  return typeof weekId === "string" && weekId.trim().length > 0 ? weekId : "unknown-week";
}

function readContext(): UiContext {
  const clientName = context.client?.name;
  return {
    weekId: readWeekIdFromPostData(),
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

function secsLeft(deadlineAt: number): number {
  return Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
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
  return `Tutorial vs. ${me}`;
}

function tutorialScenarioLabel(id?: TutorialScenarioId): string {
  if (!id) {
    return "Tutorial";
  }
  const one = TUTORIAL_SCENARIOS.find((row) => row.id === id);
  return one?.label ?? id;
}

function factionLabel(faction: string): string {
  return faction.replace(/_/g, " ");
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
};

const STATUS_LEGEND: UnitStatusToken[] = [
  { key: "shield", short: "SH", title: "Shield: blocks incoming hit damage." },
  { key: "atk-down", short: "ATK-", title: "Attack down: temporary attack reduction." },
  { key: "stun", short: "STN", title: "Stun: unit cannot attack this round." },
  { key: "exposed", short: "EXP", title: "Exposed: takes +1 combat damage." },
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
  if ((unit.tempAttackPenalty ?? 0) > 0 && (unit.tempAttackPenaltyUntilTurn ?? 0) >= turn) {
    tokens.push({
      key: "atk-down",
      short: `ATK-${unit.tempAttackPenalty}`,
      title: `Attack down: -${unit.tempAttackPenalty} attack until this round ends.`,
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

function StatusChips({ unit, turn }: { unit: MatchState["units"][string]; turn: number }) {
  const statuses = unitStatusTokens(unit, turn);
  if (statuses.length === 0) {
    return null;
  }

  return (
    <div className="slot-status-row" aria-label="Unit statuses">
      {statuses.map((status) => (
        <span key={`${status.key}-${status.short}`} className={`status-chip status-${status.key}`} title={status.title}>
          {status.short}
        </span>
      ))}
    </div>
  );
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function streetEffectText(text: string): string {
  let out = oneLine(text).replace(/^Effect:\s*/i, "");
  const replacements: Array<[RegExp, string]> = [
    [/\bdeploy\b/gi, "play"],
    [/\bfront row\b/gi, "front line"],
    [/\bback row\b/gi, "back line"],
    [/\bally unit\b/gi, "your unit"],
    [/\benemy unit\b/gi, "opponent unit"],
    [/\bally leader\b/gi, "your leader"],
    [/\benemy leader\b/gi, "opponent leader"],
    [/\bjudge green slot\b/gi, "Green Judge slot"],
    [/\bjudge blue slot\b/gi, "Blue Judge slot"],
    [/\bprobation\b/gi, "Judge heat"],
  ];
  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function streetResistanceText(text: string): string {
  const cleaned = oneLine(text).replace(/^Resistance:\s*/i, "");
  if (/n\/a|non-unit/i.test(cleaned)) {
    return "No armor tricks here. This card wins with timing.";
  }
  return `Toughness: ${cleaned}.`;
}

function streetLoreText(flavorText: string): string {
  const cleaned = oneLine(flavorText);
  if (!cleaned) {
    return "Simple plan: play it at the right time and cash the tempo.";
  }
  return cleaned;
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
    baseAllowed = isStrictBackOnly(card.id) ? lane === "back" : true;
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

export function GameApp() {
  const ctx = useMemo(readContext, []);
  const webViewMode = getWebViewMode();
  const platformClass = ctx.clientName === "ANDROID" || ctx.clientName === "IOS" ? "platform-mobile" : "platform-desktop";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
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
  const [selectedFaction, setSelectedFaction] = useState<FactionId>("market_makers");
  const [selectedPvpFaction, setSelectedPvpFaction] = useState<FactionId>("market_makers");
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
  const [enemyThinking, setEnemyThinking] = useState(false);
  const [allyInspectCardId, setAllyInspectCardId] = useState<string | null>(null);
  const [enemyInspectUnitId, setEnemyInspectUnitId] = useState<string | null>(null);
  const [enemyInspectEventId, setEnemyInspectEventId] = useState<string | null>(null);
  const [enemyInspectJudge, setEnemyInspectJudge] = useState(false);
  const [coachmarkPosition, setCoachmarkPosition] = useState<CoachmarkPosition | null>(null);
  const remoteAnimatingRef = useRef(false);
  const pvpJoinedPrevRef = useRef(false);
  const matchRef = useRef<MatchState | null>(null);
  const battleShellRef = useRef<HTMLElement | null>(null);

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
    if (remoteAnimatingRef.current) {
      return;
    }
    const response = await postJson(API_ROUTES.matchGet, { matchId });
    if (!response.ok) {
      setError(response.error);
      return;
    }
    const nextMatch = response.data.match;
    if (!allowSwitch && (!matchRef.current || matchRef.current.id !== matchId)) {
      return;
    }
    const prevMatch = matchRef.current;

    if (prevMatch && prevMatch.updatedAt !== nextMatch.updatedAt) {
      const myPrevSide = sideForUser(prevMatch, ctx.userId);
      if (myPrevSide) {
        const wasEnemyTurn = prevMatch.status === "active" && prevMatch.activeSide === enemyOf(myPrevSide);
        const nowMyTurn = nextMatch.status === "active" && nextMatch.activeSide === myPrevSide;
        const remoteActions = wasEnemyTurn ? deriveRemoteActions(prevMatch, nextMatch, myPrevSide) : [];
        if (nowMyTurn && remoteActions.length > 0) {
          remoteAnimatingRef.current = true;
          setEnemyThinking(true);
          try {
            await playRemoteSequence(remoteActions, myPrevSide);
          } finally {
            setEnemyThinking(false);
            remoteAnimatingRef.current = false;
          }
        }
      }
    }

    matchRef.current = nextMatch;
    setMatch(nextMatch);
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
    matchRef.current = response.data.result.match;
    setMatch(response.data.result.match);
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
      return;
    }
    setActivePvpLobby(response.data.lobby);
  }

  async function refreshActivePvpLobby(lobbyId: string): Promise<void> {
    const response = await postJson<{ lobbyId: string }, PvpLobbyResponse>(API_ROUTES.pvpLobbyGet, { lobbyId });
    if (!response.ok) {
      setActivePvpLobby(null);
      setError(response.error);
      return;
    }

    const nextLobby = response.data.lobby;
    if (nextLobby.matchId) {
      setActivePvpLobby(null);
      await refreshMatch(nextLobby.matchId, true);
      await loadLobby();
      return;
    }

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
      setActivePvpLobby(null);
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

    setActivePvpLobby(null);
    setInfo("Battle dismantled.");
    await loadLobby();
  }

  async function runAction(route: string, action: Record<string, unknown>): Promise<void> {
    if (!match) return;

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
      setError(response.data.result.error ?? "Action failed.");
      setMatch(response.data.result.match);
      return;
    }

    setError("");
    setMatch(response.data.result.match);
    setArmedAttackerUnitId(null);
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

  function findUnitElementByName(side: PlayerSide, name: string): Element | null {
    const unitButtons = Array.from(document.querySelectorAll("[data-slot-owner][data-slot-name]"));
    for (const el of unitButtons) {
      const owner = (el as HTMLElement).dataset.slotOwner;
      const slotName = (el as HTMLElement).dataset.slotName;
      if (owner === side && slotName === name) {
        return el;
      }
    }
    return null;
  }

  function findLeaderElement(side: "enemy" | "you"): Element | null {
    return document.querySelector(`[data-leader-target="${side}"]`);
  }

  async function playRemoteFlyer(fromEl: Element, toEl: Element): Promise<void> {
    const start = elementCenter(fromEl);
    const end = elementCenter(toEl);
    const flyer = document.createElement("div");
    flyer.className = "attack-flyer enemy";
    flyer.textContent = "✦";
    flyer.style.transform = `translate(${start.x - 14}px, ${start.y - 14}px) scale(0.9)`;
    document.body.appendChild(flyer);

    const out = flyer.animate(
      [
        { transform: `translate(${start.x - 14}px, ${start.y - 14}px) scale(0.9)` },
        { transform: `translate(${end.x - 14}px, ${end.y - 14}px) scale(1.05)` },
      ],
      { duration: 230, easing: "cubic-bezier(0.22, 0.85, 0.25, 1)", fill: "forwards" },
    );
    await out.finished.catch(() => undefined);
    toEl.classList.add("hit-flash");
    window.setTimeout(() => toEl.classList.remove("hit-flash"), 180);
    flyer.remove();
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function deriveRemoteActions(prevMatch: MatchState, nextMatch: MatchState, mySide: PlayerSide): RemoteAction[] {
    const enemySide = enemyOf(mySide);
    const startIdx = prevMatch.log.length;
    const entries = nextMatch.log.slice(startIdx);
    const actions: RemoteAction[] = [];
    const enemyNames = new Set<string>();

    for (const unit of Object.values(prevMatch.units)) {
      if (unit.owner === enemySide) {
        enemyNames.add(unit.name);
      }
    }
    for (const unit of Object.values(nextMatch.units)) {
      if (unit.owner === enemySide) {
        enemyNames.add(unit.name);
      }
    }

    for (const entry of entries) {
      const text = entry.text;
      if (text.startsWith(`${enemySide} played `) || text.startsWith(`${enemySide} issued `) || text.startsWith(`${enemySide} executed `)) {
        actions.push({ kind: "play" });
        continue;
      }

      const hitLeader = text.match(/^(.+?) hit leader /);
      if (hitLeader) {
        const attackerName = hitLeader[1] ?? "";
        if (enemyNames.has(attackerName)) {
          actions.push({ kind: "attack", attackerName, target: { kind: "leader" } });
        }
        continue;
      }

      const dealtUnit = text.match(/^(.+?) dealt \d+ to (.+?)\./);
      if (dealtUnit) {
        const attackerName = dealtUnit[1] ?? "";
        if (!enemyNames.has(attackerName)) {
          continue;
        }
        actions.push({
          kind: "attack",
          attackerName,
          target: { kind: "unit", name: dealtUnit[2] ?? "" },
        });
        continue;
      }

      const hitEvent = text.match(/^(.+?) hit event (.+?) for /);
      if (hitEvent) {
        const attackerName = hitEvent[1] ?? "";
        if (!enemyNames.has(attackerName)) {
          continue;
        }
        actions.push({
          kind: "attack",
          attackerName,
          target: { kind: "event", name: hitEvent[2] ?? "" },
        });
      }
    }

    return actions;
  }

  async function playRemoteSequence(
    actions: RemoteAction[],
    mySide: PlayerSide,
  ): Promise<void> {
    const enemySide = enemyOf(mySide);
    const enemyLeader = findLeaderElement("enemy");
    const myLeader = findLeaderElement("you");

    for (const action of actions) {
      if (action.kind === "play") {
        if (enemyLeader) {
          enemyLeader.classList.add("bot-think");
          await sleep(240);
          enemyLeader.classList.remove("bot-think");
        } else {
          await sleep(220);
        }
        continue;
      }

      const attackerEl =
        findUnitElementByName(enemySide, action.attackerName) ??
        enemyLeader;

      let targetEl: Element | null = null;
      if (action.target.kind === "leader") {
        targetEl = myLeader;
      } else if (action.target.kind === "unit") {
        targetEl = findUnitElementByName(mySide, action.target.name);
      } else {
        targetEl = document.querySelector("[data-event-id]");
      }

      if (attackerEl && targetEl) {
        await playRemoteFlyer(attackerEl, targetEl);
      } else {
        await sleep(180);
      }
      await sleep(90);
    }

    // ensure a short beat before state swap to sell the illusion
    await sleep(140);
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
    await playAttackAnimation(attackerUnitId, target);
    await runAction(API_ROUTES.matchAttack, {
      side,
      attackerUnitId,
      target,
    });
  }

  function onHandCardTap(idx: number, cardId: string): void {
    setExpandedCardId(null);
    setArmedAttackerUnitId(null);
    setAllyInspectCardId(cardId);
    setEnemyInspectUnitId(null);
    setEnemyInspectEventId(null);
    setEnemyInspectJudge(false);
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
    if (!match) return;
    if (enemyInspectUnitId && !match.units[enemyInspectUnitId]) {
      setEnemyInspectUnitId(null);
    }
    if (enemyInspectEventId && !match.eventUnits[enemyInspectEventId]) {
      setEnemyInspectEventId(null);
    }
  }, [match, enemyInspectUnitId, enemyInspectEventId]);

  useEffect(() => {
    if (!match) return;
    const id = window.setInterval(() => {
      void refreshMatch(match.id);
    }, 1500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id]);

  useEffect(() => {
    if (match || !activePvpLobby) return;
    const id = window.setInterval(() => {
      void refreshActivePvpLobby(activePvpLobby.id);
    }, 1500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, activePvpLobby?.id]);

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

  const mulliganSeconds = match ? secsLeft(match.mulliganDeadlineAt) : 0;
  const turnSeconds = match ? secsLeft(match.turnDeadlineAt) : 0;
  const isMyTurn = Boolean(match && mySide && match.status === "active" && match.activeSide === mySide);

  const selectedCardId =
    selectedHandIndex !== null && myPlayer && myPlayer.hand[selectedHandIndex]
      ? myPlayer.hand[selectedHandIndex]
      : null;

  const selectedCard = selectedCardId ? getCardPreview(selectedCardId) : null;
  const expandedCard = expandedCardId ? getCardPreview(expandedCardId) : null;
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
    const flipSurcharge = occupied && selectedCard.traits.includes("flip")
      ? Math.max(1, Math.ceil(selectedCard.costShares * 0.25))
      : 0;
    const totalCost = selectedCard.costShares + flipSurcharge;
    return myPlayer.shares >= totalCost;
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

        {!match ? (
          <>
          <section className="lobby-screen">
            <header className="topbar lobby-topbar">
              <h1>Court of Capital</h1>
              <p>Week {ctx.weekId} · Operator u/{ctx.username || "guest"}</p>
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
                    <button className="action-btn action-btn--primary" onClick={() => void createInvite()} disabled={loading || inviteTarget.trim().length < 2}>Send</button>
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
                  <div className="queue-grid">
                    <button className="action-btn action-btn--primary" disabled={loading} onClick={() => void startTutorial(selectedTutorialScenario)}>
                      <span>Start Selected Tutorial</span>
                      <small>{tutorialScenarioLabel(selectedTutorialScenario)}</small>
                    </button>
                  </div>
                </article>

                <div className="lobby-side-grid">
                  <article className="card-block small resume-block">
                    <h3>Resume Tutorial</h3>
                    <ul className="simple-list">
                      {tutorialMatches.length === 0 ? <li>No active tutorial match.</li> : null}
                      {tutorialMatches.map((summary) => (
                        <li key={summary.matchId}>
                          <span>{shortId(summary.matchId)} · {tutorialScenarioLabel(summary.tutorialScenarioId)}</span>
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
                    <p className="subtle">Tutorial matches are excluded from weekly stats and leaderboard.</p>
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
            <div className="battle-screen">
              <div className="battle-hud">
                <div className="hud-main">
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
                  <span className="badge">{shortId(match.id)}</span>
                  <span className="badge">{match.status}</span>
                  <span className={`badge ${turnSeconds <= 5 ? "is-danger" : ""}`}>{turnSeconds}s</span>
                  <span className="badge">{isMyTurn ? "Your turn" : `Side ${match.activeSide}`}</span>
                  <span className="badge">Turn {match.turn}</span>
                </div>
                <div className="hud-signals">
                  {armedAttackerUnitId ? <span className="badge attack-armed">Attacker armed</span> : null}
                  {enemyThinking ? <span className="badge enemy-thinking">Opponent thinking...</span> : null}
                  {tutorialState ? <span className="badge">Tutorial {tutorialState.stepIndex + 1}/{tutorialState.totalSteps}</span> : null}
                  {tutorialState && tutorialState.paused ? <span className="badge is-danger">Tip paused</span> : null}
                  {myPlayer && myPlayer.nakedShortDebt > 0 ? <span className="badge is-danger">Debt {myPlayer.nakedShortDebt}</span> : null}
                  {typeof myPlayer?.blockedCol === "number" ? <span className="badge is-danger">Iron Curtain: col {myPlayer.blockedCol + 1}</span> : null}
                  <div className="status-legend" aria-label="Status legend">
                    {STATUS_LEGEND.map((status) => (
                      <span
                        key={`legend-${status.key}`}
                        className={`status-chip status-${status.key}`}
                        title={status.title}
                      >
                        {status.short}
                      </span>
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
                            if (!unitId) return;
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
                            <div className="slot-body">
                              <span className="slot-name">{compactName(match.units[unitId]?.name ?? "-", 11)}</span>
                              <span className="slot-stats">
                                atk {match.units[unitId]?.attack} · hp {match.units[unitId]?.health}
                              </span>
                              <StatusChips unit={match.units[unitId]!} turn={match.turn} />
                            </div>
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
                            if (!unitId) return;
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
                            <div className="slot-body">
                              <span className="slot-name">{compactName(match.units[unitId]?.name ?? "-", 11)}</span>
                              <span className="slot-stats">
                                atk {match.units[unitId]?.attack} · hp {match.units[unitId]?.health}
                              </span>
                              <StatusChips unit={match.units[unitId]!} turn={match.turn} />
                            </div>
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
                            }
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
                          return (
                            <button
                              key={`my-f-${col}`}
                              className={`slot friendly ${col === JUDGE_COL ? "judge-green" : ""} ${legalDrop ? "drop" : ""} ${tutorialState?.coachAnchorKind === "slot" && tutorialState.coachSide === "ally" && tutorialState.coachLane === "front" && tutorialState.coachCol === col ? "tutorial-emphasis" : ""}`}
                              data-coach-slot={`ally-front-${col}`}
                              onClick={() => {
                                if (legalDrop) {
                                  playSelectedTo("front", col);
                                }
                              }}
                            >
                              +
                            </button>
                          );
                        }

                        return (
                          <button
                            key={`my-f-${col}`}
                            className={`slot friendly own ${col === JUDGE_COL ? "judge-green" : ""} ${armedAttackerUnitId === unitId ? "armed" : ""} ${expectsAllyUnitTarget ? "effect-target" : ""} ${canDropSelectedToSlot("front", col, true) ? "flip-target" : ""} ${tutorialState?.coachAnchorKind === "slot" && tutorialState.coachSide === "ally" && tutorialState.coachLane === "front" && tutorialState.coachCol === col ? "tutorial-emphasis" : ""}`}
                            data-owned-unit-id={unitId}
                            data-coach-slot={`ally-front-${col}`}
                            data-slot-owner={mySide ?? undefined}
                            data-slot-name={match.units[unitId]?.name ?? undefined}
                            onClick={() => {
                              if (canDropSelectedToSlot("front", col, true)) {
                                playSelectedTo("front", col);
                                return;
                              }
                              if (expectsAllyUnitTarget) {
                                playSelectedOnTarget({ kind: "ally-unit", unitId });
                                return;
                              }
                              setAllyInspectCardId(match.units[unitId]?.cardId ?? null);
                              setSelectedHandIndex(null);
                              setEnemyInspectUnitId(null);
                              setEnemyInspectEventId(null);
                              setEnemyInspectJudge(false);
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
                            <div className="slot-body">
                              <span className="slot-name">{compactName(match.units[unitId]?.name ?? "-", 11)}</span>
                              <span className="slot-stats">
                                atk {match.units[unitId]?.attack} · hp {match.units[unitId]?.health}
                              </span>
                              <StatusChips unit={match.units[unitId]!} turn={match.turn} />
                            </div>
                          </button>
                        );
                      })}

                      {myPlayer.board.back.map((unitId, col) => {
                        if (!unitId) {
                          const legalDrop = canDropSelectedToSlot("back", col, false);
                          return (
                            <button
                              key={`my-b-${col}`}
                              className={`slot friendly ${col === JUDGE_COL ? "judge-blue" : ""} ${legalDrop ? "drop" : ""} ${tutorialState?.coachAnchorKind === "slot" && tutorialState.coachSide === "ally" && tutorialState.coachLane === "back" && tutorialState.coachCol === col ? "tutorial-emphasis" : ""}`}
                              data-coach-slot={`ally-back-${col}`}
                              onClick={() => {
                                if (legalDrop) {
                                  playSelectedTo("back", col);
                                }
                              }}
                            >
                              +
                            </button>
                          );
                        }

                        return (
                          <button
                            key={`my-b-${col}`}
                            className={`slot friendly own ${col === JUDGE_COL ? "judge-blue" : ""} ${armedAttackerUnitId === unitId ? "armed" : ""} ${expectsAllyUnitTarget ? "effect-target" : ""} ${canDropSelectedToSlot("back", col, true) ? "flip-target" : ""} ${tutorialState?.coachAnchorKind === "slot" && tutorialState.coachSide === "ally" && tutorialState.coachLane === "back" && tutorialState.coachCol === col ? "tutorial-emphasis" : ""}`}
                            data-owned-unit-id={unitId}
                            data-coach-slot={`ally-back-${col}`}
                            data-slot-owner={mySide ?? undefined}
                            data-slot-name={match.units[unitId]?.name ?? undefined}
                            onClick={() => {
                              if (canDropSelectedToSlot("back", col, true)) {
                                playSelectedTo("back", col);
                                return;
                              }
                              if (expectsAllyUnitTarget) {
                                playSelectedOnTarget({ kind: "ally-unit", unitId });
                                return;
                              }
                              setAllyInspectCardId(match.units[unitId]?.cardId ?? null);
                              setSelectedHandIndex(null);
                              setEnemyInspectUnitId(null);
                              setEnemyInspectEventId(null);
                              setEnemyInspectJudge(false);
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
                            <div className="slot-body">
                              <span className="slot-name">{compactName(match.units[unitId]?.name ?? "-", 11)}</span>
                              <span className="slot-stats">
                                atk {match.units[unitId]?.attack} · hp {match.units[unitId]?.health}
                              </span>
                              <StatusChips unit={match.units[unitId]!} turn={match.turn} />
                            </div>
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
                          <p>Effect: {allyInspectCard.effectText}</p>
                          <p>{allyInspectCard.resistanceText}</p>
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
                          <p>Effect: {enemyInspectCard.effectText}</p>
                          <p>{enemyInspectCard.resistanceText}</p>
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
                        return (
                          <button
                            key={`${cardId}-${idx}`}
                            className={`hand-card ${selectedHandIndex === idx ? "selected" : ""} ${centerHandIndex === idx ? "centered" : ""} ${tutorialState?.coachAnchorKind === "hand-card" && tutorialState.coachCardId === cardId ? "tutorial-emphasis" : ""}`}
                            data-hand-index={idx}
                            data-hand-card-id={cardId}
                            onClick={() => onHandCardTap(idx, cardId)}
                          >
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
                        const nextTab: LobbyTab = match.mode === "pvp" ? "pvp" : match.mode === "tutorial" ? "tutorial" : "quick";
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
                      {match.mode === "pvp" ? "Back to PvP Play" : "Back to Lobby"}
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
                  <p className="full-copy"><strong>Card impact:</strong> {streetEffectText(expandedCard.effectText)}</p>
                  <p className="full-copy"><strong>Survival:</strong> {streetResistanceText(expandedCard.resistanceText)}</p>
                </div>
              </div>
              <div className="full-preview-foot">
                <article className="full-copy-block">
                  <h3>Street read</h3>
                  <p>{streetLoreText(expandedCard.flavorText)}</p>
                </article>
                <article className="full-copy-block">
                  <h3>Full effect text</h3>
                  <p>{expandedCard.effectText}</p>
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
                      className={`hand-card ${mulliganPick.includes(idx) ? "selected" : ""}`}
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






