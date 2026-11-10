import { DEFAULT_CONTENT, CHALLENGE, stageForDay } from "../data/site-defaults.js";

export const config = Object.freeze({
  mode: "setup",
  siteUrl: window.location.origin,
  challengeSlug: CHALLENGE.slug,
  supabaseUrl: "",
  supabaseAnonKey: "",
  enableCloudSync: false,
  enableReminders: false,
  defaultTimezone: "UTC",
  supportEmail: "",
  analytics: false,
  onboardingVersion: 1,
  ...(window.CURIOUSSTRIDE_CONFIG || {})
});

let supabase = null;
let authSubscription = null;
let initialized = false;
const authListeners = new Set();

export function isSetupMode() {
  return config.mode === "setup";
}

function requireSupabaseMode() {
  if (config.mode !== "supabase" || !supabase) {
    throw new Error(
      "Connect this project to Supabase before using participant or administrator accounts. Open docs/SUPABASE_SETUP.md for the setup steps."
    );
  }
}

function normalizeError(error, fallback = "Something went wrong.") {
  return new Error(error?.message || error?.error_description || fallback);
}

function emitAuthChange() {
  authListeners.forEach((listener) => {
    Promise.resolve(getSession()).then(listener).catch(() => listener(null));
  });
}

async function initializeSupabase() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error(
      "Supabase mode is enabled, but the project URL or publishable key is missing from config.local.js."
    );
  }

  const module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  supabase = module.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce"
    }
  });

  const { data } = supabase.auth.onAuthStateChange(() => emitAuthChange());
  authSubscription = data?.subscription || null;
}

export async function initializeBackend() {
  if (initialized) return;
  if (config.mode === "supabase") await initializeSupabase();
  initialized = true;
}

export function onAuthChange(listener) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

export function destroyBackend() {
  authSubscription?.unsubscribe?.();
  authSubscription = null;
  supabase = null;
  initialized = false;
}

function mapAuthUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || "",
    fullName:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Participant",
    avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || ""
  };
}

function mapProfile(row = {}) {
  return {
    id: row.id || row.user_id,
    email: row.email || "",
    fullName: row.full_name || row.fullName || row.email?.split("@")[0] || "Participant",
    avatarUrl: row.avatar_url || row.avatarUrl || "",
    registrationDate: row.registration_date || row.registrationDate || row.created_at || "",
    challengeStartDate: row.challenge_start_date || row.challengeStartDate || "",
    timezone: row.timezone || config.defaultTimezone || "UTC",
    status: row.status || "active",
    cloudSyncEnabled: Boolean(row.cloud_sync_enabled ?? row.cloudSyncEnabled),
    reminderEnabled: Boolean(row.reminder_enabled ?? row.reminderEnabled),
    reminderTime: row.reminder_time || row.reminderTime || "19:00",
    onboardingVersion: Number(row.onboarding_version ?? row.onboardingVersion ?? 0),
    onboardingCompletedAt: row.onboarding_completed_at || row.onboardingCompletedAt || "",
    privacyAcknowledgedAt: row.privacy_acknowledged_at || row.privacyAcknowledgedAt || "",
    reminderConsentAt: row.reminder_consent_at || row.reminderConsentAt || "",
    lastActiveAt: row.last_active_at || row.lastActiveAt || ""
  };
}

function mapPromptVersion(row = {}) {
  return {
    version: Number(row.version_number ?? row.version ?? 1),
    versionId: row.id || row.version_id || row.versionId,
    title: row.title || "",
    introduction: row.introduction || "",
    question: row.question || row.main_question || "",
    followUp: row.follow_up || row.follow_up_question || row.followUp || "",
    createdAt: row.created_at || row.createdAt || "",
    createdBy: row.created_by || row.createdBy || ""
  };
}

function mapPrompt(row = {}) {
  const dayNumber = Number(row.day_number ?? row.dayNumber);
  const stage = stageForDay(dayNumber);
  return {
    id: row.id || row.prompt_id,
    dayNumber,
    stageId: row.stage_slug || row.stage_id || row.stageId || stage.id,
    stageName: row.stage_name || row.stageName || stage.name,
    status: row.status || "published",
    version: Number(row.version_number ?? row.version ?? 1),
    versionId: row.prompt_version_id || row.version_id || row.versionId || "",
    title: row.title || "Daily reflection",
    introduction: row.introduction || "",
    question: row.question || row.main_question || "",
    followUp: row.follow_up || row.follow_up_question || row.followUp || "",
    assignedAt: row.assigned_at || row.assignedAt || "",
    updatedAt: row.updated_at || row.updatedAt || "",
    versions: Array.isArray(row.versions) ? row.versions.map(mapPromptVersion) : undefined
  };
}

export async function getSession() {
  await initializeBackend();
  if (config.mode !== "supabase") return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw normalizeError(error, "Unable to read your sign-in session.");
  if (!data.session?.user) return null;

  const user = mapAuthUser(data.session.user);
  const [profile, isAdmin] = await Promise.all([
    getProfile().catch(() =>
      mapProfile({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl
      })
    ),
    checkAdmin().catch(() => false)
  ]);

  return { user, profile, isAdmin, provider: "google" };
}

export async function signInWithGoogle() {
  await initializeBackend();
  requireSupabaseMode();

  const redirectUrl = new URL(config.siteUrl || window.location.origin, window.location.origin);
  redirectUrl.hash = "/journey";

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectUrl.toString() }
  });
  if (error) throw normalizeError(error, "Google sign-in could not be started.");
}

export async function signOut() {
  await initializeBackend();
  requireSupabaseMode();
  const { error } = await supabase.auth.signOut();
  if (error) throw normalizeError(error, "You could not be signed out.");
}

export async function getPublicContent() {
  await initializeBackend();
  if (config.mode !== "supabase") return { ...DEFAULT_CONTENT };

  const { data, error } = await supabase.rpc("get_public_site_content", {
    p_challenge_slug: config.challengeSlug
  });
  if (error) {
    console.warn("Falling back to built-in website content:", error.message);
    return { ...DEFAULT_CONTENT };
  }
  const payload = Array.isArray(data) ? data[0] : data;
  return { ...DEFAULT_CONTENT, ...(payload || {}) };
}

export async function getProfile() {
  await initializeBackend();
  requireSupabaseMode();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || config.defaultTimezone || "UTC";
  const { data, error } = await supabase.rpc("ensure_my_profile", {
    p_timezone: timezone,
    p_challenge_slug: config.challengeSlug
  });
  if (error) throw normalizeError(error, "Your participant profile could not be loaded.");
  return mapProfile(Array.isArray(data) ? data[0] : data);
}

export async function updateProfileSettings(updates = {}) {
  await initializeBackend();
  const session = await getSession();
  if (!session) throw new Error("Sign in to update your settings.");
  requireSupabaseMode();

  const normalized = {
    timezone: updates.timezone || session.profile.timezone,
    cloudSyncEnabled: Boolean(updates.cloudSyncEnabled),
    reminderEnabled: Boolean(config.enableReminders && updates.reminderEnabled),
    reminderTime: updates.reminderTime || "19:00"
  };

  const { data, error } = await supabase.rpc("save_my_profile_settings", {
    p_timezone: normalized.timezone,
    p_cloud_sync_enabled: normalized.cloudSyncEnabled,
    p_reminder_enabled: normalized.reminderEnabled,
    p_reminder_time: normalized.reminderTime,
    p_challenge_slug: config.challengeSlug
  });
  if (error) throw normalizeError(error, "Your settings could not be saved.");
  return mapProfile(Array.isArray(data) ? data[0] : data);
}

export async function completeMyOnboarding({ timezone, reminderEnabled = false, reminderTime = "19:00" } = {}) {
  await initializeBackend();
  const session = await getSession();
  if (!session) throw new Error("Sign in to begin your journey.");
  requireSupabaseMode();

  const normalized = {
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || config.defaultTimezone || "UTC",
    reminderEnabled: Boolean(config.enableReminders && reminderEnabled),
    reminderTime: reminderTime || "19:00",
    onboardingVersion: Number(config.onboardingVersion || 1)
  };

  const { data, error } = await supabase.rpc("complete_my_onboarding", {
    p_timezone: normalized.timezone,
    p_reminder_enabled: normalized.reminderEnabled,
    p_reminder_time: normalized.reminderTime,
    p_onboarding_version: normalized.onboardingVersion,
    p_challenge_slug: config.challengeSlug
  });
  if (error) throw normalizeError(error, "Your welcome guide could not be completed.");
  return mapProfile(Array.isArray(data) ? data[0] : data);
}

export async function getJourney() {
  await initializeBackend();
  const session = await getSession();
  if (!session) throw new Error("Sign in to open your journey.");
  requireSupabaseMode();

  const { data, error } = await supabase.rpc("get_my_journey", {
    p_challenge_slug: config.challengeSlug
  });
  if (error) throw normalizeError(error, "Your journey could not be loaded.");
  const result = Array.isArray(data) ? data[0] : data;
  return {
    profile: mapProfile(result.profile || result),
    currentDay: Number(result.current_day ?? result.currentDay ?? 0),
    challenge: { ...CHALLENGE, ...(result.challenge || {}) },
    availablePrompts: (result.available_prompts || result.availablePrompts || []).map(mapPrompt),
    registrationsOpen: result.registrations_open !== false
  };
}

export async function touchActivity() {
  await initializeBackend();
  if (config.mode !== "supabase") return;
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return;
  const { error } = await supabase.rpc("touch_activity", { p_challenge_slug: config.challengeSlug });
  if (error) console.warn("Activity timestamp was not updated:", error.message);
}

export async function checkAdmin() {
  await initializeBackend();
  if (config.mode !== "supabase") return false;
  const { data, error } = await supabase.rpc("is_current_user_admin");
  if (error) return false;
  return Boolean(data);
}

export async function saveCloudReflection(record) {
  if (!config.enableCloudSync || config.mode !== "supabase") return null;
  const session = await getSession();
  if (!session?.profile?.cloudSyncEnabled) return null;
  requireSupabaseMode();

  const payload = {
    user_id: session.user.id,
    challenge_slug: record.challengeSlug,
    day_number: Number(record.dayNumber),
    prompt_id: record.promptId || null,
    prompt_version_id: record.promptVersionId || null,
    prompt_snapshot: {
      title: record.promptTitle || "",
      question: record.promptQuestion || "",
      stageId: record.stageId || ""
    },
    response_text: record.response || "",
    completed: Boolean(record.completed),
    client_updated_at: record.updatedAt || new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("cloud_reflections")
    .upsert(payload, { onConflict: "user_id,challenge_slug,day_number" })
    .select()
    .single();
  if (error) throw normalizeError(error, "The reflection was saved locally, but cloud sync failed.");
  return data;
}

export async function getCloudReflections() {
  if (!config.enableCloudSync || config.mode !== "supabase") return [];
  const session = await getSession();
  if (!session?.profile?.cloudSyncEnabled) return [];
  requireSupabaseMode();

  const { data, error } = await supabase
    .from("cloud_reflections")
    .select("*")
    .eq("challenge_slug", config.challengeSlug)
    .order("day_number");
  if (error) throw normalizeError(error, "Cloud reflections could not be loaded.");

  return (data || []).map((row) => ({
    userId: row.user_id,
    challengeSlug: row.challenge_slug,
    dayNumber: Number(row.day_number),
    promptId: row.prompt_id,
    promptVersionId: row.prompt_version_id,
    promptTitle: row.prompt_snapshot?.title || "",
    promptQuestion: row.prompt_snapshot?.question || "",
    stageId: row.prompt_snapshot?.stageId || stageForDay(Number(row.day_number)).id,
    response: row.response_text || "",
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.client_updated_at || row.updated_at
  }));
}

export async function deleteCloudReflections() {
  if (!config.enableCloudSync || config.mode !== "supabase") return 0;
  const session = await getSession();
  if (!session) throw new Error("Sign in to remove cloud reflections.");
  requireSupabaseMode();

  const { error, count } = await supabase
    .from("cloud_reflections")
    .delete({ count: "exact" })
    .eq("challenge_slug", config.challengeSlug);
  if (error) throw normalizeError(error, "Cloud reflection copies could not be deleted.");
  return Number(count || 0);
}

export async function recordEvent(eventType, metadata = {}) {
  await initializeBackend();
  if (config.mode !== "supabase") return;
  // Completed-day status powers participant progress statistics even when
  // optional product analytics are disabled. Other event types respect the
  // analytics switch.
  if (!config.analytics && eventType !== "reflection_saved") return;
  const { error } = await supabase.rpc("record_participant_event", {
    p_event_type: eventType,
    p_metadata: metadata,
    p_challenge_slug: config.challengeSlug
  });
  if (error) console.warn("Analytics event was not recorded:", error.message);
}

export async function getAdminOverview() {
  await initializeBackend();
  requireSupabaseMode();
  const { data, error } = await supabase.rpc("admin_dashboard", {
    p_challenge_slug: config.challengeSlug
  });
  if (error) throw normalizeError(error, "The administrator overview could not be loaded.");
  const result = Array.isArray(data) ? data[0] : data;
  return {
    registeredParticipants: Number(result.registered_participants || 0),
    activeParticipants: Number(result.active_participants || 0),
    completedChallenges: Number(result.completed_challenges || 0),
    publishedPrompts: Number(result.published_prompts || 0),
    completionRate: Number(result.completion_rate || 0),
    recentParticipants: (result.recent_participants || []).map(mapProfile)
  };
}

export async function getAdminPrompts() {
  await initializeBackend();
  requireSupabaseMode();
  const { data, error } = await supabase.rpc("admin_list_prompts", {
    p_challenge_slug: config.challengeSlug
  });
  if (error) throw normalizeError(error, "Prompts could not be loaded.");
  return (data || []).map(mapPrompt).sort((a, b) => a.dayNumber - b.dayNumber);
}

export async function getPromptVersions(promptId) {
  await initializeBackend();
  requireSupabaseMode();
  const { data, error } = await supabase.rpc("admin_prompt_versions", { p_prompt_id: promptId });
  if (error) throw normalizeError(error, "Prompt version history could not be loaded.");
  return (data || []).map(mapPromptVersion);
}

export async function saveAdminPrompt(input) {
  await initializeBackend();
  requireSupabaseMode();

  const normalized = {
    id: input.id || null,
    dayNumber: Number(input.dayNumber),
    stageId: input.stageId || stageForDay(Number(input.dayNumber)).id,
    title: String(input.title || "").trim(),
    introduction: String(input.introduction || "").trim(),
    question: String(input.question || "").trim(),
    followUp: String(input.followUp || "").trim(),
    status: input.status === "unpublished" ? "unpublished" : "published"
  };
  if (normalized.dayNumber < 1 || normalized.dayNumber > CHALLENGE.durationDays) {
    throw new Error(`Day number must be between 1 and ${CHALLENGE.durationDays}.`);
  }
  if (!normalized.title || !normalized.question) throw new Error("A title and main question are required.");

  const { data, error } = await supabase.rpc("admin_save_prompt", {
    p_prompt_id: normalized.id,
    p_challenge_slug: config.challengeSlug,
    p_day_number: normalized.dayNumber,
    p_stage_slug: normalized.stageId,
    p_title: normalized.title,
    p_introduction: normalized.introduction,
    p_question: normalized.question,
    p_follow_up: normalized.followUp || null,
    p_status: normalized.status
  });
  if (error) throw normalizeError(error, "The prompt could not be saved.");
  return mapPrompt(Array.isArray(data) ? data[0] : data);
}

export async function setAdminPromptStatus(promptId, status) {
  await initializeBackend();
  requireSupabaseMode();
  const normalized = status === "unpublished" ? "unpublished" : "published";
  const { data, error } = await supabase.rpc("admin_set_prompt_status", {
    p_prompt_id: promptId,
    p_status: normalized
  });
  if (error) throw normalizeError(error, "The prompt status could not be changed.");
  return mapPrompt(Array.isArray(data) ? data[0] : data);
}

export async function getAdminParticipants() {
  await initializeBackend();
  requireSupabaseMode();
  const { data, error } = await supabase.rpc("admin_participants", {
    p_challenge_slug: config.challengeSlug
  });
  if (error) throw normalizeError(error, "Participant information could not be loaded.");
  return (data || []).map((row) => ({
    ...mapProfile(row),
    currentDay: Number(row.current_day || 0),
    completedCount: Number(row.completed_count || 0)
  }));
}

export async function updateParticipantStatus(userId, status) {
  await initializeBackend();
  requireSupabaseMode();
  const allowed = ["active", "paused", "deactivated", "completed"];
  if (!allowed.includes(status)) throw new Error("Invalid participant status.");
  const { data, error } = await supabase.rpc("admin_update_participant_status", {
    p_user_id: userId,
    p_status: status
  });
  if (error) throw normalizeError(error, "The participant status could not be updated.");
  return data;
}

export async function saveAdminContent(payload) {
  await initializeBackend();
  requireSupabaseMode();
  const content = { ...DEFAULT_CONTENT, ...payload, updatedAt: new Date().toISOString() };
  const { data, error } = await supabase.rpc("admin_save_site_content", {
    p_challenge_slug: config.challengeSlug,
    p_payload: content
  });
  if (error) throw normalizeError(error, "Website content could not be saved.");
  return Array.isArray(data) ? data[0] : data;
}

export async function getAdminAnalytics() {
  await initializeBackend();
  requireSupabaseMode();
  const { data, error } = await supabase.rpc("admin_analytics", {
    p_challenge_slug: config.challengeSlug
  });
  if (error) throw normalizeError(error, "Analytics could not be loaded.");
  const result = Array.isArray(data) ? data[0] : data;
  return {
    stageCompletion: result.stage_completion || [],
    registrations: result.registrations || [],
    totalEvents: Number(result.total_events || 0),
    averageCompleted: Number(result.average_completed || 0),
    returnRate: Number(result.return_rate || 0)
  };
}
