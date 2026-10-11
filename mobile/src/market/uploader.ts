import { apiRequest } from '../lib/api';

// Bo'lakli (1 MiB) yuklash, server bergan imzolangan URL'lar bilan. HOLAT: UNTESTED qurilmada (backend oqimi testlangan).
// Fayl `uri` dan Blob sifatida o'qiladi va bo'laklarga bo'linadi. Davom ettirish: /files/:id/resume faqat yetishmagan bo'laklarni qaytaradi.

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface UploadInit {
  fileId: string;
  chunkSize: number;
  chunkCount: number;
  parts: { index: number; url: string }[];
}

export interface UploadOptions {
  token: string;
  uri: string;
  name: string;
  mime: string;
  purpose: 'PAYMENT_PROOF' | 'MESSAGE_ATTACHMENT' | 'AVATAR' | 'CREDENTIAL' | 'CLASS_FILE' | 'HOMEWORK';
  onProgress?: (fraction: number) => void;
  signal?: { cancelled: boolean };
  /** Oldingi urinishdan qolgan fileId: yetishmagan bo'laklardan davom etadi */
  resumeFileId?: string;
}

export class UploadError extends Error {
  constructor(public code: string, message: string, public fileId?: string) {
    super(message);
  }
}

export async function uploadFile(o: UploadOptions): Promise<{ fileId: string }> {
  const blob = await (await fetch(o.uri)).blob();
  let info: UploadInit & { received?: number[] };
  try {
    info = o.resumeFileId
      ? await apiRequest(`/files/${o.resumeFileId}/resume`, { method: 'POST', token: o.token, body: {} })
      : await apiRequest('/files/init', { method: 'POST', token: o.token, body: { purpose: o.purpose, name: o.name, size: blob.size, mime: o.mime } });
  } catch (e: any) {
    throw new UploadError(e?.code ?? 'INIT_FAILED', e?.message ?? 'init failed');
  }
  const total = info.chunkCount;
  let done = total - info.parts.length;
  o.onProgress?.(done / total);
  for (const part of info.parts) {
    if (o.signal?.cancelled) {
      await apiRequest(`/files/${info.fileId}/cancel`, { method: 'POST', token: o.token, body: {} }).catch(() => undefined);
      throw new UploadError('CANCELLED', 'cancelled', info.fileId);
    }
    const body = blob.slice(part.index * info.chunkSize, Math.min(blob.size, (part.index + 1) * info.chunkSize));
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const res = await fetch(`${API_URL}${part.url}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body });
        ok = res.ok;
      } catch {
        /* tarmoq: qayta uriniladi */
      }
    }
    if (!ok) throw new UploadError('CHUNK_FAILED', 'upload interrupted; retry to resume', info.fileId);
    o.onProgress?.(++done / total);
  }
  try {
    await apiRequest(`/files/${info.fileId}/complete`, { method: 'POST', token: o.token, body: {} });
  } catch (e: any) {
    throw new UploadError(e?.code ?? 'COMPLETE_FAILED', e?.message ?? 'complete failed', info.fileId);
  }
  return { fileId: info.fileId };
}
