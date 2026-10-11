// Brauzerdan backendning admin API'siga proksi: FAQAT quyidagi aniq yo'llar ruxsat etiladi (boshqa hamma narsa 404).
// Token cookie'da qoladi; brauzer kodi hech qachon tokenni ko'rmaydi.
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

const RULES: { method: 'GET' | 'POST'; re: RegExp }[] = [
  { method: 'POST', re: new RegExp(`^teachers/${UUID}/(approve|reject|suspend|reinstate)$`) },
  { method: 'POST', re: new RegExp(`^teachers/credentials/${UUID}/(approve|reject)$`) },
  { method: 'POST', re: new RegExp(`^reports/${UUID}/resolve$`) },
  { method: 'POST', re: new RegExp(`^users/${UUID}/(suspend|reinstate)$`) },
  { method: 'POST', re: new RegExp(`^reviews/${UUID}/(hide|restore)$`) },
  { method: 'POST', re: new RegExp(`^files/${UUID}/download-url$`) },
];

export function isAllowedProxy(method: string, path: string): boolean {
  if (path.includes('..') || path.includes('//') || path.startsWith('/')) return false;
  return RULES.some((r) => r.method === method && r.re.test(path));
}

/** Kross-sayt so'rovni rad etish: Origin bor bo'lsa, u shu sayt hosti bilan bir xil bo'lishi shart. */
export function sameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return true; // server-server yoki bir xil saytdan oddiy so'rov
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
