import { CHALLENGE, FINAL_QUESTIONS, STAGES, stageForDay } from "../data/site-defaults.js";
import {
  completeMyOnboarding,
  config,
  deleteCloudReflections,
  getCloudReflections,
  recordEvent,
  saveCloudReflection,
  updateProfileSettings
} from "../services/backend.js";
import {
  buildBackup,
  clearEmergencyDraft,
  clearUserData,
  getAllReflections,
  getFinalReflections,
  readEmergencyDraft,
  restoreBackup,
  saveEmergencyDraft,
  saveFinalReflections,
  saveManyReflections,
  saveReflection
} from "../services/storage.js";
import { exportReflectionsPdf } from "../services/pdf.js";
import {
  announce,
  debounce,
  downloadBlob,
  escapeHtml,
  formatDate,
  formatShortDate,
  getFormData,
  setDocumentTitle,
  wordCount
} from "../utils/dom.js";
import { icon } from "../utils/icons.js";
import { dateForChallengeDay, daysUntilChallengeDay } from "../utils/time.js";
import { navigate } from "../utils/router.js";
import { showToast } from "../components/toast.js";
import { closeModal, openModal } from "../components/modal.js";

function promptMap(journey) {
  return new Map((journey.availablePrompts || []).map((prompt) => [Number(prompt.dayNumber), prompt]));
}

function reflectionMap(reflections) {
  return new Map((reflections || []).map((reflection) => [Number(reflection.dayNumber), reflection]));
}


function participantGuideMarkup({ reminderAvailable = false, reminderEnabled = false, reminderTime = "19:00", includeForm = false } = {}) {
  return `<div class="onboarding-guide">
    <div class="onboarding-intro">
      <span class="onboarding-spark" aria-hidden="true"></span>
      <p>Over the next 30 days, one thoughtful prompt unlocks each calendar day. Your journey begins only after you complete this guide.</p>
    </div>
    <div class="onboarding-points">
      <div><span class="guide-icon guide-icon--teal">${icon("calendar")}</span><p><strong>One prompt each day.</strong> Earlier prompts stay open, and missing a day never resets your progress.</p></div>
      <div><span class="guide-icon guide-icon--purple">${icon("save")}</span><p><strong>Saved locally by default.</strong> Your writing remains in this browser unless you deliberately enable cloud sync.</p></div>
      <div><span class="guide-icon guide-icon--pink">${icon("shield")}</span><p><strong>Leave out sensitive details.</strong> Do not enter passwords, financial data, identification numbers, medical records or other highly sensitive information.</p></div>
      <div><span class="guide-icon guide-icon--yellow">${icon("sparkles")}</span><p><strong>Reflection, not professional care.</strong> CuriousStride is not therapy, medical advice, crisis support or career counselling.</p></div>
      <div><span class="guide-icon">${icon("download")}</span><p><strong>Keep a backup.</strong> You can export a PDF or private JSON backup at any point from Settings.</p></div>
    </div>
    ${
      includeForm
        ? `<div class="onboarding-form-grid">
            <div class="form-group"><label for="onboarding-timezone">Your challenge timezone</label><input id="onboarding-timezone" name="timezone" list="onboarding-timezones" required><datalist id="onboarding-timezones"><option value="Asia/Dubai"><option value="UTC"><option value="Europe/London"><option value="America/New_York"><option value="Asia/Singapore"><option value="Australia/Sydney"></datalist><span class="form-hint">This controls when each new calendar day unlocks.</span></div>
            ${reminderAvailable ? `<div class="reminder-opt-in"><label class="completed-toggle"><input type="checkbox" name="reminderEnabled" ${reminderEnabled ? "checked" : ""}> Email me when my daily reflection is ready</label><label for="onboarding-reminder-time">Preferred local time</label><input id="onboarding-reminder-time" name="reminderTime" type="time" value="${escapeHtml(reminderTime)}"></div>` : `<div class="notice"><p>Email reminders are optional and are not enabled for this deployment. You can still return whenever it suits you.</p></div>`}
          </div>
          <label class="onboarding-consent"><input type="checkbox" name="storageAcknowledged" required><span>I understand that local reflections stay on this device and may be lost if browser data is cleared.</span></label>
          <label class="onboarding-consent"><input type="checkbox" name="safetyAcknowledged" required><span>I understand the sensitive-information and professional-support guidance above.</span></label>`
        : ""
    }
  </div>`;
}

export function renderOnboarding({ session, journey }) {
  setDocumentTitle("Welcome Guide");
  const profile = journey.profile || session.profile || {};
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || profile.timezone || config.defaultTimezone || "UTC";
  const reminderAvailable = config.enableReminders && config.mode === "supabase";
  return `<section class="onboarding-page">
    <div class="onboarding-backdrop-art" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <form class="onboarding-dialog" data-onboarding-form aria-labelledby="onboarding-title">
      <div class="onboarding-heading">
        <span class="eyebrow">Before Day 1</span>
        <h1 id="onboarding-title">Welcome to your CuriousStride.</h1>
        <p>Hello ${escapeHtml((profile.fullName || session.user.fullName || "there").split(/\s+/)[0])}. A few clear expectations will help keep this space useful and private.</p>
      </div>
      ${participantGuideMarkup({ reminderAvailable, reminderEnabled: profile.reminderEnabled, reminderTime: profile.reminderTime || "19:00", includeForm: true })}
      <input type="hidden" name="detectedTimezone" value="${escapeHtml(browserTimezone)}">
      <div class="onboarding-actions">
        <div><a href="#/privacy">Read the privacy policy</a><span> · </span><a href="#/how-it-works">How it works</a></div>
        <button class="btn btn--primary" type="submit">Begin My 30-Day Journey ${icon("arrowRight")}</button>
      </div>
    </form>
  </section>`;
}

export function bindOnboarding({ session, journey, onComplete }) {
  const form = document.querySelector("[data-onboarding-form]");
  if (!form) return;
  const timezoneInput = form.elements.timezone;
  timezoneInput.value = journey.profile?.onboardingCompletedAt
    ? journey.profile.timezone
    : (form.elements.detectedTimezone.value || journey.profile?.timezone || config.defaultTimezone || "UTC");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Preparing Day 1…';
    try {
      const profile = await completeMyOnboarding({
        timezone: timezoneInput.value.trim(),
        reminderEnabled: Boolean(form.elements.reminderEnabled?.checked),
        reminderTime: form.elements.reminderTime?.value || "19:00"
      });
      showToast("Your journey is ready. Day 1 begins today.", "success", 6000);
      await onComplete?.(profile);
    } catch (error) {
      showToast(error.message, "error", 7000);
      button.disabled = false;
      button.innerHTML = original;
    }
  });
}

function openParticipantGuide() {
  openModal({
    title: "CuriousStride participant guide",
    content: `${participantGuideMarkup({ reminderAvailable: false, includeForm: false })}<div class="button-row mt-2"><a class="btn btn--secondary" href="#/privacy" data-close-modal>Privacy policy</a><button class="btn btn--primary" type="button" data-close-modal>Done</button></div>`
  });
}

function stageProgress(stage, reflections) {
  const completed = reflections.filter(
    (reflection) =>
      reflection.completed && Number(reflection.dayNumber) >= stage.startDay && Number(reflection.dayNumber) <= stage.endDay
  ).length;
  return { completed, percentage: Math.round((completed / 6) * 100) };
}

function dayCell(day, journey, prompts, reflections) {
  const prompt = prompts.get(day);
  const reflection = reflections.get(day);
  const locked = day > journey.currentDay || !prompt;
  const completed = Boolean(reflection?.completed);
  const current = day === journey.currentDay && !locked;
  const className = completed
    ? "day-cell--completed"
    : current
      ? "day-cell--current"
      : locked
        ? "day-cell--locked"
        : "day-cell--available";
  const label = completed ? "Completed" : current ? "Today" : locked ? "Locked" : reflection?.response ? "Started" : "Available";
  const glyph = completed ? icon("check", "day-cell__icon") : locked ? icon("lock", "day-cell__icon") : "";
  const content = `${glyph}<span class="day-cell__number">${day}</span><span class="day-cell__label">${label}</span>`;
  if (locked) {
    return `<span class="day-cell ${className}" aria-label="Day ${day}, ${label}" aria-disabled="true">${content}</span>`;
  }
  return `<a class="day-cell ${className}" href="#/reflection/${day}" aria-label="Day ${day}, ${label}">${content}</a>`;
}

export function renderJourney({ session, journey, reflections }) {
  setDocumentTitle("My Journey");
  const profile = journey.profile || session.profile;
  const name = (profile.fullName || "there").split(/\s+/)[0];
  const completedCount = reflections.filter((reflection) => reflection.completed).length;
  const prompts = promptMap(journey);
  const reflectionsByDay = reflectionMap(reflections);
  const currentPrompt = prompts.get(journey.currentDay);
  const firstUnfinished = [...prompts.values()].find((prompt) => !reflectionsByDay.get(prompt.dayNumber)?.completed);
  const suggestedPrompt = currentPrompt || firstUnfinished || [...prompts.values()].at(-1);
  const remaining = Math.max(0, 30 - completedCount);
  const cells = Array.from({ length: 30 }, (_, index) => dayCell(index + 1, journey, prompts, reflectionsByDay)).join("");
  const stageRows = STAGES.map((stage) => {
    const progress = stageProgress(stage, reflections);
    return `<div class="stage-progress-row">
      <div class="stage-progress-row__top"><strong>${escapeHtml(stage.name)}</strong><span>${progress.completed}/6</span></div>
      <div class="progress-bar" aria-label="${escapeHtml(stage.name)}: ${progress.completed} of 6 completed"><span style="width:${progress.percentage}%"></span></div>
    </div>`;
  }).join("");

  return `<section class="app-page">
    <div class="container">
      <div class="app-header">
        <div><span class="eyebrow">My Journey</span><h1>Welcome back, ${escapeHtml(name)}.</h1><p>Your pace is allowed to look like real life.</p></div>
        <div class="button-row">
          <a class="btn btn--secondary" href="#/reflections">${icon("book")} My Reflections</a>
          ${suggestedPrompt ? `<a class="btn btn--primary" href="#/reflection/${suggestedPrompt.dayNumber}">${icon("pen")} Reflect on Day ${suggestedPrompt.dayNumber}</a>` : ""}
        </div>
      </div>

      ${
        profile.status === "deactivated"
          ? `<div class="notice notice--danger mb-0">${icon("alert")}<p>This account has been deactivated. Contact support if you believe this is an error.</p></div>`
          : ""
      }

      <div class="dashboard-grid mt-1">
        <div class="dashboard-main">
          <section class="welcome-card">
            <span class="day-chip">Day ${journey.currentDay} of 30 · ${escapeHtml(stageForDay(journey.currentDay).name)}</span>
            <h2>${currentPrompt ? escapeHtml(currentPrompt.question) : "Your next prompt is being prepared."}</h2>
            <p>${currentPrompt ? escapeHtml(currentPrompt.introduction) : "You can still return to every earlier reflection while the current prompt is unavailable."}</p>
            <div class="button-row">
              ${currentPrompt ? `<a class="btn btn--blue" href="#/reflection/${currentPrompt.dayNumber}">Open today’s reflection ${icon("arrowRight")}</a>` : ""}
              <a class="btn btn--secondary" href="#/how-it-works">View the five stages</a>
            </div>
          </section>

          <div class="stat-grid">
            <article class="card stat-card"><span class="stat-card__label">Current day</span><strong class="stat-card__value">${journey.currentDay}</strong><span class="stat-card__hint">Started ${formatShortDate(profile.challengeStartDate)}</span></article>
            <article class="card stat-card"><span class="stat-card__label">Completed</span><strong class="stat-card__value">${completedCount}</strong><span class="stat-card__hint">Reflections marked complete</span></article>
            <article class="card stat-card"><span class="stat-card__label">Remaining</span><strong class="stat-card__value">${remaining}</strong><span class="stat-card__hint">No deadline and no reset</span></article>
          </div>

          <section class="card progress-card">
            <div class="card-header">
              <div><h2>Your 30 days</h2><p>Completed, available and future days are labelled as well as colour-coded.</p></div>
              <span class="status-chip status-chip--current">${Math.round((completedCount / 30) * 100)}% complete</span>
            </div>
            <div class="progress-bar" aria-label="Overall progress: ${completedCount} of 30 reflections completed"><span style="width:${(completedCount / 30) * 100}%"></span></div>
            <div class="day-grid">${cells}</div>
            <div class="legend">
              <span class="legend-item"><span class="legend-dot legend-dot--completed"></span> Completed</span>
              <span class="legend-item"><span class="legend-dot legend-dot--current"></span> Current day</span>
              <span class="legend-item"><span class="legend-dot"></span> Available</span>
              <span class="legend-item"><span class="legend-dot legend-dot--locked"></span> Locked</span>
            </div>
          </section>
        </div>

        <aside class="dashboard-side">
          <section class="card today-card">
            <span class="day-chip">Today’s invitation</span>
            <h3>${currentPrompt ? escapeHtml(currentPrompt.title) : "Pause and revisit"}</h3>
            <p>${currentPrompt ? escapeHtml(currentPrompt.followUp || currentPrompt.question) : "An earlier answer may look different when you return to it."}</p>
            ${currentPrompt ? `<a class="btn btn--primary btn--block" href="#/reflection/${currentPrompt.dayNumber}">Write today ${icon("arrowRight")}</a>` : ""}
          </section>

          <section class="card card--padded">
            <div class="card-header"><div><h3>Stage progress</h3><p>Six prompts in each stage.</p></div></div>
            <div class="stage-progress">${stageRows}</div>
          </section>

          <section class="card card--padded">
            <span class="icon-tile">${icon("shield")}</span>
            <h3>Saved on this device</h3>
            <p class="muted">Your journal stays in this browser unless you deliberately enable cloud sync. Export a backup from Settings.</p>
            <a class="btn btn--secondary btn--block" href="#/settings">Review storage settings</a>
          </section>

        </aside>
      </div>
    </div>
  </section>`;
}

export function bindJourney() {
  // The journey dashboard has no page-specific controls to bind.
}

export function renderLockedReflection({ journey, day }) {
  setDocumentTitle(`Day ${day}`);
  const daysUntil = daysUntilChallengeDay({
    startDate: journey.profile.challengeStartDate,
    day,
    timezone: journey.profile.timezone
  });
  return `<section class="app-page"><div class="container"><div class="error-page">
    <span class="icon-tile">${icon("lock")}</span>
    <h1 style="font-size:clamp(2.4rem,6vw,4rem)">Day ${day} is still locked.</h1>
    <p>${daysUntil > 0 ? `This prompt becomes available in ${daysUntil} calendar day${daysUntil === 1 ? "" : "s"}, based on your saved challenge timezone.` : "This prompt has not been published yet."}</p>
    <a class="btn btn--primary" href="#/journey">Return to My Journey</a>
  </div></div></section>`;
}

export function renderReflection({ journey, prompt, reflection, recoveredDraft }) {
  setDocumentTitle(`Day ${prompt.dayNumber}: ${prompt.title}`);
  const stage = stageForDay(prompt.dayNumber);
  const text = recoveredDraft?.response ?? reflection?.response ?? "";
  const completed = recoveredDraft?.completed ?? reflection?.completed ?? false;
  const previous = prompt.dayNumber > 1 && journey.availablePrompts.some((item) => item.dayNumber === prompt.dayNumber - 1);
  const next = prompt.dayNumber < journey.currentDay && journey.availablePrompts.some((item) => item.dayNumber === prompt.dayNumber + 1);
  return `<section class="app-page">
    <div class="container">
      <div class="breadcrumbs"><a href="#/journey">My Journey</a><span>/</span><span>Day ${prompt.dayNumber}</span></div>
      ${
        recoveredDraft
          ? `<div class="notice notice--warning mb-0" data-recovery-notice>${icon("alert")}<p>A newer emergency draft was recovered from this browser. It will be saved to your journal when you continue writing or press Save now.</p></div>`
          : ""
      }
      <div class="reflection-layout mt-1">
        <aside class="prompt-panel">
          <span class="day-chip">Day ${prompt.dayNumber} · Stage ${stage.number}</span>
          <h1>${escapeHtml(prompt.title)}</h1>
          <p>${escapeHtml(prompt.introduction)}</p>
          <div class="prompt-question">${escapeHtml(prompt.question)}</div>
          ${prompt.followUp ? `<div class="prompt-followup"><strong>Consider:</strong> ${escapeHtml(prompt.followUp)}</div>` : ""}
        </aside>

        <section class="card reflection-editor">
          <div class="editor-header">
            <div><h2 style="font-size:1.5rem;margin:0">Your reflection</h2><span class="muted">Write freely. You do not need perfect words or a perfect answer.</span></div>
            <span class="save-status" data-save-status>${icon("save")} Ready</span>
          </div>
          <label class="sr-only" for="reflection-response">Reflection response for Day ${prompt.dayNumber}</label>
          <textarea id="reflection-response" class="reflection-textarea" data-reflection-response placeholder="This space is yours…">${escapeHtml(text)}</textarea>
          <div class="sensitive-note">${icon("shield")}<p><strong>Your space, your words.</strong> Avoid passwords, financial details, identification numbers, medical records and other highly sensitive information. Local storage is not an encrypted private vault.</p></div>
          <div class="editor-footer">
            <div><span class="word-count" data-word-count>${wordCount(text)} words</span><br><span class="muted" style="font-size:.72rem">Autosaves after you pause typing.</span></div>
            <div class="button-row">
              <label class="completed-toggle"><input type="checkbox" data-completed ${completed ? "checked" : ""}> Mark this reflection complete</label>
              <button class="btn btn--primary" type="button" data-save-now>${icon("save")} Save now</button>
            </div>
          </div>
          <div class="reflection-nav">
            ${previous ? `<a class="btn btn--secondary" href="#/reflection/${prompt.dayNumber - 1}">${icon("arrowLeft")} Previous day</a>` : '<span></span>'}
            ${next ? `<a class="btn btn--secondary" href="#/reflection/${prompt.dayNumber + 1}">Next day ${icon("arrowRight")}</a>` : `<a class="btn btn--secondary" href="#/journey">Back to journey ${icon("arrowRight")}</a>`}
          </div>
        </section>
      </div>
    </div>
  </section>`;
}

export function bindReflection({ session, journey, prompt, reflection, recoveredDraft, onSaved }) {
  const textarea = document.querySelector("[data-reflection-response]");
  const completedInput = document.querySelector("[data-completed]");
  const status = document.querySelector("[data-save-status]");
  const wordCounter = document.querySelector("[data-word-count]");
  const saveButton = document.querySelector("[data-save-now]");
  let destroyed = false;
  let lastSavedValue = recoveredDraft?.response ?? reflection?.response ?? "";
  let lastSavedCompleted = recoveredDraft?.completed ?? reflection?.completed ?? false;

  const setStatus = (type, text) => {
    if (!status || destroyed) return;
    status.className = `save-status ${type ? `save-status--${type}` : ""}`;
    status.innerHTML = `${type === "saving" ? '<span class="spinner"></span>' : icon(type === "saved" ? "checkCircle" : type === "error" ? "alert" : "save")} ${escapeHtml(text)}`;
    announce(text);
  };

  const doSave = async ({ quiet = false } = {}) => {
    if (destroyed) return null;
    const response = textarea.value;
    const completed = completedInput.checked;
    if (response === lastSavedValue && completed === lastSavedCompleted && !recoveredDraft) {
      if (!quiet) setStatus("saved", "Already saved");
      return reflection;
    }
    setStatus("saving", "Saving…");
    saveButton.disabled = true;
    const record = {
      userId: session.user.id,
      challengeSlug: config.challengeSlug,
      dayNumber: prompt.dayNumber,
      promptId: prompt.id,
      promptVersionId: prompt.versionId,
      promptVersion: prompt.version,
      stageId: prompt.stageId,
      promptTitle: prompt.title,
      promptQuestion: prompt.question,
      promptIntroduction: prompt.introduction,
      promptFollowUp: prompt.followUp,
      response,
      completed,
      updatedAt: new Date().toISOString()
    };
    try {
      const saved = await saveReflection(record);
      lastSavedValue = response;
      lastSavedCompleted = completed;
      clearEmergencyDraft(session.user.id, config.challengeSlug, prompt.dayNumber);
      document.querySelector("[data-recovery-notice]")?.remove();
      let cloudMessage = "Saved on this device";
      if (journey.profile.cloudSyncEnabled && config.enableCloudSync) {
        try {
          await saveCloudReflection(saved);
          cloudMessage = "Saved on this device and synced";
        } catch (cloudError) {
          cloudMessage = "Saved locally · sync pending";
          showToast(cloudError.message, "error");
        }
      }
      setStatus("saved", cloudMessage);
      recordEvent("reflection_saved", { dayNumber: prompt.dayNumber, completed }).catch(() => undefined);
      onSaved?.(saved);
      return saved;
    } catch (error) {
      setStatus("error", "Could not save");
      showToast(`${error.message} Your emergency draft is still in this browser.`, "error", 7000);
      throw error;
    } finally {
      saveButton.disabled = false;
    }
  };

  const debouncedSave = debounce(() => doSave({ quiet: true }).catch(() => undefined), 800);
  const handleInput = () => {
    wordCounter.textContent = `${wordCount(textarea.value)} words`;
    saveEmergencyDraft(session.user.id, config.challengeSlug, prompt.dayNumber, {
      response: textarea.value,
      completed: completedInput.checked
    });
    setStatus("saving", "Changes waiting to save…");
    debouncedSave();
  };
  textarea.addEventListener("input", handleInput);
  completedInput.addEventListener("change", handleInput);
  saveButton.addEventListener("click", () => {
    debouncedSave.cancel();
    doSave().then(() => showToast("Reflection saved.", "success")).catch(() => undefined);
  });

  const beforeUnload = () => {
    if (textarea.value !== lastSavedValue || completedInput.checked !== lastSavedCompleted) {
      saveEmergencyDraft(session.user.id, config.challengeSlug, prompt.dayNumber, {
        response: textarea.value,
        completed: completedInput.checked
      });
    }
  };
  window.addEventListener("beforeunload", beforeUnload);

  return () => {
    destroyed = true;
    debouncedSave.cancel();
    beforeUnload();
    window.removeEventListener("beforeunload", beforeUnload);
  };
}

function reflectionListItem(prompt, reflection) {
  const stage = stageForDay(prompt.dayNumber);
  const response = reflection?.response?.trim() || "No response written yet.";
  const status = reflection?.completed
    ? '<span class="status-chip status-chip--success">Completed</span>'
    : reflection?.response
      ? '<span class="status-chip status-chip--warning">In progress</span>'
      : '<span class="status-chip status-chip--neutral">Not started</span>';
  const search = `${prompt.title} ${prompt.question} ${response} ${stage.name}`.toLowerCase();
  return `<article class="reflection-item" data-reflection-item data-stage="${stage.id}" data-search="${escapeHtml(search)}">
    <span class="reflection-item__day"><span>${prompt.dayNumber}</span><small>Day</small></span>
    <div><div class="button-row" style="gap:.55rem;margin-bottom:.25rem">${status}<span class="tag">${escapeHtml(stage.name)}</span></div><h3>${escapeHtml(prompt.question)}</h3><p>${escapeHtml(response)}</p></div>
    <a class="btn btn--secondary btn--small" href="#/reflection/${prompt.dayNumber}">${icon("edit")} ${reflection?.response ? "Review" : "Write"}</a>
  </article>`;
}

export function renderReflections({ journey, reflections }) {
  setDocumentTitle("My Reflections");
  const byDay = reflectionMap(reflections);
  const prompts = [...journey.availablePrompts].sort((a, b) => a.dayNumber - b.dayNumber);
  const completed = reflections.filter((item) => item.completed).length;
  return `<section class="app-page"><div class="container">
    <div class="app-header">
      <div><span class="eyebrow">My Reflections</span><h1>Your journal so far.</h1><p>Return to any available day. Editing an answer does not change its original prompt version.</p></div>
      <button class="btn btn--primary" type="button" data-export-pdf>${icon("download")} Export PDF</button>
    </div>
    <div class="notice mb-0">${icon("shield")}<p>These entries are read from this browser. ${completed} of ${prompts.length} available reflections are marked complete.</p></div>
    <div class="filter-bar mt-2">
      <div class="search-field">${icon("search")}<label class="sr-only" for="reflection-search">Search reflections</label><input id="reflection-search" type="search" placeholder="Search prompts or your writing" data-reflection-search></div>
      <label class="sr-only" for="stage-filter">Filter by stage</label>
      <select id="stage-filter" data-stage-filter style="width:auto;min-width:190px"><option value="all">All stages</option>${STAGES.map((stage) => `<option value="${stage.id}">${escapeHtml(stage.name)}</option>`).join("")}</select>
    </div>
    <div class="reflection-list" data-reflection-list>
      ${prompts.length ? prompts.map((prompt) => reflectionListItem(prompt, byDay.get(prompt.dayNumber))).join("") : '<div class="empty-state"><h2>No prompts are available yet.</h2></div>'}
    </div>
    <div class="empty-state hide" data-filter-empty><span class="icon-tile">${icon("search")}</span><h2>No matching reflection</h2><p>Try a different search term or stage.</p></div>
  </div></section>`;
}

export function bindReflections({ session, journey, reflections, finalReflections }) {
  const search = document.querySelector("[data-reflection-search]");
  const stage = document.querySelector("[data-stage-filter]");
  const items = [...document.querySelectorAll("[data-reflection-item]")];
  const empty = document.querySelector("[data-filter-empty]");
  const filter = () => {
    const query = search.value.trim().toLowerCase();
    const selectedStage = stage.value;
    let visible = 0;
    items.forEach((item) => {
      const matchText = !query || item.dataset.search.includes(query);
      const matchStage = selectedStage === "all" || item.dataset.stage === selectedStage;
      const show = matchText && matchStage;
      item.classList.toggle("hide", !show);
      if (show) visible += 1;
    });
    empty.classList.toggle("hide", visible > 0);
  };
  search?.addEventListener("input", filter);
  stage?.addEventListener("change", filter);
  document.querySelector("[data-export-pdf]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Building PDF…';
    try {
      const result = await exportReflectionsPdf({
        profile: journey.profile,
        prompts: journey.availablePrompts,
        reflections,
        finalReflections: finalReflections?.answers || finalReflections || {}
      });
      showToast(`PDF downloaded with ${result.pageCount} pages.`, "success");
      recordEvent("pdf_exported", { pageCount: result.pageCount }).catch(() => undefined);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  });
}

export function renderCompletionLocked({ journey }) {
  setDocumentTitle("Completion");
  const unlockDate = dateForChallengeDay(journey.profile.challengeStartDate, 30);
  return `<section class="app-page"><div class="container"><div class="error-page">
    <span class="icon-tile">${icon("sparkles")}</span>
    <h1 style="font-size:clamp(2.4rem,6vw,4rem)">Your closing page is still ahead.</h1>
    <p>It opens on Day 30 — ${formatDate(unlockDate)} in your saved challenge timezone. You can continue reflecting without needing every earlier day to be complete.</p>
    <a class="btn btn--primary" href="#/journey">Return to My Journey</a>
  </div></div></section>`;
}

export function renderCompletion({ journey, reflections, finalReflections }) {
  setDocumentTitle("Completion");
  const completedCount = reflections.filter((item) => item.completed).length;
  const answers = finalReflections?.answers || {};
  const stageCards = STAGES.map((stage) => {
    const progress = stageProgress(stage, reflections);
    return `<article class="card card--padded"><span class="day-chip">Stage ${stage.number}</span><h3 class="mt-1">${escapeHtml(stage.name)}</h3><p class="muted">${escapeHtml(stage.description)}</p><strong>${progress.completed} of 6 marked complete</strong></article>`;
  }).join("");
  return `<section class="app-page"><div class="container">
    <section class="completion-hero">
      <div class="completion-ring"><span>${completedCount}/30</span></div>
      <span class="eyebrow" style="color:#C4AB79">Your closing chapter</span>
      <h1>30 days. A little more understanding. A new chapter ahead.</h1>
      <p>You reached Day 30. Completion here is not about having every answer; it is about recognising what you noticed and choosing what deserves to travel with you.</p>
      <div class="button-row"><button class="btn btn--blue" type="button" data-completion-export>${icon("download")} Export complete journal</button><a class="btn btn--secondary" href="#/reflections">Review all reflections</a></div>
    </section>

    <section class="section section--compact">
      <div class="section-heading"><span class="eyebrow">The path you travelled</span><h2>Five stages of your journey.</h2></div>
      <div class="grid-3">${stageCards}</div>
    </section>

    <section class="section section--compact">
      <div class="section-heading"><span class="eyebrow">Final reflection</span><h2>What would you like to carry forward?</h2><p class="lede">These answers autosave on this device, just like your daily reflections.</p></div>
      <div class="final-questions">
        ${FINAL_QUESTIONS.map((item, index) => `<div class="card final-question"><label for="final-${item.id}">${index + 1}. ${escapeHtml(item.question)}</label><textarea id="final-${item.id}" data-final-answer="${item.id}" placeholder="Write freely…">${escapeHtml(answers[item.id] || "")}</textarea></div>`).join("")}
      </div>
      <div class="editor-footer"><span class="save-status" data-final-status>${icon("save")} Ready</span><button class="btn btn--primary" type="button" data-save-final>${icon("save")} Save closing reflections</button></div>
    </section>
  </div></section>`;
}

export function bindCompletion({ session, journey, reflections, finalReflections }) {
  const textareas = [...document.querySelectorAll("[data-final-answer]")];
  const status = document.querySelector("[data-final-status]");
  const saveButton = document.querySelector("[data-save-final]");
  let destroyed = false;
  const collect = () => Object.fromEntries(textareas.map((textarea) => [textarea.dataset.finalAnswer, textarea.value]));
  const setStatus = (type, text) => {
    if (!status || destroyed) return;
    status.className = `save-status save-status--${type}`;
    status.innerHTML = `${type === "saving" ? '<span class="spinner"></span>' : icon(type === "saved" ? "checkCircle" : "alert")} ${escapeHtml(text)}`;
  };
  const save = async () => {
    setStatus("saving", "Saving…");
    saveButton.disabled = true;
    try {
      await saveFinalReflections(session.user.id, config.challengeSlug, collect());
      setStatus("saved", "Saved on this device");
      recordEvent("closing_reflections_saved").catch(() => undefined);
    } catch (error) {
      setStatus("error", "Could not save");
      showToast(error.message, "error");
    } finally {
      saveButton.disabled = false;
    }
  };
  const debounced = debounce(save, 900);
  textareas.forEach((textarea) => textarea.addEventListener("input", () => {
    setStatus("saving", "Changes waiting to save…");
    debounced();
  }));
  saveButton.addEventListener("click", () => {
    debounced.cancel();
    save().then(() => showToast("Closing reflections saved.", "success"));
  });
  document.querySelector("[data-completion-export]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Building PDF…';
    try {
      await save();
      const result = await exportReflectionsPdf({
        profile: journey.profile,
        prompts: journey.availablePrompts,
        reflections,
        finalReflections: collect()
      });
      showToast(`Complete journal downloaded with ${result.pageCount} pages.`, "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  });
  return () => {
    destroyed = true;
    debounced.cancel();
  };
}

export function renderSettings({ session, journey, reflections }) {
  setDocumentTitle("Settings");
  const profile = journey.profile || session.profile;
  const cloudAvailable = config.enableCloudSync && config.mode === "supabase";
  const reminderAvailable = config.enableReminders && config.mode === "supabase";
  return `<section class="app-page"><div class="container">
    <div class="app-header"><div><span class="eyebrow">Settings</span><h1>Your account and journal.</h1><p>Control local data, optional sync and exports without exposing your writing to the administrator dashboard.</p></div></div>
    <div class="settings-layout">
      <nav class="card side-nav" aria-label="Settings sections"><button type="button" data-scroll-section="profile" aria-controls="profile" aria-current="page">${icon("user")} Profile</button><button type="button" data-scroll-section="storage" aria-controls="storage">${icon("shield")} Storage</button><button type="button" data-scroll-section="exports" aria-controls="exports">${icon("download")} Exports</button><button type="button" data-scroll-section="account" aria-controls="account">${icon("settings")} Account</button></nav>
      <div>
        <section class="card settings-section" id="profile">
          <div class="card-header"><div><h2>Profile settings</h2><p>Your timezone determines when each calendar day unlocks.</p></div></div>
          <form data-profile-settings>
            <div class="form-grid">
              <div class="form-group"><label for="profile-name">Name</label><input id="profile-name" value="${escapeHtml(profile.fullName)}" disabled><span class="form-hint">Provided by your sign-in account.</span></div>
              <div class="form-group"><label for="profile-email">Email</label><input id="profile-email" value="${escapeHtml(profile.email)}" disabled></div>
              <div class="form-group form-group--full"><label for="profile-timezone">Challenge timezone</label><input id="profile-timezone" name="timezone" value="${escapeHtml(profile.timezone)}" readonly required><span class="form-hint">Your challenge timezone was fixed when Day 1 began, so daily prompts cannot be unlocked early by changing zones. Reminder time still follows this saved timezone.</span></div>
            </div>
            <button class="btn btn--primary mt-1" type="submit">Save profile settings</button>
          </form>
        </section>

        <section class="card settings-section mt-1" id="storage">
          <div class="card-header"><div><h2>Journal storage</h2><p>${reflections.length} reflection record${reflections.length === 1 ? "" : "s"} currently stored on this device.</p></div></div>
          <div class="settings-row"><div><h3>Local browser storage</h3><p>IndexedDB keeps your writing on this browser. It is not an encrypted vault and does not automatically follow your Google account to another device.</p></div><span class="status-chip status-chip--success">Active</span></div>
          <div class="settings-row"><div><h3>Optional cloud sync</h3><p>${cloudAvailable ? "Copies your journal into owner-only database rows so it can be restored on another signed-in device. Turning this on is your choice." : "Cloud sync is not enabled for this deployment. Your local journal and downloadable backups remain available."}</p></div><label class="switch"><input type="checkbox" data-cloud-sync ${profile.cloudSyncEnabled ? "checked" : ""} ${cloudAvailable ? "" : "disabled"}><span aria-hidden="true"></span><span class="sr-only">Enable cloud sync</span></label></div>
          ${cloudAvailable ? `<div class="settings-row"><div><h3>Delete cloud journal copies</h3><p>Permanently removes this account’s synced reflection rows. Your local browser journal is kept unless you clear it separately.</p></div><button class="btn btn--danger btn--small" type="button" data-delete-cloud>${icon("trash")} Delete cloud copies</button></div>` : ""}
          <div class="settings-row"><div><h3>Daily reminder preference</h3><p>${reminderAvailable ? "Stores your preferred reminder time. Delivery requires the configured reminder edge function and email provider." : "Reminders are disabled in this deployment."}</p></div><div style="display:flex;align-items:center;gap:.6rem"><input type="time" value="${escapeHtml(profile.reminderTime || "19:00")}" data-reminder-time ${reminderAvailable ? "" : "disabled"} style="width:120px"><label class="switch"><input type="checkbox" data-reminder-enabled ${profile.reminderEnabled ? "checked" : ""} ${reminderAvailable ? "" : "disabled"}><span aria-hidden="true"></span><span class="sr-only">Enable daily reminders</span></label></div></div>
        </section>

        <section class="card settings-section mt-1" id="exports">
          <div class="card-header"><div><h2>Export and restore</h2><p>Keep a readable journal and a machine-readable backup.</p></div></div>
          <div class="settings-row"><div><h3>Reflection journal PDF</h3><p>A formatted document containing every available prompt, your responses and closing reflections.</p></div><button class="btn btn--secondary btn--small" type="button" data-settings-pdf>${icon("download")} Download PDF</button></div>
          <div class="settings-row"><div><h3>JSON backup</h3><p>Use this file to restore local entries later. It contains your journal text, so store it privately.</p></div><button class="btn btn--secondary btn--small" type="button" data-export-backup>${icon("download")} Download backup</button></div>
          <div class="settings-row"><div><h3>Restore a backup</h3><p>Imports entries for this signed-in account. Newer records are kept unless you explicitly overwrite them.</p></div><div><input class="sr-only" type="file" accept="application/json,.json" data-import-file><button class="btn btn--secondary btn--small" type="button" data-import-backup>${icon("upload")} Choose backup</button></div></div>
        </section>

        <section class="card settings-section mt-1" id="account">
          <div class="card-header"><div><h2>Account and device</h2><p>Irreversible actions are separated from everyday settings.</p></div></div>
          <div class="settings-row"><div><h3>Remove local journal from this device</h3><p>Deletes daily and closing reflections stored in this browser. This does not delete a previously downloaded backup or optional cloud copy.</p></div><button class="btn btn--danger btn--small" type="button" data-clear-local>${icon("trash")} Clear local data</button></div>
          <div class="settings-row"><div><h3>Participant guide</h3><p>Review storage, sensitive-information and professional-support guidance at any time.</p></div><button class="btn btn--secondary btn--small" type="button" data-open-guide>${icon("info")} Open guide</button></div>
          <div class="settings-row"><div><h3>Challenge information</h3><p>Started ${formatDate(profile.challengeStartDate)} · Account status: ${escapeHtml(profile.status)} · Sign-in provider: ${escapeHtml(session.provider)}</p></div><span class="status-chip status-chip--neutral">${escapeHtml(config.challengeSlug)}</span></div>
        </section>
      </div>
    </div>
  </div></section>`;
}

async function syncCloudAndLocal(session, localReflections) {
  const remote = await getCloudReflections();
  const byDay = new Map();
  [...localReflections, ...remote].forEach((record) => {
    const day = Number(record.dayNumber);
    const existing = byDay.get(day);
    if (!existing || new Date(record.updatedAt || 0) > new Date(existing.updatedAt || 0)) byDay.set(day, record);
  });
  const merged = [...byDay.values()].map((record) => ({
    ...record,
    userId: session.user.id,
    challengeSlug: config.challengeSlug
  }));
  await saveManyReflections(merged);
  for (const record of merged) await saveCloudReflection(record);
  return merged;
}

export function bindSettings({ session, journey, reflections, finalReflections, refresh }) {
  const profileForm = document.querySelector("[data-profile-settings]");
  const cloudInput = document.querySelector("[data-cloud-sync]");
  const reminderEnabled = document.querySelector("[data-reminder-enabled]");
  const reminderTime = document.querySelector("[data-reminder-time]");
  document.querySelector("[data-open-guide]")?.addEventListener("click", () => openParticipantGuide());

  document.querySelectorAll("[data-scroll-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.scrollSection);
      if (!target) return;
      document.querySelectorAll("[data-scroll-section]").forEach((item) => item.removeAttribute("aria-current"));
      button.setAttribute("aria-current", "page");
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    });
  });

  const savePreferences = async (extra = {}) => {
    const timezone = profileForm.querySelector('[name="timezone"]').value.trim();
    return updateProfileSettings({
      timezone,
      cloudSyncEnabled: cloudInput?.checked || false,
      reminderEnabled: reminderEnabled?.checked || false,
      reminderTime: reminderTime?.value || "19:00",
      ...extra
    });
  };

  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = profileForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await savePreferences();
      showToast("Profile settings saved.", "success");
      await refresh();
    } catch (error) {
      showToast(error.message, "error");
      button.disabled = false;
    }
  });

  cloudInput?.addEventListener("change", async () => {
    cloudInput.disabled = true;
    try {
      await savePreferences({ cloudSyncEnabled: cloudInput.checked });
      if (cloudInput.checked) {
        const merged = await syncCloudAndLocal(session, reflections);
        showToast(`Cloud sync enabled. ${merged.length} reflection${merged.length === 1 ? "" : "s"} reconciled.`, "success", 7000);
      } else {
        showToast("Cloud sync disabled. Existing cloud copies are not automatically deleted.", "info", 7000);
      }
      await refresh();
    } catch (error) {
      cloudInput.checked = !cloudInput.checked;
      cloudInput.disabled = false;
      showToast(error.message, "error", 7000);
    }
  });

  const saveReminder = debounce(async () => {
    try {
      await savePreferences();
      showToast("Reminder preference saved.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }, 500);
  reminderEnabled?.addEventListener("change", saveReminder);
  reminderTime?.addEventListener("change", saveReminder);

  document.querySelector("[data-settings-pdf]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Building…';
    try {
      const result = await exportReflectionsPdf({
        profile: journey.profile,
        prompts: journey.availablePrompts,
        reflections,
        finalReflections: finalReflections?.answers || {}
      });
      showToast(`PDF downloaded with ${result.pageCount} pages.`, "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  });

  document.querySelector("[data-export-backup]")?.addEventListener("click", async () => {
    try {
      const backup = await buildBackup(session.user.id, config.challengeSlug, journey.profile);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      downloadBlob(blob, `curiousstride-backup-${new Date().toISOString().slice(0, 10)}.json`);
      showToast("Backup downloaded. Keep it somewhere private.", "success");
      recordEvent("backup_exported").catch(() => undefined);
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  const fileInput = document.querySelector("[data-import-file]");
  document.querySelector("[data-import-backup]")?.addEventListener("click", () => fileInput.click());
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error("That backup is too large to import safely.");
      const backup = JSON.parse(await file.text());
      const count = await restoreBackup(backup, session.user.id, config.challengeSlug);
      showToast(
        count
          ? `${count} newer reflection record${count === 1 ? "" : "s"} restored.`
          : "No newer daily reflections needed to be restored.",
        "success",
        6500
      );
      await refresh();
    } catch (error) {
      showToast(error.message, "error", 7000);
    } finally {
      fileInput.value = "";
    }
  });

  document.querySelector("[data-clear-local]")?.addEventListener("click", () => {
    openModal({
      title: "Remove this local journal?",
      content: `<p>This permanently deletes daily and closing reflections stored in this browser for the current account.</p><div class="notice notice--danger">${icon("alert")}<p>This cannot be undone without a backup.</p></div><div class="button-row mt-2"><button class="btn btn--secondary" type="button" data-close-modal>Cancel</button><button class="btn btn--danger" type="button" data-confirm-clear>${icon("trash")} Delete local journal</button></div>`,
      onOpen: (modal) => {
        modal.querySelector("[data-confirm-clear]")?.addEventListener("click", async () => {
          const confirmButton = modal.querySelector("[data-confirm-clear]");
          confirmButton.disabled = true;
          try {
            await clearUserData(session.user.id, config.challengeSlug);
            closeModal();
            showToast("Local reflection data removed from this device.", "success");
            await refresh();
          } catch (error) {
            showToast(error.message, "error");
            confirmButton.disabled = false;
          }
        });
      }
    });
  });

  document.querySelector("[data-delete-cloud]")?.addEventListener("click", () => {
    openModal({
      title: "Delete cloud journal copies?",
      content: `<p>This permanently removes synced daily reflections from the CuriousStride database for the current account. Local entries on this browser are not changed.</p><div class="notice notice--danger">${icon("alert")}<p>This cannot be undone unless another private backup exists.</p></div><div class="button-row mt-2"><button class="btn btn--secondary" type="button" data-close-modal>Cancel</button><button class="btn btn--danger" type="button" data-confirm-cloud-delete>${icon("trash")} Delete cloud copies</button></div>`,
      onOpen: (modal) => {
        modal.querySelector("[data-confirm-cloud-delete]")?.addEventListener("click", async () => {
          const confirmButton = modal.querySelector("[data-confirm-cloud-delete]");
          confirmButton.disabled = true;
          try {
            const count = await deleteCloudReflections();
            await updateProfileSettings({
              timezone: journey.profile.timezone,
              cloudSyncEnabled: false,
              reminderEnabled: journey.profile.reminderEnabled,
              reminderTime: journey.profile.reminderTime
            });
            closeModal();
            showToast(`${count} cloud reflection cop${count === 1 ? "y" : "ies"} deleted.`, "success", 6500);
            await refresh();
          } catch (error) {
            showToast(error.message, "error", 7000);
            confirmButton.disabled = false;
          }
        });
      }
    });
  });



  return () => saveReminder.cancel();
}

export async function loadParticipantData(session, journey) {
  const [reflections, finalReflections] = await Promise.all([
    getAllReflections(session.user.id, config.challengeSlug),
    getFinalReflections(session.user.id, config.challengeSlug)
  ]);
  return { reflections, finalReflections };
}

export function getRecoveredDraft(session, prompt, reflection) {
  const draft = readEmergencyDraft(session.user.id, config.challengeSlug, prompt.dayNumber);
  if (!draft) return null;
  const draftDate = new Date(draft.updatedAt || 0);
  const savedDate = new Date(reflection?.updatedAt || 0);
  return draftDate > savedDate ? draft : null;
}
