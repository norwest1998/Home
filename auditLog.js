// auditLog.js — shared audit log module
// Requires: GATEWAY_URL, DOMAIN, fetchSheet, escapeHtml, fmtTime to be defined in host page

const AuditLog = {
    entries: [],
    domainFilter: 'members',

    init(defaultFilter = 'members') {
        this.domainFilter = defaultFilter;
        document.getElementById('auditSearch').addEventListener('input', () => this.render());
        document.getElementById('refreshLogBtn').addEventListener('click', () => this.load());
        document.getElementById('auditFilterMembers').addEventListener('click', () => this.setFilter('members'));
        document.getElementById('auditFilterAll').addEventListener('click', () => this.setFilter('all'));
        this.load();
    },

    setFilter(filter) {
        this.domainFilter = filter;
        document.getElementById('auditFilterMembers').classList.toggle('active', filter === 'members');
        document.getElementById('auditFilterAll').classList.toggle('active', filter === 'all');
        this.render();
    },

    async load() {
        try {
            const rows = await fetchSheet(DOMAIN.audit, "AuditLog");
            if (!Array.isArray(rows)) throw new Error("Audit log data invalid.");
            this.entries = rows.map(r => ({
                hexCode:    r["HexCode"]   || "",
                timestamp:  r["Timestamp"] || "",
                memberName: r["User"]      || "",
                action:     r["Action"]    || "",
                domain:     r["Domain"]    || "",
                sheet:      r["Sheet"]     || "",
                field:      r["Detail"]    || "",
                before:     r["Old Value"] || "",
                after:      r["New Value"] || "",
                success:    r["Success"]   || ""
            })).reverse();
            this.render();
        } catch (err) {
            document.getElementById('auditBody').innerHTML = '';
            document.getElementById('auditEmpty').style.display = 'block';
            document.getElementById('auditEmpty').textContent = 'Error loading audit log: ' + err.message;
        }
    },

    render() {
        const q = document.getElementById('auditSearch').value.trim().toLowerCase();
        let entries = this.entries;

        if (this.domainFilter === 'members') {
            entries = entries.filter(e => String(e.domain || '').toLowerCase() === 'members');
        }
        if (q) {
            entries = entries.filter(e =>
                ['memberName','action','domain','sheet','field','before','after']
                .some(k => String(e[k] || '').toLowerCase().includes(q))
            );
        }

        document.getElementById('auditBody').innerHTML = entries.map((e, i) => {
            const isError = String(e.success || '').toLowerCase() === 'failed'
                         || String(e.after || '').startsWith('ERROR:');
            const uid = `al${i}`;
            return `
            <tr class="${isError ? 'audit-error' : ''}">
                <td style="white-space:nowrap;">${fmtTime(e.timestamp)}</td>
                <td>${escapeHtml(e.memberName)}</td>
                <td style="font-size:11px;color:var(--foam-dim);">${escapeHtml(e.domain)}</td>
                <td style="font-size:11px;color:var(--foam-dim);">${escapeHtml(e.sheet)}</td>
                <td>${escapeHtml(e.action)}</td>
                <td>${escapeHtml(e.field)}</td>
                <td>${this._valTabs(e.before, e.after, isError, uid)}</td>
                <td><span class="badge ${isError ? 'badge-expired' : 'badge-full'}">${isError ? 'Fail' : 'OK'}</span></td>
            </tr>`;
        }).join('');
        document.getElementById('auditEmpty').style.display = entries.length ? 'none' : 'block';
    },

    _valTabs(before, after, isError, uid) {
        const bSafe = escapeHtml(before);
        const aSafe = escapeHtml(after);
        return `
        <div class="val-tabs">
            <div class="val-tab-btns">
                <button class="active" onclick="AuditLog._switchTab('${uid}','before',this)">Before</button>
                <button onclick="AuditLog._switchTab('${uid}','after',this)">After</button>
            </div>
            <div class="val-content" id="val-${uid}">${bSafe || '<span style="opacity:.4">—</span>'}</div>
            <div class="val-content" id="val-${uid}-after" style="display:none;">${isError ? `<span class="val-error">${aSafe}</span>` : (aSafe || '<span style="opacity:.4">—</span>')}</div>
        </div>`;
    },

    _switchTab(uid, tab, btn) {
        btn.closest('.val-tab-btns').querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`val-${uid}`).style.display          = tab === 'before' ? '' : 'none';
        document.getElementById(`val-${uid}-after`).style.display    = tab === 'after'  ? '' : 'none';
    }
};