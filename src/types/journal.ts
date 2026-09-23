export type JournalCategory = 'LORE' | 'PHENOMENON' | 'EXPEDITION';

export type ThreatLevel = 'SAFE' | 'CAUTION' | 'DANGEROUS' | 'LETHAL' | 'UNKNOWN';

export interface JournalEntry {
  id: string;
  title: string;
  category: JournalCategory;
  regionId: string;
  regionName: string;
  threatLevel: ThreatLevel;
  classification: string; // e.g. "Класс II: Био-резонанс", "Класс IV: Пространственный сдвиг"
  dateStamp: string; // e.g. "Запись экспедиции #14 // 1986", "Архив КПК-7 // 2024"
  summary: string;
  loreParagraphs: string[];
  tacticalAdvice?: string;
  iconName: 'Sparkles' | 'Radio' | 'Ghost' | 'Compass' | 'Flame' | 'Zap' | 'Eye' | 'AlertTriangle' | 'Snowflake' | 'Waves';
  discoveryCoordinatesHint?: string;
}

export interface RegionDefinition {
  id: string;
  name: string;
  code: string;
  description: string;
  anomalyDensity: 'НИЗКАЯ' | 'УМЕРЕННАЯ' | 'ВЫСОКАЯ' | 'КРИТИЧЕСКАЯ';
  landmark: string;
  colorHex: string;
}

export interface JournalState {
  unlockedEntryIds: string[];
  discoveredRegionIds: string[];
  verifiedSightingIds: string[];
  recentUnlock?: {
    entryTitle: string;
    regionName: string;
    timestamp: number;
  } | null;
}
