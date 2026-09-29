export type PlatformId = 'standalone' | 'telegram' | 'vk' | 'max';

/**
 * Площадка, на которой запущена игра (обычный браузер, Telegram, VK, MAX).
 *
 * Сохранения ведёт game/saveSystem.ts — в памяти браузера. Площадка только стартует свой SDK
 * и, если умеет, держит копию сохранения в облаке, чтобы прогресс переезжал между устройствами.
 * Сохранение передаётся сюда готовой строкой JSON, площадка в его содержимое не заглядывает.
 */
export interface PlatformAdapter {
  readonly id: PlatformId;
  /** Загрузить SDK площадки и сообщить ей, что игра готова. */
  init(): Promise<void>;
  /** Облачная копия сохранения, или null, если её нет или площадка облака не умеет. */
  pullSave(): Promise<string | null>;
  /** Записать копию сохранения в облако. */
  pushSave(raw: string): Promise<void>;
  /** Стереть облачную копию (кнопка «Начать заново»). */
  clearSave(): Promise<void>;
}
