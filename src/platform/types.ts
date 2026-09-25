import type {
  PlayerStats,
  CargoItem,
  ToolItem,
  ResourceItem,
  EquippedGear,
  PlacedStructure,
  DeliveryMission,
} from '../types/game';

export type PlatformId = 'standalone' | 'telegram' | 'vk' | 'max';

/** Bump when SaveState's shape changes; older saves are then ignored. */
export const CURRENT_SAVE_VERSION = 1;

export interface SaveState {
  version: number;
  savedAt: number;
  player: PlayerStats;
  cargo: CargoItem[];
  tools: ToolItem[];
  resources: ResourceItem[];
  equippedGear: EquippedGear;
  structures: PlacedStructure[];
  missions: DeliveryMission[];
  activeMissionId: string | null;
  discoveredRegionIds: string[];
}

export interface PlatformAdapter {
  readonly id: PlatformId;
  /** Load the platform SDK and tell the host app we're ready. */
  init(): Promise<void>;
  save(state: SaveState): Promise<void>;
  /** Returns null when there is no save, or it is unreadable / from another version. */
  load(): Promise<SaveState | null>;
}
