// nav.js — shared navigation module
// Requires: nav.html injected into #nav-placeholder before Nav.init() is called
//
// Usage — no sections array needed, page is scanned automatically:
//   Nav.init();                                   // default label
//   Nav.init({ label: "MEMBER PORTAL" });         // custom portal subtitle
//
// Sections are discovered from any .section-head element that has an h2.
// If the .section-head has no id, one is auto-generated from the h2 text
// (e.g. "Admin Operations" → "section-admin-operations") and written to the DOM
// so anchor links work immediately.

const DOMAINS = [
    { label: "Admin",        href: "admin.html" },
    { label: "Applications", href: "applications.html" },
    { label: "Calendar",     href: "calendarManagement.html" },
    { label: "Documents",    href: "documentManagement.html" },
    { label: "Email",        href: "emailManagement.html" },
    { label: "Members",      href: "memberManagement.html" },
    { label: "Notes",        href: "notes.html" },
    { label: "Results",      href: "resultsManagement.html" },
];

const Nav = {
    init({ label = "ADMINISTRATION PORTAL" } = {}) {
        const portalLabel = document.getElementById('nav-portal-label');
        if (portalLabel) portalLabel.textContent = label;

        // Defer scan briefly so injected panels (auditLog, systemHealth) are in the DOM
        setTimeout(() => {
            const sections = this._scanSections();
            this._render(sections);
        }, 0);
    },

    // Scans all .section-head elements, auto-assigns ids where missing,
    // returns [{ label, href }] in DOM order.
    _scanSections() {
        return Array.from(document.querySelectorAll('.section-head')).reduce((acc, el) => {
            const h2 = el.querySelector('h2');
            if (!h2) return acc;

            if (!el.id) {
                el.id = 'section-' + h2.textContent.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            }

            acc.push({ label: h2.textContent.trim(), href: '#' + el.id });
            return acc;
        }, []);
    },

    _render(sections) {
        const sectionsDropdown = sections.length ? `
            <li class="nav-item">
                <span class="nav-link">
                    Sections <i data-lucide="chevron-down" style="width:12px;height:12px;"></i>
                </span>
                <ul class="dropdown-menu glass">
                    ${sections.map(s => `<li><a href="${s.href}">${s.label}</a></li>`).join('')}
                </ul>
            </li>` : '';

        document.getElementById('nav-links').innerHTML = `
            <li class="nav-item">
                <a href="index.html" class="nav-link">
                    <i data-lucide="home" style="width:14px;height:14px;"></i> SMMC Home
                </a>
            </li>
            <li class="nav-item">
                <span class="nav-link">
                    Domains <i data-lucide="chevron-down" style="width:12px;height:12px;"></i>
                </span>
                <ul class="dropdown-menu glass">
                    ${DOMAINS.map(d => `<li><a href="${d.href}">${d.label}</a></li>`).join('')}
                </ul>
            </li>
            ${sectionsDropdown}
        `;

        if (window.lucide) lucide.createIcons();
    }
};

window.Nav = Nav;