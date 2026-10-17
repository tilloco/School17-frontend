import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { EMPTY_MEDIA } from '../src/call/rtc';
import { ShareFull } from '../src/call/ShareFull';
import { CallStage } from '../src/call/CallStage';

/** Local layout preview of the shared-screen views without a live call (development builds only). */
export default function DevShare() {
  const [full, setFull] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const last = useRef(0);
  if (!__DEV__) return null;
  const media = { ...EMPTY_MEDIA, remoteScreen: {}, remoteCamera: {} };
  const tap = () => {
    const now = Date.now();
    if (now - last.current < 350) { last.current = 0; setFull(true); } else last.current = now;
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#111', padding: 12, paddingTop: 60 }}>
      <View style={{ height: 250, borderRadius: 22, overflow: 'hidden' }}>
        <CallStage media={media as never} otherName="Dilnoza" waiting={false} sharingMine={false} onStopShare={() => undefined} cameraOff={false} swapped={swapped} onSwap={() => setSwapped((v) => !v)} onTapStage={tap} />
      </View>
      <ShareFull visible={full} media={media as never} quality={{ level: 'good', rttMs: 40 }} name="Dilnoza" swapped={swapped} onSwap={() => setSwapped((v) => !v)} onClose={() => setFull(false)} />
    </View>
  );
}
