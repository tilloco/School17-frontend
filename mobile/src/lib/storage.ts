import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'school17_access_token';

// Token'ni himoyalangan qurilma xotirasida saqlaymiz (Keychain/Keystore) -
// oddiy AsyncStorage'dan farqli o'laroq, bu qurilma darajasida shifrlangan.
export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
const ADMIN_KEY_STORAGE = 'school17_admin_key';

export async function saveAdminKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(ADMIN_KEY_STORAGE, key);
}

export async function getAdminKey(): Promise<string | null> {
  return SecureStore.getItemAsync(ADMIN_KEY_STORAGE);
}

export async function clearAdminKey(): Promise<void> {
  await SecureStore.deleteItemAsync(ADMIN_KEY_STORAGE);
}