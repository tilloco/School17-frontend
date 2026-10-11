# HANDOFF
Branch `claude/school17-features` (local only, nothing pushed). Commit in `backend/` first, then in the parent.
- Last finished: Step 1 + plan (spec v2 saved, repo map below). Full suite 261/261 at commit d6a323f6-ish. S1-S11 done; S12 docs still LAST.
- A1 done (free mode; 268 tests pass). In progress: nothing. Next: A2 teacher card details (`grep -n "^A2 " NEW_FEATURES_SPEC.md`).
- Next: see `grep -n "\[ \]" PROGRESS.md | head -5`, spec: `grep -n "^A1 " NEW_FEATURES_SPEC.md`.
- Unverified: mobile screens, LiveKit/Expo-push/ClamAV adapters never run on devices/real services. Payments code is dormant/mock.
- Start test DB first: `bash backend/scripts/dev-db.sh start`. Never kill processes you did not start.

## Repo map
- `backend/` (NestJS + Prisma, own git repo) `src/marketplace/<module>/` (controller, service, *.unit.spec.ts, *.int.spec.ts); `testing/harness.ts` = test helpers; `prisma/migrations/`; `scripts/dev-db.sh`.
- `mobile/` Expo app: `app/market/*` + `app/call/*` screens, `app/(tabs)/market.tsx` menu, `src/market/marketApi.ts`, `src/i18n/locales/{uz,ru,en}.ts`, `src/components/StateView.tsx`. `admin/` Next.js panel. `shared/` pure code + specs (call-machine, i18n parity). `docs/CALLS.md`.
- Typecheck: `cd backend && npm run typecheck` (mobile: `cd mobile && npx tsc --noEmit`). One test file: `cd backend && node --require ts-node/register/transpile-only --test src/marketplace/<m>/<file>.spec.ts`. Full: `npm test` (~2 min, includes shared/*.spec.ts and the browser smoke test).
- Test DB: `bash backend/scripts/dev-db.sh start`; `export DATABASE_URL="postgresql://postgres@127.0.0.1:54329/school17_test?schema=public"` (tests refuse any other DB).
- Migrations: edit `prisma/schema.prisma`, then `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`, drop the `DROP INDEX` lines, save as `prisma/migrations/<timestamp>_name/migration.sql`, `npx prisma migrate deploy`, `npx prisma generate` (`migrate dev` refuses non-interactive runs).
- Helpers: `createTestApp`, `makeUser(t, Role, {consent,dateOfBirth})`, `makeTeacher(t,{approve:{adminToken}})`, `makeAdmin`, `makeThread`, `makeFile`, `uploadFile`, `seedVerifiedTeacher`, `api(t, token).get/post/...`, `checkRouteMatrix`, `ClockService.set(date)`; time-based columns must use the injected clock.
- Commit: `git -C backend add -A && git -C backend commit -m ...`, then in the parent `git add -u; git add backend shared docs mobile/src mobile/app admin *.md` and commit. Never push. No secrets in files.
