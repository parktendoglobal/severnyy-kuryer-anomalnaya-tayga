import { Station, DeliveryMission, ToolItem, CargoItem } from '../types/game';

export const MAP_COLS = 120;
export const MAP_ROWS = 120;
export const TILE_SIZE = 32; // 32x32 pixels

export const STATIONS: Station[] = [
  {
    id: 'station_kedr',
    name: 'База "Кедр-1"',
    callsign: 'КЕДР',
    type: 'OUTPOST',
    x: 18,
    y: 22,
    region: 'Енисейский бассейн',
    description: 'Центральный перевалочный пункт снабжения. Здесь базируются челноки и работает ремонтный цех.',
    connected: true,
    npcName: 'Дядя Борис',
    npcRole: 'Диспетчер снабжения',
    chiralBandwidth: 100,
  },
  {
    id: 'station_meteo',
    name: 'Метеостанция "Ветровой Мыс"',
    callsign: 'ВЕТЕР',
    type: 'METEO',
    x: 65,
    y: 18,
    region: 'Северный Хребет',
    description: 'Высокогорная станция мониторинга аномалий и ветров. Отрезана снежными завалами.',
    connected: false,
    npcName: 'Инженер Светлана',
    npcRole: 'Метеоролог-климатолог',
    chiralBandwidth: 60,
  },
  {
    id: 'station_mine',
    name: 'Прииск "Золотой Ключ"',
    callsign: 'ПРИИСК',
    type: 'MINE',
    x: 35,
    y: 80,
    region: 'Мерзлотный разлом',
    description: 'Бывшая шахта геологов. На перевале участились проявления Хладных Теней.',
    connected: false,
    npcName: 'Прораб Кузьмич',
    npcRole: 'Хранитель шахты',
    chiralBandwidth: 40,
  },
  {
    id: 'station_bunker',
    name: 'Бункер "Север-4"',
    callsign: 'СЕВЕР',
    type: 'BUNKER',
    x: 95,
    y: 75,
    region: 'Аномальная Долина',
    description: 'Глубокий исследовательский бункер Академии Наук. Изучает природу Великого Сдвига.',
    connected: false,
    npcName: 'Доктор Лаврентьев',
    npcRole: 'Физик аномалий',
    chiralBandwidth: 80,
  },
  {
    id: 'station_hermit',
    name: 'Скит "Белый Лог"',
    callsign: 'ИСТОК',
    type: 'HERMITAGE',
    x: 100,
    y: 28,
    region: 'Глухая Тайга',
    description: 'Деревянный староверческий скит. Местные жители сохранили редкие семенные фонды кедра.',
    connected: false,
    npcName: 'Отец Варсонофий',
    npcRole: 'Травник и хранитель',
    chiralBandwidth: 30,
  }
];

export const INITIAL_TOOLS: ToolItem[] = [
  {
    id: 'tool_ladder',
    type: 'LADDER',
    name: 'Раскладная лестница ПЛ-4',
    count: 2,
    weightKg: 4.5,
    icon: '🪜',
    description: 'Позволяет взбираться на ледяные уступы и преодолевать расщелины до 4 клеток.'
  },
  {
    id: 'tool_rope',
    type: 'CLIMBING_ROPE',
    name: 'Страховочный трос (30м)',
    count: 2,
    weightKg: 2.0,
    icon: '🪢',
    description: 'Устанавливается на краю скалы для безопасного спуска без риска разбиться.'
  },
  {
    id: 'tool_campfire',
    type: 'CAMPFIRE',
    name: 'Походный набор костра',
    count: 3,
    weightKg: 1.8,
    icon: '🪵',
    description: 'Быстро разводит костёр из сушняка и парафина. Спасает от обморожения в буран.'
  },
  {
    id: 'tool_thermos',
    type: 'THERMAL_FLASK',
    name: 'Термос с таёжным чаем',
    count: 4,
    weightKg: 1.2,
    icon: '☕',
    description: 'Чай на шиповнике и чаге. Мгновенно восстанавливает выносливость и согревает.'
  },
  {
    id: 'tool_beacon',
    type: 'BEACON',
    name: 'Радиомаяк / Вешка',
    count: 3,
    weightKg: 0.8,
    icon: '🚩',
    description: 'Ставится на тропе для предупреждения об аномалиях или отметки безопасного брода.'
  }
];

export const INITIAL_MISSIONS: DeliveryMission[] = [
  {
    id: 'mis_01',
    title: 'Заказ №101: Радиолампы для Метеостанции',
    senderStationId: 'station_kedr',
    targetStationId: 'station_meteo',
    senderName: 'Диспетчер Борис',
    timeLimitSec: 360,
    rewardLikes: 450,
    description: 'На Ветровом Мысу вышел из строя радиомаяк. Доставьте хрупкий контейнер с лампами 6П3С. Берегите от падений!',
    status: 'AVAILABLE',
    minIntegrityForS: 90,
    cargoItems: [
      {
        id: 'cargo_tubes_1',
        name: 'Радиолампы 6П3С (хрупкое)',
        category: 'RADIO_TUBES',
        weightKg: 6.0,
        maxIntegrity: 100,
        currentIntegrity: 100,
        isFragile: true,
        slot: 'BACKPACK_MID',
        description: 'Вакуумные лампы связи в пенопластовом коробе. Любой сильный удар разобьёт стекло.'
      },
      {
        id: 'cargo_thermo_bat',
        name: 'Изотопный нагреватель',
        category: 'ISOTOPE_BATTERY',
        weightKg: 8.5,
        maxIntegrity: 100,
        currentIntegrity: 100,
        isFragile: false,
        slot: 'BACKPACK_BOTTOM',
        description: 'Тяжёлый энергоблок для автономного питания метео-датчиков.'
      }
    ]
  },
  {
    id: 'mis_02',
    title: 'Заказ №102: Антибиотики и сыворотка в Прииск',
    senderStationId: 'station_kedr',
    targetStationId: 'station_mine',
    senderName: 'Фельдшер Анна',
    timeLimitSec: 420,
    rewardLikes: 580,
    description: 'В шахте обвал и несколько человек получили травмы. Путь лежит через замерзшее русло реки и аномальную поляну.',
    status: 'AVAILABLE',
    minIntegrityForS: 85,
    cargoItems: [
      {
        id: 'cargo_meds_1',
        name: 'Крио-бокс с сывороткой',
        category: 'MEDICAL',
        weightKg: 4.2,
        maxIntegrity: 100,
        currentIntegrity: 100,
        isFragile: true,
        slot: 'BACKPACK_TOP',
        description: 'Жизненно важные медикаменты. При сильной тряске ампулы могут дать трещину.'
      },
      {
        id: 'cargo_rations_1',
        name: 'Армейские пайки ИРП-Б (х2)',
        category: 'TAIGA_RATIONS',
        weightKg: 7.0,
        maxIntegrity: 100,
        currentIntegrity: 100,
        isFragile: false,
        slot: 'BACKPACK_BOTTOM',
        description: 'Калорийный рацион для горнорабочих.'
      }
    ]
  },
  {
    id: 'mis_03',
    title: 'Заказ №103: Спектральные детекторы для "Север-4"',
    senderStationId: 'station_kedr',
    targetStationId: 'station_bunker',
    senderName: 'Дядя Борис',
    timeLimitSec: 500,
    rewardLikes: 820,
    description: 'Академики в бункере зафиксировали активность гравитационных воронок. Им срочно требуются квантовые датчики.',
    status: 'AVAILABLE',
    minIntegrityForS: 90,
    cargoItems: [
      {
        id: 'cargo_detectors',
        name: 'Комплект датчиков "Аура-М"',
        category: 'RADIO_TUBES',
        weightKg: 9.0,
        maxIntegrity: 100,
        currentIntegrity: 100,
        isFragile: true,
        slot: 'BACKPACK_MID',
        description: 'Высокоточные детекторы пространственных возмущений.'
      },
      {
        id: 'cargo_seeds',
        name: 'Капсула морозостойких семян',
        category: 'SEED_BANK',
        weightKg: 5.0,
        maxIntegrity: 100,
        currentIntegrity: 100,
        isFragile: false,
        slot: 'LEFT_STRAP',
        description: 'Семена кедра и лиственницы для посадки в аномальной пустоши.'
      }
    ]
  },
  {
    id: 'mis_04',
    title: 'Заказ №104: Травяные сборы в Скит "Белый Лог"',
    senderStationId: 'station_meteo',
    targetStationId: 'station_hermit',
    senderName: 'Инженер Светлана',
    timeLimitSec: 320,
    rewardLikes: 390,
    description: 'Передайте отшельнику образцы высокогорных лишайников для мази от обморожений.',
    status: 'AVAILABLE',
    minIntegrityForS: 80,
    cargoItems: [
      {
        id: 'cargo_lichen',
        name: 'Контейнер горных мхов',
        category: 'GEOLOGY_CORE',
        weightKg: 3.5,
        maxIntegrity: 100,
        currentIntegrity: 100,
        isFragile: false,
        slot: 'RIGHT_STRAP',
        description: 'Редкие образцы высокогорной тундры.'
      }
    ]
  }
];
