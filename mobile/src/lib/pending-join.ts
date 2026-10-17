import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'school17_pending_join';

/** A class invite opened before the person was signed in: remembered until they are. */
export async function savePendingJoin(token: string): Promise<void> {
  try { await AsyncStorage.setItem(KEY, token); } catch { /* not remembered */ }
}
export async function takePendingJoin(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) await AsyncStorage.removeItem(KEY);
    return v;
  } catch { return null; }
}

/** The link a teacher shares: opens the School17 app straight on the class (the server page redirects to school17://join/<token>). */
export const inviteLink = (apiUrl: string, token: string) => `${apiUrl.replace(/\/+$/, '')}/j/${token}`;
