import React from 'react';
import {
  PlayerStats,
  CargoItem,
  DeliveryMission,
  WeatherState,
  ToolItem,
  ResourceItem,
  WorldNPC,
  WorldResourceNode,
  PlacedStructure
} from '../types/game';
import {
  Volume2,
  VolumeX,
  MapPin,
  Flame,
  Battery,
  Shield,
  Activity,
  Package,
  Compass,
  AlertTriangle,
  FolderKanban,
  Hammer,
  Coins,
  Sparkles,
  CloudSnow,
  Zap,
  ZoomIn,
  ZoomOut,
  Layers,
  BookOpen
} from 'lucide-react';
import { STATIONS } from '../utils/constants';

interface GameHUDProps {
  player: PlayerStats;
  cargo: CargoItem[];
  activeMission: DeliveryMission | null;
  weather: WeatherState;
  tools: ToolItem[];
  resources?: ResourceItem[];
  playerLikes?: number;
  nearbyNPC?: WorldNPC | null;
  nearbyResource?: WorldResourceNode | null;
  nearbyStation?: import('../types/game').Station | null;
  structures?: PlacedStructure[];
  isMuted: boolean;
  zoom?: number;
  onChangeZoom?: (zoom: number) => void;
  onToggleMute: () => void;
  onOpenPDA: (tab?: 'MAP' | 'MISSIONS' | 'NETWORK' | 'JOURNAL' | 'HANDBOOK') => void;
  onOpenCargo: () => void;
  onOpenCrafting: () => void;
  onInteractNPC?: () => void;
  onHarvestResource?: () => void;
  onOpenStation?: () => void;
  onUseTool: (toolId: string) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  player,
  cargo,
  activeMission,
  weather,
  tools,
  resources = [],
  playerLikes = 0,
  nearbyNPC = null,
  nearbyResource = null,
  nearbyStation = null,
  structures = [],
  isMuted,
  zoom = 1.0,
  onChangeZoom,
  onToggleMute,
  onOpenPDA,
  onOpenCargo,
  onOpenCrafting,
  onInteractNPC,
  onHarvestResource,
  onOpenStation,
  onUseTool
}) => {
  // Target station lookup if active mission
  const targetStation = activeMission ? STATIONS.find(s => s.id === activeMission.targetStationId) : null;
  const distanceToTarget = targetStation
    ? Math.round(Math.hypot(targetStation.x - player.x, targetStation.y - player.y) * 10)
    : null;

  // Stationary state & Stamina regeneration rate calculation
  const playerSpeed = Math.hypot(player.vx, player.vy);
  const isStationary = playerSpeed < 0.05 && !player.isStumbling;

  // Nearby shelter / campfire bonus
  const nearShelter = structures.some(
    s => s.type === 'SHELTER' && Math.hypot(s.x - player.x, s.y - player.y) < 3.5
  );
  const nearCampfire = structures.some(
    s => s.type === 'CAMPFIRE' && Math.hypot(s.x - player.x, s.y - player.y) < 2.5
  );

  // Recovery rate in %/sec
  const isHypothermic = player.warmth < 25;
  const baseRegenRate = nearShelter ? 30 : nearCampfire ? 22 : 12;
  const effectiveRegenRate = Math.max(1, isHypothermic ? baseRegenRate - 2.5 : baseRegenRate);

  // Is stamina actively recovering while stationary
  const maxStamina = player.maxStamina || 100;
  const isStaminaRecovering = isStationary && player.stamina < maxStamina;
  const isFullyRested = isStationary && player.stamina >= maxStamina;

  // Pulse animation period in seconds: faster pulse for higher regeneration rate
  // e.g. 30%/s -> 0.52s, 22%/s -> 0.70s, 12%/s -> 1.15s, 9.5%/s -> 1.45s
  const pulseDurationSec = Math.max(0.45, Math.min(2.0, 14 / effectiveRegenRate)).toFixed(2);

  // Total weight carried
  const totalCargoWeight = cargo.reduce((acc, c) => acc + c.weightKg, 0);
  const totalToolsWeight = tools.reduce((acc, t) => acc + t.weightKg * t.count, 0);
  const totalResourceWeight = resources.reduce((acc, r) => acc + r.weightKg * r.count, 0);
  const totalWeight = Math.round((totalCargoWeight + totalToolsWeight + totalResourceWeight) * 10) / 10;
  const maxWeight = 45.0;

  // Average cargo integrity
  const avgIntegrity = cargo.length > 0
    ? Math.round(cargo.reduce((acc, c) => acc + c.currentIntegrity, 0) / cargo.length)
    : 100;

  return (
    <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between z-20 font-mono-tech">
      {/* Top Section: Vital Meters, Balance Bubble, Weather & Status */}
      <div className="w-full flex flex-col gap-2">
        {/* Top Header Bar */}
        <div className="flex justify-between items-start">
          {/* Survival Vitals Bars (Warmth, Stamina, Battery, Boots) */}
          <div className="bg-neutral-950/85 backdrop-blur-md border border-neutral-800 rounded-xl p-2.5 shadow-xl flex flex-col gap-1.5 w-60 pointer-events-auto">
            {/* Stamina Bar with Stationary Recovery Pulse */}
            <div
              className={`flex items-center gap-2 p-1 -m-1 rounded-lg transition-all duration-300 ${
                isStaminaRecovering
                  ? 'bg-emerald-950/40 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.18)]'
                  : isFullyRested
                  ? 'bg-emerald-950/15 border border-emerald-900/30'
                  : ''
              }`}
            >
              <div className="relative shrink-0">
                <Activity
                  className={`w-3.5 h-3.5 transition-colors duration-200 ${
                    isStaminaRecovering
                      ? 'text-emerald-300'
                      : isFullyRested
                      ? 'text-emerald-400/90'
                      : 'text-emerald-400'
                  }`}
                  style={
                    isStaminaRecovering
                      ? {
                          animation: `stamina-pulse ${pulseDurationSec}s ease-in-out infinite`,
                        }
                      : isFullyRested
                      ? {
                          animation: 'stamina-full-rest 2.5s ease-in-out infinite',
                        }
                      : undefined
                  }
                />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center text-[10px] text-neutral-300 leading-none mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={isStaminaRecovering ? 'text-emerald-200 font-semibold' : ''}>
                      ВЫНОСЛИВОСТЬ
                    </span>

                    {/* Stationary recovery rate badge visually emphasizing regain rate */}
                    {isStaminaRecovering && (
                      <span
                        className={`text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 shadow-sm transition-all ${
                          nearShelter
                            ? 'bg-teal-950/90 text-teal-200 border border-teal-400/60'
                            : nearCampfire
                            ? 'bg-amber-950/90 text-amber-200 border border-amber-500/60'
                            : 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50'
                        }`}
                        style={{
                          animation: `stamina-pulse ${pulseDurationSec}s ease-in-out infinite`,
                        }}
                        title={`Отдых на месте: +${Math.round(effectiveRegenRate)}% выносливости в секунду`}
                      >
                        <Zap className="w-2.5 h-2.5 text-emerald-300 fill-emerald-300 shrink-0" />
                        <span>+{Math.round(effectiveRegenRate)}/с</span>
                      </span>
                    )}

                    {isFullyRested && (
                      <span className="text-[8px] text-emerald-400/70 font-mono tracking-wider border border-emerald-800/40 rounded px-1 py-0.2">
                        МАКС
                      </span>
                    )}
                  </div>

                  <span
                    className={
                      isStaminaRecovering
                        ? 'text-emerald-300 font-bold'
                        : isFullyRested
                        ? 'text-emerald-400'
                        : ''
                    }
                  >
                    {Math.round(player.stamina)}%
                  </span>
                </div>

                {/* Progress Bar Container with dynamic pulse animation */}
                <div
                  className={`w-full h-2 bg-neutral-900 rounded-full overflow-hidden border relative transition-all duration-300 ${
                    isStaminaRecovering
                      ? 'border-emerald-400/70 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                      : isFullyRested
                      ? 'border-emerald-500/40 shadow-[0_0_5px_rgba(16,185,129,0.2)]'
                      : 'border-neutral-700'
                  }`}
                  style={
                    isStaminaRecovering
                      ? {
                          animation: `stamina-pulse ${pulseDurationSec}s ease-in-out infinite`,
                        }
                      : isFullyRested
                      ? {
                          animation: 'stamina-full-rest 2.5s ease-in-out infinite',
                        }
                      : undefined
                  }
                >
                  <div
                    className={`h-full transition-all duration-150 relative overflow-hidden ${
                      player.stamina > 40
                        ? 'bg-emerald-500'
                        : player.stamina > 15
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, player.stamina))}%` }}
                  >
                    {/* Animated Shimmer Pulse wave moving across the filled bar when stationary */}
                    {isStaminaRecovering && (
                      <div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-transparent pointer-events-none"
                        style={{
                          animation: `stamina-shimmer ${pulseDurationSec}s linear infinite`,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Warmth (Body Heat) */}
            <div className="flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-[10px] text-neutral-300 leading-none mb-1">
                  <span>ТЕПЛО (МОРОЗ)</span>
                  <span className={player.warmth < 30 ? 'text-cyan-400 animate-pulse font-bold' : ''}>
                    {Math.round(player.warmth)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-700">
                  <div
                    className={`h-full transition-all duration-150 ${
                      player.warmth > 50 ? 'bg-orange-500' : player.warmth > 25 ? 'bg-sky-500' : 'bg-cyan-300'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, player.warmth))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Exoskeleton Battery & Boots Integrity */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-800 text-[10px]">
              <div className="flex items-center gap-1 text-neutral-300">
                <Battery className="w-3 h-3 text-sky-400" />
                <span>ЗАРЯД: {Math.round(player.battery)}%</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-300">
                <Shield className="w-3 h-3 text-amber-400" />
                <span className={player.bootsIntegrity < 25 ? 'text-red-400 font-bold' : ''}>
                  ОБУВЬ: {Math.round(player.bootsIntegrity)}%
                </span>
              </div>
            </div>

            {/* Breath meter if holding breath */}
            {player.isHoldingBreath && (
              <div className="pt-1">
                <div className="flex justify-between text-[9px] text-cyan-300 mb-0.5 font-bold">
                  <span>ЗАДЕРЖКА ДЫХАНИЯ</span>
                  <span>{Math.round(player.breathAir)}%</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-cyan-700">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-100"
                    style={{ width: `${player.breathAir}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Center of Gravity Balance Gauge (Signature Death Stranding mechanic) */}
          <div className="flex flex-col items-center pointer-events-auto">
            <div className="bg-neutral-950/85 backdrop-blur-md border border-neutral-800 rounded-xl px-4 py-2 shadow-xl flex flex-col items-center gap-1 w-64">
              <div className="flex justify-between w-full text-[10px] font-bold text-neutral-400">
                <span className={player.balance < -35 ? 'text-amber-400 animate-pulse' : ''}>[Л] КРЕН</span>
                <span className="text-neutral-200">БАЛАНС ГРУЗА</span>
                <span className={player.balance > 35 ? 'text-amber-400 animate-pulse' : ''}>КРЕН [П]</span>
              </div>

              {/* Physical Balance Incline Track */}
              <div className="w-full h-4 bg-neutral-900 rounded-full border border-neutral-700 relative overflow-hidden flex items-center justify-center">
                {/* Safe center zone */}
                <div className="absolute w-12 h-full bg-emerald-950/50 border-x border-emerald-600/40" />
                {/* Center marker line */}
                <div className="absolute w-0.5 h-full bg-neutral-500 z-10" />

                {/* Moving bubble weight indicator */}
                <div
                  className={`absolute w-5 h-3 rounded-full transition-all duration-100 shadow-md ${
                    Math.abs(player.balance) > 65
                      ? 'bg-red-500 ring-2 ring-red-300'
                      : Math.abs(player.balance) > 35
                      ? 'bg-amber-400 ring-1 ring-amber-200'
                      : 'bg-emerald-400'
                  }`}
                  style={{
                    left: `calc(50% + ${(player.balance / 100) * 44}% - 10px)`
                  }}
                />
              </div>

              {/* Stumble Warning Message */}
              {player.isStumbling ? (
                <div className="text-[10px] text-red-400 font-bold animate-bounce flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  ПАДЕНИЕ! ЗАЖМИТЕ СТРОПЫ!
                </div>
              ) : Math.abs(player.balance) > 40 ? (
                <div className="text-[10px] text-amber-400 font-medium">
                  {player.balance < 0 ? '← Тяните левую стропу [Л]' : 'Тяните правую стропу [П] →'}
                </div>
              ) : (
                <div className="text-[9px] text-neutral-400">
                  Вес: {totalWeight} / {maxWeight} кг
                </div>
              )}
            </div>

            {/* Weather condition tactical alert pill */}
            <div className="mt-1.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-950/90 border border-neutral-800 text-[10px] shadow-lg">
              {weather.type === 'BLIZZARD' && (
                <span className="text-sky-300 flex items-center gap-1 font-bold">
                  <CloudSnow className="w-3 h-3 animate-pulse" /> МЕТЕЛЬ: ВЕТЕР В ЛИЦО (-40% СКОРОСТЬ)
                </span>
              )}
              {weather.type === 'EXTREME_COLD' && (
                <span className="text-cyan-300 flex items-center gap-1 font-bold animate-pulse">
                  <Flame className="w-3 h-3" /> МОРОЗ {weather.tempCelsius}°C: ТЕПЛОПОТЕРЯ УСКОРЕНА
                </span>
              )}
              {weather.type === 'HEAVY_SNOWFALL' && (
                <span className="text-slate-300 flex items-center gap-1 font-medium">
                  <CloudSnow className="w-3 h-3" /> СНЕГОПАД: ГЛУБОКИЙ СНЕЖНЫЙ ПОКРОВ
                </span>
              )}
              {weather.type === 'ANOMALOUS_AURORA' && (
                <span className="text-emerald-300 flex items-center gap-1 font-bold animate-pulse">
                  <Sparkles className="w-3 h-3 text-emerald-400" /> АНОМАЛЬНОЕ СИЯНИЕ: РЕГЕНЕРАЦИЯ БАТАРЕИ
                </span>
              )}
              {weather.type === 'MAGNETIC_STORM' && (
                <span className="text-amber-300 flex items-center gap-1 font-bold animate-pulse">
                  <Zap className="w-3 h-3 text-amber-400" /> МАГНИТНАЯ БУРЯ: ПОМЕХИ СКАНЕРА «ЭХО-4»
                </span>
              )}
              {(weather.type === 'CLEAR_FROST' || weather.type === 'LIGHT_SNOW') && (
                <span className="text-neutral-400 flex items-center gap-1">
                  <span>{weather.nameRu} ({weather.tempCelsius}°C)</span>
                </span>
              )}
            </div>
          </div>

          {/* Top Right: Weather, Likes, PDA & Crafting Controls */}
          <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
            <div className="bg-neutral-950/80 backdrop-blur-md border border-neutral-800 rounded-lg px-3 py-1.5 shadow-xl flex items-center gap-3">
              {/* Likes counter */}
              <div className="flex items-center gap-1 text-xs text-amber-400 font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/80">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{playerLikes} 👍</span>
              </div>

              {/* Weather Status */}
              <div className="flex items-center gap-1.5 text-xs text-neutral-200">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span>{weather.nameRu}</span>
                <span className="text-cyan-300 font-bold">{weather.tempCelsius}°C</span>
              </div>

              {/* Audio Mute toggle */}
              <button
                id="btn-toggle-audio"
                type="button"
                onClick={onToggleMute}
                className="p-1.5 rounded-md bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
                title={isMuted ? 'Включить звук' : 'Выключить звук'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>

            {/* Menu Buttons: Crafting, Cargo, PDA */}
            <div className="flex items-center gap-1.5">
              <button
                id="btn-open-crafting"
                type="button"
                onClick={onOpenCrafting}
                className="px-2.5 py-1.5 rounded-lg bg-sky-950/90 border border-sky-600 text-sky-200 hover:bg-sky-900 hover:border-sky-400 transition-all text-xs flex items-center gap-1.5 shadow-lg active:scale-95"
              >
                <Hammer className="w-3.5 h-3.5 text-sky-400" />
                <span>КРАФТ</span>
              </button>

              <button
                id="btn-open-cargo"
                type="button"
                onClick={onOpenCargo}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-900/90 border border-neutral-700 text-neutral-200 hover:bg-neutral-800 hover:border-amber-400 transition-all text-xs flex items-center gap-1.5 shadow-lg active:scale-95"
              >
                <Package className="w-3.5 h-3.5 text-amber-400" />
                <span>ГРУЗ ({cargo.length})</span>
              </button>

              <button
                id="btn-open-pda"
                type="button"
                onClick={() => onOpenPDA('MAP')}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-700 text-emerald-200 hover:bg-emerald-900 hover:border-emerald-400 transition-all text-xs flex items-center gap-1.5 shadow-lg active:scale-95"
              >
                <FolderKanban className="w-3.5 h-3.5 text-emerald-400" />
                <span>КПК-7</span>
              </button>

              <button
                id="btn-open-journal"
                type="button"
                onClick={() => onOpenPDA('JOURNAL')}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-950/90 border border-teal-600/80 text-teal-200 hover:bg-teal-900 hover:border-teal-400 transition-all text-xs flex items-center gap-1.5 shadow-lg active:scale-95"
                title="Экспедиционный дневник и хроники аномалий"
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-300" />
                <span>ДНЕВНИК</span>
              </button>
            </div>

            {/* Tactical Zoom & Progressive LOD Slider Control */}
            {onChangeZoom && (
              <div className="bg-neutral-950/90 backdrop-blur-md border border-neutral-800 rounded-xl p-2 shadow-2xl flex flex-col gap-1.5 w-64 pointer-events-auto mt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1 text-sky-400 font-bold">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>МАСШТАБ И ДЕТАЛИ</span>
                  </div>
                  <span className="font-mono text-neutral-200 font-bold bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 text-[10px]">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>

                {/* Slider Row with Minus / Plus buttons */}
                <div className="flex items-center gap-2">
                  <button
                    id="btn-zoom-out"
                    type="button"
                    onClick={() => onChangeZoom(Math.max(0.65, Math.round((zoom - 0.15) * 100) / 100))}
                    className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    title="Уменьшить масштаб (отдалить обзор)"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>

                  <input
                    id="input-zoom-slider"
                    type="range"
                    min="0.65"
                    max="2.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => onChangeZoom(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                    title="Ползунок масштабирования (повышает детализацию при увеличении)"
                  />

                  <button
                    id="btn-zoom-in"
                    type="button"
                    onClick={() => onChangeZoom(Math.min(2.5, Math.round((zoom + 0.15) * 100) / 100))}
                    className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    title="Увеличить масштаб и детализацию (приблизить)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick preset chips */}
                <div className="flex items-center justify-between gap-1">
                  {[
                    { label: '0.75x', val: 0.75 },
                    { label: '1.0x', val: 1.0 },
                    { label: '1.5x', val: 1.5 },
                    { label: '2.0x', val: 2.0 },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => onChangeZoom(preset.val)}
                      className={`flex-1 py-0.5 text-[9px] rounded font-bold border transition-colors cursor-pointer ${
                        Math.abs(zoom - preset.val) < 0.08
                          ? 'bg-sky-500 text-neutral-950 border-sky-400'
                          : 'bg-neutral-900/90 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Dynamic Level-of-Detail Indicator Badge */}
                <div
                  className={`px-2 py-1 rounded text-[9px] border font-mono leading-tight ${
                    zoom >= 1.7
                      ? 'text-purple-300 border-purple-600/80 bg-purple-950/60'
                      : zoom >= 1.25
                      ? 'text-sky-300 border-sky-600/80 bg-sky-950/60'
                      : zoom >= 1.0
                      ? 'text-emerald-300 border-emerald-700/80 bg-emerald-950/60'
                      : 'text-neutral-400 border-neutral-700 bg-neutral-900/60'
                  }`}
                >
                  {zoom >= 1.7
                    ? '✦ МАКСИМУМ (LOD 3): Кристаллы, котелок, руны, светодиоды'
                    : zoom >= 1.25
                    ? '◆ ВЫСОКАЯ (LOD 2): Наст, иней, протекторы, карабины'
                    : zoom >= 1.0
                    ? '■ СТАНДАРТ (LOD 1): Базовые текстуры и тени'
                    : '○ ОБЗОР (LOD 0): Широкая перспектива тундры'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Delivery Objective Banner */}
        {activeMission && (
          <div className="self-center bg-neutral-950/90 backdrop-blur-md border border-sky-900/80 rounded-xl px-4 py-2 shadow-2xl flex items-center gap-5 pointer-events-auto">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-950 border border-sky-600 flex items-center justify-center text-sky-300">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-sky-400 uppercase font-semibold">
                  ЦЕЛЬ ДОСТАВКИ
                </div>
                <div className="text-xs text-neutral-100 font-bold">
                  {targetStation?.name || 'Пункт назначения'}
                </div>
              </div>
            </div>

            {distanceToTarget !== null && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-300 pl-3 border-l border-neutral-800">
                <Compass className="w-4 h-4 text-amber-400" />
                <span>{distanceToTarget} м</span>
              </div>
            )}

            <div className="flex items-center gap-2 pl-3 border-l border-neutral-800">
              <div className="text-[10px] text-neutral-400">ЦЕЛОСТНОСТЬ:</div>
              <div className={`text-xs font-bold ${avgIntegrity > 80 ? 'text-emerald-400' : avgIntegrity > 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {avgIntegrity}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Proximity Interaction Prompts (Station, NPC & Resource Gathering) */}
      <div className="w-full flex flex-col items-center gap-2 pointer-events-none">
        {nearbyStation && onOpenStation && !nearbyNPC && !nearbyResource && (
          <button
            id="btn-interact-station-prompt"
            type="button"
            onClick={onOpenStation}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-2 shadow-2xl animate-pulse active:scale-95 pointer-events-auto border border-emerald-300 cursor-pointer select-none"
          >
            <span className="text-base">🏛️</span>
            <span>[E] Терминал станции: {nearbyStation.name}</span>
          </button>
        )}

        {nearbyNPC && onInteractNPC && (
          <button
            id="btn-interact-npc-prompt"
            type="button"
            onClick={onInteractNPC}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold text-xs flex items-center gap-2 shadow-2xl animate-bounce active:scale-95 pointer-events-auto border border-sky-300 cursor-pointer select-none"
          >
            <span className="text-base">{nearbyNPC.portrait}</span>
            <span>[E] Поговорить: {nearbyNPC.name} ({nearbyNPC.role})</span>
          </button>
        )}

        {nearbyResource && onHarvestResource && !nearbyNPC && (
          <button
            id="btn-harvest-resource-prompt"
            type="button"
            onClick={onHarvestResource}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-2 shadow-2xl animate-pulse active:scale-95 pointer-events-auto border border-amber-300 cursor-pointer select-none"
          >
            <span>[F] Собрать: {nearbyResource.name}</span>
          </button>
        )}

        {/* Quick Tool belt (Termos, Ladder, Rope, Fire, Flare, Shelter) */}
        <div className="bg-neutral-950/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-1.5 flex items-center gap-1.5 shadow-2xl mb-14 pointer-events-auto">
          {tools.map(tool => (
            <button
              key={tool.id}
              id={`quick-tool-${tool.id}`}
              type="button"
              onClick={() => onUseTool(tool.id)}
              disabled={tool.count <= 0}
              className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs transition-all active:scale-95 ${
                tool.count > 0
                  ? 'bg-neutral-900/90 border-neutral-700 text-neutral-200 hover:bg-neutral-800 hover:border-amber-400'
                  : 'bg-neutral-950 border-neutral-900 text-neutral-600 cursor-not-allowed opacity-50'
              }`}
              title={tool.description}
            >
              <span className="text-sm">{tool.icon}</span>
              <span className="font-semibold">{tool.name.split(' ')[0]}</span>
              <span className="text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300 border border-neutral-700">
                x{tool.count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
