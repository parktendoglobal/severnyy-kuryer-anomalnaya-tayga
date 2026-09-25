import { CloudSaveAdapter } from './CloudSaveAdapter';
import { KeyValueStore, loadScript } from './storage';

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';

interface TelegramCloudStorage {
  setItem(key: string, value: string, cb?: (err: string | null, ok?: boolean) => void): void;
  getItems(keys: string[], cb: (err: string | null, values?: Record<string, string>) => void): void;
}

interface TelegramWebApp {
  initData: string;
  version: string;
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  isVersionAtLeast?(v: string): boolean;
  CloudStorage?: TelegramCloudStorage;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** Telegram Mini App: saves go to Telegram CloudStorage (synced across the user's devices). */
export class TelegramAdapter extends CloudSaveAdapter {
  readonly id = 'telegram' as const;

  private get webApp(): TelegramWebApp | undefined {
    return window.Telegram?.WebApp;
  }

  async init(): Promise<void> {
    if (!this.webApp) await loadScript(SDK_URL);
    const wa = this.webApp;
    if (!wa) return;
    wa.ready();
    wa.expand();
    // Stop vertical swipes (joystick drags) from collapsing the mini app
    wa.disableVerticalSwipes?.();
  }

  protected cloud(): KeyValueStore | null {
    const wa = this.webApp;
    const cs = wa?.CloudStorage;
    // CloudStorage exists from Bot API 6.9
    if (!cs || (wa.isVersionAtLeast && !wa.isVersionAtLeast('6.9'))) return null;
    return {
      get: keys =>
        new Promise((resolve, reject) =>
          cs.getItems(keys, (err, values) => (err ? reject(new Error(err)) : resolve(values ?? {}))),
        ),
      set: (key, value) =>
        new Promise((resolve, reject) =>
          cs.setItem(key, value, err => (err ? reject(new Error(err)) : resolve())),
        ),
    };
  }
}
