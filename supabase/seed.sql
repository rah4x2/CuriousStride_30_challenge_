-- CuriousStride seed data. Run after schema.sql.

insert into public.challenges (slug, title, description, duration_days, active)
values ('curiousstride-30-day', 'CuriousStride 30-Day Reflection Challenge', 'One thoughtful reflection prompt each day for 30 days.', 30, true)
on conflict (slug) do update set title = excluded.title, description = excluded.description, duration_days = excluded.duration_days, active = true;

insert into public.stages (challenge_id, slug, name, description, start_day, end_day, sort_order)
select c.id, 'self-discovery', 'Self-Discovery', 'Notice your present chapter, experiences and the parts of yourself that feel most authentic.', 1, 6, 1
from public.challenges c where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, slug) do update set name = excluded.name, description = excluded.description, start_day = excluded.start_day, end_day = excluded.end_day, sort_order = excluded.sort_order;

insert into public.stages (challenge_id, slug, name, description, start_day, end_day, sort_order)
select c.id, 'values-priorities', 'Values & Priorities', 'Explore what matters to you and how closely your everyday choices reflect it.', 7, 12, 2
from public.challenges c where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, slug) do update set name = excluded.name, description = excluded.description, start_day = excluded.start_day, end_day = excluded.end_day, sort_order = excluded.sort_order;

insert into public.stages (challenge_id, slug, name, description, start_day, end_day, sort_order)
select c.id, 'mindset-growth', 'Mindset & Growth', 'Consider how you respond to uncertainty, learning, progress and unfamiliar possibilities.', 13, 18, 3
from public.challenges c where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, slug) do update set name = excluded.name, description = excluded.description, start_day = excluded.start_day, end_day = excluded.end_day, sort_order = excluded.sort_order;

insert into public.stages (challenge_id, slug, name, description, start_day, end_day, sort_order)
select c.id, 'direction-purpose', 'Direction & Purpose', 'Explore possible futures, meaningful work and your own definition of success.', 19, 24, 4
from public.challenges c where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, slug) do update set name = excluded.name, description = excluded.description, start_day = excluded.start_day, end_day = excluded.end_day, sort_order = excluded.sort_order;

insert into public.stages (challenge_id, slug, name, description, start_day, end_day, sort_order)
select c.id, 'intentional-living', 'Intentional Living', 'Turn what you have noticed into practical intentions, routines and small next steps.', 25, 30, 5
from public.challenges c where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, slug) do update set name = excluded.name, description = excluded.description, start_day = excluded.start_day, end_day = excluded.end_day, sort_order = excluded.sort_order;

insert into public.site_content (challenge_id, payload, published, updated_at)
select c.id, '{"registrationsOpen":true,"homeHeading":"30 days to reconnect with yourself and explore what’s next.","homeIntro":"Graduation, new beginnings and changing expectations can leave us with more questions than answers. CuriousStride offers one thoughtful prompt each day to help you notice where you are, recognise what matters and explore your next chapter.","aboutHeading":"A quieter way to find your next step.","aboutBody":"CuriousStride was created for students, recent graduates and anyone navigating a changing chapter. It does not promise a complete transformation in 30 days. It gives you consistent space, useful questions and permission to understand yourself gradually.","howHeading":"One prompt. One day. Your own pace.","privacySummary":"Your journal is stored on this browser unless you explicitly turn on optional cloud sync. CuriousStride never asks for your Google password and administrators do not receive access to your private reflections.","benefits":[{"title":"Create a gentle routine","description":"Build a small daily pause for reflection without an overwhelming list of questions."},{"title":"Recognise what matters","description":"Explore your values, priorities, interests and the expectations influencing your choices."},{"title":"Explore possible directions","description":"Consider work, learning and life possibilities without forcing yourself into one perfect answer."},{"title":"Take a practical next step","description":"Turn new understanding into small actions that fit the life you actually want to build."}],"faqs":[{"question":"Do I need to start on a particular date?","answer":"No. Your Day 1 begins when you start the challenge, and your personal 30-day schedule continues from there."},{"question":"What happens if I miss a day?","answer":"Nothing resets. Earlier prompts remain available, so you can return when you have the time and energy to reflect."},{"question":"Can CuriousStride read my journal?","answer":"In the default local-storage mode, your responses remain in your browser. The administrator dashboard shows participation information, not journal text."},{"question":"Will my answers appear on another device?","answer":"Not automatically in local-storage mode. You can export a backup, or opt into cloud sync when that feature is enabled by the site owner."},{"question":"Should I include sensitive personal information?","answer":"No. Avoid passwords, financial details, identification numbers, medical records and other highly sensitive information. Local browser storage is not an encrypted private vault."},{"question":"Is this therapy or career counselling?","answer":"No. CuriousStride is a self-guided reflection experience. It is not a substitute for therapy, medical advice, crisis support or professional career counselling."}]}'::jsonb, true, now()
from public.challenges c where c.slug = 'curiousstride-30-day'
on conflict (challenge_id) do update set payload = excluded.payload, published = true, updated_at = now();

-- Day 1: Your present chapter
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 1, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'self-discovery'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Your present chapter', 'Before looking ahead, begin by noticing where you are now — without judging whether you should already be somewhere else.', 'How would you describe the chapter of life you are in right now?', 'What feels clear, and what still feels uncertain?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 1
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 1 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 2: What has changed
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 2, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'self-discovery'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'What has changed', 'Change can be obvious or almost invisible. Looking back can reveal how much has shifted beneath the surface.', 'What has changed most in your life or in you over the past year?', 'Which change has been easiest to accept, and which has taken more adjustment?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 2
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 2 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 3: Feeling like yourself
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 3, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'self-discovery'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Feeling like yourself', 'There are often moments when effort, expectation and self-consciousness become quieter.', 'When do you feel most like yourself?', 'Where are you, what are you doing, and who are you with in those moments?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 3
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 3 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 4: Energy clues
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 4, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'self-discovery'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Energy clues', 'Energy is useful information. It can show what restores you, what absorbs you and what quietly drains you.', 'Which activities, environments or conversations tend to give you energy?', 'What tends to leave you depleted, even when you do it well?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 4
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 4 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 5: Strengths in ordinary life
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 5, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'self-discovery'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Strengths in ordinary life', 'Strengths are not only impressive achievements. They often appear in the ordinary ways you respond, contribute and solve problems.', 'What do people regularly rely on you for?', 'Which of those qualities do you value in yourself, and which might you take for granted?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 5
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 5 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 6: A recent lesson
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 6, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'self-discovery'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'A recent lesson', 'Self-understanding often grows through small observations rather than dramatic revelations.', 'What have you learned about yourself recently?', 'What experience helped you notice it?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 6
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 6 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 7: What matters now
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 7, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'values-priorities'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'What matters now', 'Priorities can change with each season of life. Naming today’s priorities can reduce the pressure to solve everything at once.', 'What matters most to you in this chapter of your life?', 'Which three priorities would you protect if your time and energy became limited?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 7
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 7 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 8: A meaningful day
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 8, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'values-priorities'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'A meaningful day', 'A meaningful life is built from ordinary days. Imagine one that feels grounded rather than perfect.', 'What would a meaningful, realistic day look like for you?', 'Which part of that day is already possible in your current life?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 8
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 8 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 9: Time and priorities
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 9, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'values-priorities'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Time and priorities', 'Your calendar may not perfectly represent your values, but it can show what is currently receiving your attention.', 'How closely does the way you spend your time reflect what matters to you?', 'Where is there alignment, and where is there tension?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 9
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 9 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 10: Your expectations
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 10, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'values-priorities'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Your expectations', 'Some expectations are chosen. Others are inherited from family, culture, peers or an earlier version of yourself.', 'Which expectations in your life feel genuinely yours?', 'Which expectations might belong more to other people than to you?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 10
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 10 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 11: What you want more of
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 11, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'values-priorities'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'What you want more of', 'Wanting more does not always mean wanting bigger. It might mean more calm, curiosity, connection, challenge or space.', 'What would you like more of in your everyday life?', 'What would you be willing to make a little less room for?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 11
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 11 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 12: A decision filter
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 12, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'values-priorities'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'A decision filter', 'Values become practical when they help you make choices, especially when several options are reasonable.', 'What principles would you like to use when making an important decision?', 'How might those principles change a decision you are currently considering?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 12
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 12 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 13: Your definition of progress
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 13, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'mindset-growth'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Your definition of progress', 'Progress is easy to measure by comparison, speed or visible milestones. Your own definition may be quieter and more useful.', 'What does progress mean to you at this point in your life?', 'What evidence of progress might you be overlooking?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 13
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 13 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 14: Meeting uncertainty
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 14, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'mindset-growth'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Meeting uncertainty', 'Uncertainty can invite curiosity and fear at the same time. Both reactions can be present without either one defining you.', 'How do you usually respond when you do not know what comes next?', 'What helps you remain steady enough to keep exploring?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 14
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 14 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 15: A belief to examine
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 15, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'mindset-growth'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'A belief to examine', 'A belief can be protective in one season and limiting in another. You do not need to replace it immediately; begin by noticing it.', 'What belief about yourself or your future might be worth questioning?', 'What experience supports that belief, and what experience complicates it?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 15
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 15 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 16: Learning next
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 16, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'mindset-growth'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Learning next', 'Curiosity can provide direction before certainty arrives.', 'What would you genuinely enjoy learning more about?', 'What is one low-pressure way to explore it?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 16
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 16 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 17: When plans change
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 17, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'mindset-growth'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'When plans change', 'A disrupted plan can feel like failure even when it reveals a better route, a needed pause or new information.', 'Think of a time something did not go according to plan. How did you adapt?', 'What did that experience show you about your resourcefulness?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 17
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 17 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 18: A small experiment
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 18, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'mindset-growth'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'A small experiment', 'You do not need total confidence before trying something. A small experiment can give you information without demanding a permanent commitment.', 'What unfamiliar opportunity or idea would you be willing to test in a small way?', 'How could you make the experiment safe, specific and easy to begin?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 18
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 18 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 19: A life that fits
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 19, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'direction-purpose'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'A life that fits', 'Direction is not only about choosing a job title. It is also about the rhythm, relationships and responsibilities surrounding your work.', 'What kind of life would you like your work or studies to support?', 'Which parts of that life matter more than status or appearance?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 19
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 19 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 20: Curiosity map
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 20, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'direction-purpose'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Curiosity map', 'Recurring curiosity can be a clue, even when it has not yet become a plan.', 'Which subjects, problems, industries or communities keep drawing your attention?', 'What is it about them that interests you?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 20
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 20 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 21: Work that feels worthwhile
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 21, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'direction-purpose'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Work that feels worthwhile', 'Meaningful work can involve contribution, mastery, stability, creativity, service, autonomy or many other qualities.', 'What would make work feel worthwhile to you?', 'Which qualities are essential, and which would simply be nice to have?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 21
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 21 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 22: Your working environment
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 22, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'direction-purpose'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Your working environment', 'People can thrive in very different settings. Notice the conditions that help you contribute without exhausting yourself.', 'In what kind of working or learning environment do you tend to do your best?', 'Consider pace, structure, people, independence, feedback and physical setting.'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 22
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 22 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 23: Success in your own words
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 23, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'direction-purpose'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Success in your own words', 'Definitions of success can be inherited before they are examined. Rewriting yours can make future choices more intentional.', 'How would you define success if nobody else could see or judge your life?', 'What would you stop using as proof that you are doing well?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 23
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 23 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 24: Several possible futures
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 24, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'direction-purpose'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Several possible futures', 'There may be more than one good direction. Imagining alternatives can reduce the pressure to identify one perfect path.', 'What are three different futures you could imagine being curious to explore?', 'What small clue could help you learn more about each one?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 24
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 24 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 25: A supportive routine
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 25, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'intentional-living'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'A supportive routine', 'A routine should support your life, not become another standard you feel guilty for failing to meet.', 'What simple routine would help you feel more grounded in this chapter?', 'How could you make it flexible enough to survive an imperfect week?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 25
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 25 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 26: People and support
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 26, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'intentional-living'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'People and support', 'Direction is easier to explore with people who offer perspective, encouragement, honesty or practical help.', 'Who helps you feel supported, understood or more capable?', 'Is there a conversation, request or expression of appreciation you would like to initiate?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 26
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 26 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 27: Making room
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 27, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'intentional-living'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'Making room', 'A new direction often needs space before it needs motivation.', 'What could you simplify, pause or let go of to make room for what matters now?', 'What is one boundary that could protect that space?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 27
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 27 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 28: One small action
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 28, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'intentional-living'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'One small action', 'A useful next step is often smaller than the complete solution and concrete enough to place on a calendar.', 'What is one small action you can take in the next seven days?', 'When will you do it, and what might make it easier to begin?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 28
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 28 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 29: What you want to remember
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 29, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'intentional-living'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'What you want to remember', 'Before the challenge ends, gather the observations you do not want to lose in the noise of everyday life.', 'What do you want your future self to remember from these reflections?', 'Write it as a note you could return to during a difficult or uncertain week.'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 29
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 29 and pv.prompt_id = p.id and pv.version_number = 1;

-- Day 30: The next chapter
insert into public.prompts (challenge_id, day_number, stage_id, status)
select c.id, 30, s.id, 'published'
from public.challenges c
join public.stages s on s.challenge_id = c.id and s.slug = 'intentional-living'
where c.slug = 'curiousstride-30-day'
on conflict (challenge_id, day_number) do update set stage_id = excluded.stage_id, status = excluded.status, updated_at = now();

insert into public.prompt_versions (prompt_id, version_number, title, introduction, question, follow_up)
select p.id, 1, 'The next chapter', 'You do not need to leave with every answer. The goal is to carry forward a little more clarity, self-trust and curiosity.', 'As this challenge ends, what would you like the next chapter of your life to feel like?', 'What intention can guide you even while the details remain uncertain?'
from public.prompts p
join public.challenges c on c.id = p.challenge_id
where c.slug = 'curiousstride-30-day' and p.day_number = 30
on conflict (prompt_id, version_number) do update set title = excluded.title, introduction = excluded.introduction, question = excluded.question, follow_up = excluded.follow_up;

update public.prompts p
set active_version_id = pv.id, updated_at = now()
from public.prompt_versions pv, public.challenges c
where p.challenge_id = c.id and c.slug = 'curiousstride-30-day'
  and p.day_number = 30 and pv.prompt_id = p.id and pv.version_number = 1;

-- After your first Google sign-in, grant administrator access by replacing the email below:
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'your-admin@email.com'
-- on conflict (user_id) do nothing;
