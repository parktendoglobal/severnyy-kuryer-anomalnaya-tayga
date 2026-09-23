import React from 'react';
import { CargoItem, ToolItem } from '../types/game';
import { X, Package, Shield, Sparkles, Scale, AlertTriangle, RefreshCw } from 'lucide-react';

interface CargoInventoryModalProps {
  cargo: CargoItem[];
  tools: ToolItem[];
  maxWeightKg: number;
  onAutoArrange: () => void;
  onRepairCargo: (cargoId: string) => void;
  onClose: () => void;
}

export const CargoInventoryModal: React.FC<CargoInventoryModalProps> = ({
  cargo,
  tools,
  maxWeightKg,
  onAutoArrange,
  onRepairCargo,
  onClose
}) => {
  const totalCargoKg = cargo.reduce((acc, c) => acc + c.weightKg, 0);
  const totalToolsKg = tools.reduce((acc, t) => acc + t.weightKg * t.count, 0);
  const totalWeight = Math.round((totalCargoKg + totalToolsKg) * 10) / 10;
  const weightPercent = Math.min(100, Math.round((totalWeight / maxWeightKg) * 100));

  // Compute cargo stack stability based on bottom vs top weight
  const bottomWeight = cargo.filter(c => c.slot === 'BACKPACK_BOTTOM').reduce((a, b) => a + b.weightKg, 0);
  const topWeight = cargo.filter(c => c.slot === 'BACKPACK_TOP').reduce((a, b) => a + b.weightKg, 0);
  const isTopHeavy = topWeight > bottomWeight + 5;

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-neutral-900 border-2 border-amber-600/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-mono-tech crt-overlay max-h-[90vh]">
        {/* Header */}
        <div className="bg-neutral-950 border-b border-amber-700/60 px-4 py-3 flex justify-between items-center text-amber-400">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-amber-300" />
            <div>
              <div className="text-sm font-bold tracking-wider uppercase">
                ГРУЗОВОЙ СТАНКОВЫЙ РЮКЗАК «ЕРМАК-80»
              </div>
              <div className="text-[10px] text-amber-600">
                РАСПРЕДЕЛЕНИЕ ВЕСА И КРЕПЛЕНИЕ СТРОП
              </div>
            </div>
          </div>

          <button
            id="btn-close-cargo"
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg border border-amber-800 text-amber-400 hover:text-amber-100 hover:bg-amber-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-neutral-300">
          {/* Weight & Balance Overview Bar */}
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-3.5 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1.5 text-neutral-200 font-bold">
                <Scale className="w-4 h-4 text-amber-400" />
                НАГРУЗКА: {totalWeight} / {maxWeightKg} кг
              </span>
              <span className={`font-bold ${weightPercent > 85 ? 'text-red-400' : 'text-amber-400'}`}>
                {weightPercent}% ЛИМИТА
              </span>
            </div>

            <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-700">
              <div
                className={`h-full transition-all duration-300 ${
                  weightPercent > 85 ? 'bg-red-500' : weightPercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${weightPercent}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-neutral-800">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  Стабильность центра тяжести:{' '}
                  <span className={isTopHeavy ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {isTopHeavy ? 'ВЕРХНИЙ ПЕРЕВЕС (ОПАСНО)' : 'ОПТИМАЛЬНАЯ'}
                  </span>
                </span>
              </div>

              {/* Auto-Arrange Button */}
              <button
                id="btn-auto-arrange-cargo"
                type="button"
                onClick={onAutoArrange}
                className="px-3 py-1 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <RefreshCw className="w-3 h-3" />
                АВТО-БАЛАНСИРОВКА
              </button>
            </div>
          </div>

          {/* Cargo Container Cards List */}
          <div className="flex flex-col gap-2">
            <div className="text-xs text-neutral-400 uppercase font-semibold">
              Контейнеры на подвеске ({cargo.length}):
            </div>

            {cargo.length === 0 ? (
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-8 text-center text-xs text-neutral-500">
                Рюкзак пуст. Возьмите новые заказы снабжения в терминале КПК или на станциях.
              </div>
            ) : (
              cargo.map(item => (
                <div
                  key={item.id}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex justify-between items-center gap-3 hover:border-amber-700/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold text-sm ${
                        item.category === 'MEDICAL'
                          ? 'bg-red-950/60 border-red-600 text-red-300'
                          : item.category === 'RADIO_TUBES'
                          ? 'bg-amber-950/60 border-amber-600 text-amber-300'
                          : item.category === 'ISOTOPE_BATTERY'
                          ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                          : 'bg-neutral-900 border-neutral-700 text-neutral-300'
                      }`}
                    >
                      📦
                    </div>

                    <div>
                      <div className="text-xs font-bold text-neutral-100 flex items-center gap-2">
                        {item.name}
                        {item.isFragile && (
                          <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700">
                            ХРУПКОЕ
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <div className="text-right">
                      <div className="font-mono text-neutral-200">{item.weightKg} кг</div>
                      <div
                        className={`text-[10px] font-bold ${
                          item.currentIntegrity > 80
                            ? 'text-emerald-400'
                            : item.currentIntegrity > 40
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {Math.round(item.currentIntegrity)}% ЦЕЛОСТНОСТЬ
                      </div>
                    </div>

                    {/* Repair button if damaged */}
                    {item.currentIntegrity < 90 && (
                      <button
                        type="button"
                        onClick={() => onRepairCargo(item.id)}
                        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-600 text-[10px] active:scale-95"
                        title="Нанести защитную термопену"
                      >
                        Герметик
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Expedition Gear / Tools */}
          <div className="flex flex-col gap-2 mt-2">
            <div className="text-xs text-neutral-400 uppercase font-semibold">
              Походное снаряжение челнока:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {tools.map(t => (
                <div
                  key={t.id}
                  className="bg-neutral-950 border border-neutral-800 p-2.5 rounded-xl flex items-center gap-2"
                >
                  <span className="text-xl">{t.icon}</span>
                  <div>
                    <div className="font-bold text-neutral-200">{t.name.split(' ')[0]}</div>
                    <div className="text-[10px] text-neutral-400">
                      Кол-во: {t.count} шт | {(t.weightKg * t.count).toFixed(1)} кг
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
