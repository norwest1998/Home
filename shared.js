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
    tracking:  "tracking"
    };

    async function fetchSheet(domain, sheetName, hexKey = null) {
        const action = hexKey ? "display" : "fetch";
        const url    = `${GATEWAY_URL}?action=${action}&domain=${domain}&sheet=${encodeURIComponent(sheetName)}`
                     + (hexKey ? `&hexKey=${encodeURIComponent(hexKey)}` : "");
        const res  = await fetch(url);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        // display returns { record: {} }, fetch returns { values: [...] }
        if (data.record) return data.record;
        return data.values ?? [];
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
            const url = `${GATEWAY_URL}?action=layout&domain=${encodeURIComponent(domain)}&sheetName=${encodeURIComponent(sheetName)}`;
            const res = await fetch(url);
            const data = await res.json();
            
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