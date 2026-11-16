/* Access tab for users.html — loaded after users.html's main script (uses its $, gw, status, escapeHtml, AuditLog). */
(function () {
  const esc = escapeHtml, clone = o => JSON.parse(JSON.stringify(o)), spin = `<span class="spinner"></span>`;
  let cfg = null, orig = null, meta = null, sub = "roles", hist = null;

  document.head.insertAdjacentHTML("beforeend", `<style>
.ax-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.ax-subs{display:flex;gap:4px;flex-wrap:wrap;margin-right:auto}
.ax-subs button{background:rgba(255,255,255,.06);border:1px solid var(--glass-border);color:var(--foam-dim);border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer}
.ax-subs button.on{color:var(--foam);border-color:var(--foam)}
.ax-dirty{display:none;font-size:12px;color:#ffb347}.ax-dirty.on{display:inline}
.ax-in{background:rgba(255,255,255,.06);border:1px solid var(--glass-border);border-radius:6px;color:var(--foam);font-size:12px;padding:5px 8px;width:100%;box-sizing:border-box}
.ax-cell{white-space:nowrap}.ax-cell label{display:inline-flex;align-items:center;gap:2px;margin-right:6px;font-size:11px;font-family:var(--font-data)}
.ax-ic{background:none;border:1px solid var(--glass-border);color:var(--foam);border-radius:6px;cursor:pointer;padding:1px 7px}
.ax-ic:disabled{opacity:.3;cursor:default}
.ax-add{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}.ax-add .ax-in{width:auto;min-width:140px}
.ax-diff{font-family:var(--font-data);font-size:11.5px;max-height:320px;overflow:auto;background:rgba(0,0,0,.25);border:1px solid var(--glass-border);border-radius:8px;padding:10px;white-space:pre-wrap;color:var(--foam)}
.ax-sec{margin:14px 0 6px;font-family:var(--font-data);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--foam-dim)}
.ax-sec+div .badge{margin:0 4px 4px 0}
</style>`);

  $("tabAccess").innerHTML = `
<div class="ax-bar">
  <div class="ax-subs" id="axSubs">
    <button data-sub="roles" class="on">Roles</button><button data-sub="perms">Permissions</button><button data-sub="rules">Sheet rules</button>
    <button data-sub="settings">Settings</button><button data-sub="locked">Locked rules</button><button data-sub="history">History</button>
  </div>
  <span class="ax-dirty" id="axDirty">● Unsaved changes</span>
  <button class="btn btn-ghost" id="axDiscard" style="padding:5px 12px;font-size:11px;">Discard</button>
  <button class="btn btn-primary" id="axReview" style="padding:5px 14px;font-size:12px;">Review &amp; Save</button>
</div>
<div class="hint" id="axBanner" style="margin-bottom:10px;"></div>
<div id="axBody"></div>`;

  document.body.insertAdjacentHTML("beforeend", `
<div class="modal-overlay" id="axModal"><div class="modal" style="max-width:640px">
  <div class="modal-header"><h3>Review access changes</h3><button class="modal-close" id="axModalClose" title="Close">✕</button></div>
  <div class="ax-diff" id="axDiff"></div>
  <div class="modal-footer"><span class="modal-status" id="axStatus"></span>
    <button class="btn btn-ghost" id="axCancel">Cancel</button><button class="btn btn-primary" id="axSave">Save</button></div>
</div></div>`);

  const body = $("axBody");
  const isDirty = () => JSON.stringify(cfg) !== JSON.stringify(orig);
  const dirtyBar = () => $("axDirty").classList.toggle("on", isDirty());
  const err = e => `<div style="color:#ff6b6b;padding:12px;">Error: ${esc(e.message)}</div>`;
  const badges = a => a.map(x => `<span class="badge badge-default">${esc(x)}</span>`).join("");
  const renum = () => {                       // order = rank; admin is always last
    const ad = cfg.roles.find(r => r.role === "admin"), a = cfg.roles.filter(r => r.role !== "admin");
    cfg.roles = ad ? a.concat(ad) : a; cfg.roles.forEach((r, i) => r.rank = i + 1);
  };
  const roleSel = (f, i, v) => `<select class="glass-select" data-rf="${f}" data-i="${i}"><option value="">— none —</option>` +
    cfg.roles.map(r => `<option value="${esc(r.role)}" ${r.role === v ? "selected" : ""}>${esc(r.label)}</option>`).join("") + `</select>`;

  /* ---------- load ---------- */
  async function load(fresh) {
    body.innerHTML = spin;
    try {
      meta = await gw({ action: "getAccessConfig", fresh: !!fresh });
      cfg = clone(meta.config); orig = clone(meta.config); hist = null; renderAll();
    } catch (e) { body.innerHTML = err(e); }
  }

  /* ---------- renderers ---------- */
  function rRoles() {
    const n = meta.userCounts || {}, last = cfg.roles.length - 2;
    return `<table class="users-table"><thead><tr><th>Order</th><th>Key</th><th>Label</th><th>Users</th><th>Active</th><th></th></tr></thead><tbody>` +
      cfg.roles.map((r, i) => {
        const adm = r.role === "admin", c = n[r.role] || 0;
        return `<tr><td>${adm ? "" : `<button class="ax-ic" data-act="up" data-i="${i}" ${i === 0 ? "disabled" : ""}>↑</button> <button class="ax-ic" data-act="dn" data-i="${i}" ${i >= last ? "disabled" : ""}>↓</button>`}</td>
          <td><code>${esc(r.role)}</code> <span class="hint">rank ${r.rank}</span></td>
          <td><input class="ax-in" data-f="label" data-i="${i}" value="${esc(r.label)}"></td><td>${c}</td>
          <td><input type="checkbox" data-f="active" data-i="${i}" ${r.active ? "checked" : ""} ${adm ? "disabled" : ""}></td>
          <td>${adm ? `<span class="hint">locked</span>` : `<button class="btn btn-ghost" style="padding:3px 10px;font-size:11px;" data-act="del" data-i="${i}" ${c ? `disabled title="${c} user(s) assigned"` : ""}>Delete</button>`}</td></tr>`;
      }).join("") + `</tbody></table>
      <div class="ax-add"><input class="ax-in" id="axNewKey" placeholder="key (e.g. treasurer)"><input class="ax-in" id="axNewLabel" placeholder="Label">
        <button class="btn btn-primary" style="padding:5px 14px;font-size:12px;" data-act="addrole">Add role</button></div>
      <p class="hint">Order sets rank (higher = more senior; used by sheet rules and the Level badge). The key is permanent because sessions carry it; the label can be renamed. Admin is always last and cannot be disabled or deleted. Disabling a role blocks everyone assigned to it.</p>`;
  }

  function cell(r, d) {
    const adm = r.role === "admin", have = adm ? "rwd" : ((cfg.perms[r.role] || {})[d] || "");
    return `<td class="ax-cell">` + ["r", "w", "d"].map(c => `<label><input type="checkbox" data-p="${esc(r.role)}|${d}|${c}" ${have.includes(c) ? "checked" : ""} ${adm || (d === "audit" && c !== "r") ? "disabled" : ""}>${c}</label>`).join("") + `</td>`;
  }
  function rPerms() {
    return `<div class="users-table-wrap"><table class="users-table"><thead><tr><th>Domain</th>` +
      cfg.roles.map(r => `<th>${esc(r.label)}${r.active ? "" : " (off)"}</th>`).join("") + `</tr></thead><tbody>` +
      Object.keys(meta.domains).sort().map(d => `<tr><td><strong>${esc(d)}</strong></td>${cfg.roles.map(r => cell(r, d)).join("")}</tr>`).join("") +
      `</tbody></table></div><p class="hint">r = read, w = write, d = delete. Write and delete imply read. Admin always has full access. The audit domain is read-only for other roles. New domains appear here automatically once they are in the registry.</p>`;
  }

  function rRules() {
    const doms = Object.keys(meta.domains).sort();
    return `<table class="users-table"><thead><tr><th>Domain | Sheet</th><th>Deny all (except admin)</th><th>Read min role</th><th>Write / delete min role</th><th></th></tr></thead><tbody>` +
      (cfg.rules.length ? cfg.rules.map((x, i) => `<tr><td><code>${esc(x.key)}</code></td>
        <td><input type="checkbox" data-rf="deny" data-i="${i}" ${x.deny ? "checked" : ""}></td><td>${roleSel("readMin", i, x.readMin)}</td><td>${roleSel("writeMin", i, x.writeMin)}</td>
        <td><button class="btn btn-ghost" style="padding:3px 10px;font-size:11px;" data-act="delrule" data-i="${i}">Remove</button></td></tr>`).join("")
        : `<tr><td colspan="5" class="hint">No sheet rules.</td></tr>`) + `</tbody></table>
      <div class="ax-add"><select class="glass-select" id="axRD">${doms.map(d => `<option>${esc(d)}</option>`).join("")}</select>
        <select class="glass-select" id="axRS">${(meta.domains[doms[0]] || []).map(s => `<option>${esc(s)}</option>`).join("")}</select>
        <button class="btn btn-primary" style="padding:5px 14px;font-size:12px;" data-act="addrule">Add rule</button></div>
      <p class="hint">Rules apply on top of the permission matrix. A min role means that role or any higher-ranked role. Sheets that can never be accessed are listed under Locked rules.</p>`;
  }

  function rSettings() {
    const s = cfg.settings, U = meta.loginUniverse;
    return `<div class="form-row full"><div class="form-group" style="max-width:220px;"><label>Session length (minutes)</label>
        <input type="number" min="5" max="1440" data-s="ttl" value="${s.tokenTtlMin}" style="background:rgba(255,255,255,.06);border:1px solid var(--glass-border);border-radius:8px;color:var(--foam);padding:8px 12px;">
        <span class="hint">5–1440. Applies to sessions started after saving.</span></div></div>
      <div class="form-group" style="margin-top:12px;"><label>Assignable login types</label>
        <div class="chk-row">${U.map(t => `<label><input type="checkbox" data-s="lt" value="${t}" ${s.loginTypes.includes(t) ? "checked" : ""}> ${esc(t)}</label>`).join("")}</div>
        <span class="hint">Controls which types can be given to users. Existing users keep theirs.</span></div>
      <div class="ax-sec">Default login type by email domain (* = everything else)</div>
      <table class="users-table"><tbody>${s.defaultLogin.map((x, j) => `<tr><td style="width:200px;"><input class="ax-in" data-dd="${j}" value="${esc(x.domain)}" ${x.domain === "*" ? "disabled" : ""} placeholder="example.com"></td>
        <td class="ax-cell">${U.map(t => `<label><input type="checkbox" data-dl="${j}|${t}" ${x.types.includes(t) ? "checked" : ""}> ${esc(t)}</label>`).join("")}</td>
        <td>${x.domain === "*" ? "" : `<button class="btn btn-ghost" style="padding:3px 10px;font-size:11px;" data-act="deldl" data-i="${j}">Remove</button>`}</td></tr>`).join("")}</tbody></table>
      <div class="ax-add"><button class="btn btn-ghost" style="padding:5px 12px;font-size:11px;" data-act="adddl">+ Add domain</button></div>`;
  }

  function rLocked() {
    const L = meta.locked;
    return `<p class="hint">These follow the Gateway's logic and are defined in Auth.js. Shown for reference; not editable here.</p>
      <div class="ax-sec">Public actions (no sign-in)</div><div>${badges(L.publicActions)}</div>
      <div class="ax-sec">Admin-only actions</div><div>${badges(L.adminOnly)}</div>
      <div class="ax-sec">Any signed-in role</div><div>${badges(L.anyRole)}</div>
      <div class="ax-sec">Action → permission code needed</div><div>${badges(Object.entries(L.actionCode).map(([a, c]) => a + " → " + c))}</div>
      <div class="ax-sec">Sheets nobody can access (not even admin)</div><div>${badges(L.denySheets)}</div>
      <div class="ax-sec">Other fixed rules</div><div>${badges(["Admin always has rwd on every domain", "Admin role cannot be disabled or deleted", "audit domain read-only for other roles", "TOKEN_SECRET stays in Script Properties", "Password hashing rounds stay in code"])}</div>`;
  }

  async function rHistory() {
    body.innerHTML = spin;
    try { if (!hist) hist = (await gw({ action: "listAccessHistory" })).values || []; } catch (e) { body.innerHTML = err(e); return; }
    if (sub !== "history") return;
    body.innerHTML = `<div class="ax-add" style="margin:0 0 10px;"><button class="btn btn-ghost" style="padding:5px 12px;font-size:11px;" data-act="loaddef">Load built-in defaults</button>
      <button class="btn btn-ghost" style="padding:5px 12px;font-size:11px;" data-act="reload">Reload from sheets</button></div>
      <div class="users-table-wrap"><table class="users-table"><thead><tr><th>Ver</th><th>When</th><th>By</th><th>Summary</th><th></th></tr></thead><tbody>` +
      (hist.length ? hist.map(h => `<tr><td>v${esc(h.Version)}</td><td style="white-space:nowrap;">${esc(fmtDT(h.Timestamp))}</td><td>${esc(h.User)}</td>
        <td style="font-size:11px;max-width:380px;word-break:break-word;">${esc(h.Summary)}</td>
        <td><button class="btn btn-ghost" style="padding:3px 10px;font-size:11px;" data-act="loadver" data-v="${esc(h.Version)}">Load into editor</button></td></tr>`).join("")
        : `<tr><td colspan="5" class="hint">No saved versions yet.</td></tr>`) + `</tbody></table></div>
      <p class="hint">Loading a version only fills the editor — review and save it like any other change.</p>`;
  }

  function renderAll() {
    $("axBanner").textContent = meta.source === "defaults"
      ? "Using built-in defaults — the config sheets don't exist yet. Review & Save creates them from what you see here."
      : `Config v${meta.version}, loaded from the config sheets. Saved changes apply immediately to every request.`;
    document.querySelectorAll("#axSubs button").forEach(b => b.classList.toggle("on", b.dataset.sub === sub));
    if (sub === "history") rHistory();
    else body.innerHTML = { roles: rRoles, perms: rPerms, rules: rRules, settings: rSettings, locked: rLocked }[sub]();
    dirtyBar();
  }

  /* ---------- events ---------- */
  $("axSubs").addEventListener("click", e => { const b = e.target.closest("button[data-sub]"); if (b && cfg) { sub = b.dataset.sub; renderAll(); } });

  body.addEventListener("change", e => {
    const t = e.target, i = Number(t.dataset.i);
    if (t.dataset.f) cfg.roles[i][t.dataset.f] = t.dataset.f === "active" ? t.checked : t.value.trim();
    else if (t.dataset.p) {
      const [role, d, c] = t.dataset.p.split("|"), s = new Set((cfg.perms[role] || {})[d] || "");
      if (t.checked) { s.add(c); if (c !== "r") s.add("r"); } else { s.delete(c); if (c === "r") s.clear(); }
      const v = ["r", "w", "d"].filter(x => s.has(x)).join("");
      cfg.perms[role] = cfg.perms[role] || {}; if (v) cfg.perms[role][d] = v; else delete cfg.perms[role][d];
      ["r", "w", "d"].forEach(x => { const el = body.querySelector(`[data-p="${role}|${d}|${x}"]`); if (el) el.checked = v.includes(x); });
    }
    else if (t.dataset.rf) cfg.rules[i][t.dataset.rf] = t.dataset.rf === "deny" ? t.checked : t.value;
    else if (t.dataset.s === "ttl") { cfg.settings.tokenTtlMin = Math.max(5, Math.min(1440, Number(t.value) || 60)); t.value = cfg.settings.tokenTtlMin; }
    else if (t.dataset.s === "lt") cfg.settings.loginTypes = [...body.querySelectorAll('[data-s="lt"]:checked')].map(x => x.value);
    else if (t.dataset.dl) { const [j, ty] = t.dataset.dl.split("|"), a = cfg.settings.defaultLogin[j].types; t.checked ? a.includes(ty) || a.push(ty) : a.splice(a.indexOf(ty), 1); }
    else if (t.dataset.dd) cfg.settings.defaultLogin[Number(t.dataset.dd)].domain = t.value.trim().toLowerCase().replace(/^@/, "");
    else if (t.id === "axRD") $("axRS").innerHTML = (meta.domains[t.value] || []).map(s => `<option>${esc(s)}</option>`).join("");
    dirtyBar();
  });

  body.addEventListener("click", async e => {
    const b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
    const i = Number(b.dataset.i), act = b.dataset.act;
    try {
      if (act === "up" || act === "dn") { const j = act === "up" ? i - 1 : i + 1; [cfg.roles[i], cfg.roles[j]] = [cfg.roles[j], cfg.roles[i]]; renum(); }
      else if (act === "del") {
        const k = cfg.roles[i].role; if (!confirm(`Delete role "${k}"?`)) return;
        cfg.roles.splice(i, 1); delete cfg.perms[k]; renum();
        cfg.rules.forEach(x => { if (x.readMin === k) x.readMin = ""; if (x.writeMin === k) x.writeMin = ""; });
      }
      else if (act === "addrole") {
        const k = $("axNewKey").value.trim().toLowerCase(), l = $("axNewLabel").value.trim();
        if (!/^[a-z][a-z0-9_]{1,19}$/.test(k)) return alert("Key: a–z, 0–9 and _, 2–20 characters, starting with a letter.");
        if (!l) return alert("Enter a label.");
        if (cfg.roles.some(r => r.role === k)) return alert("That role already exists.");
        cfg.roles.splice(cfg.roles.length - 1, 0, { role: k, label: l, rank: 0, active: true }); cfg.perms[k] = {}; renum();
      }
      else if (act === "addrule") {
        const key = $("axRD").value + "|" + $("axRS").value;
        if (cfg.rules.some(x => x.key === key)) return alert("A rule for that sheet already exists.");
        cfg.rules.push({ key, deny: false, readMin: "", writeMin: "" });
      }
      else if (act === "delrule") cfg.rules.splice(i, 1);
      else if (act === "adddl") cfg.settings.defaultLogin.splice(cfg.settings.defaultLogin.length - 1, 0, { domain: "", types: [] });
      else if (act === "deldl") cfg.settings.defaultLogin.splice(i, 1);
      else if (act === "reload") { if (!isDirty() || confirm("Discard unsaved changes?")) return load(true); return; }
      else if (act === "loaddef" || act === "loadver") {
        if (isDirty() && !confirm("Replace your unsaved changes?")) return;
        cfg = clone((await gw({ action: "getAccessVersion", version: act === "loaddef" ? "defaults" : b.dataset.v })).config);
        sub = "roles";
      }
      renderAll();
    } catch (ex) { alert(ex.message); }
  });

  $("axDiscard").addEventListener("click", () => { if (cfg && isDirty() && confirm("Discard unsaved changes?")) { cfg = clone(orig); renderAll(); } });

  /* ---------- review & save ---------- */
  async function review() {
    if (!cfg) return;
    $("axStatus").className = "modal-status"; $("axSave").disabled = true;
    $("axDiff").innerHTML = spin; $("axModal").classList.add("open");
    try {
      const d = (await gw({ action: "previewAccessConfig", config: cfg })).diff || [];
      $("axDiff").textContent = d.length ? d.join("\n") : "No changes to save.";
      $("axSave").disabled = !d.length;
    } catch (e) { $("axDiff").innerHTML = err(e); }
  }
  async function save() {
    const btn = $("axSave"); btn.disabled = true; btn.innerHTML = spin;
    try {
      const r = await gw({ action: "saveAccessConfig", config: cfg });
      status("axStatus", `Saved as v${r.version}.`, "success");
      localStorage.removeItem("SMMC_ROLES_AT");                 // let shared.js re-read role ranks
      await load(true); AuditLog.load();
      setTimeout(() => $("axModal").classList.remove("open"), 700);
    } catch (e) { status("axStatus", "Error: " + e.message, "error"); btn.disabled = false; }
    finally { btn.textContent = "Save"; }
  }
  $("axReview").addEventListener("click", review);
  $("axSave").addEventListener("click", save);
  ["axModalClose", "axCancel"].forEach(id => $(id).addEventListener("click", () => $("axModal").classList.remove("open")));
  $("axModal").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove("open"); });

  window.Access = { open: () => { if (!cfg) load(); } };
})();