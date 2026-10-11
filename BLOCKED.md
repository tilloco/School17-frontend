# BLOCKED
Format: ID - what / why / what the human must do.

## R4 - media client binding (blocked)
- What: apply CLASS_QUALITY to a real LiveKit client (simulcast + dynacast + adaptiveStream publish options, audio presets, tile subscriptions, stats-driven ladder, auto rejoin with fresh token, Android foreground service, iOS background audio session, Bluetooth/speaker routing, incoming-call handling, device picker, mic level meter).
- Why: no LiveKit client SDK is installed in mobile (@livekit/react-native, livekit-client, react-native-webrtc), it needs a development build (not Expo Go), and nothing here can be run without a device or emulator.
- Human must: run `npx expo install @livekit/react-native @livekit/react-native-webrtc livekit-client @livekit/react-native-expo-plugin`, add the plugin to app.json, make an EAS/dev build, then wire useClassRoomMedia() to shared/class-quality.ts (reduceLadder, viewerVideoTiles, teacherGridPage, reconnectDelayMs, CLASS_QUALITY.resync) and test on real phones with CALL_TEST_CHECKLIST.md.
