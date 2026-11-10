// Optional Supabase Edge Function for daily email reminders.
// Deploy only after configuring RESEND_API_KEY, REMINDER_FROM_EMAIL and SITE_URL.
// Schedule it every five minutes using Supabase Cron or another trusted scheduler.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function readSupabaseSecretKey() {
  const keyMap = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keyMap) {
    try {
      const keys = JSON.parse(keyMap);
      if (typeof keys?.default === "string" && keys.default) return keys.default;
    } catch (error) {
      console.error("SUPABASE_SECRET_KEYS is not valid JSON:", error);
    }
  }
  // Legacy projects keep this injected JWT during the key-model migration.
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

const SUPABASE_SECRET_KEY = readSupabaseSecretKey();
const LEGACY_SERVICE_ROLE_JWT = SUPABASE_SECRET_KEY.split(".").length === 3;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("REMINDER_FROM_EMAIL") ?? "CuriousStride <reminders@example.com>";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://example.com";
const CHALLENGE_SLUG = Deno.env.get("CHALLENGE_SLUG") ?? "curiousstride-30-day";
const SCHEDULER_SECRET = Deno.env.get("SCHEDULER_SECRET") ?? "";

const jsonHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  apikey: SUPABASE_SECRET_KEY
};

// New sb_secret_ keys belong only in the apikey header. Legacy service-role
// JWTs still use Authorization when calling the Data API directly.
if (LEGACY_SERVICE_ROLE_JWT) {
  jsonHeaders.Authorization = `Bearer ${SUPABASE_SECRET_KEY}`;
}

function localParts(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute"))
  };
}

function dayDifference(startDate: string, currentDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const current = Date.parse(`${currentDate}T00:00:00Z`);
  return Math.floor((current - start) / 86_400_000);
}

function reminderMatches(reminderTime: string, hour: number, minute: number) {
  const [scheduledHour, scheduledMinute] = reminderTime.slice(0, 5).split(":").map(Number);
  if (
    !Number.isInteger(scheduledHour) ||
    !Number.isInteger(scheduledMinute) ||
    scheduledHour < 0 ||
    scheduledHour > 23 ||
    scheduledMinute < 0 ||
    scheduledMinute > 59
  ) return false;
  const scheduled = scheduledHour * 60 + scheduledMinute;
  const current = hour * 60 + minute;
  const elapsed = current - scheduled;
  return elapsed >= 0 && elapsed < 5;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...jsonHeaders, ...(init.headers || {}) }
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !RESEND_API_KEY || !SCHEDULER_SECRET) {
    return Response.json({ error: "Required secrets are missing." }, { status: 500 });
  }
  const suppliedSecret = request.headers.get("x-scheduler-secret") ?? "";
  if (suppliedSecret !== SCHEDULER_SECRET) {
    return Response.json({ error: "Unauthorised scheduler request." }, { status: 401 });
  }

  try {
    const challenges = await rest(`challenges?slug=eq.${encodeURIComponent(CHALLENGE_SLUG)}&select=id,duration_days&limit=1`);
    const challenge = challenges?.[0];
    if (!challenge) throw new Error("Challenge not found.");

    const publishedPrompts = await rest(
      `prompts?challenge_id=eq.${challenge.id}&status=eq.published&active_version_id=not.is.null&select=day_number`
    );
    const publishedDays = new Set((publishedPrompts || []).map((item: { day_number: number }) => Number(item.day_number)));
    const adminRows = await rest("admin_users?select=user_id");
    const adminIds = new Set((adminRows || []).map((item: { user_id: string }) => item.user_id));
    const profiles = await rest(
      "profiles?reminder_enabled=eq.true&status=eq.active&onboarding_completed_at=not.is.null&select=id,email,full_name,timezone,reminder_time,challenge_start_date"
    );
    let sent = 0;
    let skipped = 0;

    for (const profile of profiles || []) {
      try {
        if (adminIds.has(profile.id)) {
          skipped += 1;
          continue;
        }
        const local = localParts(profile.timezone || "UTC");
        if (!reminderMatches(profile.reminder_time || "19:00", local.hour, local.minute)) {
          skipped += 1;
          continue;
        }
        const durationDays = Number(challenge.duration_days || 30);
        const challengeDay = dayDifference(profile.challenge_start_date, local.date) + 1;
        if (challengeDay < 1 || challengeDay > durationDays || !publishedDays.has(challengeDay)) {
          skipped += 1;
          continue;
        }

        // Claim the local date before sending. The unique key prevents duplicate emails.
        const claim = await rest("reminder_deliveries?on_conflict=user_id,challenge_id,local_date", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
          body: JSON.stringify({
            user_id: profile.id,
            challenge_id: challenge.id,
            local_date: local.date
          })
        });
        if (!claim?.length) {
          skipped += 1;
          continue;
        }

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [profile.email],
            subject: `Your CuriousStride Day ${challengeDay} reflection is ready`,
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#30343B;background:#F8F5EF;border-radius:24px"><div style="height:6px;border-radius:999px;background:linear-gradient(90deg,#00E0BA,#91008D,#FF3483,#FFCF00);margin-bottom:28px"></div><h1 style="color:#172B4D;font-size:30px;line-height:1.2">A small pause for Day ${challengeDay}</h1><p>Hello ${escapeHtml(profile.full_name || "there")},</p><p>Your next CuriousStride reflection is ready whenever you have the time and energy for it. Missing a day never resets your journey.</p><p><a href="${escapeHtml(SITE_URL.replace(/\/$/, ""))}/#/journey" style="display:inline-block;padding:12px 20px;background:#172B4D;color:white;text-decoration:none;border-radius:999px;font-weight:700">Open My Journey</a></p><p style="color:#69717D;font-size:13px">The reflection question is kept inside your signed-in journey. Change or stop reminders any time in <a href="${escapeHtml(SITE_URL.replace(/\/$/, ""))}/#/settings" style="color:#4169B1">Settings</a>.</p></div>`
          })
        });
        if (!emailResponse.ok) {
          await rest(
            `reminder_deliveries?user_id=eq.${profile.id}&challenge_id=eq.${challenge.id}&local_date=eq.${local.date}`,
            { method: "DELETE" }
          );
          throw new Error(await emailResponse.text());
        }
        const email = await emailResponse.json();
        await rest(`reminder_deliveries?id=eq.${claim[0].id}`, {
          method: "PATCH",
          body: JSON.stringify({ provider_id: email.id || null })
        });
        sent += 1;
      } catch (error) {
        console.error(`Reminder failed for ${profile.id}:`, error);
      }
    }

    return Response.json({ sent, skipped, checked: profiles?.length || 0 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
