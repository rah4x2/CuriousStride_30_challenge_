import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { calculateChallengeDay, calendarDayDifference, addCalendarDays } from "../assets/js/utils/time.js";
import { parseHash } from "../assets/js/utils/router.js";
import { stageForDay, STAGES, DEFAULT_CONTENT } from "../assets/js/data/site-defaults.js";
import { safeJsonParse } from "../assets/js/utils/dom.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("Day 1 is available on the saved start date", () => {
  assert.equal(
    calculateChallengeDay({ startDate: "2026-11-09", now: new Date("2026-11-09T12:00:00Z"), timezone: "UTC" }),
    1
  );
});

test("Missed days do not reset challenge time", () => {
  assert.equal(
    calculateChallengeDay({ startDate: "2026-11-01", now: new Date("2026-11-09T12:00:00Z"), timezone: "UTC" }),
    9
  );
});

test("Challenge day is capped at 30 and dates before start return day zero", () => {
  assert.equal(
    calculateChallengeDay({ startDate: "2026-01-01", now: new Date("2026-11-09T12:00:00Z"), timezone: "UTC" }),
    30
  );
  assert.equal(
    calculateChallengeDay({ startDate: "2026-11-10", now: new Date("2026-11-09T12:00:00Z"), timezone: "UTC" }),
    0
  );
});

test("Calendar helpers preserve date-only behavior", () => {
  assert.equal(calendarDayDifference("2026-11-01", "2026-11-09"), 8);
  assert.equal(addCalendarDays("2026-11-01", 29), "2026-11-30");
});

test("Hash router parses protected admin paths and query values", () => {
  const route = parseHash("#/admin/prompts?prompt=abc%20123");
  assert.equal(route.page, "admin");
  assert.deepEqual(route.params, ["prompts"]);
  assert.equal(route.query.prompt, "abc 123");
});

test("Every challenge day maps to the expected five six-day stages", () => {
  assert.equal(stageForDay(1).id, "self-discovery");
  assert.equal(stageForDay(6).id, "self-discovery");
  assert.equal(stageForDay(7).id, "values-priorities");
  assert.equal(stageForDay(18).id, "mindset-growth");
  assert.equal(stageForDay(24).id, "direction-purpose");
  assert.equal(stageForDay(30).id, "intentional-living");
  assert.equal(STAGES.length, 5);
});

test("Missing or invalid browser data falls back safely", () => {
  assert.deepEqual(safeJsonParse(null, {}), {});
  assert.deepEqual(safeJsonParse("", []), []);
  assert.deepEqual(safeJsonParse("not-json", { ok: true }), { ok: true });
  assert.deepEqual(safeJsonParse('{"ok":true}', {}), { ok: true });
});

test("Built-in FAQ includes sensitive-information and professional-support guidance", () => {
  const combined = DEFAULT_CONTENT.faqs.map((item) => `${item.question} ${item.answer}`).join(" ");
  assert.match(combined, /sensitive personal information/i);
  assert.match(combined, /passwords/i);
  assert.match(combined, /not a substitute/i);
  assert.match(combined, /therapy/i);
});

test("The checked-in runtime is safe setup mode with no demo account path", () => {
  const config = read("../config.js");
  const publicView = read("../assets/js/views/public.js");
  const backend = read("../assets/js/services/backend.js");
  const participant = read("../assets/js/views/participant.js");
  const packageJson = JSON.parse(read("../package.json"));
  assert.match(config, /mode:\s*["']setup["']/);
  assert.doesNotMatch(publicView, /signInDemo|Participant demo|Admin demo/i);
  assert.doesNotMatch(backend, /signInDemo|isDemoMode|admin@demo|participant@demo|mode\s*===\s*["']preview["']/i);
  assert.doesNotMatch(participant, /data-reset-demo|data-demo-day|Demo tool/i);
  assert.equal(existsSync(new URL("../demo-data", import.meta.url)), false);
  assert.equal(packageJson.scripts["build:demo"], undefined);
});

test("Public sign-in explains participant-by-default and manual administrator assignment", () => {
  const publicView = read("../assets/js/views/public.js");
  assert.match(publicView, /Every new Google-authenticated account starts as a participant/);
  assert.match(publicView, /granted manually in the protected Supabase database/);
});

test("The public footer does not advertise the administrator route", () => {
  const layout = read("../assets/js/components/layout.js");
  const footer = layout.slice(layout.indexOf("function footer"), layout.indexOf("export function renderShell"));
  assert.doesNotMatch(footer, /#\/admin/);
  assert.doesNotMatch(footer, /Administrator dashboard/i);
});

test("First-login onboarding requires privacy acknowledgements and starts Day 1 through an RPC", () => {
  const participant = read("../assets/js/views/participant.js");
  const backend = read("../assets/js/services/backend.js");
  assert.match(participant, /name="storageAcknowledged" required/);
  assert.match(participant, /name="safetyAcknowledged" required/);
  assert.match(participant, /Do not enter passwords, financial data, identification numbers, medical records/);
  assert.match(backend, /supabase\.rpc\("complete_my_onboarding"/);
});

test("The four requested accent colors are present in the visual system", () => {
  const css = read("../assets/css/styles.css").toUpperCase();
  for (const color of ["#00E0BA", "#91008D", "#FF3483", "#FFCF00"]) assert.match(css, new RegExp(color));
});

test("Supabase seed defines exactly Days 1 through 30", () => {
  const seed = read("../supabase/seed.sql");
  const days = [...seed.matchAll(/^-- Day (\d+):/gm)].map((match) => Number(match[1]));
  assert.deepEqual(days, Array.from({ length: 30 }, (_, index) => index + 1));
});

test("Database schema prevents participant-created administrator accounts", () => {
  const schema = read("../supabase/schema.sql");
  assert.match(schema, /revoke all on public\.prompts, public\.prompt_versions, public\.admin_users/);
  assert.doesNotMatch(schema, /grant\s+(insert|update|delete|all)[^;]*public\.admin_users/i);
  assert.equal((schema.match(/insert\s+into\s+public\.admin_users/gi) || []).length, 0);
  assert.match(schema, /if not public\.is_current_user_admin\(\) then raise exception 'Administrator access required'/);
  assert.match(schema, /if exists \(select 1 from public\.admin_users where user_id = p_user_id\) then/);
});

test("Onboarding is server-recorded and no prompt is assigned before completion", () => {
  const schema = read("../supabase/schema.sql");
  assert.match(schema, /create or replace function public\.complete_my_onboarding/);
  assert.match(schema, /onboarding_completed_at = coalesce\(onboarding_completed_at, now\(\)\)/);
  assert.match(schema, /challenge_start_date = case when onboarding_completed_at is null then v_local_date else challenge_start_date end/);
  assert.match(schema, /if v_profile\.onboarding_completed_at is null then\s+v_current_day := 0;/);
  assert.match(schema, /'current_day', v_current_day/);
});


test("Closing registrations is enforced for both new auth users and repaired profiles", () => {
  const schema = read("../supabase/schema.sql");
  assert.match(schema, /create or replace function public\.handle_new_user[\s\S]*registrations are currently closed/);
  assert.match(schema, /create or replace function public\.ensure_my_profile[\s\S]*v_profile_exists[\s\S]*registrations are currently closed/);
  assert.match(schema, /not v_profile_exists and not public\.is_current_user_admin\(\)/);
});

test("Completed-day progress is recorded even when optional analytics are disabled", () => {
  const backend = read("../assets/js/services/backend.js");
  assert.match(backend, /if \(!config\.analytics && eventType !== "reflection_saved"\) return/);
  assert.match(backend, /record_participant_event/);
});

test("Server progress records require an actually assigned prompt", () => {
  const schema = read("../supabase/schema.sql");
  assert.match(schema, /select 1 from public\.prompt_assignments a[\s\S]*a\.user_id = auth\.uid\(\)[\s\S]*a\.day_number = v_day/);
  assert.match(schema, /That prompt has not been assigned to this participant/);
});

test("Prompt text stays behind RPCs and cloud reflections remain owner-only", () => {
  const schema = read("../supabase/schema.sql");
  assert.match(schema, /revoke all on public\.prompts, public\.prompt_versions/);
  assert.doesNotMatch(schema, /grant select on public\.prompts/i);
  assert.match(schema, /cloud_reflections_owner_select[\s\S]*user_id = auth\.uid\(\)/);
  assert.match(schema, /cloud_reflections_owner_insert[\s\S]*user_id = auth\.uid\(\)/);
});

test("Reminder function requires opt-in onboarding, current secret-key handling and a trusted scheduler secret", () => {
  const reminder = read("../supabase/functions/send-reminders/index.ts");
  const functionConfig = read("../supabase/config.toml");
  assert.match(reminder, /reminder_enabled=eq\.true/);
  assert.match(reminder, /onboarding_completed_at=not\.is\.null/);
  assert.match(reminder, /status=eq\.published/);
  assert.match(reminder, /SUPABASE_SECRET_KEYS/);
  assert.match(reminder, /keys\?\.default/);
  assert.match(reminder, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(reminder, /LEGACY_SERVICE_ROLE_JWT/);
  assert.match(reminder, /x-scheduler-secret/);
  assert.match(functionConfig, /\[functions\.send-reminders\][\s\S]*verify_jwt = false/);
  assert.match(reminder, /The reflection question is kept inside your signed-in journey/);
  assert.doesNotMatch(reminder, /select=[^\n]*question/i);
});



test("Reminder scheduling stops after Day 30 and uses a same-day delivery window", () => {
  const reminder = read("../supabase/functions/send-reminders/index.ts");
  assert.match(reminder, /const challengeDay = dayDifference\(profile\.challenge_start_date, local\.date\) \+ 1/);
  assert.match(reminder, /challengeDay > durationDays/);
  assert.doesNotMatch(reminder, /const challengeDay = Math\.min/);
  assert.match(reminder, /const elapsed = current - scheduled/);
  assert.match(reminder, /elapsed >= 0 && elapsed < 5/);
});

test("Local backup restore validates the challenge and preserves newer data", () => {
  const storage = read("../assets/js/services/storage.js");
  assert.match(storage, /version: 2/);
  assert.match(storage, /This backup belongs to a different CuriousStride challenge/);
  assert.match(storage, /incomingFinalDate > existingFinalDate/);
  assert.match(storage, /backup\.reflections\.slice\(0, 30\)/);
});

test("The participant challenge timezone is locked after Day 1 begins", () => {
  const schema = read("../supabase/schema.sql");
  assert.match(schema, /onboarding_completed_at is not null[\s\S]*timezone <> p_timezone/);
  assert.match(schema, /raise exception 'The challenge timezone is fixed after Day 1 begins'/);
  assert.match(schema, /timezone = case when onboarding_completed_at is null then v_timezone else timezone end/);
});

test("Reminder delivery excludes administrator accounts", () => {
  const reminder = read("../supabase/functions/send-reminders/index.ts");
  assert.match(reminder, /admin_users\?select=user_id/);
  assert.match(reminder, /adminIds\.has\(profile\.id\)/);
});

test("Production build validates a public Supabase configuration and copies only deployable assets", () => {
  const builder = read("../build.js");
  assert.match(builder, /config\.local\.js is required/);
  assert.match(builder, /mode:\s*\\?"supabase|supabase/);
  assert.match(builder, /siteUrl must be the final HTTPS production URL/);
  assert.match(builder, /sb_secret_/);
  assert.match(builder, /service[_-]?role/);
  assert.match(builder, /browser-safe publishable\/anon key/);
  assert.match(builder, /\["index\.html", "manifest\.webmanifest", "sw\.js", "assets"\]/);
  assert.doesNotMatch(builder, /cpSync\([^\n]*(?:tests|supabase|docs|README)/);
  assert.doesNotMatch(builder, /roots\.push\("demo-data"\)/);
});

test("Local and supported hosted deployments define core security headers", () => {
  const server = read("../server.js");
  const netlify = read("../netlify.toml");
  const vercel = read("../vercel.json");
  for (const source of [server, netlify, vercel]) {
    assert.match(source, /Content-Security-Policy/);
    assert.match(source, /X-Content-Type-Options/);
    assert.match(source, /frame-ancestors 'none'/);
  }
});

test("The local server blocks source-only and private configuration paths", () => {
  const server = read("../server.js");
  assert.match(server, /pathname === "\/config\.local\.js"/);
  assert.match(server, /const publicRoots = new Set\(\["assets", "docs"\]\)/);
  assert.match(server, /const publicFiles = new Set\(\["index\.html", "manifest\.webmanifest", "sw\.js", "config\.js"\]\)/);
  assert.doesNotMatch(server, /publicRoots[^\n]*(?:supabase|tests)/);
});

test("Safe setup mode does not publish a fake support email address", () => {
  const config = read("../config.js");
  const backend = read("../assets/js/services/backend.js");
  const layout = read("../assets/js/components/layout.js");
  assert.match(config, /supportEmail:\s*""/);
  assert.match(backend, /supportEmail:\s*""/);
  assert.match(layout, /Support details are added at launch/);
  assert.doesNotMatch(layout, /curiousstride\.example/);
});

test("Representative public, participant and administrator views render without runtime errors", async () => {
  globalThis.window = {
    location: { origin: "https://app.curiousstride.test" },
    CURIOUSSTRIDE_CONFIG: {
      mode: "supabase",
      siteUrl: "https://app.curiousstride.test",
      supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
      supabaseAnonKey: "sb_publishable_abcdefghijklmnopqrstuvwxyz1234567890",
      supportEmail: "hello@curiousstride.test",
      enableReminders: true
    }
  };
  globalThis.document = { title: "" };

  const publicViews = await import("../assets/js/views/public.js");
  const participantViews = await import("../assets/js/views/participant.js");
  const adminViews = await import("../assets/js/views/admin.js");
  const profile = {
    id: "user-1",
    fullName: "Alex Morgan",
    email: "alex@example.test",
    timezone: "UTC",
    status: "active",
    challengeStartDate: "2026-11-09",
    reminderEnabled: false,
    reminderTime: "19:00",
    onboardingCompletedAt: "2026-11-09T10:00:00Z",
    onboardingVersion: 1
  };
  const session = { user: { id: profile.id, fullName: profile.fullName, email: profile.email }, profile, isAdmin: false };
  const prompt = {
    id: "prompt-1",
    dayNumber: 1,
    stageId: "self-discovery",
    stageName: "Self-Discovery",
    title: "Your current chapter",
    introduction: "Pause and notice where you are.",
    question: "What does your current chapter look like?",
    followUp: "What feels most important?",
    version: 1,
    promptVersionId: "version-1",
    status: "published"
  };
  const journey = { profile, currentDay: 1, availablePrompts: [prompt], challenge: { durationDays: 30 } };
  const reflection = {
    dayNumber: 1,
    response: "A thoughtful answer.",
    completed: true,
    updatedAt: "2026-11-09T11:00:00Z",
    promptSnapshot: prompt
  };
  const finalReflections = { answers: ["One", "Two", "Three"], updatedAt: "2026-12-08T11:00:00Z" };
  const outputs = [
    publicViews.renderHome(DEFAULT_CONTENT, null),
    publicViews.renderAbout(DEFAULT_CONTENT),
    publicViews.renderHowItWorks(DEFAULT_CONTENT, null),
    publicViews.renderPrivacy(DEFAULT_CONTENT),
    publicViews.renderLogin({ ...DEFAULT_CONTENT, registrationsOpen: false }),
    participantViews.renderOnboarding({ session, journey: { ...journey, profile: { ...profile, onboardingCompletedAt: "" } } }),
    participantViews.renderJourney({ session, journey, reflections: [reflection] }),
    participantViews.renderLockedReflection({ journey, day: 2 }),
    participantViews.renderReflection({ journey, prompt, reflection, recoveredDraft: null }),
    participantViews.renderReflections({ journey, reflections: [reflection] }),
    participantViews.renderCompletionLocked({ journey }),
    participantViews.renderCompletion({ journey: { ...journey, currentDay: 30 }, reflections: [reflection], finalReflections }),
    participantViews.renderSettings({ session, journey, reflections: [reflection] }),
    adminViews.renderAdminOverview({
      registeredParticipants: 1,
      activeParticipants: 1,
      completedChallenges: 0,
      publishedPrompts: 30,
      completionRate: 0,
      recentParticipants: [profile]
    }),
    adminViews.renderAdminPrompts({ prompts: [prompt], selectedPrompt: prompt }),
    adminViews.renderAdminContent(DEFAULT_CONTENT),
    adminViews.renderAdminParticipants([{ ...profile, registrationDate: profile.onboardingCompletedAt, lastActiveAt: reflection.updatedAt, currentDay: 1, completedCount: 1 }]),
    adminViews.renderAdminAnalytics({
      averageCompleted: 1,
      returnRate: 100,
      totalEvents: 3,
      registrations: [{ label: "Nov 09", value: 1 }],
      stageCompletion: [{ label: "Self-Discovery", value: 0 }]
    })
  ];

  for (const html of outputs) {
    assert.equal(typeof html, "string");
    assert.ok(html.length > 50);
    assert.match(html, /</);
  }
  const closedLogin = outputs[4];
  assert.match(closedLogin, /Existing participants can still sign in/);
  assert.doesNotMatch(closedLogin, /data-google-sign-in\s+disabled/);
});

let passed = 0;
for (const item of tests) {
  try {
    await item.fn();
    passed += 1;
    console.log(`✓ ${item.name}`);
  } catch (error) {
    console.error(`✗ ${item.name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

console.log(`\n${passed}/${tests.length} tests passed.`);
