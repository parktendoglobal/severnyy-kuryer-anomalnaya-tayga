/**
 * ЗАГРУЗЧИК РЕГИОНОВ
 *
 * Отвечает за то, чтобы контент региона (жители, задания, записи дневника, аномалии,
 * ресурсы) скачивался только тогда, когда он действительно нужен, а не весь сразу при
 * запуске игры. Когда мир вырастет до сотен поселений, это сохранит быстрый старт.
 *
 * Как это работает простыми словами: игра регулярно спрашивает «какие регионы рядом
 * с курьером?» (regionsNearPoint) и просит загрузить их (loadRegion). Каждый регион
 * загружается один раз и дальше берётся из памяти.
 */
import { WorldNPC, AnomalyEntity, WorldResourceNode, LostCache, Landmark } from '../types/game';
import { JournalEntry } from '../types/journal';
import { REGION_FILES, getRegionAt } from './regionMap';

/**
 * Что может лежать в файле региона. Все списки необязательные: если в регионе нет,
 * например, NPC, список NPCS можно просто не писать.
 */
export interface RegionContentModule {
  NPCS?: WorldNPC[];
  JOURNAL?: JournalEntry[];
  ANOMALIES?: AnomalyEntity[];
  RESOURCE_NODES?: WorldResourceNode[];
  LOST_CACHES?: LostCache[];
  LANDMARKS?: Landmark[];
}

// Загруженный регион в том виде, в каком его получает игра.
export interface RegionContent {
  regionId: string;
  npcs: WorldNPC[];
  journal: JournalEntry[];
  anomalies: AnomalyEntity[];
  resourceNodes: WorldResourceNode[];
  lostCaches: LostCache[];
  landmarks: Landmark[];
}

/**
 * На каком расстоянии (в клетках) от курьера начинать заранее подгружать соседний регион.
 * 20 клеток — чуть больше половины экрана при обычном масштабе: соседний регион успевает
 * загрузиться до того, как курьер в него войдёт. При этом от точки старта (18, 22)
 * до ближайшей границы с другим регионом больше 20 клеток, поэтому при запуске
 * загружается только стартовый регион.
 */
export const REGION_PRELOAD_DISTANCE = 20;

// Уже начатые загрузки: регион скачивается один раз, повторные запросы получают тот же результат.
const loading = new Map<string, Promise<RegionContent>>();

/**
 * Загрузить контент региона. Возвращает копию данных, чтобы игровые изменения
 * (выполненные задания, собранные ресурсы) не портили исходные данные из файла.
 */
export function loadRegion(regionId: string): Promise<RegionContent> {
  const existing = loading.get(regionId);
  if (existing) return existing;

  const loadFile = REGION_FILES[regionId];
  const promise = (loadFile ? loadFile() : Promise.resolve({} as RegionContentModule)).then(mod => ({
    regionId,
    npcs: structuredClone(mod.NPCS ?? []),
    journal: mod.JOURNAL ?? [],
    anomalies: structuredClone(mod.ANOMALIES ?? []),
    resourceNodes: structuredClone(mod.RESOURCE_NODES ?? []),
    lostCaches: mod.LOST_CACHES ?? [],
    landmarks: mod.LANDMARKS ?? []
  }));

  // Если загрузка сорвалась (например, пропал интернет), забываем о ней,
  // чтобы при следующей проверке попробовать снова.
  promise.catch(() => loading.delete(regionId));
  loading.set(regionId, promise);
  return promise;
}

/**
 * Какие регионы находятся рядом с точкой (x, y): тот, где стоит курьер, плюс все,
 * до границы которых меньше REGION_PRELOAD_DISTANCE клеток.
 * Проверяем 16 точек на окружности вокруг курьера и 8 точек на половине радиуса —
 * этого хватает, чтобы не пропустить соседний регион, и это почти ничего не стоит.
 */
export function regionsNearPoint(x: number, y: number, distance = REGION_PRELOAD_DISTANCE): string[] {
  const ids = new Set<string>([getRegionAt(x, y).id]);
  const rings: [radius: number, samples: number][] = [
    [distance, 16],
    [distance / 2, 8]
  ];
  for (const [radius, samples] of rings) {
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      ids.add(getRegionAt(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius).id);
    }
  }
  return [...ids];
}
