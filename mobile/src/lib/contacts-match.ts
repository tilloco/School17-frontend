import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';

/** "90 123 45 67", "+998 90…", "8 90…" → "+998901234567"; anything that is not a plausible number → null. */
export function toE164(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (d.startsWith('+')) return /^\+\d{9,14}$/.test(d) ? d : null;
  if (/^998\d{9}$/.test(d)) return '+' + d;
  if (/^\d{9}$/.test(d)) return '+998' + d;
  if (/^0\d{9}$/.test(d)) return '+998' + d.slice(1);
  return null;
}

/** Reads the phone's contacts (only after the person agreed) and returns SHA-256 hashes of the numbers. Numbers and names never leave the phone. */
export async function contactHashes(): Promise<{ denied: boolean; hashes: string[] }> {
  const perm = await Contacts.requestPermissionsAsync();
  if (!perm.granted) return { denied: true, hashes: [] };
  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], pageSize: 3000 });
  const nums = new Set<string>();
  for (const c of data) for (const p of c.phoneNumbers ?? []) { const n = p.number ? toE164(p.number) : null; if (n) nums.add(n); }
  const hashes = await Promise.all([...nums].slice(0, 3000).map((n) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, n)));
  return { denied: false, hashes };
}
