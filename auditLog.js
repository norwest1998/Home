// auditLog.js — shared audit log module
// Requires: GATEWAY_URL, DOMAIN, fetchSheet, escapeHtml, fmtTime to be defined in host page
// Each page should include: <meta name="smmc-domain" content="members">
// Valid values: any DOMAIN key, or "all" for no default filter.

const AuditLog = {
    entries: [],
    domainFilter: 'all',

    init() {
        const meta        = document.querySelector('meta[name="smmc-domain"]');
        const domain      = meta?.content?.toLowerCase() || 'all';
        const label       = domain === 'all' ? 'All' : domain.charAt(0).toUpperCase() + domain.slice(1);

        this.domainFilter  = domain;
        this.primaryDomain = domain;
        document.getElementById('auditFilterMembers').textContent = label;
        document.getElementById('auditSearch').addEventListener('input', () => this.render());
        document.getElementById('refreshLogBtn').addEventListener('click', () => this.load());
        document.getElementById('auditFilterMembers').addEventListener('click', () => this.setFilter(this.primaryDomain));
        const ddWrap = this._buildDomainDropdown();
        document.getElementById('auditFilterAll').replaceWith(ddWrap);
        this.load();
    },

    setFilter(filter) {
        this.domainFilter = filter === 'all' ? 'all' : filter;
        document.getElementById('auditFilterMembers').classList.toggle('active', filter === this.primaryDomain);
        const dd = document.getElementById('auditFilterAllBtn');
        if (dd) dd.classList.toggle('active', filter !== this.primaryDomain);
        this.render();
    },

    _buildDomainDropdown() {
        const allDomains = Object.keys(DOMAIN).filter(k => this.primaryDomain === 'all' || k !== this.primaryDomain);
        const wrapper = document.createElement('div');
        wrapper.className = 'audit-dropdown-wrap';
        wrapper.style.cssText = 'position:relative;display:inline-block;';
        wrapper.innerHTML = `
            <button id="auditFilterAllBtn">All ▾</button>
            <div id="auditDomainMenu" style="display:none;position:absolute;top:100%;left:0;z-index:100;
                background:var(--surface);border:1px solid var(--border);border-radius:6px;min-width:120px;padding:4px 0;margin-top:2px;">
                <div class="audit-domain-item" style="padding:6px 12px;cursor:pointer;font-size:12px;">All</div>
                ${allDomains.map(k => `
                <div class="audit-domain-item" data-domain="${k}"
                    style="padding:6px 12px;cursor:pointer;font-size:12px;text-transform:capitalize;">${k}</div>
                `).join('')}
            </div>`;

        wrapper.querySelector('#auditFilterAllBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleDropdown();
        });
        wrapper.querySelector('#auditDomainMenu').addEventListener('click', (e) => {
            e.stopPropagation();
        });

        wrapper.querySelector('.audit-domain-item').addEventListener('click', () => {
            this.setFilter('all');
            this._toggleDropdown();
        });

        wrapper.querySelectorAll('.audit-domain-item[data-domain]').forEach(el => {
            el.addEventListener('click', () => {
                this.setFilter(el.dataset.domain);
                this._toggleDropdown();
            });
        });

        // Close on outside click
        document.addEventListener('click', () => {
            const menu = document.getElementById('auditDomainMenu');
            if (menu) menu.style.display = 'none';
        });

        return wrapper;
    },

    _toggleDropdown() {
        const menu = document.getElementById('auditDomainMenu');
        if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
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

        if (this.domainFilter !== 'all') {
            entries = entries.filter(e => String(e.domain || '').toLowerCase() === String(this.domainFilter).toLowerCase());
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
                <td style="white-space:nowrap;">${e.timestamp ? new Date(e.timestamp).toISOString().slice(0,10).replace(/-/g,'/') : '—'}</td>
                <td>${escapeHtml(e.memberName)}</td>
                <td style="font-size:11px;color:var(--foam-dim);">${escapeHtml(e.domain)}</td>
                <td style="font-size:11px;color:var(--foam-dim);">${escapeHtml(e.sheet)}</td>
                <td>${escapeHtml(e.action)}</td>
                <td>${escapeHtml(e.field)}</td>
                <!-- Pass the full entry object 'e' here instead of just before/after -->
                <td>${this._valTabs(e, isError, uid)}</td>
                <td><span class="badge ${isError ? 'badge-expired' : 'badge-full'}">${isError ? 'Fail' : 'OK'}</span></td>
            </tr>`;
        }).join('');
        document.getElementById('auditEmpty').style.display = entries.length ? 'none' : 'block';
    },

    _valTabs(e, isError, uid) {
        const bSafe = escapeHtml(e.before);
        const aSafe = escapeHtml(e.after);
        
        // Inject a view button for Appended records containing JSON
        let viewBtn = '';
        const isAppend = e.action.toLowerCase().includes('append') && String(e.after).trim().startsWith('{');
        const isDelete = e.action.toLowerCase().includes('delete') && String(e.before).trim().startsWith('{');

        if (isAppend || isDelete) {
            const encodedData = encodeURIComponent(isAppend ? e.after : e.before);
            viewBtn = `
                <div style="margin-top: 8px;">
                    <button class="btn btn-ghost" style="padding: 4px 10px; font-size: 11px;" 
                        onclick="viewRecordModal('${escapeHtml(e.domain)}', '${escapeHtml(e.sheet)}', '${encodedData}')">
                        View Record
                    </button>
                </div>`;
        }

        if (isAppend || isDelete) {
            return viewBtn;
        }

        return `
        <div class="val-tabs">
            <div class="val-tab-btns">
                <button class="active" onclick="AuditLog._switchTab('${uid}','before',this)">Before</button>
                <button onclick="AuditLog._switchTab('${uid}','after',this)">After</button>
            </div>
            <div class="val-content" id="val-${uid}">${bSafe || '<span style="opacity:.4">—</span>'}</div>
            <div class="val-content" id="val-${uid}-after" style="display:none;">
                ${isError ? `<span class="val-error">${aSafe}</span>` : (aSafe || '<span style="opacity:.4">—</span>')}
            </div>
        </div>`;
    },

    _switchTab(uid, tab, btn) {
        btn.closest('.val-tab-btns').querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`val-${uid}`).style.display          = tab === 'before' ? '' : 'none';
        document.getElementById(`val-${uid}-after`).style.display    = tab === 'after'  ? '' : 'none';
    }
};
window.AuditLog = AuditLog;