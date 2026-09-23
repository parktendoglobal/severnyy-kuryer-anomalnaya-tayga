import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Radio, Wind, Sparkles, Footprints, ShieldAlert } from 'lucide-react';

interface VirtualControlsProps {
  onMove: (dx: number, dy: number) => void;
  onBraceLeft: (active: boolean) => void;
  onBraceRight: (active: boolean) => void;
  onScan: () => void;
  onHoldBreath: (active: boolean) => void;
  onSprint: (active: boolean) => void;
  isHoldingBreath: boolean;
  isBracingLeft: boolean;
  isBracingRight: boolean;
  isSprinting: boolean;
  scannerCooldown: number;
  stumbleAlert: 'NONE' | 'LEFT' | 'RIGHT' | 'CRITICAL';
}

export const VirtualControls: React.FC<VirtualControlsProps> = ({
  onMove,
  onBraceLeft,
  onBraceRight,
  onScan,
  onHoldBreath,
  onSprint,
  isHoldingBreath,
  isBracingLeft,
  isBracingRight,
  isSprinting,
  scannerCooldown,
  stumbleAlert
}) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const activePointerIdRef = useRef<number | null>(null);

  const updateJoystick = useCallback((clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const maxRadius = rect.width / 2 - 14;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance > maxRadius && distance > 0) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }

    setKnobPos({ x: dx, y: dy });
    onMove(dx / maxRadius, dy / maxRadius);
  }, [onMove]);

  const resetJoystick = useCallback(() => {
    activePointerIdRef.current = null;
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);

  // Pointer Event handlers (supports Touch, Mouse, Pen with Pointer Capture)
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    activePointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    updateJoystick(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePointerIdRef.current === e.pointerId) {
      e.preventDefault();
      updateJoystick(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activePointerIdRef.current === e.pointerId) {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // Safe fallback if already released
      }
      resetJoystick();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (activePointerIdRef.current === e.pointerId) {
      resetJoystick();
    }
  };

  // Keyboard controls listener (WASD, Arrows, Q/E, F, Space, C, Shift)
  useEffect(() => {
    const keysDown = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid stealing input if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      keysDown.add(e.code);

      if (e.code === 'KeyQ') onBraceLeft(true);
      if (e.code === 'KeyE') onBraceRight(true);
      if (e.code === 'KeyF' || e.code === 'Space') onScan();
      if (e.code === 'KeyC') onHoldBreath(true);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') onSprint(true);

      updateFromKeyboard();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);

      if (e.code === 'KeyQ') onBraceLeft(false);
      if (e.code === 'KeyE') onBraceRight(false);
      if (e.code === 'KeyC') onHoldBreath(false);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') onSprint(false);

      updateFromKeyboard();
    };

    const updateFromKeyboard = () => {
      let dx = 0;
      let dy = 0;
      if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) dy -= 1;
      if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) dy += 1;
      if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) dx -= 1;
      if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) dx += 1;

      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }
      if (!isDragging) {
        onMove(dx, dy);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onMove, onBraceLeft, onBraceRight, onScan, onHoldBreath, onSprint, isDragging]);

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none p-3 pb-6 flex justify-between items-end select-none z-30 touch-none">
      {/* Left side: Virtual Joystick & Left Strap Brace */}
      <div className="flex flex-col items-center gap-3 pointer-events-auto">
        {/* Left Strap Balance Trigger */}
        <button
          id="btn-brace-left"
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onBraceLeft(true);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            onBraceLeft(false);
          }}
          onPointerCancel={() => onBraceLeft(false)}
          onContextMenu={(e) => e.preventDefault()}
          className={`w-20 h-11 rounded-lg border font-mono-tech text-xs tracking-wider font-bold transition-all flex items-center justify-center shadow-lg active:scale-95 touch-none select-none cursor-pointer ${
            isBracingLeft
              ? 'bg-amber-500 border-amber-300 text-neutral-950 ring-2 ring-amber-400'
              : stumbleAlert === 'LEFT' || stumbleAlert === 'CRITICAL'
              ? 'bg-red-900/90 border-red-500 text-red-100 animate-pulse ring-2 ring-red-500'
              : 'bg-neutral-900/80 border-neutral-700 text-neutral-300 hover:bg-neutral-800/90'
          }`}
        >
          <span className="flex items-center gap-1 pointer-events-none">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            СТРОПА [Л]
          </span>
        </button>

        {/* Floating / Touch Thumbstick with Pointer Events */}
        <div
          ref={joystickRef}
          id="virtual-joystick-base"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          className="w-32 h-32 rounded-full border-2 border-neutral-700/80 bg-neutral-950/60 backdrop-blur-sm relative flex items-center justify-center shadow-2xl touch-none cursor-grab active:cursor-grabbing select-none"
        >
          {/* Direction tick marks */}
          <div className="absolute top-1.5 w-1.5 h-1.5 rounded-full bg-neutral-500 pointer-events-none" />
          <div className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-neutral-500 pointer-events-none" />
          <div className="absolute left-1.5 w-1.5 h-1.5 rounded-full bg-neutral-500 pointer-events-none" />
          <div className="absolute right-1.5 w-1.5 h-1.5 rounded-full bg-neutral-500 pointer-events-none" />

          {/* Draggable Knob */}
          <div
            id="virtual-joystick-knob"
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className={`w-14 h-14 rounded-full border flex items-center justify-center shadow-md pointer-events-none ${
              isDragging
                ? 'bg-amber-600/90 border-amber-300 scale-105'
                : 'bg-neutral-800/90 border-neutral-500'
            }`}
          >
            <Footprints className="w-6 h-6 text-neutral-200 opacity-80" />
          </div>
        </div>
      </div>

      {/* Right side: Right Strap Brace & Action Cluster */}
      <div className="flex flex-col items-end gap-3 pointer-events-auto">
        {/* Right Strap Balance Trigger */}
        <button
          id="btn-brace-right"
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onBraceRight(true);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            onBraceRight(false);
          }}
          onPointerCancel={() => onBraceRight(false)}
          onContextMenu={(e) => e.preventDefault()}
          className={`w-20 h-11 rounded-lg border font-mono-tech text-xs tracking-wider font-bold transition-all flex items-center justify-center shadow-lg active:scale-95 touch-none select-none cursor-pointer ${
            isBracingRight
              ? 'bg-amber-500 border-amber-300 text-neutral-950 ring-2 ring-amber-400'
              : stumbleAlert === 'RIGHT' || stumbleAlert === 'CRITICAL'
              ? 'bg-red-900/90 border-red-500 text-red-100 animate-pulse ring-2 ring-red-500'
              : 'bg-neutral-900/80 border-neutral-700 text-neutral-300 hover:bg-neutral-800/90'
          }`}
        >
          <span className="flex items-center gap-1 pointer-events-none">
            СТРОПА [П]
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          </span>
        </button>

        {/* Action buttons circle */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Hold Breath / Sneak Button */}
          <button
            id="btn-hold-breath"
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onHoldBreath(true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              onHoldBreath(false);
            }}
            onPointerCancel={() => onHoldBreath(false)}
            onContextMenu={(e) => e.preventDefault()}
            className={`w-16 h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5 shadow-lg active:scale-90 transition-all touch-none select-none cursor-pointer ${
              isHoldingBreath
                ? 'bg-cyan-600 border-cyan-300 text-cyan-50 shadow-cyan-500/50 ring-2 ring-cyan-400'
                : 'bg-neutral-900/85 border-neutral-700 text-neutral-200 hover:bg-neutral-800/90'
            }`}
          >
            <Wind className="w-5 h-5 text-cyan-400 pointer-events-none" />
            <span className="font-mono-tech text-[10px] leading-none uppercase font-semibold pointer-events-none">
              Дыхание
            </span>
          </button>

          {/* Odradek "Эхо-4" Scanner Button */}
          <button
            id="btn-scanner-pulse"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onScan();
            }}
            disabled={scannerCooldown > 0}
            className={`w-16 h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5 shadow-lg active:scale-90 transition-all touch-none select-none cursor-pointer ${
              scannerCooldown > 0
                ? 'bg-neutral-950/70 border-neutral-800 text-neutral-600 opacity-60 cursor-not-allowed'
                : 'bg-sky-600/90 border-sky-400 text-sky-100 hover:bg-sky-500 shadow-sky-500/30 ring-1 ring-sky-300'
            }`}
          >
            <Radio className={`w-5 h-5 pointer-events-none ${scannerCooldown > 0 ? 'text-neutral-500' : 'text-sky-200'}`} />
            <span className="font-mono-tech text-[10px] leading-none uppercase font-semibold pointer-events-none">
              {scannerCooldown > 0 ? `${(scannerCooldown / 1000).toFixed(1)}c` : 'Эхо-4'}
            </span>
          </button>

          {/* Sprint / Deep Snow Push Button */}
          <button
            id="btn-sprint"
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onSprint(true);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              onSprint(false);
            }}
            onPointerCancel={() => onSprint(false)}
            onContextMenu={(e) => e.preventDefault()}
            className={`w-16 h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5 shadow-lg active:scale-90 transition-all col-span-2 touch-none select-none cursor-pointer ${
              isSprinting
                ? 'bg-orange-600 border-orange-300 text-orange-50 ring-2 ring-orange-400'
                : 'bg-neutral-900/85 border-neutral-700 text-neutral-200 hover:bg-neutral-800/90'
            }`}
          >
            <Sparkles className="w-5 h-5 text-orange-400 pointer-events-none" />
            <span className="font-mono-tech text-[10px] leading-none uppercase font-semibold pointer-events-none">
              Рывок / Усилие
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
