# Supabase, Google Sign-In and Production Setup

This guide turns the downloaded project from safe setup mode into a real CuriousStride deployment.

## 1. Create the Supabase project

Create a Supabase project in the region that best fits your participants and record:

- the Project URL;
- the browser-safe publishable key, or legacy anon key;
- the database password in your own password manager.

Do not put the database password, secret key or service-role key in this project.

## 2. Create the database

Open **SQL Editor** in Supabase and run these files in order:

1. `supabase/schema.sql`
2. `supabase/seed.sql`

The schema creates:

- participant profiles and onboarding fields;
- five challenge stages;
- prompts, prompt versions and per-participant assignments;
- site content;
- administrator membership;
- privacy-aware participation events and completion status;
- optional owner-only cloud reflections;
- optional reminder delivery records;
- Row Level Security and secured RPC functions.

Re-running `schema.sql` is designed to be upgrade-friendly, but back up a live database and review migrations before changing a production system.

## 3. Configure Google OAuth

### In Google Cloud

1. Create or select a Google Cloud project.
2. Configure the OAuth consent screen.
3. Create an **OAuth client ID** for a web application.
4. Add the callback URL shown in Supabase under **Authentication -> Providers -> Google**.
5. Copy the Google Client ID and Client Secret into Supabase only.

### In Supabase

1. Open **Authentication -> Providers -> Google**.
2. Enable Google.
3. Enter the Google Client ID and Client Secret.
4. Open **Authentication -> URL Configuration**.
5. Set the production Site URL.
6. Add redirect URLs for development and production, for example:

```text
http://127.0.0.1:4173/**
https://www.your-domain.com/**
```

Do not add the Google Client Secret to `config.local.js`.

## 4. Configure the website

Copy the example file:

```bash
cp config.example.js config.local.js
```

On Windows PowerShell:

```powershell
Copy-Item config.example.js config.local.js
```

Edit `config.local.js`:

```js
window.CURIOUSSTRIDE_CONFIG = Object.freeze({
  mode: "supabase",
  siteUrl: "http://127.0.0.1:4173",
  challengeSlug: "curiousstride-30-day",
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_BROWSER_SAFE_PUBLISHABLE_OR_ANON_KEY",
  enableCloudSync: true,
  enableReminders: false,
  defaultTimezone: "Asia/Dubai",
  supportEmail: "hello@your-real-domain.com",
  analytics: true,
  onboardingVersion: 1
});
```

The publishable/anon key is designed for browser use. Security must come from Row Level Security and the secured RPCs in `schema.sql`. Never substitute a secret/service-role key.

Run the site:

```bash
npm start
```

Open `http://127.0.0.1:4173` and test Google sign-in.

## 5. Grant the first administrator manually

Every new Google-authenticated account is a participant. The website contains no admin-signup form, role selector or participant-controlled promotion function.

1. Sign in once using the Google account that should administer CuriousStride.
2. In Supabase **SQL Editor**, run the following after replacing the email:

```sql
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('owner@your-domain.com')
on conflict (user_id) do nothing;
```

3. Verify exactly the intended account was added:

```sql
select a.user_id, u.email, a.created_at
from public.admin_users a
join auth.users u on u.id = a.user_id
order by a.created_at;
```

4. Sign out of CuriousStride and sign in again. The Admin navigation item appears only after the backend verifies the role.

To remove administrator access:

```sql
delete from public.admin_users
where user_id = (
  select id from auth.users where lower(email) = lower('owner@your-domain.com')
);
```

Do not create an email allow-list in frontend JavaScript. Do not grant participants write access to `admin_users`. A user who manually types `/#/admin` still fails the server-side role check unless their authenticated user ID is in that protected table.

## 6. Participant onboarding and challenge start

After the first successful sign-in, CuriousStride shows a required guide. The participant must:

- choose a timezone;
- acknowledge the local-storage and sensitive-information warning;
- acknowledge that the challenge is not professional care or counselling;
- optionally opt into reminders when reminders are enabled.

The secured `complete_my_onboarding` RPC records the acknowledgement and starts Day 1. Participants cannot rewrite their protected start date from the browser.

Increase `onboardingVersion` in the runtime config only when a material policy/guide update requires existing participants to acknowledge a revised guide.

## 7. Optional cloud reflection sync

Cloud sync is disabled for each participant until they explicitly enable it in Settings. When enabled, entries are written to `cloud_reflections`.

Row Level Security permits only the authenticated owner to select, insert, update or delete their own rows through the browser client. The administrator interface has no journal-text endpoint or viewer.

Keep in mind that trusted project operators with privileged database credentials can technically access database contents. Limit privileged access, document operational access and never expose secret/service-role credentials.

Set `enableCloudSync: false` in `config.local.js` when you want a strictly local-storage launch.

## 8. Optional email reminders

The participant reminder is opt-in. The included `supabase/functions/send-reminders/index.ts`:

- checks the participant's saved timezone and local reminder time;
- requires completed onboarding and an active account;
- sends only when that local challenge day has a published prompt;
- links to My Journey without placing the prompt or journal text in the email;
- prevents duplicate delivery with `reminder_deliveries`.

You need a Resend account (or adapt the function for another provider) and a verified sender domain.

Install the Supabase CLI, link the project, then set function secrets:

```bash
supabase secrets set RESEND_API_KEY=...
supabase secrets set REMINDER_FROM_EMAIL="CuriousStride <reminders@your-domain.com>"
supabase secrets set SITE_URL="https://www.your-domain.com"
supabase secrets set CHALLENGE_SLUG="curiousstride-30-day"
supabase secrets set SCHEDULER_SECRET="GENERATE_A_LONG_RANDOM_VALUE"
```

Supabase injects the current `SUPABASE_SECRET_KEYS` JSON map into Edge Functions. The included function reads its `default` secret key and falls back to the legacy `SUPABASE_SERVICE_ROLE_KEY` only for older projects. Neither value belongs in browser code or source control. Do not try to create a custom secret whose name begins with `SUPABASE_`; that prefix is reserved by Supabase.

The included `supabase/config.toml` sets `verify_jwt = false` for this scheduled service-to-service function. The function still rejects requests unless they include your separate `x-scheduler-secret`. Deploy it with:

```bash
supabase functions deploy send-reminders
```

Create a Cron job that calls the function approximately every five minutes. Store the project URL, your project's **secret API key** and `SCHEDULER_SECRET` in Supabase Vault or another protected scheduler secret store. Send these request headers:

```text
apikey: YOUR_SUPABASE_SECRET_API_KEY
x-scheduler-secret: YOUR_SCHEDULER_SECRET
Content-Type: application/json
```

Use a secret API key for this server-to-server call, never the browser publishable key. Then set:

```js
enableReminders: true
```

in `config.local.js`. Test opt-in, opt-out, timezone changes and duplicate prevention before launch.

## 9. Build and deploy

Run the automated checks:

```bash
npm run check
```

Create the production files:

```bash
npm run build
```

Before building, change `siteUrl` in `config.local.js` from localhost to the final HTTPS production URL and replace every placeholder with real public values.

The build will stop when:

- `config.local.js` is missing;
- the mode is not `supabase`;
- obvious placeholder values remain;
- `siteUrl` is not the final HTTPS production URL;
- the Supabase URL is not HTTPS;
- the support email is invalid; or
- a secret/service-role credential appears where a browser-safe publishable/anon key is expected.

It creates `dist/` with only the deployable application files. Setup documents, tests, database source files and future prompt data are not copied into the public static bundle.

Deploy only `dist/`. Netlify and Vercel redirect configuration files are provided at the source-project root; copy the relevant setting into your hosting project as needed. The application uses hash routes, so ordinary static hosting works.

## 10. Production checks

Before inviting participants:

- replace all example emails and domain names;
- review and publish all 30 prompts;
- test with one administrator account and a completely separate participant account;
- verify that the participant cannot access admin RPCs or create an admin record;
- verify future prompt text is absent from the deployed static files;
- test onboarding, Day 1, missed days and Day 30;
- test local autosave, browser restart recovery, PDF export and JSON restore;
- test reminder consent and unsubscribe behavior when reminders are enabled;
- test at mobile, tablet and desktop widths;
- review your legal/privacy wording with an appropriately qualified adviser for your organisation and jurisdiction;
- configure production logging, backups and access controls in Supabase.
