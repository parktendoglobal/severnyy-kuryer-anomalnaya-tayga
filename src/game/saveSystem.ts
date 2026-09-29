/**
 * СОХРАНЕНИЯ
 *
 * Прогресс игрока хранится в памяти браузера (localStorage), поэтому переживает закрытие
 * вкладки. Сохраняется: где стоит курьер и его показатели, груз, инструменты, ресурсы,
 * снаряжение, заказы, подключённые станции, поставленные постройки, открытые регионы
 * (а значит, и записи дневника), прогресс заданий, собранные ресурсы и отношения с NPC.
 *
 * У сохранения есть номер версии формата (SAVE_VERSION). Если в будущем структура
 * сохранения поменяется, увеличьте номер и допишите «переходник» в MIGRATIONS: он превратит
 * старое сохранение в новое, и игрок не потеряет прогресс.
 */
import {
  PlayerStats,
  CargoItem,
  ToolItem,
  ResourceItem,
  EquippedGear,
  PlacedStructure,
  DeliveryMission,
  NPCQuest,
  WorldNPC
} from '../types/game';

// Текущая версия формата сохранения. Увеличивайте при изменении SaveData.
export const SAVE_VERSION = 1;

// Под каким именем сохранение лежит в памяти браузера.
const SAVE_KEY = 'severnyy-kuryer:save';

// Как часто игра сохраняется сама, в миллисекундах (30 секунд).
export const AUTOSAVE_INTERVAL_MS = 30_000;

// Отношения курьера с конкретным NPC.
export interface NPCRelation {
  met: boolean; // курьер хотя бы раз заговорил с этим NPC
  questsCompleted: number; // сколько заданий этого NPC выполнено
  trades: number; // сколько раз курьер с ним торговал
}

// Всё, что попадает в сохранение (версия 1).
export interface SaveData {
  version: number;
  savedAt: string; // дата и время сохранения
  player: PlayerStats;
  cargo: CargoItem[];
  tools: ToolItem[];
  resources: ResourceItem[];
  equippedGear: EquippedGear;
  structures: PlacedStructure[];
  missionStatuses: Record<string, DeliveryMission['status']>;
  activeMissionId: string | null;
  missionElapsedSec: number; // сколько секунд идёт текущий заказ (для оценки S/A/B/C)
  arrivedMissionIds: string[]; // заказы, для которых терминал станции уже открывался сам
  connectedStationIds: string[];
  discoveredRegionIds: string[];
  quests: Record<string, Pick<NPCQuest, 'status' | 'progress'>>;
  harvestedResourceNodeIds: string[];
  npcRelations: Record<string, NPCRelation>;
}

// Результат попытки загрузить сохранение при запуске игры.
export type LoadResult =
  | { kind: 'none' } // сохранения нет — новая игра
  | { kind: 'ok'; data: SaveData; migratedFrom: number | null }
  | { kind: 'newer'; version: number } // сохранение от более новой версии игры
  | { kind: 'broken'; backupKey: string }; // сохранение повреждено, копия отложена

/**
 * «Переходники» между версиями. Ключ — версия, ИЗ которой переводим.
 * Пример на будущее: если в версии 2 появится поле reputation, добавьте
 *   1: old => ({ ...old, version: 2, reputation: 0 }),
 * и поднимите SAVE_VERSION до 2. Старые сохранения пройдут по цепочке 1 → 2 → … → текущая.
 */
const MIGRATIONS: Record<number, (old: any) => any> = {};

// Результат чтения запоминаем: сохранение читается один раз за запуск страницы.
let cachedLoadResult: LoadResult | null = null;

// Прочитать сохранение из памяти браузера, при необходимости обновив его формат.
export function loadGame(): LoadResult {
  if (!cachedLoadResult) cachedLoadResult = readSave();
  return cachedLoadResult;
}

function readSave(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    // Память браузера недоступна (например, приватный режим) — играем без сохранений.
    return { kind: 'none' };
  }
  if (!raw) return { kind: 'none' };

  try {
    let data = JSON.parse(raw);
    const originalVersion = Number(data?.version);
    if (!Number.isInteger(originalVersion) || originalVersion < 1) throw new Error('no version');

    // Сохранение сделано более новой версией игры: не трогаем его, чтобы не испортить.
    if (originalVersion > SAVE_VERSION) {
      return { kind: 'newer', version: originalVersion };
    }

    // Прогоняем старое сохранение через все переходники до текущей версии.
    while (data.version < SAVE_VERSION) {
      const migrate = MIGRATIONS[data.version];
      if (!migrate) throw new Error(`no migration from v${data.version}`);
      data = migrate(data);
    }

    return {
      kind: 'ok',
      data: data as SaveData,
      migratedFrom: originalVersion === SAVE_VERSION ? null : originalVersion
    };
  } catch {
    // Сохранение не читается. Не стираем его молча: откладываем копию под отдельным именем,
    // чтобы прогресс можно было восстановить вручную.
    const backupKey = `${SAVE_KEY}:backup:${Date.now()}`;
    try {
      localStorage.setItem(backupKey, raw);
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // Если даже копию сделать нельзя — просто оставляем как есть.
    }
    return { kind: 'broken', backupKey };
  }
}

// Записать сохранение. Возвращает false, если браузер не дал записать (память заполнена и т.п.).
export function saveGame(data: Omit<SaveData, 'version' | 'savedAt'>): boolean {
  try {
    const full: SaveData = { ...data, version: SAVE_VERSION, savedAt: new Date().toISOString() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(full));
    return true;
  } catch {
    return false;
  }
}

// Сохранение как есть, строкой JSON. Нужно площадкам (Telegram, VK), чтобы держать копию в облаке.
export function readRawSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

// Положить в память браузера сохранение, пришедшее из облака. Вызывается до первого loadGame().
export function writeRawSave(raw: string): void {
  try {
    localStorage.setItem(SAVE_KEY, raw);
    cachedLoadResult = null;
  } catch {
    // память браузера недоступна — играем с тем, что есть
  }
}

// Стереть сохранение (кнопка «Начать заново»).
export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // нечего стирать
  }
}

/**
 * При загрузке сбрасываем «мгновенные» состояния курьера: нажатые кнопки, скорость,
 * падение, работу сканера. Иначе после перезапуска он мог бы бежать или падать сам по себе.
 */
export function restorePlayer(saved: PlayerStats): PlayerStats {
  return {
    ...saved,
    vx: 0,
    vy: 0,
    balance: 0,
    stumbleAlert: 'NONE',
    stumbleTimer: 0,
    isStumbling: false,
    isBracingLeft: false,
    isBracingRight: false,
    isHoldingBreath: false,
    isSprinting: false,
    scannerActive: false,
    scannerPulseProgress: 1.0,
    scannerCooldown: 0
  };
}

// Перенести сохранённый прогресс заданий на свежезагруженных NPC региона.
export function applySavedQuests(npcs: WorldNPC[], quests: SaveData['quests']): WorldNPC[] {
  return npcs.map(npc => ({
    ...npc,
    quests: npc.quests.map(q => (quests[q.id] ? { ...q, ...quests[q.id] } : q))
  }));
}

// Собрать прогресс всех заданий загруженных NPC в компактный вид для сохранения.
export function collectQuestStates(npcs: WorldNPC[]): SaveData['quests'] {
  const result: SaveData['quests'] = {};
  for (const npc of npcs) {
    for (const q of npc.quests) {
      result[q.id] = { status: q.status, progress: q.progress };
    }
  }
  return result;
}
