# KNOWN GAPS (not tested against a real service/device, or not done)

- Prisma queries are tested against a throwaway local PostgreSQL 18 only; never against the production DB or its data volumes.
- No linter in project (typecheck only).
- Admin panel (Next.js) and mobile screens for marketplace features: see per-milestone notes below.

## S4 Video calls
- LiveKit adapter (`livekit-provider.ts`) is **UNTESTED against a real LiveKit server**: only token claims and webhook signature verification were checked locally. Twirp room calls (CreateRoom/DeleteRoom) never executed; grant names follow LiveKit docs: VERIFY.
- Mobile call driver (`mobile/src/call/rtc.ts`), hook and screen are type-checked only; never run on a device or emulator. LiveKit native packages are NOT in `package.json`. Expo Go cannot do video (see docs/CALLS.md).
- `sampleStats()` field names depend on the SDK version: VERIFY.
- Real-network behaviour (TURN, packet loss, adaptive bitrate, battery) is unmeasured; see the measurement plan in docs/CALLS.md. Targets there are proposals.
- The smoke test uses real WebRTC between two local browsers with a test-only P2P signalling endpoint (not an SFU, no TURN, loopback network). It is timing sensitive; see TEST_REPORT.md for its observed stability.
- Recording is policy + consent storage only; no recording exists.
- In-call chat is a provider data channel and is not stored server-side (the UI says so). Persistent chat comes with S5.
- A guardian cannot observe a minor's lesson (tokens only for the two booked participants). Product/safeguarding decision pending.
- Presence with the mock provider trusts client heartbeats; with LiveKit only webhooks are trusted (untested).

## S5 Messaging and files
- No S3/R2 adapter: uploads/downloads use LocalDiskStorage + our own signed-URL endpoints. A production object store (direct-to-storage presigned multipart) is NOT built or tested. Local disk is not suitable for multiple servers.
- PDF first-page preview is NOT implemented (needs poppler or pdfjs+canvas); PDFs have page count only. Image thumbnails are implemented (sharp).
- ClamAV adapter (`ClamdScanProvider`) is UNTESTED against a real clamd. Default is NO scanning (files marked NOT_SCANNED) unless CLAMD_HOST is set; set FILE_SCAN_REQUIRED=true in production.
- PDF active-content check is a keyword scan on raw bytes: it will miss obfuscated/compressed object streams. It is a filter, not proof of safety.
- Files are fully buffered in memory during completion (up to 50 MB). Fine for current limits; not for large video.
- Image decoding relies on libvips (sharp) security updates; keep it updated.
- Virus-free is never claimed anywhere in the UI.
- Mobile chat UI and file picker/upload progress UI are NOT built yet (backend + API only); see S11 note.
- Typing indicators, message delete/edit, search and push notifications for messages are not built.
- Unread counts are computed by queries (fine for current scale, no caching).

## S6 Discovery
- Tested with 600 generated teachers on a local DB (21 ms). Behaviour at real data sizes, with real text (Uzbek Cyrillic/Latin transliteration, typos) is untested; ILIKE does not do stemming or transliteration.
- The availability filter evaluates at most 300 candidates per request (sorted first); beyond that, matching teachers can be missed.
- Blocked-user exclusion is wired (hiddenFor) but empty until S9.
- No mobile search/filters UI yet (API only).

## S7 Reviews
- Completed lessons in tests are set via direct DB update for speed; the real path (call -> COMPLETED) is covered separately in S4 tests.
- Review-gaming defences are Bayesian shrinkage, one-per-completed-lesson (which needs 5+ min of real presence) and moderation. Colluding accounts that complete genuine paid lessons are NOT detected (no anomaly detection).
- Review text is not automatically scanned for phone numbers/abuse; moderation is report-driven.
- No mobile UI for reviews yet.

## S8 Earnings (see also PAYMENTS_GAPS.md)
- Mock provider only: NO real charge, refund or payout was ever executed against any payment service. Everything money-related is untested against real processors.
- No provider reconciliation or refund-retry queue: if a provider refund fails after the ledger entry, it is only logged.
- Settlement/refund percentages and the 90 % rule are product defaults, not legal advice.
- No fiscal receipts/tax, no payout KYC, no multi-currency.
- Admin UI for payments/payouts/disputes does not exist (API only).
- Mobile screens for paying, earnings dashboard and payouts are not built.

## S9 Safety
- Guardianship cannot be verified (code sharing proves nothing about parenthood). NEEDS LAWYER.
- Contact-info filter is heuristic: misses spelled-out digits, images/PDFs with text, other languages' messenger names; also blocks some legitimate 9-10 digit numbers (e.g. in maths) in chats with minors.
- No automated content moderation (images, abuse language); moderation is report-driven. No admin UI for the moderation queue.
- Safety tips and legal texts are drafts; tips need a child-safeguarding specialist.
- Blocks do not cancel existing future bookings automatically.
- Mobile UI for report/block/guardian linking does not exist yet.

## S10 Privacy
- No retention job: old notifications, call events, audit rows and soft-deleted files are not purged automatically beyond the 24 h pending-upload sweep.
- Export is JSON only, built in memory (fine for current size); it does not include file bytes.
- Deleting an account does not scrub server/host logs, backups, or copies at third-party providers.
- Guardian-requested export/deletion of a minor's data is not implemented; no admin-initiated erasure workflow.
- Consent screens are API-only (no mobile UI); consent text versions are hard-coded drafts.

## S11 Notifications
- Expo Push sender is UNTESTED against the real Expo service (fake fetch only); mobile does not register push tokens yet (no UI wired).
- No email notifications at all (no SMTP/provider); no quiet hours; no user notification preferences.
- Reminders are created at confirmation time (24 h and 15 min) and removed on cancel; reschedule re-creates them. Not verified on a real clock over days.

## S11 Mobile UI and languages
- All new mobile screens (app/market/*, call screen) are type-checked only; never rendered on a device/emulator (no emulators allowed here). Layout, accessibility labels and keyboard behaviour are unverified.
- Chat uses polling (5 s), not the socket.io channel; no attachment picker/upload UI, no typing indicators, no push-token registration, no reschedule/review/payment/earnings screens, no teacher profile editor or availability editor, no admin UI.
- The old exam-app screens still contain hard-coded Uzbek text (not touched).
- Offline handling = "can't reach server" state with retry; there is no offline cache or queued sending.

## A1 Free mode
- Wording in uz/ru texts was written by me and has not been reviewed by a native legal translator. The S8 payment/ledger code is dormant but still shipped; it has only ever run against the mock provider.
- DATA_INVENTORY.md and PAYMENTS_GAPS.md still describe the dormant payment tables; they are not live data in free mode.

## A2 Card details
- Changing APP_DATA_KEY makes stored cards unreadable (no key rotation / re-encryption tool); teachers must re-enter. The dev fallback key is public in the source: never use it with real cards.
- Mobile: only the teacher editor (app/market/card.tsx) exists; the pupil reveal + copy button arrive with A3 (Pay screen). Screen type-checked only, never run on a device.
- Server logs/HTTP proxies in front of the API could log request bodies of PUT /teachers/me/payment-info: configure them not to (not verifiable here).

## A3 Direct payment tracking
- The app cannot verify any transfer: marks are statements by the two users, nothing more. Disputes (fake receipts, wrong card holder) can only be reported; nobody can recover money.
- Pay screen, clipboard copy, receipt picker and the chunked uploader (src/market/uploader.ts) are type-checked only; never run on a device. expo-image-picker plugin was added to app.json: needs a rebuild of the development client.
- Existing accepted bookings from before A3 get a record lazily when someone opens the payment view.
- The teacher's money board and list of own payments come with A4; the profile editor field for paymentTiming comes with A5 (the API already accepts it).

## A5 Teacher setup (mobile)
- All A5 screens (today, requests, profile-edit, availability) are type-checked only; never rendered on a device. Image picking/upload for the profile photo is unverified on devices.
- Days off are stored as whole UTC days from the dates typed (not exact local-midnight boundaries in the teacher's time zone). Subject/level/language chips show catalog ids (e.g. "math"), not translated names.
- The availability editor uses plain HH:MM text boxes (no time picker); invalid input is rejected client-side and by the server.
- The teacher's profile photo is not yet shown in search results or on the teacher page (API supports GET /teachers/:id/photo; hasPhoto flag exists).
- The full smoke test (real WebRTC) failed once in ~10 full-suite runs; it passes alone 6/6. Diagnostics were added so the next failure prints page state and call events.

## A6 Admin web
- Verified by a real `next build` + `next start` end-to-end test (login, queue, detail, escaping, proxy rules, report resolve, user suspend, signed document link) against the throwaway backend. NOT verified in a browser by a human: layout, mobile widths, keyboard/screen-reader use.
- The e2e test needs `admin/.next` (run `npm run build` in admin/ first) and port 3101; it is skipped otherwise.
- The old exam-app admin pages (/, /users, /users/[id]) call /admin/stats and /admin/users, which I did not test; they compile but may not match the current backend guards.
- `next build` downloads Google Fonts at build time (needs internet). Login has no brute-force limit in the web layer beyond the backend's throttle. No two-factor, no per-admin permissions beyond the existing SUPERADMIN/EDITOR roles.
- The panel shows the first 20/50 items per page with simple prev/next links; no bulk actions.

## A4 money board
- Mobile money.tsx and my-payments.tsx are type-checked only, never run on a device; Share sheet CSV not tried.
- Income and reminders count only marks, not real money; the platform cannot verify any payment.
