/**
 * МЕНЮ ИГРЫ
 *
 * Окно, которое открывается кнопкой с шестерёнкой в правом верхнем углу. Здесь можно
 * сохранить игру вручную (она и так сохраняется сама каждые 30 секунд и при закрытии
 * вкладки) и начать игру заново. «Начать заново» стирает сохранение, поэтому сначала
 * игрок должен явно подтвердить это вторым нажатием.
 */
import React, { useState } from 'react';
import { Save, RotateCcw, X, AlertTriangle } from 'lucide-react';

interface GameMenuModalProps {
  lastSavedAt: Date | null;
  savingDisabledReason: string | null; // если не null — автосохранение выключено, и почему
  onSaveNow: () => void;
  onRestart: () => void;
  onClose: () => void;
}

export const GameMenuModal: React.FC<GameMenuModalProps> = ({
  lastSavedAt,
  savingDisabledReason,
  onSaveNow,
  onRestart,
  onClose
}) => {
  // Второй шаг «Начать заново»: показываем предупреждение и просим подтвердить.
  const [confirmingRestart, setConfirmingRestart] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Меню игры"
      className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none font-mono-tech"
    >
      <div className="modal-content w-full max-w-sm bg-neutral-900 border-2 border-emerald-600/80 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-neutral-100">
        <div className="flex justify-between items-center">
          <div className="text-sm font-bold tracking-widest text-emerald-300">МЕНЮ ИГРЫ</div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors"
            aria-label="Закрыть меню"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!confirmingRestart ? (
          <>
            <div className="text-xs text-neutral-400 leading-relaxed">
              {savingDisabledReason ? (
                <span className="text-amber-300">{savingDisabledReason}</span>
              ) : lastSavedAt ? (
                <>Последнее сохранение: {lastSavedAt.toLocaleTimeString('ru-RU')}. Игра сохраняется сама каждые 30 секунд и при выходе.</>
              ) : (
                <>Игра сохраняется сама каждые 30 секунд и при выходе.</>
              )}
            </div>

            <button
              id="btn-save-now"
              type="button"
              onClick={onSaveNow}
              className="w-full px-3 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/60 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              СОХРАНИТЬ СЕЙЧАС
            </button>

            <button
              id="btn-restart-game"
              type="button"
              onClick={() => setConfirmingRestart(true)}
              className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 hover:bg-red-950/60 border border-red-700/70 text-red-300 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              НАЧАТЬ ЗАНОВО
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-3 items-start bg-red-950/50 border border-red-700/70 rounded-xl p-3 text-xs text-red-100 leading-relaxed">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span>
                Весь прогресс будет стёрт без возможности восстановления: заказы, задания, открытые регионы,
                инвентарь и снаряжение. Точно начать заново?
              </span>
            </div>

            <button
              id="btn-confirm-restart"
              type="button"
              onClick={onRestart}
              className="w-full px-3 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 border border-red-400/60 text-white font-bold text-sm active:scale-95 transition-all"
            >
              ДА, СТЕРЕТЬ И НАЧАТЬ ЗАНОВО
            </button>
            <button
              id="btn-cancel-restart"
              type="button"
              onClick={() => setConfirmingRestart(false)}
              className="w-full px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-200 font-bold text-sm active:scale-95 transition-all"
            >
              ОТМЕНА
            </button>
          </>
        )}
      </div>
    </div>
  );
};
