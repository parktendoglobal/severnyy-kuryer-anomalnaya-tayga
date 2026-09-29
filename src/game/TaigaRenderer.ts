/**
 * TaigaRenderer — «художник» игры «Северный Курьер: Аномальная Тайга».
 * Каждый кадр он рисует на холсте (canvas) всё, что видит игрок: землю, деревья, постройки,
 * персонажей, аномалии, курьера, освещение и погоду. Игровых решений он не принимает —
 * только показывает текущее состояние мира, которое ему передают.
 *
 * Координаты. Мир — сетка клеток (тайлов); одна клетка = TILE_SIZE = 32 пикселя при zoom 1.
 * Позиции игрока, NPC, ресурсов и т.п. хранятся в клетках (могут быть дробными) — для рисования
 * их умножают на 32 и вычитают положение камеры. Камера всегда держит курьера в центре экрана.
 * Мир рисуется с увеличением zoom (от 0.65 до 3.0), а погода и иней по краям экрана — после,
 * уже в настоящих пикселях экрана, без увеличения и в полном разрешении.
 * Всё, что находится за краем экрана (с небольшим запасом), пропускается, чтобы не тратить время.
 *
 * Время. Параметр time — миллисекунды с момента загрузки страницы (performance.now()).
 * В анимациях вида Math.sin(time * k) один цикл длится 2π / k миллисекунд:
 * например, k = 0.003 → ≈ 2,1 секунды, k = 0.01 → ≈ 0,6 секунды.
 *
 * Детализация (LOD). При zoom ≥ 1.25 добавляются мелкие детали, при zoom ≥ 1.7 — самые мелкие.
 * При отдалении их всё равно не разглядеть, поэтому они не рисуются.
 *
 * Порядок слоёв (что рисуется позже — оказывается сверху):
 *   1. земля (клетки) и подсветка сканера
 *   2. следы курьера
 *   3. станции и постройки игрока
 *   4. потерянные грузы (тайники)
 *   5. ресурсы для сбора
 *   6. маяк цели задания
 *   7. деревья и кусты
 *   8. персонажи (NPC)
 *   9. аномалии
 *  10. волна сканера
 *  11. курьер с грузом
 *  12. освещение (сумерки, костры, фонарь)
 *  13. погода — уже в пикселях экрана
 *  14. иней по краям экрана
 */

import {
  WorldTile,
  PlayerStats,
  CargoItem,
  PlacedStructure,
  AnomalyEntity,
  WeatherState,
  WeatherType,
  Footstep,
  TileType,
  WorldResourceNode,
  WorldNPC
} from '../types/game';
import { TILE_SIZE, STATIONS } from '../utils/constants';
import { getSpruceSprites } from './SpruceSprite';

export class TaigaRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  // Кэш картинок (PNG-тайлы и спрайты), ключ — путь к файлу в папке /public.
  // Пока картинка грузится, рисуем старую «процедурную» графику прямоугольниками,
  // поэтому пустых кадров не бывает.
  private tileImageCache: Map<string, HTMLImageElement> = new Map();

  // Готовим «кисть» для рисования. alpha: false — холст непрозрачный (так быстрее);
  // imageSmoothingEnabled = false — пиксели остаются чёткими, без размытия при увеличении.
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get canvas context');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
  }

  // Возвращает картинку по пути; при первом запросе начинает её загрузку и кладёт в кэш.
  private getTileImage(src: string): HTMLImageElement {
    let img = this.tileImageCache.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      this.tileImageCache.set(src, img);
    }
    return img;
  }

  // Масштаб камеры: 1 = клетка 32×32 пикселя экрана. Допустимо от 0.65 (отдалить) до 3.0 (приблизить).
  private zoom: number = 1.0;

  public setZoom(zoom: number) {
    this.zoom = Math.max(0.65, Math.min(3.0, zoom));
  }

  public getZoom(): number {
    return this.zoom;
  }

  /**
   * Попадает ли точка (в пикселях мира относительно камеры) на экран с запасом margin пикселей.
   * Запас нужен, чтобы крупные спрайты не «обрезались» у края, пока их центр ещё за экраном.
   */
  private isOnScreen(sx: number, sy: number, margin: number): boolean {
    const viewWidth = this.canvas.width / this.zoom;
    const viewHeight = this.canvas.height / this.zoom;
    return sx >= -margin && sx <= viewWidth + margin && sy >= -margin && sy <= viewHeight + margin;
  }

  // Главная функция: рисует один кадр целиком, вызывается игровым циклом каждый кадр.
  // Слои рисуются строго по порядку (см. список в начале файла).
  public render(
    tiles: WorldTile[][],
    player: PlayerStats,
    cargo: CargoItem[],
    structures: PlacedStructure[],
    anomalies: AnomalyEntity[],
    weather: WeatherState,
    footsteps: Footstep[],
    lostCaches: { id: string; x: number; y: number; name: string }[],
    snowParticles: { x: number; y: number; speed: number; size: number }[],
    time: number,
    resourceNodes: WorldResourceNode[] = [],
    npcs: WorldNPC[] = [],
    activeQuestTarget: { x: number; y: number; title: string } | null = null,
    zoom: number = 1.0
  ) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    this.zoom = Math.max(0.65, Math.min(3.0, zoom));
    const z = this.zoom;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Размер видимой области в пикселях мира (при zoom 2 видно вдвое меньше мира).
    const viewWidth = width / z;
    const viewHeight = height / z;

    // Камера: левый верхний угол видимой области, при котором курьер оказывается в центре экрана.
    // player.x/y — в клетках, умножаем на TILE_SIZE, чтобы получить пиксели.
    const cameraX = Math.floor(player.x * TILE_SIZE - viewWidth / 2);
    const cameraY = Math.floor(player.y * TILE_SIZE - viewHeight / 2);

    // Диапазон видимых клеток. Берём с запасом: по 3 клетки слева, справа и снизу и 4 сверху —
    // чтобы высокие деревья, стоящие чуть ниже края экрана, не обрезались.
    const minCol = Math.max(0, Math.floor(cameraX / TILE_SIZE) - 3);
    const maxCol = Math.min(tiles[0].length - 1, Math.ceil((cameraX + viewWidth) / TILE_SIZE) + 3);
    const minRow = Math.max(0, Math.floor(cameraY / TILE_SIZE) - 4);
    const maxRow = Math.min(tiles.length - 1, Math.ceil((cameraY + viewHeight) / TILE_SIZE) + 3);

    // =========================================================================
    // ПРОХОД 1: МИР. Всё ниже увеличивается на zoom (ctx.scale).
    // =========================================================================
    ctx.save();
    ctx.scale(z, z);

    // 1. Земля: каждая видимая клетка рисуется своей текстурой.
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const tile = tiles[r][c];
        const screenX = c * TILE_SIZE - cameraX;
        const screenY = r * TILE_SIZE - cameraY;

        this.drawTile(ctx, tile.type, screenX, screenY, c, r, z);

        // Подсветка сканера поверх клетки. scannedUntil — момент (в мс), до которого клетка подсвечена;
        // за последние 2000 мс (2 секунды) подсветка плавно гаснет от 1 до 0.
        if (tile.scannedUntil && tile.scannedUntil > time) {
          const scanAlpha = Math.min(1, (tile.scannedUntil - time) / 2000);
          this.drawScanOverlay(ctx, tile.type, screenX, screenY, scanAlpha);
        }
      }
    }

    // 2. Следы курьера. Каждый след — овал, повёрнутый по направлению шага; alpha (0–1) следа
    // постепенно уменьшается — следы «тают». Запас 20 px — чтобы след у края не пропадал раньше времени.
    for (const step of footsteps) {
      const sx = step.x * TILE_SIZE - cameraX;
      const sy = step.y * TILE_SIZE - cameraY;
      if (sx >= -20 && sx <= viewWidth + 20 && sy >= -20 && sy <= viewHeight + 20) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(step.angle);
        // Глубокий след (depth > 1, в глубоком снегу) — темнее и заметнее.
        ctx.fillStyle = step.depth > 1 ? `rgba(140, 160, 185, ${step.alpha * 0.7})` : `rgba(180, 200, 220, ${step.alpha * 0.5})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // При приближении (zoom ≥ 1.25) — рисунок протектора ботинка, при zoom ≥ 1.7 — ещё и светлые края следа.
        if (z >= 1.25) {
          ctx.fillStyle = `rgba(90, 115, 140, ${step.alpha * 0.65})`;
          ctx.fillRect(-2, 2, 4, 2); // Каблук
          ctx.fillRect(-2.5, -3, 5, 1); // Передний выступ протектора
          ctx.fillRect(-2, -0.5, 4, 1); // Средний выступ протектора
          if (z >= 1.7) {
            ctx.fillStyle = `rgba(255, 255, 255, ${step.alpha * 0.55})`;
            ctx.fillRect(-3.5, -2, 1, 3);
            ctx.fillRect(2.5, -2, 1, 3);
          }
        }
        ctx.restore();
      }
    }

    // 3. Станции (постоянные домики на карте) и постройки игрока.
    this.drawStations(ctx, cameraX, cameraY, viewWidth, viewHeight, time, z);
    this.drawStructures(ctx, structures, cameraX, cameraY, time, z);

    // 4. Потерянные грузы (тайники); запас 40 px за краем экрана.
    for (const cache of lostCaches) {
      const sx = cache.x * TILE_SIZE - cameraX;
      const sy = cache.y * TILE_SIZE - cameraY;
      if (sx >= -40 && sx <= viewWidth + 40 && sy >= -40 && sy <= viewHeight + 40) {
        this.drawLostContainer(ctx, sx, sy, time, z);
      }
    }

    // 5. Ресурсы для сбора (брёвна, чага, металлолом и т.д.).
    this.drawResourceNodes(ctx, resourceNodes, cameraX, cameraY, time, player, z);

    // 6. Маяк цели активного задания.
    this.drawQuestObjective(ctx, activeQuestTarget, cameraX, cameraY, time);

    // 7. Деревья и кусты. Рисуются после земли и предметов, ряд за рядом сверху вниз, поэтому
    // нижние деревья перекрывают верхние (эффект глубины). Костры передаём, чтобы деревья рядом
    // с огнём получили тёплый отсвет.
    const campfires = structures.filter(s => s.type === 'CAMPFIRE');
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const tile = tiles[r][c];
        if (tile.tree) {
          const sx = c * TILE_SIZE - cameraX + TILE_SIZE / 2;
          const sy = r * TILE_SIZE - cameraY + TILE_SIZE / 2;
          this.drawTree(ctx, tile.tree, sx, sy, c, r, time, campfires, cameraX, cameraY, z);
        }
      }
    }

    // 8. Персонажи мира (Тарас, Степан, Улукиткан, Вера).
    this.drawWorldNPCs(ctx, npcs, cameraX, cameraY, time, player, z);

    // 9. Аномалии (запас 100 px — у них крупные эффекты).
    for (const anom of anomalies) {
      const sx = anom.x * TILE_SIZE - cameraX;
      const sy = anom.y * TILE_SIZE - cameraY;
      if (sx >= -100 && sx <= viewWidth + 100 && sy >= -100 && sy <= viewHeight + 100) {
        this.drawAnomaly(ctx, anom, sx, sy, time, player, z);
      }
    }

    // 10. Волна сканера: расширяющееся голубое кольцо. scannerPulseProgress растёт от 0 до 1,
    // радиус доходит до 280 px (≈ 8,75 клетки), к концу кольцо тускнеет до нуля.
    if (player.scannerActive && player.scannerPulseProgress < 1.0) {
      const px = player.x * TILE_SIZE - cameraX;
      const py = player.y * TILE_SIZE - cameraY;
      const radius = player.scannerPulseProgress * 280;
      ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0, 1 - player.scannerPulseProgress)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Внутреннее тонкое кольцо, на 15 px меньше.
      ctx.strokeStyle = `rgba(125, 211, 252, ${Math.max(0, 0.7 - player.scannerPulseProgress * 0.7)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0, radius - 15), 0, Math.PI * 2);
      ctx.stroke();
    }

    // 11. Сам курьер со стопкой груза за спиной (в центре экрана).
    const pScreenX = player.x * TILE_SIZE - cameraX;
    const pScreenY = player.y * TILE_SIZE - cameraY;
    this.drawCourier(ctx, player, cargo, pScreenX, pScreenY, time, anomalies, z);

    // 12. Освещение: вечерние сумерки + тёплый свет костров, укрытий и налобного фонаря.
    this.drawDynamicLighting(ctx, structures, pScreenX, pScreenY, viewWidth, viewHeight, time, weather, cameraX, cameraY);

    ctx.restore(); // конец прохода 1 (снимаем увеличение zoom)

    // =========================================================================
    // ПРОХОД 2: ЭКРАН. Рисуем в настоящих пикселях экрана, без увеличения.
    // =========================================================================
    // 13. Погода: снег, метель, полярное сияние, звёздное небо.
    this.drawWeather(ctx, weather, snowParticles, width, height, time, z);

    // 14. Иней и холодная кайма по краям экрана, когда курьер мёрзнет.
    this.drawScreenFrost(ctx, width, height, player.warmth, weather);

    ctx.restore(); // возвращаем исходные настройки холста
  }

  // Рисует одну клетку земли 32×32 по её типу. x, y — левый верхний угол клетки в пикселях
  // (до увеличения), col/row — номер колонки и строки клетки на карте.
  // Числа вида fillRect(x + 8, y + 14, 16, 2) — смещение в пикселях от левого верхнего угла клетки
  // и размер прямоугольника (здесь полоса 16×2 px). Каждое такое число отдельно не комментируем.
  // Вариации «наугад» считаются формулой от номера клетки, например (col * 5 + row * 11) % 7.
  // Это не настоящая случайность: у одной и той же клетки результат всегда одинаковый,
  // поэтому картинка не мерцает от кадра к кадру, а поле всё равно выглядит разнообразным.
  private drawTile(ctx: CanvasRenderingContext2D, type: TileType, x: number, y: number, col: number, row: number, zoom: number = 1.0) {
    switch (type) {
      case 'SNOW_HARD': {
        // Плотный наст. Шахматка из двух очень близких оттенков — чтобы поле не выглядело плоским.
        ctx.fillStyle = (col + row) % 2 === 0 ? '#EAF1F7' : '#F3F8FC';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Заструги (гребни снега, выдутые ветром): вариант A на 2 клетках из 7, вариант B — на 1 из 7.
        const drift = (col * 5 + row * 11) % 7;
        if (drift === 0 || drift === 3) {
          ctx.fillStyle = '#BED0E0';
          ctx.fillRect(x + 2, y + 8, 16, 2);
          ctx.fillStyle = '#A2B8CC';
          ctx.fillRect(x + 3, y + 10, 14, 1);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x + 1, y + 7, 12, 1);
        } else if (drift === 5) {
          ctx.fillStyle = '#C5D6E5';
          ctx.fillRect(x + 14, y + 20, 14, 2);
          ctx.fillStyle = '#A9BFD3';
          ctx.fillRect(x + 15, y + 22, 11, 1);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x + 13, y + 19, 10, 1);
        }

        // Блёстки снега — примерно на каждой 11-й клетке.
        if ((col * 13 + row * 7) % 11 === 0) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x + 8, y + 14, 1, 1);
          ctx.fillRect(x + 24, y + 6, 1, 1);
        }

        // Опавшие хвоинки — примерно на каждой 13-й клетке.
        if ((col * 17 + row * 23) % 13 === 0) {
          ctx.fillStyle = '#3D2F24';
          ctx.fillRect(x + 18, y + 16, 3, 1);
          ctx.fillRect(x + 20, y + 15, 1, 2);
        }

        // --- Детализация при приближении (LOD) ---
        if (zoom >= 1.25) {
          // Дополнительная рябь наста.
          ctx.fillStyle = '#CBDCEB';
          ctx.fillRect(x + 6, y + 24, 18, 1);
          ctx.fillRect(x + 10, y + 4, 12, 1);

          // Следы куропатки или зайца — примерно на каждой 8-й клетке.
          if ((col * 9 + row * 13) % 8 === 2) {
            ctx.fillStyle = '#9FB4C7';
            ctx.fillRect(x + 12, y + 13, 2, 1);
            ctx.fillRect(x + 16, y + 10, 2, 1);
            ctx.fillRect(x + 20, y + 7, 2, 1);
          }

          if (zoom >= 1.7) {
            // Искорки ледяных кристаллов.
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x + 4, y + 5, 1, 1);
            ctx.fillRect(x + 19, y + 23, 1, 1);
            ctx.fillRect(x + 27, y + 12, 1, 1);
            ctx.fillStyle = '#D2E3F1';
            ctx.fillRect(x + 5, y + 6, 1, 1);
            ctx.fillRect(x + 20, y + 24, 1, 1);
          }
        }
        break;
      }

      case 'SNOW_DEEP': {
        // Глубокий снег: фон темнее и голубее наста — игрок видит, где идти тяжелее.
        // Сверху «подушки» сугробов: тень → полутон → яркий гребень.
        ctx.fillStyle = '#B8CCE0';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Сугробы-подушки.
        ctx.fillStyle = '#8FA8C0'; // Тень сугроба
        ctx.fillRect(x + 1, y + 16, 22, 8);
        ctx.fillRect(x + 12, y + 12, 18, 10);

        ctx.fillStyle = '#D6E5F2'; // Полутон снега
        ctx.fillRect(x + 1, y + 10, 20, 7);
        ctx.fillRect(x + 12, y + 6, 18, 7);

        ctx.fillStyle = '#FFFFFF'; // Яркие гребни
        ctx.fillRect(x + 3, y + 8, 16, 2);
        ctx.fillRect(x + 14, y + 4, 14, 2);

        // --- Детализация при приближении (LOD) ---
        if (zoom >= 1.25) {
          // Тень под козырьком снега и второстепенные сугробы.
          ctx.fillStyle = '#7892AA';
          ctx.fillRect(x + 5, y + 21, 14, 2);
          ctx.fillStyle = '#E5EFF8';
          ctx.fillRect(x + 6, y + 7, 10, 1);

          if (zoom >= 1.7) {
            // Отдельные комья снега с тенями.
            ctx.fillStyle = '#A3B8CC';
            ctx.fillRect(x + 2, y + 14, 3, 2);
            ctx.fillRect(x + 23, y + 18, 3, 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x + 2, y + 13, 2, 1);
            ctx.fillRect(x + 23, y + 17, 2, 1);
          }
        }
        break;
      }

      case 'ICE_RIVER': {
        // Замёрзшая река: синий лёд со светлыми пластинами.
        ctx.fillStyle = '#4D728E';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Полупрозрачные пластины льда.
        ctx.fillStyle = '#658BA7';
        ctx.fillRect(x + 1, y + 2, TILE_SIZE - 2, TILE_SIZE - 4);
        ctx.fillStyle = '#7CA1BE';
        ctx.fillRect(x + 3, y + 4, TILE_SIZE - 6, TILE_SIZE - 8);

        // Трещины во льду: 4 варианта рисунка, выбор по номеру клетки (у клетки всегда один и тот же).
        const crackVariant = (col * 3 + row * 7) % 4;
        ctx.fillStyle = '#9FC3DE';
        if (crackVariant === 0) {
          ctx.fillRect(x + 4, y + 8, 14, 1);
          ctx.fillRect(x + 17, y + 9, 2, 7);
          ctx.fillRect(x + 18, y + 16, 10, 1);
          ctx.fillRect(x + 27, y + 17, 2, 8);
          ctx.fillStyle = '#EDF6FD';
          ctx.fillRect(x + 6, y + 7, 8, 1);
          ctx.fillRect(x + 19, y + 15, 6, 1);
        } else if (crackVariant === 1) {
          ctx.fillRect(x + 2, y + 18, 12, 1);
          ctx.fillRect(x + 13, y + 14, 2, 5);
          ctx.fillRect(x + 14, y + 13, 14, 1);
          ctx.fillStyle = '#EDF6FD';
          ctx.fillRect(x + 15, y + 12, 9, 1);
        } else if (crackVariant === 2) {
          ctx.fillRect(x + 8, y + 4, 2, 12);
          ctx.fillRect(x + 9, y + 15, 12, 1);
          ctx.fillRect(x + 20, y + 16, 2, 11);
          ctx.fillStyle = '#EDF6FD';
          ctx.fillRect(x + 11, y + 14, 7, 1);
        } else {
          ctx.fillRect(x + 6, y + 22, 18, 1);
          ctx.fillRect(x + 14, y + 8, 1, 14);
          ctx.fillStyle = '#EDF6FD';
          ctx.fillRect(x + 8, y + 21, 10, 1);
        }

        // Вмёрзшие пузырьки воздуха.
        ctx.fillStyle = '#CBE1F2';
        ctx.fillRect(x + 7, y + 11, 2, 2);
        ctx.fillRect(x + 22, y + 21, 2, 2);
        ctx.fillRect(x + 24, y + 9, 1, 1);

        // Снег, наползающий с берега, — на каждой 4-й колонке.
        if (col % 4 === 0) {
          ctx.fillStyle = '#D6E5F2';
          ctx.fillRect(x, y, 4, 6);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x, y, 2, 4);
        }

        // --- Детализация при приближении (LOD) ---
        if (zoom >= 1.25) {
          // Тонкие трещинки-ответвления.
          ctx.fillStyle = '#BCE0F5';
          ctx.fillRect(x + 10, y + 9, 5, 1);
          ctx.fillRect(x + 15, y + 10, 1, 4);
          ctx.fillRect(x + 21, y + 17, 4, 1);

          // Блики на пузырьках.
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x + 7, y + 11, 1, 1);
          ctx.fillRect(x + 22, y + 21, 1, 1);

          if (zoom >= 1.7) {
            // Царапины от полозьев и голубой отблеск.
            ctx.fillStyle = '#67E8F9';
            ctx.fillRect(x + 14, y + 14, 6, 1);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(x + 3, y + 19, 11, 1);
            ctx.fillRect(x + 18, y + 7, 9, 1);
          }
        }
        break;
      }

      case 'ROCKS': {
        // Скалы: тёмный гранит со снежной шапкой сверху.
        ctx.fillStyle = '#263341';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Грани камня.
        ctx.fillStyle = '#1B242F'; // Глубокая тень
        ctx.fillRect(x + 2, y + 10, 20, 16);
        ctx.fillStyle = '#394B5E'; // Тело гранита
        ctx.fillRect(x + 4, y + 7, 18, 15);
        ctx.fillStyle = '#546A80'; // Верхняя грань
        ctx.fillRect(x + 5, y + 6, 16, 8);
        ctx.fillStyle = '#768EAA'; // Светлый край камня
        ctx.fillRect(x + 6, y + 6, 14, 2);

        // Округлая снежная шапка на вершине камня.
        ctx.fillStyle = '#9FB6CC'; // Холодная тень под снегом
        ctx.fillRect(x + 4, y + 4, 18, 3);
        ctx.fillStyle = '#DCE8F3'; // Полутон снега
        ctx.fillRect(x + 5, y + 2, 16, 3);
        ctx.fillStyle = '#FFFFFF'; // Освещённый гребень
        ctx.fillRect(x + 7, y + 1, 12, 2);

        // Мох/лишайник в трещине — на каждой 3-й клетке (по диагоналям).
        if ((col + row) % 3 === 0) {
          ctx.fillStyle = '#495B44';
          ctx.fillRect(x + 8, y + 15, 3, 4);
        }

        // --- Детализация при приближении (LOD) ---
        if (zoom >= 1.25) {
          // Оранжевый лишайник и острые сколы.
          ctx.fillStyle = '#D97706';
          ctx.fillRect(x + 15, y + 12, 2, 2);
          ctx.fillRect(x + 18, y + 14, 3, 2);
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(x + 16, y + 13, 1, 1);

          // Осыпь мелких камней у подножия.
          ctx.fillStyle = '#182029';
          ctx.fillRect(x + 1, y + 27, 4, 3);
          ctx.fillRect(x + 24, y + 26, 5, 4);
          ctx.fillStyle = '#475569';
          ctx.fillRect(x + 2, y + 27, 2, 2);

          if (zoom >= 1.7) {
            // Светлые кварцевые прожилки.
            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(x + 8, y + 8, 1, 5);
            ctx.fillRect(x + 9, y + 13, 1, 4);
            ctx.fillRect(x + 10, y + 17, 1, 3);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x + 8, y + 10, 1, 2);
          }
        }
        break;
      }

      case 'CLIFF': {
        // Обрыв: тёмные ступенчатые уступы с глубокой тенью.
        ctx.fillStyle = '#121A23'; // Тень пропасти
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Слои породы.
        ctx.fillStyle = '#222F3D';
        ctx.fillRect(x + 1, y + 5, TILE_SIZE - 2, TILE_SIZE - 5);
        ctx.fillStyle = '#37495C';
        ctx.fillRect(x + 2, y + 4, TILE_SIZE - 4, 9);
        ctx.fillStyle = '#4F647B';
        ctx.fillRect(x + 4, y + 3, TILE_SIZE - 8, 4);

        // Горизонтальные каменные полки.
        ctx.fillStyle = '#18222C';
        ctx.fillRect(x + 2, y + 16, TILE_SIZE - 4, 3);
        ctx.fillStyle = '#2D3D4E';
        ctx.fillRect(x + 3, y + 18, TILE_SIZE - 6, 8);

        // Снежная кромка на верхнем краю.
        ctx.fillStyle = '#9EB5CB';
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 2);
        ctx.fillStyle = '#E6F0F8';
        ctx.fillRect(x + 4, y + 1, TILE_SIZE - 8, 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + 7, y, TILE_SIZE - 14, 2);

        // --- Детализация при приближении (LOD) ---
        if (zoom >= 1.25) {
          // Линии слоёв породы.
          ctx.fillStyle = '#5A6F87';
          ctx.fillRect(x + 4, y + 9, TILE_SIZE - 8, 1);
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(x + 3, y + 10, TILE_SIZE - 6, 1);

          // Маленькие сосульки под уступом.
          ctx.fillStyle = '#BAE6FD';
          ctx.fillRect(x + 8, y + 5, 2, 3);
          ctx.fillRect(x + 18, y + 5, 2, 4);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x + 8, y + 5, 1, 2);

          if (zoom >= 1.7) {
            // Промоины и глубокие вертикальные трещины.
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(x + 12, y + 6, 1, 14);
            ctx.fillRect(x + 22, y + 11, 1, 10);
          }
        }
        break;
      }

      case 'FROZEN_BOG': {
        // Мёрзлое болото: бурый торф, серо-зелёный лишайник, красные кустики брусники.
        ctx.fillStyle = '#3C3127';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Пятна лишайника.
        ctx.fillStyle = '#778A73';
        ctx.fillRect(x + 2, y + 2, 14, 12);
        ctx.fillRect(x + 14, y + 12, 14, 14);
        ctx.fillStyle = '#8F9F8B';
        ctx.fillRect(x + 4, y + 4, 10, 8);
        ctx.fillRect(x + 16, y + 14, 10, 10);

        // Сухая жёлтая трава.
        ctx.fillStyle = '#B4A57C';
        ctx.fillRect(x + 18, y + 3, 10, 7);
        ctx.fillRect(x + 3, y + 17, 9, 8);
        ctx.fillStyle = '#8F815C';
        ctx.fillRect(x + 19, y + 6, 8, 3);
        ctx.fillRect(x + 4, y + 20, 7, 3);

        // Тёмно-красные кустики брусники/вереска.
        ctx.fillStyle = '#701D1D';
        ctx.fillRect(x + 5, y + 8, 5, 4);
        ctx.fillRect(x + 21, y + 18, 6, 5);
        ctx.fillStyle = '#9C2B2B';
        ctx.fillRect(x + 6, y + 9, 4, 3);
        ctx.fillRect(x + 22, y + 19, 4, 3);
        // Яркие ягоды.
        ctx.fillStyle = '#E11D48';
        ctx.fillRect(x + 6, y + 8, 2, 2);
        ctx.fillRect(x + 22, y + 18, 2, 2);
        ctx.fillRect(x + 24, y + 21, 2, 2);
        ctx.fillStyle = '#FDA4AF';
        ctx.fillRect(x + 7, y + 8, 1, 1);
        ctx.fillRect(x + 23, y + 18, 1, 1);

        // Замёрзшие лужицы.
        ctx.fillStyle = '#5A7285';
        ctx.fillRect(x + 12, y + 7, 6, 4);
        ctx.fillStyle = '#C0D5E4';
        ctx.fillRect(x + 13, y + 8, 4, 2);

        // --- Детализация при приближении (LOD) ---
        if (zoom >= 1.25) {
          // Светлые кустики ягеля и тонкие волокна мха.
          ctx.fillStyle = '#D1D5DB';
          ctx.fillRect(x + 7, y + 3, 4, 2);
          ctx.fillRect(x + 17, y + 15, 4, 2);
          ctx.fillStyle = '#15803D'; // Тёмные листики вокруг ягод
          ctx.fillRect(x + 5, y + 10, 2, 2);
          ctx.fillRect(x + 20, y + 21, 2, 2);

          if (zoom >= 1.7) {
            // Блики на ягодах и иней на травинках.
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x + 6, y + 8, 1, 1);
            ctx.fillRect(x + 22, y + 18, 1, 1);
            ctx.fillStyle = '#F3F4F6';
            ctx.fillRect(x + 19, y + 4, 1, 4);
            ctx.fillRect(x + 5, y + 18, 1, 4);
          }
        }
        break;
      }

      case 'OLD_ROAD': {
        // Старая дорога: каменные плиты и гравий.
        ctx.fillStyle = '#524438'; // Утоптанный гравий
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Каменные плиты.
        ctx.fillStyle = '#657687';
        ctx.fillRect(x + 2, y + 2, 11, 10);
        ctx.fillRect(x + 15, y + 3, 9, 9);
        ctx.fillRect(x + 3, y + 15, 10, 9);
        ctx.fillRect(x + 16, y + 14, 10, 11);

        // Светлые фаски по верху плит.
        ctx.fillStyle = '#8799AA';
        ctx.fillRect(x + 3, y + 2, 9, 2);
        ctx.fillRect(x + 16, y + 3, 7, 2);
        ctx.fillRect(x + 4, y + 15, 8, 2);
        ctx.fillRect(x + 17, y + 14, 8, 2);
        ctx.fillStyle = '#B4C5D4';
        ctx.fillRect(x + 4, y + 2, 4, 1);
        ctx.fillRect(x + 17, y + 3, 4, 1);

        // Земля и мох в швах между плитами.
        ctx.fillStyle = '#223223';
        ctx.fillRect(x + 13, y, 2, TILE_SIZE);
        ctx.fillRect(x, y + 12, TILE_SIZE, 2);

        // Веточка брусники у края дороги — на каждой 3-й клетке.
        if ((col + row) % 3 === 0) {
          ctx.fillStyle = '#E11D48';
          ctx.fillRect(x + 1, y + 1, 2, 2);
          ctx.fillStyle = '#166534';
          ctx.fillRect(x + 2, y + 3, 2, 1);
        }

        // --- Детализация при приближении (LOD) ---
        if (zoom >= 1.25) {
          // Колеи от полозьев саней.
          ctx.fillStyle = '#372B23';
          ctx.fillRect(x + 7, y, 2, TILE_SIZE);
          ctx.fillRect(x + 23, y, 2, TILE_SIZE);
          ctx.fillStyle = '#6B7280';
          ctx.fillRect(x + 8, y + 4, 1, 6);
          ctx.fillRect(x + 24, y + 12, 1, 6);

          if (zoom >= 1.7) {
            // Иней и отдельные камешки.
            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(x + 6, y + 8, 1, 2);
            ctx.fillRect(x + 22, y + 16, 1, 2);
            ctx.fillStyle = '#9CA3AF';
            ctx.fillRect(x + 11, y + 18, 2, 2);
          }
        }
        break;
      }

      case 'STATION_PLATFORM': {
        // Настил станции: картинка /public/tiles/station_platform_wall.png.
        // Пока картинка не загрузилась — рисуем простые доски прямоугольниками.
        const wallImg = this.getTileImage('tiles/station_platform_wall.png');
        if (wallImg.complete && wallImg.naturalWidth > 0) {
          ctx.drawImage(wallImg, x, y, TILE_SIZE, TILE_SIZE);
        } else {
          ctx.fillStyle = '#3E2A1C';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#684A33';
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 5);
          ctx.fillRect(x + 2, y + 9, TILE_SIZE - 4, 5);
          ctx.fillRect(x + 2, y + 16, TILE_SIZE - 4, 5);
          ctx.fillRect(x + 2, y + 23, TILE_SIZE - 4, 5);
        }

        // Заклёпки и иней поверх картинки (позже их планируется встроить в саму картинку).
        ctx.fillStyle = '#1C1917';
        ctx.fillRect(x + 3, y + 4, 2, 2);
        ctx.fillRect(x + TILE_SIZE - 5, y + 4, 2, 2);
        ctx.fillStyle = '#D6E4F0'; // Иней вдоль края доски
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 1);

        // --- Детализация при приближении (LOD) ---
        if (zoom >= 1.25) {
          // Жёлтые противоскользящие насечки и болты.
          ctx.fillStyle = '#CA8A04';
          ctx.fillRect(x + 4, y + 2, 4, 1);
          ctx.fillRect(x + 12, y + 2, 4, 1);
          ctx.fillRect(x + 20, y + 2, 4, 1);
          ctx.fillStyle = '#44403C';
          ctx.fillRect(x + 2, y + 11, 2, 2);
          ctx.fillRect(x + TILE_SIZE - 4, y + 11, 2, 2);

          if (zoom >= 1.7) {
            // Сучки на досках и снег в щелях.
            ctx.fillStyle = '#452A18';
            ctx.fillRect(x + 18, y + 18, 3, 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x + 3, y + 7, TILE_SIZE - 6, 1);
            ctx.fillRect(x + 3, y + 14, TILE_SIZE - 6, 1);
          }
        }
        break;
      }
    }
  }

  // Голограмма сканера поверх клетки (в духе сканера из Death Stranding). Цвет — подсказка игроку:
  // голубая рамка с крестиком — безопасно (наст, дорога, настил); жёлтая рамка с точкой — трудный путь
  // (глубокий снег, болото); красная рамка с диагональю — опасно (лёд, скалы, обрыв).
  // alpha — яркость от 0 до 1, к концу действия скана падает до 0.
  private drawScanOverlay(ctx: CanvasRenderingContext2D, type: TileType, x: number, y: number, alpha: number) {
    ctx.save();
    ctx.globalAlpha = alpha;

    if (type === 'SNOW_HARD' || type === 'OLD_ROAD' || type === 'STATION_PLATFORM') {
      // Безопасно: голубая рамка с крестиком.
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(x + 15, y + 14, 2, 4);
      ctx.fillRect(x + 14, y + 15, 4, 2);
    } else if (type === 'SNOW_DEEP' || type === 'FROZEN_BOG') {
      // Трудно: жёлтая рамка и точка.
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(x + 16, y + 16, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'ICE_RIVER' || type === 'ROCKS' || type === 'CLIFF') {
      // Опасно: красная рамка.
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      // Диагональная черта через клетку.
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + TILE_SIZE - 4, y + TILE_SIZE - 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Рисует дерево или куст в клетке. x, y — центр клетки в пикселях (до увеличения), c/r — номер клетки.
  // Ели рисуются готовым спрайтом (drawReferenceSpruce), остальные — прямоугольниками и овалами.
  // Числа в fillRect/ellipse ниже — смещения частей в пикселях от центра клетки при zoom 1:
  // например, fillRect(x - 2, y - 18, 4, 26) — ствол 4×26 px, начинающийся на 18 px выше центра.
  // Каждое такое число отдельно не комментируем.
  private drawTree(
    ctx: CanvasRenderingContext2D,
    tree: 'PINE' | 'BIRCH' | 'DEAD_TREE' | 'BUSH' | 'GIANT_PINE' | 'RED_BERRY_BUSH' | 'LARCH',
    x: number,
    y: number,
    c: number,
    r: number,
    time: number,
    campfires: PlacedStructure[] = [],
    cameraX: number = 0,
    cameraY: number = 0,
    zoom: number = 1.0
  ) {
    ctx.save();
    // Покачивание на ветру: ±1,4 px, один цикл ≈ 3 секунды (sin(time * 0.002)). Фаза зависит от номера
    // клетки, чтобы соседние деревья качались не в такт.
    const sway = Math.sin(time * 0.002 + c * 1.3 + r * 0.7) * 1.4;

    // Ищем ближайший костёр: если он ближе 140 px (≈ 4,4 клетки), дерево получает тёплый отсвет —
    // тем ярче, чем ближе (fireIntensity: 1 — вплотную, 0 — на границе 140 px).
    let fireDist = 999;
    let fireDir = 1; // 1 = костёр левее дерева, -1 = правее
    for (const fire of campfires) {
      const fsx = fire.x * TILE_SIZE - cameraX;
      const fsy = fire.y * TILE_SIZE - cameraY;
      const d = Math.hypot(x - fsx, y - fsy);
      if (d < fireDist) {
        fireDist = d;
        fireDir = x > fsx ? 1 : -1;
      }
    }
    const hasFireGlow = fireDist < 140;
    const fireIntensity = hasFireGlow ? Math.max(0, 1 - fireDist / 140) : 0;

    if (tree === 'PINE' || tree === 'GIANT_PINE') {
      // Ель (обычная или гигантская) — готовый пиксельный спрайт.
      this.drawReferenceSpruce(
        ctx,
        x,
        y,
        c,
        r,
        sway,
        hasFireGlow,
        fireIntensity,
        fireDir,
        zoom,
        tree === 'GIANT_PINE'
      );
    } else if (tree === 'LARCH') {
      // Лиственница: тонкий ствол и ветки в инее. Ветки качаются, причём верхние сильнее нижних
      // (множители sway 0.4 → 0.6 → 0.8).
      // Тень на земле.
      ctx.fillStyle = 'rgba(28, 42, 60, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x + 1, y + 8, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Высокий коричневый ствол.
      ctx.fillStyle = '#261C16';
      ctx.fillRect(x - 2, y - 18, 4, 26);
      ctx.fillStyle = '#3E2E24';
      ctx.fillRect(x - 1, y - 16, 2, 24);
      ctx.fillStyle = '#5A4638';
      ctx.fillRect(x, y - 14, 1, 20);

      // Тонкие ветки.
      ctx.strokeStyle = '#3E2E24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Нижние ветки
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x - 10 + sway * 0.4, y - 7);
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 11 + sway * 0.4, y - 9);
      // Средние ветки
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x - 8 + sway * 0.6, y - 16);
      ctx.moveTo(x, y - 13);
      ctx.lineTo(x + 8 + sway * 0.6, y - 18);
      // Верхушка
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x - 5 + sway * 0.8, y - 26);
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x + 5 + sway * 0.8, y - 26);
      ctx.stroke();

      // Иней и комья снега на ветках.
      ctx.fillStyle = '#9EB5CC';
      ctx.fillRect(x - 9 + sway * 0.4, y - 8, 5, 2);
      ctx.fillRect(x + 8 + sway * 0.4, y - 10, 5, 2);
      ctx.fillRect(x - 7 + sway * 0.6, y - 17, 4, 2);
      ctx.fillRect(x + 6 + sway * 0.6, y - 19, 4, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 8 + sway * 0.4, y - 9, 3, 1);
      ctx.fillRect(x + 9 + sway * 0.4, y - 11, 3, 1);
      ctx.fillRect(x - 1, y - 20, 2, 2);

      // Детализация: шишки и кристаллы инея.
      if (zoom >= 1.25) {
        ctx.fillStyle = '#221711';
        ctx.fillRect(x - 9 + sway * 0.4, y - 6, 2, 2);
        ctx.fillRect(x + 10 + sway * 0.4, y - 8, 2, 2);
        ctx.fillStyle = '#E0F2FE';
        ctx.fillRect(x - 9 + sway * 0.4, y - 7, 2, 1);

        if (zoom >= 1.7) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x - 5 + sway * 0.4, y - 14, 1, 1);
          ctx.fillRect(x + 6 + sway * 0.4, y - 16, 1, 1);
        }
      }
    } else if (tree === 'BIRCH') {
      // Берёза: белый ствол с тёмными чёрточками.
      ctx.fillStyle = 'rgba(28, 42, 60, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x + 1, y + 8, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#E8EEF5'; // Белая кора
      ctx.fillRect(x - 2, y - 20, 4, 28);
      ctx.fillStyle = '#BCC8D4'; // Теневая сторона
      ctx.fillRect(x + 1, y - 20, 1, 28);

      // Тёмные поперечные метки на коре.
      ctx.fillStyle = '#1A1D22';
      ctx.fillRect(x - 2, y - 14, 3, 2);
      ctx.fillRect(x, y - 7, 2, 2);
      ctx.fillRect(x - 2, y + 1, 4, 2);
      ctx.fillRect(x - 1, y + 5, 2, 2);

      // Тонкие зимние ветки.
      ctx.strokeStyle = '#4A3B30';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x - 10 + sway * 0.7, y - 23);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 10 + sway * 0.7, y - 20);
      ctx.stroke();

      // Иней на кончиках веток.
      ctx.fillStyle = '#D6E4F0';
      ctx.fillRect(x - 9 + sway * 0.7, y - 24, 4, 2);
      ctx.fillRect(x + 8 + sway * 0.7, y - 21, 4, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 8 + sway * 0.7, y - 24, 2, 1);
      ctx.fillRect(x + 9 + sway * 0.7, y - 21, 2, 1);

      // Детализация: дополнительные метки и блик на коре; при zoom ≥ 1.7 — почки на ветках.
      if (zoom >= 1.25) {
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(x - 2, y - 17, 2, 1);
        ctx.fillRect(x, y - 11, 3, 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - 3, y - 12, 1, 3);

        if (zoom >= 1.7) {
          ctx.fillStyle = '#C8B69E';
          ctx.fillRect(x - 10 + sway * 0.7, y - 21, 1, 3);
          ctx.fillRect(x + 10 + sway * 0.7, y - 18, 1, 3);
        }
      }
    } else if (tree === 'RED_BERRY_BUSH') {
      // Куст брусники: тёмная кочка, зелень, красные ягоды и снежная шапка сверху.
      // Тень на земле.
      ctx.fillStyle = 'rgba(28, 42, 60, 0.32)';
      ctx.beginPath();
      ctx.ellipse(x, y + 6, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Основание из торфа.
      ctx.fillStyle = '#1D130C';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 11, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2F1E14';
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Тёмно-зелёная листва.
      ctx.fillStyle = '#12251A';
      ctx.fillRect(x - 9, y - 1, 4, 3);
      ctx.fillRect(x - 4, y, 4, 3);
      ctx.fillRect(x + 1, y - 1, 4, 3);
      ctx.fillRect(x + 6, y, 4, 3);
      ctx.fillStyle = '#1B3B2B';
      ctx.fillRect(x - 8, y, 2, 2);
      ctx.fillRect(x + 7, y + 1, 2, 2);

      // Гроздья ягод.
      ctx.fillStyle = '#9F1239';
      ctx.fillRect(x - 7, y + 1, 3, 3);
      ctx.fillRect(x - 2, y + 2, 3, 3);
      ctx.fillRect(x + 3, y + 1, 3, 3);
      ctx.fillRect(x + 7, y + 2, 3, 3);

      ctx.fillStyle = '#E11D48'; // Ярко-алый
      ctx.fillRect(x - 7, y + 1, 2, 2);
      ctx.fillRect(x - 2, y + 2, 2, 2);
      ctx.fillRect(x + 3, y + 1, 2, 2);
      ctx.fillRect(x + 7, y + 2, 2, 2);

      // Блики на ягодах.
      ctx.fillStyle = '#FECDD3';
      ctx.fillRect(x - 7, y + 1, 1, 1);
      ctx.fillRect(x - 2, y + 2, 1, 1);
      ctx.fillRect(x + 3, y + 1, 1, 1);
      ctx.fillRect(x + 7, y + 2, 1, 1);

      // Снежная шапка на кочке (4 слоя: от тени к яркому гребню).
      ctx.fillStyle = '#4B6278'; // Тень снизу
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#8AA5BF'; // Полутон
      ctx.beginPath();
      ctx.ellipse(x, y - 3, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#CDE0EF'; // Светлый слой
      ctx.beginPath();
      ctx.ellipse(x, y - 4, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF'; // Яркий гребень
      ctx.beginPath();
      ctx.ellipse(x, y - 5, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Детализация: зубчики листьев и кристаллы инея.
      if (zoom >= 1.25) {
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(x - 9, y - 1, 1, 1);
        ctx.fillRect(x + 8, y, 1, 1);
        if (zoom >= 1.7) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(x - 5, y - 4, 1, 1);
          ctx.fillRect(x + 4, y - 4, 1, 1);
        }
      }
    } else if (tree === 'DEAD_TREE') {
      // Сухое мёртвое дерево (коряга).
      ctx.fillStyle = 'rgba(28, 42, 60, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x + 1, y + 7, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#241B15';
      ctx.fillRect(x - 2, y - 14, 4, 21);
      ctx.fillStyle = '#3D2F25';
      ctx.fillRect(x - 1, y - 12, 2, 18);

      ctx.strokeStyle = '#241B15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x - 8, y - 16);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 7, y - 12);
      ctx.stroke();

      // Снег на верхушке.
      ctx.fillStyle = '#B4C8DC';
      ctx.fillRect(x - 3, y - 15, 6, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 2, y - 16, 4, 2);

      // Детализация: трещина в стволе и лишайник.
      if (zoom >= 1.25) {
        ctx.fillStyle = '#17100D';
        ctx.fillRect(x - 1, y - 7, 1, 9);
        ctx.fillStyle = '#8FA382';
        ctx.fillRect(x - 2, y, 1, 3);
      }
    } else if (tree === 'BUSH') {
      // Кочка с кустом: торчащие прутья ивы и снежная подушка.
      ctx.fillStyle = 'rgba(28, 42, 60, 0.32)';
      ctx.beginPath();
      ctx.ellipse(x, y + 5, 12, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#261A12';
      ctx.beginPath();
      ctx.ellipse(x, y + 3, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Тёмные прутья.
      ctx.strokeStyle = '#3E2A1C';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 2);
      ctx.lineTo(x - 9, y - 2);
      ctx.moveTo(x + 5, y + 2);
      ctx.lineTo(x + 8, y - 2);
      ctx.stroke();

      // Снежная подушка (4 слоя).
      ctx.fillStyle = '#4B6278';
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8AA5BF';
      ctx.beginPath();
      ctx.ellipse(x, y - 3.5, 8, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#CDE0EF';
      ctx.beginPath();
      ctx.ellipse(x, y - 4.5, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(x, y - 5.5, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Ель из готового пиксельного спрайта (см. SpruceSprite.ts). Варианты: гигантская ель, ель A и ель B.
  // Спрайт ставится так, чтобы его «якорь» (основание ствола) был на 8 px ниже центра клетки.
  private drawReferenceSpruce(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    c: number,
    r: number,
    sway: number,
    hasFireGlow: boolean,
    fireIntensity: number,
    fireDir: number,
    zoom: number = 1.0,
    isGiant: boolean = false
  ) {
    const sprites = getSpruceSprites();
    // Выбор A/B по номеру клетки — детерминированно: у клетки всегда один и тот же вариант (≈ половина елей — B).
    const isVariantB = !isGiant && (c * 19 + r * 37) % 2 === 1;
    const spriteDef = isGiant
      ? sprites.giantSpruce
      : isVariantB
      ? sprites.spruceB
      : sprites.spruceA;

    const sprite = spriteDef.canvas;
    const anchorX = spriteDef.anchorX;
    const anchorY = spriteDef.anchorY;

    // Левый верхний угол спрайта, округлённый до целого пикселя (иначе появится размытие).
    const drawX = Math.round(x - anchorX);
    const drawY = Math.round(y + 8 - anchorY);

    ctx.save();
    // Отключаем сглаживание — пиксель-арт остаётся чётким.
    ctx.imageSmoothingEnabled = false;

    // Качается только крона, целыми пикселями (как в старых играх): сдвиг = 70% от sway, округлённый.
    const pixelSway = Math.round(sway * 0.7);

    if (pixelSway !== 0) {
      // Нижняя часть (ствол) неподвижна: всё ниже строки splitY (22 px от верха спрайта, у гигантской ели 28).
      const splitY = isGiant ? 28 : 22;
      ctx.drawImage(
        sprite,
        0, splitY, sprite.width, sprite.height - splitY,
        drawX, drawY + splitY, sprite.width, sprite.height - splitY
      );
      // Верхняя часть (крона) сдвинута на pixelSway.
      ctx.drawImage(
        sprite,
        0, 0, sprite.width, splitY,
        drawX + pixelSway, drawY, sprite.width, splitY
      );
    } else {
      ctx.drawImage(sprite, drawX, drawY);
    }

    // Тёплый отсвет костра на стороне дерева, обращённой к огню: оранжевая полоса, прозрачность до 0.35.
    if (hasFireGlow) {
      const glowAlpha = Math.min(0.35, fireIntensity * 0.4);
      ctx.fillStyle = `rgba(245, 158, 11, ${glowAlpha})`;
      const glowW = isGiant ? 10 : 8;
      const glowX = fireDir === 1 ? drawX + 4 : drawX + sprite.width - 4 - glowW;
      ctx.fillRect(glowX, drawY + (isGiant ? 22 : 18), glowW, isGiant ? 28 : 20);
    }

    // При сильном приближении (zoom ≥ 1.5) — искорка инея на макушке.
    if (zoom >= 1.5) {
      ctx.fillStyle = '#FFFFFF';
      const tipX = drawX + anchorX + pixelSway;
      const tipY = drawY + 2;
      ctx.fillRect(tipX, tipY, 1, 1);
    }

    ctx.restore();
  }

  // Станции — постоянные домики-узлы из списка STATIONS (utils/constants). Каждая рисуется картинкой,
  // плюс мигающий маяк на антенне, голубой луч, если станция подключена к сети, и табличка с позывным.
  // Станции дальше 120 px за краем экрана пропускаются.
  private drawStations(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    width: number,
    height: number,
    time: number,
    zoom: number = 1.0
  ) {
    // Картинка домика structures/station_cabin.png размером 96×128 px; точка привязки — середина
    // нижнего края картинки (sx, sy). Кончик антенны находится на (-27, -120) px от этой точки —
    // туда ставим маяк и луч.
    const cabinImg = this.getTileImage('structures/station_cabin.png');
    const CABIN_W = 96;
    const CABIN_H = 128;
    const ANTENNA_OFFSET_X = -27;
    const ANTENNA_OFFSET_Y = -120;

    STATIONS.forEach(st => {
      const sx = st.x * TILE_SIZE - cameraX;
      const sy = st.y * TILE_SIZE - cameraY;
      if (sx < -120 || sx > width + 120 || sy < -120 || sy > height + 120) return;

      ctx.save();
      // Мягкая тень под домиком: круглый градиент, сплющенный по вертикали (в 7/30 раза) в овал.
      // Резкая заливка выглядела бы как яма в настиле, а не как тень от домика.
      ctx.save();
      ctx.translate(sx, sy + 4);
      ctx.scale(1, 7 / 30);
      const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
      shadowGrad.addColorStop(0, 'rgba(10, 14, 20, 0.38)');
      shadowGrad.addColorStop(0.7, 'rgba(10, 14, 20, 0.18)');
      shadowGrad.addColorStop(1, 'rgba(10, 14, 20, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (cabinImg.complete && cabinImg.naturalWidth > 0) {
        ctx.drawImage(cabinImg, sx - CABIN_W / 2, sy - CABIN_H, CABIN_W, CABIN_H);
      } else {
        // Пока картинка грузится — простой прямоугольник-заглушка.
        ctx.fillStyle = '#2B394A';
        ctx.fillRect(sx - 30, sy - 50, 60, 40);
      }

      // Красный маяк на антенне мигает: цикл ≈ 0,9 с (sin(time * 0.007)), горит чуть меньше половины времени.
      const beaconX = sx + ANTENNA_OFFSET_X;
      const beaconY = sy + ANTENNA_OFFSET_Y;
      const blink = Math.sin(time * 0.007) > 0.1;
      ctx.fillStyle = blink ? '#EF4444' : '#581C1C';
      ctx.beginPath();
      ctx.arc(beaconX, beaconY, 2, 0, Math.PI * 2);
      ctx.fill();

      // Голубой луч вверх на 120 px — станция подключена к сети.
      if (st.connected) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(beaconX, beaconY);
        ctx.lineTo(beaconX, beaconY - 120);
        ctx.stroke();
      }

      // Табличка с позывным станции под домиком.
      ctx.fillStyle = '#0B111A';
      ctx.fillRect(sx - 34, sy + 10, 68, 14);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 34, sy + 10, 68, 14);
      ctx.fillStyle = '#E0F2FE';
      ctx.font = 'bold 9px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(st.callsign, sx, sy + 20);

      // При zoom ≥ 1.25 — надпись-трафарет у верха домика.
      if (zoom >= 1.25) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = '7px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ГОСТ-СЕВЕР [УЗЕЛ]', sx, sy - CABIN_H + 14);
      }

      ctx.restore();
    });
  }

  // Постройки, которые ставит игрок: лестница, верёвка, костёр, маяк, укрытие, фальшфейер.
  // Числа в fillRect/moveTo — смещения в пикселях от точки постройки при zoom 1.
  // Здесь нет проверки «за экраном» — рисуются все постройки.
  private drawStructures(
    ctx: CanvasRenderingContext2D,
    structures: PlacedStructure[],
    cameraX: number,
    cameraY: number,
    time: number,
    zoom: number = 1.0
  ) {
    structures.forEach(struct => {
      const sx = struct.x * TILE_SIZE - cameraX;
      const sy = struct.y * TILE_SIZE - cameraY;

      ctx.save();
      if (struct.type === 'LADDER') {
        // Лестница: оранжевые стойки и перекладины каждые 7 px.
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx - 6, sy - 18);
        ctx.lineTo(sx - 6, sy + 18);
        ctx.moveTo(sx + 6, sy - 18);
        ctx.lineTo(sx + 6, sy + 18);
        ctx.stroke();

        ctx.lineWidth = 2;
        for (let step = -14; step <= 14; step += 7) {
          ctx.beginPath();
          ctx.moveTo(sx - 6, sy + step);
          ctx.lineTo(sx + 6, sy + step);
          ctx.stroke();
        }
      } else if (struct.type === 'ROPE') {
        // Верёвка: крюк и свисающий жёлтый трос.
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(sx, sy - 12, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#EAB308';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 12);
        ctx.lineTo(sx, sy + 22);
        ctx.stroke();
      } else if (struct.type === 'CAMPFIRE') {
        // Костёр: кольцо камней, угли, дрова, анимированное пламя, искры и тёплое свечение.
        ctx.fillStyle = '#22303E';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 3, 13, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#18232E';
        ctx.fillRect(sx - 10, sy + 2, 4, 3);
        ctx.fillRect(sx + 6, sy + 2, 4, 3);
        ctx.fillRect(sx - 5, sy + 6, 4, 3);
        ctx.fillRect(sx + 2, sy + 6, 4, 3);
        ctx.fillRect(sx - 4, sy - 2, 4, 3);
        ctx.fillRect(sx + 2, sy - 2, 4, 3);
        ctx.fillStyle = '#475569';
        ctx.fillRect(sx - 9, sy + 2, 2, 1);
        ctx.fillRect(sx + 7, sy + 2, 2, 1);

        // Тлеющие угли.
        ctx.fillStyle = '#7C2D12';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2, 7, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(sx - 3, sy + 1, 3, 2);
        ctx.fillRect(sx + 1, sy + 2, 3, 2);

        // Скрещенные поленья.
        ctx.fillStyle = '#26150F';
        ctx.fillRect(sx - 7, sy, 14, 3);
        ctx.fillRect(sx - 3, sy - 3, 5, 9);
        ctx.fillStyle = '#451A03';
        ctx.fillRect(sx - 6, sy + 1, 12, 1);

        // Пламя. flicker — качание верхушки влево-вправо ±2 px, цикл ≈ 0,3 с; flameHeight — высота 11±4 px,
        // цикл ≈ 0,4 с. Скорости разные, чтобы огонь не выглядел механическим.
        const flicker = Math.sin(time * 0.02) * 2;
        const flameHeight = 11 + Math.sin(time * 0.015) * 4;

        // Внешний оранжево-красный язык.
        ctx.fillStyle = '#EA580C';
        ctx.beginPath();
        ctx.moveTo(sx - 6, sy + 2);
        ctx.lineTo(sx + 6, sy + 2);
        ctx.lineTo(sx + flicker, sy - flameHeight);
        ctx.closePath();
        ctx.fill();

        // Второй язык пламени.
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy + 1);
        ctx.lineTo(sx + 2, sy + 1);
        ctx.lineTo(sx - 2 + flicker * 0.5, sy - flameHeight * 0.85);
        ctx.closePath();
        ctx.fill();

        // Внутренний жёлтый язык.
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy + 1);
        ctx.lineTo(sx + 4, sy + 1);
        ctx.lineTo(sx + flicker * 0.7, sy - flameHeight * 0.7);
        ctx.closePath();
        ctx.fill();

        // Раскалённая сердцевина.
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(sx - 2, sy);
        ctx.lineTo(sx + 2, sy);
        ctx.lineTo(sx + flicker * 0.3, sy - flameHeight * 0.4);
        ctx.closePath();
        ctx.fill();

        // 5 искр поднимаются на 32 px и гаснут. Одна искра пролетает путь за ≈ 0,55 с (time * 0.0018),
        // искры сдвинуты по фазе (i * 0.22), чтобы летели не одновременно.
        for (let i = 0; i < 5; i++) {
          const sparkTime = (time * 0.0018 + i * 0.22) % 1.0;
          const sparkY = sy - 2 - sparkTime * 32;
          const sparkX = sx + Math.sin(time * 0.005 + i * 2.1) * (3 + sparkTime * 10) + (sparkTime * 5);
          const sparkAlpha = Math.max(0, 1 - sparkTime);
          ctx.fillStyle = i % 2 === 0 ? `rgba(254, 240, 138, ${sparkAlpha})` : `rgba(249, 115, 22, ${sparkAlpha})`;
          ctx.fillRect(sparkX, sparkY, 1.5, 1.5);
        }

        // Тёплое свечение вокруг костра: радиус 65±6 px, пульсирует с циклом ≈ 0,6 с.
        const glowRad = 65 + Math.sin(time * 0.01) * 6;
        const grad = ctx.createRadialGradient(sx, sy, 3, sx, sy, glowRad);
        grad.addColorStop(0, 'rgba(251, 146, 60, 0.55)');
        grad.addColorStop(0.35, 'rgba(245, 158, 11, 0.25)');
        grad.addColorStop(0.75, 'rgba(234, 88, 12, 0.08)');
        grad.addColorStop(1, 'rgba(234, 88, 12, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, glowRad, 0, Math.PI * 2);
        ctx.fill();

        // Детализация: дополнительные угли; при zoom ≥ 1.7 — перекладина с котелком и пар.
        if (zoom >= 1.25) {
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(sx - 4, sy + 1, 2, 2);
          ctx.fillRect(sx + 3, sy, 2, 2);
          ctx.fillStyle = '#FEF08A';
          ctx.fillRect(sx - 1, sy + 1, 1, 1);

          if (zoom >= 1.7) {
            // Железная перекладина.
            ctx.strokeStyle = '#18181B';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx - 8, sy - 8);
            ctx.lineTo(sx + 8, sy - 8);
            ctx.moveTo(sx, sy - 8);
            ctx.lineTo(sx, sy - 4);
            ctx.stroke();

            // Котелок.
            ctx.fillStyle = '#09090B';
            ctx.fillRect(sx - 3, sy - 4, 6, 4);
            ctx.fillStyle = '#27272A';
            ctx.fillRect(sx - 2, sy - 5, 4, 1);

            // Струйка пара: цикл ≈ 0,33 с — поднимается и растворяется.
            const steamPhase = (time * 0.003) % 1;
            ctx.fillStyle = `rgba(241, 245, 249, ${Math.max(0, 0.5 - steamPhase * 0.5)})`;
            ctx.fillRect(sx + 3 + steamPhase * 2, sy - 6 - steamPhase * 5, 2, 2);
          }
        }
      } else if (struct.type === 'BEACON') {
        // Маяк игрока: голубой столбик со знаком «!» — метка опасного места.
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(sx - 1, sy - 14, 2, 18);
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(sx, sy - 16, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', sx, sy - 13);
      } else if (struct.type === 'SHELTER') {
        // Укрытие: деревянный каркас с зелёным брезентом.
        ctx.fillStyle = '#3E2723';
        ctx.beginPath();
        ctx.moveTo(sx - 20, sy + 10);
        ctx.lineTo(sx, sy - 16);
        ctx.lineTo(sx + 20, sy + 10);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#4E342E';
        ctx.stroke();

        // Брезентовый навес.
        ctx.fillStyle = '#1B4332';
        ctx.beginPath();
        ctx.moveTo(sx - 18, sy + 8);
        ctx.lineTo(sx, sy - 14);
        ctx.lineTo(sx + 18, sy + 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2D6A4F';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Тёплый свет печки внутри: радиус 30±4 px, цикл ≈ 0,6 с.
        const stoveGlow = 30 + Math.sin(time * 0.01) * 4;
        const stoveGrad = ctx.createRadialGradient(sx, sy + 2, 2, sx, sy + 2, stoveGlow);
        stoveGrad.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
        stoveGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = stoveGrad;
        ctx.beginPath();
        ctx.arc(sx, sy + 2, stoveGlow, 0, Math.PI * 2);
        ctx.fill();

        // Зелёный пунктирный круг радиусом 40 px (≈ 1,25 клетки) — подсказка зоны защиты от ветра и холода.
        // Это только рисунок: само тепло укрытия считается в playerPhysics.ts (радиус 3.5 клетки,
        // то есть больше нарисованного круга 40 px ≈ 1.25 клетки).
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sx, sy, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (struct.type === 'FLARE') {
        // Фальшфейер: яркий красный огонь, отпугивающий призраков.
        ctx.fillStyle = '#7F1D1D';
        ctx.fillRect(sx - 2, sy - 6, 4, 10);

        // Пламя пульсирует ±3 px очень быстро (цикл ≈ 0,2 с).
        const flarePulse = Math.sin(time * 0.03) * 3;
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(sx, sy - 7, 5 + flarePulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(sx, sy - 7, 2, 0, Math.PI * 2);
        ctx.fill();

        // Красное свечение радиусом 65±6 px (цикл ≈ 0,4 с) — видимая зона, которую обходят призраки.
        // Само отпугивание Теней считается в anomalyAI.ts (радиус 5.5 клетки).
        const flareRad = 65 + Math.sin(time * 0.015) * 6;
        const fGrad = ctx.createRadialGradient(sx, sy - 7, 4, sx, sy - 7, flareRad);
        fGrad.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
        fGrad.addColorStop(0.7, 'rgba(239, 68, 68, 0.15)');
        fGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = fGrad;
        ctx.beginPath();
        ctx.arc(sx, sy - 7, flareRad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  // Потерянный груз (тайник): оранжевый кейс и голубой луч над ним, чтобы его было видно издалека.
  // x, y — центр кейса в пикселях; числа в fillRect — смещения от этой точки при zoom 1.
  private drawLostContainer(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, zoom: number = 1.0) {
    ctx.save();
    // Металлический кейс 14×10 px.
    ctx.fillStyle = '#D97706';
    ctx.fillRect(x - 7, y - 5, 14, 10);
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 7, y - 5, 14, 10);

    // Луч мерцает: прозрачность от 0.1 до 0.5, цикл ≈ 1,3 с.
    const beamAlpha = 0.3 + Math.sin(time * 0.005) * 0.2;
    ctx.fillStyle = `rgba(56, 189, 248, ${beamAlpha})`;
    ctx.fillRect(x - 1, y - 40, 2, 35);

    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(x - 2, y - 42, 4, 4);

    // Детализация: резиновые уголки и защёлка; при zoom ≥ 1.7 — зелёный светодиод.
    if (zoom >= 1.25) {
      // Резиновые уголки.
      ctx.fillStyle = '#18181B';
      ctx.fillRect(x - 7, y - 5, 2, 2);
      ctx.fillRect(x + 5, y - 5, 2, 2);
      ctx.fillRect(x - 7, y + 3, 2, 2);
      ctx.fillRect(x + 5, y + 3, 2, 2);

      // Защёлка.
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(x - 1, y - 1, 2, 3);

      if (zoom >= 1.7) {
        // Зелёный светодиод батареи.
        ctx.fillStyle = '#10B981';
        ctx.fillRect(x + 3, y - 3, 1, 1);
      }
    }

    ctx.restore();
  }

  // Ресурсы для сбора. Уже собранные и те, что дальше 60 px за краем экрана, пропускаются.
  // Каждый тип — маленький спрайт; числа в fillRect — смещения в пикселях от точки ресурса при zoom 1.
  // Например, fillRect(sx - 9, sy - 3, 18, 6) — прямоугольник 18×6 px с центром в точке ресурса.
  private drawResourceNodes(
    ctx: CanvasRenderingContext2D,
    nodes: WorldResourceNode[],
    cameraX: number,
    cameraY: number,
    time: number,
    player: PlayerStats,
    zoom: number = 1.0
  ) {
    ctx.save();
    for (const node of nodes) {
      if (node.harvested) continue;
      const sx = node.x * TILE_SIZE - cameraX;
      const sy = node.y * TILE_SIZE - cameraY;
      if (!this.isOnScreen(sx, sy, 60)) continue; // за экраном — не рисуем
      // Расстояние до курьера — в клетках (координаты ресурсов и игрока хранятся в клетках).
      const distToPlayer = Math.hypot(node.x - player.x, node.y - player.y);

      // Спрайт по типу ресурса.
      if (node.type === 'WOOD_PINE') {
        // Брёвна: штабель из двух брёвен под снегом.
        // Нижнее бревно.
        ctx.fillStyle = '#26160F';
        ctx.fillRect(sx - 9, sy - 3, 18, 6);
        ctx.fillStyle = '#3E2519';
        ctx.fillRect(sx - 8, sy - 2, 14, 4);
        // Срез с годовыми кольцами.
        ctx.fillStyle = '#A88365';
        ctx.fillRect(sx + 5, sy - 3, 4, 6);
        ctx.fillStyle = '#6E4E36';
        ctx.fillRect(sx + 6, sy - 2, 2, 4);

        // Верхнее бревно.
        ctx.fillStyle = '#26160F';
        ctx.fillRect(sx - 7, sy - 8, 14, 6);
        ctx.fillStyle = '#4A2C1E';
        ctx.fillRect(sx - 6, sy - 7, 10, 4);
        ctx.fillStyle = '#A88365';
        ctx.fillRect(sx + 3, sy - 8, 4, 6);
        ctx.fillStyle = '#6E4E36';
        ctx.fillRect(sx + 4, sy - 7, 2, 4);

        // Снег на брёвнах.
        ctx.fillStyle = '#DDE8F2';
        ctx.fillRect(sx - 7, sy - 9, 10, 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx - 5, sy - 10, 6, 1);
      } else if (node.type === 'CHAGA_HERB') {
        // Чага: берёзовый пенёк с тёмным грибом и ягодами у основания.
        // Пенёк.
        ctx.fillStyle = '#F1F5F9';
        ctx.fillRect(sx - 5, sy - 8, 10, 11);
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(sx + 3, sy - 8, 2, 11);
        // Тёмные метки на бересте.
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(sx - 5, sy - 5, 3, 2);
        ctx.fillRect(sx - 2, sy - 1, 3, 2);

        // Гриб-чага.
        ctx.fillStyle = '#140D07';
        ctx.beginPath();
        ctx.arc(sx + 3, sy - 4, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5A3415';
        ctx.fillRect(sx + 2, sy - 5, 2, 2);

        // Ягоды у основания.
        ctx.fillStyle = '#E11D48';
        ctx.fillRect(sx - 8, sy + 1, 3, 3);
        ctx.fillRect(sx + 5, sy + 2, 3, 3);
        ctx.fillStyle = '#FDA4AF';
        ctx.fillRect(sx - 7, sy + 1, 1, 1);
      } else if (node.type === 'SCRAP_METAL') {
        // Металлолом: пластина с заклёпками, ржавчиной и инеем.
        ctx.fillStyle = '#2A3644';
        ctx.fillRect(sx - 8, sy - 7, 16, 10);
        ctx.fillStyle = '#4A5B6E';
        ctx.fillRect(sx - 7, sy - 6, 14, 8);
        // Ржавчина.
        ctx.fillStyle = '#9A3412';
        ctx.fillRect(sx - 4, sy - 4, 6, 3);
        ctx.fillStyle = '#EA580C';
        ctx.fillRect(sx - 3, sy - 3, 3, 1);
        // Заклёпки.
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(sx - 6, sy - 5, 1, 1);
        ctx.fillRect(sx + 5, sy - 5, 1, 1);
        ctx.fillRect(sx - 6, sy, 1, 1);
        ctx.fillRect(sx + 5, sy, 1, 1);
        // Иней на краю.
        ctx.fillStyle = 'rgba(241, 245, 249, 0.75)';
        ctx.fillRect(sx - 8, sy - 7, 16, 1);
      } else if (node.type === 'CHIRAL_RESIN') {
        // Хиральная смола: светящийся кристалл (голубой с фиолетовым); свечение пульсирует ±3 px, цикл ≈ 0,8 с.
        const glow = Math.sin(time * 0.008) * 3;
        const crystalGrad = ctx.createRadialGradient(sx, sy - 2, 2, sx, sy - 2, 15 + glow);
        crystalGrad.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
        crystalGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.35)');
        crystalGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = crystalGrad;
        ctx.beginPath();
        ctx.arc(sx, sy - 2, 15 + glow, 0, Math.PI * 2);
        ctx.fill();

        // Грани кристалла.
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.moveTo(sx - 1, sy - 14);
        ctx.lineTo(sx + 5, sy + 1);
        ctx.lineTo(sx - 6, sy + 1);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(sx - 1, sy - 14);
        ctx.lineTo(sx + 3, sy);
        ctx.lineTo(sx - 2, sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#C084FC';
        ctx.beginPath();
        ctx.moveTo(sx + 5, sy - 10);
        ctx.lineTo(sx + 9, sy + 2);
        ctx.lineTo(sx + 2, sy + 2);
        ctx.closePath();
        ctx.fill();

        // Блик.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx - 1, sy - 14, 2, 2);
      } else if (node.type === 'COPPER_WIRE') {
        // Медная проволока: катушка.
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(sx - 6, sy - 6, 12, 10);
        ctx.fillStyle = '#B45309';
        ctx.fillRect(sx - 4, sy - 5, 8, 8);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(sx - 3, sy - 4, 6, 6);
        ctx.fillStyle = '#FDE68A';
        ctx.fillRect(sx - 1, sy - 3, 2, 4);
      } else if (node.type === 'TAIGA_FUR') {
        // Мех: свёрток шкуры, перевязанный ремнём.
        ctx.fillStyle = '#451A03';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 2, 8, 5, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9A3412';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 3, 6, 4, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.ellipse(sx, sy - 3, 3, 2, 0.15, 0, Math.PI * 2);
        ctx.fill();
        // Кожаный ремень.
        ctx.fillStyle = '#1C1917';
        ctx.fillRect(sx - 1, sy - 7, 2, 10);
      } else if (node.type === 'PARAFFIN_WAX') {
        // Парафин: канистра.
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(sx - 5, sy - 8, 10, 10);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(sx - 4, sy - 7, 8, 8);
        // Жёлтая предупреждающая полоса.
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(sx - 4, sy - 4, 8, 2);
        // Латунная крышка.
        ctx.fillStyle = '#B45309';
        ctx.fillRect(sx - 2, sy - 10, 4, 2);
      }

      // Подсветка: курьер ближе 2,5 клетки — жёлтое кольцо и подсказка «[F] название» (можно собрать);
      // включён сканер — голубое кольцо (ресурс найден сканером).
      const isClose = distToPlayer < 2.5;
      const isScanned = player.scannerActive;

      if (isClose || isScanned) {
        // Кольцо вокруг ресурса (радиус 11 px).
        ctx.strokeStyle = isClose ? '#F59E0B' : '#38BDF8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy - 2, 11, 0, Math.PI * 2);
        ctx.stroke();

        // Табличка с клавишей сбора и первым словом названия ресурса.
        if (isClose) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(sx - 36, sy - 26, 72, 14);
          ctx.strokeStyle = '#F59E0B';
          ctx.strokeRect(sx - 36, sy - 26, 72, 14);
          ctx.fillStyle = '#FEF08A';
          ctx.font = '9px "Share Tech Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`[F] ${node.name.split(' ')[0]}`, sx, sy - 16);
        }
      }
    }
    ctx.restore();
  }

  // Персонажи мира (Тарас, Степан, Улукиткан, Вера): человечек в парке и ушанке, пар изо рта,
  // табличка с именем и подсказка «[E] ПОГОВОРИТЬ», когда курьер рядом. Пропускаются, если дальше
  // 80 px за краем экрана. Числа в fillRect — смещения в пикселях от точки персонажа (у ног) при zoom 1.
  private drawWorldNPCs(
    ctx: CanvasRenderingContext2D,
    npcs: WorldNPC[],
    cameraX: number,
    cameraY: number,
    time: number,
    player: PlayerStats,
    zoom: number = 1.0
  ) {
    ctx.save();
    for (const npc of npcs) {
      const sx = npc.x * TILE_SIZE - cameraX;
      const sy = npc.y * TILE_SIZE - cameraY;
      if (!this.isOnScreen(sx, sy, 80)) continue; // за экраном — не рисуем
      // Расстояние до курьера — в клетках.
      const distToPlayer = Math.hypot(npc.x - player.x, npc.y - player.y);

      // Пиксельный спрайт персонажа.
      // Тень.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 6, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Тело (парка). У каждого свой цвет, чтобы их различать: Тарас — коричневый, Степан — синий,
      // Улукиткан — фиолетовый, остальные (Вера) — зелёный.
      ctx.fillStyle = npc.id === 'npc_taras' ? '#3B2F2F' : npc.id === 'npc_stepan' ? '#1E3A8A' : npc.id === 'npc_ulukitkan' ? '#5B21B6' : '#047857';
      ctx.fillRect(sx - 6, sy - 14, 12, 14);

      // Меховая опушка.
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(sx - 7, sy - 15, 14, 3);
      ctx.fillRect(sx - 6, sy - 1, 12, 2);

      // Голова и ушанка.
      ctx.fillStyle = '#FED7AA'; // лицо
      ctx.fillRect(sx - 4, sy - 22, 8, 7);

      ctx.fillStyle = '#1C1917'; // меховая шапка-ушанка
      ctx.fillRect(sx - 6, sy - 27, 12, 6);
      ctx.fillRect(sx - 7, sy - 24, 3, 6);
      ctx.fillRect(sx + 4, sy - 24, 3, 6);

      // Глаза.
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(sx - 2, sy - 19, 1, 2);
      ctx.fillRect(sx + 1, sy - 19, 1, 2);

      // Детализация при zoom ≥ 1.25.
      if (zoom >= 1.25) {
        // Красная звёздочка на ушанке.
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(sx - 1, sy - 25, 2, 2);

        // Щетина у Тараса и Степана, красный шарф у остальных.
        if (npc.id === 'npc_taras' || npc.id === 'npc_stepan') {
          ctx.fillStyle = '#78716C';
          ctx.fillRect(sx - 3, sy - 16, 6, 2);
        } else {
          ctx.fillStyle = '#DC2626'; // Красный шарф
          ctx.fillRect(sx - 4, sy - 16, 8, 2);
        }

        // Латунные пуговицы.
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(sx - 1, sy - 11, 2, 2);
        ctx.fillRect(sx - 1, sy - 6, 2, 2);

        if (zoom >= 1.7) {
          // Очки, сдвинутые на лоб (zoom ≥ 1.7).
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(sx - 3, sy - 23, 6, 1);
        }
      }

      // Пар изо рта: цикл 1,5 с, облачко видно первые ≈ 0,7 с — растёт и тает.
      // Добавка (npc.x % 5) сдвигает фазу, чтобы персонажи дышали не одновременно.
      const breathPhase = (time * 0.002 + (npc.x % 5)) % 3;
      if (breathPhase < 1.4) {
        const bAlpha = Math.max(0, 0.5 - breathPhase * 0.3);
        ctx.fillStyle = `rgba(241, 245, 249, ${bAlpha})`;
        ctx.beginPath();
        ctx.arc(sx + 2 + breathPhase * 4, sy - 20 - breathPhase * 3, 2 + breathPhase * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Табличка со значком-портретом и именем над головой.
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(sx - 45, sy - 42, 90, 13);
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 45, sy - 42, 90, 13);
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 9px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${npc.portrait} ${npc.name}`, sx, sy - 33);

      // Курьер ближе 3,2 клетки — жёлтая подсказка «[E] ПОГОВОРИТЬ», покачивается ±2 px (цикл ≈ 0,6 с).
      if (distToPlayer < 3.2) {
        const pulse = Math.sin(time * 0.01) * 2;
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(sx - 38, sy - 60 + pulse, 76, 14);
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 9px "Share Tech Mono", monospace';
        ctx.fillText('[E] ПОГОВОРИТЬ', sx, sy - 50 + pulse);
      }
    }
    ctx.restore();
  }

  // Маяк цели активного задания: жёлтый столб света высотой 160 px, расходящиеся круги на земле,
  // парящий ромб и название задания. Жёлтый здесь означает «цель задания». Рисуется, только если задание есть.
  private drawQuestObjective(
    ctx: CanvasRenderingContext2D,
    target: { x: number; y: number; title: string } | null,
    cameraX: number,
    cameraY: number,
    time: number
  ) {
    if (!target) return;
    const sx = target.x * TILE_SIZE - cameraX;
    const sy = target.y * TILE_SIZE - cameraY;

    ctx.save();
    // Вертикальный столб света, к верху прозрачнее.
    const beamGrad = ctx.createLinearGradient(sx, sy, sx, sy - 160);
    beamGrad.addColorStop(0, 'rgba(234, 179, 8, 0.7)');
    beamGrad.addColorStop(0.7, 'rgba(234, 179, 8, 0.2)');
    beamGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(sx - 3, sy - 160, 6, 160);

    // Круг-«радар» на земле: растёт от 0 до 40 px за ≈ 1,3 с (30 px в секунду) и тает, потом заново.
    // Сплющен вдвое по вертикали — выглядит лежащим на земле.
    const ringRad = ((time * 0.03) % 40);
    ctx.strokeStyle = `rgba(234, 179, 8, ${Math.max(0, 1 - ringRad / 40)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sx, sy, ringRad, ringRad * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Ромб парит над целью: ±4 px, цикл ≈ 1 с.
    const diamondY = sy - 45 + Math.sin(time * 0.006) * 4;
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(sx, diamondY - 8);
    ctx.lineTo(sx + 7, diamondY);
    ctx.lineTo(sx, diamondY + 8);
    ctx.lineTo(sx - 7, diamondY);
    ctx.closePath();
    ctx.fill();

    // Название задания над ромбом.
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(sx - 50, diamondY - 24, 100, 13);
    ctx.strokeStyle = '#F59E0B';
    ctx.strokeRect(sx - 50, diamondY - 24, 100, 13);
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 9px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(target.title, sx, diamondY - 14);

    ctx.restore();
  }

  // Аномалии, три вида: FROST_PHANTOM — провал в мерзлоте с чёрными обелисками и призраком над ним;
  // GRAVITY_VORTEX — вращающийся фиолетовый вихрь; STATIC_DISCHARGE — короткие вспышки голубых молний.
  // x, y — точка аномалии в пикселях; числа в fillRect/ellipse — смещения частей от неё при zoom 1.
  private drawAnomaly(
    ctx: CanvasRenderingContext2D,
    anom: AnomalyEntity,
    x: number,
    y: number,
    time: number,
    player: PlayerStats,
    zoom: number = 1.0
  ) {
    ctx.save();

    if (anom.type === 'FROST_PHANTOM') {
      // Расстояние до курьера в пикселях (32 px на клетку). Призрак виден, если курьер ближе 100 px
      // (≈ 3 клетки), включён сканер или подозрительность призрака (suspicion) выше 30.
      const dist = Math.hypot((anom.x - player.x) * TILE_SIZE, (anom.y - player.y) * TILE_SIZE);
      const isVisible = dist < 100 || player.scannerActive || anom.suspicion > 30;

      // Провал в мерзлоте и обелиски — видны всегда.
      // Тёмная впадина в земле.
      ctx.fillStyle = 'rgba(15, 23, 34, 0.45)';
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Кольца трещин вокруг провала.
      ctx.strokeStyle = '#9DB2A6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 24, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(x, y + 14, 16, 7, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Чёрная сердцевина.
      ctx.fillStyle = '#090A0D';
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 10, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Чёрные обелиски по краю провала.
      // Левый обелиск.
      ctx.fillStyle = '#101418';
      ctx.fillRect(x - 18, y - 2, 4, 14);
      ctx.fillStyle = '#222A32';
      ctx.fillRect(x - 17, y, 2, 12);
      ctx.fillStyle = '#6E8192'; // Светлая грань сверху
      ctx.fillRect(x - 18, y - 3, 4, 1);

      // Правый обелиск (выше).
      ctx.fillStyle = '#0D1114';
      ctx.fillRect(x + 15, y - 8, 5, 20);
      ctx.fillStyle = '#1E252C';
      ctx.fillRect(x + 16, y - 6, 3, 18);
      ctx.fillStyle = '#6E8192';
      ctx.fillRect(x + 15, y - 9, 5, 1);

      // Маленький обелиск сзади по центру.
      ctx.fillStyle = '#13171C';
      ctx.fillRect(x - 4, y + 2, 3, 10);
      ctx.fillStyle = '#738698';
      ctx.fillRect(x - 4, y + 1, 3, 1);

      // Детализация: голубые руны-трещины на обелисках.
      if (zoom >= 1.25) {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(x - 17, y + 2, 1, 3);
        ctx.fillRect(x + 17, y - 2, 1, 4);
        ctx.fillRect(x + 18, y + 5, 1, 3);

        if (zoom >= 1.7) {
          // При zoom ≥ 1.7 — обломки, всплывающие из провала: подъём за 0,5 с, покачивание ±4 px (цикл ≈ 2,1 с).
          const debPhase = (time * 0.002) % 1;
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(x - 12 + Math.sin(time * 0.003) * 4, y + 10 - debPhase * 16, 2, 2);
          ctx.fillRect(x + 10 + Math.cos(time * 0.003) * 4, y + 8 - debPhase * 14, 2, 2);
        }
      }

      // Сам призрак (только если виден). floatY — парение вверх-вниз ±4 px, цикл ≈ 2,1 с
      // (pulseTimer сдвигает фазу у каждого призрака). alpha — непрозрачность: полная ближе 50 px,
      // дальше призрак бледнеет до минимума 0.25 (на 95 px и дальше).
      if (isVisible) {
        const floatY = y + Math.sin(time * 0.003 + anom.pulseTimer) * 4;
        const alpha = Math.min(1, Math.max(0.25, (110 - dist) / 60));

        // Тёмная нить, уходящая в небо (как в Death Stranding).
        ctx.strokeStyle = `rgba(15, 23, 42, ${alpha * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, floatY - 14);
        ctx.bezierCurveTo(x + 12, floatY - 50, x - 12, floatY - 90, x, floatY - 140);
        ctx.stroke();

        // Тёмный силуэт.
        ctx.fillStyle = `rgba(15, 23, 42, ${alpha * 0.9})`;
        // Голова.
        ctx.beginPath();
        ctx.arc(x, floatY - 12, 5, 0, Math.PI * 2);
        ctx.fill();

        // Тонкое тело.
        ctx.beginPath();
        ctx.moveTo(x - 4, floatY - 8);
        ctx.lineTo(x + 4, floatY - 8);
        ctx.lineTo(x + 2, floatY + 12);
        ctx.lineTo(x - 2, floatY + 12);
        ctx.closePath();
        ctx.fill();

        // Тёмные клочья тумана снизу.
        ctx.fillStyle = `rgba(2, 6, 23, ${alpha * 0.6})`;
        ctx.fillRect(x - 3, floatY + 12, 2, 4);
        ctx.fillRect(x + 1, floatY + 13, 2, 5);

        // Красные глаза — призрак насторожился (suspicion > 35): сигнал опасности.
        if (anom.suspicion > 35) {
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(x - 2, floatY - 13, 1, 1);
          ctx.fillRect(x + 1, floatY - 13, 1, 1);
        }
      }
    } else if (anom.type === 'GRAVITY_VORTEX') {
      // Вихрь: 4 фиолетовые дуги, вращается — полный оборот ≈ 1,6 с.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 0.004);
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `rgba(147, 51, 234, ${0.4 + i * 0.15})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10 + i * 7, i * 1.5, i * 1.5 + Math.PI * 0.8);
        ctx.stroke();
      }
      ctx.restore();
    } else if (anom.type === 'STATIC_DISCHARGE') {
      // Разряд: зигзаг-молния видна ≈ четверть времени (когда sin > 0.7), цикл ≈ 0,3 с — получаются короткие вспышки.
      if (Math.sin(time * 0.02 + anom.pulseTimer) > 0.7) {
        ctx.strokeStyle = '#60A5FA';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 10, y - 8);
        ctx.lineTo(x, y - 14);
        ctx.lineTo(x + 4, y - 2);
        ctx.lineTo(x + 12, y - 12);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Курьер (игрок): ноги и ботинки, оранжевая парка, капюшон с очками, сканер «Эхо-4» на плече,
  // груз на спине и руки на лямках. Всегда в центре экрана.
  // Координаты частей — смещения в пикселях от точки курьера при zoom 1 (после translate она = (0, 0)):
  // например, fillRect(-7, -10, 14, 14) — туловище 14×14 px, на 7 px левее и 10 px выше этой точки.
  private drawCourier(
    ctx: CanvasRenderingContext2D,
    player: PlayerStats,
    cargo: CargoItem[],
    x: number,
    y: number,
    time: number,
    anomalies: AnomalyEntity[],
    zoom: number = 1.0
  ) {
    ctx.save();

    // Шаги: если курьер движется, ноги ходят вперёд-назад, цикл ≈ 0,4 с (sin(time * 0.015)).
    // Скорость меньше 0.05 считаем стоянием.
    const speed = Math.hypot(player.vx, player.vy);
    const isMoving = speed > 0.05;
    const walkCycle = isMoving ? Math.sin(time * 0.015) : 0;

    // Наклон тела по равновесию: balance от -100 до 100 → поворот до 0.28 радиана (≈ 16°) в нужную сторону.
    const tiltRad = (player.balance / 100) * 0.28;

    // Тень под курьером.
    ctx.fillStyle = 'rgba(20, 32, 48, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Курьер спотыкается — случайная дрожь ±2 px по горизонтали и ±1 px по вертикали каждый кадр
    // (Math.random здесь намеренно: тряска должна быть хаотичной).
    const shakeX = player.isStumbling ? (Math.random() * 4 - 2) : 0;
    const shakeY = player.isStumbling ? (Math.random() * 2 - 1) : 0;

    ctx.translate(x + shakeX, y + shakeY);
    ctx.rotate(tiltRad);

    // 1. Ноги и ботинки. Штаны становятся тёмно-красными, если прочность ботинок ниже 20, —
    // сигнал, что ботинки почти сношены.
    ctx.fillStyle = player.bootsIntegrity < 20 ? '#7F1D1D' : '#1A232E'; // Тёмные штаны
    // Левая нога
    ctx.fillRect(-6, 3 + walkCycle * 3, 4, 8);
    // Правая нога
    ctx.fillRect(2, 3 - walkCycle * 3, 4, 8);

    // Утеплённые зимние ботинки.
    ctx.fillStyle = '#0F1620';
    ctx.fillRect(-7, 9 + walkCycle * 3, 6, 3);
    ctx.fillRect(1, 9 - walkCycle * 3, 6, 3);

    // Детализация: шипы-кошки на подошвах и светоотражающие полосы.
    if (zoom >= 1.25) {
      // Шипы под подошвами.
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-7, 12 + walkCycle * 3, 2, 1);
      ctx.fillRect(-3, 12 + walkCycle * 3, 2, 1);
      ctx.fillRect(1, 12 - walkCycle * 3, 2, 1);
      ctx.fillRect(5, 12 - walkCycle * 3, 2, 1);

      // Светоотражающие полосы на штанах.
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(-6, 6 + walkCycle * 3, 4, 1);
      ctx.fillRect(2, 6 - walkCycle * 3, 4, 1);
    }

    // 2. Туловище: парка янтарно-оранжевого цвета.
    // Основная часть парки.
    ctx.fillStyle = '#D98F18'; // Янтарно-охристый
    ctx.fillRect(-7, -10, 14, 14);
    // Теневая сторона парки.
    ctx.fillStyle = '#A86A0E';
    ctx.fillRect(-7, -10, 3, 14);
    // Молния и планка.
    ctx.fillStyle = '#1C1917';
    ctx.fillRect(-1, -10, 2, 14);

    // Детализация: карман с рацией, карабин, нашивка; при zoom ≥ 1.7 — бегунок молнии и стёжка.
    if (zoom >= 1.25) {
      // Нагрудный карман с рацией.
      ctx.fillStyle = '#92400E';
      ctx.fillRect(2, -7, 4, 5);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(4, -10, 1, 3); // Антенна рации

      // Карабин на обвязке.
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1;
      ctx.strokeRect(-5, 1, 3, 2);

      // Нашивка «СЕВЕР» на рукаве.
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(-8, -6, 2, 3);

      if (zoom >= 1.7) {
        // Латунный бегунок молнии.
        ctx.fillStyle = '#FCD34D';
        ctx.fillRect(-1, -4, 2, 2);
        // Стёжка пуховика.
        ctx.fillStyle = '#B45309';
        ctx.fillRect(-6, -2, 12, 1);
        ctx.fillRect(-6, -6, 12, 1);
      }
    }

    // Белый меховой воротник.
    ctx.fillStyle = '#CCD6E0'; // Тень под мехом
    ctx.fillRect(-8, -11, 16, 4);
    ctx.fillStyle = '#F8FAFC'; // Белый мех
    ctx.fillRect(-8, -13, 16, 3);

    // 3. Капюшон и защитные очки.
    ctx.fillStyle = '#B47312'; // Янтарный капюшон
    ctx.fillRect(-5, -20, 10, 8);
    ctx.fillStyle = '#F8FAFC'; // Белая опушка капюшона
    ctx.fillRect(-6, -21, 12, 2);

    // Очки от метели (янтарное стекло).
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-4, -17, 8, 3);
    ctx.fillStyle = '#FEF08A'; // Блик
    ctx.fillRect(-3, -17, 2, 1);

    if (zoom >= 1.25) {
      // Детализация: чёрный ремешок очков.
      ctx.fillStyle = '#09090B';
      ctx.fillRect(-6, -17, 2, 2);
      ctx.fillRect(4, -17, 2, 2);
    }

    // 4. Сканер «Эхо-4» на левом плече.
    this.drawScannerArm(ctx, player, -8, -14, time, anomalies, zoom);

    // 5. Стопка грузов на раме рюкзака.
    this.drawCargoStack(ctx, cargo, walkCycle, zoom);

    // 6. Лямки, за которые держатся руки.
    ctx.fillStyle = '#451A03';
    // Левая лямка
    ctx.fillRect(-7, -9, 2, 8);
    // Правая лямка
    ctx.fillRect(5, -9, 2, 8);

    // Перчатки. Голубая перчатка — курьер удерживает равновесие этой рукой; иначе цвет парки.
    ctx.fillStyle = player.isBracingLeft ? '#38BDF8' : '#D98F18';
    ctx.fillRect(-8, -3, 3, 4);
    ctx.fillStyle = player.isBracingRight ? '#38BDF8' : '#D98F18';
    ctx.fillRect(5, -3, 3, 4);

    // Пар изо рта (если курьер не задерживает дыхание): цикл ≈ 2,1 с, облачко видно ≈ 40% времени.
    if (!player.isHoldingBreath && Math.sin(time * 0.003) > 0.3) {
      ctx.fillStyle = 'rgba(241, 245, 249, 0.45)';
      ctx.beginPath();
      ctx.arc(6, -18, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Сканер «Эхо-4» на плече (как Одрадек из Death Stranding). Поворачивается к ближайшему призраку
  // и меняет цвет: голубой — призраков рядом нет, жёлтый — призрак ближе 180 px (≈ 5,6 клетки),
  // красный — ближе 70 px (≈ 2,2 клетки). Чем ближе опасность, тем быстрее машут лепестки.
  private drawScannerArm(
    ctx: CanvasRenderingContext2D,
    player: PlayerStats,
    baseX: number,
    baseY: number,
    time: number,
    anomalies: AnomalyEntity[],
    zoom: number = 1.0
  ) {
    ctx.save();
    // Ищем ближайшего призрака.
    let nearestPhantom: AnomalyEntity | null = null;
    let minDist = 180; // дальность обнаружения в пикселях (≈ 5,6 клетки)

    for (const anom of anomalies) {
      if (anom.type === 'FROST_PHANTOM') {
        const d = Math.hypot((anom.x - player.x) * TILE_SIZE, (anom.y - player.y) * TILE_SIZE);
        if (d < minDist) {
          minDist = d;
          nearestPhantom = anom;
        }
      }
    }

    // Шарнир.
    ctx.fillStyle = '#334155';
    ctx.fillRect(baseX - 1, baseY, 3, 4);

    // Направление и цвет датчика. По умолчанию смотрит вверх-вправо под 45°, голубой,
    // лепестки машут медленно (цикл ≈ 1,3 с).
    let sensorAngle = -Math.PI / 4;
    let sensorColor = '#38BDF8'; // Голубой — безопасно
    let flapSpeed = 0.005;

    if (nearestPhantom) {
      // Поворачиваем датчик к призраку. Ближе 70 px — красный, лепестки машут очень быстро
      // (цикл ≈ 0,16 с); иначе жёлтый (цикл ≈ 0,3 с).
      const dx = (nearestPhantom.x - player.x) * TILE_SIZE;
      const dy = (nearestPhantom.y - player.y) * TILE_SIZE;
      sensorAngle = Math.atan2(dy, dx);
      if (minDist < 70) {
        sensorColor = '#EF4444'; // Красный — опасность
        flapSpeed = 0.04;
      } else {
        sensorColor = '#F59E0B'; // Жёлтый — предупреждение
        flapSpeed = 0.02;
      }
    }

    // Штанга длиной 8 px.
    const armLen = 8;
    const endX = baseX + Math.cos(sensorAngle) * armLen;
    const endY = baseY + Math.sin(sensorAngle) * armLen;

    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Голова датчика: лепестки раскрываются и закрываются (flap).
    const flap = Math.sin(time * flapSpeed) * 0.4;
    ctx.fillStyle = sensorColor;

    ctx.save();
    ctx.translate(endX, endY);
    ctx.rotate(sensorAngle);

    // Центр.
    ctx.fillRect(-2, -2, 4, 4);

    // Верхний лепесток
    ctx.fillRect(2, -4 - flap * 3, 5, 2);
    // Нижний лепесток
    ctx.fillRect(2, 2 + flap * 3, 5, 2);

    // Детализация: хромированный шток и линза.
    if (zoom >= 1.25) {
      // Хромированный шток.
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(0, -1, 3, 2);
      // Линза датчика.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(1, -1, 1, 1);
    }

    ctx.restore();
    ctx.restore();
  }

  // Грузы на спине курьера: ящики стопкой, каждый следующий выше и на 1,5 px уже.
  // При ходьбе ящики слегка покачиваются (до 0,8 px). Координаты — пиксели относительно точки курьера.
  private drawCargoStack(ctx: CanvasRenderingContext2D, cargo: CargoItem[], walkCycle: number, zoom: number = 1.0) {
    if (cargo.length === 0) return;

    ctx.save();
    let currentY = -12;

    // Рисуем не больше 5 ящиков, даже если груза больше.
    const maxContainers = Math.min(5, cargo.length);
    for (let i = 0; i < maxContainers; i++) {
      const item = cargo[i];
      const boxHeight = 6;
      const boxWidth = 14 - i * 1.5;
      const boxX = -boxWidth / 2 + Math.sin(walkCycle * 0.5 + i) * 0.8;

      // Цвет ящика по категории груза: белый с красной лентой — медикаменты, жёлтый — радиолампы,
      // зелёный — изотопные батареи, оранжевый — пайки, синий — всё остальное.
      let boxColor = '#3B82F6';
      let tapeColor = '#1D4ED8';
      if (item.category === 'MEDICAL') {
        boxColor = '#FFFFFF';
        tapeColor = '#EF4444';
      } else if (item.category === 'RADIO_TUBES') {
        boxColor = '#F59E0B';
        tapeColor = '#B45309';
      } else if (item.category === 'ISOTOPE_BATTERY') {
        boxColor = '#10B981';
        tapeColor = '#047857';
      } else if (item.category === 'TAIGA_RATIONS') {
        boxColor = '#D97706';
        tapeColor = '#78350F';
      }

      // Корпус ящика.
      ctx.fillStyle = boxColor;
      ctx.fillRect(boxX, currentY - boxHeight, boxWidth, boxHeight);

      // Полоса ленты.
      ctx.fillStyle = tapeColor;
      ctx.fillRect(boxX + 2, currentY - boxHeight, 3, boxHeight);

      // Красная метка — груз повреждён (целостность ниже 60).
      if (item.currentIntegrity < 60) {
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(boxX + boxWidth - 3, currentY - boxHeight, 2, 2);
      }

      // Детализация: уголки и этикетка; при zoom ≥ 1.7 — индикатор: зелёный при целостности выше 50, иначе красный.
      if (zoom >= 1.25) {
        // Резиновые уголки.
        ctx.fillStyle = '#18181B';
        ctx.fillRect(boxX, currentY - boxHeight, 1, 1);
        ctx.fillRect(boxX + boxWidth - 1, currentY - boxHeight, 1, 1);
        ctx.fillRect(boxX, currentY - 1, 1, 1);
        ctx.fillRect(boxX + boxWidth - 1, currentY - 1, 1, 1);

        // Этикетка со штрихкодом.
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillRect(boxX + boxWidth - 5, currentY - boxHeight + 2, 3, 2);

        if (zoom >= 1.7) {
          // Индикатор состояния.
          ctx.fillStyle = item.currentIntegrity > 50 ? '#10B981' : '#EF4444';
          ctx.fillRect(boxX + 1, currentY - boxHeight + 1, 1, 1);
        }
      }

      currentY -= boxHeight + 1;
    }

    // Оранжевая стяжка от верхнего ящика к раме.
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -10);
    ctx.lineTo(-2, currentY);
    ctx.lineTo(2, currentY);
    ctx.lineTo(6, -10);
    ctx.stroke();

    ctx.restore();
  }

  // Освещение. Сначала весь экран слегка затемняется синим (сумерки), потом поверх рисуются
  // тёплые пятна света от костров и укрытий и слабый свет налобного фонаря курьера.
  // Рисуется ещё в проходе «мира», поэтому width/height — размер видимой области в пикселях мира.
  private drawDynamicLighting(
    ctx: CanvasRenderingContext2D,
    structures: PlacedStructure[],
    playerScreenX: number,
    playerScreenY: number,
    width: number,
    height: number,
    time: number,
    weather: WeatherState,
    cameraX: number,
    cameraY: number
  ) {
    ctx.save();

    // 1. Сумеречная синяя вуаль: прозрачность 0.28, в метель 0.18 (метель потом сама добавит белую пелену).
    const duskIntensity = weather.type === 'BLIZZARD' ? 0.18 : 0.28;
    ctx.fillStyle = `rgba(11, 25, 44, ${duskIntensity})`;
    ctx.fillRect(0, 0, width, height);

    // 2. Источники света поверх сумерек.
    // Костры: радиус света 80±5 px, мерцает с циклом ≈ 0,5 с. Пропускаются, если дальше 100 px за краем.
    for (const struct of structures) {
      if (struct.type === 'CAMPFIRE') {
        const sx = struct.x * TILE_SIZE - cameraX;
        const sy = struct.y * TILE_SIZE - cameraY;
        if (sx >= -100 && sx <= width + 100 && sy >= -100 && sy <= height + 100) {
          const flicker = Math.sin(time * 0.012) * 5;
          const radius = 80 + flicker;
          const grad = ctx.createRadialGradient(sx, sy, 4, sx, sy, radius);
          grad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
          grad.addColorStop(0.25, 'rgba(251, 146, 60, 0.32)');
          grad.addColorStop(0.65, 'rgba(245, 158, 11, 0.12)');
          grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (struct.type === 'SHELTER') {
        // Укрытие: ровный тёплый свет радиусом 45 px.
        const sx = struct.x * TILE_SIZE - cameraX;
        const sy = struct.y * TILE_SIZE - cameraY;
        if (sx >= -100 && sx <= width + 100 && sy >= -100 && sy <= height + 100) {
          const grad = ctx.createRadialGradient(sx, sy + 4, 4, sx, sy + 4, 45);
          grad.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
          grad.addColorStop(0.6, 'rgba(245, 158, 11, 0.1)');
          grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sx, sy + 4, 45, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Налобный фонарь курьера: слабое холодное пятно радиусом 42 px.
    const headlampGrad = ctx.createRadialGradient(playerScreenX, playerScreenY, 4, playerScreenX, playerScreenY, 42);
    headlampGrad.addColorStop(0, 'rgba(224, 242, 254, 0.22)');
    headlampGrad.addColorStop(0.6, 'rgba(186, 230, 253, 0.08)');
    headlampGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
    ctx.fillStyle = headlampGrad;
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Ночное небо (в пикселях экрана): синий градиент, Млечный Путь, мерцающие звёзды, плывущие облака
  // и туман внизу. Всё полупрозрачное, чтобы мир под ним оставался виден.
  private drawCelestialNightSky(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    weatherType: WeatherType
  ) {
    ctx.save();

    // 1. Градиент неба в верхних 3/4 экрана.
    const skyGrad = ctx.createLinearGradient(0, 0, width, height * 0.7);
    skyGrad.addColorStop(0, 'rgba(6, 19, 37, 0.42)');
    skyGrad.addColorStop(0.5, 'rgba(11, 29, 58, 0.28)');
    skyGrad.addColorStop(1, 'rgba(23, 59, 108, 0)');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height * 0.75);

    // 2. Млечный Путь: светлая диагональная полоса (повёрнута на -0.25 радиана ≈ -14°).
    ctx.save();
    ctx.rotate(-0.25);
    const galaxyGrad = ctx.createLinearGradient(0, -50, width * 1.2, height * 0.6);
    galaxyGrad.addColorStop(0, 'rgba(2, 132, 199, 0.08)');
    galaxyGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.16)');
    galaxyGrad.addColorStop(0.5, 'rgba(125, 211, 252, 0.22)');
    galaxyGrad.addColorStop(0.7, 'rgba(192, 132, 252, 0.12)');
    galaxyGrad.addColorStop(1, 'rgba(30, 58, 138, 0)');
    ctx.fillStyle = galaxyGrad;
    ctx.fillRect(-100, 20, width * 1.4, 75);

    // Плотная светлая середина полосы.
    ctx.fillStyle = 'rgba(224, 242, 254, 0.14)';
    ctx.fillRect(-80, 48, width * 1.3, 22);
    ctx.restore();

    // 3. Звёзды: 65 при ясном морозе, 35 в другую погоду.
    const starCount = weatherType === 'CLEAR_FROST' ? 65 : 35;
    for (let i = 0; i < starCount; i++) {
      // Позиции считаются формулой от номера звезды — всегда одни и те же (звёзды не прыгают),
      // в верхних 55% экрана.
      const sx = ((i * 137.5 + 43) % width);
      const sy = ((i * 83.7 + 17) % (height * 0.55));
      
      // Мерцание: яркость от 0.2 до 1.0, цикл ≈ 2,1 с, у каждой звезды своя фаза.
      const twinkle = Math.sin(time * 0.003 + i * 3.7) * 0.4 + 0.6;
      const size = (i % 7 === 0) ? 2 : 1;
      
      // Цвет: каждая 5-я — голубоватая, каждая 11-я — желтоватая, остальные белые. Каждая 7-я — крупнее (2×2 px).
      if (i % 5 === 0) {
        ctx.fillStyle = `rgba(186, 230, 253, ${0.8 * twinkle})`;
      } else if (i % 11 === 0) {
        ctx.fillStyle = `rgba(254, 240, 138, ${0.75 * twinkle})`;
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * twinkle})`;
      }
      ctx.fillRect(sx, sy, size, size);

      // Крестик-искра у каждой 13-й звезды в момент наибольшей яркости.
      if (i % 13 === 0 && twinkle > 0.85) {
        ctx.fillStyle = `rgba(224, 242, 254, ${0.5 * twinkle})`;
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
      }
    }

    // 4. Облака: 4 размытых пятна плывут вправо со скоростью 4 px/с и по кругу возвращаются слева.
    const drift = (time * 0.004) % (width + 300);
    for (let c = 0; c < 4; c++) {
      const cx = ((c * 180 + drift) % (width + 300)) - 150;
      const cy = 40 + (c * 25) % 80;
      const cloudGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 65);
      cloudGrad.addColorStop(0, 'rgba(98, 125, 152, 0.22)');
      cloudGrad.addColorStop(0.6, 'rgba(72, 101, 129, 0.14)');
      cloudGrad.addColorStop(1, 'rgba(72, 101, 129, 0)');
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 75, 28, -0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Туман в нижней половине экрана.
    const mistGrad = ctx.createLinearGradient(0, height * 0.5, 0, height);
    mistGrad.addColorStop(0, 'rgba(72, 101, 129, 0)');
    mistGrad.addColorStop(0.6, 'rgba(98, 125, 152, 0.08)');
    mistGrad.addColorStop(1, 'rgba(130, 154, 177, 0.14)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);

    ctx.restore();
  }

  // Погода — рисуется в пикселях экрана поверх уже нарисованного мира. У каждого типа погоды свой эффект.
  // Обычные снежинки (particles) рисуются всегда; их движение считает игровой цикл, здесь они только отображаются.
  private drawWeather(
    ctx: CanvasRenderingContext2D,
    weather: WeatherState,
    particles: { x: number; y: number; speed: number; size: number }[],
    width: number,
    height: number,
    time: number,
    zoom: number = 1.0
  ) {
    ctx.save();

    // 0. Ночное небо — при ясном морозе, лёгком снеге, полярном сиянии и сильном морозе.
    if (weather.type === 'CLEAR_FROST' || weather.type === 'LIGHT_SNOW' || weather.type === 'ANOMALOUS_AURORA' || weather.type === 'EXTREME_COLD') {
      this.drawCelestialNightSky(ctx, width, height, time, weather.type);
    }

    // 1. Аномальное полярное сияние: зелёно-фиолетово-розовая заливка, оттенки переливаются (цикл ≈ 6,3 с).
    if (weather.type === 'ANOMALOUS_AURORA') {
      const auroraGrad = ctx.createLinearGradient(0, 0, width, height * 0.75);
      const shift = Math.sin(time * 0.001) * 0.15;
      auroraGrad.addColorStop(0, `rgba(16, 185, 129, ${0.22 + shift})`);
      auroraGrad.addColorStop(0.35, `rgba(139, 92, 246, ${0.18 - shift})`);
      auroraGrad.addColorStop(0.7, `rgba(236, 72, 153, ${0.12 + shift * 0.5})`);
      auroraGrad.addColorStop(1, 'rgba(6, 78, 59, 0)');

      ctx.fillStyle = auroraGrad;
      ctx.fillRect(0, 0, width, height);

      // Колышущаяся лента сияния около 60 px от верха экрана.
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.2)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = 0; x < width; x += 20) {
        const y = 60 + Math.sin(x * 0.01 + time * 0.0015) * 25 + Math.cos(x * 0.02 + time * 0.002) * 15;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 2. Магнитная буря: вспышки, молнии и полосы помех.
    if (weather.type === 'MAGNETIC_STORM') {
      // Вспышка всего экрана ≈ 13% времени (когда sin > 0.92), цикл ≈ 0,8 с.
      const flashChance = Math.sin(time * 0.008);
      if (flashChance > 0.92) {
        ctx.fillStyle = 'rgba(224, 242, 254, 0.18)';
        ctx.fillRect(0, 0, width, height);
      }

      // Молния сверху вниз из 6 отрезков, видна ≈ 16% времени (цикл ≈ 0,4 с). Её позиция |sin(time * 3)|
      // меняется почти каждый кадр — молния «прыгает» по экрану.
      if (Math.sin(time * 0.015) > 0.88) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let lx = (Math.abs(Math.sin(time * 3)) * width);
        let ly = 0;
        ctx.moveTo(lx, ly);
        for (let seg = 0; seg < 6; seg++) {
          lx += (Math.sin(time + seg) - 0.5) * 50;
          ly += height / 6;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }

      // Полосы помех, как на старом мониторе: через каждые 4 px.
      ctx.fillStyle = 'rgba(14, 165, 233, 0.06)';
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1);
      }
    }

    // 3. Метель: белая пелена (прозрачность 0.32) и косые полосы ветра.
    if (weather.type === 'BLIZZARD') {
      ctx.fillStyle = 'rgba(241, 245, 249, 0.32)';
      ctx.fillRect(0, 0, width, height);

      // 30 полос ветра несутся со скоростью ≈ 2800 px/с по горизонтали и 1200 px/с по вертикали.
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 30; i++) {
        const sx = ((i * 73 + time * 2.8) % (width + 60)) - 30;
        const sy = ((i * 47 + time * 1.2) % height);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 50, sy + 18);
        ctx.stroke();
      }
    }

    // 4. Сильный снегопад: лёгкая белая дымка и 25 крупных хлопьев.
    if (weather.type === 'HEAVY_SNOWFALL') {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.12)';
      ctx.fillRect(0, 0, width, height);

      // Хлопья падают со скоростью 120 px/с и покачиваются ±20 px (цикл ≈ 6,3 с).
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let i = 0; i < 25; i++) {
        const fx = (i * 89 + Math.sin(time * 0.001 + i) * 20) % width;
        const fy = (i * 53 + time * 0.12) % height;
        ctx.beginPath();
        ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Сильный мороз: лёгкая голубая дымка.
    if (weather.type === 'EXTREME_COLD') {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.08)';
      ctx.fillRect(0, 0, width, height);
    }

    // Обычные снежинки (координаты приходят из игровой логики).
    ctx.fillStyle = '#FFFFFF';
    for (const p of particles) {
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    ctx.restore();
  }

  // Иней по краям экрана, когда курьеру холодно. warmth — тепло курьера (чем меньше, тем холоднее).
  // Включается при warmth < 60, а также всегда в метель и сильный мороз.
  private drawScreenFrost(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    warmth: number,
    weather: WeatherState
  ) {
    ctx.save();
    const isExtremeCold = weather.type === 'EXTREME_COLD';
    const isBlizzard = weather.type === 'BLIZZARD';

    // Голубая кайма: прозрачна в центре и сгущается к краям (от 25% до 65% меньшей стороны экрана).
    // coldIntensity растёт от 0 до 1, пока тепло падает с 60 до 0; в мороз +0.35, в метель +0.2;
    // итоговая прозрачность не больше 0.85.
    if (warmth < 60 || isBlizzard || isExtremeCold) {
      const coldIntensity = Math.max(0, (60 - warmth) / 60);
      const extraBoost = isExtremeCold ? 0.35 : isBlizzard ? 0.2 : 0;
      const rimAlpha = Math.min(0.85, 0.15 + coldIntensity * 0.5 + extraBoost);

      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.25,
        width / 2,
        height / 2,
        Math.min(width, height) * 0.65
      );
      grad.addColorStop(0, 'rgba(186, 230, 253, 0)');
      grad.addColorStop(0.75, `rgba(186, 230, 253, ${rimAlpha * 0.6})`);
      grad.addColorStop(1, `rgba(186, 230, 253, ${rimAlpha})`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Иглы инея по верхнему и нижнему краю — при warmth < 35 или в сильный мороз.
      // Шаг 16 px, длина 8±6 px (у соседних игл разная).
      if (warmth < 35 || isExtremeCold) {
        ctx.strokeStyle = 'rgba(240, 249, 255, 0.6)';
        ctx.lineWidth = 1;

        // Верхний край.
        for (let x = 0; x < width; x += 16) {
          const len = 8 + (Math.sin(x * 0.05) * 6);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 4, len);
          ctx.lineTo(x + 8, 0);
          ctx.stroke();
        }

        // Нижний край.
        for (let x = 0; x < width; x += 16) {
          const len = 8 + (Math.cos(x * 0.05) * 6);
          ctx.beginPath();
          ctx.moveTo(x, height);
          ctx.lineTo(x + 4, height - len);
          ctx.lineTo(x + 8, height);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}
