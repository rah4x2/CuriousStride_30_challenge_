# CuriousStride Launch Checklist

## Brand and content

- [ ] Existing CuriousStride colors and the teal, purple, pink and yellow accents are used consistently.
- [ ] Lora is used for headings and DM Sans for body/interface text.
- [ ] Homepage language matches the final brand voice.
- [ ] All 30 prompts have been reviewed for clarity, inclusion and suitability.
- [ ] Each prompt is assigned to the correct day and stage.
- [ ] The support email, public domain, privacy copy and organisation details are real.

## Authentication, onboarding and roles

- [ ] Google OAuth works on localhost and the production domain.
- [ ] Supabase Site URL and redirect URLs exactly match the deployed URL.
- [ ] Every new Google user starts as a participant.
- [ ] There is no admin registration, role selector, admin-request button or self-promotion RPC.
- [ ] The first administrator was added manually to `public.admin_users`.
- [ ] A separate ordinary participant cannot access any administrator page or RPC.
- [ ] Removing an `admin_users` row removes administrator access after a new session.
- [ ] The onboarding guide appears before Day 1 and records both required acknowledgements.
- [ ] The participant can reopen the guide from Settings.
- [ ] No service-role/secret key, Google Client Secret or database password appears in public files.

## Journey behavior

- [ ] Day 1 begins only after onboarding is completed.
- [ ] A missed day leaves earlier prompts available and never resets progress.
- [ ] Future prompt text is not shipped in the production static bundle.
- [ ] Prompt unlocking is correct around midnight and in representative timezones.
- [ ] Day 30 opens the completion experience even when earlier prompts remain incomplete.
- [ ] Prompt edits preserve the versions already assigned to participants.

## Privacy and storage

- [ ] Participants see the local-storage limitation before relying on the journal.
- [ ] The guide and writing page warn against passwords, financial details, IDs, medical records and other highly sensitive information.
- [ ] The guide clearly states that CuriousStride is not therapy, medical advice, crisis support or professional career counselling.
- [ ] Journal text remains absent from administrator pages and analytics.
- [ ] JSON backup and restore have been tested.
- [ ] PDF output remains readable with long responses and multiple pages.
- [ ] Clear-local-data removes only the signed-in participant's browser records.
- [ ] Cloud sync is opt-in and owner-only when enabled.
- [ ] Deleting cloud copies removes the current account's synced rows and disables sync.

## Notifications

- [ ] Reminders are opt-in, not preselected.
- [ ] Reminder time and timezone are saved correctly.
- [ ] Reminder emails contain no journal text and no future prompt text.
- [ ] The settings link lets the participant disable reminders.
- [ ] The scheduler sends the protected Supabase secret API key in `apikey` and the configured `x-scheduler-secret` header.
- [ ] The Edge Function reads `SUPABASE_SECRET_KEYS["default"]` or the documented legacy fallback; no secret key appears in browser files.
- [ ] Duplicate reminder delivery is prevented for the same participant/local date.
- [ ] Sender domain, unsubscribe/support path and provider configuration have been approved.

## Accessibility and responsive testing

- [ ] Complete participant and admin flows using only a keyboard.
- [ ] Verify visible focus indicators and a working skip link.
- [ ] Test with a screen reader on sign-in, onboarding, dashboard and writing pages.
- [ ] Day states include text/icons and do not depend only on color.
- [ ] Test at 320px, 768px, 1024px and a wide desktop viewport.
- [ ] Test current Chrome, Safari, Firefox and Edge.
- [ ] Confirm animations respect reduced-motion preferences.

## Reliability and deployment

- [ ] Autosave shows Saving, Saved and Error states truthfully.
- [ ] Close the browser while typing and verify emergency-draft recovery.
- [ ] Test offline shell behavior after the first successful page load.
- [ ] Run `npm run check` and verify every test passes.
- [ ] Build from a clean copy using `npm run build`.
- [ ] Inspect `dist/` and confirm it contains no tests, SQL source, setup documents or secret credentials.
- [ ] Deploy only `dist/`.
- [ ] Configure Supabase backups, logs, least-privilege operator access and incident response.
