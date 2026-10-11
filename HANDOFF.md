# HANDOFF
Branch `claude/school17-features` (local only, nothing pushed). Commit in `backend/` first, then in the parent.
- Last finished: S11 (notifications, i18n parity tests, mobile marketplace screens) - 249 tests passed at that commit.
- In progress: S12 hardening. Added `configureHttpSecurity` (helmet/CORS/validation shared by main.ts and tests), `testing/hardening.int.spec.ts` (route inventory, headers, CORS, JWT edge cases, perf), `@RequirePermission` on `GET /teachers/:id`.
- State: typecheck clean; last full run 258/260 - the smoke test broke because helmet CSP blocked its inline page (fixed in smoke.ts, not re-run) and the "public controllers" count assertion in hardening spec still fails (list shows 7 endpoints; check the expected number/regex).
- Exact next step: `export DATABASE_URL=postgresql://postgres@127.0.0.1:54329/school17_test?schema=public; cd backend; npm test`, fix those two, commit.
- Then S12 docs still missing: SECURITY_REVIEW.md, STORE_CHECKLIST.md, TEST_REPORT.md (counts), README updates, `npm audit` report (no --force), final 15-line summary.
- Unverified: all mobile screens and the LiveKit/Expo-push/ClamAV/S3 adapters (never run on devices or real services); payments are mock only.
- Start the test DB first: `bash backend/scripts/dev-db.sh start`. Never kill browser processes.
