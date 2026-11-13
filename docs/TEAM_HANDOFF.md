# School17: team handoff (state on 2026-11-14)

For the developers taking this over. Read this first, then `PROGRESS.md`, `KNOWN_GAPS.md` and `NOTES_FOR_CLAUDE.md` for the product history.
Everything here was checked on the day it was written. If something disagrees with the code, the code wins; fix this file.

**No secret values are in this file.** Section 9 says where each secret lives and which ones must be replaced.

---

## 1. What works today, and what does not

| Area | State | Notes |
|---|---|---|
| Public API on Render (free) | **Works** | https://school17-api.onrender.com, `/health` answers `{"ok":true}` |
| Database (Supabase) | **Works** | migrations run on every start |
| APK build + install on a phone | **Works** | see section 5 |
| App icon / in-app logo (S17) | **Done** | |
| Sign-in: phone number + Telegram code | **Built, not re-verified this month** | code comes from Telegram Gateway (paid, ~1 cent) |
| Sign-in: Google | **NOT working yet** | see section 4 |
| Sign-in: e-mail | **Removed from the UI** | backend endpoints and two screens still exist (section 8) |
| Sign-up as one question per screen | **Built and installed, not walked through to the end on a device** | `mobile/app/(auth)/phone.tsx` |
| Live @username check | **Live on the server** (checked with curl) | `GET /auth/username-check?u=` |
| Account deletion | **Fixed, NOT tested end to end** | it returned "Internal server error" because of a transaction timeout |
| YouTube player | **Changed, NOT verified** | see section 6 |
| Video calls / Darsxona | **Configured, NEVER tested** | see section 7 |
| File uploads (avatars, class files, receipts) | **Lost on every server restart** | see section 3 |
| Push notifications | **Off** | `PUSH_PROVIDER` not set to `expo` |
| Admin web panel (`admin/`) | **Not deployed** | `ALLOWED_ORIGINS` is a placeholder |
| Windows teacher app (`desktop/`) | **Points at a dead server** | default URL is `mamun2appforuse.onrender.com` |
| Payments | **Mock only, free mode** | `ESCROW_ENABLED` off; direct payment tracking is the real flow |

## 2. Where everything runs

```
phone (APK) ──https──> Render web service "school17-api" (Ohio, free, Docker)
                          ├──> Supabase Postgres (Tokyo, session pooler, port 5432)
                          └──> LiveKit Cloud (video) -- webhook not set up yet
```

| Piece | Details |
|---|---|
| Repos | App monorepo: `github.com/tilloco/mamun-mobile` (renamed `School17-frontend`; folders `mobile/`, `admin/`, `desktop/`, `shared/`, `docs/`). Backend is a **separate nested git repo** at `backend/`: `github.com/tilloco/school17-backend` (old name `mamun2appforuse`). |
| Branch | Work is on **`claude/school17-features`** in both repos. `main` of the backend is old. Render deploys the `claude/school17-features` branch. |
| Commit order | Commit and push in `backend/` first, then commit the pointer in the parent repo. |
| Render | Workspace "Nnb's workspace". Service `school17-api`, id `srv-dbqvpqe7bikc73c1b3a0`, Docker, region Ohio, plan free, auto-deploy on commit. Health check path `/privacy`. |
| Old Render service | `school17-backend` (`srv-dbqvjum7bikc73c0rlt0`) is broken (it was created as Node, not Docker). **Delete it in the dashboard.** |
| Render runtime cannot be changed | Node to Docker after creation is ignored by the API. Recreate the service instead. |
| Supabase | Project in Tokyo (`ap-northeast-1`). The old "direct connection" host is IPv6-only and Render cannot reach it. **Use the Session pooler URI** (`aws-1-ap-northeast-1.pooler.supabase.com:5432`, user `postgres.<project-ref>`). |
| DB password has `@` | In `DATABASE_URL` it must be written as `%40`. |
| Old database | A Neon DB (London) from before still exists with old data. Nothing reads it now. |
| Google Cloud | Project `studio17-513803`. Web client + Android client, see section 4. |
| LiveKit Cloud | Project `school17-k5rosj4j`, URL `wss://school17-k5rosj4j.livekit.cloud`. |

Server environment variables on Render (names only):
`NODE_ENV=production`, `PORT=3000`, `TRUST_PROXY=1`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `OTP_PEPPER`, `APP_DATA_KEY` (exactly 64 hex characters), `ALLOWED_ORIGINS`, `GOOGLE_CLIENT_ID` (the **Web** client id), `TELEGRAM_GATEWAY_TOKEN`, `CALL_PROVIDER=livekit`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `ALLOW_MOCK_CALLS_IN_PRODUCTION=1` (no longer needed now that LiveKit is on).

Things that will surprise you:
- **The server refuses to start in production without** `JWT_SECRET`, `OTP_PEPPER`, `ADMIN_JWT_SECRET`, `ALLOWED_ORIGINS`. Mock calls are refused in production unless `ALLOW_MOCK_CALLS_IN_PRODUCTION=1`.
- `Dockerfile` runs `prisma migrate deploy` before starting. If a new Supabase project has anything in `public`, you get `P3005`. I fixed it once with `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` on the empty DB. Never do that on a DB with real data.
- Free Render sleeps after ~15 minutes idle and the first request then takes **up to ~72 seconds**. The app now pings `/health` on start and its second attempt waits 45 s, but the real fix is a pinger (section 3).
- From Windows, `curl` needs `--ssl-no-revoke` to reach the Render API. Render free has no shell and no one-off jobs (`POST /jobs` answers "new paid services not allowed").

## 3. Next steps, most important first

1. **Move the server and the database to the same city (Frankfurt).** Today the server is in Ohio and the database in Tokyo, so every query crosses an ocean. A warm request measured ~0.6 s of network plus ~0.15–0.8 s *per query*. This is the main reason screens feel slow and why deleting an account timed out. Plan: new Supabase project `school17-eu` (Central EU), new Render service in Frankfurt (create it through the API with `runtime docker`; the name `school17-api` is taken until the old one is deleted), then set `EXPO_PUBLIC_API_URL` and rebuild the APK.
2. **Keep the free server awake.** UptimeRobot (free) HTTP monitor on `<server>/health` every 5 minutes. A GitHub Actions cron only runs from the default branch, which is why I did not add one.
3. **Persistent file storage.** `backend/src/marketplace/files/storage.ts` only has `LocalDiskStorage`, and Render's disk is wiped on every restart. Implement the `ObjectStorage` interface for Supabase Storage or Cloudflare R2 (10 GB free). The interface needs `put/get/exists/size/list/delete/deletePrefix`, **`concat`** (joins uploaded chunks without loading them in memory), **`stream` with byte ranges** (video seeking) and optional `diskStats`. `KNOWN_GAPS.md` already lists this.
4. **LiveKit webhook**: in the LiveKit dashboard add `https://<server>/calls/webhook/provider` (Settings, Webhooks). Without it calls connect, but attendance, no-show and billing outcomes are never recorded.
5. **Admin account**: nobody has created one. `npm run admin:create` (in `backend/`, `ts-node prisma/create-admin.ts`) run **locally with `DATABASE_URL` pointing at the live DB**. Not tried yet.
6. **Push notifications**: set `PUSH_PROVIDER=expo`, `EXPO_PUSH_ENABLED=true`, and give Expo the Android FCM credentials.
7. Point `desktop/` (Windows teacher app) at the real server: `desktop/README.md` still names the dead address; override with `SCHOOL17_API_URL` or change the default.
8. Deploy `admin/` and set a real `ALLOWED_ORIGINS`.

## 4. Google sign-in (not working; read before touching)

Symptom: tapping "Continue with Google" opens the Google account list, then fails. The phone log says *"This android application is not registered to use OAuth2.0, please confirm the package name and SHA-1 certificate fingerprint…"* (`adb logcat | grep GetTokenResponseHandler`).

What was checked and is **correct**:
- The installed APK is signed with the upload key; its SHA-1 is `0E:D5:E5:0F:96:84:BA:42:FD:CE:0F:86:32:ED:FD:CD:01:DE:42:99` (`apksigner verify --print-certs`).
- The Android OAuth client in Google Cloud has package `uz.school17.app` and exactly that SHA-1 (checked character by character from a screenshot).
- The app and the server both use the **Web** client id (`mobile/.env` `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, Render `GOOGLE_CLIENT_ID`). The Android client id is never used in code.

What is **not** known:
- The Android client was created at 19:39 on 2026-11-13; the failures were seen at 19:45 and 19:53. Google says new clients can take from minutes to hours. **I did not re-test afterwards.** Re-test first.
- The consent screen must be **External** and **Published ("In production")** under Audience, otherwise only listed test users can sign in. The branding warning "couldn't fetch app's branding information" is in the phone log. Not confirmed as fixed.

If it still fails, check next: that the Android client is in the **same Google Cloud project** as the Web client (both ids start with `858205385692`); whether Google Play App Signing is involved (it is not today: the APK is signed locally).

## 5. Building and installing the Android app (Windows)

Prerequisites already on the dev PC: Android SDK at `%LOCALAPPDATA%\Android\Sdk`, JDK, `adb` in `platform-tools`.

```bash
# 1. Windows 260-character path limit breaks the native (CMake/ninja) build. Map the repo to a short drive:
cmd.exe //c "subst S: C:\Users\user\Downloads\school17"

# 2. If a native build failed before, delete the stale caches (they contain the old long paths):
rm -rf mobile/node_modules/expo/node_modules/expo-modules-core/android/.cxx \
       mobile/node_modules/react-native-{gesture-handler,reanimated,screens,worklets}/android/.cxx \
       mobile/android/app/.cxx

# 3. Build (64-bit only; the 32-bit build fails with "build.ninja still dirty"):
cd /s/mobile/android
export ANDROID_HOME=/c/Users/user/AppData/Local/Android/Sdk ANDROID_SDK_ROOT=$ANDROID_HOME
./gradlew.bat assembleRelease --no-daemon -PreactNativeArchitectures=arm64-v8a
# Output: app/build/outputs/apk/release/app-release.apk (about 68 MB, 5-10 min the first time)

# 4. Install (adb must list the phone as "device"):
$ANDROID_HOME/platform-tools/adb.exe install -r app-release.apk
```

Rules I learned the hard way:
- **Check the exit code and the APK's timestamp.** Twice a "successful" step was really a failed build and an old APK got installed. `ls -la --time-style=full-iso app-release.apk` must show today.
- The server address and Google client id are **baked in at build time** from `mobile/.env`. Change the server, rebuild.
- `adb install` fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE` if the phone has an app signed with another key. Uninstall first (loses local app data).
- Release builds are signed with the upload key from `%USERPROFILE%\school17-keys\keystore.properties` (or the path in env `SCHOOL17_KEYSTORE_PROPERTIES`). Without it the build silently falls back to the debug key. **Google sign-in needs the upload key's SHA-1 (section 4).**
- A copy for sharing is kept at `C:\Users\user\Downloads\School17.apk`.
- Typecheck before building: `cd mobile && npx tsc --noEmit`. Translations: `cd backend && node --require ts-node/register/transpile-only --test ../shared/i18n.spec.ts` (all three languages must have the same keys).

## 6. YouTube videos in the app

Reported by the owner: videos "stuck" and not visible. **I could not reproduce it** because it needs a signed-in session on the phone. What I found and did:
- The content exists: the live DB has 11 topics and 31 videos.
- `mobile/app/market/topic-watch/[id].tsx` plays YouTube inside an `<iframe>` in a WebView (`baseUrl https://school17.app`). I added `enablejsapi=1` and a listener for the player's `onReady` / `onError` messages. If the player says it cannot play (101/150/153 embedding blocked, 100 removed), or says nothing for 15 s, the screen now shows the reason and an **Open in YouTube** button instead of an endless spinner.
- Most likely causes of the original symptom: the sleeping server / slow database (the topic screen needs several queries), or videos whose owners disabled embedding. **Open a topic on a phone and tell which of these it is.** With the phone connected, `adb logcat | grep ReactNativeJS` shows what the player reported.

## 7. Video calls and the live classroom (Darsxona)

- Server: `CALL_PROVIDER=livekit` with the three `LIVEKIT_*` variables. I verified the key pair against LiveKit (`ListRooms` answered HTTP 200) and the server starts cleanly. LiveKit tokens are minted by our own code (`backend/src/marketplace/calls/livekit-provider.ts`, `jwt-hs256.ts`).
- App: `mobile/src/call/rtc.ts` already does simulcast, dynacast, adaptive stream, auto-reconnect with a fresh token, audio session, camera flip, screen share. `src/call/LiveLesson.tsx` re-opens the connection with backoff after a drop.
- **Nothing here has ever run against a real LiveKit server or on a real phone** (see `VIDEO_STATUS.md`, partly stale: the packages are now in `mobile/package.json`). It was only tested with a fake in a headless browser (`calls.smoke.spec.ts`).
- Test plan (needs a signed-in teacher account and a second participant): create a class, start the lesson, join from a second device, then switch the network off for ~10 s and back on. Watch `adb logcat | grep -i -E "livekit|webrtc|ReactNativeJS"` and the Render logs. `BLOCKED.md` mentions a `CALL_TEST_CHECKLIST.md` that is not in the repo; write one from the steps above and keep it with the code.

## 8. What I changed in this period (so you can review it)

Backend (`backend/`, commits `c386f81`, `a49a631`):
- `call-provider.factory.ts`: `ALLOW_MOCK_CALLS_IN_PRODUCTION=1` lets production run with calls off instead of crashing at boot.
- `prisma.service.ts`: default interactive transaction limits raised to `maxWait 10 s / timeout 20 s`.
- `privacy.service.ts`: account deletion transaction gets a 30 s limit and now also clears `phone`, `phoneHash`, `username`, `bio`, `passwordHash` so the person can sign up again (these columns are `@unique`).
- `auth.controller.ts` / `auth.service.ts`: `GET /auth/username-check`; a race on the unique `username` index now answers `USERNAME_TAKEN` (409) instead of a 500.
- `legal-pages.controller.ts`: `GET /health`.
- `npm run test:unit` passes (151 tests). **The integration tests were not run** (they need Docker for the throwaway Postgres, `bash backend/scripts/dev-db.sh start`, and Docker was not running).

App (`mobile/`, `shared/`, commits `1da0fd51`, `4e20bc2d`):
- New S17 icon (all Android densities, `mobile/android/app/src/main/res/mipmap-*`, `assets/icon.png`, `assets/adaptive-icon.png`) and in-app logo `assets/logo.png`.
- `welcome.tsx`: e-mail button removed. **`signin.tsx`, `register.tsx` and the backend `/auth/email/*` routes are still in the code, unreachable from the UI.** Delete them, or keep them knowingly.
- `phone.tsx`: sign-up split into steps (role, name, @username, birthday, terms) with a progress bar and live username check. If the check cannot reach the server the person may continue; the server re-checks and sends them back to the username step if it is taken.
- Speed feel: `api.ts` (`captureGets`, 45 s second attempt), `useAsync.ts` (remembers each screen's last result and shows it instantly while refreshing; cleared on sign-out), `StateView.tsx` (spinner only after 300 ms), `_layout.tsx` (pings `/health` at start). Risk to watch: a screen can briefly show data that was changed elsewhere, until the refresh lands.
- `topic-watch/[id].tsx`: section 6.
- `shared/notification-routes.ts`: fixed an old mismatch that made a unit test fail.
- `render.yaml` and `docs/DEPLOY_FREE.md` describe an earlier plan (Neon + Blueprint). The real setup is section 2. `render.yaml` is not used by the live service.

## 9. Secrets: where they are and what to replace

Secrets live only in: Render's Environment tab, `backend/.env` (git-ignored), and `%USERPROFILE%\school17-keys\`. `mobile/.env` is committed and holds only public values (server URL, Google Web client id).

**Replace these, because they were pasted into chat sessions or printed in logs during this work:**
- the Render API key (create a new one in Render, Account Settings, API Keys, and delete the old)
- the Supabase database password (and update `DATABASE_URL` on Render and in `backend/.env`)
- `JWT_SECRET`, `ADMIN_JWT_SECRET`, `OTP_PEPPER` (replacing them signs every user out; `APP_DATA_KEY` must **not** change once real card details are stored, or old values cannot be decrypted)
- the LiveKit API secret
- `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY*`, `RESEND_API_KEY`, `TELEGRAM_GATEWAY_TOKEN` in `backend/.env` (they were visible in the IDE and a session; the Gemini and Resend keys are not used by anything I touched)

**Back up `%USERPROFILE%\school17-keys\` (the upload keystore and its properties file) somewhere safe today.** It exists on one PC only. Losing it means you can never update the app under the same signature and Google sign-in (tied to its SHA-1) breaks.

## 10. Questions the owner still has to answer
- The owner said there is "one important thing we need to do" and never said what it is. Ask.
- Which free-tier limits are acceptable long term (Render sleep, Supabase 500 MB, no persistent files)? The paid VPS plan is in `docs/COSTS.md` and `deploy/README.md`.
