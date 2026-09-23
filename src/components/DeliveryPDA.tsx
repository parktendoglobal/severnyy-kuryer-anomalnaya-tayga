import React, { useState } from 'react';
import {
  Station,
  DeliveryMission,
  PlayerStats,
  PlacedStructure
} from '../types/game';
import {
  X,
  Map,
  ClipboardList,
  Network,
  BookOpen,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Radio,
  Sparkles,
  Flame,
  Shield,
  Layers,
  Compass
} from 'lucide-react';
import { STATIONS } from '../utils/constants';
import { ExplorersJournalView } from './ExplorersJournalView';
import { JOURNAL_ENTRIES } from '../utils/journalData';

interface DeliveryPDAProps {
  initialTab?: 'MAP' | 'MISSIONS' | 'NETWORK' | 'JOURNAL' | 'HANDBOOK';
  player: PlayerStats;
  stations: Station[];
  missions: DeliveryMission[];
  structures: PlacedStructure[];
  activeMission: DeliveryMission | null;
  discoveredRegionIds?: string[];
  onAcceptMission: (missionId: string) => void;
  onClose: () => void;
}

export const DeliveryPDA: React.FC<DeliveryPDAProps> = ({
  initialTab = 'MAP',
  player,
  stations,
  missions,
  structures,
  activeMission,
  discoveredRegionIds = ['region_basin'],
  onAcceptMission,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'MAP' | 'MISSIONS' | 'NETWORK' | 'JOURNAL' | 'HANDBOOK'>(initialTab);

  const connectedCount = stations.filter(s => s.connected).length;
  const networkPercent = Math.round((connectedCount / stations.length) * 100);

  const regionSet = new Set(discoveredRegionIds);
  const unlockedLoreCount = JOURNAL_ENTRIES.filter(e => regionSet.has(e.regionId)).length;

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Soviet rugged field computer casing */}
      <div className="w-full max-w-4xl max-h-[92vh] bg-neutral-900 border-2 border-emerald-600/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative crt-overlay">
        {/* Terminal Header */}
        <div className="bg-neutral-950 border-b border-emerald-700/60 px-4 py-2.5 flex justify-between items-center text-emerald-400 font-mono-tech">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 animate-pulse text-emerald-300" />
            <div>
              <div className="text-sm font-bold tracking-widest uppercase">
                КПК-7М «ТАЙГА-СВЯЗЬ» // СЕТЬ ЕВРАЗИЯ
              </div>
              <div className="text-[10px] text-emerald-600">
                ПОЗЫВНОЙ: КЕДР-01 | СТАТУС: В ПОЛЕ | БЛАГОДАРНОСТИ: {player.totalLikes}
              </div>
            </div>
          </div>

          <button
            id="btn-close-pda"
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg border border-emerald-800 text-emerald-400 hover:text-emerald-100 hover:bg-emerald-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-neutral-950/60 border-b border-emerald-900/60 px-3 py-1 flex gap-1.5 overflow-x-auto text-xs font-mono-tech">
          <button
            id="tab-pda-map"
            type="button"
            onClick={() => setActiveTab('MAP')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'MAP'
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            КАРТА ТАЙГИ
          </button>

          <button
            id="tab-pda-missions"
            type="button"
            onClick={() => setActiveTab('MISSIONS')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'MISSIONS'
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            ЗАКАЗЫ ({missions.filter(m => m.status === 'AVAILABLE' || m.status === 'IN_TRANSIT').length})
          </button>

          <button
            id="tab-pda-network"
            type="button"
            onClick={() => setActiveTab('NETWORK')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'NETWORK'
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            СЕТЬ «СВЯЗЬ-СЕВЕР» ({networkPercent}%)
          </button>

          <button
            id="tab-pda-journal"
            type="button"
            onClick={() => setActiveTab('JOURNAL')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'JOURNAL'
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>ДНЕВНИК ИССЛЕДОВАТЕЛЯ</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-900 text-emerald-400 border border-emerald-700/60 font-mono">
              {unlockedLoreCount}/{JOURNAL_ENTRIES.length}
            </span>
          </button>

          <button
            id="tab-pda-handbook"
            type="button"
            onClick={() => setActiveTab('HANDBOOK')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'HANDBOOK'
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            ПАМЯТКА КУРЬЕРА
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 font-mono-tech text-neutral-300">
          {/* TAB 1: KARTA TAIGI */}
          {activeTab === 'MAP' && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center text-xs text-emerald-400">
                <span>ТОПОГРАФИЧЕСКИЙ ПЛАНШЕТ РЕГИОНА (120x120 км)</span>
                <span>ПОЗИЦИЯ: X:{Math.round(player.x)} Y:{Math.round(player.y)}</span>
              </div>

              {/* Minimap Canvas Container */}
              <div className="relative w-full aspect-[4/3] max-h-[50vh] bg-neutral-950 rounded-xl border border-emerald-700/60 overflow-hidden flex items-center justify-center p-2">
                {/* Visual stylized radar map */}
                <div className="relative w-full h-full bg-neutral-900/90 rounded-lg overflow-hidden border border-emerald-900/80">
                  {/* Grid lines */}
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: 'radial-gradient(#10B981 1px, transparent 1px)',
                      backgroundSize: '24px 24px'
                    }}
                  />

                  {/* River representation */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 120 120">
                    <path
                      d="M 45,0 Q 55,30 40,60 T 48,120"
                      fill="none"
                      stroke="#0284C7"
                      strokeWidth="3.5"
                      strokeDasharray="2,2"
                      opacity="0.6"
                    />

                    {/* Network links between connected stations */}
                    {stations.map(st => {
                      if (!st.connected) return null;
                      const base = stations.find(s => s.id === 'station_kedr');
                      if (!base || base.id === st.id) return null;
                      return (
                        <line
                          key={`link-${st.id}`}
                          x1={base.x}
                          y1={base.y}
                          x2={st.x}
                          y2={st.y}
                          stroke="#38BDF8"
                          strokeWidth="1.2"
                          strokeDasharray="2,1"
                          opacity="0.7"
                        />
                      );
                    })}
                  </svg>

                  {/* Anomaly danger zones marked on map */}
                  <div
                    className="absolute rounded-full border border-dashed border-red-500/70 bg-red-950/20 flex items-center justify-center pointer-events-none"
                    style={{
                      left: '20%',
                      top: '40%',
                      width: '26%',
                      height: '26%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <span className="text-[8px] text-red-400 font-bold tracking-tighter">
                      ЗОНА ТЕНЕЙ
                    </span>
                  </div>

                  <div
                    className="absolute rounded-full border border-dashed border-purple-500/70 bg-purple-950/20 flex items-center justify-center pointer-events-none"
                    style={{
                      left: '70%',
                      top: '50%',
                      width: '22%',
                      height: '22%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <span className="text-[8px] text-purple-400 font-bold tracking-tighter">
                      ВОРОНКИ
                    </span>
                  </div>

                  {/* Placed structures */}
                  {structures.map(struct => (
                    <div
                      key={struct.id}
                      className="absolute text-[10px] transform -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${(struct.x / 120) * 100}%`,
                        top: `${(struct.y / 120) * 100}%`
                      }}
                      title={struct.type}
                    >
                      {struct.type === 'CAMPFIRE' && '🔥'}
                      {struct.type === 'LADDER' && '🪜'}
                      {struct.type === 'ROPE' && '🪢'}
                      {struct.type === 'BEACON' && '🚩'}
                    </div>
                  ))}

                  {/* Stations icons on map */}
                  {stations.map(st => (
                    <div
                      key={st.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer group"
                      style={{
                        left: `${(st.x / 120) * 100}%`,
                        top: `${(st.y / 120) * 100}%`
                      }}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          st.connected
                            ? 'bg-sky-500 border-sky-200 text-neutral-950 shadow-lg shadow-sky-500/50'
                            : 'bg-neutral-800 border-neutral-600 text-neutral-400'
                        }`}
                      >
                        <MapPin className="w-2.5 h-2.5" />
                      </div>
                      <span className="text-[9px] font-bold bg-neutral-950/80 px-1 rounded border border-neutral-800 mt-0.5 whitespace-nowrap text-neutral-200">
                        {st.callsign}
                      </span>
                    </div>
                  ))}

                  {/* Player Courier Position Pin */}
                  <div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                      left: `${(player.x / 120) * 100}%`,
                      top: `${(player.y / 120) * 100}%`
                    }}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white animate-ping absolute" />
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white relative shadow-lg shadow-amber-500" />
                  </div>
                </div>
              </div>

              {/* Map Legend */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                  <div className="w-3 h-3 rounded-full bg-sky-400" />
                  <span>Станция в сети</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                  <div className="w-3 h-3 rounded-full bg-neutral-600" />
                  <span>Отрезанный узел</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <span>Курьер (вы)</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                  <span className="text-sm">🔥 🪜</span>
                  <span>Костры и лестницы</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ZAKAZY DOSTAVKI */}
          {activeTab === 'MISSIONS' && (
            <div className="flex flex-col gap-3">
              <div className="text-xs text-emerald-400 mb-1">
                ДОСТУПНЫЕ И АКТИВНЫЕ ЗАКАЗЫ СЕТИ «СЕВЕР-СВЯЗЬ»
              </div>

              {missions.map(mis => {
                const sender = stations.find(s => s.id === mis.senderStationId);
                const target = stations.find(s => s.id === mis.targetStationId);
                const isCurrent = activeMission?.id === mis.id;
                const totalKg = mis.cargoItems.reduce((acc, c) => acc + c.weightKg, 0);

                return (
                  <div
                    key={mis.id}
                    className={`rounded-xl border p-4 transition-all flex flex-col gap-3 ${
                      isCurrent
                        ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-400'
                        : mis.status === 'COMPLETED'
                        ? 'bg-neutral-950/40 border-neutral-800 opacity-60'
                        : 'bg-neutral-950/80 border-neutral-800 hover:border-emerald-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-neutral-100">{mis.title}</span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500 text-neutral-950 text-[10px] font-bold uppercase">
                              В Пути
                            </span>
                          )}
                          {mis.status === 'COMPLETED' && (
                            <span className="px-2 py-0.5 rounded bg-neutral-700 text-neutral-300 text-[10px] font-bold uppercase">
                              Доставлено
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          Отправитель: {sender?.name} ({mis.senderName}) → Получатель: {target?.name}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-amber-400">
                          +{mis.rewardLikes} Благодарностей
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          Вес партии: {totalKg.toFixed(1)} кг
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-300 bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800">
                      {mis.description}
                    </p>

                    {/* Cargo items list */}
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[11px] text-neutral-400 uppercase font-semibold">
                        Содержимое контейнеров:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {mis.cargoItems.map(c => (
                          <div
                            key={c.id}
                            className="bg-neutral-900 border border-neutral-800 p-2 rounded-lg flex justify-between items-center text-xs"
                          >
                            <span className="text-neutral-200">{c.name}</span>
                            <span className="text-neutral-400 font-mono">{c.weightKg} кг</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action button */}
                    {mis.status === 'AVAILABLE' && !activeMission && (
                      <div className="flex justify-end pt-2 border-t border-neutral-800">
                        <button
                          id={`btn-accept-${mis.id}`}
                          type="button"
                          onClick={() => onAcceptMission(mis.id)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold text-xs transition-all shadow-lg active:scale-95"
                        >
                          ПРИНЯТЬ ЗАКАЗ К ДОСТАВКЕ
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: NETWORK STATUS & BLUEPRINTS */}
          {activeTab === 'NETWORK' && (
            <div className="flex flex-col gap-4">
              <div className="bg-emerald-950/30 border border-emerald-700/60 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-emerald-300">
                    ЕДИНАЯ РАДИОСЕТЬ ЕВРАЗИИ: ПОКРЫТИЕ {networkPercent}%
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    Подключено станций: {connectedCount} из {stations.length}. Каждое подключение открывает чертежи улучшений!
                  </div>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center font-bold text-emerald-300 text-lg">
                  {networkPercent}%
                </div>
              </div>

              {/* Station List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {stations.map(st => (
                  <div
                    key={st.id}
                    className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                      st.connected
                        ? 'bg-neutral-950/80 border-sky-700/70'
                        : 'bg-neutral-950/40 border-neutral-800 opacity-70'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-neutral-100">{st.name}</span>
                      {st.connected ? (
                        <span className="text-[10px] text-sky-400 flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> В СЕТИ
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> ОФФЛАЙН
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-400">{st.description}</div>
                    <div className="text-[10px] text-emerald-400 mt-1">
                      Контакт: {st.npcName} ({st.npcRole})
                    </div>
                  </div>
                ))}
              </div>

              {/* Fabricator Blueprints unlocked */}
              <div className="flex flex-col gap-2 mt-2">
                <div className="text-xs text-emerald-400 uppercase font-semibold">
                  РАЗБЛОКИРОВАННЫЕ ТЕХНОЛОГИИ КУРЬЕРА:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                      <Shield className="w-4 h-4" /> Валенки «Север-3»
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Подошва с твердосплавными шипами. Износ на льду снижен на 40%.
                    </div>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                      <Layers className="w-4 h-4" /> Раскладная лестница ПЛ-4
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Сверхпрочный сплав. Преодолевает расщелины до 4 клеток.
                    </div>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-xl flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-orange-300">
                      <Flame className="w-4 h-4" /> Таёжный костровой набор
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Парафиновые брикеты. Быстро разжигает огонь даже в буран.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HANDBOOK (SURVIVAL GUIDE) */}
          {activeTab === 'HANDBOOK' && (
            <div className="flex flex-col gap-4 text-xs leading-relaxed">
              <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex flex-col gap-2">
                <div className="font-bold text-amber-400 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> 1. БАЛАНСИРОВКА И СТРОПЫ РЮКЗАКА
                </div>
                <p>
                  Большой груз смещает центр тяжести курьера. При ходьбе по сугробам, ледяным склонам или под порывами бурана следите за пузырьковым уровнем баланса вверху экрана:
                </p>
                <ul className="list-disc list-inside text-neutral-400 space-y-1 pl-2">
                  <li>При крене влево зажимайте левую стропу <span className="text-amber-400 font-bold">[Л]</span> (клавиша Q).</li>
                  <li>При крене вправо зажимайте правую стропу <span className="text-amber-400 font-bold">[П]</span> (клавиша E).</li>
                  <li>Если упадете — груз рассыплется и контейнеры получат повреждения!</li>
                </ul>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex flex-col gap-2">
                <div className="font-bold text-sky-400 text-sm flex items-center gap-2">
                  <Radio className="w-4 h-4" /> 2. СКАНЕР МЕСТНОСТИ «ЭХО-4» (АНАЛОГ ОДРАДЕКА)
                </div>
                <p>
                  Нажмите кнопку <span className="text-sky-300 font-bold">«Эхо-4»</span> (или клавишу F / Пробел), чтобы послать локационный импульс:
                </p>
                <ul className="list-disc list-inside text-neutral-400 space-y-1 pl-2">
                  <li><span className="text-sky-400 font-bold">Синий маркер:</span> плотный наст (безопасно, обычный расход сил).</li>
                  <li><span className="text-amber-400 font-bold">Желтый маркер:</span> глубокий сугроб / топь (замедление, высокий расход сил).</li>
                  <li><span className="text-red-400 font-bold">Красный маркер:</span> скользкий наслуд / обрыв (высокий риск споткнуться!).</li>
                </ul>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex flex-col gap-2">
                <div className="font-bold text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> 3. АНОМАЛИЯ «ХЛАДНЫЕ ТЕНИ» (ПРИЗРАКИ ТАЙГИ)
                </div>
                <p>
                  В аномальных зонах и во время бурана из тумана выходят черные тени с пуповинами в небо. Сенсор сканера на плече начинает вращаться и указывать на них:
                </p>
                <ul className="list-disc list-inside text-neutral-400 space-y-1 pl-2">
                  <li>Не бегите рядом с тенями — они слышат хруст наста.</li>
                  <li>Зажмите кнопку <span className="text-cyan-300 font-bold">«Дыхание»</span> (клавиша C), чтобы двигаться бесшумно.</li>
                  <li>Следите за остатком воздуха — при нехватке кислорода курьер начнет кашлять.</li>
                </ul>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex flex-col gap-2">
                <div className="font-bold text-orange-400 text-sm flex items-center gap-2">
                  <Flame className="w-4 h-4" /> 4. ВЫЖИВАНИЕ В БУРАН
                </div>
                <p>
                  Сибирские морозы смертельны. Пейте горячий чай из термоса и разводите костры в укрытиях. На базах отдых полностью восстанавливает тепло и здоровье.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: EXPLORER'S JOURNAL */}
          {activeTab === 'JOURNAL' && (
            <ExplorersJournalView
              player={player}
              discoveredRegionIds={discoveredRegionIds}
              onSwitchToMapTab={() => setActiveTab('MAP')}
            />
          )}
        </div>
      </div>
    </div>
  );
};
