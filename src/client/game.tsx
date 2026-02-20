import { context, getWebViewMode } from "@devvit/web/client";
import { StrictMode, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { API_ROUTES, postJson } from "../shared/api";
import { getCardPreview } from "../shared/cards";
import { JUDGE_COL, normalizeUsername, type FactionId, type InviteState, type MatchState, type PlayCardTarget, type PlayerSide } from "../shared/game";
import "./index.css";

type UiContext = {
  weekId: string;
  postId: string;
  userId: string;
  username: string;
  clientName: "ANDROID" | "IOS" | "WEB";
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

const FACTIONS: Array<{ id: FactionId; label: string; motto: string; tone: string }> = [
  { id: "wallstreet", label: "Wallstreet", motto: "Premium alpha desks", tone: "tempo + scaling" },
  { id: "sec", label: "SEC", motto: "Audits and injunctions", tone: "control + disruption" },
  { id: "market_makers", label: "Market Makers", motto: "Spread and liquidity loops", tone: "value + utility" },
  { id: "short_hedgefund", label: "Short Hedgefund", motto: "Pressure through leverage", tone: "risk + burst" },
  { id: "retail_mob", label: "Retail Mob", motto: "Momentum swarms", tone: "wide board + spikes" },
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

function factionLabel(faction: string): string {
  return faction.replace(/_/g, " ");
}

function roleLabel(role: "offensive" | "defensive" | "bureaucrat" | "utility"): string {
  if (role === "offensive") return "offense";
  if (role === "defensive") return "defense";
  if (role === "bureaucrat") return "bureaucrat";
  return "utility";
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

function targetHint(rule: "none" | "ally-unit" | "enemy-unit" | "ally-unit-or-leader" | "enemy-unit-or-leader"): string {
  if (rule === "ally-unit") return "Select a friendly unit.";
  if (rule === "enemy-unit") return "Select an enemy unit.";
  if (rule === "ally-unit-or-leader") return "Select a friendly unit or your leader.";
  if (rule === "enemy-unit-or-leader") return "Select an enemy unit or enemy leader.";
  return "";
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

  const [pendingInvites, setPendingInvites] = useState<InviteState[]>([]);
  const [ongoingMatchIds, setOngoingMatchIds] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);

  const [inviteTarget, setInviteTarget] = useState("");
  const [selectedFaction, setSelectedFaction] = useState<FactionId>("market_makers");
  const [match, setMatch] = useState<MatchState | null>(null);
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [mulliganPick, setMulliganPick] = useState<number[]>([]);

  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [artFailures, setArtFailures] = useState<Record<string, boolean>>({});
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
  const remoteAnimatingRef = useRef(false);
  const matchRef = useRef<MatchState | null>(null);

  async function loadLobby(): Promise<void> {
    setLoading(true);
    setError("");

    const response = await postJson(API_ROUTES.lobby, {
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
    setOngoingMatchIds(response.data.snapshot.ongoingMatchIds ?? []);
    setLeaderboard(response.data.snapshot.leaderboard ?? []);
  }

  async function refreshMatch(matchId: string): Promise<void> {
    if (remoteAnimatingRef.current) {
      return;
    }
    const response = await postJson(API_ROUTES.matchGet, { matchId });
    if (!response.ok) {
      setError(response.error);
      return;
    }
    const nextMatch = response.data.match;
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
    setMatch(response.data.result.match);
    setSelectedHandIndex(null);
  }

  async function createInvite(): Promise<void> {
    setLoading(true);
    setError("");

    const response = await postJson(API_ROUTES.inviteCreate, {
      weekId: ctx.weekId,
      postId: ctx.postId,
      userId: ctx.userId,
      username: ctx.username,
      targetUsername: inviteTarget,
      faction: selectedFaction,
    });

    setLoading(false);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    setInviteTarget("");
    setInfo(`Invite sent to u/${response.data.invite.targetUsername}.`);
    await loadLobby();
  }

  async function acceptInvite(inviteId: string): Promise<void> {
    setLoading(true);
    setError("");

    const response = await postJson(API_ROUTES.inviteAccept, {
      inviteId,
      userId: ctx.userId,
      username: ctx.username,
      faction: selectedFaction,
    });

    setLoading(false);

    if (!response.ok || !response.data.result.ok) {
      setError(response.ok ? response.data.result.error ?? "Failed to accept invite." : response.error);
      return;
    }

    setMatch(response.data.result.match);
    setInfo("Invite accepted.");
    setSelectedHandIndex(null);
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
  }, [match, enemyInspectUnitId]);

  useEffect(() => {
    if (!match) return;
    const id = window.setInterval(() => {
      void refreshMatch(match.id);
    }, 1500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id]);

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
  const selectedTargetRule = selectedCard?.targetRule ?? "none";
  const selectedCardIsUnit = selectedCard?.type === "unit";
  const canPlaySelected = Boolean(isMyTurn && mySide && myPlayer && selectedHandIndex !== null && selectedCardId);
  const canJudgeCastSelected = Boolean(canPlaySelected && !selectedCardIsUnit && selectedTargetRule === "none");
  const expectsAllyUnitTarget = Boolean(canPlaySelected && !selectedCardIsUnit && (selectedTargetRule === "ally-unit" || selectedTargetRule === "ally-unit-or-leader"));
  const expectsEnemyUnitTarget = Boolean(canPlaySelected && !selectedCardIsUnit && (selectedTargetRule === "enemy-unit" || selectedTargetRule === "enemy-unit-or-leader"));
  const expectsAllyLeaderTarget = Boolean(canPlaySelected && !selectedCardIsUnit && selectedTargetRule === "ally-unit-or-leader");
  const expectsEnemyLeaderTarget = Boolean(canPlaySelected && !selectedCardIsUnit && selectedTargetRule === "enemy-unit-or-leader");

  const showMulligan = Boolean(match && mySide && match.status === "mulligan" && !match.players[mySide].mulliganDone);
  const selectedFactionInfo = FACTIONS.find((f) => f.id === selectedFaction) ?? FACTIONS[0]!;

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

            <article className="card-block lobby-main lobby-main--invite">
              <div className="panel-head">
                <h2>Invite PvP</h2>
                <p className="subtle">Ping a username without `u/` and start a direct trial.</p>
              </div>
              <div className="inline-input">
                <input className="text-input" placeholder="username" value={inviteTarget} onChange={(e) => setInviteTarget(e.target.value)} />
                <button className="action-btn action-btn--primary" onClick={() => void createInvite()} disabled={loading || inviteTarget.trim().length < 2}>Send</button>
              </div>
              <p className="subtle">Selected deck: {selectedFactionInfo.label} · {selectedFactionInfo.motto}</p>
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
                <h3>Resume Match</h3>
                <ul className="simple-list">
                  {ongoingMatchIds.length === 0 ? <li>No active matches.</li> : null}
                  {ongoingMatchIds.map((matchId) => (
                    <li key={matchId}>
                      <span>{shortId(matchId)}</span>
                      <button className="action-btn" onClick={() => void refreshMatch(matchId)}>Open</button>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="card-block small">
                <h3>Leaderboard</h3>
                <ol className="ranking-list">
                  {leaderboard.length === 0 ? <li>No finished matches yet.</li> : null}
                  {leaderboard.map((row) => (
                    <li key={row.username}>u/{row.username} · W{row.wins} L{row.losses} · M{row.matches}</li>
                  ))}
                </ol>
              </article>
            </div>
          </section>
        ) : (
          <section className="battle-shell landscape">
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
                          className={`slot enemy ${col === JUDGE_COL ? "judge-blue" : ""} ${armedAttackerUnitId && unitId ? "attack-target" : ""} ${expectsEnemyUnitTarget && unitId ? "effect-target" : ""}`}
                          data-attack-target={unitId ? "unit" : undefined}
                          data-unit-id={unitId ?? undefined}
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
                          className={`slot enemy ${col === JUDGE_COL ? "judge-green" : ""} ${armedAttackerUnitId && unitId ? "attack-target" : ""} ${expectsEnemyUnitTarget && unitId ? "effect-target" : ""}`}
                          data-attack-target={unitId ? "unit" : undefined}
                          data-unit-id={unitId ?? undefined}
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
                              tryAttackTarget({ kind: "judge" });
                              return;
                            }
                            if (eventId) {
                              tryAttackTarget({ kind: "event", eventUnitId: eventId });
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
                          return (
                            <button
                              key={`my-f-${col}`}
                              className={`slot friendly ${col === JUDGE_COL ? "judge-green" : ""} ${canPlaySelected && selectedCardIsUnit ? "drop" : ""}`}
                              onClick={() => {
                                if (!canPlaySelected) return;
                                if (selectedCardIsUnit) {
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
                            className={`slot friendly own ${col === JUDGE_COL ? "judge-green" : ""} ${armedAttackerUnitId === unitId ? "armed" : ""} ${expectsAllyUnitTarget ? "effect-target" : ""}`}
                            data-owned-unit-id={unitId}
                            data-slot-owner={mySide ?? undefined}
                            data-slot-name={match.units[unitId]?.name ?? undefined}
                            onClick={() => {
                              if (expectsAllyUnitTarget) {
                                playSelectedOnTarget({ kind: "ally-unit", unitId });
                                return;
                              }
                              setAllyInspectCardId(match.units[unitId]?.cardId ?? null);
                              setSelectedHandIndex(null);
                              setArmedAttackerUnitId((prev) => (prev === unitId ? null : unitId));
                            }}
                            onPointerDown={(e) => {
                              if (!isMyTurn || !mySide) return;
                              beginDragAttack(e, unitId);
                            }}
                            onPointerMove={moveDragAttack}
                            onPointerUp={(e) => {
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
                          return (
                            <button
                              key={`my-b-${col}`}
                              className={`slot friendly ${col === JUDGE_COL ? "judge-blue" : ""} ${canPlaySelected && selectedCardIsUnit ? "drop" : ""}`}
                              onClick={() => {
                                if (!canPlaySelected) return;
                                if (selectedCardIsUnit) {
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
                            className={`slot friendly own ${col === JUDGE_COL ? "judge-blue" : ""} ${armedAttackerUnitId === unitId ? "armed" : ""} ${expectsAllyUnitTarget ? "effect-target" : ""}`}
                            data-owned-unit-id={unitId}
                            data-slot-owner={mySide ?? undefined}
                            data-slot-name={match.units[unitId]?.name ?? undefined}
                            onClick={() => {
                              if (expectsAllyUnitTarget) {
                                playSelectedOnTarget({ kind: "ally-unit", unitId });
                                return;
                              }
                              setAllyInspectCardId(match.units[unitId]?.cardId ?? null);
                              setSelectedHandIndex(null);
                              setArmedAttackerUnitId((prev) => (prev === unitId ? null : unitId));
                            }}
                            onPointerDown={(e) => {
                              if (!isMyTurn || !mySide) return;
                              beginDragAttack(e, unitId);
                            }}
                            onPointerMove={moveDragAttack}
                            onPointerUp={(e) => {
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
                      ) : (
                        <p>Tap enemy unit on board to inspect full card details.</p>
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
                            className={`hand-card ${selectedHandIndex === idx ? "selected" : ""} ${centerHandIndex === idx ? "centered" : ""}`}
                            data-hand-index={idx}
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
                              <span className={`role-chip role-${card.role}`}>{roleLabel(card.role)}</span>
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
                        className="action-btn"
                        onClick={() => {
                          if (!mySide) return;
                          void runAction(API_ROUTES.matchEndTurn, { side: mySide });
                        }}
                      >
                        End Turn
                      </button>
                      {canPlaySelected && !selectedCardIsUnit && selectedTargetRule === "none" ? (
                        <button className="action-btn secondary" onClick={castSelectedWithoutTarget}>
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
                    <div className="selected-preview">
                      {selectedCard ? (
                        <>
                          <p>
                            {selectedCard.name} · {factionLabel(selectedCard.faction)} · atk {selectedCard.attack ?? "-"} · def {selectedCard.defense ?? "-"} · row {selectedCard.row}
                          </p>
                          <p>{selectedCard.effectText}</p>
                          <p>{selectedCard.resistanceText}</p>
                          {selectedCard.targetRule !== "none" ? <p>{targetHint(selectedCard.targetRule)}</p> : null}
                          {selectedCard.targetRule === "none" && selectedCard.type !== "unit" ? <p>Use Cast Card or tap Judge slot to resolve this effect.</p> : null}
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
              <h2>{expandedCard.name}</h2>
              <p className="subtle">{factionLabel(expandedCard.faction).toUpperCase()} · {expandedCard.type.toUpperCase()} · COST {expandedCard.costShares} · ROW {expandedCard.row}</p>
              {artFailures[expandedCard.id] ? (
                <div className="art-placeholder">Missing art: {expandedCard.id}</div>
              ) : (
                <img
                  className="full-art"
                  src={expandedCard.artPath}
                  alt={expandedCard.name}
                  loading="lazy"
                  onError={() => setArtFailures((prev) => ({ ...prev, [expandedCard.id]: true }))}
                />
              )}
              <div className="full-stats">
                <span>attack: {expandedCard.attack ?? "-"}</span>
                <span>def: {expandedCard.defense ?? "-"}</span>
                <span>dirty: {expandedCard.dirtyPower}</span>
              </div>
              <p>Effect: {expandedCard.effectText}</p>
              <p>{expandedCard.resistanceText}</p>
              {expandedCard.flavorText ? <p>Lore: {expandedCard.flavorText}</p> : null}
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






