import { useEffect } from 'react';

/**
 * Keeps a lesson running when the screen turns off or the app goes to the background (like Telegram's voice chat):
 * a silent looping sound makes Android run the app as a media foreground service with a notification, so the process,
 * the microphone and the lesson connection are not frozen. While the lesson screen is open the display also stays on.
 * Everything is best-effort: if a piece is missing the lesson still works, it just can pause in the background.
 */
interface Player { play: () => void; pause: () => void; release?: () => void; remove?: () => void; loop: boolean; volume: number; setActiveForLockScreen?: (a: boolean, m?: object, o?: object) => void }

export function useLessonKeepAlive(active: boolean, title: string) {
  useEffect(() => {
    if (!active) return;
    let player: Player | null = null;
    let KA: typeof import('expo-keep-awake') | null = null;
    try { KA = require('expo-keep-awake'); void KA?.activateKeepAwakeAsync('lesson'); } catch { KA = null; }
    (async () => {
      try {
        const A = require('expo-audio') as typeof import('expo-audio');
        await A.setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'mixWithOthers', allowsRecording: true } as never);
        const p = A.createAudioPlayer(require('../../assets/silence.wav')) as unknown as Player;
        p.loop = true;
        p.volume = 0.01;
        p.play();
        try { p.setActiveForLockScreen?.(true, { title, artist: 'School17' }, { showSeekBackward: false, showSeekForward: false }); } catch { /* the notification is optional */ }
        player = p;
      } catch {
        /* no background service available (for example Expo Go): the lesson simply pauses with the app */
      }
    })();
    return () => {
      try { void KA?.deactivateKeepAwake('lesson'); } catch { /* ignore */ }
      try { player?.setActiveForLockScreen?.(false); player?.pause(); player?.remove?.(); player?.release?.(); } catch { /* ignore */ }
    };
  }, [active, title]);
}
