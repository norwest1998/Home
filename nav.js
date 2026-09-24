// nav.js — shared navigation module
// Requires: nav.html injected into #nav-placeholder before Nav.init() is called
//
// Usage:
//   Nav.init({
//     label: "ADMINISTRATION PORTAL",   // optional, defaults to that string
//     sections: [
//       { label: "Member Health",   href: "#member-health" },
//       { label: "Admin Operations", href: "#admin-ops" },
//       { label: "Audit Log",       href: "#audit-log" },
//       { label: "System Health",   href: "#system-health" },
//     ]
//   });

const DOMAINS = [
    { label: "Applications", href: "applications.html" },
    { label: "Calendar",     href: "calendarManagement.html" },
    { label: "Documents",    href: "documentManagement.html" },
    { label: "Members",      href: "memberManagement.html" },
    { label: "Notes",        href: "notes.html" },
];

const Nav = {
    init({ label = "ADMINISTRATION PORTAL", sections = [] } = {}) {
        const portalLabel = document.getElementById('nav-portal-label');
        if (portalLabel) portalLabel.textContent = label;

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