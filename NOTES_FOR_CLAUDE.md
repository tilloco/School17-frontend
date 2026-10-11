# NOTES_FOR_CLAUDE (read-only discovery, no values recorded)

## What it does
"School17 / Mamun 2.0": Uzbek-language law-exam (Huquq imtihoni) prep app. Phone OTP + Google sign-in, dashboard (progress, streak, days to exam, weak topics), course > module > week > lesson, quizzes, mock exam, premium/referral, Click/Payme payments, AI recommendations, admin panel. Messaging/chat/AI tabs were removed from mobile (staged deletions) but backend still has `messaging` module.

## Stack
- mobile: Expo ~57, React Native ^0.86, React 19.3, expo-router ~57, TypeScript ~6, socket.io-client, expo-secure-store, google-signin, expo-audio. EAS project; package `uz.mamun.app`.
- backend (git SUBMODULE, own repo): NestJS 10, Prisma 5 + PostgreSQL, passport-jwt, throttler, helmet, socket.io, google-auth-library, axios.
- admin: Next.js + Tailwind (own package.json).
- shared/api-types.ts: manually-synced copy of mobile/src/types/api.ts.
- Root package.json: stray deps (prisma, expo libs) - likely accidental.

## Run (from READMEs, not executed)
- backend: `cd backend && npm run start:dev` (migrate: `prisma:migrate`, seed: `prisma:seed`, admin: `admin:create`)
- mobile: `cd mobile && npm install && npx expo start` (scripts: android/ios via expo run, `typecheck`)
- admin: see admin/README.md

## Folder map
backend/src: auth, admin-auth, admin, content, exam, quiz, onboarding, users, premium, referral, payments, ai, messaging, prisma. backend/prisma = schema/seed.
mobile/app: (auth), (tabs) [dashboard, exam, profile], admin, exam, lesson, quiz. mobile/src: lib (api, auth-context, admin-context, google-auth, socket, storage), components, theme, types, hooks.

## Auth / data / payments
- Auth: backend/src/auth + admin-auth (x-admin-key guard, admin JWT); mobile/src/lib/auth-context.tsx, google-auth.ts, storage.ts (SecureStore).
- Data: Prisma/PostgreSQL in backend/prisma; mobile API client mobile/src/lib/api.ts.
- Payments: backend/src/payments (Click, Payme). README says step 5 unchecked, so probably incomplete.

## Env var NAMES
- mobile/.env: EXPO_PUBLIC_API_URL, EXPO_PUBLIC_GOOGLE_CLIENT_ID
- backend/.env (actual): BACKEND_URL (comment line present), DATABASE_URL, JWT_SECRET, ADMIN_JWT_SECRET, OTP_PEPPER, GEMINI_API_KEY, GEMINI_API_KEY_2, RESEND_API_KEY (listed twice), GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ADMIN_API_KEY
- backend/.env.example adds: JWT_EXPIRES_IN, ESKIZ_EMAIL/PASSWORD/BASE_URL, PORT, TRUST_PROXY, NODE_ENV, ADMIN_JWT_EXPIRES_IN, ALLOWED_ORIGINS, CLICK_SERVICE_ID/MERCHANT_ID/SECRET_KEY/RETURN_URL, PAYME_MERCHANT_ID/MERCHANT_KEY/RETURN_URL, ANTHROPIC_API_KEY
- admin/.env.example: BACKEND_URL

## Git state at open
Branch master. Many staged + partly unstaged changes in mobile/ (tabs ai/messages and chat/[id] deleted, dashboard/exam/profile/api.ts/colors/types modified, app.json, eas.json, package files). Submodule `backend` has uncommitted changes (package.json, package-lock.json, src/users/users.service.ts). Nothing touched.

## Half-done / broken / risks
- Docs outdated: root README lists backend only "ready"; mobile README says "no mock data" but a mock dashboard/mock exam commit exists (mobile/app/exam/mock.tsx has a TODO).
- Env drift: backend/.env uses Gemini + Resend (email) while .env.example/README describe Eskiz SMS + Anthropic; actual provider unclear.
- Payments (Click/Payme), push notifications, admin panel listed as unfinished in README.
- backend/package.json has `expo-linear-gradient` (does not belong in a NestJS backend).
- backend/test.json holds a personal email address and Resend test payload; backend/dist, tsbuildinfo, uploads present.
- Root .gitignore: `*.jks`/`*.keystore` lines are saved in UTF-16 so they may not work as intended (jks files currently show as ignored via another rule; verify). Root ignores `.expo/` yet mobile/.expo files are tracked.
- Large generated mobile/android/.cxx paths too long for Windows git; android/ dir committed state unclear.
- package.json deps use very new/odd versions (TypeScript ~6, RN 0.86, Expo 57) - verify they resolve.
- Typed API copy duplicated (shared vs mobile) - drift risk.

## Possible secrets in repo
- **mobile/.env is TRACKED by git** (git ls-files lists it) despite .gitignore. Contains API URL + Google client ID (client IDs are public-ish, but check the API URL and history).
- Android keystores `mobile/@tillo17__mamun-2-0*.jks` (3 files) sit in the working tree; currently ignored, not tracked. Do not commit; confirm never in history (`git log --all -- '*.jks'`).
- backend/.env holds real secrets (JWT, admin key, Gemini, Resend, Google client secret); it is in the backend submodule's ignore (not tracked as far as checked). Verify with `git -C backend ls-files | grep env`.
- mobile/android/local.properties exists; check not tracked.
