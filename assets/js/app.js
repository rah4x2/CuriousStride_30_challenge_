import {
  checkAdmin,
  config,
  getAdminAnalytics,
  getAdminOverview,
  getAdminParticipants,
  getAdminPrompts,
  getJourney,
  getPublicContent,
  getSession,
  initializeBackend,
  onAuthChange,
  signOut
} from "./services/backend.js";
import { getReflection } from "./services/storage.js";
import { state, setState } from "./state.js";
import { bindShellEvents, renderShell } from "./components/layout.js";
import { showToast } from "./components/toast.js";
import { icon } from "./utils/icons.js";
import { escapeHtml, setDocumentTitle } from "./utils/dom.js";
import { navigate, parseHash } from "./utils/router.js";
import {
  bindLogin,
  renderAbout,
  renderHome,
  renderHowItWorks,
  renderLogin,
  renderPrivacy
} from "./views/public.js";
import {
  bindCompletion,
  bindJourney,
  bindOnboarding,
  bindReflection,
  bindReflections,
  bindSettings,
  getRecoveredDraft,
  loadParticipantData,
  renderCompletion,
  renderCompletionLocked,
  renderJourney,
  renderOnboarding,
  renderLockedReflection,
  renderReflection,
  renderReflections,
  renderSettings
} from "./views/participant.js";
import {
  bindAdminContent,
  bindAdminParticipants,
  bindAdminPrompts,
  renderAdminAnalytics,
  renderAdminContent,
  renderAdminOverview,
  renderAdminParticipants,
  renderAdminPrompts
} from "./views/admin.js";

const app = document.getElementById("app");
const skipLink = document.querySelector(".skip-link");

skipLink?.addEventListener("click", (event) => {
  event.preventDefault();
  const main = document.getElementById("main-content");
  if (!main) return;
  main.scrollIntoView({ block: "start" });
  main.focus({ preventScroll: true });
});
let cleanupCurrentView = null;
let renderSequence = 0;
let authUnsubscribe = null;

function loadingMarkup(message = "Opening CuriousStride…") {
  return `<section class="app-page"><div class="container"><div class="boot-screen" style="min-height:55vh"><div class="brand-mark brand-mark--large" aria-hidden="true"><span></span></div><p>${escapeHtml(message)}</p></div></div></section>`;
}

function errorMarkup(title, message, { showSetup = false, home = true } = {}) {
  setDocumentTitle("Something went wrong");
  return `<section class="app-page"><div class="container"><div class="error-page">
    <span class="icon-tile">${icon("alert")}</span>
    <h1 style="font-size:clamp(2.4rem,6vw,4rem)">${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <div class="button-row">
      <button class="btn btn--primary" type="button" data-retry>${icon("refresh")} Try again</button>
      ${home ? '<a class="btn btn--secondary" href="#/home">Return home</a>' : ""}
      ${showSetup ? '<a class="btn btn--secondary" href="/docs/SUPABASE_SETUP.md" target="_blank" rel="noreferrer">Open setup guide</a>' : ""}
    </div>
  </div></div></section>`;
}

function mount(main, { hideFooter = false, skipFocus = false } = {}) {
  cleanupCurrentView?.();
  cleanupCurrentView = null;
  app.innerHTML = renderShell({
    session: state.session,
    main,
    supportEmail: config.supportEmail,
    hideFooter
  });
  bindShellEvents({
    onSignOut: async () => {
      const button = document.querySelector("[data-sign-out]");
      if (button) button.disabled = true;
      try {
        await signOut();
        setState({ session: null, journey: null });
        showToast("Signed out. Local journal entries remain on this device until you remove them.", "info", 6500);
        navigate("/home");
      } catch (error) {
        showToast(error.message, "error");
        if (button) button.disabled = false;
      }
    }
  });
  document.querySelector("[data-retry]")?.addEventListener("click", () => renderRoute());
  if (!skipFocus) {
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => document.getElementById("main-content")?.focus({ preventScroll: true }));
  }
}

async function ensureSession() {
  if (state.session) return state.session;
  const session = await getSession();
  setState({ session });
  return session;
}

async function loadJourneyBundle() {
  const session = await ensureSession();
  if (!session) throw new Error("AUTH_REQUIRED");
  const journey = await getJourney();
  const participantData = await loadParticipantData(session, journey);
  setState({ journey });
  return { session, journey, ...participantData };
}

function requireAuth(route) {
  if (!state.session) {
    const next = encodeURIComponent(`#${route.path}`);
    navigate(`/login?next=${next}`, { replace: true });
    return false;
  }
  return true;
}

async function renderAdmin(route, token) {
  if (!requireAuth(route)) return;
  const isAdmin = state.session.isAdmin || (await checkAdmin());
  if (token !== renderSequence) return;
  if (!isAdmin) {
    mount(
      errorMarkup(
        "Administrator access required.",
        "This signed-in account is not on the server-verified administrator list. Ordinary participant accounts cannot open this area."
      )
    );
    return;
  }
  if (!state.session.isAdmin) setState({ session: { ...state.session, isAdmin: true } });
  const tab = ["overview", "prompts", "content", "participants", "analytics"].includes(route.params[0])
    ? route.params[0]
    : "overview";
  mount(loadingMarkup("Loading the administrator dashboard…"), { skipFocus: true });
  try {
    if (tab === "overview") {
      const overview = await getAdminOverview();
      if (token !== renderSequence) return;
      mount(renderAdminOverview(overview));
      return;
    }
    if (tab === "prompts") {
      const prompts = await getAdminPrompts();
      const isCreating = route.query.new === "1";
      const selected = isCreating ? null : prompts.find((prompt) => prompt.id === route.query.prompt) || prompts[0] || null;
      if (token !== renderSequence) return;
      mount(renderAdminPrompts({ prompts, selectedPrompt: selected, isCreating }));
      bindAdminPrompts({ selectedPrompt: selected, refresh: () => renderRoute({ preserveScroll: true }) });
      return;
    }
    if (tab === "content") {
      const content = await getPublicContent();
      setState({ content });
      if (token !== renderSequence) return;
      mount(renderAdminContent(content));
      bindAdminContent({
        content,
        refresh: async () => {
          const refreshed = await getPublicContent();
          setState({ content: refreshed });
          return renderRoute({ preserveScroll: true });
        }
      });
      return;
    }
    if (tab === "participants") {
      const participants = await getAdminParticipants();
      if (token !== renderSequence) return;
      mount(renderAdminParticipants(participants));
      bindAdminParticipants({ refresh: () => renderRoute({ preserveScroll: true }) });
      return;
    }
    const analytics = await getAdminAnalytics();
    if (token !== renderSequence) return;
    mount(renderAdminAnalytics(analytics));
  } catch (error) {
    if (token !== renderSequence) return;
    mount(errorMarkup("The admin area could not be loaded.", error.message));
  }
}

async function renderParticipant(route, token) {
  if (!requireAuth(route)) return;
  mount(loadingMarkup("Opening your personal journey…"), { skipFocus: true });
  try {
    const bundle = await loadJourneyBundle();
    if (token !== renderSequence) return;
    const { session, journey, reflections, finalReflections } = bundle;

    const requiredOnboardingVersion = Number(config.onboardingVersion || 1);
    if (!journey.profile.onboardingCompletedAt || Number(journey.profile.onboardingVersion || 0) < requiredOnboardingVersion) {
      mount(renderOnboarding({ session, journey }), { hideFooter: true });
      bindOnboarding({
        session,
        journey,
        onComplete: async (profile) => {
          setState({ session: { ...state.session, profile }, journey: null });
          await renderRoute();
        }
      });
      return;
    }

    if (route.page === "journey") {
      mount(renderJourney({ session, journey, reflections }));
      bindJourney({ refresh: () => renderRoute({ preserveScroll: true }) });
      return;
    }

    if (route.page === "reflection") {
      const day = Number(route.params[0]);
      if (!Number.isInteger(day) || day < 1 || day > 30) {
        mount(errorMarkup("That reflection day does not exist.", "Choose a day from 1 to 30 in My Journey."));
        return;
      }
      const prompt = journey.availablePrompts.find((item) => Number(item.dayNumber) === day);
      if (!prompt || day > journey.currentDay) {
        mount(renderLockedReflection({ journey, day }));
        return;
      }
      const reflection = await getReflection(session.user.id, config.challengeSlug, day);
      const recoveredDraft = getRecoveredDraft(session, prompt, reflection);
      if (token !== renderSequence) return;
      mount(renderReflection({ journey, prompt, reflection, recoveredDraft }));
      cleanupCurrentView = bindReflection({
        session,
        journey,
        prompt,
        reflection,
        recoveredDraft,
        onSaved: () => undefined
      });
      return;
    }

    if (route.page === "reflections") {
      mount(renderReflections({ journey, reflections }));
      bindReflections({ session, journey, reflections, finalReflections });
      return;
    }

    if (route.page === "completion") {
      if (journey.currentDay < 30) {
        mount(renderCompletionLocked({ journey }));
        return;
      }
      mount(renderCompletion({ journey, reflections, finalReflections }));
      cleanupCurrentView = bindCompletion({ session, journey, reflections, finalReflections });
      return;
    }

    if (route.page === "settings") {
      mount(renderSettings({ session, journey, reflections }));
      cleanupCurrentView = bindSettings({
        session,
        journey,
        reflections,
        finalReflections,
        refresh: () => renderRoute({ preserveScroll: true })
      });
    }
  } catch (error) {
    if (token !== renderSequence) return;
    if (error.message === "AUTH_REQUIRED") {
      navigate("/login", { replace: true });
      return;
    }
    mount(errorMarkup("Your journey could not be opened.", error.message));
  }
}

export async function renderRoute({ preserveScroll = false } = {}) {
  const token = ++renderSequence;
  cleanupCurrentView?.();
  cleanupCurrentView = null;
  const route = parseHash();
  state.lastRoute = route.path;

  try {
    if (["journey", "reflection", "reflections", "completion", "settings"].includes(route.page)) {
      await renderParticipant(route, token);
      return;
    }
    if (route.page === "admin") {
      await renderAdmin(route, token);
      return;
    }

    if (route.page === "home") {
      mount(renderHome(state.content, state.session), { skipFocus: preserveScroll });
      return;
    }
    if (route.page === "about") {
      mount(renderAbout(state.content), { skipFocus: preserveScroll });
      return;
    }
    if (route.page === "how-it-works") {
      mount(renderHowItWorks(state.content, state.session), { skipFocus: preserveScroll });
      return;
    }
    if (route.page === "privacy") {
      mount(renderPrivacy(state.content), { skipFocus: preserveScroll });
      return;
    }
    if (route.page === "login") {
      if (state.session) {
        const requested = route.query.next ? decodeURIComponent(route.query.next).replace(/^#/, "") : "/journey";
        navigate(requested, { replace: true });
        return;
      }
      mount(renderLogin(state.content), { hideFooter: true, skipFocus: preserveScroll });
      bindLogin();
      return;
    }
    mount(
      errorMarkup(
        "Page not found.",
        "That route is not part of the CuriousStride challenge. The next useful step is probably My Journey or the homepage."
      )
    );
  } catch (error) {
    if (token !== renderSequence) return;
    mount(errorMarkup("CuriousStride hit an unexpected problem.", error.message));
  }
}

async function bootstrap() {
  if (!window.location.hash) history.replaceState(null, "", "#/home");
  try {
    await initializeBackend();
    const [content, session] = await Promise.all([getPublicContent(), getSession()]);
    setState({ content, session, backendError: null });
  } catch (error) {
    setState({ backendError: error });
    mount(
      errorMarkup("The website is not configured yet.", error.message, {
        showSetup: config.mode === "supabase",
        home: false
      }),
      { hideFooter: true }
    );
    return;
  }

  window.addEventListener("hashchange", () => renderRoute());
  authUnsubscribe = onAuthChange(async (session) => {
    setState({ session, journey: null });
    const route = parseHash();
    if (!session && ["journey", "reflection", "reflections", "completion", "settings", "admin"].includes(route.page)) {
      navigate("/login", { replace: true });
    } else {
      renderRoute({ preserveScroll: true });
    }
  });
  await renderRoute();

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker registration skipped:", error.message));
  }
}

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled CuriousStride error:", event.reason);
});

window.addEventListener("beforeunload", () => authUnsubscribe?.());

bootstrap();
