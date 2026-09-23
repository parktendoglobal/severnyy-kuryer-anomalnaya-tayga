import { WorldNPC } from '../types/game';

export const WORLD_NPCS: WorldNPC[] = [
  // 1. Тарас «Зимогор» — старый таёжный охотник в избушке
  {
    id: 'npc_taras',
    name: 'Тарас «Зимогор»',
    callsign: 'ЗИМА-7',
    role: 'Старый таёжный охотник',
    portrait: '🧔‍♂️',
    x: 30,
    y: 70,
    locationName: 'Заброшенная избушка лесничего',
    greeting: '«Здорово, курьер. Редко нынче живая душа сквозь буран до моей заимки добирается. Садись к огню, погрей кости.»',
    lore: 'Прожил в тайге более сорока лет. Знает повадки Хладных Теней и тайные тропы через мари.',
    tradeInventory: [
      {
        id: 'trade_taras_fur',
        name: 'Соболиный зимний мех',
        category: 'RESOURCE',
        itemKey: 'TAIGA_FUR',
        priceLikes: 120,
        count: 5,
        icon: '🦊',
        description: 'Отборная пушнина для пошива утепленной шубы и валенок.'
      },
      {
        id: 'trade_taras_flare',
        name: 'Охотничий фальшфейер',
        category: 'TOOL',
        itemKey: 'TOOL_FLARE',
        priceLikes: 90,
        count: 4,
        icon: '🧨',
        description: 'Яркий огонь. Тени боятся его пуще огня.'
      },
      {
        id: 'trade_taras_paraffin',
        name: 'Парафин и смола',
        category: 'RESOURCE',
        itemKey: 'PARAFFIN_WAX',
        priceLikes: 60,
        count: 6,
        icon: '🕯️',
        description: 'Для пропитки и растопки.'
      },
      {
        id: 'trade_taras_tea',
        name: 'Сбор сушёной брусники',
        category: 'RESOURCE',
        itemKey: 'CHAGA_HERB',
        priceLikes: 50,
        count: 8,
        icon: '🍄',
        description: 'Ягоды и грибы для горячего чая.'
      }
    ],
    quests: [
      {
        id: 'quest_taras_chaga',
        npcId: 'npc_taras',
        title: 'Лекарство от ломоты в суставах',
        type: 'GATHERING',
        description: '«Старые колени ноют к бурану. Собери мне 3 пучка свежей чаги с берез у замерзшей реки — я сварю бальзам, а тебе отсыплю соболиного меха и расскажу про обходные тропы.»',
        requiredResources: [{ type: 'CHAGA_HERB', amount: 3 }],
        rewardLikes: 250,
        rewardItems: [
          { name: 'Зимний соболиный мех', count: 3, icon: '🦊' },
          { name: 'Походный костер', count: 2, icon: '🪵' }
        ],
        status: 'AVAILABLE',
        progress: 0,
        maxProgress: 3
      },
      {
        id: 'quest_taras_scout',
        npcId: 'npc_taras',
        title: 'Разведка Мерзлотного Разлома',
        type: 'EXPLORATION',
        description: '«На южном перевале разлом расширился, скалы трещат. Пройди туда со своим сканером "Эхо-4" и проверь, не перекрыт ли старый зимник камнепадом.»',
        targetCoordinates: { x: 38, y: 88 },
        targetName: 'Мерзлотный разлом (Южный перевал)',
        rewardLikes: 400,
        rewardItems: [
          { name: 'Страховочный трос', count: 2, icon: '🪢' },
          { name: 'Фальшфейер', count: 2, icon: '🧨' }
        ],
        status: 'AVAILABLE',
        progress: 0,
        maxProgress: 1
      }
    ]
  },

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
  }
];
