import "./index.css";

import { context, getWebViewMode, requestExpandedMode } from "@devvit/web/client";
import { StrictMode, type ReactNode, type SyntheticEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { API_ROUTES, postJson, type LobbyRequest, type LobbyResponse } from "../shared/api";
import { CARD_PREVIEW, getCardPreview, type CardPreviewMeta } from "../shared/cards";
import type { FactionId } from "../shared/game";

type ModalId = "top10" | "about" | "collection" | null;
type TopBoardId = "pvp" | "l1" | "l2" | "l3";

type FactionMeta = {
  id: FactionId;
  label: string;
  motto: string;
};

type ModalPage = {
  id: string;
  label: string;
  content: ReactNode;
};

const FRACTIONS: readonly FactionMeta[] = [
  { id: "retail_mob", label: "Retail Mob", motto: "Crowd chaos and comeback tempo." },
  { id: "market_makers", label: "Market Makers", motto: "Spread control and liquidity loops." },
  { id: "wallstreet", label: "Wallstreet", motto: "Premium pressure and alpha bursts." },
  { id: "sec", label: "SEC", motto: "Audits, sanctions, and denial lines." },
  { id: "short_hedgefund", label: "Short Hedgefund", motto: "Dirty value and Judge heat." },
];

function readPostField(name: "weekId" | "weekNumber"): string | number | null {
  if (typeof context.postData !== "object" || context.postData === null) {
    return null;
  }
  const value = Reflect.get(context.postData, name);
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return null;
}

function readWeekId(): string {
  const weekId = readPostField("weekId");
  return typeof weekId === "string" && weekId.trim().length > 0 ? weekId : "unknown-week";
}

function readWeekNumber(): number {
  const weekNumber = readPostField("weekNumber");
  if (typeof weekNumber === "number" && Number.isFinite(weekNumber) && weekNumber >= 0) {
    return Math.floor(weekNumber);
  }
  return 0;
}

function byCardName(a: CardPreviewMeta, b: CardPreviewMeta): number {
  return a.name.localeCompare(b.name);
}

function compact(text: string, max = 30): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function factionLabel(faction: string): string {
  return faction.replace(/_/g, " ");
}

function applyArtFallback(event: SyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget;
  const chainRaw = image.dataset.fallbackChain ?? "";
  const chain = chainRaw.length > 0 ? chainRaw.split("|").filter((src: string) => src.length > 0) : [];
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

function boardLabel(board: TopBoardId): string {
  if (board === "pvp") return "PvP";
  if (board === "l1") return "AI L1";
  if (board === "l2") return "AI L2";
  return "AI L3";
}

function modalTitle(modal: Exclude<ModalId, null>): string {
  if (modal === "top10") return "Week's Top";
  if (modal === "about") return "About Game";
  return "Card Collection";
}

function chunkItems<T>(items: readonly T[], chunkSize: number): T[][] {
  const safeChunkSize = Math.max(1, Math.floor(chunkSize));
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += safeChunkSize) {
    chunks.push(items.slice(index, index + safeChunkSize));
  }
  return chunks;
}

export function Splash() {
  const weekId = readWeekId();
  const weekNumber = readWeekNumber();
  const webViewMode = getWebViewMode();
  const platformClass = context.client?.name === "ANDROID" || context.client?.name === "IOS" ? "platform-mobile" : "platform-desktop";

  const [activeModal, setActiveModal] = useState<ModalId>(null);
  const [activeBoard, setActiveBoard] = useState<TopBoardId>("pvp");
  const [activeCollectionFaction, setActiveCollectionFaction] = useState<FactionId>("retail_mob");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [modalPageIndex, setModalPageIndex] = useState(0);
  const [loadingLobby, setLoadingLobby] = useState(false);
  const [lobbyError, setLobbyError] = useState("");
  const [unlockedFactions, setUnlockedFactions] = useState<FactionId[]>(["retail_mob"]);
  const [topPvp, setTopPvp] = useState<LobbyResponse["snapshot"]["leaderboardPvp"]>([]);
  const [topL1, setTopL1] = useState<LobbyResponse["snapshot"]["leaderboardPveByLevel"]["l1"]>([]);
  const [topL2, setTopL2] = useState<LobbyResponse["snapshot"]["leaderboardPveByLevel"]["l2"]>([]);
  const [topL3, setTopL3] = useState<LobbyResponse["snapshot"]["leaderboardPveByLevel"]["l3"]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadLobbyData(): Promise<void> {
      setLoadingLobby(true);
      setLobbyError("");
      const response = await postJson<LobbyRequest, LobbyResponse>(API_ROUTES.lobby, {});
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setLobbyError(response.error || "Cannot load weekly briefing.");
        setLoadingLobby(false);
        return;
      }
      const unlocked: FactionId[] = response.data.snapshot.unlockedFactions.length > 0 ? response.data.snapshot.unlockedFactions : ["retail_mob"];
      setUnlockedFactions(unlocked);
      setActiveCollectionFaction((current) => (unlocked.includes(current) ? current : "retail_mob"));
      setTopPvp(response.data.snapshot.leaderboardPvp ?? []);
      setTopL1(response.data.snapshot.leaderboardPveByLevel?.l1 ?? []);
      setTopL2(response.data.snapshot.leaderboardPveByLevel?.l2 ?? []);
      setTopL3(response.data.snapshot.leaderboardPveByLevel?.l3 ?? []);
      setLoadingLobby(false);
    }

    void loadLobbyData();
    return () => {
      cancelled = true;
    };
  }, []);

  const cardsByFaction = useMemo(() => {
    const allCards = Object.values(CARD_PREVIEW);
    const map = new Map<FactionId, CardPreviewMeta[]>();
    for (const faction of FRACTIONS) {
      map.set(
        faction.id,
        allCards
          .filter((card) => card.faction === faction.id)
          .sort(byCardName),
      );
    }
    return map;
  }, []);

  const commonCards = useMemo(
    () =>
      Object.values(CARD_PREVIEW)
        .filter((card) => card.faction === "neutral" || card.faction === "utility")
        .sort(byCardName),
    [],
  );

  const activeFactionCards = useMemo(() => cardsByFaction.get(activeCollectionFaction) ?? [], [cardsByFaction, activeCollectionFaction]);
  const isFactionUnlocked = activeCollectionFaction === "retail_mob" || unlockedFactions.includes(activeCollectionFaction);
  const topRows = activeBoard === "pvp" ? topPvp : activeBoard === "l1" ? topL1 : activeBoard === "l2" ? topL2 : topL3;
  const expandedCard = expandedCardId ? getCardPreview(expandedCardId) : null;
  const leaderboardRowsPerPage = webViewMode === "inline" ? 5 : 8;
  const collectionCardsPerPage = webViewMode === "inline" ? 4 : 8;
  const factionCardsChunks = useMemo(() => chunkItems(activeFactionCards, collectionCardsPerPage), [activeFactionCards, collectionCardsPerPage]);
  const commonCardsChunks = useMemo(() => chunkItems(commonCards, collectionCardsPerPage), [commonCards, collectionCardsPerPage]);
  const leaderboardChunks = useMemo(() => chunkItems(topRows, leaderboardRowsPerPage), [topRows, leaderboardRowsPerPage]);

  function closeModal(): void {
    setActiveModal(null);
    setModalPageIndex(0);
  }

  function openModal(modal: Exclude<ModalId, null>): void {
    setActiveModal(modal);
    setModalPageIndex(0);
  }

  const openCardPreview = useCallback((cardId: string): void => {
    setExpandedCardId(cardId);
  }, []);

  const onCollectionCardClick = useCallback((cardId: string): void => {
    openCardPreview(cardId);
  }, [openCardPreview]);

  const chooseCollectionFaction = useCallback((faction: FactionId): void => {
    setActiveCollectionFaction(faction);
    setModalPageIndex(0);
  }, []);

  const aboutPages = useMemo<ModalPage[]>(
    () => [
      {
        id: "about-1",
        label: "Story",
        content: (
          <section className="sb-modal-page sb-about-body">
            <p className="sb-about-lead">
              Welcome to a city where ethics are a premium skin and liquidity is a religion.
              Court of Capital is a tactical courtroom brawler with strong r/superstonk vibes, minus the tinfoil overdose.
            </p>
            <article className="sb-about-card">
              <h3>The Rotten Story</h3>
              <p>
                Financial elites, overleveraged operators, and angry retail crews fight for control of the same court.
                Every match is a public trial with private agendas. Someone will call it "market efficiency".
                Someone else will call it crime.
              </p>
            </article>
            <article className="sb-about-card">
              <h3>The Board In Plain Words</h3>
              <ul className="sb-list">
                <li><span>Lane map</span><strong>2x5 your side, middle events, 2x5 enemy side</strong></li>
                <li><span>Turn rhythm</span><strong>Play, cast, attack, then beat the timer</strong></li>
                <li><span>Win line</span><strong>Drop enemy leader HP to 0 before they do the same</strong></li>
                <li><span>Leader shield</span><strong>Enemy front row reduces leader damage (1 unit: -1, 2 units: -2, 3+ blocks)</strong></li>
              </ul>
            </article>
          </section>
        ),
      },
      {
        id: "about-2",
        label: "Judge",
        content: (
          <section className="sb-modal-page sb-about-body">
            <article className="sb-about-card">
              <h3>Judge and The Two Specialists</h3>
              <ul className="sb-list">
                <li><span>Green Judge slot</span><strong>Legal pressure, petitions, cleaner control tools</strong></li>
                <li><span>Blue Judge slot</span><strong>Bribes, dirty leverage, debuff pressure</strong></li>
                <li><span>Combo moment</span><strong>Own Green + Blue active means stronger court swing plays</strong></li>
                <li><span>Backline rule</span><strong>Reach/Ranged is still required to hit enemy back row (and most back-row leader attacks)</strong></li>
              </ul>
            </article>
            <article className="sb-about-card">
              <h3>Shares, Dirty Plays, and Consequences</h3>
              <ul className="sb-list">
                <li><span>Shares</span><strong>Your fuel. No shares, no big brain plays</strong></li>
                <li><span>Dirty cards</span><strong>Huge upside now, higher Judge hostility later</strong></li>
                <li><span>Naked shorting</span><strong>Fast cash plus debt spiral if you do not repay in time</strong></li>
              </ul>
            </article>
          </section>
        ),
      },
      {
        id: "about-3",
        label: "Why Play",
        content: (
          <section className="sb-modal-page sb-about-body">
            <article className="sb-about-card">
              <h3>Why People Stay</h3>
              <p>
                Fast turns, readable board states, and enough chaos to create highlight moments.
                Weekly resets keep the race fresh. Every Sunday leaderboard drama writes itself.
              </p>
            </article>
            <article className="sb-about-card">
              <h3>Quick Read</h3>
              <ul className="sb-list">
                <li><span>Skill curve</span><strong>Easy to start, hard to master</strong></li>
                <li><span>Session size</span><strong>Designed for short, high-focus matches</strong></li>
                <li><span>Identity</span><strong>Finance satire with tactical lane control</strong></li>
              </ul>
            </article>
          </section>
        ),
      },
    ],
    [],
  );

  const leaderboardPages = useMemo<ModalPage[]>(() => {
    if (loadingLobby) {
      return [
        {
          id: "top-loading",
          label: "Loading",
          content: (
            <section className="sb-modal-page">
              <div className="sb-tabs" role="tablist" aria-label="Leaderboard tabs">
                {(["pvp", "l1", "l2", "l3"] as const).map((board) => (
                  <button
                    key={`sb-board-${board}`}
                    className={`badge-btn ${activeBoard === board ? "active" : ""}`}
                    onClick={() => {
                      setActiveBoard(board);
                      setModalPageIndex(0);
                    }}
                  >
                    {boardLabel(board)}
                  </button>
                ))}
              </div>
              <p className="subtle">Loading weekly board...</p>
            </section>
          ),
        },
      ];
    }

    if (lobbyError.length > 0) {
      return [
        {
          id: "top-error",
          label: "Error",
          content: (
            <section className="sb-modal-page">
              <div className="sb-tabs" role="tablist" aria-label="Leaderboard tabs">
                {(["pvp", "l1", "l2", "l3"] as const).map((board) => (
                  <button
                    key={`sb-board-${board}`}
                    className={`badge-btn ${activeBoard === board ? "active" : ""}`}
                    onClick={() => {
                      setActiveBoard(board);
                      setModalPageIndex(0);
                    }}
                  >
                    {boardLabel(board)}
                  </button>
                ))}
              </div>
              <p className="subtle">{lobbyError}</p>
            </section>
          ),
        },
      ];
    }

    if (leaderboardChunks.length === 0) {
      return [
        {
          id: "top-empty",
          label: "No Matches",
          content: (
            <section className="sb-modal-page">
              <div className="sb-tabs" role="tablist" aria-label="Leaderboard tabs">
                {(["pvp", "l1", "l2", "l3"] as const).map((board) => (
                  <button
                    key={`sb-board-${board}`}
                    className={`badge-btn ${activeBoard === board ? "active" : ""}`}
                    onClick={() => {
                      setActiveBoard(board);
                      setModalPageIndex(0);
                    }}
                  >
                    {boardLabel(board)}
                  </button>
                ))}
              </div>
              <p className="subtle">No finished matches yet in this bracket.</p>
            </section>
          ),
        },
      ];
    }

    return leaderboardChunks.map((rowsChunk, chunkIndex) => {
      const rankOffset = chunkIndex * leaderboardRowsPerPage;
      return {
        id: `top-${activeBoard}-${chunkIndex + 1}`,
        label: `${boardLabel(activeBoard)} ${chunkIndex + 1}`,
        content: (
          <section className="sb-modal-page">
            <div className="sb-tabs" role="tablist" aria-label="Leaderboard tabs">
              {(["pvp", "l1", "l2", "l3"] as const).map((board) => (
                <button
                  key={`sb-board-${board}`}
                  className={`badge-btn ${activeBoard === board ? "active" : ""}`}
                  onClick={() => {
                    setActiveBoard(board);
                    setModalPageIndex(0);
                  }}
                >
                  {boardLabel(board)}
                </button>
              ))}
            </div>
            <ol className="sb-ranking">
              {rowsChunk.map((row, rowIndex) => (
                <li key={`sb-rank-${activeBoard}-${row.userId}-${chunkIndex}`}>
                  <span>{rankOffset + rowIndex + 1}. u/{row.username}</span>
                  <strong>W{row.wins} L{row.losses} - M{row.matches}</strong>
                </li>
              ))}
            </ol>
          </section>
        ),
      };
    });
  }, [activeBoard, leaderboardChunks, leaderboardRowsPerPage, loadingLobby, lobbyError]);

  const collectionPages = useMemo<ModalPage[]>(() => {
    const factionPicker = (
      <div className="faction-picker faction-grid sb-factions">
        {FRACTIONS.map((faction) => {
          const unlocked = faction.id === "retail_mob" || unlockedFactions.includes(faction.id);
          return (
            <button
              key={`sb-faction-${faction.id}`}
              className={`faction-btn faction-btn--rich ${activeCollectionFaction === faction.id ? "active" : ""} ${unlocked ? "" : "locked"}`}
              onClick={() => chooseCollectionFaction(faction.id)}
            >
              <span>{faction.label}</span>
              <small>{unlocked ? "Unlocked" : "Locked"}</small>
            </button>
          );
        })}
      </div>
    );

    if (!isFactionUnlocked) {
      return [
        {
          id: "collection-locked",
          label: "Overview",
          content: (
            <section className="sb-modal-page">
              <p className="subtle">Retail Mob is unlocked by default. Other factions unlock after at least one match using that faction.</p>
              {factionPicker}
              <div className="sb-lock">
                <h3>{FRACTIONS.find((f) => f.id === activeCollectionFaction)?.label ?? "Faction"} locked</h3>
                <p>Play one match with this faction in the main game to reveal its card list.</p>
              </div>
            </section>
          ),
        },
      ];
    }

    const pages: ModalPage[] = [];

    factionCardsChunks.forEach((cardsChunk, chunkIndex) => {
      pages.push({
        id: `collection-faction-${chunkIndex + 1}`,
        label: `${factionLabel(activeCollectionFaction)} ${chunkIndex + 1}`,
        content: (
          <section className="sb-modal-page">
            {chunkIndex === 0 ? (
              <>
                <p className="subtle">Retail Mob is unlocked by default. Other factions unlock after at least one match using that faction.</p>
                {factionPicker}
                <p className="subtle">{FRACTIONS.find((f) => f.id === activeCollectionFaction)?.motto ?? ""}</p>
                <p className="subtle">Tap any card to open full preview.</p>
              </>
            ) : (
              factionPicker
            )}
            <h3 className="sb-subhead">{factionLabel(activeCollectionFaction)} cards</h3>
            <ul className="sb-cards">
              {cardsChunk.map((card) => (
                <li key={`sb-card-${card.id}`}>
                  <button
                    className="sb-card-btn"
                    onClick={() => onCollectionCardClick(card.id)}
                  >
                    <span>{compact(card.name)}</span>
                    <small>{card.type} - row {card.row}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ),
      });
    });

    commonCardsChunks.forEach((cardsChunk, chunkIndex) => {
      pages.push({
        id: `collection-common-${chunkIndex + 1}`,
        label: `Common ${chunkIndex + 1}`,
        content: (
          <section className="sb-modal-page">
            {factionPicker}
            <h3 className="sb-subhead">Common cards</h3>
            <ul className="sb-cards sb-cards-common">
              {cardsChunk.map((card) => (
                <li key={`sb-common-${card.id}`}>
                  <button
                    className="sb-card-btn"
                    onClick={() => onCollectionCardClick(card.id)}
                  >
                    <span>{compact(card.name)}</span>
                    <small>{card.faction}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ),
      });
    });

    return pages;
  }, [
    activeCollectionFaction,
    chooseCollectionFaction,
    commonCardsChunks,
    factionCardsChunks,
    isFactionUnlocked,
    onCollectionCardClick,
    unlockedFactions,
  ]);

  const modalPages = activeModal === "about" ? aboutPages : activeModal === "top10" ? leaderboardPages : activeModal === "collection" ? collectionPages : [];
  const clampedModalPageIndex = modalPages.length === 0 ? 0 : Math.min(modalPageIndex, modalPages.length - 1);
  const currentModalPage = modalPages[clampedModalPageIndex] ?? null;

  return (
    <div className={`app-shell app-shell--splash app-shell--splash-clean wv-${webViewMode} ${platformClass}`}>
      <section className="card-block sb-top" aria-label="Court of Capital intro">
        <div className="sb-top-content">
          <p className="sb-kicker">Weekly Courtroom Arena</p>
          <h1 className="sb-title">Court of Capital</h1>
          <p className="sb-desc">Build pressure, command lanes, and tilt the Judge before the clock ends.</p>
        </div>
      </section>

      <section className="card-block sb-middle" aria-label="Primary action">
        <button className="action-btn action-btn--primary sb-enter" onClick={(event) => requestExpandedMode(event.nativeEvent, "game")}>
          Enter Court
        </button>
        <p className="sb-weekline">Week #{weekNumber} {weekId}</p>
      </section>

      <section className="card-block sb-bottom" aria-label="Secondary navigation">
        <button className="sb-nav" onClick={() => openModal("top10")}>WEEK'S TOP</button>
        <button className="sb-nav" onClick={() => openModal("about")}>ABOUT GAME</button>
        <button className="sb-nav" onClick={() => openModal("collection")}>CARD COLLECTION</button>
      </section>

      {activeModal ? (
        <div className="sb-modal-backdrop" onClick={closeModal}>
          <article className="card-block sb-modal" onClick={(event) => event.stopPropagation()}>
            <header className="sb-modal-head">
              <h2>{modalTitle(activeModal)}</h2>
              <button className="close-btn" onClick={closeModal}>Close</button>
            </header>

            <section className="sb-modal-body">
              {currentModalPage ? currentModalPage.content : null}
            </section>

            <footer className="sb-modal-footer">
              <button
                className="action-btn secondary sb-page-btn"
                disabled={clampedModalPageIndex <= 0}
                onClick={() => setModalPageIndex(Math.max(0, clampedModalPageIndex - 1))}
              >
                Prev page &lt;&lt;
              </button>
              <p className="sb-modal-page-meta">
                {modalPages.length === 0 ? "Page 0/0" : `Page ${clampedModalPageIndex + 1}/${modalPages.length} - ${currentModalPage?.label ?? ""}`}
              </p>
              <button
                className="action-btn secondary sb-page-btn"
                disabled={clampedModalPageIndex >= modalPages.length - 1}
                onClick={() => setModalPageIndex(Math.min(modalPages.length - 1, clampedModalPageIndex + 1))}
              >
                &gt;&gt; Next page
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      {expandedCard ? (
        <div className="full-preview-overlay" onClick={() => setExpandedCardId(null)}>
          <div className="full-preview" onClick={(event) => event.stopPropagation()}>
            <button className="close-btn" onClick={() => setExpandedCardId(null)}>Close</button>
            <div className="full-preview-head">
              <h2>{expandedCard.name}</h2>
              <p className="subtle">
                {factionLabel(expandedCard.faction).toUpperCase()} - {expandedCard.type.toUpperCase()} - COST {expandedCard.costShares} - ROW {expandedCard.row}
              </p>
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
                <p className="full-copy"><strong>Card impact:</strong> {expandedCard.effectText}</p>
                <p className="full-copy"><strong>Survival:</strong> {expandedCard.resistanceText}</p>
              </div>
            </div>
            <div className="full-preview-foot">
              <article className="full-copy-block">
                <h3>Lore</h3>
                <p>{expandedCard.flavorText || "No lore text yet."}</p>
              </article>
              <article className="full-copy-block">
                <h3>Full effect text</h3>
                <p>{expandedCard.effectText}</p>
              </article>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element for Court of Capital splash.");
}

createRoot(rootEl).render(
  <StrictMode>
    <Splash />
  </StrictMode>,
);
