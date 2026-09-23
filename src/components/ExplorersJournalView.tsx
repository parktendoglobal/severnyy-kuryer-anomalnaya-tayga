import React, { useState, useMemo, useEffect, useRef } from 'react';
import { JournalEntry, JournalCategory } from '../types/journal';
import { JOURNAL_ENTRIES, REGIONS, getRegionAt } from '../utils/journalData';
import { PlayerStats } from '../types/game';
import { sound } from '../utils/audio';
import {
  BookOpen,
  Lock,
  Unlock,
  Radio,
  Sparkles,
  Ghost,
  Compass,
  Flame,
  Zap,
  Eye,
  AlertTriangle,
  Snowflake,
  Waves,
  MapPin,
  Search,
  Volume2,
  VolumeX,
  FileText,
  Map as MapIcon,
  Crosshair,
  ShieldCheck,
  Activity
} from 'lucide-react';

interface ExplorersJournalViewProps {
  player: PlayerStats;
  discoveredRegionIds: string[];
  onSwitchToMapTab?: () => void;
}

export const ExplorersJournalView: React.FC<ExplorersJournalViewProps> = ({
  player,
  discoveredRegionIds,
  onSwitchToMapTab
}) => {
  const [selectedCategory, setSelectedCategory] = useState<JournalCategory | 'ALL'>('ALL');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlayingSignal, setIsPlayingSignal] = useState(false);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Current region where the player is located right now
  const currentRegion = useMemo(() => getRegionAt(player.x, player.y), [player.x, player.y]);

  const unlockedSet = useMemo(() => new Set(discoveredRegionIds), [discoveredRegionIds]);

  // Filtered entries based on category, region, and search query
  const filteredEntries = useMemo(() => {
    return JOURNAL_ENTRIES.filter(entry => {
      // Category filter
      if (selectedCategory !== 'ALL' && entry.category !== selectedCategory) {
        return false;
      }
      // Region filter
      if (selectedRegionFilter !== 'ALL' && entry.regionId !== selectedRegionFilter) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = entry.title.toLowerCase().includes(q);
        const matchesRegion = entry.regionName.toLowerCase().includes(q);
        const matchesSummary = entry.summary.toLowerCase().includes(q);
        const matchesClassification = entry.classification.toLowerCase().includes(q);
        if (!matchesTitle && !matchesRegion && !matchesSummary && !matchesClassification) {
          return false;
        }
      }
      return true;
    });
  }, [selectedCategory, selectedRegionFilter, searchQuery]);

  // Selected entry state: defaults to first unlocked entry, or first entry
  const [selectedEntryId, setSelectedEntryId] = useState<string>(() => {
    const firstUnlocked = JOURNAL_ENTRIES.find(e => unlockedSet.has(e.regionId));
    return firstUnlocked ? firstUnlocked.id : JOURNAL_ENTRIES[0].id;
  });

  const selectedEntry = useMemo(() => {
    return JOURNAL_ENTRIES.find(e => e.id === selectedEntryId) || JOURNAL_ENTRIES[0];
  }, [selectedEntryId]);

  const isSelectedUnlocked = selectedEntry ? unlockedSet.has(selectedEntry.regionId) : false;

  // Unlocked count stats
  const totalEntries = JOURNAL_ENTRIES.length;
  const unlockedCount = JOURNAL_ENTRIES.filter(e => unlockedSet.has(e.regionId)).length;
  const progressPercent = Math.round((unlockedCount / totalEntries) * 100);

  const totalRegions = REGIONS.length;
  const exploredRegionsCount = REGIONS.filter(r => unlockedSet.has(r.id)).length;

  // Helper for rendering entry category icon
  const renderIcon = (name: JournalEntry['iconName'], className: string = 'w-4 h-4') => {
    switch (name) {
      case 'Radio': return <Radio className={className} />;
      case 'Snowflake': return <Snowflake className={className} />;
      case 'Compass': return <Compass className={className} />;
      case 'Waves': return <Waves className={className} />;
      case 'AlertTriangle': return <AlertTriangle className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Flame': return <Flame className={className} />;
      case 'Ghost': return <Ghost className={className} />;
      case 'Eye': return <Eye className={className} />;
      case 'Zap': return <Zap className={className} />;
      default: return <FileText className={className} />;
    }
  };

  // Threat badge styling
  const getThreatBadge = (threat: JournalEntry['threatLevel']) => {
    switch (threat) {
      case 'SAFE':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-600/60">
            УГРОЗА: БЕЗОПАСНО
          </span>
        );
      case 'CAUTION':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/60">
            УГРОЗА: ВНИМАНИЕ
          </span>
        );
      case 'DANGEROUS':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-950/80 text-orange-400 border border-orange-600/70">
            УГРОЗА: ОПАСНО
          </span>
        );
      case 'LETHAL':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-500 animate-pulse">
            УГРОЗА: СМЕРТЕЛЬНО
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-neutral-400 border border-neutral-700">
            УГРОЗА: НЕИЗВЕСТНО
          </span>
        );
    }
  };

  // Audio log signal sound simulation
  const handleToggleSignal = () => {
    if (isPlayingSignal) {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
      setIsPlayingSignal(false);
    } else {
      setIsPlayingSignal(true);
      sound.playGeigerClick(0.6);
      audioIntervalRef.current = setInterval(() => {
        sound.playGeigerClick(0.4 + Math.random() * 0.4);
      }, 350);
      setTimeout(() => {
        if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
        setIsPlayingSignal(false);
      }, 4500);
    }
  };

  useEffect(() => {
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 font-mono-tech select-none">
      {/* Top Banner: Exploration stats and current sector */}
      <div className="bg-neutral-950 border border-emerald-800/80 rounded-xl p-3 shadow-lg flex flex-col gap-2.5">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2 text-emerald-300">
            <BookOpen className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div>
              <div className="text-sm font-bold tracking-wider uppercase">
                ЭКСПЕДИЦИОННЫЙ ДНЕВНИК // РЕЕСТР АНОМАЛИЙ И ФЕНОМЕНОВ
              </div>
              <div className="text-[10px] text-emerald-600">
                СИНХРОНИЗАЦИЯ С ТОПОГРАФИЧЕСКИМ СКАНЕРОМ «ЭХО-4»
              </div>
            </div>
          </div>

          {/* Current coordinates and current region badge */}
          <div className="flex items-center gap-2 bg-neutral-900/90 px-2.5 py-1 rounded-lg border border-emerald-700/50 text-[11px]">
            <Crosshair className="w-3.5 h-3.5 text-sky-400 animate-spin" style={{ animationDuration: '8s' }} />
            <span className="text-neutral-400">ТЕКУЩИЙ СЕКТОР:</span>
            <span className="text-emerald-300 font-bold">{currentRegion.name}</span>
            <span className="text-neutral-500 font-mono text-[10px]">
              (X:{Math.round(player.x)} Y:{Math.round(player.y)})
            </span>
          </div>
        </div>

        {/* Exploration Progress Bar */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-neutral-300 flex items-center gap-1.5">
              <span>ИССЛЕДОВАНИЕ ЗОНЫ СДВИГА:</span>
              <span className="text-emerald-400 font-bold">
                {unlockedCount} из {totalEntries} записей ({progressPercent}%)
              </span>
            </span>
            <span className="text-neutral-400">
              РЕГИОНЫ: <span className="text-sky-400 font-bold">{exploredRegionsCount}/{totalRegions}</span>
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-emerald-950">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-sky-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Region Discovery Pills: quick overview & filtering */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-neutral-900 text-[10px]">
          <span className="text-neutral-500 py-0.5">РЕГИОНЫ:</span>
          {REGIONS.map(reg => {
            const isExplored = unlockedSet.has(reg.id);
            const isSelected = selectedRegionFilter === reg.id;
            const isCurrent = currentRegion.id === reg.id;

            return (
              <button
                key={reg.id}
                type="button"
                onClick={() => {
                  sound.playMenuSelect();
                  setSelectedRegionFilter(prev => prev === reg.id ? 'ALL' : reg.id);
                }}
                className={`px-2 py-0.5 rounded flex items-center gap-1 transition-all border ${
                  isSelected
                    ? 'bg-emerald-800/80 text-white border-emerald-400 font-bold'
                    : isExplored
                    ? 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-emerald-500'
                    : 'bg-neutral-950 text-neutral-600 border-neutral-900 hover:border-neutral-800'
                }`}
                title={reg.description}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: isExplored ? reg.colorHex : '#525252' }}
                />
                <span>{reg.name}</span>
                {isCurrent && (
                  <span className="text-[8px] bg-sky-900/80 text-sky-200 px-1 rounded font-bold">
                    ВЫ ЗДЕСЬ
                  </span>
                )}
                {isExplored ? (
                  <span className="text-emerald-400 text-[9px]">✓</span>
                ) : (
                  <Lock className="w-2.5 h-2.5 text-neutral-600" />
                )}
              </button>
            );
          })}
          {selectedRegionFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedRegionFilter('ALL')}
              className="px-1.5 py-0.5 rounded text-[9px] text-amber-400 hover:underline"
            >
              Сброс фильтра
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap justify-between items-center gap-2 bg-neutral-950/60 p-2 rounded-xl border border-neutral-800">
        {/* Category Tabs */}
        <div className="flex gap-1 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => {
              sound.playMenuSelect();
              setSelectedCategory('ALL');
            }}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            ВСЕ ЗАПИСИ ({totalEntries})
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playMenuSelect();
              setSelectedCategory('LORE');
            }}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
              selectedCategory === 'LORE'
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Radio className="w-3 h-3 text-sky-400" />
            ХРОНИКИ АНОМАЛИИ
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playMenuSelect();
              setSelectedCategory('PHENOMENON');
            }}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
              selectedCategory === 'PHENOMENON'
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            РЕЕСТР ЯВЛЕНИЙ
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playMenuSelect();
              setSelectedCategory('EXPEDITION');
            }}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
              selectedCategory === 'EXPEDITION'
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Compass className="w-3 h-3 text-emerald-400" />
            ЛОГИ ЭКСПЕДИЦИЙ
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-xs min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по архиву..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-8 pr-3 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Main Master-Detail split view */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 min-h-[440px]">
        {/* Left column: Entries list */}
        <div className="md:col-span-5 flex flex-col gap-2 max-h-[56vh] overflow-y-auto pr-1">
          {filteredEntries.length === 0 ? (
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 text-center text-xs text-neutral-500">
              По вашему запросу записей не найдено.
            </div>
          ) : (
            filteredEntries.map(entry => {
              const isUnlocked = unlockedSet.has(entry.regionId);
              const isSelected = selectedEntry.id === entry.id;

              return (
                <div
                  key={entry.id}
                  onClick={() => {
                    sound.playMenuSelect();
                    setSelectedEntryId(entry.id);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-neutral-900 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                      : isUnlocked
                      ? 'bg-neutral-950/90 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60'
                      : 'bg-neutral-950/40 border-neutral-900 opacity-65 hover:opacity-90 hover:border-neutral-800'
                  }`}
                >
                  {/* Top tags row */}
                  <div className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-1.5">
                      {isUnlocked ? (
                        renderIcon(entry.iconName, 'w-3.5 h-3.5 text-emerald-400')
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-neutral-500" />
                      )}
                      <span className="text-neutral-400 uppercase tracking-wider">
                        {entry.category === 'LORE' && 'ХРОНИКА'}
                        {entry.category === 'PHENOMENON' && 'ФЕНОМЕН'}
                        {entry.category === 'EXPEDITION' && 'ЭКСПЕДИЦИЯ'}
                      </span>
                    </div>

                    {isUnlocked ? (
                      getThreatBadge(entry.threatLevel)
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-500 border border-neutral-800">
                        [ЗАСЕКРЕЧЕНО]
                      </span>
                    )}
                  </div>

                  {/* Title & Region */}
                  <div>
                    <div className={`text-xs font-bold ${
                      isUnlocked
                        ? isSelected ? 'text-emerald-200' : 'text-neutral-200'
                        : 'text-neutral-500'
                    }`}>
                      {isUnlocked ? entry.title : 'Засекреченный фрагмент архива'}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-0.5">
                      <MapPin className="w-3 h-3 text-sky-400" />
                      <span>{entry.regionName}</span>
                    </div>
                  </div>

                  {/* Snippet / Hint */}
                  <div className="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed">
                    {isUnlocked ? (
                      entry.summary
                    ) : (
                      <span className="text-amber-500/80 font-medium">
                        🔒 Требуется исследовать сектор: «{entry.regionName}»
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right column: Selected Dossier Detail View */}
        <div className="md:col-span-7 bg-neutral-950 border border-emerald-900/60 rounded-xl p-4 flex flex-col justify-between max-h-[56vh] overflow-y-auto relative">
          {isSelectedUnlocked ? (
            <div className="flex flex-col gap-3">
              {/* Dossier Top Bar */}
              <div className="flex flex-wrap justify-between items-start gap-2 border-b border-neutral-800 pb-2.5">
                <div>
                  <div className="flex items-center gap-2 text-[10px] text-emerald-500 uppercase tracking-widest font-bold">
                    <span>ДОСЬЕ КПК-7 // {selectedEntry.id.toUpperCase()}</span>
                    <span>•</span>
                    <span>{selectedEntry.dateStamp}</span>
                  </div>
                  <h3 className="text-base font-bold text-emerald-300 mt-0.5 flex items-center gap-2">
                    {renderIcon(selectedEntry.iconName, 'w-5 h-5 text-emerald-400')}
                    <span>{selectedEntry.title}</span>
                  </h3>
                  <div className="text-[11px] text-sky-400 mt-0.5">
                    {selectedEntry.classification}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {getThreatBadge(selectedEntry.threatLevel)}
                  <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                    <MapPin className="w-3 h-3 text-sky-400" />
                    <span>{selectedEntry.regionName}</span>
                  </div>
                </div>
              </div>

              {/* Spectral Oscilloscope / Signal Waveform Graphic */}
              <div className="bg-neutral-900/90 border border-emerald-800/60 rounded-lg p-2.5 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-neutral-400 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>СПЕКТРАЛЬНАЯ СИГНАТУРА РЕЗОНАНСА:</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleSignal}
                    className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition-all ${
                      isPlayingSignal
                        ? 'bg-amber-950 text-amber-300 border border-amber-500 animate-pulse'
                        : 'bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700'
                    }`}
                  >
                    {isPlayingSignal ? (
                      <>
                        <VolumeX className="w-3 h-3" />
                        <span>СТОП РАДИО</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3 h-3 text-emerald-400" />
                        <span>ПРОСЛУШАТЬ СИГНАЛ</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Simulated Green Phosphor Waveform */}
                <div className="h-10 w-full bg-black/80 rounded border border-emerald-950 flex items-center justify-center overflow-hidden relative">
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage: 'linear-gradient(0deg, #10B981 1px, transparent 1px), linear-gradient(90deg, #10B981 1px, transparent 1px)',
                      backgroundSize: '12px 12px'
                    }}
                  />
                  <svg className="w-full h-8 px-2" viewBox="0 0 300 40" preserveAspectRatio="none">
                    <path
                      d={
                        isPlayingSignal
                          ? "M 0,20 Q 30,5 60,20 T 120,20 T 180,35 T 240,10 T 300,20"
                          : "M 0,20 Q 25,18 50,20 T 100,16 T 150,24 T 200,18 T 250,22 T 300,20"
                      }
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="1.8"
                      className={isPlayingSignal ? 'animate-pulse' : ''}
                    />
                  </svg>
                </div>
              </div>

              {/* Lore Body Paragraphs */}
              <div className="flex flex-col gap-2.5 text-xs text-neutral-300 leading-relaxed font-sans">
                {selectedEntry.loreParagraphs.map((para, idx) => (
                  <p key={idx} className="bg-neutral-900/40 p-2.5 rounded-lg border border-neutral-800/80">
                    {para}
                  </p>
                ))}
              </div>

              {/* Tactical Courier Field Advice Callout */}
              {selectedEntry.tacticalAdvice && (
                <div className="bg-amber-950/30 border border-amber-600/70 rounded-xl p-3 flex gap-2.5 text-xs text-amber-200">
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-[11px] text-amber-300 uppercase tracking-wider">
                      ТАКТИЧЕСКОЕ РУКОВОДСТВО КУРЬЕРА
                    </span>
                    <span className="leading-relaxed text-amber-100/90 text-[11px]">
                      {selectedEntry.tacticalAdvice}
                    </span>
                  </div>
                </div>
              )}

              {/* Coordinates Hint & Switch to Map action */}
              {selectedEntry.discoveryCoordinatesHint && (
                <div className="flex justify-between items-center bg-neutral-900/60 p-2 rounded-lg border border-neutral-800 text-[11px]">
                  <span className="text-neutral-400 flex items-center gap-1">
                    <Crosshair className="w-3.5 h-3.5 text-sky-400" />
                    <span>КООРДИНАТЫ ОЧАГА: <strong className="text-neutral-200">{selectedEntry.discoveryCoordinatesHint}</strong></span>
                  </span>

                  {onSwitchToMapTab && (
                    <button
                      type="button"
                      onClick={onSwitchToMapTab}
                      className="px-2 py-1 rounded bg-emerald-950 border border-emerald-600 text-emerald-300 hover:bg-emerald-900 text-[10px] flex items-center gap-1 font-bold"
                    >
                      <MapIcon className="w-3 h-3" />
                      <span>ОТКРЫТЬ НА КАРТЕ</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Encrypted / Locked Entry View */
            <div className="flex flex-col items-center justify-center text-center p-6 gap-4 my-auto">
              <div className="w-16 h-16 rounded-2xl bg-neutral-900 border-2 border-dashed border-red-500/60 flex items-center justify-center text-red-400">
                <Lock className="w-8 h-8 animate-pulse" />
              </div>

              <div className="flex flex-col gap-1 max-w-sm">
                <div className="text-xs font-bold text-red-400 tracking-widest uppercase">
                  ДОСТУП ЗАБЛОКИРОВАН // ДАННЫЕ ЗАШИФРОВАНЫ
                </div>
                <div className="text-sm font-bold text-neutral-200">
                  ТРЕБУЕТСЯ ИССЛЕДОВАТЬ СЕКТОР «{selectedEntry.regionName}»
                </div>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Планшет КПК-7 автоматически расшифрует этот документ и снимет гриф секретности, как только вы прибудете в указанный регион тайги.
                </p>
              </div>

              {/* Redacted simulated lines */}
              <div className="w-full max-w-xs flex flex-col gap-1.5 opacity-40">
                <div className="h-2 bg-neutral-700 rounded w-full animate-pulse" />
                <div className="h-2 bg-neutral-700 rounded w-5/6 mx-auto animate-pulse" />
                <div className="h-2 bg-neutral-700 rounded w-4/6 mx-auto animate-pulse" />
              </div>

              {onSwitchToMapTab && (
                <button
                  type="button"
                  onClick={onSwitchToMapTab}
                  className="px-4 py-2 rounded-xl bg-sky-950 border border-sky-600 text-sky-200 hover:bg-sky-900 transition-all text-xs flex items-center gap-2 font-bold shadow-lg"
                >
                  <MapIcon className="w-4 h-4 text-sky-400" />
                  <span>НАЙТИ РЕГИОН НА КАРТЕ ТАЙГИ</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
