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
