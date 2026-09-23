export type TileType =
  | 'SNOW_HARD'
  | 'SNOW_DEEP'
  | 'ICE_RIVER'
  | 'ROCKS'
  | 'CLIFF'
  | 'FROZEN_BOG'
  | 'OLD_ROAD'
  | 'STATION_PLATFORM';

export type TerrainDanger = 'SAFE' | 'ROUGH' | 'HAZARDOUS';

export interface WorldTile {
  type: TileType;
  elevation: number; // 0 to 5
  tree?: 'PINE' | 'BIRCH' | 'DEAD_TREE' | 'BUSH' | 'GIANT_PINE' | 'RED_BERRY_BUSH' | 'LARCH';
  scannedUntil?: number;
}

export type CargoCategory = 
  | 'MEDICAL'
  | 'RADIO_TUBES'
  | 'ISOTOPE_BATTERY'
  | 'TAIGA_RATIONS'
  | 'SEED_BANK'
  | 'GEOLOGY_CORE';

export interface CargoItem {
  id: string;
  name: string;
  category: CargoCategory;
  weightKg: number;
  maxIntegrity: number;
  currentIntegrity: number;
  isFragile: boolean;
  orderId?: string;
  slot: 'BACKPACK_BOTTOM' | 'BACKPACK_MID' | 'BACKPACK_TOP' | 'LEFT_STRAP' | 'RIGHT_STRAP' | 'CARGO_SLED';
  description: string;
}

export type ToolType =
  | 'LADDER'
  | 'CLIMBING_ROPE'
  | 'CAMPFIRE'
  | 'THERMAL_FLASK'
  | 'BEACON'
  | 'SHELTER_KIT'
  | 'FLARE'
  | 'REPAIR_SPRAY'
  | 'POWER_CELL';

export interface ToolItem {
  id: string;
  type: ToolType;
  name: string;
  count: number;
  weightKg: number;
  icon: string;
  description: string;
}

export interface PlacedStructure {
  id: string;
  type: 'LADDER' | 'ROPE' | 'CAMPFIRE' | 'BEACON' | 'SHELTER' | 'FLARE';
  x: number; // world x
  y: number; // world y
  angle?: number;
  length?: number;
  lifespan?: number;
  beaconText?: string;
  beaconIcon?: 'BEWARE_PHANTOMS' | 'DEEP_SNOW' | 'SHELTER_AHEAD' | 'SAFE_CROSSING';
}

export interface AnomalyEntity {
  id: string;
  type: 'FROST_PHANTOM' | 'GRAVITY_VORTEX' | 'STATIC_DISCHARGE';
  x: number;
  y: number;
  radius: number;
  suspicion: number; // 0 to 100
  state: 'PATROLLING' | 'ALERT' | 'HUNTING';
  driftAngle: number;
  pulseTimer: number;
}

export interface Footstep {
  x: number;
  y: number;
  angle: number;
  isLeft: boolean;
  depth: number; // 1 = light, 2 = deep snow
  alpha: number;
}

export type WeatherType =
  | 'CLEAR_FROST'
  | 'LIGHT_SNOW'
  | 'BLIZZARD'
  | 'EXTREME_COLD'
  | 'HEAVY_SNOWFALL'
  | 'ANOMALOUS_AURORA'
  | 'MAGNETIC_STORM';

export interface WeatherState {
  type: WeatherType;
  nameRu: string;
  windX: number;
  windY: number;
  windSpeed: number; // 0 to 10
  visibility: number; // 0 to 1
  anomalyIntensity: number; // 0 to 1
  tempCelsius: number; // e.g. -24°C to -48°C
  timeToChange: number;
  dangerLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  description: string;
}

// ----------------------------------------------------
// Crafting & Resource System
// ----------------------------------------------------
export type ResourceType =
  | 'WOOD_PINE'
  | 'CHAGA_HERB'
  | 'SCRAP_METAL'
  | 'CHIRAL_RESIN'
  | 'COPPER_WIRE'
  | 'TAIGA_FUR'
  | 'PARAFFIN_WAX';

export interface ResourceItem {
  type: ResourceType;
  name: string;
  count: number;
  icon: string;
  weightKg: number;
  description: string;
}

export interface WorldResourceNode {
  id: string;
  type: ResourceType;
  x: number;
  y: number;
  amount: number;
  harvested: boolean;
  name: string;
  respawnTimer?: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  category: 'CLOTHING' | 'TOOL' | 'SHELTER' | 'SURVIVAL';
  description: string;
  icon: string;
  resultType: string;
  resultCount: number;
  ingredients: { type: ResourceType; amount: number }[];
  benefits: string;
  unlocked: boolean;
}

export interface EquippedGear {
  coat?: { id: string; name: string; coldResist: number; icon: string };
  snowshoes?: { id: string; name: string; speedBonus: number; icon: string };
  mask?: { id: string; name: string; windResist: number; icon: string };
  reinforcedBoots?: { id: string; name: string; durabilityBonus: number; icon: string };
}

// ----------------------------------------------------
// NPCs, Quests & Trading System
// ----------------------------------------------------
export interface TradeItem {
  id: string;
  name: string;
  category: 'RESOURCE' | 'TOOL' | 'GEAR' | 'RATION';
  itemKey: string;
  priceLikes: number;
  count: number;
  icon: string;
  description: string;
  requiredResourceType?: ResourceType;
  requiredResourceAmount?: number;
}

export interface NPCQuest {
  id: string;
  npcId: string;
  title: string;
  type: 'EXPLORATION' | 'GATHERING' | 'DELIVERY';
  description: string;
  targetCoordinates?: { x: number; y: number };
  targetName?: string;
  requiredResources?: { type: ResourceType; amount: number }[];
  rewardLikes: number;
  rewardItems?: { name: string; count: number; icon: string }[];
  status: 'AVAILABLE' | 'ACTIVE' | 'COMPLETED';
  progress: number;
  maxProgress: number;
  rewardClaimed?: boolean;
}

export interface WorldNPC {
  id: string;
  name: string;
  callsign: string;
  role: string;
  portrait: string;
  x: number;
  y: number;
  locationName: string;
  stationId?: string; // If at a station
  greeting: string;
  lore: string;
  tradeInventory: TradeItem[];
  quests: NPCQuest[];
}

export interface Station {
  id: string;
  name: string;
  callsign: string;
  type: 'OUTPOST' | 'METEO' | 'BUNKER' | 'MINE' | 'HERMITAGE';
  x: number;
  y: number;
  region: string;
  description: string;
  connected: boolean;
  npcName: string;
  npcRole: string;
  chiralBandwidth: number;
}

export interface DeliveryMission {
  id: string;
  title: string;
  senderStationId: string;
  targetStationId: string;
  senderName: string;
  cargoItems: CargoItem[];
  timeLimitSec: number;
  timeRemainingSec?: number;
  rewardLikes: number;
  description: string;
  status: 'AVAILABLE' | 'IN_TRANSIT' | 'COMPLETED' | 'FAILED';
  minIntegrityForS: number;
}

export interface PlayerStats {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingAngle: number;
  
  // Balance & Stumble
  balance: number; // -100 (hard left) to +100 (hard right)
  stumbleAlert: 'NONE' | 'LEFT' | 'RIGHT' | 'CRITICAL';
  stumbleTimer: number;
  isStumbling: boolean;
  isBracingLeft: boolean;
  isBracingRight: boolean;

  // Survival
  stamina: number; // 0 - 100
  maxStamina: number;
  warmth: number; // 0 - 100
  battery: number; // 0 - 100
  bootsIntegrity: number; // 0 - 100

  // Stealth & Breath
  isHoldingBreath: boolean;
  breathAir: number; // 0 - 100
  isCrouching: boolean;

  // Scanner "Эхо-4"
  scannerCooldown: number;
  scannerPulseProgress: number; // 0 to 1 (active scanning wave radius)
  scannerActive: boolean;

  // Speed & Movement
  isSprinting: boolean;
  onSled: boolean;
  
  // Progression
  courierGrade: string;
  totalLikes: number;
  deliveredDeliveries: number;
}
