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
