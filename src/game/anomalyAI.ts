/**
 * ПОВЕДЕНИЕ АНОМАЛИЙ
 *
 * Хладные Тени медленно дрейфуют по тайге и «прислушиваются» к курьеру. У каждой есть
 * шкала подозрения от 0 до 100: чем громче курьер (бег, шаги), тем быстрее она растёт.
 * По ней Тень переходит из патруля (PATROLLING) в настороженность (ALERT, больше 25)
 * и охоту (HUNTING, больше 70). Магниевый фальшфейер рядом полностью её успокаивает.
 * Гравитационные воронки и статические разряды пока стоят на месте и ничего не делают.
 *
 * Здесь два расчёта:
 *  • updateAnomaly — полный, каждый кадр, для аномалий рядом с курьером;
 *  • catchUpDormantAnomaly — быстрый приблизительный, для аномалий, которые «спали»
 *    вдали от курьера (см. activityZone.ts) и теперь снова оказались рядом.
 */
import { AnomalyEntity, PlayerStats, PlacedStructure } from '../types/game';
import { MAP_COLS, MAP_ROWS } from '../utils/constants';

// Радиус, в котором фальшфейер отпугивает Тень, в клетках.
const FLARE_REPEL_RADIUS = 5.5;
// Радиус, в котором Тень слышит курьера, в клетках.
const HEARING_RADIUS = 5.0;
// Радиус, в котором сканер начинает щёлкать рядом с Тенью, в клетках.
const TICK_SOUND_RADIUS = 6.0;

// Скорость дрейфа, клеток в секунду: спокойный патруль, сильное подозрение (больше 50), бегство от огня.
const PATROL_SPEED = 0.25;
const ALERT_SPEED = 0.8;
const FLEE_SPEED = 1.4;

// Во сколько раз быстрее растёт/падает подозрение (единиц в секунду).
const SUSPICION_SPRINT = 45; // бег рядом: от 0 до охоты (70) за ≈ 1.5 с
const SUSPICION_WALK = 20; // шаги рядом: до охоты за 3.5 с
const SUSPICION_BREATH_DECAY = 10; // затаил дыхание рядом: подозрение медленно гаснет
const SUSPICION_CALM_DECAY = 15; // курьер далеко: подозрение гаснет

/**
 * Дольше двух минут «сна» не досчитываем: за это время Тень всё равно забыла курьера
 * и ушла куда-то случайно, а более долгий пересчёт не изменит картину, только потратит время.
 */
const MAX_CATCHUP_SEC = 120;

function stateFromSuspicion(suspicion: number): AnomalyEntity['state'] {
  return suspicion > 70 ? 'HUNTING' : suspicion > 25 ? 'ALERT' : 'PATROLLING';
}

// Не даём аномалии уплыть за край карты.
function clampToMap(value: number, size: number): number {
  return Math.max(2, Math.min(size - 3, value));
}

/**
 * Полный расчёт одной аномалии на один кадр.
 * tickVolume — если не null, сканер должен щёлкнуть с такой громкостью (0–1).
 */
export function updateAnomaly(
  anom: AnomalyEntity,
  player: PlayerStats,
  structures: PlacedStructure[],
  dt: number,
  gameTime: number
): { anomaly: AnomalyEntity; tickVolume: number | null } {
  if (anom.type !== 'FROST_PHANTOM') {
    // Воронки и разряды неподвижны — считать нечего.
    return { anomaly: anom, tickVolume: null };
  }

  const dist = Math.hypot(anom.x - player.x, anom.y - player.y);

  // Щелчки сканера рядом с Тенью: в среднем в 15% кадров (≈ 9 раз в секунду),
  // громче, чем ближе Тень.
  let tickVolume: number | null = null;
  if (dist < TICK_SOUND_RADIUS && Math.random() < 0.15) {
    tickVolume = Math.min(1, (7 - dist) / 4);
  }

  const nearFlare = structures.some(
    s => s.type === 'FLARE' && Math.hypot(s.x - anom.x, s.y - anom.y) < FLARE_REPEL_RADIUS
  );

  let suspicion = anom.suspicion;
  if (nearFlare) {
    suspicion = 0;
  } else if (dist < HEARING_RADIUS) {
    if (player.isHoldingBreath) {
      suspicion = Math.max(0, suspicion - dt * SUSPICION_BREATH_DECAY);
    } else if (player.isSprinting) {
      suspicion = Math.min(100, suspicion + dt * SUSPICION_SPRINT);
    } else if (Math.hypot(player.vx, player.vy) > 0.1) {
      suspicion = Math.min(100, suspicion + dt * SUSPICION_WALK);
    }
  } else {
    suspicion = Math.max(0, suspicion - dt * SUSPICION_CALM_DECAY);
  }

  // Блуждание: каждый кадр направление чуть-чуть поворачивается случайным образом
  // (до ±0.05 радиана ≈ ±3°), поэтому Тень плавно петляет, а не ходит по прямой.
  const newDriftAngle = anom.driftAngle + (Math.random() - 0.5) * 0.1;
  const driftSpeed = nearFlare ? FLEE_SPEED : suspicion > 50 ? ALERT_SPEED : PATROL_SPEED;

  return {
    tickVolume,
    anomaly: {
      ...anom,
      x: clampToMap(anom.x + Math.cos(newDriftAngle) * driftSpeed * dt, MAP_COLS),
      y: clampToMap(anom.y + Math.sin(newDriftAngle) * driftSpeed * dt, MAP_ROWS),
      driftAngle: newDriftAngle,
      suspicion,
      state: nearFlare ? 'PATROLLING' : stateFromSuspicion(suspicion),
      // Счётчик кадров для анимации мерцания (используется в TaigaRenderer как фаза синуса).
      pulseTimer: anom.pulseTimer + 1,
      lastSimulatedAt: gameTime
    }
  };
}

/**
 * Быстро «догнать» аномалию, которая спала вдали от курьера.
 * Пока курьер был далеко, он её не тревожил, поэтому подозрение просто гасло, а сама она
 * спокойно патрулировала. Вместо тысяч маленьких кадровых шагов делаем шаги по 1 секунде:
 * результат по смыслу тот же (случайное блуждание), а считается мгновенно.
 */
export function catchUpDormantAnomaly(anom: AnomalyEntity, gameTime: number): AnomalyEntity {
  const lastTime = anom.lastSimulatedAt ?? gameTime;
  const elapsed = Math.min(MAX_CATCHUP_SEC, gameTime - lastTime);
  if (elapsed <= 0 || anom.type !== 'FROST_PHANTOM') {
    return { ...anom, lastSimulatedAt: gameTime };
  }

  let { x, y, driftAngle } = anom;
  const steps = Math.ceil(elapsed);
  const stepSec = elapsed / steps;
  for (let i = 0; i < steps; i++) {
    // За секунду (≈ 60 кадров по ±0.05 рад) направление в среднем уходит на ±0.22 рад —
    // случайный поворот в пределах ±0.39 рад даёт тот же разброс.
    driftAngle += (Math.random() - 0.5) * 0.775 * stepSec;
    x = clampToMap(x + Math.cos(driftAngle) * PATROL_SPEED * stepSec, MAP_COLS);
    y = clampToMap(y + Math.sin(driftAngle) * PATROL_SPEED * stepSec, MAP_ROWS);
  }

  const suspicion = Math.max(0, anom.suspicion - elapsed * SUSPICION_CALM_DECAY);
  return {
    ...anom,
    x,
    y,
    driftAngle,
    suspicion,
    state: stateFromSuspicion(suspicion),
    pulseTimer: anom.pulseTimer + Math.round(elapsed * 60),
    lastSimulatedAt: gameTime
  };
}

/**
 * Если Тень пропустила больше четверти секунды (значит, она «спала» вне зоны активности),
 * перед обычным кадром догоняем её поведение за всё пропущенное время.
 * Более короткие пропуски незаметны, их не догоняем.
 */
const DORMANT_GAP_SEC = 0.25;

export function wakeUpIfDormant(anom: AnomalyEntity, gameTime: number): AnomalyEntity {
  if (anom.type !== 'FROST_PHANTOM' || anom.lastSimulatedAt === undefined) return anom;
  if (gameTime - anom.lastSimulatedAt < DORMANT_GAP_SEC) return anom;
  return catchUpDormantAnomaly(anom, gameTime);
}
