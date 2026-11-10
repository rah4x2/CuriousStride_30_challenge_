import { escapeHtml, initials } from "../utils/dom.js";
import { icon } from "../utils/icons.js";
import { parseHash } from "../utils/router.js";

function brand() {
  return `<a class="brand" href="#/home" aria-label="CuriousStride home">
    <span class="brand-mark" aria-hidden="true"><span></span></span>
    <span><span class="brand-name">CuriousStride</span><span class="brand-subtitle">30-Day Reflection Challenge</span></span>
  </a>`;
}

function navLink(href, label, page, currentPage) {
  return `<a class="nav-link" href="${href}" ${page === currentPage ? 'aria-current="page"' : ""}>${label}</a>`;
}

function userAvatar(session) {
  const name = session?.profile?.fullName || session?.user?.fullName || "Participant";
  const url = session?.profile?.avatarUrl || session?.user?.avatarUrl || "";
  const safeImage = /^https:\/\//i.test(url)
    ? `<img src="${escapeHtml(url)}" alt="" referrerpolicy="no-referrer" />`
    : escapeHtml(initials(name));
  return `<span class="avatar" aria-hidden="true">${safeImage}</span>`;
}

function header(session) {
  const route = parseHash();
  const currentPage = route.page;
  const publicLinks = `
    ${navLink("#/home", "Home", "home", currentPage)}
    ${navLink("#/about", "About", "about", currentPage)}
    ${navLink("#/how-it-works", "How it works", "how-it-works", currentPage)}
  `;
  const participantLinks = `
    ${navLink("#/journey", "My Journey", "journey", currentPage)}
    ${navLink("#/reflections", "My Reflections", "reflections", currentPage)}
    ${navLink("#/completion", "Completion", "completion", currentPage)}
  `;
  const right = session
    ? `${participantLinks}
       ${session.isAdmin ? navLink("#/admin/overview", "Admin", "admin", currentPage) : ""}
       ${navLink("#/settings", "Settings", "settings", currentPage)}
       <span class="nav-divider" aria-hidden="true"></span>
       <div class="user-menu">
         ${userAvatar(session)}
         <button class="btn btn--ghost btn--small" type="button" data-sign-out>${icon("logOut")} Sign out</button>
       </div>`
    : `${publicLinks}<span class="nav-divider" aria-hidden="true"></span><a class="btn btn--primary btn--small" href="#/login">Start free</a>`;
  return `<header class="site-header">
    <div class="header-inner">
      ${brand()}
      <button class="mobile-nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open navigation">${icon("menu")}</button>
      <nav class="site-nav" id="site-nav" aria-label="Primary navigation">${right}</nav>
    </div>
  </header>`;
}

function footer(session, supportEmail) {
  const year = new Date().getFullYear();
  const supportLink = supportEmail
    ? `<a href="mailto:${escapeHtml(supportEmail)}">Contact support</a>`
    : '<span class="muted">Support details are added at launch.</span>';
  return `<footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          ${brand()}
          <p class="mt-1">30 days. One prompt a day. A little more understanding of yourself.</p>
        </div>
        <div class="footer-links">
          <h3>Explore</h3>
          <a href="#/about">About the challenge</a>
          <a href="#/how-it-works">How it works</a>
          ${session ? '<a href="#/journey">My Journey</a>' : '<a href="#/login">Start your challenge</a>'}
        </div>
        <div class="footer-links">
          <h3>Privacy & support</h3>
          <a href="#/privacy">Privacy policy</a>
          ${supportLink}
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${year} CuriousStride. Personal reflection, without public comparison.</span>
        <span>The participant owns their reflections.</span>
      </div>
    </div>
  </footer>`;
}

export function renderShell({ session, main, supportEmail = "", hideFooter = false }) {
  return `<div class="shell">${header(session)}<main id="main-content" class="main-content" tabindex="-1">${main}</main>${
    hideFooter ? "" : footer(session, supportEmail)
  }</div>`;
}

export function bindShellEvents({ onSignOut }) {
  const toggle = document.querySelector(".mobile-nav-toggle");
  const nav = document.querySelector(".site-nav");
  toggle?.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    toggle.setAttribute("aria-label", open ? "Open navigation" : "Close navigation");
    toggle.innerHTML = icon(open ? "menu" : "x");
    nav?.classList.toggle("is-open", !open);
    document.body.classList.toggle("nav-open", !open);
  });
  nav?.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      nav.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
      if (toggle) toggle.innerHTML = icon("menu");
      document.body.classList.remove("nav-open");
    }
  });
  document.querySelector("[data-sign-out]")?.addEventListener("click", onSignOut);
}
