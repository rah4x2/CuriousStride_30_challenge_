/*
 * CuriousStride runtime configuration.
 *
 * The checked-in project is intentionally in setup mode. Public pages work,
 * but participant/admin sign-in remains disabled until config.local.js is
 * created with your own Supabase project values.
 */
window.CURIOUSSTRIDE_CONFIG = Object.freeze({
  mode: "setup",
  siteUrl: "http://127.0.0.1:4173",
  challengeSlug: "curiousstride-30-day",
  supabaseUrl: "",
  supabaseAnonKey: "",
  enableCloudSync: false,
  enableReminders: false,
  defaultTimezone: "UTC",
  supportEmail: "",
  analytics: false,
  onboardingVersion: 1
});
