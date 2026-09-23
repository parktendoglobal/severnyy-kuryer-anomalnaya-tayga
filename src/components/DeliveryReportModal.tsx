import React from 'react';
import { DeliveryMission, CargoItem } from '../types/game';
import { CheckCircle2, Award, Heart, ThumbsUp, Sparkles, ArrowRight } from 'lucide-react';

interface DeliveryReportModalProps {
  mission: DeliveryMission;
  cargo: CargoItem[];
  timeTakenSec: number;
  grade: 'S' | 'A' | 'B' | 'C';
  totalLikesEarned: number;
  onContinue: () => void;
}

export const DeliveryReportModal: React.FC<DeliveryReportModalProps> = ({
  mission,
  cargo,
  timeTakenSec,
  grade,
  totalLikesEarned,
  onContinue
}) => {
  const avgIntegrity = cargo.length > 0
    ? Math.round(cargo.reduce((a, b) => a + b.currentIntegrity, 0) / cargo.length)
    : 100;

  return (
    <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-lg z-50 flex items-center justify-center p-4 select-none animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-lg bg-neutral-900 border-2 border-emerald-500 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-5 text-neutral-100 font-mono-tech crt-overlay relative overflow-hidden">
        {/* Holographic header glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-emerald-400" />

        {/* Big Rank Badge (S / A / B / C) */}
        <div className="flex flex-col items-center gap-1 mt-2">
          <div
            className={`w-24 h-24 rounded-2xl border-4 flex items-center justify-center text-5xl font-pixel shadow-2xl ${
              grade === 'S'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-4 ring-amber-400/40 shadow-amber-500/50 animate-pulse'
                : grade === 'A'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400/40'
                : 'bg-sky-500/20 border-sky-400 text-sky-300'
            }`}
          >
            {grade}
          </div>
          <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mt-1">
            {grade === 'S' ? '★ ЛЕГЕНДА СЕВЕРНОЙ ТАЙГИ ★' : grade === 'A' ? 'МАСТЕР ДОСТАВКИ' : 'ЗАКАЗ ВЫПОЛНЕН'}
          </div>
        </div>

        {/* Mission Title */}
        <div className="text-center">
          <div className="text-sm font-bold text-neutral-100">{mission.title}</div>
          <div className="text-xs text-neutral-400 mt-0.5">
            Заказчик: {mission.senderName} // Сеть «Север-Связь»
          </div>
        </div>

        {/* Evaluation Metrics Breakdown */}
        <div className="w-full bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-2.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Сохранность контейнеров:</span>
            <span className="font-bold text-emerald-400">{avgIntegrity}% (Без критических трещин)</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Время в переходе:</span>
            <span className="font-bold text-neutral-200">{Math.round(timeTakenSec)} сек</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Преодоление аномалий:</span>
            <span className="font-bold text-sky-400">Успешно обойдены</span>
          </div>

          <div className="pt-2 border-t border-neutral-800 flex justify-between items-center text-sm">
            <span className="flex items-center gap-1.5 text-amber-300 font-bold">
              <ThumbsUp className="w-4 h-4 text-amber-400" />
              ПОЛУЧЕНО БЛАГОДАРНОСТЕЙ:
            </span>
            <span className="font-bold text-amber-400 text-lg">+{totalLikesEarned}</span>
          </div>
        </div>

        {/* Connection announcement */}
        <div className="w-full bg-sky-950/30 border border-sky-700/60 rounded-xl p-3 text-center text-xs text-sky-300">
          📡 Станция успешно подключена к Евразийской радиосети! Чертежи переданы в цех.
        </div>

        {/* Continue Button */}
        <button
          id="btn-continue-after-delivery"
          type="button"
          onClick={onContinue}
          className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95"
        >
          <span>ПРОДОЛЖИТЬ ЭКСПЕДИЦИЮ</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
