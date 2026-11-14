/** Food photos: downscaled to JPEG and kept in IndexedDB (not localStorage — too big). */
import { createStore, del, get, keys, set } from 'idb-keyval';

let _store: ReturnType<typeof createStore> | undefined;
/** Created on first use (keeps modules importable where IndexedDB doesn't exist, e.g. tests). */
const store = () => (_store ??= createStore('protein-photos', 'photos'));
const MAX_EDGE = 1280;

export async function resizeImage(file: Blob, maxEdge = MAX_EDGE): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.82));
}

export async function savePhoto(file: Blob): Promise<string> {
  const id = crypto.randomUUID();
  await set(id, await resizeImage(file), store());
  return id;
}

export const getPhoto = (id: string) => get<Blob>(id, store());
export const deletePhoto = (id: string) => del(id, store());
export const allPhotoIds = () => keys<string>(store());

/** Blob → base64 (no data: prefix). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Centre-crop to a square JPEG (e.g. profile photos). */
export async function cropSquare(file: Blob, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85));
}
