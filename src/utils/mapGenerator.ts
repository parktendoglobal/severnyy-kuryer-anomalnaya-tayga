/**
 * ГЕНЕРАТОР РЕЛЬЕФА
 *
 * Строит карту мира 120×120 клеток: где твёрдый наст, где глубокий снег, где лёд реки,
 * скалы, болото, старая дорога и платформы станций, и какие деревья где растут.
 * Карта не рисуется вручную, а вычисляется по формулам, поэтому она каждый раз одинаковая
 * и почти ничего не весит.
 *
 * Здесь только земля и деревья. Всё, что «живёт» на карте (NPC, аномалии, ресурсы, тайники),
 * лежит в файлах регионов в src/content/regions/.
 */
import { WorldTile, TileType } from '../types/game';
import { MAP_COLS, MAP_ROWS, STATIONS } from './constants';

export interface GeneratedWorld {
  tiles: WorldTile[][]; // tiles[строка][столбец], т.е. tiles[y][x]
}

/**
 * «Случайное» число от 0 до 1 для клетки (x, y). На самом деле не случайное: для одной
 * и той же клетки всегда получается одно и то же число. Это классический трюк: синус
 * от странной комбинации координат, умноженный на большое число, и от результата
 * берётся только дробная часть. Благодаря этому мир одинаков при каждом запуске.
 */
function noise(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Плавный шум: те же «случайные» числа, но растянутые на области размером scale клеток
 * и плавно перетекающие друг в друга. Так получаются холмы и низины, а не «рябь».
 * Чем больше scale, тем крупнее пятна (24 — большие холмы, 8 — мелкие неровности).
 */
function smoothNoise(x: number, y: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;
  // Берём «случайные» числа в четырёх углах квадрата и смешиваем их пропорционально
  // тому, насколько клетка близка к каждому углу.
  const n00 = noise(x0, y0);
  const n10 = noise(x0 + 1, y0);
  const n01 = noise(x0, y0 + 1);
  const n11 = noise(x0 + 1, y0 + 1);
  const nx0 = n00 * (1 - fx) + n10 * fx;
  const nx1 = n01 * (1 - fx) + n11 * fx;
  return nx0 * (1 - fy) + nx1 * fy;
}

export function generateWorld(): GeneratedWorld {
  const tiles: WorldTile[][] = [];

  for (let r = 0; r < MAP_ROWS; r++) {
    const row: WorldTile[] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      // «Высота» местности от 0 до 1: 70% крупных холмов + 30% мелких неровностей.
      const elevationNoise = smoothNoise(c, r, 24) * 0.7 + smoothNoise(c, r, 8) * 0.3;
      // «Влажность» — отдельный шум (сдвинут на 200 клеток, чтобы не совпадал с высотой).
      const moistureNoise = smoothNoise(c + 200, r + 200, 18);
      // Расстояние до старой дороги: она идёт волной около строки 20, отклоняясь на ±6 клеток.
      const roadProximity = Math.abs(r - 20 - Math.sin(c * 0.1) * 6);

      let type: TileType = 'SNOW_HARD';
      let elevation = Math.floor(elevationNoise * 5); // высота 0–4, влияет на оттенок клетки
      let tree: WorldTile['tree'] = undefined;

      // Река змейкой идёт с севера на юг. Центр русла на строке r: столбец 45, плюс две
      // волны (±14 и ±10 клеток). Та же формула используется в regionMap.ts.
      const riverX = 45 + Math.sin(r * 0.08) * 14 + Math.cos(r * 0.03) * 10;
      const distToRiver = Math.abs(c - riverX);

      // Горный хребет — северо-восток (столбец > 55, строка < 35), только на самых высоких местах.
      const isMountainRidge = c > 55 && r < 35 && elevationNoise > 0.65;
      // Скалистый каньон — юг (строки 60–90, столбцы 20–50).
      const isRockChasm = r > 60 && r < 90 && c > 20 && c < 50 && elevationNoise > 0.55;

      // Правила проверяются по порядку: первое подошедшее определяет тип клетки.
      if (distToRiver < 2.5) {
        type = 'ICE_RIVER'; // русло шириной 5 клеток
        elevation = 0;
      } else if (isMountainRidge) {
        type = elevationNoise > 0.85 ? 'CLIFF' : 'ROCKS'; // самые высокие точки — отвесные скалы
        elevation = 4;
      } else if (isRockChasm) {
        type = elevationNoise > 0.78 ? 'CLIFF' : 'ROCKS';
        elevation = 3;
      } else if (roadProximity < 1.2 && c < 70) {
        type = 'OLD_ROAD'; // дорога шириной ≈2 клетки, обрывается у столбца 70
      } else if (moistureNoise > 0.68) {
        type = 'FROZEN_BOG'; // самые «влажные» места — мёрзлое болото
        elevation = 1;
      } else if (elevationNoise < 0.35) {
        type = 'SNOW_DEEP'; // в низинах наметает глубокий снег
        elevation = 1;
      }

      // Растительность: не на льду, не на дороге и не на отвесной скале.
      // treeRoll и berryRoll — два независимых «кубика» от 0 до 1 для каждой клетки.
      if (type !== 'ICE_RIVER' && type !== 'OLD_ROAD' && type !== 'CLIFF') {
        const treeRoll = noise(c * 3, r * 3);
        const berryRoll = noise(c * 5 + 13, r * 5 + 37);

        if (type === 'ROCKS') {
          // На камнях: 28% клеток — брусника, иначе 12% — сухое дерево.
          if (berryRoll > 0.72) {
            tree = 'RED_BERRY_BUSH';
          } else if (treeRoll > 0.88) {
            tree = 'DEAD_TREE';
          }
        } else if (type === 'FROZEN_BOG') {
          // На болоте: 30% — брусника, иначе 25% — кустарник.
          if (berryRoll > 0.7) {
            tree = 'RED_BERRY_BUSH';
          } else if (treeRoll > 0.75) {
            tree = 'BUSH';
          }
        } else {
          // Лес. Вдоль дороги (ближе 3 клеток) 40% клеток — брусничник.
          if (roadProximity < 3.0 && berryRoll > 0.6) {
            tree = 'RED_BERRY_BUSH';
          } else if (treeRoll > 0.62) {
            // 38% клеток — деревья. Из всех клеток: 9% кедры-великаны, 9% берёзы,
            // 9% лиственницы, 11% обычные сосны.
            if (treeRoll > 0.91) {
              tree = 'GIANT_PINE';
            } else if (treeRoll > 0.82) {
              tree = 'BIRCH';
            } else if (treeRoll > 0.73) {
              tree = 'LARCH';
            } else {
              tree = 'PINE';
            }
          } else if (berryRoll > 0.82) {
            tree = 'RED_BERRY_BUSH';
          }
        }
      }

      row.push({ type, elevation, tree });
    }
    tiles.push(row);
  }

  // Вокруг каждой станции расчищаем площадку 7×7 клеток: ровная платформа без деревьев.
  STATIONS.forEach(station => {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const r = station.y + dy;
        const c = station.x + dx;
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
          tiles[r][c].type = 'STATION_PLATFORM';
          tiles[r][c].elevation = 1;
          tiles[r][c].tree = undefined;
        }
      }
    }
  });

  return { tiles };
}
