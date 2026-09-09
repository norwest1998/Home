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

  let raceRows = null; // cached after first load

  function num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).map(p => p[0]).join("").slice(0, 2).toUpperCase();
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

  function computeWinRateRank(name, minRaces) {
    const byMember = {};
    raceRows.forEach(r => {
      const n = r.MemberName.trim();
      const p = num(r.RacePos);
      if (p === null) return;
      (byMember[n] = byMember[n] || []).push(p);
    });

    const ranked = Object.entries(byMember)
      .map(([n, positions]) => ({
        name: n,
        races: positions.length,
        winRate: positions.filter(p => p === 1).length / positions.length
      }))
      .filter(m => m.races >= minRaces)
      .sort((a, b) => b.winRate - a.winRate);

    const idx = ranked.findIndex(m => m.name === name);
    if (idx === -1) return null; // not qualified (didn't meet minRaces)
    return { rank: idx + 1, of: ranked.length };
  }

  function renderMember(drawer, name) {
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
    const winRateRank = computeWinRateRank(name, 5);

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

        <div class="mrs-stat-grid">
          <div class="mrs-stat"><div class="n accent">${races ? Math.round(wins / races * 100) + "%" : "—"}</div><div class="l">Win Rate</div>
            ${winRateRank ? `<div class="l" style="margin-top:2px;color:var(--glow);">Rank #${winRateRank.rank} of ${winRateRank.of}</div>` : ""}
          </div>
          <div class="mrs-stat"><div class="n">${races ? Math.round(podiums / races * 100) + "%" : "—"}</div><div class="l">Top-3 Rate</div></div>
          <div class="mrs-stat"><div class="n">${avgPlacing !== null ? avgPlacing.toFixed(1) : "—"}</div><div class="l">Avg Placing</div></div>
          <div class="mrs-stat"><div class="n">${consistency !== null ? consistency.toFixed(2) : "—"}</div><div class="l">Consistency</div></div>
          <div class="mrs-stat"><div class="n">${best !== null ? "#" + best : "—"}</div><div class="l">Best Finish</div></div>
          <div class="mrs-stat"><div class="n warn">${worst !== null ? "#" + worst : "—"}</div><div class="l">Worst Finish</div></div>
        </div>

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