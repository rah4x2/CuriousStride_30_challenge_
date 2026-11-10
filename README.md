# CuriousStride 30-Day Reflection Challenge

A responsive, production-ready website for the CuriousStride guided reflection experience. It contains the public site, Google sign-in, participant onboarding, an individually timed 30-day journey, local journaling, PDF/JSON exports, optional cloud sync and email reminders, and a server-protected administrator dashboard.

## What is finalised in this version

- No participant/admin demo accounts, role-switching controls or public role selector.
- Every Google-authenticated user starts as a participant.
- Administrator access can only be granted manually in Supabase by a trusted operator.
- Server-side administrator checks protect every admin RPC and route.
- First-login guide with storage, privacy, sensitive-information and professional-support notices.
- Optional opt-in daily email reminder preference.
- Individual Day 1 start after onboarding; missing a day never resets the journey.
- IndexedDB journal storage by default, with PDF and JSON backup/export.
- Optional owner-only cloud reflection sync.
- The original CuriousStride palette plus four energetic accents:
  - Midnight navy `#172B4D`
  - Curious blue `#4169B1`
  - Soft sky `#DCE8F7`
  - Warm ivory `#F8F5EF`
  - Charcoal `#30343B`
  - Champagne `#C4AB79`
  - Teal `#00E0BA`
  - Purple `#91008D`
  - Pink `#FF3483`
  - Yellow `#FFCF00`

## Open the project in VS Code

1. Extract the ZIP.
2. Open the `curiousstride-30-day-challenge` folder in VS Code.
3. Open **Terminal -> New Terminal**.
4. Run:

```bash
npm start
```

5. Open `http://127.0.0.1:4173`.

No `npm install` is required. The checked-in configuration uses **safe setup mode**: public pages work, but sign-in is disabled until you connect your own Supabase project. This prevents a downloaded source package from accidentally exposing a fake administrator flow.

You may also press **Ctrl/Cmd + Shift + B** and choose **Run CuriousStride** from the included VS Code task.

## Connect Supabase and Google sign-in

Follow [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md). The main steps are:

1. Create a Supabase project.
2. Run `supabase/schema.sql`, then `supabase/seed.sql` in Supabase SQL Editor.
3. Configure Google OAuth in Google Cloud and Supabase Authentication.
4. Copy `config.example.js` to `config.local.js`.
5. Add the public Supabase project URL and publishable/anon key.
6. Sign in once with the Google account that should be the owner.
7. Add that user manually to `public.admin_users` using the SQL in the setup guide.
8. Test with a separate ordinary participant account.
9. Change `siteUrl` to your final HTTPS domain, run `npm run build` and deploy only the generated `dist/` folder.

For local OAuth testing, `config.local.js` may use `http://127.0.0.1:4173`. The production builder deliberately refuses localhost and privileged Supabase credentials.

Never place a Google Client Secret, database password, Supabase secret key or service-role key in browser files.

## Account model

### Participant account

A visitor selects **Continue with Google**. Supabase authenticates the identity and CuriousStride creates a participant profile. The participant then completes the first-login guide, chooses a timezone and optionally opts into reminders. Day 1 begins only after that onboarding step.

Participants can access only their own journey. Future prompts are returned by a secured database RPC only when the participant is entitled to see them. Journal responses stay in IndexedDB by default and are not visible in the administrator dashboard.

### Administrator account

There is no administrator registration page, role selector, approval request or self-promotion action. An administrator must:

1. sign in normally once;
2. be inserted into `public.admin_users` from a trusted Supabase SQL session;
3. sign out and back in.

Typing `/#/admin` does not grant access. The backend checks the signed-in user's administrator record for every protected operation. Removing the row removes administrator access.

## Participant experience

- Homepage, About, How It Works, Privacy and sign-in pages.
- Mandatory first-login guide and acknowledgements.
- Explicit warning not to enter passwords, financial details, identification numbers, medical records or other highly sensitive information.
- Clear statement that the experience is not therapy, medical advice, crisis support or professional career counselling.
- Individual start date and saved timezone.
- 30-day progress tracker with completed, available and locked states.
- One prompt per day, with all earlier unlocked prompts still accessible.
- Large writing area with autosave and truthful saving/error indicators.
- Browser-local journal keyed to the authenticated participant and challenge day.
- Reflection history, search, filtering and editing.
- PDF export and JSON backup/restore.
- Completion page with three closing reflections.
- Settings for reminders, cloud sync, export and local-data deletion.

## Administrator experience

- Protected administrator overview.
- Registration, active-participant, completion and prompt-readiness statistics.
- Prompt creation, editing, publishing and unpublishing.
- Stage/day scheduling and immutable prompt version history.
- Site-content and FAQ management.
- Participant account/progress status management without journal-text access.
- Aggregate analytics that exclude administrator accounts.

## Optional email reminders

The participant must opt in. Reminder preferences store a local time and timezone. The included Supabase Edge Function can be scheduled to send one email on a participant's eligible local day. The email links back to My Journey and does not reveal the private prompt or any journal text.

See the reminder section in [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md). A transactional provider such as Resend is still required, together with a verified sender domain. The function supports Supabase's current named secret-key map and a legacy service-role fallback for older projects.

## Commands

```bash
npm start       # Run source locally in safe setup or configured Supabase mode
npm test        # Run product, security and configuration checks
npm run check   # Syntax-check key modules, then run the tests
npm run build   # Create a production dist/; requires valid config.local.js
```

## Storage and privacy model

| Data | Default location | Administrator access |
|---|---|---|
| Google identity and email | Supabase Auth | Basic account information only when authorised |
| Start date, timezone, status and preferences | Supabase database | Yes, through protected admin functions |
| Official prompts and versions | Supabase database | Yes, through protected admin functions |
| Journal responses | IndexedDB in the participant's browser | No |
| Optional cloud-synced journal | Owner-only Supabase rows | No journal viewer is provided |
| Reminder delivery log | Supabase database | Operational metadata only |

Local browser storage is not an encrypted vault and does not automatically follow a participant to another device. The interface therefore includes a clear warning and export controls.

## Project structure

```text
assets/
  css/styles.css              Responsive visual system and brand palette
  js/app.js                   Routing, guards and page orchestration
  js/views/                   Public, participant and administrator views
  js/services/                Supabase backend, IndexedDB and PDF export
  js/data/                    Default public content and five stages
supabase/schema.sql           Tables, RLS, triggers and secured RPCs
supabase/seed.sql             Five stages, public content and 30 prompts
supabase/functions/           Optional reminder Edge Function
supabase/config.toml          Edge Function authentication setting
docs/SUPABASE_SETUP.md        End-to-end backend/auth/reminder setup
docs/LAUNCH_CHECKLIST.md      Pre-launch verification checklist
server.js                     Dependency-free local static server
build.js                      Production-only build script
tests/run-tests.mjs           Automated product and security checks
```

## Production note

The checked-in application contains no demo-account or preview-role pathway. The source opens in safe setup mode until your own Supabase configuration is added. The production builder copies only deployable static assets into `dist/`; future prompt text is served only by the secured Supabase backend.
