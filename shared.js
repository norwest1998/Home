// config.js  (or inline in a shared include)
const GATEWAY_URL = "https://script.google.com/macros/s/AKfycbzXQNKK6rbWr7MerjKjQMrF0-LUJzKij0sxTxRGehGAp3GoM7q6GXc0yMMmLVInHSR_/exec";

// domain keys must match REGISTRY keys in Gateway.gs
const DOMAIN = {
    members:   "members",
    documents: "documents",
    calendar:  "calendar",
    apps:      "apps",
    clubs:     "clubs",
    notes:     "notes",
    audit:     "audit",
    tracking:  "tracking",
    results:   "results"   // ← add this
};

async function fetchSheet(domain, sheetName, hexKey = null) {
    const action = hexKey ? "display" : "fetch";
    const url    = `${GATEWAY_URL}?action=${action}&domain=${domain}&sheet=${encodeURIComponent(sheetName)}`
                 + (hexKey ? `&hexKey=${encodeURIComponent(hexKey)}` : "");
    const res  = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
 
    if (data.record) return data.record;                // single-record display
 
    const rows = data.values ?? [];
    if (rows.length > 0) registerSchema(domain, sheetName, rows); // fire-and-forget
    return rows;
}

async function searchSheet(domain, sheetName, filtersArray) {
    const action = "search"
    const url    = `${GATEWAY_URL}?action=${action}&domain=${domain}&sheet=${encodeURIComponent(sheetName)}&filter=${encodeURIComponent(filtersArray)}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
 
    if (data.record) return data.record; // single-record display
 
    const rows = data.values ?? [];
    return rows;
}

async function registerSchema(domain, sheetName, rows) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const columns = Object.keys(rows[0]);
    try {
        await fetch(GATEWAY_URL, {
            method:  "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body:    JSON.stringify({
                action:   "registerSchema",
                domain:   domain,
                sheet:    sheetName,
                columns:  columns,
                rowCount: rows.length
            })
        });
    } catch (e) {
        // Silent — schema registration must never break the calling page
        console.warn("SchemaRegistry update failed:", e);
    }
}

async function updateSheet(domain, sheetName, hexKey, updates) {
    const res  = await fetch(GATEWAY_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body:    JSON.stringify({ action: "update", domain: domain, sheet: sheetName, hexKey: hexKey, update: updates })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return true;
}

async function appendSheet(domain, sheetName, rowData) {
    const res  = await fetch(GATEWAY_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body:    JSON.stringify({ action: "append", domain: domain, sheet: sheetName, rowData: rowData })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return true;
}

async function deleteRow(domain, sheetName, hexKey) {
    const res  = await fetch(GATEWAY_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body:    JSON.stringify({ action: "delete", domain: domain, sheet: sheetName, hexKey: hexKey })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return true;
}

function fmtTime(iso){
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}


/* Fetches sheet layout and displays a formatted drawer modal for JSON rowData
*/
async function viewRecordModal(domain, sheetName, encodedRowData) {
    // 1. Parse the JSON rowData 
    let record;
    try {
        record = JSON.parse(decodeURIComponent(encodedRowData));
    } catch(e) {
        console.error("Could not parse record data:", e);
        alert("Invalid record data format.");
        return;
    }

    // 2. Create the drawer overlay if it doesn't exist
    let overlay = document.getElementById("recordViewerModal");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "recordViewerModal";
        overlay.className = "drawer-overlay";
        overlay.innerHTML = `
            <div class="drawer">
                <div class="drawer-header">
                    <h4 id="rvm-title">Record Details</h4>
                    <button class="drawer-close" onclick="document.getElementById('recordViewerModal').classList.remove('open')">✕</button>
                </div>
                <div class="drawer-body">
                    <div id="rvm-content" class="detail-grid"></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Close on background click
        overlay.addEventListener("click", e => {
            if (e.target === overlay) overlay.classList.remove("open");
        });
    }

    // 3. Set loading state and open drawer
    document.getElementById("rvm-title").textContent = `${sheetName} Record`;
    document.getElementById("rvm-content").innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 20px;">
            <span class="spinner"></span> Loading layout...
        </div>`;
    
    overlay.classList.add("open");

    // 4. Fetch the layout from Gateway
    try {
        //const url = `${GATEWAY_URL}?action=layout&domain=${encodeURIComponent(domain)}&sheetName=${encodeURIComponent(sheetName)}`;
        //const res = await fetch(url);
        //const data = await res.json();
        const data = record;
        if (data.error) throw new Error(data.error);
        
        // Fallback to the object's raw keys if the layout isn't configured in the Gateway yet
        const layoutKeys = data.layout || Object.keys(record);

        // 5. Build the UI grid mapping layout keys to record values
        const html = layoutKeys.map(key => {
            const val = record[key];
            const displayVal = (val !== undefined && val !== null && val !== "") ? val : "—";
            return `
            <div class="detail-item">
                <span class="detail-label">${escapeHtml(key)}</span>
                <span class="detail-value">${escapeHtml(displayVal)}</span>
            </div>`;
        }).join("");

        document.getElementById("rvm-content").innerHTML = html;

    } catch (err) {
        document.getElementById("rvm-content").innerHTML = `
            <div style="grid-column: 1/-1; color: #ff6b6b; padding: 10px;">
                Failed to load layout: ${escapeHtml(err.message)}
            </div>`;
    }
}

// systemHealth.js — Schema Registry health panel module
// Requires: GATEWAY_URL, DOMAIN, fetchSheet, escapeHtml to be defined in host page

const SystemHealth = {
    entries: [],

    init() {
        document.getElementById('refreshHealthBtn').addEventListener('click', () => this.load());
        this.load();
    },

    async load() {
        document.getElementById('sysHealthBody').innerHTML =
            `<tr><td colspan="6" style="text-align:center;padding:20px;"><span class="spinner"></span></td></tr>`;
        document.getElementById('sysHealthDriftAlert').style.display = 'none';
        document.getElementById('sysHealthSummary').textContent = '';

        try {
            const rows = await fetchSheet(DOMAIN.audit, "SchemaRegistry");
            if (!Array.isArray(rows)) throw new Error("SchemaRegistry data invalid.");
            this.entries = rows;
            this.render();
        } catch (err) {
            document.getElementById('sysHealthBody').innerHTML =
                `<tr><td colspan="6" style="color:var(--signal);padding:16px;">Error loading registry: ${escapeHtml(err.message)}</td></tr>`;
            this._setDot('error');
        }
    },

    render() {
        const entries = this.entries;
        if (!entries.length) {
            document.getElementById('sysHealthBody').innerHTML =
                `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--foam-dim);">No schema data recorded yet. Data populates automatically as sheets are accessed.</td></tr>`;
            this._setDot('idle');
            return;
        }

        let driftFound = false;
        const okCount = entries.filter(e => (e['Status'] || 'OK') === 'OK').length;

        document.getElementById('sysHealthBody').innerHTML = entries.map(e => {
            const status    = e['Status']       || 'OK';
            const domain    = e['Domain']       || '—';
            const sheet     = e['Sheet']        || '—';
            const cols      = e['Columns']      || '';
            const rowCount  = e['Row Count']    || '—';
            const checked   = e['Last Checked'] || '';
            const baseline  = e['Baseline Columns'] || '';

            const isDrift   = status === 'DRIFT';
            const isError   = status === 'ERROR';
            if (isDrift) driftFound = true;

            // Parse column list for display
            let colList = [];
            try { colList = JSON.parse(cols); } catch { colList = cols ? cols.split(',') : []; }

            // Diff against baseline if drift
            let colDisplay = '';
            if (isDrift && baseline) {
                let baseList = [];
                try { baseList = JSON.parse(baseline); } catch { baseList = baseline.split(','); }
                const added   = colList.filter(c => !baseList.includes(c));
                const removed = baseList.filter(c => !colList.includes(c));
                colDisplay = [
                    ...added.map(c => `<span style="color:var(--glow)">+${escapeHtml(c)}</span>`),
                    ...removed.map(c => `<span style="color:var(--signal)">-${escapeHtml(c)}</span>`)
                ].join(', ') || escapeHtml(colList.join(', '));
            } else {
                colDisplay = `<span style="color:var(--foam-dim);font-size:11px;">${escapeHtml(colList.join(', '))}</span>`;
            }

            const checkedFmt = checked
                ? new Date(checked).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
                : '—';

            const badgeClass = isError ? 'badge-expired' : isDrift ? 'badge-renewal' : 'badge-full';
            const badgeText  = isError ? 'Error' : isDrift ? 'Drift' : 'OK';

            return `
            <tr class="${isError || isDrift ? 'audit-error' : ''}">
                <td style="font-size:11px;text-transform:capitalize;">${escapeHtml(domain)}</td>
                <td style="font-weight:500;">${escapeHtml(sheet)}</td>
                <td style="font-size:11px;max-width:320px;word-break:break-word;">${colDisplay}</td>
                <td style="text-align:center;">${escapeHtml(String(rowCount))}</td>
                <td style="white-space:nowrap;font-size:11px;color:var(--foam-dim);">${checkedFmt}</td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            </tr>`;
        }).join('');

        if (driftFound) {
            document.getElementById('sysHealthDriftAlert').style.display = 'block';
        }

        document.getElementById('sysHealthSummary').textContent =
            `${okCount} of ${entries.length} sheets OK`;

        const allOk = okCount === entries.length;
        this._setDot(driftFound ? 'warn' : allOk ? 'ok' : 'error');
    },

    _setDot(state) {
        const dot = document.getElementById('sysHealthDot');
        if (!dot) return;
        // Reuse signal/glow colours from theme
        const colours = { ok: 'var(--glow)', warn: 'var(--folder)', error: 'var(--signal)', idle: 'var(--foam-dim)' };
        dot.style.background   = colours[state] || colours.idle;
        dot.style.boxShadow    = `0 0 8px ${colours[state] || colours.idle}`;
    }
};

window.SystemHealth = SystemHealth;