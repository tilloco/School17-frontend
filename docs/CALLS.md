# Video calls (S4)

## Provider choice: LiveKit (behind `CallProvider`)

| Option | Self-host | Relay (TURN) | Adaptive bitrate | RN/Expo SDK | Cost for 1:1 | Verdict |
|---|---|---|---|---|---|---|
| **LiveKit** (Cloud or self-hosted SFU) | yes (open source; **VERIFY license text**) | embedded TURN, TLS on 443 | simulcast + dynacast + adaptive stream | `@livekit/react-native` (+ config plugins); **not Expo Go** | Cloud: Build plan free 5,000 WebRTC min/mo; Ship $50/mo incl. 150,000 min then $0.0005/min; bandwidth 50GB/250GB incl., then $0.12/GB (livekit.com/pricing, fetched 2026-10-11) | **chosen** |
| Jitsi (self-hosted) | yes | coturn needed | yes | RN SDK exists, heavier | server cost only | more ops work (Prosody/Jicofo/JVB), weaker custom UI |
| Daily | no | included | yes | RN SDK (dev build) | ~$4 / 1,000 participant-min (third-party 2023 post, **VERIFY**) | easy, but no self-host, data location unclear |
| Agora | no | included | yes | RN SDK | ~$3.99 / 1,000 min HD (third-party, **VERIFY**) | closed, region/data questions |
| 100ms | no | included | yes | RN SDK | not found | not researched further |

Why LiveKit: an open-source SFU we can later self-host (data location control: **NEEDS LAWYER** - Uzbek personal-data localisation rules, see LAWYER_QUESTIONS.md), embedded TURN (important for mobile/CGNAT networks), simulcast + dynacast for weak networks, a token model that fits (short-lived JWT scoped to one room), and webhooks for authoritative presence. Cloud region pinning is only on the Scale/Enterprise plans per the pricing page, so cloud use on cheaper plans cannot promise a region.
We do NOT write our own media server. Our `MockCallProvider` moves no media.

## Env var names (values are never in the repo)
Backend: `CALL_PROVIDER` (`mock` default | `livekit`), `LIVEKIT_URL` (wss://...), `LIVEKIT_HTTP_URL` (optional), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `MOCK_CALL_SECRET` (dev only), tunables `CALL_JOIN_OPENS_MINUTES_BEFORE`, `CALL_JOIN_CLOSES_MINUTES_AFTER_END`, `CALL_TOKEN_TTL_SECONDS`, `CALL_NOSHOW_GRACE_MINUTES`, `CALL_MIN_LESSON_SECONDS`, `CALL_PRESENT_MIN_SECONDS`, `CALL_PRESENCE_STALE_SECONDS`.
The mock provider refuses to start when `NODE_ENV=production`.

## What the server guarantees (tested with the mock provider + throwaway Postgres)
- Token only for the two booked participants (teacher, pupil). The booking guardian of a minor is NOT a participant (safeguarding/product question, see LAWYER_QUESTIONS.md).
- Token only while the booking is CONFIRMED and inside the join window (5 min before start .. 5 min after end). TTL 10 min, shortened near window close. Room name is 128-bit random and never sent to clients; participant identities are anonymous keys.
- Cancel / reschedule revokes the room (provider room closed, token rows revoked, sessions closed); a new room is created for the new time.
- Presence: with a real provider only webhooks count (a client cannot claim attendance). With the mock provider client heartbeats count.
- Outcome from presence: COMPLETED (>= 5 min together; billable = time together, capped at scheduled length), NO_SHOW_STUDENT / NO_SHOW_TEACHER, FAILED (nobody joined, or both joined but < 5 min together -> review).
- Recording: OFF; never when the pupil is a minor or the birth date is unknown; needs both consents; even then the start endpoint returns 501 (not implemented). **NEEDS LAWYER.**

## Client (React Native, `mobile/src/call`, screen `mobile/app/call/[bookingId].tsx`)
- Pure state machine `shared/call-machine.ts` (copy in `mobile/src/call/call-machine.ts`, equality enforced by a test): join, reconnect with backoff 1/2/4/8 s and a 120 s give-up, audio-only after 3 poor samples, video back after 6 good ones, mute/camera/share, window close.
- Driver `rtc.ts` (LiveKit) is **UNTESTED on a device**.

### Expo Go vs development build
| Where | Works? |
|---|---|
| Expo Go | **No** for video. LiveKit docs: "The LiveKit SDK is not compatible with the Expo Go app due to the native code required." The screen detects Expo Go and explains. The rest of the app still works in Expo Go. |
| Development build (expo-dev-client is already a dependency) / EAS build | Yes, after installing the native packages below and rebuilding. **Not done here (no big downloads, no emulators).** |
| Browser | `livekit-client` works in a browser; no web app exists yet. The headless smoke test uses raw WebRTC. |

Install when ready (changes package.json, needs a native rebuild):
```
cd mobile
npx expo install @livekit/react-native @livekit/react-native-expo-plugin @livekit/react-native-webrtc @config-plugins/react-native-webrtc
npm install livekit-client
# add to app.json plugins: "@livekit/react-native-expo-plugin", "@config-plugins/react-native-webrtc"
eas build --profile development --platform android   # uses EAS build credits / account: not run here
```
`rtc.ts` calls `registerGlobals()` when the packages exist.

## Tests
- `calls.unit.spec.ts` (presence/outcome/recording policy, token structure, webhook signature, factory), `calls.int.spec.ts` (permissions, window, revocation, reconnect, billing, no-show, IDOR), `shared/call-machine.spec.ts` (state machine), `calls.smoke.spec.ts` (two headless Edge/Chrome browsers, fake camera/mic, real WebRTC peer-to-peer through a TEST-ONLY signalling endpoint; includes a forced drop and automatic reconnect). The smoke test is skipped when no browser is found (`SMOKE_BROWSER` overrides the path).
- The smoke test proves our token flow, presence, reconnect handling and billing end to end on one machine. It does **not** prove SFU behaviour, TURN, packet-loss handling or phone performance.

## Measurement plan (run when real keys + devices exist)
Run each scenario 10 times on two real phones (mid-range Android, plus an iPhone if available), on mobile data and on Wi-Fi:

| Metric | How | Target (proposal, to validate) |
|---|---|---|
| Time to join (tap Join -> first remote frame) | `joinMs` is recorded in `CallEvent type=quality` | p50 <= 4 s, p95 <= 8 s on 4G |
| Reconnect time after a 5 s airplane-mode toggle | machine `reconnects`, server `rejoined` events | p95 <= 15 s |
| Packet loss / RTT during a call | heartbeat `quality` events (`lossPct`, `rttMs`) | median loss <= 2 %, RTT <= 300 ms same region |
| Audio-only fallback | throttle to ~150 kbps / 10 % loss | switches within 3 samples (~45 s), audio stays intelligible |
| Call success rate | share of CONFIRMED lessons ending COMPLETED vs FAILED | >= 97 % excluding no-shows |
| Battery / thermal | 30 min call on a mid-range phone | < 15 % battery, no throttling |
| TURN necessity | share of calls connecting only via relay (LiveKit stats) | informs cost |

Region test: measure from Tashkent to the chosen LiveKit region versus a self-hosted node (**VERIFY** which regions exist).
