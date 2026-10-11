# DATA_INVENTORY

What personal data the School17 marketplace stores (as implemented in `backend/prisma/schema.prisma`, 2026-10). "Delete" = what `POST /me/delete` does. All retention periods marked **LAWYER** are placeholders to be set by a lawyer. Storage today: one PostgreSQL database + a local-disk folder for uploads (`FILES_DIR`, default `backend/uploads-private`). Encryption at rest: **not implemented by the application; depends on the hosting disk/DB settings (unconfirmed)**. Transport: HTTPS/TLS expected in front of the API (set up by the deployer, not enforced by code). No end-to-end encryption anywhere.

| Data | Table / place | Whose | Purpose | Visible to | On account delete | Retention |
|---|---|---|---|---|---|---|
| Email, name, avatar URL, role, locale, timezone | `User` | all users | account, sign-in, display | owner; name shown to counterparts ("First L." for minors) | email replaced by `deleted-<id>@deleted.invalid`, name/avatar removed | row kept anonymised |
| Date of birth | `User.dateOfBirth` | all users | age rules (13+, minors need guardian) | owner, server logic only (never sent to counterparts) | removed | - |
| Exam-app data (progress, answers, streak, exam sessions, AI recommendations, onboarding) | `UserProgress`, `UserAnswer`, `Streak`, `ExamSession`, `AiRecommendation`, `OnboardingSession` | existing exam-prep users | existing product | owner | deleted | - |
| Old exam-app payments/withdrawals/premium grants | `Payment`, `Withdrawal`, `PremiumGrant`, `Referral` | existing users | financial records | owner/admin | kept (financial) | **LAWYER** |
| Guardian links, link codes | `GuardianLink`, `GuardianLinkCode` | minors, guardians | oversight of minors | the two linked users (names only) | links REVOKED, codes deleted | link rows kept |
| Teacher profile text, subjects, prices, intro-video URL | `TeacherProfile` | teachers | marketplace listing | everyone (when VERIFIED) | emptied, status SUSPENDED | row kept |
| Availability, time off | `AvailabilityRule`, `TeacherTimeOff` | teachers | booking | teacher; derived free slots public | deleted | - |
| Credential documents (diplomas, ID) | `TeacherCredential` + `StoredFile` (PDF/images on disk) | teachers | verification | owner, admin reviewers (each download audited) | deleted incl. file bytes | - |
| Bookings | `Booking` | pupil, booker, teacher | lessons | participants (+ pupil's guardian) | kept (financial/dispute evidence) | **LAWYER** |
| Call attendance times, connection-quality stats | `CallRoom`, `CallSession`, `CallEvent`, `CallTokenIssue` | participants | billing, no-show handling, support | participants (own), admins (event log) | `CallEvent` rows of the user deleted; rooms/sessions kept with pseudonymous keys | **LAWYER** |
| Audio/video | not stored (relayed by the video provider; recording not implemented) | - | - | - | - | - |
| Messages (text) | `ChatThread`, `ChatMessage` | pupil, teacher | communication | the two participants, pupil's guardian (read-only), admins only via a report snapshot | own messages blanked (`deletedAt`) | - |
| Message attachments | `StoredFile` (+ disk) | senders | sharing homework | participants, pupil's guardian | bytes deleted | pending uploads auto-deleted after 24 h |
| Reviews | `Review` | author (booker), teacher | trust | public ("First L.") | text erased, rating kept | rating kept |
| Payments, ledger, payouts | `LessonPayment`, `LedgerEntry` (append-only), `PayoutRequest` | payers, teachers | money handling | owner; admins | **kept** (legal) | **LAWYER** |
| Payout destination label (e.g. "Humo ****1234"); never full card numbers | `PayoutRequest.destination` | teachers | payouts | owner, payout admins | kept with payout row | **LAWYER** |
| Reports, blocks | `Report` (with snapshot of reported messages), `UserBlock` | reporter, reported | safety | admins (reports); owner (blocks) | blocks deleted; reports **kept** | **LAWYER** |
| Consent records | `Consent` | all users | proof of terms/privacy/guardian statement | owner, admins | **kept** | **LAWYER** |
| Audit log | `AuditLog` (actor id, action, target; secrets scrubbed) | all | accountability | admins | **kept** | **LAWYER** |
| Notification outbox | `Notification` | recipients | reminders | recipient | deleted | - |
| Server logs (IP, user agent) | Nest/HTTP logs, host logs | all | operations | operators | not touched by the app | **LAWYER** |
| Device/push tokens | not implemented yet | - | - | - | - | - |

## Not collected
Phone numbers (the older exam app used phone OTP, current auth is email/Google), government ID numbers (credential scans may contain them: teachers upload them as files), precise location (photo EXIF/GPS is stripped on upload), contacts, advertising identifiers.

## Third parties (planned/possible, none contacted in this build)
Video provider (LiveKit self-hosted or cloud), object storage, email/push, payment processors (none yet), malware scanner (ClamAV, optional). **Data location of each: LAWYER** (see LAWYER_QUESTIONS.md).

## Export / deletion
`GET /me/export` (rate-limited 3/hour, audited) returns the user's own data as JSON, never other users' emails/ids/birth dates. `POST /me/delete {confirm:"DELETE"}` refuses while open bookings, unsettled money or teacher balances exist (code `DELETE_BLOCKED`). Guardian-initiated deletion/export of a minor's account is **not implemented** (LAWYER).
