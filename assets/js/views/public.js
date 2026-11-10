import { CHALLENGE, STAGES } from "../data/site-defaults.js";
import { config, signInWithGoogle } from "../services/backend.js";
import { escapeHtml, setDocumentTitle } from "../utils/dom.js";
import { icon } from "../utils/icons.js";
import { showToast } from "../components/toast.js";

function benefits(content) {
  return (content.benefits || [])
    .map(
      (item, index) => `<article class="card feature-card">
        <span class="feature-number">${String(index + 1).padStart(2, "0")}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </article>`
    )
    .join("");
}

function stageRows() {
  return STAGES.map(
    (stage) => `<article class="stage-row">
      <span class="stage-row__number">${stage.number}</span>
      <div><h3>${escapeHtml(stage.name)}</h3><p>${escapeHtml(stage.description)}</p></div>
      <span class="stage-row__days">Days ${stage.startDay}–${stage.endDay}</span>
    </article>`
  ).join("");
}

function faqItems(content) {
  return (content.faqs || [])
    .map(
      (item) => `<details class="faq-item">
        <summary>${escapeHtml(item.question)}</summary>
        <div class="faq-answer">${escapeHtml(item.answer)}</div>
      </details>`
    )
    .join("");
}

export function renderHome(content, session) {
  setDocumentTitle("");
  const startHref = session ? "#/journey" : "#/login";
  const startLabel = session ? "Open My Journey" : "Start Your Free Challenge";
  const registrationsClosed = content.registrationsOpen === false && !session;
  const dayBlocks = Array.from({ length: 18 }, (_, index) => `<span class="${index < 7 ? "done" : ""}"></span>`).join("");
  return `
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <span class="eyebrow">A guided 30-day reflection experience</span>
          <h1>${escapeHtml(content.homeHeading)}</h1>
          <p class="lede">${escapeHtml(content.homeIntro)}</p>
          <div class="hero-actions">
            <a class="btn btn--primary" href="${registrationsClosed ? "#/how-it-works" : startHref}" ${
              registrationsClosed ? 'aria-disabled="true"' : ""
            }>${icon("arrowRight")} ${registrationsClosed ? "Registration is currently paused" : startLabel}</a>
            <a class="btn btn--secondary" href="#/how-it-works">Discover How It Works</a>
          </div>
          <div class="hero-note">${icon("checkCircle")} <span>Free to join · Begin on your own date · Missing a day never resets your progress</span></div>
        </div>
        <div class="hero-visual" aria-label="Preview of the CuriousStride reflection experience">
          <div class="journey-orbit" aria-hidden="true"></div>
          <div class="prompt-card-preview">
            <span class="day-chip">Day 10 · Values & Priorities</span>
            <h3>Which expectations feel genuinely yours?</h3>
            <p>Pause before deciding what your next chapter should look like.</p>
            <div class="preview-lines" aria-hidden="true"><span></span><span></span><span></span></div>
          </div>
          <div class="preview-progress">
            <div class="preview-progress-top"><strong>7 reflections</strong><span>Day 10</span></div>
            <div class="mini-days" aria-hidden="true">${dayBlocks}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="section section--sky" id="how-it-works">
      <div class="container">
        <div class="section-heading section-heading--center">
          <span class="eyebrow">Why CuriousStride</span>
          <h2>A little structure for an uncertain chapter.</h2>
          <p class="lede">The challenge does not tell you what your future must look like. It helps you slow down, notice useful patterns and explore possibilities one thought at a time.</p>
        </div>
        <div class="grid-4">${benefits(content)}</div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="grid-2" style="align-items:start; gap:clamp(2rem,7vw,6rem)">
          <div class="section-heading">
            <span class="eyebrow">How the journey unfolds</span>
            <h2>Five stages, without rushing the answer.</h2>
            <p class="lede">Each six-day stage moves from understanding your present chapter towards practical intentions for whatever comes next.</p>
            <a class="btn btn--secondary" href="#/how-it-works">See the complete experience ${icon("arrowRight")}</a>
          </div>
          <div class="stage-list">${stageRows()}</div>
        </div>
      </div>
    </section>

    <section class="section section--compact">
      <div class="container">
        <div class="quote-panel">
          <blockquote>“The participant owns their reflections. CuriousStride provides the space, the structure and the questions.”</blockquote>
          <cite>CuriousStride guiding principle</cite>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-heading section-heading--center">
          <span class="eyebrow">Questions people ask</span>
          <h2>Simple by design.</h2>
        </div>
        <div class="faq-list">${faqItems(content)}</div>
      </div>
    </section>

    <section class="section section--compact">
      <div class="container">
        <div class="cta-band">
          <div><h2>Give yourself one thoughtful question today.</h2><p>${escapeHtml(CHALLENGE.tagline)}</p></div>
          <a class="btn btn--primary" href="${startHref}">${startLabel} ${icon("arrowRight")}</a>
        </div>
      </div>
    </section>`;
}

export function renderAbout(content) {
  setDocumentTitle("About");
  return `<section class="page-hero">
    <div class="container">
      <div class="breadcrumbs"><a href="#/home">Home</a><span>/</span><span>About</span></div>
      <span class="eyebrow">About CuriousStride</span>
      <h1>${escapeHtml(content.aboutHeading)}</h1>
      <p class="lede">${escapeHtml(content.aboutBody)}</p>
    </div>
  </section>
  <section class="section section--compact">
    <div class="container grid-2" style="align-items:start; gap:clamp(2rem,7vw,6rem)">
      <div class="prose">
        <h2>Why this challenge exists</h2>
        <p>Graduating, beginning work, changing direction or entering a new stage can remove the structure that once organised everyday life. Questions about interests, values, careers and long-term goals often arrive all at once.</p>
        <p>CuriousStride creates a calm place to work through those questions gradually. One daily prompt is small enough to begin, while 30 days creates enough continuity to notice themes that a single journaling session might miss.</p>
        <h2>What it does not promise</h2>
        <p>This is not a programme that guarantees a perfect career choice, a complete life plan or a transformed identity by Day 30. Meaningful self-understanding develops over time. The challenge simply helps you gather better information about yourself.</p>
      </div>
      <div class="card card--padded">
        <span class="icon-tile">${icon("sparkles")}</span>
        <h2 style="font-size:2rem">Plan what you can. Explore what you do not know.</h2>
        <p class="muted">CuriousStride’s philosophy makes room for both intention and uncertainty. You can choose a next step without pretending you already know the entire route.</p>
        <div class="notice mt-2">${icon("info")}<p>The experience is open to anyone interested in self-discovery, although it was designed especially with students and recent graduates in mind.</p></div>
      </div>
    </div>
  </section>`;
}

export function renderHowItWorks(content, session) {
  setDocumentTitle("How It Works");
  const startHref = session ? "#/journey" : "#/login";
  return `<section class="page-hero">
    <div class="container">
      <div class="breadcrumbs"><a href="#/home">Home</a><span>/</span><span>How it works</span></div>
      <span class="eyebrow">The 30-day experience</span>
      <h1>${escapeHtml(content.howHeading)}</h1>
      <p class="lede">A new prompt becomes available on each calendar day of your individual journey. Previous prompts remain open, future prompts stay locked and a missed day never resets your progress.</p>
    </div>
  </section>
  <section class="section section--compact">
    <div class="container grid-3">
      <article class="card card--padded"><span class="feature-number">01</span><h3>Sign in securely</h3><p class="muted">Use Google to identify your account. CuriousStride never asks for or stores your Google password.</p></article>
      <article class="card card--padded"><span class="feature-number">02</span><h3>Open one prompt</h3><p class="muted">Your current question and every earlier question remain accessible. Future questions unlock according to your start date.</p></article>
      <article class="card card--padded"><span class="feature-number">03</span><h3>Write at your pace</h3><p class="muted">Your response autosaves on this device. Revisit, edit, export or leave a day blank without being penalised.</p></article>
    </div>
  </section>
  <section class="section section--sky">
    <div class="container">
      <div class="section-heading"><span class="eyebrow">The five stages</span><h2>From noticing to intentional action.</h2></div>
      <div class="stage-list">${stageRows()}</div>
    </div>
  </section>
  <section class="section">
    <div class="container grid-2" style="align-items:start; gap:clamp(2rem,7vw,6rem)">
      <div class="prose">
        <h2>Your reflections stay local by default</h2>
        <p>Responses are stored in IndexedDB in the browser where you write them. Google sign-in recognises your account, but local writing does not automatically move to a phone, another laptop or a different browser.</p>
        <p>You can download a PDF and a JSON backup at any point. The optional cloud-sync feature is available only when the website owner enables it, and it requires your explicit choice.</p>
      </div>
      <div class="card card--padded">
        <span class="icon-tile">${icon("shield")}</span>
        <h3>No public streaks. No rankings.</h3>
        <p class="muted">The progress tracker is there to help you navigate, not to compare you with anybody else. Missing a day is information about real life, not a failure.</p>
        <a class="btn btn--primary mt-1" href="${startHref}">${session ? "Continue My Journey" : "Start Your Free Challenge"} ${icon("arrowRight")}</a>
      </div>
    </div>
  </section>`;
}

export function renderPrivacy(content) {
  setDocumentTitle("Privacy Policy");
  const email = escapeHtml(config.supportEmail);
  const supportCopy = email
    ? `For privacy or account questions, contact <a href="mailto:${email}">${email}</a>.`
    : "A verified privacy and support contact will be published before registration opens.";
  return `<section class="page-hero">
    <div class="container">
      <div class="breadcrumbs"><a href="#/home">Home</a><span>/</span><span>Privacy</span></div>
      <span class="eyebrow">Privacy policy</span>
      <h1>Your writing deserves honest, understandable privacy choices.</h1>
      <p class="lede">${escapeHtml(content.privacySummary)}</p>
    </div>
  </section>
  <section class="section section--compact">
    <div class="container prose">
      <div class="notice notice--warning">${icon("alert")}<p>CuriousStride is a reflection tool, not an encrypted private vault. Avoid entering information that would create serious harm if someone with access to your device could read it.</p></div>
      <h2>Information used for your account</h2>
      <p>When real Google sign-in is configured, the authentication provider supplies the minimum account information needed to identify you, such as your user ID, name, email address and optional profile image. CuriousStride never receives your Google password.</p>
      <h2>Where your journal is stored</h2>
      <p>By default, reflection responses and closing answers are stored in IndexedDB in your browser. They are associated with your signed-in user ID and challenge day. Clearing browser data, using a different browser or losing the device may remove access to those local entries.</p>
      <p>Optional cloud sync, when enabled by the site owner and switched on by you, copies journal entries into a protected database row accessible through your authenticated account. The administrator interface is deliberately not given journal-reading functionality.</p>
      <h2>Prompt and participation data</h2>
      <p>The backend stores your challenge start date, timezone, account status and basic activity information needed to unlock the correct prompt and calculate general participation statistics. Analytics should describe participation patterns, not the content of private writing.</p>
      <h2>Exports and deletion</h2>
      <p>You can export a PDF or JSON backup from Settings. You can also remove reflections stored on the current device. Deleting local data cannot be undone unless you previously created a backup.</p>
      <h2>Administrator access</h2>
      <p>Authorised administrators can manage prompts, website content and basic participant status. They should not receive automatic access to reflection text. Administrative permissions are checked by the backend rather than by simply hiding buttons.</p>
      <h2>Questions</h2>
      <p>${supportCopy}</p>
    </div>
  </section>`;
}

function googleLogo() {
  return `<svg class="google-logo" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.39a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.97-4.33 2.97-7.42z"/>
    <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.35l-3.24-2.55c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.63A10 10 0 0 0 12 22z"/>
    <path fill="#FBBC05" d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.44H3.04A10 10 0 0 0 2 12c0 1.61.38 3.13 1.04 4.56l3.35-2.63z"/>
    <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.44l3.35 2.63C7.18 7.7 9.39 5.94 12 5.94z"/>
  </svg>`;
}

export function renderLogin(content) {
  setDocumentTitle("Sign In");
  const closed = content.registrationsOpen === false;
  const configured = config.mode === "supabase" && Boolean(config.supabaseUrl && config.supabaseAnonKey);
  return `<div class="auth-page">
    <section class="auth-story">
      <div class="auth-story-content">
        <span class="eyebrow auth-eyebrow">A quieter daily practice</span>
        <h1>One question can be enough for today.</h1>
        <p>${escapeHtml(CHALLENGE.tagline)} Your answers remain yours, and your journey follows your own start date.</p>
        <div class="auth-color-ribbon" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
      </div>
    </section>
    <section class="auth-panel">
      <div class="auth-card">
        <span class="eyebrow">Welcome</span>
        <h1>${closed ? "Registration is paused." : "Start your journey."}</h1>
        <p class="lede">${closed ? "Existing participants can still sign in. New registrations will reopen when the administrator is ready." : "Use Google to create or return to your individual 30-day experience."}</p>
        <button class="google-button" type="button" data-google-sign-in ${configured ? "" : "disabled"}>${googleLogo()} ${configured ? "Continue with Google" : "Google sign-in needs Supabase setup"}</button>
        ${
          configured
            ? ""
            : `<div class="notice notice--warning mt-1">${icon("settings")}<p>This project is in safe setup mode. Public pages can be reviewed, but no participant or administrator account can be created until you connect your own Supabase project.</p></div><a class="btn btn--secondary btn--block mt-1" href="/docs/SUPABASE_SETUP.md" target="_blank" rel="noreferrer">Open the Supabase setup guide</a>`
        }
        <div class="notice mt-1">${icon("shield")}<p>Every new Google-authenticated account starts as a participant. Administrator access can only be granted manually in the protected Supabase database.</p></div>
        <p class="auth-legal">By continuing, you acknowledge the <a href="#/privacy">privacy policy</a>. After sign-in, a required welcome guide explains local storage, sensitive-information limits and optional reminders before Day 1 begins.</p>
      </div>
    </section>
  </div>`;
}

export function bindLogin() {
  document.querySelector("[data-google-sign-in]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const original = button.innerHTML;
    button.innerHTML = `<span class="spinner"></span> Opening Google…`;
    try {
      await signInWithGoogle();
    } catch (error) {
      showToast(error.message, "error", 7000);
      button.disabled = false;
      button.innerHTML = original;
    }
  });
}
