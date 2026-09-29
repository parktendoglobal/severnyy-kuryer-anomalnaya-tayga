import { PlatformAdapter } from './types';
import { CloudSaves, KeyValueStore, loadScript } from './storage';

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

/** Мини-приложение Telegram: копия сохранения лежит в Telegram CloudStorage. */
export class TelegramAdapter implements PlatformAdapter {
  readonly id = 'telegram' as const;
  private readonly cloud = new CloudSaves(() => this.store());

  private get webApp(): TelegramWebApp | undefined {
    return window.Telegram?.WebApp;
  }

  async init(): Promise<void> {
    if (!this.webApp) await loadScript(SDK_URL);
    const wa = this.webApp;
    if (!wa) return;
    wa.ready();
    wa.expand();
    // Иначе свайп по джойстику вниз сворачивает мини-приложение
    wa.disableVerticalSwipes?.();
  }

  pullSave() { return this.cloud.pull(); }
  pushSave(raw: string) { return this.cloud.push(raw); }
  clearSave() { return this.cloud.clear(); }

  private store(): KeyValueStore | null {
    const wa = this.webApp;
    const cs = wa?.CloudStorage;
    // CloudStorage появился в Bot API 6.9
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
