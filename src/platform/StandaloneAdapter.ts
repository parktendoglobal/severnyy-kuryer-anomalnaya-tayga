import { PlatformAdapter } from './types';

/** Обычный браузер и GitHub Pages: облака нет, всё хранит saveSystem в памяти браузера. */
export class StandaloneAdapter implements PlatformAdapter {
  readonly id = 'standalone' as const;
  async init(): Promise<void> {}
  async pullSave(): Promise<string | null> { return null; }
  async pushSave(): Promise<void> {}
  async clearSave(): Promise<void> {}
}
