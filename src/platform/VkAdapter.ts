import { CloudSaveAdapter } from './CloudSaveAdapter';
import { KeyValueStore, loadScript } from './storage';

const SDK_URL = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';

interface VkBridge {
  send(method: string, params?: Record<string, unknown>): Promise<any>;
}

declare global {
  interface Window {
    vkBridge?: VkBridge;
  }
}

/** VK Mini App: saves go to VK Storage (VKWebAppStorageGet / VKWebAppStorageSet). */
export class VkAdapter extends CloudSaveAdapter {
  readonly id = 'vk' as const;

  private get bridge(): VkBridge | undefined {
    return window.vkBridge;
  }

  async init(): Promise<void> {
    if (!this.bridge) await loadScript(SDK_URL);
    await this.bridge?.send('VKWebAppInit');
  }

  protected cloud(): KeyValueStore | null {
    const bridge = this.bridge;
    if (!bridge) return null;
    return {
      get: async keys => {
        const res = await bridge.send('VKWebAppStorageGet', { keys });
        const out: Record<string, string> = {};
        for (const { key, value } of (res?.keys ?? []) as { key: string; value: string }[]) {
          // VK returns '' for keys that were never set
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
