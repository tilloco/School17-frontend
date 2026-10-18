import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY = 'school17_device_id';
let cached: string | null = null;

/**
 * A random id made once on this phone. The server uses it to count how many sign-in codes this phone asked for
 * (so changing the typed number does not reset the count). It is not linked to anything else.
 */
export async function deviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) return (cached = saved);
  } catch { /* storage unavailable: use an id for this run only */ }
  const bytes = await Crypto.getRandomBytesAsync(18);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  cached = id;
  try { await SecureStore.setItemAsync(KEY, id); } catch { /* not remembered */ }
  return id;
}
