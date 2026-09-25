import { PlatformAdapter, SaveState } from './types';
import { loadScript, parseSave, readLocal, writeLocal } from './storage';

const SDK_URL = 'https://st.max.ru/js/max-web-app.js';

interface MaxWebApp {
  initData?: string;
  ready?(): void;
  expand?(): void;
}

declare global {
  interface Window {
    WebApp?: MaxWebApp;
  }
}

/**
 * MAX mini app. Saves stay in the WebView's localStorage — swap in MAX's cloud
 * storage here once the game needs cross-device progress on MAX.
 */
export class MaxAdapter implements PlatformAdapter {
  readonly id = 'max' as const;

  async init(): Promise<void> {
    if (!window.WebApp) await loadScript(SDK_URL);
    window.WebApp?.ready?.();
    window.WebApp?.expand?.();
  }

  async save(state: SaveState): Promise<void> {
    writeLocal(JSON.stringify(state));
  }

  async load(): Promise<SaveState | null> {
    return parseSave(readLocal());
  }
}
