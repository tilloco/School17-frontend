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

/** Reads a local file as a Blob. XMLHttpRequest is the reliable way on Android (fetch().blob() on a file:// address returned a few bytes). */
function readBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.onload = () => resolve(x.response as Blob);
    x.onerror = () => reject(new Error('Could not read the file'));
    x.responseType = 'blob';
    x.open('GET', uri, true);
    x.send(null);
  });
}

interface Source { size: number; slice: (start: number, end: number) => Promise<any> }

/**
 * Opens a local file for chunked upload. Images are small, so they are read once. Everything else (videos, archives, up to 100 GB)
 * is read piece by piece from disk, so the phone never holds the whole file in memory.
 */
async function openSource(uri: string, small: boolean): Promise<Source> {
  if (!small) {
    try {
      const FS = require('expo-file-system') as typeof import('expo-file-system');
      const file = new FS.File(uri);
      const size = file.size ?? 0;
      if (size > 0) {
        const handle = file.open();
        return { size, slice: async (a, b) => { handle.offset = a; return handle.readBytes(b - a); } };
      }
    } catch { /* fall back to reading it whole */ }
  }
  const blob = await readBlob(uri);
  return { size: blob.size, slice: async (a, b) => blob.slice(a, b) };
}

/** Any phone photo (HEIC, AVIF, huge camera files…) becomes a normal JPEG of at most 1600 px, so the server always accepts it. */
async function toJpeg(o: UploadOptions): Promise<UploadOptions> {
  if (!o.mime.startsWith('image/')) return o;
  try {
    const IM = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    const r = await IM.manipulateAsync(o.uri, [{ resize: { width: 1600 } }], { compress: 0.85, format: IM.SaveFormat.JPEG });
    return { ...o, uri: r.uri, mime: 'image/jpeg', name: o.name.replace(/\.[^.]+$/, '') + '.jpg' };
  } catch {
    return o;
  }
}

export async function uploadFile(input: UploadOptions): Promise<{ fileId: string }> {
  const o = input.resumeFileId ? input : await toJpeg(input);
  const blob = await openSource(o.uri, o.mime.startsWith('image/'));
  if (!blob.size) throw new UploadError('EMPTY_FILE', 'The file is empty or could not be read');
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
    const body = await blob.slice(part.index * info.chunkSize, Math.min(blob.size, (part.index + 1) * info.chunkSize));
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
