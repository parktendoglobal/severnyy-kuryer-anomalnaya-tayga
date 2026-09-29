import { PlatformAdapter } from './types';
import { CloudSaves, KeyValueStore, loadScript } from './storage';

const SDK_URL = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';

interface VkBridge {
  send(method: string, params?: Record<string, unknown>): Promise<any>;
}

declare global {
  interface Window {
    vkBridge?: VkBridge;
  }
}

/** Мини-приложение VK: копия сохранения лежит в VK Storage (VKWebAppStorageGet / Set). */
export class VkAdapter implements PlatformAdapter {
  readonly id = 'vk' as const;
  private readonly cloud = new CloudSaves(() => this.store());

  private get bridge(): VkBridge | undefined {
    return window.vkBridge;
  }

  async init(): Promise<void> {
    if (!this.bridge) await loadScript(SDK_URL);
    await this.bridge?.send('VKWebAppInit');
  }

  pullSave() { return this.cloud.pull(); }
  pushSave(raw: string) { return this.cloud.push(raw); }
  clearSave() { return this.cloud.clear(); }

  private store(): KeyValueStore | null {
    const bridge = this.bridge;
    if (!bridge) return null;
    return {
      get: async keys => {
        const res = await bridge.send('VKWebAppStorageGet', { keys });
        const out: Record<string, string> = {};
        for (const { key, value } of (res?.keys ?? []) as { key: string; value: string }[]) {
          // Для ключей, которые ни разу не записывали, VK возвращает ''
          if (value !== '') out[key] = value;
        }
        return out;
      },
      set: async (key, value) => {
        await bridge.send('VKWebAppStorageSet', { key, value });
      },
    };
  }
}
