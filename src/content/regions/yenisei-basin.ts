/**
 * РЕГИОН «Енисейский бассейн» (id: region_basin)
 *
 * Стартовый регион: пойма реки вокруг базы «Кедр-1». Игра всегда начинается здесь, поэтому этот файл
 * загружается сразу при запуске.
 *
 * Здесь лежит ВЕСЬ контент этого региона: жители (NPC) с их заданиями и торговлей,
 * записи дневника исследователя, аномалии, ресурсы для сбора, потерянные тайники и
 * ориентиры. Игра загружает этот файл только тогда, когда курьер подходит к региону,
 * поэтому контент можно добавлять сюда сколько угодно — старт игры от этого не замедлится.
 *
 * КАК ДОБАВИТЬ КОНТЕНТ: формат записей ровно такой же, как раньше в npcData.ts и
 * journalData.ts. Скопируйте любой объект в нужном списке ниже, поменяйте id (он должен
 * быть уникальным во всей игре) и тексты. Координаты x/y должны попадать в этот регион
 * (границы регионов описаны в src/content/regionMap.ts, функция getRegionAt).
 */
import { WorldNPC, AnomalyEntity, WorldResourceNode, LostCache, Landmark } from '../../types/game';
import { JournalEntry } from '../../types/journal';

// Жители региона: портрет, приветствие, товары на обмен и задания.
export const NPCS: WorldNPC[] = [
  // 2. Степан «Тягач» — механик у застрявшего КрАЗа
  {
    id: 'npc_stepan',
    name: 'Степан «Тягач»',
    callsign: 'СТАЛЬ-3',
    role: 'Водитель-механик экспедиции',
    portrait: '👷',
    x: 52,
    y: 46,
    locationName: 'Остов советского тягача КрАЗ',
    greeting: '«Эй, браток! Мой железный конь застрял в этой мерзлоте еще по осени. Помоги восстановить лебедку и генератор — запчастями не обижу!»',
    lore: 'Опытный таёжный механик. Способен из куска проволоки и карбюратора собрать портативный генератор.',
    tradeInventory: [
      {
        id: 'trade_stepan_scrap',
        name: 'Качественный дюралевый лом',
        category: 'RESOURCE',
        itemKey: 'SCRAP_METAL',
        priceLikes: 70,
        count: 10,
        icon: '🔩',
        description: 'Прочные детали для сборки лестниц и каркасов.'
      },
      {
        id: 'trade_stepan_wire',
        name: 'Бухта медного кабеля',
        category: 'RESOURCE',
        itemKey: 'COPPER_WIRE',
        priceLikes: 80,
        count: 8,
        icon: '🪢',
        description: 'Проводка для электроники и тросов.'
      },
      {
        id: 'trade_stepan_ladder',
        name: 'Лестница штурмовая ПЛ-4',
        category: 'TOOL',
        itemKey: 'TOOL_LADDER',
        priceLikes: 160,
        count: 2,
        icon: '🪜',
        description: 'Раскладная лестница для скал.'
      },
      {
        id: 'trade_stepan_repair',
        name: 'Баллончик гермопены',
        category: 'TOOL',
        itemKey: 'TOOL_REPAIR_SPRAY',
        priceLikes: 140,
        count: 2,
        icon: '🧴',
        description: 'Мгновенный ремонт поврежденных контейнеров.'
      }
    ],
    quests: [
      {
        id: 'quest_stepan_metal',
        npcId: 'npc_stepan',
        title: 'Металл для походной лебедки',
        type: 'GATHERING',
        description: '«Мне нужны 4 единицы металлолома и 2 мотка медной проводки, чтобы перепаять лебедку тягача. Найдешь вокруг — отсыплю готовых лестниц и герметик!»',
        requiredResources: [
          { type: 'SCRAP_METAL', amount: 4 },
          { type: 'COPPER_WIRE', amount: 2 }
        ],
        rewardLikes: 350,
        rewardItems: [
          { name: 'Лестница ПЛ-4', count: 2, icon: '🪜' },
          { name: 'Баллончик гермопены', count: 1, icon: '🧴' }
        ],
        status: 'AVAILABLE',
        progress: 0,
        maxProgress: 6
      }
    ]
  },

  // 4. Геолог Вера — исследовательница у старого моста
  {
    id: 'npc_vera',
    name: 'Геолог Вера',
    callsign: 'ГЕО-9',
    role: 'Старший геолог партии',
    portrait: '👩‍🔬',
    x: 45,
    y: 15,
    locationName: 'Разрушенный деревянный мост',
    greeting: '«Приветствую, курьер! Мост через реку рухнул из-за подвижки льда. Если поможешь навести переправу или доставишь образцы, Академия щедро наградит!»',
    lore: 'Ведет мониторинг тектонических сдвигов и промерзания сибирских рек.',
    tradeInventory: [
      {
        id: 'trade_vera_battery',
        name: 'Крио-аккумулятор «Арктика»',
        category: 'TOOL',
        itemKey: 'TOOL_POWER_CELL',
        priceLikes: 150,
        count: 3,
        icon: '🔋',
        description: 'Полная перезарядка батареи костюма.'
      },
      {
        id: 'trade_vera_rope',
        name: 'Альпинистский трос',
        category: 'TOOL',
        itemKey: 'TOOL_ROPE',
        priceLikes: 110,
        count: 3,
        icon: '🪢',
        description: 'Для преодоления ледяных обрывов.'
      },
      {
        id: 'trade_vera_scrap',
        name: 'Крепежные скобы и металл',
        category: 'RESOURCE',
        itemKey: 'SCRAP_METAL',
        priceLikes: 70,
        count: 8,
        icon: '🔩',
        description: 'Металл для полевых конструкций.'
      }
    ],
    quests: [
      {
        id: 'quest_vera_bridge',
        npcId: 'npc_vera',
        title: 'Разведка ледовой переправы',
        type: 'EXPLORATION',
        description: '«Отыщи безопасный переход через замерзшую реку к западу отсюда. Проверь прочность льда сканером "Эхо-4", чтобы тяжелый транспорт не провалился.»',
        targetCoordinates: { x: 45, y: 30 },
        targetName: 'Ледяной затор на реке Енисей',
        rewardLikes: 380,
        rewardItems: [
          { name: 'Крио-аккумулятор', count: 2, icon: '🔋' },
          { name: 'Лестница ПЛ-4', count: 1, icon: '🪜' }
        ],
        status: 'AVAILABLE',
        progress: 0,
        maxProgress: 1
      }
    ]
  },
];

// Записи «Дневника исследователя». Открываются, когда курьер впервые входит в регион.
export const JOURNAL: JournalEntry[] = [
  {
    id: 'lore_first_wave',
    title: 'Первая Волна: Смещение Координат',
    category: 'LORE',
    regionId: 'region_basin',
    regionName: 'Енисейский бассейн',
    threatLevel: 'SAFE',
    classification: 'Архив КПК // Событие «Сдвиг»',
    dateStamp: 'Запись диспетчерской #01 // 1986',
    summary: 'Первые часы после катастрофы: отказ спутников, тишина в радиоэфире и появление кристаллического налёта на снегу.',
    loreParagraphs: [
      'В ночь с 14 на 15 ноября 1986 года над Среднесибирским плоскогорьем вспыхнуло беззвучное зелёное зарево. В течение трёх минут все спутниковые группировки потеряли телеметрию над координатами 62° с.ш. 91° в.д.',
      'Компасные стрелки начали хаотично кружиться. Стандартные приборы навигации вышли из строя, а падающий снег приобрёл необычный голубоватый отлив и стал звенеть при ходьбе, словно битый хрусталь.',
      'База «Кедр-1» оказалась отрезанной от Большой Земли. С тех пор связь между поселениями поддерживается исключительно курьерами снабжения на лыжах и снегоступах.'
    ],
    tacticalAdvice: 'В базовом секторе аномальная активность минимальна. Используйте время для настройки строп рюкзака и проверки обуви.',
    iconName: 'Radio',
    discoveryCoordinatesHint: 'Сектор Базы «Кедр-1» (X:18, Y:22)'
  },
  {
    id: 'phenom_chrono_snow',
    title: 'Хроно-наст (Резонансный снег)',
    category: 'PHENOMENON',
    regionId: 'region_basin',
    regionName: 'Енисейский бассейн',
    threatLevel: 'CAUTION',
    classification: 'Феномен I: Хиральная кристаллизация',
    dateStamp: 'Полевой журнал геолога // Секция А',
    summary: 'Аномальная форма снежного покрова, ускоряющая износ подошвы и замедляющая движение перегруженного курьера.',
    loreParagraphs: [
      'Снежинки в зоне Сдвига не тают при нуле градусов. Они кристаллизуются в шестигранные фрактальные иглы с высоким содержанием полимерной кремниевой смолы.',
      'При давлении подошвы этот наст издает характерный стеклянный хруст. На плотном насте курьер развивает хорошую скорость, но в рыхлых сугробах наст буквально «цепляется» за обувь, высасывая выносливость вдвое быстрее.',
      'Наблюдения показывают: сканер «Эхо-4» легко различает плотный наст (синяя волна) и опасный рыхлый слой (желтая волна).'
    ],
    tacticalAdvice: 'Всегда зондируйте дорогу импульсом «Эхо-4». Обходите глубокие сугробы по старой дороге с укатанным полотном.',
    iconName: 'Snowflake',
    discoveryCoordinatesHint: 'Трасса снабжения «Кедр-1 — Ветровой Мыс»'
  },
  {
    id: 'exped_route_09',
    title: 'Отчёт разведгруппы челнока №09',
    category: 'EXPEDITION',
    regionId: 'region_basin',
    regionName: 'Енисейский бассейн',
    threatLevel: 'SAFE',
    classification: 'Полевой лог // Позывной «Соболь»',
    dateStamp: 'Запись КПК-7 // 22 октября',
    summary: 'Советы ветерана таёжных доставок по распределению груза и балансировке при боковом ветре.',
    loreParagraphs: [
      '«Если набил рюкзак выше плеч — забудь про бег. Центр тяжести уходит вверх, на любом ледяном бугорке тебя потянет в сугроб.',
      'При завале влево — сразу дави левую стропу. При завале вправо — правую. Если не удержишь и брякнешься, стеклянные радиолампы или приборы превратятся в кашу.',
      'И главное: не жалей парафина на костёр. Обморожение пальцев наступает незаметно, а замерзший курьер в тайге — уже не курьер, а памятник.»'
    ],
    tacticalAdvice: 'Тяжёлые контейнеры (свыше 6 кг) укладывайте строго в нижний отсек рюкзака.',
    iconName: 'Compass',
    discoveryCoordinatesHint: 'Окрестности вышки связи РЛС-1'
  },
];

// Аномалии (Хладные Тени, гравитационные воронки, статические разряды).
// driftAngle — начальное направление дрейфа в радианах (0 = вправо, 1.57 = вниз, 3.14 = влево).
// pulseTimer — сдвиг фазы мерцания, чтобы соседние аномалии не пульсировали синхронно.
// radius — запас на будущее, сейчас в игре не используется.
// alwaysActive: true — пометьте так сюжетную аномалию, которая должна «жить» даже вдали от игрока.
export const ANOMALIES: AnomalyEntity[] = [
  { id: 'anom_phantom_4', type: 'FROST_PHANTOM', x: 80, y: 50, radius: 55, suspicion: 0, state: 'PATROLLING', driftAngle: 2.1, pulseTimer: 10 },
  { id: 'anom_static_1', type: 'STATIC_DISCHARGE', x: 60, y: 75, radius: 30, suspicion: 0, state: 'PATROLLING', driftAngle: 0, pulseTimer: 5 },
];

// Точки сбора ресурсов для крафта. amount — сколько единиц даёт одна точка.
export const RESOURCE_NODES: WorldResourceNode[] = [
  { id: 'res_wood_1', type: 'WOOD_PINE', x: 22, y: 26, amount: 3, harvested: false, name: 'Кедровый валежник' },
  { id: 'res_wood_3', type: 'WOOD_PINE', x: 62, y: 42, amount: 3, harvested: false, name: 'Сухой кедровый бурелом' },
  { id: 'res_chaga_1', type: 'CHAGA_HERB', x: 28, y: 38, amount: 2, harvested: false, name: 'Берёзовая чага и брусника' },
  { id: 'res_chaga_2', type: 'CHAGA_HERB', x: 42, y: 28, amount: 3, harvested: false, name: 'Свежая чага на березе' },
  { id: 'res_chaga_3', type: 'CHAGA_HERB', x: 78, y: 48, amount: 2, harvested: false, name: 'Таёжный ягодник и чага' },
  { id: 'res_scrap_1', type: 'SCRAP_METAL', x: 20, y: 22, amount: 3, harvested: false, name: 'Обломки вышки РЛС' },
  { id: 'res_scrap_2', type: 'SCRAP_METAL', x: 50, y: 47, amount: 4, harvested: false, name: 'Запчасти тягача КрАЗ' },
  { id: 'res_scrap_3', type: 'SCRAP_METAL', x: 44, y: 16, amount: 3, harvested: false, name: 'Металлические балки моста' },
  { id: 'res_wire_1', type: 'COPPER_WIRE', x: 19, y: 24, amount: 2, harvested: false, name: 'Медный провод со столба' },
  { id: 'res_wire_2', type: 'COPPER_WIRE', x: 54, y: 45, amount: 3, harvested: false, name: 'Моток электропроводки' },
  { id: 'res_wire_3', type: 'COPPER_WIRE', x: 64, y: 40, amount: 2, harvested: false, name: 'Обрывки телефонного кабеля' },
  { id: 'res_wax_1', type: 'PARAFFIN_WAX', x: 24, y: 30, amount: 3, harvested: false, name: 'Канистра технического парафина' },
];

// Потерянные грузы, разбросанные по тайге.
export const LOST_CACHES: LostCache[] = [
  { id: 'lost_1', x: 26, y: 32, name: 'Брошенный контейнер с консервами', weightKg: 5.5, category: 'TAIGA_RATIONS' },
  { id: 'lost_2', x: 48, y: 22, name: 'Геологический керн с платиной', weightKg: 8.0, category: 'GEOLOGY_CORE' },
  { id: 'lost_3', x: 58, y: 52, name: 'Батарейный блок "Арктика"', weightKg: 6.2, category: 'ISOTOPE_BATTERY' },
];

// Атмосферные ориентиры (пока только справочные, на карте не рисуются).
export const LANDMARKS: Landmark[] = [
  { x: 18, y: 20, name: 'Вышка ретранслятора РЛС-1', icon: '📡' },
  { x: 45, y: 15, name: 'Разрушенный деревянный мост', icon: '🌉' },
  { x: 52, y: 46, name: 'Остов советского тягача КрАЗ', icon: '🚜' },
];
