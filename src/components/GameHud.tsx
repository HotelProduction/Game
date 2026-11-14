import React from 'react';
import type { HudSnapshot } from '../game/engine';
import type { ProgressionStep, PublicPlayer } from '../shared/types';

interface GameHudProps {
  hud: HudSnapshot;
  tasks: ProgressionStep[];
  players: PublicPlayer[];
  toasts: Array<{ id: number; text: string }>;
  muted: boolean;
  cameraFlash: boolean;
  chatOpen: boolean;
  chatValue: string;
  onChatChange: (v: string) => void;
  onChatSubmit: (e: React.FormEvent) => void;
  onChatClose: () => void;
  onToggleMute: () => void;
  onOpenPause: () => void;
  onSelectSlot: (idx: number) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  tasks,
  players,
  toasts,
  muted,
  cameraFlash,
  chatOpen,
  chatValue,
  onChatChange,
  onChatSubmit,
  onChatClose,
  onToggleMute,
  onOpenPause,
  onSelectSlot,
}) => {
  const fearAlpha = hud.fear < 30 ? 0 : Math.min(0.82, (hud.fear - 30) / 85);

  return (
    <>
      {/* Fear peripheral vignette */}
      <div
        className="fixed inset-0 z-[5] pointer-events-none transition-opacity duration-300"
        style={{
          opacity: hud.fear >= 30 ? 1 : 0,
          background: `radial-gradient(circle, transparent 40%, rgba(110, 0, 0, ${fearAlpha}) 100%)`,
        }}
      />

      {/* Camera Flash overlay */}
      <div
        className="fixed inset-0 z-[6] pointer-events-none bg-white transition-opacity duration-150"
        style={{ opacity: cameraFlash ? 0.88 : 0 }}
      />

      <div className="fixed inset-0 z-10 pointer-events-none">
        {/* Top-Left Cluster: Objectives & Survivors */}
        <div className="absolute top-4 left-4 flex w-[264px] flex-col gap-2.5">
          <div className="border-l-2 border-[#a82c2c] bg-[#08080c]/75 px-3 py-2.5">
            <div className="mb-1.5 text-[10px] font-semibold tracking-[0.24em] text-[#c74848]">
              OBJECTIVES
            </div>
            <ul className="flex flex-col gap-1 text-[11px] leading-tight">
              {tasks.map((step) => (
                <li
                  key={step.id}
                  className={
                    step.done
                      ? 'text-[#6ea378] line-through'
                      : 'text-[#e0dbd0]'
                  }
                >
                  {step.done ? '✓' : '○'} {step.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-l-2 border-[#6e2426] bg-[#08080c]/75 px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold tracking-[0.24em] text-[#c74848]">
              SURVIVORS
            </div>
            <ul className="flex flex-col gap-1 text-[11px]">
              {players.map((p) => (
                <li key={p.id} className="flex justify-between text-[#d6d1c7]">
                  <span>{p.name}</span>
                  <span className="text-[10px] tracking-[0.12em] text-[#9e988d]">
                    {p.connected ? 'ALIVE' : 'RECONNECTING'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Top-Right Cluster: Zone, Reality, Battery, Fear, Utility Controls */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div
              data-testid="hud-zone"
              className="border border-[#4f2628] bg-[#09090d]/80 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-[#efe9dd]"
            >
              {hud.zone}
            </div>
            <div className="border border-[#3b3428] bg-[#09090d]/80 px-2.5 py-1.5 text-[11px] tracking-[0.18em] text-[#d4b068]">
              REALITY #{hud.realityIndex}
              {hud.soloMode ? ' [R]' : ''}
            </div>

            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="pointer-events-auto flex h-8 w-8 cursor-pointer items-center justify-center border border-[#3a363c] bg-[#0c0c11]/85 text-[#dcd7cc] hover:border-[#b83232]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                {muted ? (
                  <line x1="22" y1="9" x2="16" y2="15" />
                ) : (
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                )}
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause Game"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenPause();
              }}
              className="pointer-events-auto flex h-8 w-8 cursor-pointer items-center justify-center border border-[#3a363c] bg-[#0c0c11]/85 text-[#dcd7cc] hover:border-[#b83232]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-3 border border-[#2d2b30] bg-[#08080c]/75 px-3 py-1.5 text-[11px]">
            <span className="flex items-center gap-1.5 text-[#dcd7cc]">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#e6c875]" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="17" height="10" rx="1" />
                <line x1="21" y1="10" x2="21" y2="14" />
              </svg>
              LIGHT [F]
            </span>
            <div className="h-1.5 w-20 bg-[#232227]">
              <div
                className="h-full bg-[#e6c875] transition-all duration-150"
                style={{ width: `${hud.battery}%` }}
              />
            </div>
            <span className="tabular-nums w-9 text-right text-[#efe9dd]">
              {hud.battery}%
            </span>
          </div>

          <div className="flex items-center gap-3 border border-[#2d2b30] bg-[#08080c]/75 px-3 py-1 text-[10px]">
            <span className="tracking-[0.16em] text-[#c76363]">FEAR</span>
            <div className="h-1.5 w-20 bg-[#232227]">
              <div
                className="h-full bg-[#b82828] transition-all duration-150"
                style={{ width: `${hud.fear}%` }}
              />
            </div>
            <span className="tabular-nums w-9 text-right text-[#e09494]">
              {hud.fear}%
            </span>
          </div>
        </div>

        {/* Center Crosshair */}
        <div
          className="fixed top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/75"
          aria-hidden="true"
        />

        {/* Interaction Prompt */}
        {hud.interactLabel && (
          <div
            data-testid="interact-prompt"
            className="fixed top-[56%] left-1/2 -translate-x-1/2 border border-[#732a2a] bg-[#0a0a0e]/85 px-3.5 py-1.5 text-xs tracking-[0.12em] text-[#f5efe6]"
          >
            [E] {hud.interactLabel}
          </div>
        )}

        {/* Toast Feed */}
        <div className="fixed top-[18%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="border border-[#592626] bg-[#0c0a0e]/90 px-3.5 py-1.5 text-xs text-[#f0e8da]"
            >
              {t.text}
            </div>
          ))}
        </div>

        {/* Quick Chat Input */}
        {chatOpen && (
          <form
            onSubmit={onChatSubmit}
            className="pointer-events-auto fixed bottom-24 left-1/2 w-[min(420px,88vw)] -translate-x-1/2"
          >
            <input
              autoFocus
              type="text"
              maxLength={120}
              value={chatValue}
              onChange={(e) => onChatChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onChatClose();
                }
              }}
              placeholder="Describe what you see to teammates... (Enter)"
              className="w-full border border-[#8c2a2a] bg-[#0a0a0e]/95 px-3.5 py-2.5 text-sm text-[#f2ede3] outline-none"
            />
          </form>
        )}

        {/* Bottom Minimalist Inventory Dock */}
        <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
          {hud.slots.map((slot, idx) => (
            <button
              key={slot.id}
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onSelectSlot(idx);
              }}
              className={`pointer-events-auto min-w-[82px] cursor-pointer border px-2.5 py-2 text-center text-[11px] transition-colors ${
                idx === hud.selectedSlot
                  ? 'border-[#c94646] bg-[#371012]/90 text-white'
                  : 'border-[#353339] bg-[#0a0a0e]/85 text-[#d6d1c7] hover:border-[#8c3232]'
              }`}
            >
              <span className="block text-[9px] tracking-[0.15em] text-[#9e988d]">
                [{slot.key}]
              </span>
              {slot.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
