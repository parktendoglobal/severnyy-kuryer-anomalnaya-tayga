/**
 * ФИЗИКА И ВЫЖИВАНИЕ КУРЬЕРА
 *
 * Здесь собраны все игровые формулы, которые пересчитываются для курьера каждый кадр
 * (около 60 раз в секунду): как быстро он идёт по разному снегу, как груз раскачивает
 * его из стороны в сторону, когда он падает, как быстро он замерзает, устаёт, тратит
 * батарею и снашивает обувь.
 *
 * Все скорости расхода указаны «в единицах в секунду»: например, «тепло −0.35/с» значит,
 * что за 10 секунд на ясном морозе шкала тепла опустится на 3.5 из 100.
 * Координаты и скорость — в клетках карты (1 клетка = 32 пикселя при масштабе 1).
 */
import { PlayerStats, WorldTile, PlacedStructure, WeatherState, EquippedGear } from '../types/game';
import { MAP_COLS, MAP_ROWS } from '../utils/constants';

// Базовая скорость ходьбы: 2.8 клетки в секунду при полностью отклонённом джойстике.
const BASE_WALK_SPEED = 2.8;

// Радиусы действия построек, в клетках.
export const SHELTER_WARMTH_RADIUS = 3.5;
export const CAMPFIRE_WARMTH_RADIUS = 2.5;
const LADDER_USE_RADIUS = 1.4;

// Всё, что нужно знать о мире вокруг курьера, чтобы посчитать один кадр.
export interface PlayerStepContext {
  input: { x: number; y: number }; // отклонение джойстика/клавиш, от −1 до 1 по каждой оси
  dt: number; // сколько секунд прошло с прошлого кадра
  tiles: WorldTile[][];
  structures: PlacedStructure[];
  weather: WeatherState;
  gear: EquippedGear;
  totalWeightKg: number; // вес груза + инструментов + ресурсов
}

// Счётчики, которые живут между кадрами, но не относятся к самому курьеру.
export interface PlayerStepTimers {
  stepCycle: number; // фаза шага: когда дорастает до 1, звучит шаг и остаётся след
  heartbeatTimer: number; // отсчёт до следующего удара сердца при задержке дыхания
}

// Что произошло за кадр — App.tsx реагирует на это звуками и эффектами.
export interface PlayerStepEvents {
  footstep: { deepSnow: boolean } | null; // курьер сделал шаг (оставить след, звук шага)
  stumbleWarning: boolean; // курьер вот-вот упадёт (тревожный звук)
  fell: boolean; // курьер упал — груз получает урон
  heartbeat: boolean; // стук сердца при задержке дыхания
}

/**
 * Посчитать один кадр жизни курьера. Возвращает НОВОЕ состояние курьера (старое не меняется)
 * и список событий этого кадра.
 */
export function stepPlayer(
  prev: PlayerStats,
  ctx: PlayerStepContext,
  timers: PlayerStepTimers
): { player: PlayerStats; events: PlayerStepEvents } {
  const { input, dt, tiles, structures, weather, gear, totalWeightKg } = ctx;
  const events: PlayerStepEvents = { footstep: null, stumbleWarning: false, fell: false, heartbeat: false };

  // Джойстик отклонён хотя бы на 5% — считаем, что курьер идёт (меньше — дрожь пальца).
  const isMoving = Math.abs(input.x) > 0.05 || Math.abs(input.y) > 0.05;

  // Клетка, на которой курьер стоит сейчас.
  const curCol = Math.max(0, Math.min(MAP_COLS - 1, Math.floor(prev.x)));
  const curRow = Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(prev.y)));
  const curTile = tiles[curRow][curCol];

  const hasLadder = structures.some(
    s => s.type === 'LADDER' && Math.hypot(s.x - prev.x, s.y - prev.y) < LADDER_USE_RADIUS
  );

  // ----------------------------------------------------
  // СКОРОСТЬ: множители перемножаются. Например, глубокий снег (×0.55) в буран (×0.6)
  // даёт 0.33 — курьер идёт втрое медленнее обычного.
  // ----------------------------------------------------
  let speedMultiplier = 1.0;
  let isDeepSnow = false;

  if (curTile.type === 'SNOW_DEEP') {
    // Глубокий снег: ×0.55, а в снегоступах почти не мешает (×0.88).
    speedMultiplier = gear.snowshoes ? 0.88 : 0.55;
    isDeepSnow = true;
  } else if (curTile.type === 'OLD_ROAD' || curTile.type === 'STATION_PLATFORM') {
    speedMultiplier = 1.25; // по дороге и платформе идти на четверть быстрее
  } else if (curTile.type === 'ICE_RIVER') {
    speedMultiplier = 1.1; // лёд скользкий: чуть быстрее, но труднее остановиться (см. трение ниже)
  } else if (curTile.type === 'ROCKS' || curTile.type === 'CLIFF') {
    if (!hasLadder) {
      speedMultiplier = 0.35; // по скалам без лестницы — почти ползком
    }
  }

  // Погода: встречный ветер бурана ×0.6, рыхлый снегопад ×0.75.
  if (weather.type === 'BLIZZARD') {
    speedMultiplier *= 0.6;
  } else if (weather.type === 'HEAVY_SNOWFALL') {
    speedMultiplier *= 0.75;
  }

  // Бег ×1.5 (только пока есть хоть немного выносливости, больше 5), подкрадывание ×0.65.
  if (prev.isSprinting && prev.stamina > 5) {
    speedMultiplier *= 1.5;
  } else if (prev.isHoldingBreath) {
    speedMultiplier *= 0.65;
  }

  // Вес: каждые 55 кг отнимают 40% скорости, но не больше 40% в сумме (минимум ×0.6).
  // Например, 22 кг → ×0.84, 45 кг → ×0.67.
  const weightFactor = Math.max(0.6, 1 - (totalWeightKg / 55) * 0.4);
  speedMultiplier *= weightFactor;

  // ----------------------------------------------------
  // ДВИЖЕНИЕ: скорость не меняется мгновенно, а «догоняет» нужную с долей трения.
  // На обычном снегу за кадр набирается 28% разницы (быстрый отклик), на льду — 8%
  // (курьер долго разгоняется и долго тормозит, как на катке).
  // ----------------------------------------------------
  const targetVx = input.x * BASE_WALK_SPEED * speedMultiplier;
  const targetVy = input.y * BASE_WALK_SPEED * speedMultiplier;
  const friction = curTile.type === 'ICE_RIVER' ? 0.08 : 0.28;
  const newVx = prev.vx + (targetVx - prev.vx) * friction;
  const newVy = prev.vy + (targetVy - prev.vy) * friction;

  // Не даём выйти за край карты: оставляем 2–3 клетки запаса от границы.
  const nextX = Math.max(2, Math.min(MAP_COLS - 3, prev.x + newVx * dt));
  const nextY = Math.max(2, Math.min(MAP_ROWS - 3, prev.y + newVy * dt));

  const facingAngle = isMoving ? Math.atan2(newVy, newVx) : prev.facingAngle;

  // Шаги: примерно 5 шагов в секунду при обычной скорости, реже — когда курьер замедлен.
  if (isMoving) {
    timers.stepCycle += dt * 5 * speedMultiplier;
    if (timers.stepCycle > 1) {
      timers.stepCycle = 0;
      events.footstep = { deepSnow: isDeepSnow };
    }
  }

  // ----------------------------------------------------
  // БАЛАНС ГРУЗА (как в Death Stranding). Шкала от −100 (сильный крен влево)
  // до +100 (вправо). Пока курьер идёт, неровности и ветер раскачивают груз,
  // а игрок выравнивает его, хватаясь за левую [Л] или правую [П] лямку рюкзака.
  // ----------------------------------------------------
  let newBalance = prev.balance;
  let stumbleAlert: PlayerStats['stumbleAlert'] = 'NONE';
  let isStumbling = prev.isStumbling;
  let stumbleTimer = prev.stumbleTimer;

  if (isMoving && !isStumbling) {
    // Ветер толкает вбок: при буране (сила 9.5, направление 2.2) это ≈0.84 за кадр.
    // Маска от ветра снижает толчок на 35%.
    let windPush = weather.windX * (weather.windSpeed / 10) * 0.4;
    if (gear.mask) windPush *= 0.65;
    // Случайная кочка: в глубоком снегу раскачивает почти вдвое сильнее.
    const randomTilt = (Math.random() - 0.5) * (isDeepSnow ? 3.5 : 1.8);
    // Всё это умножается на вес: 20 кг груза — ×1, 40 кг — раскачивает вдвое сильнее.
    newBalance += (randomTilt + windPush) * (totalWeightKg / 20);

    // Удержание лямки возвращает баланс на 38 единиц в секунду.
    if (prev.isBracingLeft) {
      newBalance -= 38 * dt;
    }
    if (prev.isBracingRight) {
      newBalance += 38 * dt;
    }

    // Если лямки отпущены, груз сам понемногу выравнивается: −1.5% крена за кадр.
    if (!prev.isBracingLeft && !prev.isBracingRight) {
      newBalance *= 0.985;
    }
  }

  newBalance = Math.max(-100, Math.min(100, newBalance));

  // Крен больше 50 — предупреждение на экране, в какую сторону клонит.
  if (newBalance < -50) {
    stumbleAlert = 'LEFT';
  } else if (newBalance > 50) {
    stumbleAlert = 'RIGHT';
  }

  // Крен больше 70 — критический. Если продержать его дольше 1.1 секунды, курьер падает,
  // а груз теряет 15–30% целостности. Если выровняться раньше, таймер падения
  // откатывается назад вдвое быстрее, чем набирался.
  if (Math.abs(newBalance) > 70 && !isStumbling) {
    stumbleAlert = 'CRITICAL';
    stumbleTimer += dt;
    events.stumbleWarning = true;

    if (stumbleTimer > 1.1) {
      isStumbling = true;
      stumbleTimer = 0;
      events.fell = true;
    }
  } else {
    stumbleTimer = Math.max(0, stumbleTimer - dt * 2);
  }

  // Упавший курьер 1.8 секунды поднимается, после чего баланс сбрасывается в ноль.
  if (isStumbling) {
    stumbleTimer += dt;
    if (stumbleTimer > 1.8) {
      isStumbling = false;
      stumbleTimer = 0;
      newBalance = 0;
    }
  }

  // ----------------------------------------------------
  // ВЫЖИВАНИЕ: тепло, выносливость, дыхание, батарея, обувь (все шкалы от 0 до 100).
  // ----------------------------------------------------
  let newStamina = prev.stamina;
  let newWarmth = prev.warmth;
  let newBattery = prev.battery;
  let newBoots = prev.bootsIntegrity;
  let newBreath = prev.breathAir;

  const nearShelter = structures.some(
    s => s.type === 'SHELTER' && Math.hypot(s.x - nextX, s.y - nextY) < SHELTER_WARMTH_RADIUS
  );
  const nearCampfire = structures.some(
    s => s.type === 'CAMPFIRE' && Math.hypot(s.x - nextX, s.y - nextY) < CAMPFIRE_WARMTH_RADIUS
  );

  if (nearShelter) {
    // Палатка: тепло +24/с, выносливость +18/с (от 0 до 100 примерно за 4 секунды).
    newWarmth = Math.min(100, newWarmth + 24 * dt);
    newStamina = Math.min(prev.maxStamina, newStamina + 18 * dt);
  } else if (nearCampfire) {
    // Костёр: тепло +16/с, выносливость +10/с.
    newWarmth = Math.min(100, newWarmth + 16 * dt);
    newStamina = Math.min(prev.maxStamina, newStamina + 10 * dt);
  } else {
    // Замерзание на открытом воздухе, в единицах тепла в секунду:
    // обычная погода 0.35 (с полной шкалы до нуля ≈ 4.8 минуты),
    // глубокий снегопад 0.65 (≈ 2.5 мин), буран 1.7 (≈ 1 мин), аномальный мороз 2.4 (≈ 42 с).
    let frostDrain = 0.35;
    if (weather.type === 'BLIZZARD') frostDrain = 1.7;
    else if (weather.type === 'EXTREME_COLD') frostDrain = 2.4;
    else if (weather.type === 'HEAVY_SNOWFALL') frostDrain = 0.65;

    // Тёплая одежда срезает замерзание на свой процент (парка — на 35%).
    if (gear.coat) {
      frostDrain *= 1 - gear.coat.coldResist;
    }

    newWarmth = Math.max(0, newWarmth - frostDrain * dt);

    // Переохлаждение (тепло ниже 25): дополнительно −2.5 выносливости в секунду.
    if (newWarmth < 25) {
      newStamina = Math.max(0, newStamina - 2.5 * dt);
    }
  }

  if (isMoving) {
    // Ходьба тратит 3 выносливости в секунду, бег — 12. В глубоком снегу всё ×1.8.
    const staminaCost = (prev.isSprinting ? 12 : 3) * (isDeepSnow ? 1.8 : 1.0);
    newStamina = Math.max(0, newStamina - staminaCost * dt);

    // Износ обуви: по камням 0.5/с (≈ 3.3 мин до дыр), по снегу 0.08/с (≈ 21 мин).
    // В снегопад ×1.5, усиленные ботинки уменьшают износ на свой процент (на 50%).
    let bootWear = curTile.type === 'ROCKS' ? 0.5 : 0.08;
    if (weather.type === 'HEAVY_SNOWFALL') bootWear *= 1.5;
    if (gear.reinforcedBoots) bootWear *= 1 - gear.reinforcedBoots.durabilityBonus;
    newBoots = Math.max(0, newBoots - bootWear * dt);
  } else {
    // Стоя на месте, курьер отдыхает: +12 выносливости в секунду.
    newStamina = Math.min(prev.maxStamina, newStamina + 12 * dt);
  }

  // Задержка дыхания (чтобы Тени не услышали): воздух −18/с (хватает на ≈ 5.5 с),
  // сердце стучит каждые 0.8 с. Отпустил — воздух восстанавливается +30/с.
  if (prev.isHoldingBreath) {
    newBreath = Math.max(0, newBreath - 18 * dt);
    timers.heartbeatTimer += dt;
    if (timers.heartbeatTimer > 0.8) {
      timers.heartbeatTimer = 0;
      events.heartbeat = true;
    }
  } else {
    newBreath = Math.min(100, newBreath + 30 * dt);
  }

  // Батарея: медленно садится (−0.08/с, полный заряд ≈ 21 минута),
  // а во время полярного сияния наоборот заряжается (+2.5/с).
  if (weather.type === 'ANOMALOUS_AURORA') {
    newBattery = Math.min(100, newBattery + 2.5 * dt);
  } else {
    newBattery = Math.max(0, newBattery - 0.08 * dt);
  }

  // Волна сканера «Эхо-4» расходится за 0.67 секунды (прогресс от 0 до 1 со скоростью 1.5/с).
  // Перезарядка сканера хранится в миллисекундах.
  let scannerProgress = prev.scannerPulseProgress;
  let scannerActive = prev.scannerActive;
  const scannerCooldown = Math.max(0, prev.scannerCooldown - dt * 1000);

  if (scannerActive) {
    scannerProgress += dt * 1.5;
    if (scannerProgress >= 1.0) {
      scannerActive = false;
    }
  }

  return {
    events,
    player: {
      ...prev,
      x: nextX,
      y: nextY,
      vx: newVx,
      vy: newVy,
      facingAngle,
      balance: newBalance,
      stumbleAlert,
      stumbleTimer,
      isStumbling,
      stamina: newStamina,
      warmth: newWarmth,
      battery: newBattery,
      bootsIntegrity: newBoots,
      breathAir: newBreath,
      scannerCooldown,
      scannerPulseProgress: scannerProgress,
      scannerActive
    }
  };
}

/**
 * Общий вес, который несёт курьер: груз заказа + инструменты + собранные ресурсы (в кг).
 * Влияет на скорость и на то, как сильно раскачивается груз.
 */
export function computeCarriedWeightKg(
  cargo: { weightKg: number }[],
  tools: { weightKg: number; count: number }[],
  resources: { weightKg: number; count: number }[]
): number {
  const cargoWeight = cargo.reduce((acc, c) => acc + c.weightKg, 0);
  const toolWeight = tools.reduce((acc, t) => acc + t.weightKg * t.count, 0);
  const resourceWeight = resources.reduce((acc, r) => acc + r.weightKg * r.count, 0);
  return cargoWeight + toolWeight + resourceWeight;
}
