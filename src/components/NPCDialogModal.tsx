import React, { useState } from 'react';
import { WorldNPC, NPCQuest, TradeItem, ResourceItem, ToolItem } from '../types/game';
import { X, MessageSquare, ShoppingBag, Award, CheckCircle2, MapPin, Sparkles, Coins, PackageCheck, AlertCircle } from 'lucide-react';
import { sound } from '../utils/audio';

interface NPCDialogModalProps {
  npc: WorldNPC;
  playerLikes: number;
  resources: ResourceItem[];
  tools: ToolItem[];
  onAcceptQuest: (questId: string) => void;
  onTurnInQuest: (questId: string) => void;
  onBuyItem: (item: TradeItem) => void;
  onSellResource: (resourceType: string, amount: number, priceLikes: number) => void;
  onClose: () => void;
}

export const NPCDialogModal: React.FC<NPCDialogModalProps> = ({
  npc,
  playerLikes,
  resources,
  tools,
  onAcceptQuest,
  onTurnInQuest,
  onBuyItem,
  onSellResource,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'QUESTS' | 'TRADE'>('QUESTS');

  // Resource map for fast checking
  const resourceMap = new Map<string, number>();
  resources.forEach(r => resourceMap.set(r.type, r.count));

  return (
    <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[92vh] bg-neutral-900 border-2 border-sky-600/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-mono-tech crt-overlay">
        {/* Terminal Header */}
        <div className="bg-neutral-950 border-b border-sky-800/60 px-4 py-3 flex justify-between items-center text-sky-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-600 flex items-center justify-center text-xl">
              {npc.portrait}
            </div>
            <div>
              <div className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
                {npc.name}
                <span className="text-[10px] text-sky-600 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800">
                  {npc.callsign}
                </span>
              </div>
              <div className="text-[10px] text-neutral-400">
                {npc.role} • {npc.locationName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs text-amber-400 font-bold bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{playerLikes} 👍</span>
            </div>

            <button
              id="btn-close-npc-dialog"
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg border border-sky-800 text-sky-400 hover:text-sky-100 hover:bg-sky-950 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NPC Dialogue speech box */}
        <div className="bg-neutral-950/90 border-b border-neutral-800/80 p-3.5 px-4 flex items-start gap-3">
          <div className="text-2xl p-2 rounded-xl bg-neutral-900 border border-neutral-800 shrink-0">
            {npc.portrait}
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-sky-300">{npc.name}:</div>
            <p className="text-xs text-neutral-200 italic mt-0.5 leading-relaxed">
              {npc.greeting}
            </p>
            <div className="text-[10px] text-neutral-500 mt-1">
              {npc.lore}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-neutral-950/50 border-b border-neutral-800/80 px-3 py-1.5 flex gap-2 text-xs">
          <button
            id="tab-npc-quests"
            type="button"
            onClick={() => setActiveTab('QUESTS')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'QUESTS'
                ? 'bg-sky-900/60 text-sky-200 border border-sky-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-sky-400" />
            ЗАДАНИЯ И ПРОСЬБЫ ({npc.quests.length})
          </button>

          <button
            id="tab-npc-trade"
            type="button"
            onClick={() => setActiveTab('TRADE')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'TRADE'
                ? 'bg-amber-900/60 text-amber-200 border border-amber-500 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
            ОБМЕН И ТОРГОВЛЯ ({npc.tradeInventory.length})
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 text-neutral-300 max-h-[60vh]">
          {/* TAB 1: NPC QUESTS */}
          {activeTab === 'QUESTS' && (
            <div className="flex flex-col gap-3">
              {npc.quests.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  У этого персонажа пока нет поручений.
                </div>
              ) : (
                npc.quests.map(quest => {
                  const isGathering = quest.type === 'GATHERING';
                  const isExploration = quest.type === 'EXPLORATION';

                  // Check if gathering quest requirements met
                  const canTurnInGathering = isGathering && quest.requiredResources
                    ? quest.requiredResources.every(req => (resourceMap.get(req.type) || 0) >= req.amount)
                    : false;

                  const isComplete = quest.status === 'COMPLETED';
                  const isActive = quest.status === 'ACTIVE';
                  const isAvailable = quest.status === 'AVAILABLE';

                  return (
                    <div
                      key={quest.id}
                      className={`p-4 rounded-xl border flex flex-col gap-3 transition-all ${
                        isComplete
                          ? 'bg-neutral-950/40 border-neutral-800 opacity-60'
                          : isActive
                          ? 'bg-sky-950/30 border-sky-600/80 shadow-lg'
                          : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {isExploration ? '🧭' : isGathering ? '🍄' : '📦'}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-neutral-100 flex items-center gap-2">
                              {quest.title}
                              <span className="text-[9px] px-1.5 py-0.5 rounded border text-sky-400 border-sky-800 bg-sky-950">
                                {isExploration ? 'РАЗВЕДКА' : isGathering ? 'СБОР РЕСУРСОВ' : 'ДОСТАВКА'}
                              </span>
                            </div>
                            {quest.targetName && (
                              <div className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                <span>Цель: {quest.targetName}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold bg-amber-950/40 px-2 py-1 rounded border border-amber-800">
                          <Sparkles className="w-3 h-3" />
                          <span>+{quest.rewardLikes} 👍</span>
                        </div>
                      </div>

                      <p className="text-xs text-neutral-300 leading-relaxed italic">
                        {quest.description}
                      </p>

                      {/* Required Resources for Gathering */}
                      {isGathering && quest.requiredResources && (
                        <div className="bg-neutral-900/80 rounded-lg p-2.5 border border-neutral-800 flex flex-col gap-1.5 text-xs">
                          <div className="text-[10px] text-neutral-400 font-bold uppercase">
                            ТРЕБУЕМЫЕ РЕСУРСЫ:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {quest.requiredResources.map(req => {
                              const current = resourceMap.get(req.type) || 0;
                              const hasEnough = current >= req.amount;
                              const meta = resources.find(r => r.type === req.type);

                              return (
                                <div
                                  key={req.type}
                                  className={`px-2 py-1 rounded border flex items-center gap-1.5 ${
                                    hasEnough
                                      ? 'bg-emerald-950/50 border-emerald-700 text-emerald-300'
                                      : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                                  }`}
                                >
                                  <span>{meta?.icon || '📦'}</span>
                                  <span>{meta?.name || req.type}:</span>
                                  <span className="font-bold">
                                    {current} / {req.amount}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Reward Items preview */}
                      {quest.rewardItems && quest.rewardItems.length > 0 && (
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                          <span className="text-[10px] uppercase font-semibold">Награда за помощь:</span>
                          {quest.rewardItems.map((item, idx) => (
                            <span key={idx} className="bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded text-neutral-200">
                              {item.icon} {item.name} x{item.count}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="pt-1 flex justify-end">
                        {isComplete ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold py-1">
                            <CheckCircle2 className="w-4 h-4" />
                            ЗАДАНИЕ ВЫПОЛНЕНО
                          </div>
                        ) : isActive && isGathering && canTurnInGathering ? (
                          <button
                            type="button"
                            onClick={() => onTurnInQuest(quest.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95"
                          >
                            <PackageCheck className="w-4 h-4" />
                            ОТДАТЬ РЕСУРСЫ И ПОЛУЧИТЬ НАГРАДУ
                          </button>
                        ) : isActive && isExploration && quest.progress >= quest.maxProgress ? (
                          <button
                            type="button"
                            onClick={() => onTurnInQuest(quest.id)}
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95"
                          >
                            <PackageCheck className="w-4 h-4" />
                            СДАТЬ ОТЧЕТ О РАЗВЕДКЕ
                          </button>
                        ) : isActive ? (
                          <div className="text-xs text-sky-400 font-medium py-1">
                            Выполняется... {isExploration ? 'Исследуйте координаты сканером' : 'Соберите недостающие ресурсы'}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onAcceptQuest(quest.id)}
                            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95"
                          >
                            <Award className="w-4 h-4" />
                            ВЗЯТЬСЯ ЗА ВЫПОЛНЕНИЕ
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: BARTER & TRADING SHOP */}
          {activeTab === 'TRADE' && (
            <div className="flex flex-col gap-5">
              {/* Buy Section */}
              <div className="flex flex-col gap-2.5">
                <div className="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  ТОВАРЫ НА ПРОДАЖУ У {npc.name.toUpperCase()}:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {npc.tradeInventory.map(item => {
                    const canAfford = playerLikes >= item.priceLikes;

                    return (
                      <div
                        key={item.id}
                        className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-3 flex flex-col justify-between gap-2 hover:border-neutral-700 transition-all"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="text-2xl p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 shrink-0">
                            {item.icon}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-neutral-100">{item.name}</div>
                            <div className="text-[10px] text-neutral-400 mt-0.5">{item.description}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-neutral-900">
                          <div className="text-xs text-amber-400 font-bold">
                            {item.priceLikes} 👍
                          </div>

                          <button
                            type="button"
                            onClick={() => onBuyItem(item)}
                            disabled={!canAfford}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                              canAfford
                                ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
                            }`}
                          >
                            КУПИТЬ
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sell Resources for Likes */}
              <div className="flex flex-col gap-2.5 pt-3 border-t border-neutral-800">
                <div className="text-xs text-sky-400 font-bold uppercase tracking-wider flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  ПРОДАТЬ НАЙДЕННЫЕ В ТАЙГЕ РЕСУРСЫ:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {resources.filter(r => r.count > 0).map(res => {
                    const sellPrice = Math.max(30, Math.round(res.weightKg * 60));

                    return (
                      <div
                        key={res.type}
                        className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{res.icon}</span>
                          <div>
                            <div className="text-xs font-semibold text-neutral-200">
                              {res.name}
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              В наличии: {res.count} шт. (+{sellPrice} 👍/шт.)
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSellResource(res.type, 1, sellPrice)}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-950 border border-sky-700 hover:bg-sky-900 text-sky-200 text-xs font-bold transition-all active:scale-95"
                        >
                          ПРОДАТЬ 1
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
