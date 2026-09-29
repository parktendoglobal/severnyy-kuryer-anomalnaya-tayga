import { PlatformAdapter } from './types';
import { loadScript } from './storage';

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
 * Мини-приложение MAX. Облачной копии пока нет — сохранение живёт в памяти браузера
 * внутри MAX. Облако можно подключить здесь, когда понадобится перенос прогресса между устройствами.
 */
export class MaxAdapter implements PlatformAdapter {
  readonly id = 'max' as const;

  async init(): Promise<void> {
    if (!window.WebApp) await loadScript(SDK_URL);
    window.WebApp?.ready?.();
    window.WebApp?.expand?.();
  }

  async pullSave(): Promise<string | null> { return null; }
  async pushSave(): Promise<void> {}
  async clearSave(): Promise<void> {}
}
