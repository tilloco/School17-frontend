# DECISIONS

1. Existing app is a law-exam prep app (Expo + NestJS/Prisma/Postgres). The marketplace is added as a new `backend/src/marketplace/*` module tree and new tables; exam features untouched. Reason: brief says extend, do not rewrite.
2. Backend is its own nested git repo; milestone commits are made in `backend/` first, then the parent records the new commit. Reason: that is how the repo is laid out.
3. Root `.gitignore` was saved as UTF-16 (broken patterns, ignored `BRIEF.md`); rewrote it as UTF-8 with the same intent plus `.devdb/`. Reason: it silently ignored new root files.
4. Tests use Node's built-in test runner via ts-node (no jest). Reason: zero new downloads on an 8 GB laptop; integration tests hit a REAL throwaway local PostgreSQL (`scripts/dev-db.sh`); harness refuses any DB that is not localhost + name ending `_test`.
5. No linter exists in the project; "lint" = `tsc --noEmit` typecheck. Reason: adding eslint stack is a large download and a style change.
6. Role is a single enum field on User (STUDENT, GUARDIAN, TEACHER, ADMIN). Reason: simplest model fitting the brief; switching is one-way, adults with known birth date only. Marketplace admins reuse the existing separate `Admin` accounts and admin JWT (different secret) mapped to role ADMIN. Reason: do not invent a second admin system.
7. Guard re-reads user status/role from DB on every request instead of trusting JWT claims. Reason: suspended/deleted accounts must stop immediately.
8. Resources a user may not see return 404 (not 403) where existence would leak; permission failures return 403.
9. Date of birth can be set once through the API. Reason: editable DOB defeats the minor protections.
10. Migrations are generated only against the throwaway DB; nothing is ever applied to another database.
11. Teachers are listed/visible only when VERIFIED (strict). Reason: students include minors; trade-off is slower onboarding, the admin queue handles it. NEEDS LAWYER (what vetting is required for adults teaching minors).
12. Public identifier for a teacher is the TeacherProfile id, never the user id/email. Public view omits email, DOB, credential files.
13. Intro video is an external https link on an allowlist (YouTube/Vimeo), not an upload. Reason: avoids hosting/transcoding video and rendering user files on our origin; uploads via the S5 pipeline are possible later.
14. Credentials reference a StoredFile that must be owned by the teacher, purpose CREDENTIAL and status READY (set after S5 content check + scan hook).
15. Price is integer tiyin per 60 minutes (1 so'm = 100 tiyin), bounded by env-configurable min/max.
16. Double-booking is prevented by PostgreSQL exclusion constraints (teacher and student, REQUESTED/CONFIRMED) in addition to service checks; needs the `btree_gist` extension. Reason: only the database can close the race window. A race test proves exactly one of two simultaneous requests wins.
17. Minors cannot book for themselves; a linked (ACTIVE GuardianLink) guardian books for them. Adults book for themselves; guardians cannot book for adult pupils. Unknown date of birth => cannot book. NEEDS LAWYER (consent age, parental consent).
18. Reschedule = proposal that the OTHER side must accept (in-place move, same booking id). Not allowed inside the free-cancel window. Reason: avoids silent changes and keeps ledger/chat tied to one booking.
19. Join window: opens 5 min before start, closes 5 min after the scheduled end (env-configurable); no-show can be reported only after a 10 min grace. Late-cancel refund % defaults to 0 (NEEDS LAWYER/product decision), teacher cancel = 100% refund.
20. Teachers see pupils only as display name (minors: "First L."), never email or user id. Booking views for outsiders return 404.
21. A `ClockService` is injected everywhere time matters so tests control "now".
22. Notifications are an outbox table (`Notification`) with dedupe keys; email/push delivery arrives in S11.
23. Video provider: LiveKit behind a CallProvider interface (mock + real adapter). Reasons: open-source SFU that can be self-hosted later (data location), embedded TURN, simulcast/dynacast for weak networks, per-room JWT tokens, webhooks for authoritative presence; cloud pricing 5,000 free min then ~$0.0005/min (see docs/CALLS.md). Jitsi/Daily/Agora/100ms compared there. No own media server.
24. Call tokens go only to the teacher and the booked pupil (not the booking guardian), only inside the join window, 10 min TTL, anonymous per-room identities; the room name is never sent to clients. Reason: least privilege; guardian observation is a product/safeguarding question for the lawyer list.
25. Presence is authoritative from provider webhooks when a real provider is used; the mock provider accepts client heartbeats. Reason: clients must not be able to claim attendance (and earnings).
26. Lesson outcome is computed from presence: billable = time both were present (capped at the scheduled length); under 5 min together = FAILED for review, not COMPLETED. Reason: accurate duration for earnings; ambiguous cases go to a human.
27. Dependencies: only `puppeteer-core` (dev, no browser download) added for the headless smoke test; it drives the already-installed Edge/Chrome. LiveKit native packages NOT added to mobile (large, native rebuild); documented in docs/CALLS.md.
28. The call state machine is pure TypeScript in shared/ with a byte-identical copy in mobile/src/call (test enforces equality), because Metro does not resolve files outside the app folder here.
29. i18n: lightweight own `t()` with uz/ru/en dictionaries in mobile/src/i18n (no new dependency); key parity test lands in S11.
30. A headless two-browser smoke test found a real race (both participants requesting tokens at the same moment created two rooms, so they could never meet). Fixed with a partial unique index (one ACTIVE room per booking) plus conflict handling; regression test added. The smoke test itself failed once in ~9 attempts for an unexplained reason (see TEST_REPORT).
