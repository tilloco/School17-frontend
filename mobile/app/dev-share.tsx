import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../src/ui/Text';
import { EMPTY_MEDIA } from '../src/call/rtc';
import { ShareFull } from '../src/call/ShareFull';
import { CallStage } from '../src/call/CallStage';

/** Local layout preview of the shared-screen views without a live call (development builds only). */
export default function DevShare() {
  const [full, setFull] = useState(false);
  if (!__DEV__) return null;
  const media = { ...EMPTY_MEDIA, remoteScreen: {}, remoteCamera: null };
  return (
    <View style={{ flex: 1, backgroundColor: '#111', padding: 12, paddingTop: 60 }}>
      <View style={{ height: 250, borderRadius: 22, overflow: 'hidden' }}>
        <CallStage media={media as never} otherName="Dilnoza" waiting={false} sharingMine={false} onStopShare={() => undefined} cameraOff={false} />
        <Pressable onPress={() => setFull(true)} style={{ position: 'absolute', right: 10, bottom: 10, backgroundColor: '#0008', padding: 10, borderRadius: 20 }}><Text style={{ color: '#fff' }}>Full</Text></Pressable>
      </View>
      <ShareFull visible={full} media={media as never} quality={{ level: 'good', rttMs: 40 }} name="Dilnoza" onClose={() => setFull(false)} />
    </View>
  );
}
