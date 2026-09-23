import { WorldTile, TileType, AnomalyEntity, WorldResourceNode, WorldNPC } from '../types/game';
import { MAP_COLS, MAP_ROWS, STATIONS } from './constants';
import { WORLD_NPCS } from './npcData';

export interface GeneratedWorld {
  tiles: WorldTile[][];
  anomalies: AnomalyEntity[];
  lostCaches: { id: string; x: number; y: number; name: string; weightKg: number; category: string }[];
  landmarks: { x: number; y: number; name: string; icon: string }[];
  resourceNodes: WorldResourceNode[];
  npcs: WorldNPC[];
}

export function generateWorld(): GeneratedWorld {
  const tiles: WorldTile[][] = [];

  // Seeded simple pseudo-noise
  const noise = (x: number, y: number) => {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };

  const smoothNoise = (x: number, y: number, scale: number) => {
    const sx = x / scale;
    const sy = y / scale;
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const fx = sx - x0;
    const fy = sy - y0;
    const n00 = noise(x0, y0);
    const n10 = noise(x0 + 1, y0);
    const n01 = noise(x0, y0 + 1);
    const n11 = noise(x0 + 1, y0 + 1);
    const nx0 = n00 * (1 - fx) + n10 * fx;
    const nx1 = n01 * (1 - fx) + n11 * fx;
    return nx0 * (1 - fy) + nx1 * fy;
  };

  // Generate base terrain
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: WorldTile[] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      const elevationNoise = smoothNoise(c, r, 24) * 0.7 + smoothNoise(c, r, 8) * 0.3;
      const moistureNoise = smoothNoise(c + 200, r + 200, 18);
      const roadProximity = Math.abs((r - 20) - Math.sin(c * 0.1) * 6);

      let type: TileType = 'SNOW_HARD';
      let elevation = Math.floor(elevationNoise * 5);
      let tree: WorldTile['tree'] = undefined;

      // River winding from top-center to bottom-left
      const riverX = 45 + Math.sin(r * 0.08) * 14 + Math.cos(r * 0.03) * 10;
      const distToRiver = Math.abs(c - riverX);

      // Mountain ridge in north-east
      const isMountainRidge = (c > 55 && r < 35 && elevationNoise > 0.65);
      // Rocky chasm in south
      const isRockChasm = (r > 60 && r < 90 && c > 20 && c < 50 && elevationNoise > 0.55);

      if (distToRiver < 2.5) {
        type = 'ICE_RIVER';
        elevation = 0;
      } else if (isMountainRidge) {
        type = elevationNoise > 0.85 ? 'CLIFF' : 'ROCKS';
        elevation = 4;
      } else if (isRockChasm) {
        type = elevationNoise > 0.78 ? 'CLIFF' : 'ROCKS';
        elevation = 3;
      } else if (roadProximity < 1.2 && c < 70) {
        type = 'OLD_ROAD';
      } else if (moistureNoise > 0.68) {
        type = 'FROZEN_BOG';
        elevation = 1;
      } else if (elevationNoise < 0.35) {
        type = 'SNOW_DEEP';
        elevation = 1;
      }

      // Add trees and alpine flora if not on road or river or cliff
      if (type !== 'ICE_RIVER' && type !== 'OLD_ROAD' && type !== 'CLIFF') {
        const treeRoll = noise(c * 3, r * 3);
        const berryRoll = noise(c * 5 + 13, r * 5 + 37);

        if (type === 'ROCKS') {
          if (berryRoll > 0.72) {
            tree = 'RED_BERRY_BUSH'; // Vibrant red alpine berries hugging rock ledges
          } else if (treeRoll > 0.88) {
            tree = 'DEAD_TREE';
          }
        } else if (type === 'FROZEN_BOG') {
          if (berryRoll > 0.7) {
            tree = 'RED_BERRY_BUSH';
          } else if (treeRoll > 0.75) {
            tree = 'BUSH';
          }
        } else {
          // Forest and trail edges
          if (roadProximity < 3.0 && berryRoll > 0.6) {
            // Dense red lingonberry patches lining the mountain trails
            tree = 'RED_BERRY_BUSH';
          } else if (treeRoll > 0.62) {
            if (treeRoll > 0.91) {
              tree = 'GIANT_PINE'; // Ancient monumental taiga pines
            } else if (treeRoll > 0.82) {
              tree = 'BIRCH';
            } else if (treeRoll > 0.73) {
              tree = 'LARCH'; // Slender Siberian larches from reference screenshot 2
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

  // Clear area around stations
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

  // Anomalies placement
  const anomalies: AnomalyEntity[] = [
    // Frost Phantoms patrolling the Dead Marsh
    { id: 'anom_phantom_1', type: 'FROST_PHANTOM', x: 28, y: 48, radius: 45, suspicion: 0, state: 'PATROLLING', driftAngle: 0.4, pulseTimer: 0 },
    { id: 'anom_phantom_2', type: 'FROST_PHANTOM', x: 34, y: 56, radius: 50, suspicion: 0, state: 'PATROLLING', driftAngle: 1.8, pulseTimer: 20 },
    { id: 'anom_phantom_3', type: 'FROST_PHANTOM', x: 42, y: 62, radius: 45, suspicion: 0, state: 'PATROLLING', driftAngle: 3.2, pulseTimer: 40 },
    { id: 'anom_phantom_4', type: 'FROST_PHANTOM', x: 80, y: 50, radius: 55, suspicion: 0, state: 'PATROLLING', driftAngle: 2.1, pulseTimer: 10 },
    { id: 'anom_phantom_5', type: 'FROST_PHANTOM', x: 88, y: 60, radius: 60, suspicion: 0, state: 'PATROLLING', driftAngle: 0.9, pulseTimer: 35 },
    { id: 'anom_phantom_6', type: 'FROST_PHANTOM', x: 74, y: 35, radius: 45, suspicion: 0, state: 'PATROLLING', driftAngle: 4.5, pulseTimer: 15 },
    
    // Gravitational vortexes
    { id: 'anom_vortex_1', type: 'GRAVITY_VORTEX', x: 50, y: 38, radius: 35, suspicion: 0, state: 'PATROLLING', driftAngle: 0, pulseTimer: 0 },
    { id: 'anom_vortex_2', type: 'GRAVITY_VORTEX', x: 90, y: 42, radius: 40, suspicion: 0, state: 'PATROLLING', driftAngle: 0, pulseTimer: 30 },
    { id: 'anom_vortex_3', type: 'GRAVITY_VORTEX', x: 22, y: 72, radius: 35, suspicion: 0, state: 'PATROLLING', driftAngle: 0, pulseTimer: 15 },

    // Static discharges
    { id: 'anom_static_1', type: 'STATIC_DISCHARGE', x: 60, y: 75, radius: 30, suspicion: 0, state: 'PATROLLING', driftAngle: 0, pulseTimer: 5 },
    { id: 'anom_static_2', type: 'STATIC_DISCHARGE', x: 85, y: 22, radius: 35, suspicion: 0, state: 'PATROLLING', driftAngle: 0, pulseTimer: 25 },
  ];

  // Lost cargo caches scattered in the taiga for couriers to discover
  const lostCaches = [
    { id: 'lost_1', x: 26, y: 32, name: 'Брошенный контейнер с консервами', weightKg: 5.5, category: 'TAIGA_RATIONS' },
    { id: 'lost_2', x: 48, y: 22, name: 'Геологический керн с платиной', weightKg: 8.0, category: 'GEOLOGY_CORE' },
    { id: 'lost_3', x: 58, y: 52, name: 'Батарейный блок "Арктика"', weightKg: 6.2, category: 'ISOTOPE_BATTERY' },
    { id: 'lost_4', x: 70, y: 70, name: 'Аварийный комплект рации', weightKg: 4.0, category: 'RADIO_TUBES' },
    { id: 'lost_5', x: 88, y: 32, name: 'Фляга со спиртом и бинты', weightKg: 3.2, category: 'MEDICAL' },
    { id: 'lost_6', x: 38, y: 92, name: 'Сумка гидропонных семян', weightKg: 4.8, category: 'SEED_BANK' }
  ];

  // Atmospheric landmarks
  const landmarks = [
    { x: 18, y: 20, name: 'Вышка ретранслятора РЛС-1', icon: '📡' },
    { x: 45, y: 15, name: 'Разрушенный деревянный мост', icon: '🌉' },
    { x: 52, y: 46, name: 'Остов советского тягача КрАЗ', icon: '🚜' },
    { x: 82, y: 78, name: 'Мемориальный крест первопроходцам', icon: '✝' },
    { x: 30, y: 70, name: 'Заброшенная избушка лесничего', icon: '🏚' },
    { x: 105, y: 20, name: 'Кедр-великан (возраст 400 лет)', icon: '🌲' }
  ];

  // Natural resource nodes scattered across the taiga for gathering & crafting
  const resourceNodes: WorldResourceNode[] = [
    // Wood nodes near pine forests & fallen trees
    { id: 'res_wood_1', type: 'WOOD_PINE', x: 22, y: 26, amount: 3, harvested: false, name: 'Кедровый валежник' },
    { id: 'res_wood_2', type: 'WOOD_PINE', x: 35, y: 65, amount: 4, harvested: false, name: 'Смоляные дрова' },
    { id: 'res_wood_3', type: 'WOOD_PINE', x: 62, y: 42, amount: 3, harvested: false, name: 'Сухой кедровый бурелом' },
    { id: 'res_wood_4', type: 'WOOD_PINE', x: 92, y: 24, amount: 4, harvested: false, name: 'Кедровая древесина' },
    { id: 'res_wood_5', type: 'WOOD_PINE', x: 40, y: 85, amount: 3, harvested: false, name: 'Поваленный ствол кедра' },

    // Chaga and berries on birch stands & river banks
    { id: 'res_chaga_1', type: 'CHAGA_HERB', x: 28, y: 38, amount: 2, harvested: false, name: 'Берёзовая чага и брусника' },
    { id: 'res_chaga_2', type: 'CHAGA_HERB', x: 42, y: 28, amount: 3, harvested: false, name: 'Свежая чага на березе' },
    { id: 'res_chaga_3', type: 'CHAGA_HERB', x: 78, y: 48, amount: 2, harvested: false, name: 'Таёжный ягодник и чага' },
    { id: 'res_chaga_4', type: 'CHAGA_HERB', x: 34, y: 74, amount: 3, harvested: false, name: 'Грибной нарост чаги' },

    // Scrap metal near old roads, towers & crashed vehicles
    { id: 'res_scrap_1', type: 'SCRAP_METAL', x: 20, y: 22, amount: 3, harvested: false, name: 'Обломки вышки РЛС' },
    { id: 'res_scrap_2', type: 'SCRAP_METAL', x: 50, y: 47, amount: 4, harvested: false, name: 'Запчасти тягача КрАЗ' },
    { id: 'res_scrap_3', type: 'SCRAP_METAL', x: 44, y: 16, amount: 3, harvested: false, name: 'Металлические балки моста' },
    { id: 'res_scrap_4', type: 'SCRAP_METAL', x: 68, y: 55, amount: 3, harvested: false, name: 'Брошенная рама вагончика' },

    // Chiral resin deposits in marshes, near anomalies and ice cracks
    { id: 'res_resin_1', type: 'CHIRAL_RESIN', x: 38, y: 58, amount: 2, harvested: false, name: 'Кристалл крио-смолы' },
    { id: 'res_resin_2', type: 'CHIRAL_RESIN', x: 72, y: 34, amount: 2, harvested: false, name: 'Аномальная друза смолы' },
    { id: 'res_resin_3', type: 'CHIRAL_RESIN', x: 84, y: 62, amount: 3, harvested: false, name: 'Хиральный нарост на льду' },
    { id: 'res_resin_4', type: 'CHIRAL_RESIN', x: 96, y: 72, amount: 2, harvested: false, name: 'Мерзлотная крио-смола' },

    // Copper wires on telegraph poles along old roads
    { id: 'res_wire_1', type: 'COPPER_WIRE', x: 19, y: 24, amount: 2, harvested: false, name: 'Медный провод со столба' },
    { id: 'res_wire_2', type: 'COPPER_WIRE', x: 54, y: 45, amount: 3, harvested: false, name: 'Моток электропроводки' },
    { id: 'res_wire_3', type: 'COPPER_WIRE', x: 64, y: 40, amount: 2, harvested: false, name: 'Обрывки телефонного кабеля' },

    // Taiga fur from trapper caches & abandoned blinds
    { id: 'res_fur_1', type: 'TAIGA_FUR', x: 32, y: 72, amount: 2, harvested: false, name: 'Охотничий тайник с пушниной' },
    { id: 'res_fur_2', type: 'TAIGA_FUR', x: 102, y: 22, amount: 2, harvested: false, name: 'Соболиные шкурки на сушиле' },

    // Paraffin wax canisters from survey camps
    { id: 'res_wax_1', type: 'PARAFFIN_WAX', x: 24, y: 30, amount: 3, harvested: false, name: 'Канистра технического парафина' },
    { id: 'res_wax_2', type: 'PARAFFIN_WAX', x: 74, y: 80, amount: 2, harvested: false, name: 'Брикеты смолы и парафина' }
  ];

  return { tiles, anomalies, lostCaches, landmarks, resourceNodes, npcs: WORLD_NPCS };
}
