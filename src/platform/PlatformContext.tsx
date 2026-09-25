import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { PlatformAdapter, PlatformId } from './types';
import { detectPlatform } from './detectPlatform';
import { StandaloneAdapter } from './StandaloneAdapter';
import { TelegramAdapter } from './TelegramAdapter';
import { VkAdapter } from './VkAdapter';
import { MaxAdapter } from './MaxAdapter';

function createAdapter(id: PlatformId): PlatformAdapter {
  switch (id) {
    case 'telegram': return new TelegramAdapter();
    case 'vk': return new VkAdapter();
    case 'max': return new MaxAdapter();
    default: return new StandaloneAdapter();
  }
}

/**
 * Wraps the adapter so load() waits for the SDK to initialise, and an SDK that fails
 * to load (blocked script, opened outside the host app) degrades to local saves.
 */
function withInit(adapter: PlatformAdapter): PlatformAdapter {
  const ready = adapter.init().catch(err => {
    console.warn(`[platform:${adapter.id}] init failed, using local saves`, err);
  });
  return {
    id: adapter.id,
    init: () => ready,
    save: async state => { await ready; return adapter.save(state); },
    load: async () => { await ready; return adapter.load(); },
  };
}

const PlatformContext = createContext<PlatformAdapter | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  // Lazy init: one adapter per app lifetime, stable across renders
  const [platform] = useState(() => withInit(createAdapter(detectPlatform())));

  useEffect(() => {
    document.documentElement.dataset.platform = platform.id;
  }, [platform]);

  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformAdapter {
  const platform = useContext(PlatformContext);
  if (!platform) throw new Error('usePlatform must be used inside <PlatformProvider>');
  return platform;
}
