import { CraftingRecipe, ResourceItem, ResourceType } from '../types/game';

export const ALL_RESOURCES: Record<ResourceType, { name: string; icon: string; weightKg: number; description: string }> = {
  WOOD_PINE: {
    name: 'Кедровая древесина',
    icon: '🪵',
    weightKg: 0.8,
    description: 'Смолистые поленья и сушняк векового сибирского кедра. Основа для костров, шестов и каркасов.'
  },
  CHAGA_HERB: {
    name: 'Чага и брусника',
    icon: '🍄',
    weightKg: 0.3,
    description: 'Берёзовый гриб чага и сушёные таёжные ягоды. Согревающий взвар спасает от обморожения и восстанавливает силы.'
  },
  SCRAP_METAL: {
    name: 'Металлолом',
    icon: '🔩',
    weightKg: 1.2,
    description: 'Дюралевые уголки, болты и листовой металл из брошенной геологической техники и опор ЛЭП.'
  },
  CHIRAL_RESIN: {
    name: 'Крио-смола (Хиральная)',
    icon: '💎',
    weightKg: 0.5,
    description: 'Аномальный кристаллический полимер, сочащийся из разломов вечной мерзлоты. Необходим для высокотехнологичной защиты.'
  },
  COPPER_WIRE: {
    name: 'Медная проводка',
    icon: '🪢',
    weightKg: 0.4,
    description: 'Изолированный кабель и медные катушки со старых телефонных столбов и советских радиостанций.'
  },
  TAIGA_FUR: {
    name: 'Зимний соболиный мех',
    icon: '🦊',
    weightKg: 0.6,
    description: 'Густой непродуваемый мех лесных пушных зверей. Незаменим при пошиве полярной экипировки.'
  },
  PARAFFIN_WAX: {
    name: 'Парафин и канифоль',
    icon: '🕯️',
    weightKg: 0.3,
    description: 'Водоотталкивающий состав для пропитки парусины, розжига огня в сырой снег и герметизации контейнеров.'
  }
};

export const INITIAL_PLAYER_RESOURCES: ResourceItem[] = [
  {
    type: 'WOOD_PINE',
    name: ALL_RESOURCES.WOOD_PINE.name,
    icon: ALL_RESOURCES.WOOD_PINE.icon,
    weightKg: ALL_RESOURCES.WOOD_PINE.weightKg,
    count: 6,
    description: ALL_RESOURCES.WOOD_PINE.description
  },
  {
    type: 'CHAGA_HERB',
    name: ALL_RESOURCES.CHAGA_HERB.name,
    icon: ALL_RESOURCES.CHAGA_HERB.icon,
    weightKg: ALL_RESOURCES.CHAGA_HERB.weightKg,
    count: 4,
    description: ALL_RESOURCES.CHAGA_HERB.description
  },
  {
    type: 'SCRAP_METAL',
    name: ALL_RESOURCES.SCRAP_METAL.name,
    icon: ALL_RESOURCES.SCRAP_METAL.icon,
    weightKg: ALL_RESOURCES.SCRAP_METAL.weightKg,
    count: 5,
    description: ALL_RESOURCES.SCRAP_METAL.description
  },
  {
    type: 'CHIRAL_RESIN',
    name: ALL_RESOURCES.CHIRAL_RESIN.name,
    icon: ALL_RESOURCES.CHIRAL_RESIN.icon,
    weightKg: ALL_RESOURCES.CHIRAL_RESIN.weightKg,
    count: 2,
    description: ALL_RESOURCES.CHIRAL_RESIN.description
  },
  {
    type: 'COPPER_WIRE',
    name: ALL_RESOURCES.COPPER_WIRE.name,
    icon: ALL_RESOURCES.COPPER_WIRE.icon,
    weightKg: ALL_RESOURCES.COPPER_WIRE.weightKg,
    count: 3,
    description: ALL_RESOURCES.COPPER_WIRE.description
  },
  {
    type: 'TAIGA_FUR',
    name: ALL_RESOURCES.TAIGA_FUR.name,
    icon: ALL_RESOURCES.TAIGA_FUR.icon,
    weightKg: ALL_RESOURCES.TAIGA_FUR.weightKg,
    count: 2,
    description: ALL_RESOURCES.TAIGA_FUR.description
  },
  {
    type: 'PARAFFIN_WAX',
    name: ALL_RESOURCES.PARAFFIN_WAX.name,
    icon: ALL_RESOURCES.PARAFFIN_WAX.icon,
    weightKg: ALL_RESOURCES.PARAFFIN_WAX.weightKg,
    count: 3,
    description: ALL_RESOURCES.PARAFFIN_WAX.description
  }
];

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // 1. WARM CLOTHING & UPGRADES
  {
    id: 'craft_parka',
    name: 'Шуба «Геолог-Полярник»',
    category: 'CLOTHING',
    icon: '🧥',
    resultType: 'GEAR_PARKA',
    resultCount: 1,
    description: 'Плотная меховая шуба на гагачьем пуху с подкладкой из соболиного меха. Надежно защищает от гипотермии.',
    benefits: '+35% устойчивость к морозу; замедляет потерю тепла тела даже при -45°C',
    ingredients: [
      { type: 'TAIGA_FUR', amount: 3 },
      { type: 'PARAFFIN_WAX', amount: 2 }
    ],
    unlocked: true
  },
  {
    id: 'craft_snowshoes',
    name: 'Снегоступы «Тайга»',
    category: 'CLOTHING',
    icon: '🎿',
    resultType: 'GEAR_SNOWSHOES',
    resultCount: 1,
    description: 'Широкие плетеные снегоступы из гибких веток кедра и проволочного каркаса.',
    benefits: 'Устраняют на 65% штраф скорости при ходьбе по глубоким сугробам',
    ingredients: [
      { type: 'WOOD_PINE', amount: 4 },
      { type: 'COPPER_WIRE', amount: 2 }
    ],
    unlocked: true
  },
  {
    id: 'craft_mask',
    name: 'Ветрозащитная маска «Буран»',
    category: 'CLOTHING',
    icon: '🥽',
    resultType: 'GEAR_MASK',
    resultCount: 1,
    description: 'Маска с двойным светофильтром и подогреваемым меховым обтюратором для защиты глаз и дыхания.',
    benefits: 'Снижает влияние бокового ветра на центр тяжести и баланс рюкзака',
    ingredients: [
      { type: 'TAIGA_FUR', amount: 2 },
      { type: 'SCRAP_METAL', amount: 2 },
      { type: 'CHIRAL_RESIN', amount: 1 }
    ],
    unlocked: true
  },
  {
    id: 'craft_boots',
    name: 'Окованные валенки «Север»',
    category: 'CLOTHING',
    icon: '🥾',
    resultType: 'GEAR_BOOTS',
    resultCount: 1,
    description: 'Войлочные валенки с титановыми шипами и резиновым рантом против скольжения по льду и скалам.',
    benefits: 'Снижают износ обуви на камнях на 50% и предотвращают скольжение по руслу реки',
    ingredients: [
      { type: 'TAIGA_FUR', amount: 2 },
      { type: 'SCRAP_METAL', amount: 3 }
    ],
    unlocked: true
  },

  // 2. SURVIVAL SHELTER COMPONENTS
  {
    id: 'craft_shelter_kit',
    name: 'Ветрозащитный навес «Бивуак»',
    category: 'SHELTER',
    icon: '⛺',
    resultType: 'TOOL_SHELTER_KIT',
    resultCount: 1,
    description: 'Быстроразборный каркасный навес с брезентовым тентом. Создает зону затишья в эпицентре бурана.',
    benefits: 'Развертывается в любой точке карты: защищает от ветра, согревает и восстанавливает силы',
    ingredients: [
      { type: 'WOOD_PINE', amount: 4 },
      { type: 'PARAFFIN_WAX', amount: 2 },
      { type: 'COPPER_WIRE', amount: 2 }
    ],
    unlocked: true
  },

  // 3. TOOLS & EXPEDITION GEAR
  {
    id: 'craft_ladder',
    name: 'Раскладная лестница ПЛ-4',
    category: 'TOOL',
    icon: '🪜',
    resultType: 'TOOL_LADDER',
    resultCount: 1,
    description: 'Дюралюминиевая штурмовая лестница для преодоления обрывов, трещин во льду и скальных уступов.',
    benefits: 'Позволяет взбираться на скалы и переходить расщелины до 4 клеток',
    ingredients: [
      { type: 'SCRAP_METAL', amount: 3 },
      { type: 'WOOD_PINE', amount: 2 }
    ],
    unlocked: true
  },
  {
    id: 'craft_rope',
    name: 'Страховочный трос (30м)',
    category: 'TOOL',
    icon: '🪢',
    resultType: 'TOOL_ROPE',
    resultCount: 1,
    description: 'Плетеный альпинистский фал со скальным крюком-шлямбуром для безопасного спуска.',
    benefits: 'Устанавливается на вершине скалы для безопасного скоростного спуска',
    ingredients: [
      { type: 'COPPER_WIRE', amount: 2 },
      { type: 'SCRAP_METAL', amount: 1 }
    ],
    unlocked: true
  },
  {
    id: 'craft_campfire',
    name: 'Походный набор костра',
    category: 'TOOL',
    icon: '🪵',
    resultType: 'TOOL_CAMPFIRE',
    resultCount: 2,
    description: 'Сухие смоляные дрова с запалом из парафина. Мгновенно разгорается даже при сильном ветре.',
    benefits: 'Быстро разводит костёр в тайге, восстанавливая тепло и выносливость',
    ingredients: [
      { type: 'WOOD_PINE', amount: 3 },
      { type: 'PARAFFIN_WAX', amount: 1 }
    ],
    unlocked: true
  },
  {
    id: 'craft_flare',
    name: 'Сигнальный фальшфейер «Заря»',
    category: 'TOOL',
    icon: '🧨',
    resultType: 'TOOL_FLARE',
    resultCount: 2,
    description: 'Магниевый факел яркого горения. Аномальные Хладные Тени панически боятся его спектрального света.',
    benefits: 'Освещает радиус 6 клеток и отпугивает фантомов на 25 секунд',
    ingredients: [
      { type: 'SCRAP_METAL', amount: 2 },
      { type: 'CHIRAL_RESIN', amount: 1 },
      { type: 'PARAFFIN_WAX', amount: 1 }
    ],
    unlocked: true
  },

  // 4. SURVIVAL & REPAIR
  {
    id: 'craft_thermos',
    name: 'Таёжный чай с чагой и брусникой',
    category: 'SURVIVAL',
    icon: '☕',
    resultType: 'TOOL_THERMOS',
    resultCount: 2,
    description: 'Горячий настой чаги и таёжных трав в вакуумной колбе.',
    benefits: 'Мгновенно восстанавливает +45 тепла тела и +35 выносливости',
    ingredients: [
      { type: 'CHAGA_HERB', amount: 2 },
      { type: 'WOOD_PINE', amount: 1 }
    ],
    unlocked: true
  },
  {
    id: 'craft_repair_spray',
    name: 'Баллончик термопены «Герметик»',
    category: 'SURVIVAL',
    icon: '🧴',
    resultType: 'TOOL_REPAIR_SPRAY',
    resultCount: 1,
    description: 'Быстротвердеющая пена на основе крио-смолы. Затягивает пробоины и трещины в контейнерах.',
    benefits: 'Мгновенно восстанавливает поврежденный контейнер до 100% целостности',
    ingredients: [
      { type: 'CHIRAL_RESIN', amount: 2 },
      { type: 'PARAFFIN_WAX', amount: 1 },
      { type: 'SCRAP_METAL', amount: 1 }
    ],
    unlocked: true
  },
  {
    id: 'craft_power_cell',
    name: 'Крио-аккумулятор «Арктика»',
    category: 'SURVIVAL',
    icon: '🔋',
    resultType: 'TOOL_POWER_CELL',
    resultCount: 1,
    description: 'Холодостойкий блок питания для экзоскелета и топографического сканера «Эхо-4».',
    benefits: 'Полностью заряжает батарею костюма до 100%',
    ingredients: [
      { type: 'SCRAP_METAL', amount: 2 },
      { type: 'COPPER_WIRE', amount: 2 },
      { type: 'CHIRAL_RESIN', amount: 1 }
    ],
    unlocked: true
  }
];
