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