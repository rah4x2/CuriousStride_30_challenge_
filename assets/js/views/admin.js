import { DEFAULT_CONTENT, STAGES, stageForDay } from "../data/site-defaults.js";
import {
  getPromptVersions,
  saveAdminContent,
  saveAdminPrompt,
  setAdminPromptStatus,
  updateParticipantStatus
} from "../services/backend.js";
import { escapeHtml, formatShortDate, getFormData, setDocumentTitle } from "../utils/dom.js";
import { icon } from "../utils/icons.js";
import { navigate } from "../utils/router.js";
import { openModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";

function adminSideNav(tab) {
  const links = [
    ["overview", "home", "Overview"],
    ["prompts", "list", "Prompts"],
    ["content", "edit", "Website content"],
    ["participants", "users", "Participants"],
    ["analytics", "chart", "Analytics"]
  ];
  return `<nav class="card side-nav" aria-label="Administrator sections">${links
    .map(
      ([id, iconName, label]) =>
        `<a href="#/admin/${id}" ${tab === id ? 'aria-current="page"' : ""}>${icon(iconName)} ${label}</a>`
    )
    .join("")}</nav>`;
}

function adminFrame(tab, content) {
  setDocumentTitle(`Admin · ${tab[0].toUpperCase()}${tab.slice(1)}`);
  return `<section class="app-page"><div class="container">
    <div class="app-header"><div><span class="eyebrow">Administrator dashboard</span><h1>Manage CuriousStride.</h1><p>Prompt content, participant status and aggregate activity — never private journal text.</p></div><a class="btn btn--secondary" href="#/journey">${icon("external")} Open participant view</a></div>
    <div class="admin-banner"><div><strong>${icon("shield")} Protected administrator area</strong><div class="muted">Access is verified separately from ordinary Google sign-in.</div></div><span class="status-chip status-chip--success">Admin verified</span></div>
    <div class="admin-layout">${adminSideNav(tab)}<div>${content}</div></div>
  </div></section>`;
}

export function renderAdminOverview(overview) {
  const recentRows = (overview.recentParticipants || [])
    .map(
      (participant) => `<tr><td><strong>${escapeHtml(participant.fullName)}</strong><br><span class="muted">${escapeHtml(participant.email)}</span></td><td>${formatShortDate(participant.registrationDate)}</td><td><span class="status-chip status-chip--neutral">${escapeHtml(participant.status || "active")}</span></td></tr>`
    )
    .join("");
  return adminFrame(
    "overview",
    `<div class="admin-stats">
      <article class="card admin-stat"><span class="icon-tile">${icon("users")}</span><strong>${overview.registeredParticipants}</strong><span>Registered participants</span></article>
      <article class="card admin-stat"><span class="icon-tile">${icon("clock")}</span><strong>${overview.activeParticipants}</strong><span>Active in the last 7 days</span></article>
      <article class="card admin-stat"><span class="icon-tile">${icon("checkCircle")}</span><strong>${overview.completedChallenges}</strong><span>Completed challenges</span></article>
      <article class="card admin-stat"><span class="icon-tile">${icon("book")}</span><strong>${overview.publishedPrompts}/30</strong><span>Published prompts</span></article>
    </div>
    <div class="grid-2">
      <section class="card admin-panel">
        <div class="card-header"><div><h2>Recent registrations</h2><p>Basic account details only.</p></div><a class="btn btn--ghost btn--small" href="#/admin/participants">View all</a></div>
        <div class="table-wrap"><table><thead><tr><th>Participant</th><th>Registered</th><th>Status</th></tr></thead><tbody>${recentRows || '<tr><td colspan="3">No participants yet.</td></tr>'}</tbody></table></div>
      </section>
      <section class="card admin-panel">
        <div class="card-header"><div><h2>Launch health</h2><p>A quick operational check.</p></div></div>
        <div class="settings-row"><div><h3>Completion rate</h3><p>Participants who reached the completion state.</p></div><strong>${overview.completionRate}%</strong></div>
        <div class="settings-row"><div><h3>Prompt readiness</h3><p>All 30 prompts should be reviewed and published before a public launch.</p></div><span class="status-chip ${overview.publishedPrompts === 30 ? "status-chip--success" : "status-chip--warning"}">${overview.publishedPrompts === 30 ? "Ready" : `${30 - overview.publishedPrompts} remaining`}</span></div>
        <div class="settings-row"><div><h3>Journal privacy</h3><p>This dashboard has no reflection-content viewer.</p></div><span class="status-chip status-chip--success">Protected</span></div>
      </section>
    </div>
    <section class="card admin-panel mt-1">
      <div class="card-header"><div><h2>Common actions</h2><p>Continue where the product needs attention.</p></div></div>
      <div class="button-row"><a class="btn btn--primary" href="#/admin/prompts">${icon("edit")} Review prompts</a><a class="btn btn--secondary" href="#/admin/content">Update homepage</a><a class="btn btn--secondary" href="#/admin/analytics">View participation trends</a></div>
    </section>`
  );
}

function promptListItem(prompt, selectedId) {
  return `<button class="prompt-admin-item ${prompt.id === selectedId ? "is-selected" : ""}" type="button" data-select-prompt="${escapeHtml(prompt.id)}">
    <span class="prompt-admin-item__day">${prompt.dayNumber}</span>
    <span style="min-width:0"><h4>${escapeHtml(prompt.title)}</h4><p>${escapeHtml(stageForDay(prompt.dayNumber).name)} · Version ${prompt.version}</p></span>
    <span class="status-chip ${prompt.status === "published" ? "status-chip--success" : "status-chip--neutral"}">${prompt.status === "published" ? "Published" : "Hidden"}</span>
  </button>`;
}

function promptForm(prompt) {
  const selected = prompt || {
    id: "",
    dayNumber: 1,
    stageId: STAGES[0].id,
    title: "",
    introduction: "",
    question: "",
    followUp: "",
    status: "unpublished",
    version: 0
  };
  return `<form data-prompt-form>
    <input type="hidden" name="id" value="${escapeHtml(selected.id)}">
    <div class="form-grid">
      <div class="form-group"><label for="prompt-day">Day number</label><input id="prompt-day" name="dayNumber" type="number" min="1" max="30" value="${selected.dayNumber}" required></div>
      <div class="form-group"><label for="prompt-stage">Stage</label><select id="prompt-stage" name="stageId">${STAGES.map((stage) => `<option value="${stage.id}" ${selected.stageId === stage.id ? "selected" : ""}>${stage.number}. ${escapeHtml(stage.name)}</option>`).join("")}</select></div>
      <div class="form-group form-group--full"><label for="prompt-title">Prompt title</label><input id="prompt-title" name="title" value="${escapeHtml(selected.title)}" required maxlength="120"></div>
      <div class="form-group form-group--full"><label for="prompt-intro">Short introduction</label><textarea id="prompt-intro" name="introduction" rows="4" maxlength="700">${escapeHtml(selected.introduction)}</textarea></div>
      <div class="form-group form-group--full"><label for="prompt-question">Main question</label><textarea id="prompt-question" name="question" rows="4" required maxlength="700">${escapeHtml(selected.question)}</textarea></div>
      <div class="form-group form-group--full"><label for="prompt-followup">Optional follow-up</label><textarea id="prompt-followup" name="followUp" rows="3" maxlength="500">${escapeHtml(selected.followUp)}</textarea></div>
      <div class="form-group"><label for="prompt-status">Publication status</label><select id="prompt-status" name="status"><option value="published" ${selected.status === "published" ? "selected" : ""}>Published</option><option value="unpublished" ${selected.status !== "published" ? "selected" : ""}>Unpublished</option></select></div>
      <div class="form-group"><label>Current version</label><input value="Version ${selected.version || 0}" disabled><span class="form-hint">Saving creates a new immutable version.</span></div>
    </div>
    <div class="button-row mt-1">
      <button class="btn btn--primary" type="submit">${icon("save")} Save as new version</button>
      <button class="btn btn--secondary" type="button" data-preview-prompt>${icon("eye")} Preview</button>
      ${selected.id ? `<button class="btn btn--ghost" type="button" data-version-history="${escapeHtml(selected.id)}">Version history</button>` : ""}
    </div>
  </form>`;
}

export function renderAdminPrompts({ prompts, selectedPrompt, isCreating = false }) {
  const selected = isCreating ? null : selectedPrompt || prompts[0] || null;
  return adminFrame(
    "prompts",
    `<section class="card admin-panel">
      <div class="card-header"><div><h2>Daily prompt management</h2><p>Editing a prompt creates a new version. Existing participant assignments remain linked to the version they first received.</p></div><button class="btn btn--secondary btn--small" type="button" data-new-prompt>${icon("plus")} New prompt</button></div>
      <div class="prompt-admin-grid">
        <div class="prompt-list-admin" aria-label="Prompt list">${prompts.map((prompt) => promptListItem(prompt, selected?.id)).join("") || '<div class="empty-state"><p>No prompts have been created.</p></div>'}</div>
        <div class="card prompt-editor-card"><div class="card-header"><div><h3>${selected ? `Edit Day ${selected.dayNumber}` : "Create a prompt"}</h3><p>Day, stage, question and publication settings.</p></div></div>${promptForm(selected)}</div>
      </div>
    </section>`
  );
}

function promptPreviewContent(data) {
  const stage = STAGES.find((item) => item.id === data.stageId) || stageForDay(Number(data.dayNumber));
  return `<div class="prompt-panel" style="position:relative;top:auto">
    <span class="day-chip">Day ${escapeHtml(data.dayNumber)} · ${escapeHtml(stage.name)}</span>
    <h1>${escapeHtml(data.title || "Untitled prompt")}</h1>
    <p>${escapeHtml(data.introduction || "No introduction added.")}</p>
    <div class="prompt-question">${escapeHtml(data.question || "No question added.")}</div>
    ${data.followUp ? `<div class="prompt-followup"><strong>Consider:</strong> ${escapeHtml(data.followUp)}</div>` : ""}
  </div>`;
}

function versionHistoryContent(versions) {
  return `<div class="version-list">${versions
    .map(
      (version) => `<article class="version-item"><div class="version-item__top"><strong>Version ${version.version}</strong><span class="muted">${formatShortDate(version.createdAt)}</span></div><h4>${escapeHtml(version.title)}</h4><p>${escapeHtml(version.question)}</p></article>`
    )
    .join("") || "<p>No version history was returned.</p>"}</div>`;
}

export function bindAdminPrompts({ selectedPrompt, refresh }) {
  document.querySelectorAll("[data-select-prompt]").forEach((button) => {
    button.addEventListener("click", () => navigate(`/admin/prompts?prompt=${encodeURIComponent(button.dataset.selectPrompt)}`));
  });
  document.querySelector("[data-new-prompt]")?.addEventListener("click", () => navigate("/admin/prompts?new=1"));

  const form = document.querySelector("[data-prompt-form]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Saving version…';
    try {
      const saved = await saveAdminPrompt(getFormData(form));
      showToast(`Day ${saved.dayNumber} saved as Version ${saved.version}.`, "success");
      navigate(`/admin/prompts?prompt=${encodeURIComponent(saved.id)}`, { replace: true });
      await refresh();
    } catch (error) {
      showToast(error.message, "error", 7000);
      button.disabled = false;
      button.innerHTML = `${icon("save")} Save as new version`;
    }
  });

  document.querySelector("[data-preview-prompt]")?.addEventListener("click", () => {
    const data = getFormData(form);
    openModal({ title: "Participant preview", content: promptPreviewContent(data) });
  });

  document.querySelector("[data-version-history]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const versions = await getPromptVersions(button.dataset.versionHistory);
      openModal({ title: `Version history · Day ${selectedPrompt.dayNumber}`, content: versionHistoryContent(versions) });
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });
}

function benefitFields(content) {
  const benefits = content.benefits || DEFAULT_CONTENT.benefits;
  return benefits
    .map(
      (benefit, index) => `<div class="card card--padded form-group--full"><h3 style="font-family:var(--font-body);font-size:1rem">Benefit ${index + 1}</h3><div class="form-grid"><div class="form-group"><label for="benefit-title-${index}">Title</label><input id="benefit-title-${index}" name="benefitTitle${index}" value="${escapeHtml(benefit.title)}"></div><div class="form-group"><label for="benefit-description-${index}">Description</label><textarea id="benefit-description-${index}" name="benefitDescription${index}" rows="3">${escapeHtml(benefit.description)}</textarea></div></div></div>`
    )
    .join("");
}

function faqFields(content) {
  const faqs = content.faqs || DEFAULT_CONTENT.faqs;
  return faqs
    .map(
      (faq, index) => `<div class="card card--padded form-group--full"><h3 style="font-family:var(--font-body);font-size:1rem">FAQ ${index + 1}</h3><div class="form-grid"><div class="form-group"><label for="faq-question-${index}">Question</label><input id="faq-question-${index}" name="faqQuestion${index}" value="${escapeHtml(faq.question)}"></div><div class="form-group"><label for="faq-answer-${index}">Answer</label><textarea id="faq-answer-${index}" name="faqAnswer${index}" rows="3">${escapeHtml(faq.answer)}</textarea></div></div></div>`
    )
    .join("");
}

export function renderAdminContent(content) {
  return adminFrame(
    "content",
    `<section class="card admin-panel">
      <div class="card-header"><div><h2>Website content</h2><p>Update public copy and registration availability without editing source files.</p></div><a class="btn btn--secondary btn--small" href="#/home">${icon("eye")} Preview homepage</a></div>
      <form data-content-form>
        <div class="settings-row"><div><h3>Accept new registrations</h3><p>Existing participants can still sign in when this is switched off.</p></div><label class="switch"><input type="checkbox" name="registrationsOpen" ${content.registrationsOpen !== false ? "checked" : ""}><span aria-hidden="true"></span><span class="sr-only">Accept new registrations</span></label></div>
        <div class="form-grid mt-1">
          <div class="form-group form-group--full"><label for="home-heading">Homepage heading</label><input id="home-heading" name="homeHeading" value="${escapeHtml(content.homeHeading)}"></div>
          <div class="form-group form-group--full"><label for="home-intro">Homepage introduction</label><textarea id="home-intro" name="homeIntro" rows="5">${escapeHtml(content.homeIntro)}</textarea></div>
          <div class="form-group"><label for="about-heading">About heading</label><input id="about-heading" name="aboutHeading" value="${escapeHtml(content.aboutHeading)}"></div>
          <div class="form-group"><label for="how-heading">How it works heading</label><input id="how-heading" name="howHeading" value="${escapeHtml(content.howHeading)}"></div>
          <div class="form-group form-group--full"><label for="about-body">About summary</label><textarea id="about-body" name="aboutBody" rows="5">${escapeHtml(content.aboutBody)}</textarea></div>
          <div class="form-group form-group--full"><label for="privacy-summary">Privacy summary</label><textarea id="privacy-summary" name="privacySummary" rows="4">${escapeHtml(content.privacySummary)}</textarea></div>
          <div class="form-group form-group--full"><h2 style="font-size:1.7rem;margin-top:1rem">Homepage benefits</h2></div>
          ${benefitFields(content)}
          <div class="form-group form-group--full"><h2 style="font-size:1.7rem;margin-top:1rem">Frequently asked questions</h2></div>
          ${faqFields(content)}
        </div>
        <button class="btn btn--primary mt-2" type="submit">${icon("save")} Save website content</button>
      </form>
    </section>`
  );
}

export function bindAdminContent({ content, refresh }) {
  const form = document.querySelector("[data-content-form]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = getFormData(form);
    const payload = {
      registrationsOpen: form.elements.registrationsOpen.checked,
      homeHeading: data.homeHeading,
      homeIntro: data.homeIntro,
      aboutHeading: data.aboutHeading,
      aboutBody: data.aboutBody,
      howHeading: data.howHeading,
      privacySummary: data.privacySummary,
      benefits: (content.benefits || DEFAULT_CONTENT.benefits).map((_, index) => ({
        title: data[`benefitTitle${index}`] || "",
        description: data[`benefitDescription${index}`] || ""
      })),
      faqs: (content.faqs || DEFAULT_CONTENT.faqs).map((_, index) => ({
        question: data[`faqQuestion${index}`] || "",
        answer: data[`faqAnswer${index}`] || ""
      }))
    };
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Saving content…';
    try {
      await saveAdminContent(payload);
      showToast("Website content saved.", "success");
      await refresh();
    } catch (error) {
      showToast(error.message, "error");
      button.disabled = false;
      button.innerHTML = `${icon("save")} Save website content`;
    }
  });
}

function participantRow(participant) {
  const statusOptions = ["active", "paused", "deactivated", "completed"]
    .map((status) => `<option value="${status}" ${participant.status === status ? "selected" : ""}>${status[0].toUpperCase()}${status.slice(1)}</option>`)
    .join("");
  const search = `${participant.fullName} ${participant.email} ${participant.status}`.toLowerCase();
  return `<tr data-participant-row data-search="${escapeHtml(search)}">
    <td><strong>${escapeHtml(participant.fullName)}</strong><br><span class="muted">${escapeHtml(participant.email)}</span></td>
    <td>${formatShortDate(participant.registrationDate)}</td>
    <td>Day ${participant.currentDay || 0}<br><span class="muted">${participant.completedCount || 0} completed</span></td>
    <td>${formatShortDate(participant.lastActiveAt)}</td>
    <td><select data-participant-status="${escapeHtml(participant.id)}" aria-label="Status for ${escapeHtml(participant.fullName)}">${statusOptions}</select></td>
  </tr>`;
}

export function renderAdminParticipants(participants) {
  return adminFrame(
    "participants",
    `<section class="card admin-panel">
      <div class="card-header"><div><h2>Participant management</h2><p>Basic account and progress information. Private reflection responses are intentionally absent.</p></div><span class="status-chip status-chip--neutral">${participants.length} accounts</span></div>
      <div class="notice mb-0">${icon("shield")}<p>Administrators can change account status, but this interface has no endpoint for reading journal text.</p></div>
      <div class="filter-bar mt-1"><div class="search-field">${icon("search")}<label class="sr-only" for="participant-search">Search participants</label><input id="participant-search" type="search" placeholder="Search name, email or status" data-participant-search></div></div>
      <div class="table-wrap"><table><thead><tr><th>Participant</th><th>Registered</th><th>Progress</th><th>Last active</th><th>Account status</th></tr></thead><tbody>${participants.map(participantRow).join("") || '<tr><td colspan="5">No participants yet.</td></tr>'}</tbody></table></div>
      <div class="empty-state hide mt-1" data-participant-empty><h3>No matching participant</h3><p>Try a different search term.</p></div>
    </section>`
  );
}

export function bindAdminParticipants({ refresh }) {
  const search = document.querySelector("[data-participant-search]");
  const rows = [...document.querySelectorAll("[data-participant-row]")];
  const empty = document.querySelector("[data-participant-empty]");
  search?.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach((row) => {
      const show = !query || row.dataset.search.includes(query);
      row.classList.toggle("hide", !show);
      if (show) visible += 1;
    });
    empty.classList.toggle("hide", visible > 0);
  });
  document.querySelectorAll("[data-participant-status]").forEach((select) => {
    let previous = select.value;
    select.addEventListener("change", async () => {
      select.disabled = true;
      try {
        await updateParticipantStatus(select.dataset.participantStatus, select.value);
        showToast("Participant status updated.", "success");
        previous = select.value;
      } catch (error) {
        select.value = previous;
        showToast(error.message, "error");
      } finally {
        select.disabled = false;
      }
    });
  });
}

function barChart(items) {
  const max = Math.max(1, ...items.map((item) => Number(item.value || 0)));
  return `<div class="bar-chart">${items
    .map(
      (item) => `<div class="bar-chart__item" title="${escapeHtml(item.label)}: ${Number(item.value || 0)}"><strong>${Number(item.value || 0)}</strong><div class="bar-chart__bar" style="height:${Math.max(4, (Number(item.value || 0) / max) * 150)}px"></div><span class="bar-chart__label">${escapeHtml(item.label)}</span></div>`
    )
    .join("")}</div>`;
}

export function renderAdminAnalytics(analytics) {
  return adminFrame(
    "analytics",
    `<div class="admin-stats">
      <article class="card admin-stat"><span class="icon-tile">${icon("list")}</span><strong>${analytics.averageCompleted}</strong><span>Average reflections completed</span></article>
      <article class="card admin-stat"><span class="icon-tile">${icon("refresh")}</span><strong>${analytics.returnRate}%</strong><span>Participant return rate</span></article>
      <article class="card admin-stat"><span class="icon-tile">${icon("chart")}</span><strong>${analytics.totalEvents}</strong><span>Non-journal activity events</span></article>
    </div>
    <div class="analytics-grid">
      <section class="card chart-card"><div class="card-header"><div><h2>Registrations</h2><p>New accounts by recent week.</p></div></div>${barChart(analytics.registrations || [])}</section>
      <section class="card chart-card"><div class="card-header"><div><h2>Stage completion</h2><p>Participants reaching the end of each stage.</p></div></div>${barChart(analytics.stageCompletion || [])}</section>
    </div>
    <section class="card admin-panel mt-1"><div class="card-header"><div><h2>Privacy-aware measurement</h2><p>Analytics should help improve the experience without analysing personal journal text.</p></div></div><div class="grid-3"><div class="notice">${icon("checkCircle")}<p>Track registration, return visits and completed-day counts.</p></div><div class="notice">${icon("checkCircle")}<p>Compare stage drop-off using anonymous aggregate totals.</p></div><div class="notice notice--warning">${icon("alert")}<p>Do not copy private responses into analytics or administrator views.</p></div></div></section>`
  );
}
