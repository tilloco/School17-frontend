# HANDOFF
Branch `claude/school17-features` (local only, nothing pushed). Commit in `backend/` first, then in the parent.
- Last finished: S11 (notifications, i18n parity tests, mobile marketplace screens) - 249 tests passed at that commit.
- In progress: S12 hardening. Added `configureHttpSecurity` (helmet/CORS/validation shared by main.ts and tests), `testing/hardening.int.spec.ts` (route inventory, headers, CORS, JWT edge cases, perf), `@RequirePermission` on `GET /teachers/:id`.
- State: typecheck clean; last full run 258/260 - the smoke test broke because helmet CSP blocked its inline page (fixed in smoke.ts, not re-run) and the "public controllers" count assertion in hardening spec still fails (list shows 7 endpoints; check the expected number/regex).
- Exact next step: `export DATABASE_URL=postgresql://postgres@127.0.0.1:54329/school17_test?schema=public; cd backend; npm test`, fix those two, commit.
- Then S12 docs still missing: SECURITY_REVIEW.md, STORE_CHECKLIST.md, TEST_REPORT.md (counts), README updates, `npm audit` report (no --force), final 15-line summary.
- Unverified: all mobile screens and the LiveKit/Expo-push/ClamAV/S3 adapters (never run on devices or real services); payments are mock only.
- Start the test DB first: `bash backend/scripts/dev-db.sh start`. Never kill browser processes.

## Repo map
- `backend/` (NestJS + Prisma, own git repo) `src/marketplace/<module>/` (controller, service, *.unit.spec.ts, *.int.spec.ts); `testing/harness.ts` = test helpers; `prisma/migrations/`; `scripts/dev-db.sh`.
- `mobile/` Expo app: `app/market/*` + `app/call/*` screens, `app/(tabs)/market.tsx` menu, `src/market/marketApi.ts`, `src/i18n/locales/{uz,ru,en}.ts`, `src/components/StateView.tsx`. `admin/` Next.js panel. `shared/` pure code + specs (call-machine, i18n parity). `docs/CALLS.md`.
- Typecheck: `cd backend && npm run typecheck` (mobile: `cd mobile && npx tsc --noEmit`). One test file: `cd backend && node --require ts-node/register/transpile-only --test src/marketplace/<m>/<file>.spec.ts`. Full: `npm test` (~2 min, includes shared/*.spec.ts and the browser smoke test).
- Test DB: `bash backend/scripts/dev-db.sh start`; `export DATABASE_URL="postgresql://postgres@127.0.0.1:54329/school17_test?schema=public"` (tests refuse any other DB).
- Migrations: edit `prisma/schema.prisma`, then `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`, drop the `DROP INDEX` lines, save as `prisma/migrations/<timestamp>_name/migration.sql`, `npx prisma migrate deploy`, `npx prisma generate` (`migrate dev` refuses non-interactive runs).
- Helpers: `createTestApp`, `makeUser(t, Role, {consent,dateOfBirth})`, `makeTeacher(t,{approve:{adminToken}})`, `makeAdmin`, `makeThread`, `makeFile`, `uploadFile`, `seedVerifiedTeacher`, `api(t, token).get/post/...`, `checkRouteMatrix`, `ClockService.set(date)`; time-based columns must use the injected clock.
- Commit: `git -C backend add -A && git -C backend commit -m ...`, then in the parent `git add -u; git add backend shared docs mobile/src mobile/app admin *.md` and commit. Never push. No secrets in files.
