# Publishing School17 on Google Play

**What you upload is an AAB, not an APK.** Google Play requires an *Android App Bundle* (`.aab`) for new apps; Google then builds the small per-phone installs from it. An **APK** is only for installing on a phone yourself (testing, sending to a friend). The build below produces both.

## 0. Things only you can do (nobody else can)
1. **Google Play developer account** (one-time fee, identity check). New personal accounts must first run a *closed test* with a group of testers for about two weeks before production access (Google's current rule is about 12 testers for 14 days; check the Play Console, the rules change).
2. **A domain name** (yours: `mamunapp.xyz` works fine; the app name stays School17, they need not match; see `docs/COSTS.md`) and a server to run the backend (section 3). The app and the privacy-policy link need real `https` addresses; the old `onrender` address in `mobile/.env` is a stand-in.
3. **Fill the policy blanks yourself** (your decision whether to involve a lawyer). In the server `.env` set `LEGAL_OPERATOR` (your full name or company, city, country), `LEGAL_RETENTION` (for example `12 months`), `SUPPORT_EMAIL`, and `LEGAL_REVIEWED=1`. That fills every bracket on `/privacy` and removes the draft banner. Google only needs the policy to be true to what the app does, and it is written from the code.
4. **A support e-mail address** you actually read (`SUPPORT_EMAIL`), shown on the policy and delete-account pages.

## 1. The upload key (already created)
- Location: `C:\Users\<you>\school17-keys\` (`school17-upload.jks` and `keystore.properties`). **Back this folder up somewhere safe now** (a USB stick and a private cloud drive). It is not in git and must never be.
- Upload-key SHA-256 fingerprint: `C4:7E:C6:E7:2E:AD:28:65:4F:88:CF:88:4E:82:2A:88:CE:16:5F:06:F4:7F:31:5F:43:0D:89:15:72:E6:17:F9`
- Turn on **Play App Signing** when you create the app (default). Google then holds the real signing key; if you ever lose the upload key, Google support can reset it.

## 2. Build the release files
On Windows the build needs a short project path (Android's tools stop at 260 characters):
```
subst X: C:\path\to\school17
cd X:\mobile\android
set JAVA_HOME=C:\Program Files\Java\jdk-20
gradlew.bat :app:bundleRelease -Ps17VersionCode=2 -Ps17VersionName=0.2.0 -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
gradlew.bat :app:assembleRelease -Ps17VersionCode=2 -Ps17VersionName=0.2.0 -PreactNativeArchitectures=arm64-v8a
```
- Upload this to Play: `mobile/android/app/build/outputs/bundle/release/app-release.aab`
- Install on a phone to test: `mobile/android/app/build/outputs/apk/release/app-release.apk`
- **Every upload needs a higher `s17VersionCode`** than the one before.
- The server address is baked in at build time from `mobile/.env` (`EXPO_PUBLIC_API_URL`). Set it to your real `https://` address *before* building. Never put `EXPO_PUBLIC_DEV_LOGIN` in that file.

## 3. The backend must be online first
See `deploy/README.md` (Docker, database, video server and HTTPS in one command). After it is up, these must open in a browser:
- `https://YOUR-DOMAIN/privacy`, `https://YOUR-DOMAIN/terms`, `https://YOUR-DOMAIN/delete-account`

## 4. Play Console: what to fill in
**Store listing**
- App name: School17. Category: Education. Contact e-mail: your `SUPPORT_EMAIL`.
- Privacy policy URL: `https://YOUR-DOMAIN/privacy`. Account deletion URL (Data safety page): `https://YOUR-DOMAIN/delete-account`.
- Short description (80 characters):
  - en: `Free lessons with verified teachers, videos and tests for every topic.`
  - ru: `Бесплатные уроки с проверенными преподавателями, видео и тесты по темам.`
  - uz: `Tasdiqlangan ustozlar bilan bepul darslar, mavzu bo‘yicha video va testlar.`
- Full description (en; translate for ru/uz):
  > School17 is a free place to learn. Find a verified teacher with a real photo, diplomas and honest reviews from former pupils, join a class, or learn a single topic on your own.
  > • Topics: one page for each exact topic with carefully picked videos, a one-minute test and the teachers who teach it.
  > • Classes: lessons by video with screen sharing, a class channel, homework, polls and a ranking.
  > • Verified teachers: identity and diplomas are checked; reviews come from real pupils and teachers cannot delete them.
  > • Your streak, weekly goal and class rank keep you going.
  > School17 is free and does not handle payments.
- Graphics are in `docs/store/` (512×512 icon, 1024×500 feature graphic, phone screenshots).

**App content**
- Target audience: 13 and over (the app does not allow under-13 accounts; 13–17 need a linked guardian). Not designed for children, not in the Families program.
- Ads: none. Government app: no. News app: no.
- Content rating: user-generated content (messages, comments, files) with reporting and blocking; no violence/gambling.
- Health, finance: not applicable (the app does not process payments).

**Data safety** (answers match `DATA_INVENTORY.md`)
| Data | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Name, e-mail or phone number, user IDs | yes | no | no | account, sign-in |
| Date of birth | yes | no | no | age rules |
| Photos you upload (profile, homework, diplomas) and files | yes | no | yes | app function |
| Messages, comments | yes | no | yes | app function |
| Contacts (phone numbers are scrambled on the phone and compared; not stored) | processed only | no | yes | find friends |
| Audio/video in lessons | processed in transit, not stored | with the video server you run | yes | lessons |
| Device push token | yes | no | yes | notifications |
| App activity (test scores, streak, ratings) | yes | no | no | app function |
- Encrypted in transit: yes (HTTPS). Users can request deletion: yes (in the app and at `/delete-account`).
- Data is not sold. No advertising ID.

**Permissions declarations Google may ask about**
- `READ_CONTACTS`: used only to show which contacts already use the app; hashed on the phone; optional; can be turned off.
- `FOREGROUND_SERVICE_MEDIA_PROJECTION`: the teacher's screen sharing in a live lesson (start only by the teacher's tap).
- `CAMERA`, `RECORD_AUDIO`, `FOREGROUND_SERVICE_CAMERA/MICROPHONE/MEDIA_PLAYBACK`: live lessons and keeping a lesson running with the screen off.
- Not requested in the release build: overlay (`SYSTEM_ALERT_WINDOW`), `WRITE_CONTACTS`, external storage.

**App access (for Google's reviewers)**: they need a way to sign in. Create one pupil and one teacher test account on your production server and write their sign-in steps in "App access". *A phone sign-in code goes to the person's own phone, which a reviewer cannot read, so give them a prepared Google account or another way in that works without your phone.* This is the most common reason for a first rejection.

## 5. After upload
1. Internal testing track first: install from the Play link on two phones and run the checklist below.
2. Closed testing (the two-week requirement), then Production.

**Smoke checklist on a release build**: sign up, edit profile + photo, find a teacher, open a Topic and play a video *inside the app*, finish a test, send a message, join a live lesson on two phones (camera + screen share), delete the test account.

## 6. Known limits (honest list)
- The Uzbek/Russian/English texts of the privacy policy are drafts until your lawyer approves them.
- The picked videos were verified to exist and allow embedding, not watched end to end; review them and replace any that are weak.
- Live video over mobile networks was tested on a local network, not yet on a real mobile network.
- iOS is not set up in this guide.
