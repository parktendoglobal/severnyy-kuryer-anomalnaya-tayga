/** Простое хранилище «ключ — строка», как CloudStorage в Telegram и Storage в VK. */
export interface KeyValueStore {
  get(keys: string[]): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
}

/**
 * Облачные хранилища ограничивают одно значение 4096 (Telegram — символов, VK — байт),
 * поэтому сохранение режется на куски. 1000 символов меньше 4096 байт даже для 4-байтовых
 * символов UTF-8. Число кусков пишется последним, поэтому недописанное сохранение не прочитается.
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

/** Стереть облачную копию: без числа кусков сохранение считается отсутствующим. */
export async function clearChunked(store: KeyValueStore): Promise<void> {
  await store.set(META_KEY, '');
}

/**
 * Облачная копия поверх KeyValueStore: одна запись за раз (куски двух сохранений не
 * перемешаются) и без повторной отправки, если сохранение не изменилось.
 */
export class CloudSaves {
  private lastPushed: string | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly store: () => KeyValueStore | null) {}

  async pull(): Promise<string | null> {
    const store = this.store();
    return store ? readChunked(store) : null;
  }

  push(raw: string): Promise<void> {
    const store = this.store();
    // savedAt меняется при каждом сохранении, поэтому сравниваем без него
    const payload = withoutSavedAt(raw);
    if (!store || payload === this.lastPushed) return this.queue;
    this.lastPushed = payload;
    this.queue = this.queue
      .then(() => writeChunked(store, raw))
      .catch(err => {
        this.lastPushed = null;
        console.warn('[platform] облачное сохранение не записалось', err);
      });
    return this.queue;
  }

  clear(): Promise<void> {
    const store = this.store();
    this.lastPushed = null;
    if (!store) return this.queue;
    this.queue = this.queue.then(() => clearChunked(store)).catch(() => {});
    return this.queue;
  }
}

function withoutSavedAt(raw: string): string {
  return raw.replace(/"savedAt":"[^"]*"/, '');
}

/** Подключить скрипт SDK один раз; промис выполнится, когда скрипт загрузится. */
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
