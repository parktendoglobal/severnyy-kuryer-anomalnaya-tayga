import React from 'react';
import { Station, DeliveryMission, CargoItem, ToolItem } from '../types/game';
import { X, CheckCircle2, Flame, Shield, Battery, Coffee, PackageCheck, Sparkles } from 'lucide-react';

interface StationTerminalModalProps {
  station: Station;
  cargo: CargoItem[];
  activeMission: DeliveryMission | null;
  onDeliverMission: () => void;
  onRestAndRefuel: () => void;
  onRestockTool: (toolType: ToolItem['type']) => void;
  onClose: () => void;
}

export const StationTerminalModal: React.FC<StationTerminalModalProps> = ({
  station,
  cargo,
  activeMission,
  onDeliverMission,
  onRestAndRefuel,
  onRestockTool,
  onClose
}) => {
  const canDeliver = activeMission && activeMission.targetStationId === station.id;

  return (
    <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-neutral-900 border-2 border-sky-600/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-mono-tech crt-overlay">
        {/* Terminal Header */}
        <div className="bg-neutral-950 border-b border-sky-800/60 px-4 py-3 flex justify-between items-center text-sky-400">
          <div>
            <div className="text-sm font-bold tracking-wider uppercase flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              {station.name} // ТЕРМИНАЛ «СЕВЕР-СВЯЗЬ»
            </div>
            <div className="text-[10px] text-sky-600">
              РЕГИОН: {station.region} | ПОЗЫВНОЙ: {station.callsign}
            </div>
          </div>

          <button
            id="btn-close-station-terminal"
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg border border-sky-800 text-sky-400 hover:text-sky-100 hover:bg-sky-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4 text-neutral-300 overflow-y-auto max-h-[80vh]">
          {/* NPC Dialogue Box */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-950 border border-sky-600 flex items-center justify-center text-2xl shrink-0">
              👤
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-xs font-bold text-sky-300">
                {station.npcName} <span className="text-neutral-500 font-normal">({station.npcRole})</span>
              </div>
              <p className="text-xs text-neutral-200 italic">
                {canDeliver
                  ? '«Слава богу, челнок добрался сквозь буран! Давай скорее груз, мы уже отчаялись ждать. Как там тайга?»'
                  : station.connected
                  ? '«Заходи, погрейся у печи. Чай с брусникой всегда готов. Снабжение через твой маршрут держит нас на плаву!»'
                  : '«Мы отрезаны от Большой земли уже три месяца. Если сможешь наладить линию связи и доставить заказ — станция подключится к Евразийской сети!»'}
              </p>
            </div>
          </div>

          {/* Delivery Hand-in Section */}
          {canDeliver && (
            <div className="bg-emerald-950/40 border border-emerald-500 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <PackageCheck className="w-5 h-5 text-emerald-400" />
                  ПРИЁМКА ЗАКАЗА: {activeMission.title}
                </div>
                <div className="text-xs text-amber-400 font-bold">
                  Награда: +{activeMission.rewardLikes} Благодарностей
                </div>
              </div>

              <div className="text-xs text-neutral-300">
                Контейнеры доставлены в целости. Нажмите для передачи груза и фиксации рейтинга курьера.
              </div>

              <button
                id="btn-complete-delivery"
                type="button"
                onClick={onDeliverMission}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                СДАТЬ ГРУЗ И ПОЛУЧИТЬ ОЦЕНКУ
              </button>
            </div>
          )}

          {/* Rest & Recovery Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="btn-station-rest"
              type="button"
              onClick={onRestAndRefuel}
              className="bg-neutral-950 border border-neutral-800 hover:border-amber-500/80 p-3.5 rounded-xl flex items-center gap-3 transition-all text-left active:scale-95"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-600 flex items-center justify-center text-amber-400 shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-100">ОТОГРЕТЬСЯ И ОТДОХНУТЬ</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  100% Тепло, Выносливость и Заряд батареи
                </div>
              </div>
            </button>

            <button
              id="btn-station-restock-thermos"
              type="button"
              onClick={() => onRestockTool('THERMAL_FLASK')}
              className="bg-neutral-950 border border-neutral-800 hover:border-sky-500/80 p-3.5 rounded-xl flex items-center gap-3 transition-all text-left active:scale-95"
            >
              <div className="w-10 h-10 rounded-lg bg-sky-950/60 border border-sky-600 flex items-center justify-center text-sky-400 shrink-0">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-100">НАЛИТЬ ТАЁЖНЫЙ ЧАЙ</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">
                  Пополнить походный термос (до 4 порций)
                </div>
              </div>
            </button>
          </div>

          {/* Workshop & Expeditions Supplies */}
          <div className="flex flex-col gap-2">
            <div className="text-xs text-neutral-400 uppercase font-semibold">
              ЦЕХ СНАБЖЕНИЯ СТАНЦИИ (ПОПОЛНЕНИЕ СНАРЯЖЕНИЯ):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => onRestockTool('LADDER')}
                className="bg-neutral-950 border border-neutral-800 hover:border-amber-600 p-2.5 rounded-xl flex items-center justify-between text-left active:scale-95"
              >
                <span>🪜 Лестница ПЛ-4</span>
                <span className="text-emerald-400 font-bold">+1</span>
              </button>

              <button
                type="button"
                onClick={() => onRestockTool('CLIMBING_ROPE')}
                className="bg-neutral-950 border border-neutral-800 hover:border-amber-600 p-2.5 rounded-xl flex items-center justify-between text-left active:scale-95"
              >
                <span>🪢 Страховочный трос</span>
                <span className="text-emerald-400 font-bold">+1</span>
              </button>

              <button
                type="button"
                onClick={() => onRestockTool('CAMPFIRE')}
                className="bg-neutral-950 border border-neutral-800 hover:border-amber-600 p-2.5 rounded-xl flex items-center justify-between text-left active:scale-95"
              >
                <span>🪵 Костровой набор</span>
                <span className="text-emerald-400 font-bold">+1</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
