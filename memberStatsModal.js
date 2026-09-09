/**
 * Member Race Stats — Modal Portal
 * -----------------------------------------------------------------
 * Include this file on any page, then call:
 *     showMemberStats("Peter Burton");
 * It fetches the race archive CSV, finds the member, and shows an
 * in-page modal overlay with their stats. No popup window needed.
 *
 * Setup: set CSV_URL below to your published Google Sheet CSV link.
 */
(function () {
  const CSV_URL = "PASTE_PUBLISHED_CSV_URL_HERE";

  let raceRows = null; // cached after first load

  function num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function injectStyles() {
    if (document.getElementById("mrs-styles")) return;
    const style = document.createElement("style");
    style.id = "mrs-styles";
    style.textContent = `
      .mrs-overlay{position:fixed;inset:0;background:rgba(13,27,42,0.55);display:flex;
        align-items:center;justify-content:center;z-index:9999;font-family:Georgia,'Times New Roman',serif;}
      .mrs-modal{background:#fff;width:400px;max-width:92vw;max-height:88vh;overflow-y:auto;
        border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,0.3);}
      .mrs-head{background:#0d1b2a;color:#f4f9f9;padding:16px 18px;position:relative;}
      .mrs-head h1{margin:0;font-size:20px;font-weight:400;}
      .mrs-head .mrs-sub{font-size:12px;color:#a9c4d4;margin-top:3px;}
      .mrs-x{position:absolute;top:12px;right:14px;background:none;border:none;color:#a9c4d4;
        font-size:18px;cursor:pointer;line-height:1;}
      .mrs-x:hover{color:#fff;}
      .mrs-grid{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #d8e2e2;}
      .mrs-stat{padding:12px 6px;text-align:center;border-right:1px solid #d8e2e2;border-bottom:1px solid #d8e2e2;}
      .mrs-stat:nth-child(3n){border-right:none;}
      .mrs-stat .n{font-size:20px;color:#1b4965;line-height:1;}
      .mrs-stat .n.accent{color:#c9922a;}
      .mrs-stat .n.warn{color:#a4303f;}
      .mrs-stat .l{margin-top:4px;font-size:9.5px;color:#5c6b73;font-family:Arial,sans-serif;}
      .mrs-section{padding:12px 18px 16px;border-top:1px solid #d8e2e2;}
      .mrs-section h2{font-size:11px;font-family:Arial,sans-serif;color:#5c6b73;margin:0 0 8px;font-weight:normal;}
      .mrs-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dotted #d8e2e2;font-size:12.5px;}
      .mrs-row:last-child{border-bottom:none;}
      .mrs-row .v{color:#1b4965;}
      .mrs-empty{padding:40px 24px;text-align:center;color:#5c6b73;font-size:13px;}
      .mrs-close-row{padding:14px 18px;text-align:center;border-top:1px solid #d8e2e2;}
      .mrs-close-row button{font-family:Arial,sans-serif;font-size:13px;padding:8px 22px;
        border:1px solid #1b4965;background:#1b4965;color:#fff;border-radius:3px;cursor:pointer;}
      .mrs-close-row button:hover{background:#0d1b2a;}
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
    injectStyles();
    const overlay = document.createElement("div");
    overlay.className = "mrs-overlay";
    overlay.id = "mrs-overlay";
    overlay.innerHTML = `<div class="mrs-modal" id="mrs-modal"><div class="mrs-empty">Loading…</div></div>`;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onEsc);
    return document.getElementById("mrs-modal");
  }

  function renderEmpty(modal, message) {
    modal.innerHTML = `
      <div class="mrs-empty">${message}</div>
      <div class="mrs-close-row"><button id="mrs-ok">OK</button></div>
    `;
    document.getElementById("mrs-ok").addEventListener("click", closeModal);
  }

  function renderMember(modal, name) {
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

    const sortedByPos = rows.filter(r => num(r.RacePos) !== null)
      .sort((a, b) => num(a.RacePos) - num(b.RacePos))
      .slice(0, 5);
    const bestHtml = sortedByPos.map(r =>
      `<div class="mrs-row"><span>${r.RegattaName || "—"} · Race ${r.RaceNo || "—"}</span><span class="v">#${r.RacePos}</span></div>`
    ).join("") || `<div class="mrs-row"><span>No results</span></div>`;

    const byRegatta = {};
    rows.forEach(r => {
      const key = r.RegattaName || "Unknown";
      const p = num(r.RacePos);
      if (p !== null) (byRegatta[key] = byRegatta[key] || []).push(p);
    });
    const regattaHtml = Object.entries(byRegatta).map(([reg, pos]) => {
      const avg = (pos.reduce((a, b) => a + b, 0) / pos.length).toFixed(1);
      return `<div class="mrs-row"><span>${reg}</span><span class="v">${pos.length} races · avg #${avg}</span></div>`;
    }).join("") || `<div class="mrs-row"><span>No regattas</span></div>`;

    modal.innerHTML = `
      <div class="mrs-head">
        <button class="mrs-x" id="mrs-x">✕</button>
        <h1>${name}</h1>
        <div class="mrs-sub">${races} races across ${regattas.length} regatta${regattas.length === 1 ? "" : "s"}</div>
      </div>
      <div class="mrs-grid">
        <div class="mrs-stat"><div class="n accent">${races ? Math.round(wins / races * 100) + "%" : "—"}</div><div class="l">Win Rate</div></div>
        <div class="mrs-stat"><div class="n">${races ? Math.round(podiums / races * 100) + "%" : "—"}</div><div class="l">Top-3 Rate</div></div>
        <div class="mrs-stat"><div class="n">${avgPlacing !== null ? avgPlacing.toFixed(1) : "—"}</div><div class="l">Avg Placing</div></div>
        <div class="mrs-stat"><div class="n">${consistency !== null ? consistency.toFixed(2) : "—"}</div><div class="l">Consistency Index</div></div>
        <div class="mrs-stat"><div class="n">${best !== null ? "#" + best : "—"}</div><div class="l">Best Finish</div></div>
        <div class="mrs-stat"><div class="n warn">${worst !== null ? "#" + worst : "—"}</div><div class="l">Worst Finish</div></div>
        <div class="mrs-stat"><div class="n">${races}</div><div class="l">Races Sailed</div></div>
        <div class="mrs-stat"><div class="n">${regattas.length}</div><div class="l">Regattas</div></div>
        <div class="mrs-stat"><div class="n">${podiums}</div><div class="l">Podium Finishes</div></div>
      </div>
      <div class="mrs-section"><h2>Best Results</h2>${bestHtml}</div>
      <div class="mrs-section"><h2>By Regatta</h2>${regattaHtml}</div>
      <div class="mrs-close-row"><button id="mrs-ok">OK</button></div>
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
    const modal = renderShell();
    withData((err) => {
      if (err) {
        renderEmpty(modal, err.message);
        return;
      }
      const members = [...new Set(raceRows.map(r => r.MemberName.trim()))];
      const match = members.find(m => m.toLowerCase() === memberName.trim().toLowerCase());
      if (!match) {
        renderEmpty(modal, `No race data found for "${memberName}".`);
        console.warn("[memberStatsModal] Available names:", members);
        return;
      }
      renderMember(modal, match);
    });
  };
})();