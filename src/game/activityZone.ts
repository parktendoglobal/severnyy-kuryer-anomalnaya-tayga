/**
 * ЗОНА АКТИВНОСТИ ВОКРУГ КУРЬЕРА
 *
 * В большом мире сотни существ (аномалии, а позже звери и бродячие NPC). Если каждый кадр
 * честно просчитывать поведение всех сразу, слабый телефон не справится. Поэтому мир делится
 * на две части:
 *  • внутри зоны активности (всё, что видно на экране, плюс запас) — существа живут полностью:
 *    двигаются, патрулируют, замечают курьера;
 *  • снаружи — «спят»: каждый кадр их не трогаем, только запоминаем, когда их последний раз
 *    обновляли. Когда курьер снова подходит, их поведение «догоняется» одним быстрым
 *    приблизительным расчётом за всё пропущенное время (см. catchUpDormantAnomaly в anomalyAI.ts).
 *
 * Сюжетно важные существа не засыпают никогда (см. isStoryCritical), чтобы не ломать задания.
 */
import { TILE_SIZE } from '../utils/constants';

/**
 * Минимальный радиус зоны активности, в клетках. Даже на маленьком экране телефона
 * существа в 16 клетках от курьера живут полноценно.
 */
export const MIN_ACTIVITY_RADIUS = 16;

/**
 * Запас за краем экрана, в клетках. Существо «просыпается» за 6 клеток до того,
 * как появится в кадре, поэтому игрок никогда не видит, как оно «оттаивает».
 */
const OFFSCREEN_MARGIN = 6;

/**
 * Если активное задание ведёт в какую-то точку, всё в радиусе 8 клеток от неё
 * считается сюжетно важным и не засыпает.
 */
const QUEST_TARGET_RADIUS = 8;

/**
 * Радиус зоны активности в клетках для текущего экрана и масштаба: половина диагонали
 * видимой области плюс запас. При отдалении камеры (масштаб меньше) зона растёт, так что
 * всё, что видно на экране, всегда живёт полноценно.
 * Пример: экран ноутбука 1920×1080 при масштабе 1.0 — ≈ 40 клеток; телефон 400×800 — ≈ 20.
 */
export function getActivityRadius(screenWidth: number, screenHeight: number, zoom: number): number {
  const halfDiagonalPx = Math.hypot(screenWidth, screenHeight) / 2;
  const halfDiagonalTiles = halfDiagonalPx / (TILE_SIZE * zoom);
  return Math.max(MIN_ACTIVITY_RADIUS, halfDiagonalTiles + OFFSCREEN_MARGIN);
}

// Всё, у чего есть координаты и что может быть помечено как «никогда не засыпать».
interface WorldAgent {
  x: number;
  y: number;
  alwaysActive?: boolean;
}

/**
 * Сюжетно важное существо: помечено в файле региона как alwaysActive или находится
 * рядом с целью активного задания.
 */
export function isStoryCritical(agent: WorldAgent, questTarget: { x: number; y: number } | null): boolean {
  if (agent.alwaysActive) return true;
  if (questTarget && Math.hypot(agent.x - questTarget.x, agent.y - questTarget.y) < QUEST_TARGET_RADIUS) {
    return true;
  }
  return false;
}

/**
 * Нужно ли в этом кадре полноценно считать поведение существа.
 * Проверка — одно вычисление расстояния, это дёшево даже для тысяч существ.
 */
export function shouldSimulate(
  agent: WorldAgent,
  center: { x: number; y: number },
  radius: number,
  questTarget: { x: number; y: number } | null
): boolean {
  return Math.hypot(agent.x - center.x, agent.y - center.y) <= radius || isStoryCritical(agent, questTarget);
}
