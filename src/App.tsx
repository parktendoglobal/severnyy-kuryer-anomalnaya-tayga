/**
 * ГЛАВНЫЙ ФАЙЛ ИГРЫ — «дирижёр»
 *
 * Здесь всё собирается вместе: игровой цикл (60 кадров в секунду), который двигает курьера,
 * аномалии и погоду и просит холст нарисовать кадр; обработка нажатий (сбор ресурсов, крафт,
 * задания, торговля, доставка); подгрузка регионов по мере путешествия; сохранения; и все
 * окна интерфейса поверх холста.
 *
 * Сами формулы вынесены в отдельные файлы папки src/game/: движение и выживание курьера —
 * playerPhysics.ts, погода — weather.ts, поведение аномалий — anomalyAI.ts, зона
 * активности — activityZone.ts, сохранения — saveSystem.ts.
 *
 * ВАЖНО ПРО СКОРОСТЬ. Всё, что меняется каждый кадр (позиция курьера, аномалии, погода),
 * хранится в «ящиках» useRef — их изменение не заставляет React перерисовывать интерфейс.
 * Интерфейс (useState) обновляется только когда что-то видимое правда поменялось:
 * открылось окно, изменился инвентарь, или раз в 0.1 секунды для полосок HUD.
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  PlayerStats,
  CargoItem,
  ToolItem,
  PlacedStructure,
  AnomalyEntity,
  WeatherState,
  Footstep,
  DeliveryMission,
  Station,
  WorldResourceNode,
  WorldNPC,
  ResourceItem,
  EquippedGear,
  CraftingRecipe,
  TradeItem,
  LostCache
} from './types/game';
import { JournalEntry, RegionDefinition } from './types/journal';
import { STATIONS, INITIAL_TOOLS, INITIAL_MISSIONS, MAP_COLS, MAP_ROWS } from './utils/constants';
import { generateWorld } from './utils/mapGenerator';
import { INITIAL_PLAYER_RESOURCES, ALL_RESOURCES } from './utils/craftingData';
import { TaigaRenderer } from './game/TaigaRenderer';
import { stepPlayer, computeCarriedWeightKg, PlayerStepTimers } from './game/playerPhysics';
import { INITIAL_WEATHER, tickWeather } from './game/weather';
import { updateAnomaly, wakeUpIfDormant } from './game/anomalyAI';
import { getActivityRadius, shouldSimulate } from './game/activityZone';
import { HUD_REFRESH_INTERVAL_SEC, playerHudKey } from './game/hudSync';
import {
  loadGame,
  saveGame,
  deleteSave,
  restorePlayer,
  applySavedQuests,
  collectQuestStates,
  SaveData,
  NPCRelation,
  SAVE_VERSION,
  AUTOSAVE_INTERVAL_MS,
  readRawSave
} from './game/saveSystem';
import { usePlatform } from './platform';
import { REGIONS, getRegionAt } from './content/regionMap';
import { loadRegion, regionsNearPoint } from './content/regionLoader';
import { sound } from './utils/audio';
import { VirtualControls } from './components/VirtualControls';
import { GameHUD } from './components/GameHUD';
import { DeliveryPDA } from './components/DeliveryPDA';
import { CargoInventoryModal } from './components/CargoInventoryModal';
import { StationTerminalModal } from './components/StationTerminalModal';
import { DeliveryReportModal } from './components/DeliveryReportModal';
import { CraftingModal } from './components/CraftingModal';
import { NPCDialogModal } from './components/NPCDialogModal';
import { GameMenuModal } from './components/GameMenuModal';
import { Compass, Sparkles, Save } from 'lucide-react';

// Показатели курьера в начале новой игры: стоит у базы «Кедр-1», всё на 100%.
const NEW_GAME_PLAYER: PlayerStats = {
  x: 18,
  y: 22,
  vx: 0,
  vy: 0,
  facingAngle: 0,
  balance: 0,
  stumbleAlert: 'NONE',
  stumbleTimer: 0,
  isStumbling: false,
  isBracingLeft: false,
  isBracingRight: false,
  stamina: 100,
  maxStamina: 100,
  warmth: 100,
  battery: 100,
  bootsIntegrity: 100,
  isHoldingBreath: false,
  breathAir: 100,
  isCrouching: false,
  scannerCooldown: 0,
  scannerPulseProgress: 1.0,
  scannerActive: false,
  isSprinting: false,
  onSled: false,
  courierGrade: 'Курьер Снабжения 1-го класса',
  totalLikes: 250,
  deliveredDeliveries: 0
};

// На каком расстоянии (в клетках) можно взаимодействовать с объектами.
const STATION_INTERACT_RADIUS = 2.8;
const NPC_INTERACT_RADIUS = 3.2;
const RESOURCE_INTERACT_RADIUS = 2.5;
const STATION_ARRIVAL_RADIUS = 2.5; // подойдя так близко к цели заказа, терминал откроется сам
const QUEST_SCAN_RADIUS = 5.0; // исследовательское задание засчитывается сканом ближе этого

// Масштаб камеры: от 0.65 (далеко) до 2.5 (близко).
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.5;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z * 100) / 100));

/**
 * Начальное состояние игры: из сохранения, если оно есть, иначе — новая игра.
 * Вызывается один раз при запуске.
 */
function createInitialState(saved: SaveData | null) {
  const missions = INITIAL_MISSIONS.map(m =>
    saved?.missionStatuses[m.id] ? { ...m, status: saved.missionStatuses[m.id] } : m
  );
  return {
    player: saved ? restorePlayer(saved.player) : NEW_GAME_PLAYER,
    stations: STATIONS.map(s => (saved?.connectedStationIds.includes(s.id) ? { ...s, connected: true } : s)),
    missions,
    // В новой игре первый заказ уже выдан курьеру.
    activeMission: saved
      ? missions.find(m => m.id === saved.activeMissionId) ?? null
      : INITIAL_MISSIONS[0],
    cargo: saved ? saved.cargo : INITIAL_MISSIONS[0].cargoItems,
    tools: saved ? saved.tools : INITIAL_TOOLS,
    resources: saved ? saved.resources : INITIAL_PLAYER_RESOURCES,
    equippedGear: saved ? saved.equippedGear : {},
    structures: saved ? saved.structures : [],
    discoveredRegionIds: saved ? saved.discoveredRegionIds : ['region_basin'],
    npcRelations: saved ? saved.npcRelations : {},
    missionStartTime: Date.now() - (saved ? saved.missionElapsedSec * 1000 : 0)
  };
}

// Порядок регионов в дневнике — как в списке REGIONS, а не в порядке загрузки.
const regionOrder = (regionId: string) => REGIONS.findIndex(r => r.id === regionId);

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TaigaRenderer | null>(null);

  // ======================================================================
  // ЗАГРУЗКА СОХРАНЕНИЯ (один раз при запуске)
  // ======================================================================
  // Площадка (браузер, Telegram, VK, MAX). Облачную копию сохранения main.tsx уже подтянул.
  const platform = usePlatform();
  const [boot] = useState(() => loadGame());
  const [initial] = useState(() => createInitialState(boot.kind === 'ok' ? boot.data : null));

  // Сообщение игроку о состоянии сохранения (обновлено, повреждено, от новой версии…).
  const [saveNotice, setSaveNotice] = useState<string | null>(() => {
    if (boot.kind === 'ok' && boot.migratedFrom !== null) {
      return `Сохранение обновлено с формата версии ${boot.migratedFrom} до ${SAVE_VERSION}. Весь прогресс на месте.`;
    }
    if (boot.kind === 'newer') {
      return `Сохранение сделано более новой версией игры (формат ${boot.version}). Чтобы не испортить его, эта версия ничего не сохраняет. Обновите страницу игры или начните заново через меню.`;
    }
    if (boot.kind === 'broken') {
      return `Сохранение повреждено и не читается, поэтому начата новая игра. Копия старого сохранения не удалена, она лежит в памяти браузера под именем «${boot.backupKey}».`;
    }
    return null;
  });
  // Сохранение от более новой версии игры не перезаписываем, пока игрок сам не начнёт заново.
  const savingDisabledRef = useRef(boot.kind === 'newer');
  const savingDisabledReason =
    boot.kind === 'newer' ? 'Сохранение сделано более новой версией игры — эта версия его не перезаписывает.' : null;
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Звук
  const [isMuted, setIsMuted] = useState(false);

  // Масштаб камеры. zoomRef читает игровой цикл, zoom — ползунок в интерфейсе.
  const [zoom, setZoom] = useState<number>(1.0);
  const zoomRef = useRef<number>(1.0);

  const handleZoomChange = useCallback((newZoom: number) => {
    const clamped = clampZoom(newZoom);
    setZoom(clamped);
    zoomRef.current = clamped;
  }, []);

  // ======================================================================
  // МИР
  // ======================================================================
  // Рельеф (снег, лёд, скалы, деревья) генерируется один раз при запуске по формулам.
  const [world] = useState(generateWorld);
  const [stations, setStations] = useState<Station[]>(initial.stations);
  const [missions, setMissions] = useState<DeliveryMission[]>(initial.missions);
  const [structures, setStructures] = useState<PlacedStructure[]>(initial.structures);

  // Контент регионов. Пока регион не загружен, его жителей, ресурсов и записей здесь нет.
  const [npcs, setNpcs] = useState<WorldNPC[]>([]);
  const [resourceNodes, setResourceNodes] = useState<WorldResourceNode[]>([]);
  const [lostCaches, setLostCaches] = useState<LostCache[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const loadedRegionIdsRef = useRef<Set<string>>(new Set());

  // Аномалии меняются каждый кадр, поэтому живут в ref, а не в state (см. комментарий вверху).
  const anomaliesRef = useRef<AnomalyEntity[]>([]);

  // Игровое время в секундах с момента запуска. Нужно, чтобы понимать, сколько «проспала»
  // аномалия вдали от курьера.
  const gameTimeRef = useRef(0);

  // Прогресс из сохранения для регионов, которые ещё не загружены: применяется при их загрузке.
  const savedQuestsRef = useRef<SaveData['quests']>(boot.kind === 'ok' ? boot.data.quests : {});
  const harvestedIdsRef = useRef<Set<string>>(
    new Set(boot.kind === 'ok' ? boot.data.harvestedResourceNodeIds : [])
  );
  const [npcRelations, setNpcRelations] = useState<Record<string, NPCRelation>>(initial.npcRelations);

  // Груз, инструменты, ресурсы, снаряжение
  const [cargo, setCargo] = useState<CargoItem[]>(initial.cargo);
  const [tools, setTools] = useState<ToolItem[]>(initial.tools);
  const [resources, setResources] = useState<ResourceItem[]>(initial.resources);
  const [equippedGear, setEquippedGear] = useState<EquippedGear>(initial.equippedGear);
  const [activeMission, setActiveMission] = useState<DeliveryMission | null>(initial.activeMission);

  const totalWeightKg = useMemo(
    () => computeCarriedWeightKg(cargo, tools, resources),
    [cargo, tools, resources]
  );

  // ======================================================================
  // КУРЬЕР
  // playerRef — «живое» состояние, меняется 60 раз в секунду.
  // hudPlayer — снимок для интерфейса, обновляется не чаще 10 раз в секунду.
  // ======================================================================
  const playerRef = useRef<PlayerStats>(initial.player);
  const [hudPlayer, setHudPlayer] = useState<PlayerStats>(initial.player);
  const hudKeyRef = useRef(playerHudKey(initial.player));

  // Показать в интерфейсе текущее состояние курьера.
  const syncHud = useCallback(() => {
    hudKeyRef.current = playerHudKey(playerRef.current);
    setHudPlayer(playerRef.current);
  }, []);

  // Изменить курьера по нажатию (лайки, лямки, термос…) и сразу показать это в интерфейсе.
  const updatePlayer = useCallback(
    (change: (prev: PlayerStats) => PlayerStats) => {
      playerRef.current = change(playerRef.current);
      syncHud();
    },
    [syncHud]
  );

  // Погода: weatherRef тикает каждый кадр, weather (для интерфейса) меняется только при смене погоды.
  const weatherRef = useRef<WeatherState>(INITIAL_WEATHER);
  const [weather, setWeather] = useState<WeatherState>(INITIAL_WEATHER);

  // Следы и снежинки: только для отрисовки, в интерфейсе не участвуют.
  const footstepsRef = useRef<Footstep[]>([]);
  const snowParticlesRef = useRef<{ x: number; y: number; speed: number; size: number }[]>([]);

  // ======================================================================
  // ОКНА ИНТЕРФЕЙСА
  // ======================================================================
  const [pdaOpen, setPdaOpen] = useState(false);
  const [pdaInitialTab, setPdaInitialTab] = useState<
    'MAP' | 'MISSIONS' | 'NETWORK' | 'JOURNAL' | 'HANDBOOK'
  >('MAP');
  const [discoveredRegionIds, setDiscoveredRegionIds] = useState<string[]>(initial.discoveredRegionIds);
  const [regionDiscoveryAlert, setRegionDiscoveryAlert] = useState<{
    region: RegionDefinition;
    unlockedCount: number;
  } | null>(null);
  const [cargoModalOpen, setCargoModalOpen] = useState(false);
  const [craftingModalOpen, setCraftingModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogNpcId, setDialogNpcId] = useState<string | null>(null);
  const [stationModalStation, setStationModalStation] = useState<Station | null>(null);
  const [deliveryReport, setDeliveryReport] = useState<{
    mission: DeliveryMission;
    cargo: CargoItem[];
    timeTakenSec: number;
    grade: 'S' | 'A' | 'B' | 'C';
    likes: number;
  } | null>(null);

  // Окно диалога всегда показывает актуальное состояние NPC (например, только что принятое задание).
  const dialogNPC = dialogNpcId ? npcs.find(n => n.id === dialogNpcId) ?? null : null;

  // Направление движения от джойстика, клавиш или пальца на экране (от −1 до 1 по каждой оси).
  const inputVectorRef = useRef({ x: 0, y: 0 });
  const isCanvasDraggingRef = useRef(false);
  const missionStartTimeRef = useRef(initial.missionStartTime);
  // Заказы, для которых терминал станции уже открывался сам (чтобы не открывать повторно).
  const deliveredStationMissionIdsRef = useRef<Set<string>>(
    new Set(boot.kind === 'ok' ? boot.data.arrivedMissionIds : [])
  );

  // Что рядом с курьером: станция, NPC, ресурс (для подсказок и кнопок взаимодействия).
  const nearbyStation =
    stations.find(s => Math.hypot(s.x - hudPlayer.x, s.y - hudPlayer.y) < STATION_INTERACT_RADIUS) || null;
  const nearbyNPC = npcs.find(n => Math.hypot(n.x - hudPlayer.x, n.y - hudPlayer.y) < NPC_INTERACT_RADIUS) || null;
  const nearbyResource =
    resourceNodes.find(
      r => !r.harvested && Math.hypot(r.x - hudPlayer.x, r.y - hudPlayer.y) < RESOURCE_INTERACT_RADIUS
    ) || null;

  // Активное задание NPC и его цель — над ней рисуется голографический маяк.
  const activeQuest = npcs.flatMap(n => n.quests).find(q => q.status === 'ACTIVE');
  const activeQuestTarget = useMemo(
    () =>
      activeQuest?.targetCoordinates
        ? {
            x: activeQuest.targetCoordinates.x,
            y: activeQuest.targetCoordinates.y,
            title: activeQuest.targetName || activeQuest.title
          }
        : null,
    [activeQuest]
  );

  const anyModalOpen = Boolean(
    stationModalStation || pdaOpen || cargoModalOpen || craftingModalOpen || dialogNPC || deliveryReport || menuOpen
  );

  // ----------------------------------------------------------------------
  // «Последнее известное состояние» для игрового цикла и сохранений.
  // Игровой цикл запускается один раз и живёт всю игру, поэтому свежие данные из React
  // он берёт отсюда. Ящик обновляется после каждой перерисовки интерфейса.
  // ----------------------------------------------------------------------
  const latestRef = useRef({
    cargo,
    tools,
    resources,
    structures,
    equippedGear,
    npcs,
    resourceNodes,
    lostCaches,
    stations,
    missions,
    activeMission,
    activeQuest,
    activeQuestTarget,
    totalWeightKg,
    anyModalOpen,
    discoveredRegionIds,
    npcRelations
  });
  useLayoutEffect(() => {
    latestRef.current = {
      cargo,
      tools,
      resources,
      structures,
      equippedGear,
      npcs,
      resourceNodes,
      lostCaches,
      stations,
      missions,
      activeMission,
      activeQuest,
      activeQuestTarget,
      totalWeightKg,
      anyModalOpen,
      discoveredRegionIds,
      npcRelations
    };
  });

  // ======================================================================
  // ПОДГРУЗКА РЕГИОНОВ
  // ======================================================================
  // Загрузить регионы, которых ещё нет в памяти, и добавить их контент в мир.
  const ensureRegionsLoaded = useCallback((regionIds: string[]) => {
    for (const regionId of regionIds) {
      if (loadedRegionIdsRef.current.has(regionId)) continue;
      loadedRegionIdsRef.current.add(regionId);

      loadRegion(regionId)
        .then(content => {
          // Новые аномалии считаются «только что обновлёнными», им нечего догонять.
          const now = gameTimeRef.current;
          anomaliesRef.current = [
            ...anomaliesRef.current,
            ...content.anomalies.map(a => ({ ...a, lastSimulatedAt: now }))
          ];
          // Задания и собранные ресурсы — с учётом прогресса из сохранения.
          setNpcs(prev => [...prev, ...applySavedQuests(content.npcs, savedQuestsRef.current)]);
          setResourceNodes(prev => [
            ...prev,
            ...content.resourceNodes.map(n => (harvestedIdsRef.current.has(n.id) ? { ...n, harvested: true } : n))
          ]);
          setLostCaches(prev => [...prev, ...content.lostCaches]);
          setJournalEntries(prev =>
            [...prev, ...content.journal].sort((a, b) => regionOrder(a.regionId) - regionOrder(b.regionId))
          );
        })
        .catch(() => {
          // Не удалось скачать (например, пропал интернет) — попробуем при следующей проверке.
          loadedRegionIdsRef.current.delete(regionId);
        });
    }
  }, []);

  // При запуске: регион, где стоит курьер, плюс все открытые ранее (их записи нужны дневнику).
  useEffect(() => {
    const p = playerRef.current;
    ensureRegionsLoaded([getRegionAt(p.x, p.y).id, ...initial.discoveredRegionIds]);
  }, [ensureRegionsLoaded, initial]);

  // Курьер сдвинулся на новую клетку: подгрузить соседние регионы и проверить, не вошёл ли
  // он в неоткрытый регион (тогда открываются записи дневника и показывается уведомление).
  const playerTileX = Math.round(hudPlayer.x);
  const playerTileY = Math.round(hudPlayer.y);
  useEffect(() => {
    ensureRegionsLoaded(regionsNearPoint(playerTileX, playerTileY));

    const currentRegion = getRegionAt(playerTileX, playerTileY);
    if (discoveredRegionIds.includes(currentRegion.id)) return;

    setDiscoveredRegionIds(prev => (prev.includes(currentRegion.id) ? prev : [...prev, currentRegion.id]));
    sound.playDiscoveryChime();
    loadRegion(currentRegion.id)
      .then(content => setRegionDiscoveryAlert({ region: currentRegion, unlockedCount: content.journal.length }))
      .catch(() => setRegionDiscoveryAlert({ region: currentRegion, unlockedCount: 0 }));
  }, [playerTileX, playerTileY, discoveredRegionIds, ensureRegionsLoaded]);

  // Уведомление об открытии региона само исчезает через 7 секунд.
  useEffect(() => {
    if (regionDiscoveryAlert) {
      const timer = setTimeout(() => setRegionDiscoveryAlert(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [regionDiscoveryAlert]);

  // ======================================================================
  // СОХРАНЕНИЯ
  // ======================================================================
  const persistGame = useCallback((): boolean => {
    if (savingDisabledRef.current) return false;
    const s = latestRef.current;
    const ok = saveGame({
      player: playerRef.current,
      cargo: s.cargo,
      tools: s.tools,
      resources: s.resources,
      equippedGear: s.equippedGear,
      structures: s.structures,
      missionStatuses: Object.fromEntries(s.missions.map(m => [m.id, m.status])),
      activeMissionId: s.activeMission?.id ?? null,
      missionElapsedSec: (Date.now() - missionStartTimeRef.current) / 1000,
      arrivedMissionIds: [...deliveredStationMissionIdsRef.current],
      connectedStationIds: s.stations.filter(st => st.connected).map(st => st.id),
      discoveredRegionIds: s.discoveredRegionIds,
      // Прогресс незагруженных регионов берём из старого сохранения, загруженных — из игры.
      quests: { ...savedQuestsRef.current, ...collectQuestStates(s.npcs) },
      harvestedResourceNodeIds: [...harvestedIdsRef.current],
      npcRelations: s.npcRelations
    });
    if (ok) {
      setLastSavedAt(new Date());
      // Копия в облако площадки (Telegram, VK), чтобы прогресс был и на других устройствах
      const raw = readRawSave();
      if (raw) platform.pushSave(raw);
    } else {
      setSaveNotice('Не удалось сохранить игру: браузер не даёт записать данные (возможно, закончилось место или включён приватный режим).');
    }
    return ok;
  }, [platform]);

  // Автосохранение каждые 30 секунд, а также когда игрок сворачивает или закрывает вкладку.
  useEffect(() => {
    const interval = setInterval(persistGame, AUTOSAVE_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') persistGame();
    };
    const handleExit = () => {
      persistGame();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleExit);
    window.addEventListener('beforeunload', handleExit);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleExit);
      window.removeEventListener('beforeunload', handleExit);
    };
  }, [persistGame]);

  // «Начать заново» (уже подтверждено игроком в меню): стираем сохранение и перезапускаем страницу.
  const handleRestartGame = async () => {
    // Запрещаем сохранение, иначе сохранение при закрытии страницы записало бы прогресс обратно.
    savingDisabledRef.current = true;
    deleteSave();
    // Стираем и облачную копию, иначе после перезапуска она вернула бы старый прогресс
    await platform.clearSave().catch(() => {});
    window.location.reload();
  };

  // ======================================================================
  // УПРАВЛЕНИЕ ПАЛЬЦЕМ/МЫШЬЮ ПО ХОЛСТУ
  // Курьер идёт в сторону точки касания относительно центра экрана. В круге радиусом
  // 25 пикселей вокруг центра он стоит; на 140 пикселях и дальше идёт в полную силу.
  // ======================================================================
  const updateCanvasInput = useCallback((clientX: number, clientY: number) => {
    const dx = clientX - window.innerWidth / 2;
    const dy = clientY - window.innerHeight / 2;
    const dist = Math.hypot(dx, dy);
    if (dist > 25) {
      const strength = Math.min(1, dist / 140);
      inputVectorRef.current = { x: (dx / dist) * strength, y: (dy / dist) * strength };
    } else {
      inputVectorRef.current = { x: 0, y: 0 };
    }
  }, []);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isCanvasDraggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    updateCanvasInput(e.clientX, e.clientY);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isCanvasDraggingRef.current) {
      updateCanvasInput(e.clientX, e.clientY);
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isCanvasDraggingRef.current) {
      isCanvasDraggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // палец уже отпущен — ничего страшного
      }
      inputVectorRef.current = { x: 0, y: 0 };
    }
  };

  // ======================================================================
  // ПОДГОТОВКА ХОЛСТА: размер под окно, снежинки, колёсико мыши для масштаба
  // ======================================================================
  useEffect(() => {
    if (!canvasRef.current) return;
    rendererRef.current = new TaigaRenderer(canvasRef.current);

    // 90 снежинок: скорость падения 1.5–4 пикселя за кадр, каждая пятая — крупная (2 пикселя).
    const particles = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        speed: 1.5 + Math.random() * 2.5,
        size: Math.random() > 0.8 ? 2 : 1
      });
    }
    snowParticlesRef.current = particles;

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Колёсико мыши: шаг масштаба 0.1. Над окнами и полями ввода колёсико их прокручивает.
    const canvas = canvasRef.current;
    const handleWheel = (e: WheelEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('.modal-content, [role="dialog"], input, textarea')) {
        return;
      }
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      const nextZoom = clampZoom(zoomRef.current + delta);
      setZoom(nextZoom);
      zoomRef.current = nextZoom;
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Звук ветра меняется вместе с погодой.
  useEffect(() => {
    sound.updateWeatherWind(weather.type, weather.windSpeed);
  }, [weather.type, weather.windSpeed]);

  // Браузеры разрешают звук только после первого нажатия игрока — тогда и включаем ветер.
  useEffect(() => {
    const handleFirstInteraction = () => {
      sound.init();
      sound.updateWeatherWind(weatherRef.current.type, weatherRef.current.windSpeed);
    };
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  // ======================================================================
  // ИГРОВОЙ ЦИКЛ — 60 раз в секунду
  // Запускается один раз. Ничего из того, что здесь меняется каждый кадр, не трогает React:
  // интерфейс обновляется только по событиям (упал, сменилась погода) и раз в 0.1 секунды.
  // ======================================================================
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    const timers: PlayerStepTimers = { stepCycle: 0, heartbeatTimer: 0 };
    let hudTimer = 0;

    const loop = (currentTime: number) => {
      // Сколько секунд прошло с прошлого кадра. Не больше 0.1 с: если вкладка «подвисла»
      // или была свёрнута, курьер не должен телепортироваться на огромный шаг.
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      gameTimeRef.current += dt;
      const gameTime = gameTimeRef.current;
      const s = latestRef.current;

      // --- 1. Погода ---
      const weatherTick = tickWeather(weatherRef.current, dt);
      weatherRef.current = weatherTick.weather;
      const currentWeather = weatherTick.weather;
      if (weatherTick.changed) {
        sound.updateWeatherWind(currentWeather.type, currentWeather.windSpeed);
        setWeather(currentWeather);
      }

      // --- 2. Курьер: движение, баланс, выживание ---
      const step = stepPlayer(
        playerRef.current,
        {
          input: inputVectorRef.current,
          dt,
          tiles: world.tiles,
          structures: s.structures,
          weather: currentWeather,
          gear: s.equippedGear,
          totalWeightKg: s.totalWeightKg
        },
        timers
      );
      const player = step.player;
      playerRef.current = player;

      if (step.events.footstep) {
        sound.playFootstep(step.events.footstep.deepSnow);
        footstepsRef.current.push({
          x: player.x,
          y: player.y,
          angle: player.facingAngle,
          isLeft: footstepsRef.current.length % 2 === 0,
          depth: step.events.footstep.deepSnow ? 2 : 1,
          alpha: 1.0
        });
        // Храним последние 120 следов, самые старые исчезают.
        if (footstepsRef.current.length > 120) {
          footstepsRef.current.shift();
        }
      }
      if (step.events.stumbleWarning) sound.playStumbleWarning();
      if (step.events.fell) {
        sound.playCargoImpact();
        // Падение бьёт каждый контейнер на 15–30% целостности, но не ниже 10%.
        setCargo(prevCargo =>
          prevCargo.map(c => ({
            ...c,
            currentIntegrity: Math.max(10, c.currentIntegrity - (15 + Math.random() * 15))
          }))
        );
      }
      if (step.events.heartbeat) sound.playHeartbeat();

      // --- 3. Аномалии: полный расчёт только в зоне активности вокруг курьера ---
      const canvas = canvasRef.current;
      const activityRadius = getActivityRadius(
        canvas?.width ?? window.innerWidth,
        canvas?.height ?? window.innerHeight,
        zoomRef.current
      );
      anomaliesRef.current = anomaliesRef.current.map(anom => {
        // Далеко от курьера и не нужна для задания — «спит», не тратим на неё время.
        if (!shouldSimulate(anom, player, activityRadius, s.activeQuestTarget)) return anom;
        // Только что проснулась — сначала догоняем пропущенное время, потом обычный кадр.
        const result = updateAnomaly(wakeUpIfDormant(anom, gameTime), player, s.structures, dt, gameTime);
        if (result.tickVolume !== null) sound.playAnomalyTick(result.tickVolume);
        return result.anomaly;
      });

      // --- 4. Следы тают: полностью исчезают примерно за 50 секунд ---
      footstepsRef.current.forEach(footstep => {
        footstep.alpha = Math.max(0, footstep.alpha - dt * 0.02);
      });

      // --- 5. Снежинки падают (в буран втрое быстрее) и сносятся ветром ---
      if (canvas) {
        const w = canvas.width;
        const h = canvas.height;
        const fallSpeed =
          currentWeather.type === 'BLIZZARD' ? 3.2 : currentWeather.type === 'HEAVY_SNOWFALL' ? 2.0 : 1.0;
        snowParticlesRef.current.forEach(p => {
          p.y += p.speed * fallSpeed;
          p.x += currentWeather.windX * currentWeather.windSpeed * 0.8;
          // Вылетевшая за край снежинка возвращается с другой стороны экрана.
          if (p.y > h) p.y = -5;
          if (p.x > w) p.x = 0;
          if (p.x < 0) p.x = w;
        });
      }

      // --- 6. Курьер дошёл до станции назначения — терминал открывается сам (один раз) ---
      if (s.activeMission && !deliveredStationMissionIdsRef.current.has(s.activeMission.id) && !s.anyModalOpen) {
        const targetStation = s.stations.find(st => st.id === s.activeMission!.targetStationId);
        if (
          targetStation &&
          Math.hypot(targetStation.x - player.x, targetStation.y - player.y) < STATION_ARRIVAL_RADIUS
        ) {
          deliveredStationMissionIdsRef.current.add(s.activeMission.id);
          setStationModalStation(targetStation);
        }
      }

      // --- 7. Нарисовать кадр ---
      rendererRef.current?.render(
        world.tiles,
        player,
        s.cargo,
        s.structures,
        anomaliesRef.current,
        currentWeather,
        footstepsRef.current,
        s.lostCaches,
        snowParticlesRef.current,
        currentTime,
        s.resourceNodes,
        s.npcs,
        s.activeQuestTarget,
        zoomRef.current
      );

      // --- 8. Обновить интерфейс, но не чаще 10 раз в секунду и только если есть что показать ---
      hudTimer += dt;
      if (hudTimer >= HUD_REFRESH_INTERVAL_SEC) {
        hudTimer = 0;
        if (playerHudKey(player) !== hudKeyRef.current) syncHud();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [world, syncHud]);

  // ======================================================================
  // ДЕЙСТВИЯ ИГРОКА
  // ======================================================================

  // Отметить в отношениях с NPC: познакомились, выполнили задание, поторговали.
  const updateRelation = (npcId: string, change: (r: NPCRelation) => NPCRelation) => {
    setNpcRelations(prev => ({
      ...prev,
      [npcId]: change(prev[npcId] ?? { met: false, questsCompleted: 0, trades: 0 })
    }));
  };

  const openDialog = (npc: WorldNPC) => {
    setDialogNpcId(npc.id);
    updateRelation(npc.id, r => ({ ...r, met: true }));
  };

  // Импульс сканера «Эхо-4»: подсвечивает клетки вокруг и засчитывает исследовательские задания.
  const handleScanPulse = useCallback(() => {
    const player = playerRef.current;
    if (player.scannerCooldown > 0) return;

    sound.playScannerPing();

    // Во время полярного сияния сканер бьёт дальше (12 клеток вместо 9)
    // и перезаряжается быстрее (2 секунды вместо 3.5).
    const isAurora = weatherRef.current.type === 'ANOMALOUS_AURORA';
    const scanRadius = isAurora ? 12 : 9;

    // Подсветка клеток держится 4 секунды (последние 2 — плавно гаснет, см. TaigaRenderer).
    const now = performance.now();
    const pCol = Math.floor(player.x);
    const pRow = Math.floor(player.y);
    for (let dy = -scanRadius; dy <= scanRadius; dy++) {
      for (let dx = -scanRadius; dx <= scanRadius; dx++) {
        const r = pRow + dy;
        const c = pCol + dx;
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS && Math.hypot(dx, dy) <= scanRadius) {
          world.tiles[r][c].scannedUntil = now + 4000;
        }
      }
    }

    // Исследовательское задание: скан рядом с целью засчитывает его.
    const quest = latestRef.current.activeQuest;
    if (quest && quest.type === 'EXPLORATION' && quest.targetCoordinates) {
      const distToTarget = Math.hypot(quest.targetCoordinates.x - player.x, quest.targetCoordinates.y - player.y);
      if (distToTarget < QUEST_SCAN_RADIUS) {
        setNpcs(prevNpcs =>
          prevNpcs.map(n => ({
            ...n,
            quests: n.quests.map(q => (q.id === quest.id ? { ...q, progress: q.maxProgress } : q))
          }))
        );
        sound.playDeliverySuccess();
      }
    }

    updatePlayer(prev => ({
      ...prev,
      scannerActive: true,
      scannerPulseProgress: 0,
      scannerCooldown: isAurora ? 2000 : 3500
    }));
  }, [world, updatePlayer]);

  // Сбор ресурса рядом с курьером (клавиша F или кнопка): +15 лайков.
  const handleHarvestResource = () => {
    if (!nearbyResource) return;

    sound.playHarvest();

    setResources(prev => {
      const existing = prev.find(r => r.type === nearbyResource.type);
      if (existing) {
        return prev.map(r =>
          r.type === nearbyResource.type ? { ...r, count: r.count + nearbyResource.amount } : r
        );
      }
      const resInfo = ALL_RESOURCES[nearbyResource.type];
      return [
        ...prev,
        {
          type: nearbyResource.type,
          name: nearbyResource.name,
          count: nearbyResource.amount,
          icon: resInfo.icon,
          weightKg: resInfo.weightKg,
          description: resInfo.description
        }
      ];
    });

    harvestedIdsRef.current.add(nearbyResource.id);
    setResourceNodes(prev => prev.map(n => (n.id === nearbyResource.id ? { ...n, harvested: true } : n)));

    updatePlayer(prev => ({ ...prev, totalLikes: prev.totalLikes + 15 }));
  };

  // Клавиши: E — поговорить/открыть станцию, F — собрать ресурс.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'KeyE') {
        if (nearbyStation && !stationModalStation && !dialogNPC && !pdaOpen) {
          setStationModalStation(nearbyStation);
        } else if (nearbyNPC && !dialogNPC && !stationModalStation && !pdaOpen) {
          openDialog(nearbyNPC);
        }
      } else if (e.code === 'KeyF') {
        if (nearbyResource && !nearbyResource.harvested) {
          handleHarvestResource();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Использовать инструмент: термос выпивается, остальное ставится на землю под курьером.
  const handleUseTool = (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);
    if (!tool || tool.count <= 0) return;

    if (tool.type === 'THERMAL_FLASK') {
      // Термос: +45 тепла, +35 выносливости.
      sound.playThermosSip();
      updatePlayer(prev => ({
        ...prev,
        warmth: Math.min(100, prev.warmth + 45),
        stamina: Math.min(prev.maxStamina, prev.stamina + 35)
      }));
    } else {
      sound.playToolDeploy();
      let structType: PlacedStructure['type'] = 'CAMPFIRE';
      if (tool.type === 'CLIMBING_ROPE') structType = 'ROPE';
      else if (tool.type === 'LADDER') structType = 'LADDER';
      else if (tool.type === 'SHELTER_KIT') structType = 'SHELTER';
      else if (tool.type === 'FLARE') structType = 'FLARE';
      else if (tool.type === 'BEACON') structType = 'BEACON';

      const { x, y } = playerRef.current;
      setStructures(prev => [...prev, { id: `struct_${Date.now()}`, type: structType, x, y }]);
    }

    setTools(prev => prev.map(t => (t.id === toolId ? { ...t, count: t.count - 1 } : t)));
  };

  // Крафт: списать ингредиенты и выдать результат. За каждый крафт +35 лайков.
  const handleCraftRecipe = (recipe: CraftingRecipe) => {
    setResources(prev =>
      prev.map(r => {
        const ing = recipe.ingredients.find(i => i.type === r.type);
        return ing ? { ...r, count: Math.max(0, r.count - ing.amount) } : r;
      })
    );

    if (recipe.category === 'CLOTHING') {
      // Одежда сразу надевается. Числа — сила эффекта (см. playerPhysics.ts):
      // парка −35% замерзания, маска −35% раскачки ветром, ботинки −50% износа.
      if (recipe.resultType === 'GEAR_PARKA') {
        setEquippedGear(prev => ({
          ...prev,
          coat: { id: recipe.id, name: recipe.name, coldResist: 0.35, icon: recipe.icon }
        }));
      } else if (recipe.resultType === 'GEAR_SNOWSHOES') {
        setEquippedGear(prev => ({
          ...prev,
          snowshoes: { id: recipe.id, name: recipe.name, speedBonus: 0.65, icon: recipe.icon }
        }));
      } else if (recipe.resultType === 'GEAR_MASK') {
        setEquippedGear(prev => ({
          ...prev,
          mask: { id: recipe.id, name: recipe.name, windResist: 0.4, icon: recipe.icon }
        }));
      } else if (recipe.resultType === 'GEAR_BOOTS_REINFORCED') {
        setEquippedGear(prev => ({
          ...prev,
          reinforcedBoots: { id: recipe.id, name: recipe.name, durabilityBonus: 0.5, icon: recipe.icon }
        }));
      }
    } else if (recipe.category === 'TOOL' || recipe.category === 'SHELTER') {
      // Инструмент добавляется в инвентарь (или увеличивается их количество).
      const toolMap: Record<string, ToolItem['type']> = {
        TOOL_SHELTER: 'SHELTER_KIT',
        TOOL_FLARE: 'FLARE',
        TOOL_CAMPFIRE: 'CAMPFIRE',
        TOOL_ROPE: 'CLIMBING_ROPE',
        TOOL_LADDER: 'LADDER',
        TOOL_THERMAL_FLASK: 'THERMAL_FLASK'
      };
      const mappedType = toolMap[recipe.resultType] || 'CAMPFIRE';
      setTools(prev => {
        const existing = prev.find(t => t.type === mappedType);
        if (existing) {
          return prev.map(t => (t.type === mappedType ? { ...t, count: t.count + recipe.resultCount } : t));
        }
        return [
          ...prev,
          {
            id: `tool_${Date.now()}`,
            name: recipe.name,
            type: mappedType,
            count: recipe.resultCount,
            weightKg: 1.5,
            icon: recipe.icon,
            description: recipe.description
          }
        ];
      });
    } else if (recipe.category === 'SURVIVAL') {
      // Расходник выживания применяется сразу: +50 тепла, +50 выносливости, +30 обуви.
      sound.playThermosSip();
      updatePlayer(prev => ({
        ...prev,
        warmth: Math.min(100, prev.warmth + 50),
        stamina: Math.min(prev.maxStamina, prev.stamina + 50),
        bootsIntegrity: Math.min(100, prev.bootsIntegrity + 30)
      }));
    }

    updatePlayer(prev => ({ ...prev, totalLikes: prev.totalLikes + 35 }));
  };

  // Принять задание NPC.
  const handleAcceptQuest = (questId: string) => {
    sound.playQuestAccept();
    setNpcs(prev =>
      prev.map(n => ({
        ...n,
        quests: n.quests.map(q => (q.id === questId ? { ...q, status: 'ACTIVE' } : q))
      }))
    );
  };

  // Сдать задание NPC: списать требуемые ресурсы, выдать лайки и награды.
  const handleTurnInQuest = (questId: string) => {
    const targetQuest = npcs.flatMap(n => n.quests).find(q => q.id === questId);
    if (!targetQuest) return;

    sound.playQuestComplete();

    if (targetQuest.requiredResources) {
      setResources(prev =>
        prev.map(r => {
          const req = targetQuest.requiredResources?.find(rr => rr.type === r.type);
          return req ? { ...r, count: Math.max(0, r.count - req.amount) } : r;
        })
      );
    }

    updatePlayer(prev => ({ ...prev, totalLikes: prev.totalLikes + targetQuest.rewardLikes }));

    // Предметы-награды пока выдаются как фальшфейеры с названием и иконкой награды.
    if (targetQuest.rewardItems) {
      targetQuest.rewardItems.forEach(item => {
        setTools(prev => [
          ...prev,
          {
            id: `reward_${Date.now()}_${item.name}`,
            name: item.name,
            type: 'FLARE',
            count: item.count,
            weightKg: 0.5,
            icon: item.icon,
            description: 'Награда за выполнение задания исследователя.'
          }
        ]);
      });
    }

    setNpcs(prev =>
      prev.map(n => ({
        ...n,
        quests: n.quests.map(q => (q.id === questId ? { ...q, status: 'COMPLETED' } : q))
      }))
    );
    updateRelation(targetQuest.npcId, r => ({ ...r, questsCompleted: r.questsCompleted + 1 }));
  };

  // Купить у NPC за лайки.
  const handleBuyTradeItem = (item: TradeItem) => {
    if (playerRef.current.totalLikes < item.priceLikes) return;

    sound.playTradeSuccess();
    updatePlayer(prev => ({ ...prev, totalLikes: prev.totalLikes - item.priceLikes }));

    if (item.category === 'RESOURCE') {
      const resType = item.itemKey as ResourceItem['type'];
      setResources(prev => {
        const existing = prev.find(r => r.type === resType);
        if (existing) {
          return prev.map(r => (r.type === resType ? { ...r, count: r.count + 1 } : r));
        }
        const resInfo = ALL_RESOURCES[resType];
        return [
          ...prev,
          {
            type: resType,
            name: item.name,
            count: 1,
            icon: item.icon,
            weightKg: resInfo?.weightKg || 0.5,
            description: item.description
          }
        ];
      });
    } else if (item.category === 'TOOL') {
      setTools(prev => [
        ...prev,
        {
          id: `trade_tool_${Date.now()}`,
          name: item.name,
          type: item.itemKey === 'TOOL_FLARE' ? 'FLARE' : 'CAMPFIRE',
          count: 1,
          weightKg: 0.8,
          icon: item.icon,
          description: item.description
        }
      ]);
    }
    if (dialogNpcId) updateRelation(dialogNpcId, r => ({ ...r, trades: r.trades + 1 }));
  };

  // Продать NPC ресурс за лайки.
  const handleSellResource = (resourceType: string, amount: number, priceLikes: number) => {
    const res = resources.find(r => r.type === resourceType);
    if (!res || res.count < amount) return;

    sound.playTradeSuccess();
    setResources(prev => prev.map(r => (r.type === resourceType ? { ...r, count: r.count - amount } : r)));
    updatePlayer(prev => ({ ...prev, totalLikes: prev.totalLikes + priceLikes }));
    if (dialogNpcId) updateRelation(dialogNpcId, r => ({ ...r, trades: r.trades + 1 }));
  };

  // Взять заказ в КПК: груз заказа кладётся в рюкзак, таймер заказа запускается.
  const handleAcceptMission = (missionId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;

    setActiveMission(mission);
    setCargo(mission.cargoItems);
    missionStartTimeRef.current = Date.now();
    setMissions(prev => prev.map(m => (m.id === missionId ? { ...m, status: 'IN_TRANSIT' } : m)));
    setPdaOpen(false);
  };

  /**
   * Сдать заказ на станции. Оценка:
   *  S — груз цел в среднем на 90% и больше И уложились в срок заказа (бонус +300 лайков);
   *  A — целость от 75% (бонус +150); B — от 50% (+50); C — меньше 50% (+50).
   */
  const handleDeliverMission = () => {
    if (!activeMission || !stationModalStation) return;

    sound.playDeliverySuccess();

    const timeTaken = (Date.now() - missionStartTimeRef.current) / 1000;
    const avgIntegrity = cargo.reduce((a, b) => a + b.currentIntegrity, 0) / cargo.length;

    let grade: 'S' | 'A' | 'B' | 'C' = 'B';
    if (avgIntegrity >= 90 && timeTaken < activeMission.timeLimitSec) {
      grade = 'S';
    } else if (avgIntegrity >= 75) {
      grade = 'A';
    } else if (avgIntegrity >= 50) {
      grade = 'B';
    } else {
      grade = 'C';
    }

    const bonusLikes = grade === 'S' ? 300 : grade === 'A' ? 150 : 50;
    const totalLikesEarned = activeMission.rewardLikes + bonusLikes;

    // Станция подключается к сети «Евразия».
    setStations(prev => prev.map(s => (s.id === stationModalStation.id ? { ...s, connected: true } : s)));
    setMissions(prev => prev.map(m => (m.id === activeMission.id ? { ...m, status: 'COMPLETED' } : m)));

    updatePlayer(prev => ({
      ...prev,
      totalLikes: prev.totalLikes + totalLikesEarned,
      deliveredDeliveries: prev.deliveredDeliveries + 1
    }));

    setDeliveryReport({
      mission: activeMission,
      cargo,
      timeTakenSec: timeTaken,
      grade,
      likes: totalLikesEarned
    });

    setActiveMission(null);
    setCargo([]);
    setStationModalStation(null);
  };

  // Отдых на станции: все показатели до 100%.
  const handleRestAndRefuel = () => {
    sound.playThermosSip();
    updatePlayer(prev => ({ ...prev, warmth: 100, stamina: 100, battery: 100, bootsIntegrity: 100 }));
  };

  // Пополнить инструмент на станции: +1 штука.
  const handleRestockTool = (toolType: ToolItem['type']) => {
    sound.playToolDeploy();
    setTools(prev => prev.map(t => (t.type === toolType ? { ...t, count: t.count + 1 } : t)));
  };

  // Автоукладка груза: самый тяжёлый вниз рюкзака, дальше — наверх, на лямки, в середину.
  // После укладки баланс выравнивается.
  const handleAutoArrangeCargo = () => {
    sound.playToolDeploy();
    const sorted = [...cargo].sort((a, b) => b.weightKg - a.weightKg);
    const arranged = sorted.map((item, idx) => {
      let slot: CargoItem['slot'] = 'BACKPACK_MID';
      if (idx === 0) slot = 'BACKPACK_BOTTOM';
      else if (idx === 1) slot = 'BACKPACK_TOP';
      else if (idx === 2) slot = 'LEFT_STRAP';
      else if (idx === 3) slot = 'RIGHT_STRAP';
      return { ...item, slot };
    });
    setCargo(arranged);
    updatePlayer(prev => ({ ...prev, balance: 0 }));
  };

  // Починить контейнер термопеной: целость до 100%.
  const handleRepairCargo = (cargoId: string) => {
    sound.playToolDeploy();
    setCargo(prev => prev.map(c => (c.id === cargoId ? { ...c, currentIntegrity: 100 } : c)));
  };

  const handleToggleMute = () => {
    setIsMuted(sound.toggleMute());
  };

  // ======================================================================
  // ЭКРАН: холст с миром и окна интерфейса поверх него
  // ======================================================================
  return (
    <main
      id="game-viewport-container"
      className="relative w-screen h-screen overflow-hidden bg-neutral-950 font-mono-tech select-none"
    >
      {/* Холст, на котором рисуется мир. Касание/клик по нему ведёт курьера. */}
      <canvas
        ref={canvasRef}
        id="taiga-pixel-canvas"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        className="w-full h-full block pixel-art touch-none cursor-pointer"
      />

      {/* Эффект старого ЭЛТ-монитора (полосы развёртки) */}
      <div className="crt-overlay absolute inset-0 pointer-events-none" />

      {/* HUD: шкалы выживания, баланс, погода, инструменты, подсказки, масштаб */}
      <GameHUD
        player={hudPlayer}
        cargo={cargo}
        activeMission={activeMission}
        weather={weather}
        tools={tools}
        resources={resources}
        playerLikes={hudPlayer.totalLikes}
        nearbyNPC={nearbyNPC}
        nearbyResource={nearbyResource}
        nearbyStation={nearbyStation}
        structures={structures}
        isMuted={isMuted}
        zoom={zoom}
        onChangeZoom={handleZoomChange}
        onToggleMute={handleToggleMute}
        onOpenMenu={() => setMenuOpen(true)}
        onOpenPDA={(tab) => {
          setPdaInitialTab(tab || 'MAP');
          setPdaOpen(true);
        }}
        onOpenCargo={() => setCargoModalOpen(true)}
        onOpenCrafting={() => setCraftingModalOpen(true)}
        onInteractNPC={() => {
          if (nearbyNPC) openDialog(nearbyNPC);
        }}
        onHarvestResource={handleHarvestResource}
        onOpenStation={() => {
          if (nearbyStation) setStationModalStation(nearbyStation);
        }}
        onUseTool={handleUseTool}
      />

      {/* Экранные кнопки для телефона: джойстик, лямки [Л]/[П], сканер, дыхание, бег */}
      <VirtualControls
        onMove={(dx, dy) => {
          inputVectorRef.current = { x: dx, y: dy };
        }}
        onBraceLeft={(active) => updatePlayer(prev => ({ ...prev, isBracingLeft: active }))}
        onBraceRight={(active) => updatePlayer(prev => ({ ...prev, isBracingRight: active }))}
        onScan={handleScanPulse}
        onHoldBreath={(active) => updatePlayer(prev => ({ ...prev, isHoldingBreath: active }))}
        onSprint={(active) => updatePlayer(prev => ({ ...prev, isSprinting: active }))}
        isHoldingBreath={hudPlayer.isHoldingBreath}
        isBracingLeft={hudPlayer.isBracingLeft}
        isBracingRight={hudPlayer.isBracingRight}
        isSprinting={hudPlayer.isSprinting}
        scannerCooldown={hudPlayer.scannerCooldown}
        stumbleAlert={hudPlayer.stumbleAlert}
      />

      {craftingModalOpen && (
        <CraftingModal
          resources={resources}
          equippedGear={equippedGear}
          onCraftRecipe={handleCraftRecipe}
          onClose={() => setCraftingModalOpen(false)}
        />
      )}

      {dialogNPC && (
        <NPCDialogModal
          npc={dialogNPC}
          playerLikes={hudPlayer.totalLikes}
          resources={resources}
          tools={tools}
          onAcceptQuest={handleAcceptQuest}
          onTurnInQuest={handleTurnInQuest}
          onBuyItem={handleBuyTradeItem}
          onSellResource={handleSellResource}
          onClose={() => setDialogNpcId(null)}
        />
      )}

      {pdaOpen && (
        <DeliveryPDA
          initialTab={pdaInitialTab}
          player={hudPlayer}
          stations={stations}
          missions={missions}
          structures={structures}
          activeMission={activeMission}
          discoveredRegionIds={discoveredRegionIds}
          journalEntries={journalEntries}
          onAcceptMission={handleAcceptMission}
          onClose={() => setPdaOpen(false)}
        />
      )}

      {menuOpen && (
        <GameMenuModal
          lastSavedAt={lastSavedAt}
          savingDisabledReason={savingDisabledReason}
          onSaveNow={() => {
            if (persistGame()) setMenuOpen(false);
          }}
          onRestart={handleRestartGame}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {/* Сообщение о сохранении (обновлено, повреждено, не удалось записать) */}
      {saveNotice && (
        <aside
          aria-label="Сообщение о сохранении"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] bg-neutral-950/95 border-2 border-amber-500/80 rounded-2xl p-3.5 shadow-xl backdrop-blur-md flex items-start justify-between gap-3 font-mono-tech select-none"
        >
          <div className="flex items-start gap-3">
            <Save className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-100 leading-relaxed">{saveNotice}</div>
          </div>
          <button
            type="button"
            onClick={() => setSaveNotice(null)}
            className="p-1.5 text-neutral-400 hover:text-white text-xs transition-colors"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </aside>
      )}

      {/* Всплывающее уведомление об открытии нового региона */}
      {regionDiscoveryAlert && (
        <aside
          aria-label="Уведомление об открытии региона"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] sm:w-auto bg-neutral-950/95 border-2 border-emerald-500/80 rounded-2xl p-3.5 shadow-[0_0_30px_rgba(16,185,129,0.35)] backdrop-blur-md flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 font-mono-tech select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/90 border border-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
              <Compass className="w-5 h-5 text-emerald-300 animate-spin" style={{ animationDuration: '12s' }} />
            </div>
            <div>
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                <span>ОТКРЫТ НОВЫЙ РЕГИОН ТАЙГИ</span>
              </div>
              <div className="text-sm font-bold text-white leading-tight">
                {regionDiscoveryAlert.region.name}
              </div>
              <div className="text-[11px] text-emerald-200/80 mt-0.5">
                Записей добавлено в дневник: +{regionDiscoveryAlert.unlockedCount}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-open-journal-from-alert"
              type="button"
              onClick={() => {
                setRegionDiscoveryAlert(null);
                setPdaInitialTab('JOURNAL');
                setPdaOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all whitespace-nowrap active:scale-95 border border-emerald-400/50"
            >
              К ЗАПИСЯМ
            </button>
            <button
              id="btn-close-journal-alert"
              type="button"
              onClick={() => setRegionDiscoveryAlert(null)}
              className="p-1.5 text-neutral-400 hover:text-white text-xs transition-colors"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>
        </aside>
      )}

      {cargoModalOpen && (
        <CargoInventoryModal
          cargo={cargo}
          tools={tools}
          maxWeightKg={45.0}
          onAutoArrange={handleAutoArrangeCargo}
          onRepairCargo={handleRepairCargo}
          onClose={() => setCargoModalOpen(false)}
        />
      )}

      {stationModalStation && (
        <StationTerminalModal
          station={stationModalStation}
          cargo={cargo}
          activeMission={activeMission}
          onDeliverMission={handleDeliverMission}
          onRestAndRefuel={handleRestAndRefuel}
          onRestockTool={handleRestockTool}
          onClose={() => setStationModalStation(null)}
        />
      )}

      {deliveryReport && (
        <DeliveryReportModal
          mission={deliveryReport.mission}
          cargo={deliveryReport.cargo}
          timeTakenSec={deliveryReport.timeTakenSec}
          grade={deliveryReport.grade}
          totalLikesEarned={deliveryReport.likes}
          onContinue={() => setDeliveryReport(null)}
        />
      )}
    </main>
  );
}
