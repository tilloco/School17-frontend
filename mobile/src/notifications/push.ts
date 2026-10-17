import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_URL, apiRequest } from '../lib/api';
import { routeFor } from './routes';

// Push registration. expo-notifications is loaded lazily and every call is guarded: a build without the module (or Expo Go, where remote
// push is not available on Android) simply runs without push, the in-app inbox keeps working. Nothing here can crash the app at startup.
export type PushStatus = 'ok' | 'no-module' | 'expo-go' | 'no-device' | 'denied' | 'no-project' | 'error';

const CHANNELS: { id: string; name: string; importance: 'HIGH' | 'DEFAULT' | 'LOW' }[] = [
  { id: 'messages', name: 'Messages', importance: 'HIGH' },
  { id: 'lessons', name: 'Lessons', importance: 'DEFAULT' },
  { id: 'reminders', name: 'Reminders', importance: 'HIGH' },
  { id: 'classes', name: 'Classes', importance: 'HIGH' },
  { id: 'homework', name: 'Homework', importance: 'DEFAULT' },
  { id: 'payments', name: 'Payments', importance: 'LOW' },
  { id: 'account', name: 'Account', importance: 'DEFAULT' },
];

/** Remote push does not work in Expo Go (SDK 53+); a development build is needed. */
const inExpoGo = () => Constants.executionEnvironment === 'storeClient';

let registeredToken: string | null = null;
let listenersAttached = false;

function mod(): typeof import('expo-notifications') | null {
  // Expo Go does not contain the native push module, and Metro shows a red error for a failed require even when it is caught: do not try there.
  if (inExpoGo()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }
}



export async function pushStatus(): Promise<PushStatus> {
  if (inExpoGo()) return 'expo-go';
  const N = mod();
  if (!N) return 'no-module';
  try {
    const p = await N.getPermissionsAsync();
    return p.granted ? 'ok' : 'denied';
  } catch {
    return 'error';
  }
}

/** Shows pushes while the app is open (banner + sound) and opens the right screen when one is tapped. */
export function attachListeners(navigate: (path: string) => void) {
  const N = mod();
  if (!N || listenersAttached) return () => undefined;
  try {
    N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
    listenersAttached = true;
    const sub = N.addNotificationResponseReceivedListener((resp) => {
      const data = (resp.notification.request.content.data ?? {}) as Record<string, unknown>;
      const path = routeFor(String(data.type ?? ''), data);
      if (path) navigate(path);
    });
    return () => {
      sub.remove();
      listenersAttached = false;
    };
  } catch {
    return () => undefined;
  }
}

/** Asks for permission (once), creates Android channels, gets the Expo token and stores it on the server. Safe to call on every login. */
export async function registerPush(authToken: string, opts: { ask?: boolean } = { ask: true }): Promise<PushStatus> {
  const N = mod();
  if (inExpoGo()) return 'expo-go';
  if (!N) return 'no-module';
  try {
    if (Platform.OS === 'android') {
      for (const c of CHANNELS) {
        await N.setNotificationChannelAsync(c.id, { name: c.name, importance: N.AndroidImportance[c.importance], vibrationPattern: [0, 200, 100, 200], lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE });
      }
    }
    let perm = await N.getPermissionsAsync();
    if (!perm.granted && opts.ask !== false && perm.canAskAgain) perm = await N.requestPermissionsAsync();
    if (!perm.granted) return 'denied';
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'no-project';
    const { data } = await N.getExpoPushTokenAsync({ projectId });
    await apiRequest('/push-tokens', { method: 'POST', token: authToken, body: { token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' } });
    registeredToken = data;
    return 'ok';
  } catch (e) {
    const msg = String((e as Error)?.message ?? '');
    return /physical device|simulator|emulator/i.test(msg) ? 'no-device' : 'error';
  }
}

/** On sign-out: the device must stop receiving this account's pushes. */
export async function unregisterPush(authToken: string) {
  const t = registeredToken;
  registeredToken = null;
  if (!t) return;
  try {
    await fetch(`${API_URL}/push-tokens`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ token: t }) });
  } catch {
    /* offline: the server drops the token when Expo reports the device unregistered */
  }
}

/** Shows the unread count on the app icon. */
export async function setBadge(n: number) {
  try {
    await mod()?.setBadgeCountAsync(n);
  } catch {
    /* badge is cosmetic */
  }
}
