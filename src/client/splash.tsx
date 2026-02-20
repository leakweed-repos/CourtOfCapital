import "./index.css";

import { context, getWebViewMode, requestExpandedMode } from "@devvit/web/client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function readWeekId(): string {
  if (!context.postData || typeof context.postData !== "object") {
    return "unknown-week";
  }
  const weekId = (context.postData as Record<string, unknown>).weekId;
  return typeof weekId === "string" && weekId.trim().length > 0 ? weekId : "unknown-week";
}

export function Splash() {
  const weekId = readWeekId();
  const webViewMode = getWebViewMode();
  const platformClass = context.client?.name === "ANDROID" || context.client?.name === "IOS" ? "platform-mobile" : "platform-desktop";

  return (
    <div className={`app-shell app-shell--splash wv-${webViewMode} ${platformClass}`}>
      <section className="card-block splash-hero">
        <p className="splash-kicker">Weekly Courtroom Arena</p>
        <h1>Court of Capital</h1>
        <p className="splash-lead">Build market pressure, sway the judge, and close the week at the top of the board.</p>
        <div className="status-row splash-metrics">
          <span className="badge">Week {weekId}</span>
          <span className="badge">Turn 35s</span>
          <span className="badge">Mulligan 10s</span>
          <span className="badge">Deck 100</span>
        </div>
        <div className="splash-actions">
          <button className="action-btn action-btn--primary splash-enter" onClick={(e) => requestExpandedMode(e.nativeEvent, "game")}>
            Enter Court
          </button>
          <p className="subtle">Operator: u/{context.username ?? "guest"}</p>
        </div>
      </section>

      <section className="splash-columns">
        <article className="card-block splash-note">
          <h2>Match Rhythm</h2>
          <ul className="simple-list splash-list">
            <li>Deploy to front/back lanes and control the 5x5 court.</li>
            <li>Drag your unit to attack enemy, events, or leader.</li>
            <li>Judge lane creates high-risk, high-reward plays.</li>
          </ul>
        </article>
        <article className="card-block splash-note">
          <h2>Win Path</h2>
          <ul className="simple-list splash-list">
            <li>Break enemy leader HP to secure the verdict.</li>
            <li>Manage shares, debt, and dirty-play penalties.</li>
            <li>Climb weekly leaderboard with your best faction.</li>
          </ul>
        </article>
      </section>
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
