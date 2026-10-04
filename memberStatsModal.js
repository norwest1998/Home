/**
 * Member Race Stats — Modal Portal
 * -----------------------------------------------------------------
 * Uses the site's existing theme.css classes (.drawer-overlay, .drawer,
 * .detail-item, .badge, .btn, etc.) so it matches the rest of the site.
 * theme.css MUST already be linked on the page before this runs.
 *
 * Include this file on any page, then call:
 *     showMemberStats("Peter Burton");
 *
 * Setup: set CSV_URL below to your published Google Sheet CSV link.
 */
(function () {
  const CSV_URL = "https://docs.google.com/spreadsheets/d/1UBF3UMzvRsQydwVMsQSl6GOMD00ALjlLmLwf6WPpYk4/export?format=csv&gid=0";
  const RACE_TYPE_COL = "RaceType";

  let raceRows = null; // cached after first load
  let currentMemberName = null;

  function num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).map(p => p[0]).join("").slice(0, 2).toUpperCase();
  }

  function raceKind(r) {
    const t = (r[RACE_TYPE_COL] || "").toLowerCase();
    return t.includes("scratch") ? "scratch" : t.includes("hand") ? "handicap" : null;
  }

  function winRatePct(rs) {
    const p = rs.map(r => num(r.RacePos)).filter(v => v !== null);
    return p.length ? Math.round(p.filter(x => x === 1).length / p.length * 100) + "%" : "—";
  }

  // Small additions theme.css doesn't already define: a 3-col stat grid
  // and simple dotted list rows, built from the same design tokens.
  function injectExtraStyles() {
    if (document.getElementById("mrs-extra-styles")) return;
    const style = document.createElement("style");
    style.id = "mrs-extra-styles";
    style.textContent = `
      .mrs-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
      .mrs-stat{background:var(--glass-fill);border:1px solid var(--glass-border);
        border-radius:10px;padding:10px 6px;text-align:center;}
      .mrs-stat .n{font-family:var(--font-display);font-size:19px;color:var(--foam);line-height:1;}
      .mrs-stat .n.accent{color:var(--glow);}
      .mrs-stat .n.warn{color:var(--signal);}
      .mrs-stat .l{margin-top:4px;font-family:var(--font-data);font-size:9px;
        letter-spacing:0.06em;text-transform:uppercase;color:var(--foam-dim);}
      .mrs-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;
        border-bottom:1px dotted var(--glass-border);font-size:13px;color:var(--foam);}
      .mrs-row:last-child{border-bottom:none;}
      .mrs-row .v{color:var(--glow);white-space:nowrap;}
    `;
    document.head.appendChild(style);
  }

  function closeModal() {
    const overlay = document.getElementById("mrs-overlay");
    if (overlay) overlay.remove();
    document.removeEventListener("keydown", onEsc);
  }

  function onEsc(e) {
    if (e.key === "Escape") closeModal();
  }

  function renderShell() {
    injectExtraStyles();
    const overlay = document.createElement("div");
    overlay.className = "drawer-overlay open";
    overlay.id = "mrs-overlay";
    overlay.innerHTML = `<div class="drawer" id="mrs-drawer"></div>`;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onEsc);
    return document.getElementById("mrs-drawer");
  }

  function renderEmpty(drawer, message) {
    drawer.innerHTML = `
      <div class="drawer-header">
        <h4>Member Stats</h4>
        <button class="drawer-close" id="mrs-x">✕</button>
      </div>
      <div class="empty-state">${message}</div>
    `;
    document.getElementById("mrs-x").addEventListener("click", closeModal);
  }

  function buildWinRateLeaderboard(minRaces, kind) {
    const byMember = {};
    raceRows.forEach(r => {
      if (kind && raceKind(r) !== kind) return;
      const n = r.MemberName.trim();
      const p = num(r.RacePos);
      if (p === null) return;
      (byMember[n] = byMember[n] || []).push(p);
    });

    return Object.entries(byMember)
      .map(([n, positions]) => ({
        name: n,
        races: positions.length,
        wins: positions.filter(p => p === 1).length,
        winRate: positions.filter(p => p === 1).length / positions.length
      }))
      .filter(m => m.races >= minRaces)
      .sort((a, b) => b.winRate - a.winRate);
  }

  function computeWinRateRank(name, minRaces, kind) {
    const ranked = buildWinRateLeaderboard(minRaces, kind);
    const idx = ranked.findIndex(m => m.name === name);
    if (idx === -1) return null; // not qualified (didn't meet minRaces)
    return { rank: idx + 1, of: ranked.length };
  }

  function showWinRateLeaderboard(kind) {
    const minRaces = 5;
    const label = { scratch: "Scratch", handicap: "Handicap" }[kind] || "Both";
    const ranked = buildWinRateLeaderboard(minRaces).slice(0, 10);

    const rowsHtml = ranked.map((m, i) => {
      const isCurrent = m.name === currentMemberName;
      return `<div class="mrs-row"${isCurrent ? ' style="color:var(--glow);font-weight:600;"' : ""}>
        <span>#${i + 1} ${m.name}</span>
        <span class="v">${Math.round(m.winRate * 100)}% · ${m.wins}/${m.races}</span>
      </div>`;
    }).join("") || `<div class="mrs-row"><span>No qualifying sailors yet</span></div>`;

    injectExtraStyles();
    const overlay = document.createElement("div");
    overlay.className = "drawer-overlay open";
    overlay.id = "mrs-leaderboard-overlay";
    overlay.innerHTML = `
      <div class="drawer">
        <div class="drawer-header">
          <h4>Top 10 · Win Rate (${label})</h4>
          <button class="drawer-close" id="mrs-lb-x">✕</button>
        </div>
        <div class="drawer-body">
          <div class="detail-item full-width">
            <div class="detail-label">Minimum ${minRaces} races to qualify</div>
            ${rowsHtml}
          </div>
          <button class="btn btn-primary" id="mrs-lb-ok" style="width:100%;justify-content:center;">Close</button>
        </div>
      </div>
    `;
    const closeLb = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeLb(); });
    document.body.appendChild(overlay);
    document.getElementById("mrs-lb-x").addEventListener("click", closeLb);
    document.getElementById("mrs-lb-ok").addEventListener("click", closeLb);
  }
  window.showWinRateLeaderboard = showWinRateLeaderboard;

  function renderMember(drawer, name) {
    currentMemberName = name;
    const rows = raceRows.filter(r => r.MemberName.trim() === name);

    const positions = rows.map(r => num(r.RacePos)).filter(v => v !== null);
    const races = positions.length;
    const wins = positions.filter(p => p === 1).length;
    const podiums = positions.filter(p => p <= 3).length;
    const best = races ? Math.min(...positions) : null;
    const worst = races ? Math.max(...positions) : null;
    const avgPlacing = races ? positions.reduce((a, b) => a + b, 0) / races : null;

    const consistVals = rows.map(r => num(r.ConsistencyIndex)).filter(v => v !== null);
    const consistency = consistVals.length ? consistVals.reduce((a, b) => a + b, 0) / consistVals.length : null;

    const regattas = [...new Set(rows.map(r => r.RegattaName).filter(Boolean))];
    const rk = k => computeWinRateRank(name, 5, k);
    const rankTile = k => { const r = rk(k); return r ? `<div class="l" style="margin-top:2px;color:var(--glow);">Rank #${r.rank} of ${r.of}</div>` : ""; };
    const wrScratch = winRatePct(rows.filter(r => raceKind(r) === "scratch"));
    const wrHcp     = winRatePct(rows.filter(r => raceKind(r) === "handicap"));
    const wrBoth    = winRatePct(rows);

    const sortedByPos = rows.filter(r => num(r.RacePos) !== null)
      .sort((a, b) => num(a.RacePos) - num(b.RacePos))
      .slice(0, 5);
    const bestHtml = sortedByPos.map(r =>
      `<div class="mrs-row"><span>${r.RegattaName || "—"}${r.Class ? " (" + r.Class + ")" : ""} · Race ${r.RaceNo || "—"}</span><span class="v">#${r.RacePos}</span></div>`
    ).join("") || `<div class="mrs-row"><span>No results</span></div>`;

    const byRegatta = {};
    rows.forEach(r => {
      const key = `${r.RegattaName || "Unknown"}|${r.Class || ""}`;
      const p = num(r.RacePos);
      if (p !== null) (byRegatta[key] = byRegatta[key] || []).push(p);
    });
    const regattaHtml = Object.entries(byRegatta).map(([key, pos]) => {
      const [reg, cls] = key.split("|");
      const avg = (pos.reduce((a, b) => a + b, 0) / pos.length).toFixed(1);
      return `<div class="mrs-row"><span>${reg}${cls ? " (" + cls + ")" : ""}</span><span class="v">${pos.length} races · avg #${avg}</span></div>`;
    }).join("") || `<div class="mrs-row"><span>No regattas</span></div>`;

    drawer.innerHTML = `
      <div class="drawer-header">
        <h4>Race Stats</h4>
        <button class="drawer-close" id="mrs-x">✕</button>
      </div>
      <div class="drawer-body">
        <div class="drawer-name-row">
          <div class="drawer-avatar">${initials(name)}</div>
          <div class="drawer-name-col">
            <div class="drawer-name">${name}</div>
            <span class="badge badge-default">${races} races · ${regattas.length} regatta${regattas.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div class="mrs-stat-grid" style="margin-bottom:8px;">
          <div class="mrs-stat" onclick="showWinRateLeaderboard('scratch')" style="cursor:pointer;" title="See top 10">
            <div class="n accent">${wrScratch}</div><div class="l">Win % Scratch</div>${rankTile("scratch")}
          </div>
          <div class="mrs-stat" onclick="showWinRateLeaderboard('handicap')" style="cursor:pointer;" title="See top 10">
            <div class="n accent">${wrHcp}</div><div class="l">Win % Handicap</div>${rankTile("handicap")}
          </div>
          <div class="mrs-stat" onclick="showWinRateLeaderboard()" style="cursor:pointer;" title="See top 10">
            <div class="n accent">${wrBoth}</div><div class="l">Win % Both</div>${rankTile()}
          </div>
        </div>
        <div class="mrs-stat"><div class="n">${races}</div><div class="l">Races</div></div>

        <div class="detail-item full-width">
          <div class="detail-label">Best Results</div>
          ${bestHtml}
        </div>

        <div class="detail-item full-width">
          <div class="detail-label">By Regatta</div>
          ${regattaHtml}
        </div>

        <button class="btn btn-primary" id="mrs-ok" style="width:100%;justify-content:center;">Close</button>
      </div>
    `;
    document.getElementById("mrs-x").addEventListener("click", closeModal);
    document.getElementById("mrs-ok").addEventListener("click", closeModal);
  }

  function withData(callback) {
    if (raceRows) return callback();
    if (!CSV_URL || CSV_URL.indexOf("PASTE_") === 0) {
      callback(new Error("CSV_URL not configured in memberStatsModal.js"));
      return;
    }
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        raceRows = results.data.filter(r => r.MemberName && r.MemberName.trim());
        callback();
      },
      error: function () {
        callback(new Error("Could not load sheet — check CSV_URL and sharing settings."));
      }
    });
  }

  window.showMemberStats = function (memberName) {
    const drawer = renderShell();
    drawer.innerHTML = `<div class="empty-state">Loading…</div>`;
    withData((err) => {
      if (err) {
        renderEmpty(drawer, err.message);
        return;
      }
      const members = [...new Set(raceRows.map(r => r.MemberName.trim()))];
      const match = members.find(m => m.toLowerCase() === memberName.trim().toLowerCase());
      if (!match) {
        renderEmpty(drawer, `No race data found for "${memberName}".`);
        console.warn("[memberStatsModal] Available names:", members);
        return;
      }
      renderMember(drawer, match);
    });
  };
})();