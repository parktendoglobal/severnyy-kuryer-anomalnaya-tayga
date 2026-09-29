import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { PlatformAdapter, PlatformId } from './types';
import { detectPlatform } from './detectPlatform';
import { StandaloneAdapter } from './StandaloneAdapter';
import { TelegramAdapter } from './TelegramAdapter';
import { VkAdapter } from './VkAdapter';
import { MaxAdapter } from './MaxAdapter';
import { readRawSave, writeRawSave } from '../game/saveSystem';

// Сколько ждать SDK и облако перед стартом игры. Дольше — играем с тем, что есть в браузере.
const STARTUP_TIMEOUT_MS = 4000;

function createAdapter(id: PlatformId): PlatformAdapter {
  switch (id) {
    case 'telegram': return new TelegramAdapter();
    case 'vk': return new VkAdapter();
    case 'max': return new MaxAdapter();
    default: return new StandaloneAdapter();
  }
}

/**
 * До запуска игры: стартуем SDK площадки и, если облачная копия сохранения новее той, что в
 * браузере, кладём её в браузер. Игра (saveSystem) читает сохранение из браузера один раз при
 * запуске, поэтому это нужно сделать раньше, чем App появится на экране.
 * isStarted() — игра уже запущена (вышло время ожидания): тогда облачную копию не трогаем,
 * чтобы не подменить сохранение под уже идущей игрой.
 */
async function prepare(platform: PlatformAdapter, isStarted: () => boolean): Promise<void> {
  await platform.init();
  const cloud = await platform.pullSave();
  if (!isStarted() && cloud && savedAt(cloud) > savedAt(readRawSave())) writeRawSave(cloud);
}

function savedAt(raw: string | null): number {
  if (!raw) return 0;
  try {
    const t = Date.parse(JSON.parse(raw)?.savedAt);
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

const PlatformContext = createContext<PlatformAdapter | null>(null);

export function PlatformProvider({ children }: { children: ReactNode }) {
  // Одна площадка на всё время работы страницы
  const [platform] = useState(() => createAdapter(detectPlatform()));
  const [ready, setReady] = useState(platform.id === 'standalone');

  // Запуск SDK — ровно один раз (StrictMode в разработке вызывает эффекты дважды)
  const startedRef = useRef(ready);
  const preparingRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    document.documentElement.dataset.platform = platform.id;
    if (startedRef.current) return;
    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      setReady(true);
    };
    // Не удалось загрузить SDK или облако (скрипт заблокирован, игра открыта вне площадки) —
    // всё равно запускаем игру с сохранением из браузера.
    preparingRef.current ??= prepare(platform, () => startedRef.current).catch(err =>
      console.warn(`[platform:${platform.id}] запуск без облака`, err),
    );
    preparingRef.current.finally(start);
    const timer = setTimeout(start, STARTUP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [platform]);

  if (!ready) return null;
  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformAdapter {
  const platform = useContext(PlatformContext);
  if (!platform) throw new Error('usePlatform must be used inside <PlatformProvider>');
  return platform;
}
