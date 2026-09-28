/**
 * РЕГИОН «Северный Хребет» (id: region_ridge)
 *
 * Скалистые горы на северо-востоке с метеостанцией «Ветровой Мыс».
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
  // 3. Улукиткан — эвенкийский шаман и проводник
  {
    id: 'npc_ulukitkan',
    name: 'Улукиткан',
    callsign: 'ДУХ ТАЙГИ',
    role: 'Эвенкийский старейшина и следопыт',
    portrait: '🧓',
    x: 105,
    y: 20,
    locationName: 'Священный Кедр-великан',
    greeting: '«Тайга слышит каждый твой шаг, путник. Духи мерзлоты проснулись после Сдвига. Иди тихо, не тревожь тени.»',
    lore: 'Понимает язык тайги и метели. Знает, как обмануть Хладных Теней и пережить свирепый буран.',
    tradeInventory: [
      {
        id: 'trade_ulukitkan_resin',
        name: 'Кристалл Крио-смолы',
        category: 'RESOURCE',
        itemKey: 'CHIRAL_RESIN',
        priceLikes: 180,
        count: 4,
        icon: '💎',
        description: 'Сгусток аномальной энергии тайги.'
      },
      {
        id: 'trade_ulukitkan_wood',
        name: 'Кедровая плашка-оберег',
        category: 'RESOURCE',
        itemKey: 'WOOD_PINE',
        priceLikes: 50,
        count: 10,
        icon: '🪵',
        description: 'Сухая кедровая древесина.'
      },
      {
        id: 'trade_ulukitkan_shelter',
        name: 'Навес «Бивуак»',
        category: 'TOOL',
        itemKey: 'TOOL_SHELTER_KIT',
        priceLikes: 280,
        count: 1,
        icon: '⛺',
        description: 'Надежное спасение от бурана в поле.'
      }
    ],
    quests: [
      {
        id: 'quest_ulukitkan_resin',
        npcId: 'npc_ulukitkan',
        title: 'Дар духов мерзлоты',
        type: 'GATHERING',
        description: '«Собери 2 кристалла крио-смолы на границе полярных сияний в болотах. С ними ты сможешь сшить защитную маску и не ослепнуть в буран.»',
        requiredResources: [{ type: 'CHIRAL_RESIN', amount: 2 }],
        rewardLikes: 500,
        rewardItems: [
          { name: 'Ветрозащитный навес', count: 1, icon: '⛺' },
          { name: 'Крио-аккумулятор', count: 1, icon: '🔋' }
        ],
        status: 'AVAILABLE',
        progress: 0,
        maxProgress: 2
      },
      {
        id: 'quest_ulukitkan_anomaly',
        npcId: 'npc_ulukitkan',
        title: 'Успокоение Хладной Тени',
        type: 'EXPLORATION',
        description: '«На Мёртвом болоте сгустилась тьма. Прокрадись туда незамеченным, задержи дыхание и активируй сканер на древней меже.»',
        targetCoordinates: { x: 74, y: 35 },
        targetName: 'Древняя межа на Мёртвом болоте',
        rewardLikes: 600,
        rewardItems: [
          { name: 'Крио-смола', count: 3, icon: '💎' },
          { name: 'Благодарности курьеру', count: 200, icon: '👍' }
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
    id: 'phenom_chiral_aurora',
    title: 'Аномальное Полярное Сияние',
    category: 'PHENOMENON',
    regionId: 'region_ridge',
    regionName: 'Северный Хребет',
    threatLevel: 'SAFE',
    classification: 'Феномен IV: Ионосферный резонанс',
    dateStamp: 'Спектрограмма Метеостанции «Ветровой Мыс»',
    summary: 'Изумрудно-пурпурные ленты в небесах, насыщающие атмосферу свободными электронами и заряжающие аккумуляторы экзоскелета.',
    loreParagraphs: [
      'В отличие от обычного северного сияния, хиральное свечение возникает даже на высоте верхушек сосен. Воздух наполняется запахом озона и свежей хвои, а волоски на руках встают дыбом.',
      'В моменты сияния портативные аккумуляторы курьеров и приборы КПК самопроизвольно подзаряжаются со скоростью до 3% в минуту благодаря микроволновому атмосферному резонансу.',
      'Однако магнитные компасы в это время сходят с ума, а радиомаяки показывают зеркальные координаты.'
    ],
    tacticalAdvice: 'Используйте периоды аномального сияния для форсированного перехода: заряд батареи не иссякнет, пока небо озарено изумрудным светом.',
    iconName: 'Sparkles',
    discoveryCoordinatesHint: 'Высоты Северного Хребта (X:65, Y:18)'
  },
  {
    id: 'lore_svetlana_logs',
    title: 'Дневник метеоролога: Инженер Светлана',
    category: 'LORE',
    regionId: 'region_ridge',
    regionName: 'Северный Хребет',
    threatLevel: 'CAUTION',
    classification: 'Личные записи // Метеостанция',
    dateStamp: 'Журнал погоды #88 // 4 ноября',
    summary: 'Связь между пиками буранов и ритмичными выбросами энергии из глубины Долины.',
    loreParagraphs: [
      '«Бураны в наших горах — это не просто перепады давления циклонов. Барометр падает ступенями ровно каждые 48 минут.',
      'Каждый раз, когда в Бункере "Север-4" запускают глубинные генераторы, ветер на вершине взлетает до 35 метров в секунду. Снег летит горизонтально, срезая кору со стволов лиственниц.',
      'Курьеры, идущие ко мне на станцию, обязаны брать с собой запасные лестницы ПЛ-4: тропы в ущелье переметены пятиметровыми надувами.»'
    ],
    tacticalAdvice: 'Во время штормового ветра поворачивайтесь спиной к порывам, чтобы не потерять равновесие под тяжестью рюкзака.',
    iconName: 'Flame',
    discoveryCoordinatesHint: 'Метеостанция «Ветровой Мыс» (X:65, Y:18)'
  },
];

// Аномалии (Хладные Тени, гравитационные воронки, статические разряды).
// driftAngle — начальное направление дрейфа в радианах (0 = вправо, 1.57 = вниз, 3.14 = влево).
// pulseTimer — сдвиг фазы мерцания, чтобы соседние аномалии не пульсировали синхронно.
// radius — запас на будущее, сейчас в игре не используется.
// alwaysActive: true — пометьте так сюжетную аномалию, которая должна «жить» даже вдали от игрока.
export const ANOMALIES: AnomalyEntity[] = [
  { id: 'anom_phantom_6', type: 'FROST_PHANTOM', x: 74, y: 35, radius: 45, suspicion: 0, state: 'PATROLLING', driftAngle: 4.5, pulseTimer: 15 },
  { id: 'anom_static_2', type: 'STATIC_DISCHARGE', x: 85, y: 22, radius: 35, suspicion: 0, state: 'PATROLLING', driftAngle: 0, pulseTimer: 25 },
];

// Точки сбора ресурсов для крафта. amount — сколько единиц даёт одна точка.
export const RESOURCE_NODES: WorldResourceNode[] = [
  { id: 'res_wood_4', type: 'WOOD_PINE', x: 92, y: 24, amount: 4, harvested: false, name: 'Кедровая древесина' },
  { id: 'res_resin_2', type: 'CHIRAL_RESIN', x: 72, y: 34, amount: 2, harvested: false, name: 'Аномальная друза смолы' },
  { id: 'res_fur_2', type: 'TAIGA_FUR', x: 102, y: 22, amount: 2, harvested: false, name: 'Соболиные шкурки на сушиле' },
];

// Потерянные грузы, разбросанные по тайге.
export const LOST_CACHES: LostCache[] = [
  { id: 'lost_5', x: 88, y: 32, name: 'Фляга со спиртом и бинты', weightKg: 3.2, category: 'MEDICAL' },
];

// Атмосферные ориентиры (пока только справочные, на карте не рисуются).
export const LANDMARKS: Landmark[] = [
  { x: 105, y: 20, name: 'Кедр-великан (возраст 400 лет)', icon: '🌲' },
];
