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
- [ ] S10 Privacy
- [ ] S11 Notifications and languages
- [ ] S12 Hardening
