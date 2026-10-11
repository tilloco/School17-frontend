# PROGRESS

Branch: `claude/school17-features` (local only, never pushed). Backend is a separate nested git repo (`backend/`), same branch name.
Test DB: throwaway local PostgreSQL via `backend/scripts/dev-db.sh start` (port 54329, db `school17_test`).

- [x] S1 Foundation (roles, permissions, audit log, auth test harness)
- [x] S2 Teacher profiles
- [x] S3 Booking
- [x] S4 (server + shared state machine + smoke test tested; native RTC driver UNTESTED, see KNOWN_GAPS) Video calls
- [x] S5 Messaging and files
- [x] S6 Discovery
- [x] S7 Ratings and reviews
- [x] S8 (mock provider only) Earnings
- [x] S9 Safety
- [x] S10 Privacy
- [x] S11 Notifications and languages
## New features (see NEW_FEATURES_SPEC.md; S12 stays LAST)
- [x] A1 Free mode (ESCROW_ENABLED off, texts rewritten)
- [x] A2 Teacher card details (encrypted)
- [x] A3 Direct payment tracking
- [x] A5 Teacher setup on mobile
- [x] A6 Admin web
- [x] A4 Teacher money board
- [x] R0 Video status (read-only)
- [x] R1 Class model + enrollment
- [x] R2 Class room core
- [x] R3 Questions + chat in class
- [ ] R4 Quality engine
- [ ] R5 PDF presenter + class library
- [ ] R6 Whiteboard + screen share
- [ ] R7 Class payments
- [ ] R8 Recap + class feed
- [ ] R9 Live poll
- [ ] R10 Quality telemetry
- [ ] R11 Deploy, load test, cost
- [ ] R12 Scale-ready backend
- [x] A7 Reviews + reschedule on mobile
- [x] A8 Chat attachments on mobile
- [ ] A9 Push token registration
- [ ] B1 Invite link
- [ ] B2 Public teacher page
- [ ] B3 Credentials
- [ ] B4 Free trial
- [ ] B5 My students
- [x] B6 Group lessons (superseded by S17-CLASSROOM-V1)
- [ ] C1 Telegram link
- [ ] C2 Lesson reminders
- [ ] C3 Lesson notes
- [ ] C4 Homework
- [x] C5 Whiteboard (superseded by S17-CLASSROOM-V1)
- [ ] C6 Weekly parent report
- [ ] D1 Content model
- [ ] D2 Daily practice
- [ ] D3 Mistake notebook
- [ ] D4 Mock test
- [ ] D5 Exam countdown
- [ ] D6 Q&A board
- [ ] D7 Photo-a-problem
- [x] E1 Class code (superseded by S17-CLASSROOM-V1)
- [ ] E2 Referral
- [ ] E3 Low bandwidth
- [ ] E4 Safety page

- [ ] S12 (in progress: hardening tests added, docs pending) Hardening
