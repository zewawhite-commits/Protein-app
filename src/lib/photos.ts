/** Food photos: downscaled to JPEG and kept in IndexedDB (not localStorage — too big). */
import { createStore, del, get, keys, set } from 'idb-keyval';

const store = createStore('protein-photos', 'photos');
const MAX_EDGE = 1280;

export async function resizeImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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
  await set(id, await resizeImage(file), store);
  return id;
}

export const getPhoto = (id: string) => get<Blob>(id, store);
export const deletePhoto = (id: string) => del(id, store);
export const allPhotoIds = () => keys<string>(store);
