import { useState, useEffect, useRef, useCallback } from 'react';
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
  TradeItem
} from './types/game';
import { STATIONS, INITIAL_TOOLS, INITIAL_MISSIONS, MAP_COLS, MAP_ROWS } from './utils/constants';
import { generateWorld } from './utils/mapGenerator';
import { INITIAL_PLAYER_RESOURCES, ALL_RESOURCES } from './utils/craftingData';
import { TaigaRenderer } from './game/TaigaRenderer';
import { sound } from './utils/audio';
import { VirtualControls } from './components/VirtualControls';
import { GameHUD } from './components/GameHUD';
import { DeliveryPDA } from './components/DeliveryPDA';
import { CargoInventoryModal } from './components/CargoInventoryModal';
import { StationTerminalModal } from './components/StationTerminalModal';
import { DeliveryReportModal } from './components/DeliveryReportModal';
import { CraftingModal } from './components/CraftingModal';
import { NPCDialogModal } from './components/NPCDialogModal';
import { getRegionAt, getEntriesForRegion } from './utils/journalData';
import { RegionDefinition } from './types/journal';
import { Compass, Sparkles } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TaigaRenderer | null>(null);

  // Sound state
  const [isMuted, setIsMuted] = useState(false);

  // Camera Zoom & Dynamic LOD Scale (0.65x to 2.5x)
  const [zoom, setZoom] = useState<number>(1.0);
  const zoomRef = useRef<number>(1.0);

  const handleZoomChange = useCallback((newZoom: number) => {
    const clamped = Math.max(0.65, Math.min(2.5, Math.round(newZoom * 100) / 100));
    setZoom(clamped);
    zoomRef.current = clamped;
  }, []);

  // World Data
  const worldRef = useRef(generateWorld());
  const [stations, setStations] = useState<Station[]>(STATIONS);
  const [missions, setMissions] = useState<DeliveryMission[]>(INITIAL_MISSIONS);
  const [structures, setStructures] = useState<PlacedStructure[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEntity[]>(worldRef.current.anomalies);
  const [lostCaches, setLostCaches] = useState(worldRef.current.lostCaches);
  const [resourceNodes, setResourceNodes] = useState<WorldResourceNode[]>(worldRef.current.resourceNodes);
  const [npcs, setNpcs] = useState<WorldNPC[]>(worldRef.current.npcs);

  // Cargo, Tools, Resources & Equipped Gear
  const [cargo, setCargo] = useState<CargoItem[]>(INITIAL_MISSIONS[0].cargoItems);
  const [tools, setTools] = useState<ToolItem[]>(INITIAL_TOOLS);
  const [resources, setResources] = useState<ResourceItem[]>(INITIAL_PLAYER_RESOURCES);
  const [equippedGear, setEquippedGear] = useState<EquippedGear>({});
  const [activeMission, setActiveMission] = useState<DeliveryMission | null>(INITIAL_MISSIONS[0]);

  // Player State
  const [player, setPlayer] = useState<PlayerStats>({
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
  });

  // Dynamic Weather State
  const [weather, setWeather] = useState<WeatherState>({
    type: 'CLEAR_FROST',
    nameRu: 'Ясный мороз',
    windX: 1,
    windY: 0.5,
    windSpeed: 3.5,
    visibility: 0.95,
    anomalyIntensity: 0.2,
    tempCelsius: -22,
    timeToChange: 40,
    dangerLevel: 'LOW',
    description: 'Чистое небо и морозный воздух. Стабильное сцепление.'
  });

  // Footsteps & Snow Particles
  const footstepsRef = useRef<Footstep[]>([]);
  const snowParticlesRef = useRef<
    { x: number; y: number; speed: number; size: number }[]
  >([]);

  // Modals & UI overlays
  const [pdaOpen, setPdaOpen] = useState(false);
  const [pdaInitialTab, setPdaInitialTab] = useState<
    'MAP' | 'MISSIONS' | 'NETWORK' | 'JOURNAL' | 'HANDBOOK'
  >('MAP');
  const [discoveredRegionIds, setDiscoveredRegionIds] = useState<string[]>(['region_basin']);
  const [regionDiscoveryAlert, setRegionDiscoveryAlert] = useState<{
    region: RegionDefinition;
    unlockedCount: number;
  } | null>(null);
  const [cargoModalOpen, setCargoModalOpen] = useState(false);
  const [craftingModalOpen, setCraftingModalOpen] = useState(false);
  const [dialogNPC, setDialogNPC] = useState<WorldNPC | null>(null);
  const [stationModalStation, setStationModalStation] = useState<Station | null>(null);
  const [deliveryReport, setDeliveryReport] = useState<{
    mission: DeliveryMission;
    cargo: CargoItem[];
    timeTakenSec: number;
    grade: 'S' | 'A' | 'B' | 'C';
    likes: number;
  } | null>(null);
  const [isGameOver] = useState(false);

  // Input vector from joystick / keyboard / canvas
  const inputVectorRef = useRef({ x: 0, y: 0 });
  const isCanvasDraggingRef = useRef(false);
  const missionStartTimeRef = useRef(Date.now());
  const deliveredStationMissionIdsRef = useRef<Set<string>>(new Set());

  // Check for nearby interactive NPC, Resource Node, or Station
  const nearbyStation = stations.find(
    s => Math.hypot(s.x - player.x, s.y - player.y) < 2.8
  ) || null;

  const nearbyNPC = npcs.find(
    n => Math.hypot(n.x - player.x, n.y - player.y) < 3.2
  ) || null;

  const nearbyResource = resourceNodes.find(
    r => !r.harvested && Math.hypot(r.x - player.x, r.y - player.y) < 2.5
  ) || null;

  // Direct canvas touch/click-to-move handlers
  const updateCanvasInput = useCallback((clientX: number, clientY: number) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > 25) {
      const maxMag = Math.min(1, dist / 140);
      inputVectorRef.current = {
        x: (dx / dist) * maxMag,
        y: (dy / dist) * maxMag
      };
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
        // safe
      }
      inputVectorRef.current = { x: 0, y: 0 };
    }
  };

  // Find active quest target for holographic renderer column
  const activeQuest = npcs.flatMap(n => n.quests).find(q => q.status === 'ACTIVE');
  const activeQuestTarget = activeQuest?.targetCoordinates
    ? {
        x: activeQuest.targetCoordinates.x,
        y: activeQuest.targetCoordinates.y,
        title: activeQuest.targetName || activeQuest.title
      }
    : null;

  // Initialize Canvas & Renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    rendererRef.current = new TaigaRenderer(canvasRef.current);

    // Populate initial snow particles
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

    // Mouse wheel zoom support with progressive LOD trigger
    const canvas = canvasRef.current;
    const handleWheel = (e: WheelEvent) => {
      // Ignore if hovering over modal or input
      if (e.target instanceof HTMLElement && e.target.closest('.modal-content, [role="dialog"], input, textarea')) {
        return;
      }
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      const nextZoom = Math.max(0.65, Math.min(2.5, Math.round((zoomRef.current + delta) * 100) / 100));
      setZoom(nextZoom);
      zoomRef.current = nextZoom;
    };

    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  // Exploration & Lore snippet unlocks
  useEffect(() => {
    const currentRegion = getRegionAt(player.x, player.y);
    setDiscoveredRegionIds(prev => {
      if (!prev.includes(currentRegion.id)) {
        sound.playDiscoveryChime();
        const entries = getEntriesForRegion(currentRegion.id);
        setRegionDiscoveryAlert({
          region: currentRegion,
          unlockedCount: entries.length
        });
        return [...prev, currentRegion.id];
      }
      return prev;
    });
  }, [Math.round(player.x), Math.round(player.y)]);

  // Auto-dismiss discovery notification banner
  useEffect(() => {
    if (regionDiscoveryAlert) {
      const timer = setTimeout(() => {
        setRegionDiscoveryAlert(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [regionDiscoveryAlert]);

  // Dynamic background wind sound crossfade with weather changes
  useEffect(() => {
    sound.updateWeatherWind(weather.type, weather.windSpeed);
  }, [weather.type, weather.windSpeed]);

  // Unlock Web Audio context and start ambient wind on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      sound.init();
      sound.updateWeatherWind(weather.type, weather.windSpeed);
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [weather.type, weather.windSpeed]);

  // Main 60FPS Game Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let stepCycle = 0;
    let heartbeatTimer = 0;

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // ----------------------------------------------------
      // Dynamic Weather System Transition & Physical Impact
      // ----------------------------------------------------
      setWeather(prev => {
        if (prev.timeToChange <= dt) {
          const weatherCycle: WeatherState['type'][] = [
            'CLEAR_FROST',
            'LIGHT_SNOW',
            'BLIZZARD',
            'EXTREME_COLD',
            'HEAVY_SNOWFALL',
            'ANOMALOUS_AURORA',
            'MAGNETIC_STORM'
          ];
          const nextType = weatherCycle[Math.floor(Math.random() * weatherCycle.length)];
          const config: Record<WeatherState['type'], {
            nameRu: string;
            temp: number;
            windSpeed: number;
            windX: number;
            windY: number;
            visibility: number;
            anomIntensity: number;
            dangerLevel: WeatherState['dangerLevel'];
            description: string;
          }> = {
            CLEAR_FROST: {
              nameRu: 'Ясный мороз',
              temp: -22,
              windSpeed: 2.5,
              windX: 0.8,
              windY: 0.4,
              visibility: 0.95,
              anomIntensity: 0.15,
              dangerLevel: 'LOW',
              description: 'Чистое небо и морозный воздух. Стабильное сцепление.'
            },
            LIGHT_SNOW: {
              nameRu: 'Тихий снегопад',
              temp: -18,
              windSpeed: 3.0,
              windX: 0.5,
              windY: 1.0,
              visibility: 0.85,
              anomIntensity: 0.2,
              dangerLevel: 'LOW',
              description: 'Слабый снег, безопасные условия перемещения.'
            },
            BLIZZARD: {
              nameRu: 'Свирепый буран',
              temp: -34,
              windSpeed: 9.5,
              windX: 2.2,
              windY: 1.4,
              visibility: 0.35,
              anomIntensity: 0.45,
              dangerLevel: 'EXTREME',
              description: 'Шквальный ветер и нулевая видимость! Риск потери груза и замерзания.'
            },
            EXTREME_COLD: {
              nameRu: 'Аномальный мороз (-42°C)',
              temp: -42,
              windSpeed: 4.0,
              windX: 0.6,
              windY: 0.3,
              visibility: 0.8,
              anomIntensity: 0.6,
              dangerLevel: 'HIGH',
              description: 'Критическое падение температуры до -42°C. Ускоренная гипотермия.'
            },
            HEAVY_SNOWFALL: {
              nameRu: 'Глубокий снегопад',
              temp: -16,
              windSpeed: 2.0,
              windX: 0.3,
              windY: 1.8,
              visibility: 0.55,
              anomIntensity: 0.25,
              dangerLevel: 'MEDIUM',
              description: 'Сугробы по колено. Высокий износ обуви и расход выносливости.'
            },
            ANOMALOUS_AURORA: {
              nameRu: 'Полярное сияние (Аномалия)',
              temp: -24,
              windSpeed: 1.8,
              windX: 0.5,
              windY: 0.2,
              visibility: 0.9,
              anomIntensity: 0.85,
              dangerLevel: 'MEDIUM',
              description: 'Ионизация атмосферы. Радар Эхо-4 усиливается, аномалии возбуждены.'
            },
            MAGNETIC_STORM: {
              nameRu: 'Геомагнитная буря',
              temp: -20,
              windSpeed: 6.5,
              windX: -1.5,
              windY: 1.0,
              visibility: 0.65,
              anomIntensity: 0.95,
              dangerLevel: 'HIGH',
              description: 'Геомагнитные помехи. Сенсоры дают сбои, фантомы агрессивны.'
            }
          };

          const c = config[nextType];
          sound.updateWeatherWind(nextType, c.windSpeed);

          return {
            ...prev,
            type: nextType,
            nameRu: c.nameRu,
            tempCelsius: c.temp,
            windSpeed: c.windSpeed,
            windX: c.windX,
            windY: c.windY,
            visibility: c.visibility,
            anomalyIntensity: c.anomIntensity,
            dangerLevel: c.dangerLevel,
            description: c.description,
            timeToChange: 45 + Math.random() * 40
          };
        }
        return { ...prev, timeToChange: prev.timeToChange - dt };
      });

      // ----------------------------------------------------
      // Update Player Physics & Weather Physical Consequences
      // ----------------------------------------------------
      setPlayer(prev => {
        if (isGameOver) return prev;

        const input = inputVectorRef.current;
        const isMoving = Math.abs(input.x) > 0.05 || Math.abs(input.y) > 0.05;

        // Current tile properties
        const curCol = Math.max(0, Math.min(MAP_COLS - 1, Math.floor(prev.x)));
        const curRow = Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(prev.y)));
        const curTile = worldRef.current.tiles[curRow][curCol];

        // Has ladder structure on current tile?
        const hasLadder = structures.some(
          s => s.type === 'LADDER' && Math.hypot(s.x - prev.x, s.y - prev.y) < 1.4
        );

        // Terrain movement factors
        let speedMultiplier = 1.0;
        let isDeepSnow = false;

        if (curTile.type === 'SNOW_DEEP') {
          // Snowshoes crafted gear negates snow penalty!
          speedMultiplier = equippedGear.snowshoes ? 0.88 : 0.55;
          isDeepSnow = true;
        } else if (curTile.type === 'OLD_ROAD' || curTile.type === 'STATION_PLATFORM') {
          speedMultiplier = 1.25;
        } else if (curTile.type === 'ICE_RIVER') {
          speedMultiplier = 1.1; // slippery
        } else if (curTile.type === 'ROCKS' || curTile.type === 'CLIFF') {
          if (!hasLadder) {
            speedMultiplier = 0.35; // very rough without ladder
          }
        }

        // Weather conditions movement impact
        if (weather.type === 'BLIZZARD') {
          speedMultiplier *= 0.6; // Heavy wind resistance
        } else if (weather.type === 'HEAVY_SNOWFALL') {
          speedMultiplier *= 0.75; // Thick powdery snow slowing footsteps
        }

        // Sprint boost or Sneak slowdown
        if (prev.isSprinting && prev.stamina > 5) {
          speedMultiplier *= 1.5;
        } else if (prev.isHoldingBreath) {
          speedMultiplier *= 0.65;
        }

        // Weight carry burden
        const totalCargoWeight = cargo.reduce((acc, c) => acc + c.weightKg, 0);
        const totalToolWeight = tools.reduce((acc, t) => acc + t.weightKg * t.count, 0);
        const totalResourceWeight = resources.reduce((acc, r) => acc + r.weightKg * r.count, 0);
        const totalWeightKg = totalCargoWeight + totalToolWeight + totalResourceWeight;
        const weightFactor = Math.max(0.6, 1 - (totalWeightKg / 55) * 0.4);
        speedMultiplier *= weightFactor;

        // Velocity & Position
        const targetVx = input.x * 2.8 * speedMultiplier;
        const targetVy = input.y * 2.8 * speedMultiplier;
        const friction = curTile.type === 'ICE_RIVER' ? 0.08 : 0.28;
        const newVx = prev.vx + (targetVx - prev.vx) * friction;
        const newVy = prev.vy + (targetVy - prev.vy) * friction;

        let nextX = prev.x + newVx * dt;
        let nextY = prev.y + newVy * dt;

        // Map boundaries clamp
        nextX = Math.max(2, Math.min(MAP_COLS - 3, nextX));
        nextY = Math.max(2, Math.min(MAP_ROWS - 3, nextY));

        // Facing Angle
        const facingAngle = isMoving ? Math.atan2(newVy, newVx) : prev.facingAngle;

        // Footsteps in snow
        if (isMoving) {
          stepCycle += dt * 5 * speedMultiplier;
          if (stepCycle > 1) {
            stepCycle = 0;
            sound.playFootstep(isDeepSnow);
            footstepsRef.current.push({
              x: nextX,
              y: nextY,
              angle: facingAngle,
              isLeft: footstepsRef.current.length % 2 === 0,
              depth: isDeepSnow ? 2 : 1,
              alpha: 1.0
            });
            if (footstepsRef.current.length > 120) {
              footstepsRef.current.shift();
            }
          }
        }

        // ----------------------------------------------------
        // Signature Death Stranding Cargo Balance Physics
        // ----------------------------------------------------
        let newBalance = prev.balance;
        let stumbleAlert: PlayerStats['stumbleAlert'] = 'NONE';
        let isStumbling = prev.isStumbling;
        let stumbleTimer = prev.stumbleTimer;

        if (isMoving && !isStumbling) {
          // Uneven terrain or wind gust shifts center of gravity
          let windPush = weather.windX * (weather.windSpeed / 10) * 0.4;
          if (equippedGear.mask) windPush *= 0.65; // Storm mask lowers wind sway
          const randomTilt = (Math.random() - 0.5) * (isDeepSnow ? 3.5 : 1.8);
          newBalance += (randomTilt + windPush) * (totalWeightKg / 20);

          // Counter-balancing by gripping backpack straps [L] and [R]
          if (prev.isBracingLeft) {
            newBalance -= 38 * dt;
          }
          if (prev.isBracingRight) {
            newBalance += 38 * dt;
          }

          // Natural center-seeking inertia if not overloaded
          if (!prev.isBracingLeft && !prev.isBracingRight) {
            newBalance *= 0.985;
          }
        }

        // Clamp balance
        newBalance = Math.max(-100, Math.min(100, newBalance));

        // Stumble Thresholds
        if (newBalance < -50) {
          stumbleAlert = 'LEFT';
        } else if (newBalance > 50) {
          stumbleAlert = 'RIGHT';
        }

        if (Math.abs(newBalance) > 70 && !isStumbling) {
          stumbleAlert = 'CRITICAL';
          stumbleTimer += dt;
          sound.playStumbleWarning();

          // If unbraced for more than 1.1s: FALL & DAMAGE CARGO!
          if (stumbleTimer > 1.1) {
            isStumbling = true;
            stumbleTimer = 0;
            sound.playCargoImpact();
            // Damage carried cargo containers
            setCargo(prevCargo =>
              prevCargo.map(c => ({
                ...c,
                currentIntegrity: Math.max(10, c.currentIntegrity - (15 + Math.random() * 15))
              }))
            );
          }
        } else {
          stumbleTimer = Math.max(0, stumbleTimer - dt * 2);
        }

        // Recover from stumble
        if (isStumbling) {
          stumbleTimer += dt;
          if (stumbleTimer > 1.8) {
            isStumbling = false;
            stumbleTimer = 0;
            newBalance = 0;
          }
        }

        // ----------------------------------------------------
        // Survival Meters: Warmth, Stamina, Breath, Battery
        // ----------------------------------------------------
        let newStamina = prev.stamina;
        let newWarmth = prev.warmth;
        let newBattery = prev.battery;
        let newBoots = prev.bootsIntegrity;
        let newBreath = prev.breathAir;

        // Shelter / Campfire warmth radius check
        const nearShelter = structures.some(
          s => s.type === 'SHELTER' && Math.hypot(s.x - nextX, s.y - nextY) < 3.5
        );
        const nearCampfire = structures.some(
          s => s.type === 'CAMPFIRE' && Math.hypot(s.x - nextX, s.y - nextY) < 2.5
        );

        if (nearShelter) {
          // Portable shelter full protection
          newWarmth = Math.min(100, newWarmth + 24 * dt);
          newStamina = Math.min(prev.maxStamina, newStamina + 18 * dt);
        } else if (nearCampfire) {
          newWarmth = Math.min(100, newWarmth + 16 * dt);
          newStamina = Math.min(prev.maxStamina, newStamina + 10 * dt);
        } else {
          // Cold exposure calculation based on weather & clothing
          let frostDrain = 0.35;
          if (weather.type === 'BLIZZARD') frostDrain = 1.7;
          else if (weather.type === 'EXTREME_COLD') frostDrain = 2.4;
          else if (weather.type === 'HEAVY_SNOWFALL') frostDrain = 0.65;

          // Gear insulation bonus (e.g. Parka)
          if (equippedGear.coat) {
            frostDrain *= (1 - equippedGear.coat.coldResist);
          }

          newWarmth = Math.max(0, newWarmth - frostDrain * dt);

          // Hypothermia chills stamina
          if (newWarmth < 25) {
            newStamina = Math.max(0, newStamina - 2.5 * dt);
          }
        }

        // Stamina drain from movement / deep snow / sprinting
        if (isMoving) {
          const staminaCost = (prev.isSprinting ? 12 : 3) * (isDeepSnow ? 1.8 : 1.0);
          newStamina = Math.max(0, newStamina - staminaCost * dt);

          let bootWear = curTile.type === 'ROCKS' ? 0.5 : 0.08;
          if (weather.type === 'HEAVY_SNOWFALL') bootWear *= 1.5;
          if (equippedGear.reinforcedBoots) bootWear *= (1 - equippedGear.reinforcedBoots.durabilityBonus);
          newBoots = Math.max(0, newBoots - bootWear * dt);
        } else {
          newStamina = Math.min(prev.maxStamina, newStamina + 12 * dt);
        }

        // Holding breath in stealth near phantoms
        if (prev.isHoldingBreath) {
          newBreath = Math.max(0, newBreath - 18 * dt);
          heartbeatTimer += dt;
          if (heartbeatTimer > 0.8) {
            heartbeatTimer = 0;
            sound.playHeartbeat();
          }
        } else {
          newBreath = Math.min(100, newBreath + 30 * dt);
        }

        // Battery drain or Anomalous Aurora recharge!
        if (weather.type === 'ANOMALOUS_AURORA') {
          newBattery = Math.min(100, newBattery + 2.5 * dt); // Chiral energy trickle
        } else {
          newBattery = Math.max(0, newBattery - 0.08 * dt);
        }

        // Scanner wave expansion
        let scannerProgress = prev.scannerPulseProgress;
        let scannerActive = prev.scannerActive;
        let scannerCooldown = Math.max(0, prev.scannerCooldown - dt * 1000);

        if (scannerActive) {
          scannerProgress += dt * 1.5;
          if (scannerProgress >= 1.0) {
            scannerActive = false;
          }
        }

        return {
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
        };
      });

      // ----------------------------------------------------
      // Update Anomalies AI & Flare Repulsion
      // ----------------------------------------------------
      setAnomalies(prevAnoms => {
        return prevAnoms.map(anom => {
          if (anom.type === 'FROST_PHANTOM') {
            const dist = Math.hypot(anom.x - player.x, anom.y - player.y);

            // Audio click when scanner detects phantom
            if (dist < 6.0 && Math.random() < 0.15) {
              sound.playAnomalyTick(Math.min(1, (7 - dist) / 4));
            }

            // Repelled by nearby magnesium flare
            const nearFlare = structures.some(
              s => s.type === 'FLARE' && Math.hypot(s.x - anom.x, s.y - anom.y) < 5.5
            );

            let suspicion = anom.suspicion;
            if (nearFlare) {
              suspicion = 0;
            } else if (dist < 5.0) {
              if (player.isHoldingBreath) {
                suspicion = Math.max(0, suspicion - dt * 10);
              } else if (player.isSprinting) {
                suspicion = Math.min(100, suspicion + dt * 45);
              } else if (Math.hypot(player.vx, player.vy) > 0.1) {
                suspicion = Math.min(100, suspicion + dt * 20);
              }
            } else {
              suspicion = Math.max(0, suspicion - dt * 15);
            }

            // Patrol drift
            const newDriftAngle = anom.driftAngle + (Math.random() - 0.5) * 0.1;
            const driftSpeed = nearFlare ? 1.4 : suspicion > 50 ? 0.8 : 0.25;
            const newX = anom.x + Math.cos(newDriftAngle) * driftSpeed * dt;
            const newY = anom.y + Math.sin(newDriftAngle) * driftSpeed * dt;

            return {
              ...anom,
              x: newX,
              y: newY,
              driftAngle: newDriftAngle,
              suspicion,
              state: nearFlare ? 'PATROLLING' : suspicion > 70 ? 'HUNTING' : suspicion > 25 ? 'ALERT' : 'PATROLLING',
              pulseTimer: anom.pulseTimer + 1
            };
          }
          return anom;
        });
      });

      // Fade footstep alpha
      footstepsRef.current.forEach(step => {
        step.alpha = Math.max(0, step.alpha - dt * 0.02);
      });

      // Update Snow Particles
      if (canvasRef.current) {
        const w = canvasRef.current.width;
        const h = canvasRef.current.height;
        snowParticlesRef.current.forEach(p => {
          const speedMod = weather.type === 'BLIZZARD' ? 3.2 : weather.type === 'HEAVY_SNOWFALL' ? 2.0 : 1.0;
          p.y += p.speed * speedMod;
          p.x += weather.windX * weather.windSpeed * 0.8;
          if (p.y > h) p.y = -5;
          if (p.x > w) p.x = 0;
          if (p.x < 0) p.x = w;
        });
      }

      // Check arrival at active mission target station (auto-open only once upon reaching delivery destination)
      if (
        activeMission &&
        !deliveredStationMissionIdsRef.current.has(activeMission.id) &&
        !stationModalStation &&
        !pdaOpen &&
        !cargoModalOpen &&
        !craftingModalOpen &&
        !dialogNPC &&
        !deliveryReport
      ) {
        const targetStation = stations.find(s => s.id === activeMission.targetStationId);
        if (targetStation && Math.hypot(targetStation.x - player.x, targetStation.y - player.y) < 2.5) {
          deliveredStationMissionIdsRef.current.add(activeMission.id);
          setStationModalStation(targetStation);
        }
      }

      // Render Frame with Resource Nodes, NPCs, and Quest Target Beacon with progressive LOD
      if (rendererRef.current) {
        rendererRef.current.render(
          worldRef.current.tiles,
          player,
          cargo,
          structures,
          anomalies,
          weather,
          footstepsRef.current,
          lostCaches,
          snowParticlesRef.current,
          currentTime,
          resourceNodes,
          npcs,
          activeQuestTarget,
          zoomRef.current
        );
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    player,
    weather,
    cargo,
    structures,
    anomalies,
    lostCaches,
    resourceNodes,
    npcs,
    equippedGear,
    isGameOver,
    isMuted,
    pdaOpen,
    cargoModalOpen,
    craftingModalOpen,
    dialogNPC,
    stationModalStation,
    deliveryReport,
    stations,
    activeQuestTarget,
    tools,
    resources
  ]);

  // Handle Odradek Scanner Pulse Action
  const handleScanPulse = useCallback(() => {
    if (player.scannerCooldown > 0) return;

    sound.playScannerPing();

    const now = performance.now();
    const pCol = Math.floor(player.x);
    const pRow = Math.floor(player.y);
    const scanRadius = weather.type === 'ANOMALOUS_AURORA' ? 12 : 9;

    // Reveal holographic overlays on nearby tiles
    for (let dy = -scanRadius; dy <= scanRadius; dy++) {
      for (let dx = -scanRadius; dx <= scanRadius; dx++) {
        const r = pRow + dy;
        const c = pCol + dx;
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
          const dist = Math.hypot(dx, dy);
          if (dist <= scanRadius) {
            worldRef.current.tiles[r][c].scannedUntil = now + 4000;
          }
        }
      }
    }

    // Check exploration quest objective trigger
    if (activeQuest && activeQuest.type === 'EXPLORATION' && activeQuest.targetCoordinates) {
      const distToTarget = Math.hypot(
        activeQuest.targetCoordinates.x - player.x,
        activeQuest.targetCoordinates.y - player.y
      );
      if (distToTarget < 5.0) {
        // Complete exploration quest
        setNpcs(prevNpcs =>
          prevNpcs.map(n => ({
            ...n,
            quests: n.quests.map(q =>
              q.id === activeQuest.id
                ? { ...q, progress: q.maxProgress }
                : q
            )
          }))
        );
        sound.playDeliverySuccess();
      }
    }

    setPlayer(prev => ({
      ...prev,
      scannerActive: true,
      scannerPulseProgress: 0,
      scannerCooldown: weather.type === 'ANOMALOUS_AURORA' ? 2000 : 3500
    }));
  }, [player.scannerCooldown, player.x, player.y, weather.type, activeQuest]);

  // Handle Resource Harvesting
  const handleHarvestResource = () => {
    if (!nearbyResource) return;

    sound.playHarvest();

    // Add collected resources to player
    setResources(prev => {
      const existing = prev.find(r => r.type === nearbyResource.type);
      if (existing) {
        return prev.map(r =>
          r.type === nearbyResource.type ? { ...r, count: r.count + nearbyResource.amount } : r
        );
      } else {
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
      }
    });

    // Mark node as harvested
    setResourceNodes(prev =>
      prev.map(n => (n.id === nearbyResource.id ? { ...n, harvested: true } : n))
    );

    // Reward likes for gathering
    setPlayer(prev => ({
      ...prev,
      totalLikes: prev.totalLikes + 15
    }));
  };

  // Global Keyboard shortcuts: E (Station / NPC), F (Harvest)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'KeyE') {
        if (nearbyStation && !stationModalStation && !dialogNPC && !pdaOpen) {
          setStationModalStation(nearbyStation);
        } else if (nearbyNPC && !dialogNPC && !stationModalStation && !pdaOpen) {
          setDialogNPC(nearbyNPC);
        }
      } else if (e.code === 'KeyF') {
        if (nearbyResource && !nearbyResource.harvested) {
          handleHarvestResource();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearbyStation, nearbyNPC, nearbyResource, stationModalStation, dialogNPC, pdaOpen]);

  // Handle Tool Deployment (Ladder, Rope, Campfire, Thermos, Flare, Shelter)
  const handleUseTool = (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);
    if (!tool || tool.count <= 0) return;

    if (tool.type === 'THERMAL_FLASK') {
      sound.playThermosSip();
      setPlayer(prev => ({
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

      const newStructure: PlacedStructure = {
        id: `struct_${Date.now()}`,
        type: structType,
        x: player.x,
        y: player.y
      };
      setStructures(prev => [...prev, newStructure]);
    }

    // Decrement tool count
    setTools(prev =>
      prev.map(t => (t.id === toolId ? { ...t, count: t.count - 1 } : t))
    );
  };

  // Handle Crafting a Recipe
  const handleCraftRecipe = (recipe: CraftingRecipe) => {
    // 1. Deduct ingredients
    setResources(prev => {
      return prev.map(r => {
        const ing = recipe.ingredients.find(i => i.type === r.type);
        if (ing) {
          return { ...r, count: Math.max(0, r.count - ing.amount) };
        }
        return r;
      });
    });

    // 2. Grant result
    if (recipe.category === 'CLOTHING') {
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
      // Add or increment tool item
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
          return prev.map(t =>
            t.type === mappedType ? { ...t, count: t.count + recipe.resultCount } : t
          );
        } else {
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
        }
      });
    } else if (recipe.category === 'SURVIVAL') {
      // Immediate buff consumable
      sound.playThermosSip();
      setPlayer(prev => ({
        ...prev,
        warmth: Math.min(100, prev.warmth + 50),
        stamina: Math.min(prev.maxStamina, prev.stamina + 50),
        bootsIntegrity: Math.min(100, prev.bootsIntegrity + 30)
      }));
    }

    // Award Likes for crafting
    setPlayer(prev => ({
      ...prev,
      totalLikes: prev.totalLikes + 35
    }));
  };

  // NPC Quest Acceptance
  const handleAcceptQuest = (questId: string) => {
    sound.playQuestAccept();
    setNpcs(prev =>
      prev.map(n => ({
        ...n,
        quests: n.quests.map(q => (q.id === questId ? { ...q, status: 'ACTIVE' } : q))
      }))
    );
  };

  // NPC Quest Turn-In
  const handleTurnInQuest = (questId: string) => {
    const targetQuest = npcs.flatMap(n => n.quests).find(q => q.id === questId);
    if (!targetQuest) return;

    sound.playQuestComplete();

    // Deduct gathering resources if required
    if (targetQuest.requiredResources) {
      setResources(prev =>
        prev.map(r => {
          const req = targetQuest.requiredResources?.find(rr => rr.type === r.type);
          if (req) {
            return { ...r, count: Math.max(0, r.count - req.amount) };
          }
          return r;
        })
      );
    }

    // Reward likes and items
    setPlayer(prev => ({
      ...prev,
      totalLikes: prev.totalLikes + targetQuest.rewardLikes
    }));

    // Grant bonus reward items
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

    // Mark quest completed
    setNpcs(prev =>
      prev.map(n => ({
        ...n,
        quests: n.quests.map(q => (q.id === questId ? { ...q, status: 'COMPLETED' } : q))
      }))
    );
  };

  // NPC Trade: Buy
  const handleBuyTradeItem = (item: TradeItem) => {
    if (player.totalLikes < item.priceLikes) return;

    sound.playTradeSuccess();

    // Deduct Likes
    setPlayer(prev => ({
      ...prev,
      totalLikes: prev.totalLikes - item.priceLikes
    }));

    // Add item to inventory
    if (item.category === 'RESOURCE') {
      const resType = item.itemKey as ResourceItem['type'];
      setResources(prev => {
        const existing = prev.find(r => r.type === resType);
        if (existing) {
          return prev.map(r => (r.type === resType ? { ...r, count: r.count + 1 } : r));
        } else {
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
        }
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
  };

  // NPC Trade: Sell Resource
  const handleSellResource = (resourceType: string, amount: number, priceLikes: number) => {
    const res = resources.find(r => r.type === resourceType);
    if (!res || res.count < amount) return;

    sound.playTradeSuccess();

    setResources(prev =>
      prev.map(r => (r.type === resourceType ? { ...r, count: r.count - amount } : r))
    );

    setPlayer(prev => ({
      ...prev,
      totalLikes: prev.totalLikes + priceLikes
    }));
  };

  // Handle Mission Acceptance from PDA
  const handleAcceptMission = (missionId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;

    setActiveMission(mission);
    setCargo(mission.cargoItems);
    missionStartTimeRef.current = Date.now();
    setMissions(prev =>
      prev.map(m => (m.id === missionId ? { ...m, status: 'IN_TRANSIT' } : m))
    );
    setPdaOpen(false);
  };

  // Handle Mission Delivery at Station
  const handleDeliverMission = () => {
    if (!activeMission || !stationModalStation) return;

    sound.playDeliverySuccess();

    const timeTaken = (Date.now() - missionStartTimeRef.current) / 1000;
    const avgIntegrity =
      cargo.reduce((a, b) => a + b.currentIntegrity, 0) / cargo.length;

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

    // Connect Station to Eurasia network
    setStations(prev =>
      prev.map(s => (s.id === stationModalStation.id ? { ...s, connected: true } : s))
    );

    // Mark mission completed
    setMissions(prev =>
      prev.map(m => (m.id === activeMission.id ? { ...m, status: 'COMPLETED' } : m))
    );

    setPlayer(prev => ({
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

  // Rest and Refuel at Station
  const handleRestAndRefuel = () => {
    sound.playThermosSip();
    setPlayer(prev => ({
      ...prev,
      warmth: 100,
      stamina: 100,
      battery: 100,
      bootsIntegrity: 100
    }));
  };

  // Restock Tool at Station
  const handleRestockTool = (toolType: ToolItem['type']) => {
    sound.playToolDeploy();
    setTools(prev =>
      prev.map(t => (t.type === toolType ? { ...t, count: t.count + 1 } : t))
    );
  };

  // Auto-arrange cargo stack for center of gravity stability
  const handleAutoArrangeCargo = () => {
    sound.playToolDeploy();
    // Sort heavier items to bottom rack
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
    setPlayer(prev => ({ ...prev, balance: 0 }));
  };

  // Repair Cargo with protective thermal foam
  const handleRepairCargo = (cargoId: string) => {
    sound.playToolDeploy();
    setCargo(prev =>
      prev.map(c => (c.id === cargoId ? { ...c, currentIntegrity: 100 } : c))
    );
  };

  // Audio mute toggle
  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  return (
    <main
      id="game-viewport-container"
      className="relative w-screen h-screen overflow-hidden bg-neutral-950 font-mono-tech select-none"
    >
      {/* HTML5 Pixel Art Game Canvas with direct touch/mouse control */}
      <canvas
        ref={canvasRef}
        id="taiga-pixel-canvas"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        className="w-full h-full block pixel-art touch-none cursor-pointer"
      />

      {/* Retro CRT Scanline Overlay */}
      <div className="crt-overlay absolute inset-0 pointer-events-none" />

      {/* Heads-Up Display (Vitals, Balance Bar, Weather, Quick Tools, Crafting, NPC/Harvest Prompts, Zoom & LOD Slider) */}
      <GameHUD
        player={player}
        cargo={cargo}
        activeMission={activeMission}
        weather={weather}
        tools={tools}
        resources={resources}
        playerLikes={player.totalLikes}
        nearbyNPC={nearbyNPC}
        nearbyResource={nearbyResource}
        nearbyStation={nearbyStation}
        structures={structures}
        isMuted={isMuted}
        zoom={zoom}
        onChangeZoom={handleZoomChange}
        onToggleMute={handleToggleMute}
        onOpenPDA={(tab) => {
          setPdaInitialTab(tab || 'MAP');
          setPdaOpen(true);
        }}
        onOpenCargo={() => setCargoModalOpen(true)}
        onOpenCrafting={() => setCraftingModalOpen(true)}
        onInteractNPC={() => {
          if (nearbyNPC) setDialogNPC(nearbyNPC);
        }}
        onHarvestResource={handleHarvestResource}
        onOpenStation={() => {
          if (nearbyStation) setStationModalStation(nearbyStation);
        }}
        onUseTool={handleUseTool}
      />

      {/* Mobile Virtual Controls (Joystick, L/R balance straps, Echo-4 scanner, Breath, Sprint) */}
      <VirtualControls
        onMove={(dx, dy) => {
          inputVectorRef.current = { x: dx, y: dy };
        }}
        onBraceLeft={(active) => {
          setPlayer(prev => ({ ...prev, isBracingLeft: active }));
        }}
        onBraceRight={(active) => {
          setPlayer(prev => ({ ...prev, isBracingRight: active }));
        }}
        onScan={handleScanPulse}
        onHoldBreath={(active) => {
          setPlayer(prev => ({ ...prev, isHoldingBreath: active }));
        }}
        onSprint={(active) => {
          setPlayer(prev => ({ ...prev, isSprinting: active }));
        }}
        isHoldingBreath={player.isHoldingBreath}
        isBracingLeft={player.isBracingLeft}
        isBracingRight={player.isBracingRight}
        isSprinting={player.isSprinting}
        scannerCooldown={player.scannerCooldown}
        stumbleAlert={player.stumbleAlert}
      />

      {/* Crafting System Modal */}
      {craftingModalOpen && (
        <CraftingModal
          resources={resources}
          equippedGear={equippedGear}
          onCraftRecipe={handleCraftRecipe}
          onClose={() => setCraftingModalOpen(false)}
        />
      )}

      {/* NPC Dialogue, Quests & Trading Modal */}
      {dialogNPC && (
        <NPCDialogModal
          npc={dialogNPC}
          playerLikes={player.totalLikes}
          resources={resources}
          tools={tools}
          onAcceptQuest={handleAcceptQuest}
          onTurnInQuest={handleTurnInQuest}
          onBuyItem={handleBuyTradeItem}
          onSellResource={handleSellResource}
          onClose={() => setDialogNPC(null)}
        />
      )}

      {/* PDA Field Computer Modal */}
      {pdaOpen && (
        <DeliveryPDA
          initialTab={pdaInitialTab}
          player={player}
          stations={stations}
          missions={missions}
          structures={structures}
          activeMission={activeMission}
          discoveredRegionIds={discoveredRegionIds}
          onAcceptMission={handleAcceptMission}
          onClose={() => setPdaOpen(false)}
        />
      )}

      {/* Region Discovery & Lore Unlocked Floating Notification */}
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

      {/* Cargo Management & Weight Distribution Modal */}
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

      {/* Station Terminal Outpost Modal */}
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

      {/* Delivery Evaluation Report Modal */}
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

