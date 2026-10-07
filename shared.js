// config.js  (or inline in a shared include)

const ADMIN_CACHE_KEY = "SMMC_ADMIN_DATA_v2";

function readAdminCache(...keys) {
    try {
        const all = JSON.parse(localStorage.getItem(ADMIN_CACHE_KEY));
        if (!all) return null;
        if (!keys.length) return all;
        return Object.fromEntries(keys.map(k => [k, all[k]]));
    } catch (e) {
        console.warn("Admin cache parse error", e);
        return null;
    }
}

const GATEWAY_URL = "https://script.google.com/macros/s/AKfycbzXQNKK6rbWr7MerjKjQMrF0-LUJzKij0sxTxRGehGAp3GoM7q6GXc0yMMmLVInHSR_/exec";
const RESULTS_GATEWAY_URL = "https://script.google.com/macros/s/AKfycbwHYDa3Jg-4pojZ6zCeU_fT6Xc17Rwz_B3aFl7UbafDnb61UzuzI-uY3kagrSOo77L3/exec";
const TEMPLATE_GW_URL = "https://script.google.com/macros/s/AKfycbzXAuRrP7wCHWqaDJ5m-gh0V9MOxOKMFEuKUMGvf5NAh0tgLhtyHDeX8J9CQ-5PSOE2Ng/exec";
const EMAIL_GATEWAY_URL = "https://script.google.com/macros/s/AKfycbzrdcwjXHalBizwnRw62jKiY34saRkHewG5ueuO3wr3XsjcEtK2yCfX_LvzdOUrlV3g/exec";
const TRIGGERESULTS_URL = "https://script.google.com/macros/s/AKfycbxNvDM21y1L77uhmd0W5JyygwHke8FrbxM_B3EhcvTGCXzx_BDxFwK1OeuI6Zn-unta/exec";
const DOMAIN = {
    members:   "members",
    documents: "documents",
    calendar:  "calendar",
    apps:      "apps",
    notes:     "notes",
    audit:     "audit",
    tracking:  "tracking",
    results:   "results",
    requests:  "requests"  
};

// READ OPERATIONS -> Switched to POST to avoid Google Apps Script redirecting GETs to HTML Auth Pages
async function fetchSheet(domain, sheetName, hexKey = null) {
    const action = hexKey ? "display" : "fetch";
    const payload = { action, domain, sheet: sheetName };
    if (hexKey) payload.hexKey = hexKey;

    const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });
    
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } 
    catch(e) { throw new Error("Invalid Server Response: " + text.substring(0, 60) + "..."); }

    if (data.error) throw new Error(data.error);
    if (data.record) return data.record;                // single-record display
 
    const rows = data.values ?? [];
    if (rows.length > 0) registerSchema(domain, sheetName, rows); // fire-and-forget
    return rows;
}

async function searchSheet(domain, sheetName, filtersArray) {
    const payload = { action: "search", domain, sheet: sheetName, filtersArray };
    const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });
    
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } 
    catch(e) { throw new Error("Invalid Server Response: " + text.substring(0, 60) + "..."); }
    
    if (data.error) throw new Error(data.error);
    if (data.record) return data.record; 
    return data.values ?? [];
}

async function batchFetchSheets(requestsArray) {
    const payload = { action: "batchFetch", requests: requestsArray };
    const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });
    
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } 
    catch(e) { throw new Error("Invalid Server Response: " + text.substring(0, 60) + "..."); }
    
    if (data.error) throw new Error(data.error);

    // Fire-and-forget schema registration for all fetched sheets
    if (data.results) {
        Object.keys(data.results).forEach(key => {
            const [domain, sheetName] = key.split("|");
            const rows = data.results[key];
            if (Array.isArray(rows) && rows.length > 0) {
               registerSchema(domain, sheetName, rows);
            }
        });
    }
    return data.results;
}

async function viewRecordModal(domain, sheetName, encodedRowData) {
    let record;
    try {
        record = JSON.parse(decodeURIComponent(encodedRowData));
    } catch(e) {
        console.error("Could not parse record data:", e);
        alert("Invalid record data format.");
        return;
    }

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
        
        overlay.addEventListener("click", e => {
            if (e.target === overlay) overlay.classList.remove("open");
        });
    }

    document.getElementById("rvm-title").textContent = `${sheetName} Record`;
    document.getElementById("rvm-content").innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 20px;">
            <span class="spinner"></span> Loading layout...
        </div>`;
    
    overlay.classList.add("open");

    try {
        const data = record;
        if (data.error) throw new Error(data.error);
        
        const layoutKeys = data.layout || Object.keys(record);

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


const _schemaSent = new Set();
async function registerSchema(domain, sheetName, rows) {
    const k = domain + "|" + sheetName;
    if (_schemaSent.has(k)) return;
    _schemaSent.add(k);
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

// Drive Operations
async function fetchDriveFolder(folderKey) {
    const res  = await fetch(`${RESULTS_GATEWAY_URL}?action=listFolder&folder=${folderKey}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.files || [];
}

async function fetchDriveFile(fileId) {
    const res  = await fetch(`${RESULTS_GATEWAY_URL}?action=readFile&fileId=${encodeURIComponent(fileId)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.content;
}

async function triggerResultsProcessing() {
    const res  = await fetch(TRIGGERESULTS_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body:    JSON.stringify({ action: "triggerResults" })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error + "(Check the Upload folder for files to process.)");
    return data.message;
}

async function apiGet(action, extra = {}) {
    const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, ...extra })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.data ?? data;
}

// Utilities
function fmtTime(iso){
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}