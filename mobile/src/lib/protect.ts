import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { market } from '../market/marketApi';

/** Blocks screenshots and screen recording on this screen while `on` is true (Android: the picture goes black; iPhone: the content is hidden in the recording). */
export function useScreenProtect(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let SC: typeof import('expo-screen-capture') | null = null;
    try { SC = require('expo-screen-capture'); } catch { SC = null; }
    const key = 'class-protect';
    void SC?.preventScreenCaptureAsync(key).catch(() => undefined);
    return () => { void SC?.allowScreenCaptureAsync(key).catch(() => undefined); };
  }, [on]);
}

/** For screens that know the class: the teacher's "protect content" switch applies to pupils (the teacher can still capture their own screen). */
export function useClassProtect(classId: string | undefined) {
  const { token } = useAuth();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!classId || !token) return;
    market.classDetail(token, classId).then((c) => setOn(!!c.protectContent && c.role !== 'teacher')).catch(() => undefined);
  }, [classId, token]);
  useScreenProtect(on);
  return on;
}

/** For lesson screens that only know the session. */
export function useSessionProtect(sid: string | undefined) {
  const { token } = useAuth();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!sid || !token) return;
    market.roomState(token, sid).then((s) => setOn(!!s.protectContent && s.role !== 'teacher')).catch(() => undefined);
  }, [sid, token]);
  useScreenProtect(on);
  return on;
}
