import { PlatformAdapter, PlatformId, SaveState } from './types';
import { KeyValueStore, newest, parseSave, readChunked, readLocal, writeChunked, writeLocal } from './storage';

/**
 * Shared logic for platforms with a cloud key-value store: localStorage is written
 * every time (fast, survives offline), the cloud only when the save actually changed,
 * and load takes whichever copy is newer — so progress follows the user across devices.
 */
export abstract class CloudSaveAdapter implements PlatformAdapter {
  abstract readonly id: PlatformId;
  abstract init(): Promise<void>;
  /** null when the SDK is unavailable — the adapter then works from localStorage only. */
  protected abstract cloud(): KeyValueStore | null;

  private lastCloudPayload: string | null = null;
  private cloudWrite: Promise<void> = Promise.resolve();

  async save(state: SaveState): Promise<void> {
    const raw = JSON.stringify(state);
    writeLocal(raw);

    const store = this.cloud();
    // Compare without the timestamp, which changes on every call
    const payload = JSON.stringify({ ...state, savedAt: 0 });
    if (!store || payload === this.lastCloudPayload) return;
    this.lastCloudPayload = payload;

    // Serialize writes so chunks from two saves never interleave
    this.cloudWrite = this.cloudWrite
      .then(() => writeChunked(store, raw))
      .catch(err => {
        this.lastCloudPayload = null;
        console.warn(`[platform:${this.id}] cloud save failed`, err);
      });
    return this.cloudWrite;
  }

  async load(): Promise<SaveState | null> {
    const local = parseSave(readLocal());
    const store = this.cloud();
    if (!store) return local;
    try {
      return newest(local, parseSave(await readChunked(store)));
    } catch (err) {
      console.warn(`[platform:${this.id}] cloud load failed`, err);
      return local;
    }
  }
}
