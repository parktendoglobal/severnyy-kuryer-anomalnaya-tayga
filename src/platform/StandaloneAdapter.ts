import { PlatformAdapter, SaveState } from './types';
import { parseSave, readLocal, writeLocal } from './storage';

/** Plain browser / GitHub Pages: localStorage only. */
export class StandaloneAdapter implements PlatformAdapter {
  readonly id = 'standalone' as const;

  async init(): Promise<void> {}

  async save(state: SaveState): Promise<void> {
    writeLocal(JSON.stringify(state));
  }

  async load(): Promise<SaveState | null> {
    return parseSave(readLocal());
  }
}
