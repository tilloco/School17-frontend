AUTONOMOUS BUILD: School17 feature work. Work in THIS project folder only. I will be away for hours. Do NOT ask for approval between steps. Make sensible decisions, record each in DECISIONS.md with one line of reasoning, and keep going. Do not end your turn and do not write progress summaries: keep calling tools until every milestone is done or a stop condition applies. Stop and wait only if: (a) you need a secret or key from me, (b) something would cost money or create an account, (c) an action would touch files outside this folder, production data or real users' data, or (d) you are blocked and no safe alternative exists.

START
1. First action: save this entire brief word for word as BRIEF.md in the project root.
2. Read-only discovery: git status and git log -10, README, package or requirements files, config, folder structure, auth, data layer, existing tests. Write NOTES_FOR_CLAUDE.md: what exists, stack and versions, how to run and test, folder map, where auth/data/payments live, environment variable NAMES only, what is half-done, risks, anything that looks like a committed secret.
3. If the working tree has uncommitted changes, make one local commit "Baseline before feature work". Then create the branch claude/school17-features. Commit locally after every milestone. Never push, never add a remote, never deploy.
4. EXTEND the existing project. Follow its stack, structure and conventions. Do not rewrite working parts or swap frameworks. If something below conflicts with what exists, adapt and record why.

PRODUCT
School17 is a marketplace where teachers teach and earn, and pupils (and parents of minors) find rated teachers, book lessons, talk by video, message, and share files. Users are mostly in Uzbekistan: Uzbek (Latin) default, Russian, English; times in Asia/Tashkent by default; phones and mid-range networks first. VIDEO CALLING is the most important feature: spend about a third of your effort on it and its tests.

HARD RULES
- Never connect to a production database or use production keys. Write migration files; never run them against anything but a local or throwaway dev database. If the only database available is production, stop (condition c). Never read, print or copy .env values. Never create accounts, use paid services, deploy, or use npm audit fix --force.
- Never claim "secure", "encrypted" or "end-to-end encrypted" in UI, docs or store text unless it is true and tested. Describe exactly what is encrypted in transit and at rest.
- Authorization on every route and query. Tests for each role, and tests that user A can never read or change user B's data.
- Money is integer minor units with idempotency keys. No real payment integration without keys: build behind an interface with a mock.
- Anything not tested against a real service or device goes in KNOWN_GAPS.md. Never call mock-only work done.
- Legal topics (minors, payments, recording, Uzbek personal-data law, data location) are marked NEEDS LAWYER with a source link where possible. Never present them as settled.
- The laptop has 8 GB RAM: at most one dev server, no emulators, no big downloads.

MILESTONES (in order; tick each in PROGRESS.md, run tests/typecheck/lint, commit locally, start the next at once)
S1 Foundation: roles (student, guardian, teacher, admin), permissions, data model and migrations, audit log, authorization test harness.
S2 Teacher profiles: bio, subjects, levels, languages, price per lesson, timezone-aware weekly availability, intro video, credentials upload, verification states with an admin review queue. "Verified" only after admin approval.
S3 Booking: slots from availability, request or instant booking (configurable), calendar views, cancel/reschedule rules, no-show states, reminders, a join window that opens a few minutes before the start.
S4 VIDEO CALLS (core). Research the current docs of real-time video providers and self-hostable options (for example LiveKit, Jitsi, Daily, 100ms, Agora): relay servers included, adaptive bitrate, SDK for this stack, pricing for 1:1 lessons, data location, maturity. Do NOT write your own media server. Pick one with reasons in DECISIONS.md and put it behind a CallProvider interface with a mock provider and a real adapter. Mark the real adapter UNTESTED until keys exist, and list the env var names. Build:
 - server-minted, short-lived call tokens scoped to one room, only for the two booked participants, only inside the join window; unguessable room ids; revoked on cancel.
 - a pre-call lobby: camera, microphone and speaker test, permission help, network check, device selection.
 - the call screen: mute, camera on/off, camera switch, screen share, in-call chat, connection-quality indicator, automatic reconnect with a clear banner, audio-first fallback on weak networks, rejoin within the window, end-of-call summary, accurate lesson duration for earnings.
 - recording OFF by default, never for minors, only with every participant's consent, marked NEEDS LAWYER.
 - no-show and failure handling for both sides.
 - tests: token and room permission tests, state-machine tests for join, leave and reconnect, and where feasible a headless two-browser smoke test with fake media devices against the mock. Write a measurement plan (join time, packet loss, latency) to run with real keys, with targets in KNOWN_GAPS.md.
 - if the app is a native mobile app, check whether WebRTC works in Expo Go (as far as I know it needs a development build) and document what works where.
S5 Messaging and files: one conversation per teacher-student pair, real-time delivery, unread counts, delivery state. Attachments: photos and large PDFs, direct-to-storage uploads with signed URLs, resumable or chunked, progress/cancel/retry, configurable size limits and a per-user quota, an allowlist of types verified by content (never SVG, HTML or executables), EXIF stripped from photos, thumbnails and a PDF first-page preview, a malware-scan hook, expiring signed download URLs, no inline rendering of user files on the app's own origin.
S6 Discovery: search, filters (subject, level, price, language, availability, rating, verified), sorting, pagination and indexes. Ranking must be transparent and never pay-to-win.
S7 Ratings and reviews: only after a completed lesson, one per lesson, teacher reply, report a review, Bayesian average to resist gaming.
S8 Earnings: a ledger with lessons, platform commission (configurable), holds until lesson completion, refund and dispute states, a teacher earnings dashboard, payout requests, all on a MockPaymentProvider. Write PAYMENTS_GAPS.md: Stripe does not support Uzbek business accounts as far as I found; local processors need a registered business. VERIFY and NEEDS LAWYER.
S9 Safety: report and block for users and messages, an admin moderation queue, rate limits, an age gate and guardian flow for under 18, safeguarding tips, teachers cannot see pupils' private contact data, terms with a visible draft marker.
S10 Privacy: data inventory, consent screens, delete account and export my data, privacy policy and terms drafts in uz, ru, en marked "draft, needs legal review", and LAWYER_QUESTIONS.md.
S11 Notifications and languages: uz/ru/en strings with key parity enforced by a test; notifications for bookings, reminders, messages and calls (email or push per the stack, no paid services); friendly loading, empty, error and offline states.
S12 Hardening: full test run, SECURITY_REVIEW.md (authorization, IDOR, upload abuse, rate limits, headers), accessibility, performance, build check.

DELIVERABLES: README updates, PROGRESS.md, DECISIONS.md, KNOWN_GAPS.md, SECURITY_REVIEW.md, DATA_INVENTORY.md, PAYMENTS_GAPS.md, LAWYER_QUESTIONS.md, STORE_CHECKLIST.md (items marked VERIFY: user-generated content rules need reporting, blocking and moderation; Apple rules for one-to-one tutoring payments), TEST_REPORT.md with counts, and a final chat summary of at most 15 lines: what works for real, what is mock, and what I must do next.
