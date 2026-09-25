import { CURRENT_SAVE_VERSION, SaveState } from './types';

export const LOCAL_SAVE_KEY = 'severnyy-kuryer:save';

export function parseSave(raw: string | null | undefined): SaveState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SaveState;
    if (!s || s.version !== CURRENT_SAVE_VERSION || !s.player || !Array.isArray(s.missions)) return null;
    return s;
  } catch {
    return null;
  }
}

export function readLocal(): string | null {
  try {
    return localStorage.getItem(LOCAL_SAVE_KEY);
  } catch {
    return null;
  }
}

export function writeLocal(raw: string): void {
  try {
    localStorage.setItem(LOCAL_SAVE_KEY, raw);
  } catch {
    // Private mode / quota — the cloud copy (if any) still has it
  }
}

/** Picks the most recent of several candidate saves. */
export function newest(...saves: (SaveState | null)[]): SaveState | null {
  return saves.reduce<SaveState | null>(
    (best, s) => (s && (!best || s.savedAt > best.savedAt) ? s : best),
    null,
  );
}

/** Minimal async key-value store, as exposed by Telegram CloudStorage and VK Storage. */
export interface KeyValueStore {
  get(keys: string[]): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
}

/**
 * Cloud stores cap each value at 4096 (Telegram: chars, VK: bytes), so the save is
 * split into chunks. 1000 chars stays under 4096 bytes even for 4-byte UTF-8.
 * The chunk count is written last, so a half-written save is never picked up.
 */
const CHUNK = 1000;
const META_KEY = 'save_meta';
const chunkKey = (i: number) => `save_${i}`;

export async function writeChunked(store: KeyValueStore, raw: string): Promise<void> {
  const count = Math.ceil(raw.length / CHUNK);
  for (let i = 0; i < count; i++) {
    await store.set(chunkKey(i), raw.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  await store.set(META_KEY, String(count));
}

export async function readChunked(store: KeyValueStore): Promise<string | null> {
  const meta = await store.get([META_KEY]);
  const count = parseInt(meta[META_KEY] ?? '', 10);
  if (!count || count < 1) return null;
  const keys = Array.from({ length: count }, (_, i) => chunkKey(i));
  const values = await store.get(keys);
  if (keys.some(k => values[k] === undefined)) return null;
  return keys.map(k => values[k]).join('');
}

/** Injects an SDK <script> once; resolves when it has loaded. */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}
