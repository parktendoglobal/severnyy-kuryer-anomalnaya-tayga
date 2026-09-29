/**
 * КАК ЧАСТО ОБНОВЛЯТЬ ИНТЕРФЕЙС
 *
 * Мир рисуется на холсте 60 раз в секунду, но полоски выносливости, тепла и прочие надписи
 * интерфейса (HUD) так часто перерисовывать не нужно: глаз не заметит разницы, а слабый
 * телефон заметно «проседает». Поэтому интерфейс обновляется не чаще 10 раз в секунду
 * и только если на экране правда что-то поменялось бы.
 */
import { PlayerStats } from '../types/game';

// Не чаще одного обновления интерфейса в 0.1 секунды (10 раз в секунду).
export const HUD_REFRESH_INTERVAL_SEC = 0.1;

/**
 * «Отпечаток» того, что интерфейс показывает о курьере, с округлением до видимой точности.
 * Если отпечаток не изменился, перерисовывать интерфейс незачем. Например, тепло на экране
 * показано целым числом процентов, поэтому изменение с 81.2 до 81.4 интерфейс не обновит.
 */
export function playerHudKey(p: PlayerStats): string {
  return [
    Math.round(p.x * 10), // расстояние до цели показано с точностью 0.1 клетки
    Math.round(p.y * 10),
    Math.round(p.stamina),
    Math.round(p.warmth),
    Math.round(p.battery),
    Math.round(p.bootsIntegrity),
    Math.round(p.breathAir),
    Math.round(p.balance),
    p.stumbleAlert,
    p.isStumbling,
    p.isHoldingBreath,
    p.isBracingLeft,
    p.isBracingRight,
    p.isSprinting,
    Math.hypot(p.vx, p.vy) < 0.05, // стоит ли курьер на месте (от этого зависит значок отдыха)
    Math.ceil(p.scannerCooldown / 100), // перезарядка сканера показана с точностью 0.1 секунды
    p.scannerActive,
    p.totalLikes,
    p.deliveredDeliveries
  ].join('|');
}
