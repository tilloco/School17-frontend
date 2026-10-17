import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { apiRequest } from '../lib/api';
import { attachListeners, registerPush, setBadge, unregisterPush } from './push';

/** Mounted once under the auth provider: registers this device after sign-in, opens the right screen on a tap, keeps the badge in sync, unregisters on sign-out. */
export function PushBootstrap() {
  const { token } = useAuth();
  const router = useRouter();
  const last = useRef<string | null>(null);

  useEffect(() => attachListeners((path) => router.push(path as never)), [router]);

  useEffect(() => {
    if (token) {
      last.current = token;
      void registerPush(token, { ask: true });
      void apiRequest<{ unread: number }>('/notifications/unread-count', { token }).then((r) => setBadge(r.unread)).catch(() => undefined);
    } else if (last.current) {
      const old = last.current;
      last.current = null;
      void unregisterPush(old);
      void setBadge(0);
    }
  }, [token]);

  return null;
}
