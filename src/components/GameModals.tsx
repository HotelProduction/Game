import React, { useEffect, useRef, useState } from 'react';
import type { EndingPayload, GameSettings } from '../shared/types';

export type ActiveModalType =
  | null
  | 'play'
  | 'join'
  | 'settings'
  | 'credits'
  | 'keypad'
  | 'doc'
  | 'map'
  | 'pause';

interface GameModalsProps {
  activeModal: ActiveModalType;
  settings: GameSettings;
  joinError: string;
  docTitle: string;
  docContent: string;
  mapZone: string;
  ending: EndingPayload | null;
  onClose: () => void;
  onCreatePrivateRoom: () => void;
  onCreateSoloRoom: () => void;
  onOpenJoinModal: () => void;
  onSubmitJoin: (code: string) => void;
  onUpdateSettings: (next: GameSettings) => void;
  onSubmitKeypad: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onResumeGame: () => void;
  onOpenSettingsFromPause: () => void;
  onLeaveHotel: () => void;
}

export const GameModals: React.FC<GameModalsProps> = ({
  activeModal,
  settings,
  joinError,
  docTitle,
  docContent,
  mapZone,
  ending,
  onClose,
  onCreatePrivateRoom,
  onCreateSoloRoom,
  onOpenJoinModal,
  onSubmitJoin,
  onUpdateSettings,
  onSubmitKeypad,
  onResumeGame,
  onOpenSettingsFromPause,
  onLeaveHotel,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [keypadInput, setKeypadInput] = useState('');
  const [keypadError, setKeypadError] = useState('');
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (activeModal === 'keypad') {
      setKeypadInput('');
      setKeypadError('');
    }
  }, [activeModal]);

  useEffect(() => {
    if (activeModal !== 'map' || !mapCanvasRef.current) return;
    const c = mapCanvasRef.current;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0e0d12';
    ctx.fillRect(0, 0, c.width, c.height);

    const drawRoom = (x: number, y: number, w: number, h: number, label: string) => {
      const active = mapZone.includes(label.split(' ')[0]);
      ctx.fillStyle = active ? '#4a1b1b' : '#1b1a22';
      ctx.strokeStyle = active ? '#e04848' : '#635c55';
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#e8e2d5';
      ctx.font = '11px Courier New, monospace';
      ctx.fillText(label, x + 6, y + h / 2 + 4);
    };

    drawRoom(190, 340, 140, 60, 'RECEPTION');
    drawRoom(225, 160, 70, 180, 'HALLWAY');
    drawRoom(110, 270, 115, 50, 'ROOM 101');
    drawRoom(295, 225, 115, 50, 'ROOM 102');
    drawRoom(110, 175, 115, 50, 'ROOM 103');
    drawRoom(295, 295, 140, 60, 'BASEMENT (-1)');
    drawRoom(220, 105, 80, 55, 'ELEVATOR');
    drawRoom(155, 45, 210, 58, 'FLOOR 0 / VAULT');
    drawRoom(185, 5, 150, 38, 'ROOM 0');
  }, [activeModal, mapZone]);

  if (ending) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#030305]/95 p-4">
        <div className="w-full max-w-[600px] border border-[#592020] bg-[#0b0a0e] p-9 text-center shadow-2xl">
          <div className="mb-2 text-xs tracking-[0.3em] text-[#c74242]">
            {ending.subtitle}
          </div>
          <h1 className="mb-4 text-3xl font-bold tracking-[0.18em] text-[#f2ede3]">
            {ending.title}
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-[#cfc9bc]">{ending.text}</p>
          <div className="mb-6 grid grid-cols-2 gap-2 border-t border-b border-[#292428] py-3 text-left text-xs">
            {ending.progression.map((step) => (
              <div
                key={step.id}
                className={step.done ? 'text-[#7ab384]' : 'text-[#736d65]'}
              >
                {step.done ? '✓' : '○'} {step.text}
              </div>
            ))}
          </div>
          <button
            type="button"
            data-start="true"
            onClick={onLeaveHotel}
            className="cursor-pointer border border-[#9c2626] bg-[#6e161a] px-6 py-3 text-xs font-semibold tracking-[0.22em] text-white uppercase hover:bg-[#911d22]"
          >
            RETURN TO MAIN MENU
          </button>
        </div>
      </div>
    );
  }

  if (!activeModal) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#020204]/85 p-4"
      role="dialog"
      aria-modal="true"
    >
      {activeModal === 'play' && (
        <div className="w-full max-w-[430px] border border-[#3d2326] bg-[#0d0d12] p-7 shadow-2xl">
          <h2 className="mb-2 text-xl tracking-[0.22em] text-[#f0ece1]">
            ENTER THE HOTEL
          </h2>
          <p className="mb-5 text-xs leading-relaxed text-[#9e998e]">
            Play co-op with 2–3 friends online (each survivor perceives a fractured reality), or explore solo using the Reality Lens [R].
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onCreatePrivateRoom}
              className="cursor-pointer border border-[#9c2626] bg-[#691418]/85 px-4 py-3 text-xs font-semibold tracking-[0.2em] text-white uppercase hover:bg-[#8c1b20]"
            >
              CREATE PRIVATE ROOM (2–3 PLAYERS)
            </button>
            <button
              type="button"
              onClick={onOpenJoinModal}
              className="cursor-pointer border border-[#423d42] bg-[#16161d] px-4 py-3 text-xs tracking-[0.2em] text-[#dcd7cc] uppercase hover:border-[#b83232]"
            >
              JOIN WITH 6-CHAR CODE
            </button>
            <button
              type="button"
              data-start="true"
              onClick={onCreateSoloRoom}
              className="cursor-pointer border border-[#52432c] bg-[#1a1612] px-4 py-2.5 text-xs tracking-[0.2em] text-[#e3cb98] uppercase hover:border-[#b58738]"
            >
              SOLO EXPLORATION (1P)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-1 cursor-pointer border border-[#2d2b30] px-4 py-2 text-xs tracking-[0.2em] text-[#8e8a82] uppercase hover:text-white"
            >
              BACK
            </button>
          </div>
        </div>
      )}

      {activeModal === 'join' && (
        <div className="w-full max-w-[420px] border border-[#3d2326] bg-[#0d0d12] p-7 shadow-2xl">
          <h2 className="mb-2 text-xl tracking-[0.22em] text-[#f0ece1]">
            JOIN ROOM
          </h2>
          <p className="mb-4 text-xs text-[#9e998e]">
            Enter the 6-character room code shared by the host.
          </p>
          <label htmlFor="room-code-input" className="sr-only">
            Room Code
          </label>
          <input
            id="room-code-input"
            type="text"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="XXXXXX"
            className="tabular-nums w-full border border-[#4d2929] bg-[#14141a] p-3.5 text-center text-2xl tracking-[0.45em] text-[#f3efe6] uppercase outline-none focus:border-[#b83232]"
          />
          <div className="mt-2 min-h-[18px] text-xs text-[#e04848]" role="alert">
            {joinError}
          </div>
          <div className="mt-4 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border border-[#2d2b30] px-4 py-2 text-xs tracking-[0.2em] text-[#8e8a82] uppercase"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={() => onSubmitJoin(joinCode)}
              className="cursor-pointer border border-[#9c2626] bg-[#691418] px-5 py-2 text-xs font-semibold tracking-[0.2em] text-white uppercase hover:bg-[#8c1b20]"
            >
              CONNECT
            </button>
          </div>
        </div>
      )}

      {activeModal === 'settings' && (
        <div className="w-full max-w-[520px] border border-[#3d2326] bg-[#0d0d12] p-7 shadow-2xl">
          <h2 className="mb-4 text-xl tracking-[0.22em] text-[#f0ece1]">
            SETTINGS
          </h2>
          <div className="grid gap-3.5 text-xs text-[#bfb9ad]">
            <label className="flex flex-col gap-1">
              <span className="flex justify-between">
                <span>Mouse Sensitivity</span>
                <span className="tabular-nums">{settings.sensitivity.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.1"
                value={settings.sensitivity}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, sensitivity: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex justify-between">
                <span>Master Volume</span>
                <span className="tabular-nums">{Math.round(settings.masterVol * 100)}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.masterVol}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, masterVol: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex justify-between">
                <span>Ambience Volume</span>
                <span className="tabular-nums">{Math.round(settings.musicVol * 100)}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.musicVol}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, musicVol: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex justify-between">
                <span>SFX Volume</span>
                <span className="tabular-nums">{Math.round(settings.sfxVol * 100)}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.sfxVol}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, sfxVol: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Graphics Quality</span>
              <select
                value={settings.quality}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    quality: e.target.value as GameSettings['quality'],
                  })
                }
                className="border border-[#35333a] bg-[#17171f] p-2 text-[#ece8df]"
              >
                <option value="low">Low (Performance)</option>
                <option value="medium">Medium (Balanced)</option>
                <option value="high">High (Real Shadows)</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen?.().catch(() => {});
                } else {
                  document.exitFullscreen?.().catch(() => {});
                }
              }}
              className="cursor-pointer border border-[#3a363c] bg-[#16161d] px-3 py-2 text-xs tracking-[0.18em] text-[#dcd7cc] uppercase"
            >
              TOGGLE FULLSCREEN
            </button>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border border-[#9c2626] bg-[#691418] px-5 py-2 text-xs font-semibold tracking-[0.2em] text-white uppercase"
            >
              SAVE & CLOSE
            </button>
          </div>
        </div>
      )}

      {activeModal === 'credits' && (
        <div className="w-full max-w-[440px] border border-[#3d2326] bg-[#0d0d12] p-7 shadow-2xl">
          <h2 className="mb-3 text-xl tracking-[0.22em] text-[#f0ece1]">
            CREDITS
          </h2>
          <div className="flex flex-col gap-2 text-xs leading-relaxed text-[#c2bdb2]">
            <p>
              <strong>ROOM 0</strong> — Cooperative 3D Psychological Horror
            </p>
            <p>Engine: Three.js WebGL + Procedural Web Audio API</p>
            <p>Multiplayer: Node.js + Socket.IO Authoritative Sync</p>
            <p className="italic text-[#7a756c]">
              "Check the time. It is always 03:33."
            </p>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border border-[#9c2626] bg-[#691418] px-5 py-2 text-xs font-semibold tracking-[0.2em] text-white uppercase"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {activeModal === 'keypad' && (
        <div className="w-full max-w-[380px] border border-[#3d2326] bg-[#0d0d12] p-7 shadow-2xl">
          <h2 className="mb-1 text-xl tracking-[0.22em] text-[#f0ece1]">
            SECURITY KEYPAD
          </h2>
          <p className="mb-3 text-xs text-[#9e998e]">
            Combine the digits seen across your team's realities.
          </p>
          <div className="tabular-nums mb-3 border border-[#264d2e] bg-[#07120a] py-3 text-center font-mono text-2xl tracking-[0.45em] text-[#6bff8b]">
            {keypadInput.padEnd(4, '_').split('').join(' ')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  if (keypadInput.length < 4) setKeypadInput((p) => p + d);
                }}
                className="cursor-pointer border border-[#3d3a42] bg-[#1a1a22] py-3 text-base text-[#ebe6dc] hover:border-[#a63232]"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setKeypadInput('');
                setKeypadError('');
              }}
              className="cursor-pointer border border-[#3d3a42] bg-[#1a1a22] py-3 text-xs text-[#ebe6dc]"
            >
              CLR
            </button>
            <button
              type="button"
              onClick={() => {
                if (keypadInput.length < 4) setKeypadInput((p) => p + '0');
              }}
              className="cursor-pointer border border-[#3d3a42] bg-[#1a1a22] py-3 text-base text-[#ebe6dc]"
            >
              0
            </button>
            <button
              type="button"
              onClick={async () => {
                if (keypadInput.length < 4) {
                  setKeypadError('Enter 4 digits.');
                  return;
                }
                const res = await onSubmitKeypad(keypadInput);
                if (res.ok) {
                  onClose();
                } else {
                  setKeypadError(res.error || 'Incorrect code');
                  setKeypadInput('');
                }
              }}
              className="cursor-pointer border border-[#8c2a2a] bg-[#591c1e] py-3 text-xs font-semibold text-white"
            >
              ENT
            </button>
          </div>
          <div className="mt-2 min-h-[18px] text-xs text-[#e04848]" role="alert">
            {keypadError}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full cursor-pointer border border-[#2d2b30] py-2 text-xs tracking-[0.2em] text-[#8e8a82] uppercase"
          >
            CLOSE
          </button>
        </div>
      )}

      {(activeModal === 'doc' || activeModal === 'map') && (
        <div className="w-full max-w-[580px] border border-[#3d2326] bg-[#0d0d12] p-7 shadow-2xl">
          <h2 className="mb-3 text-lg tracking-[0.2em] text-[#f0ece1]">
            {activeModal === 'map'
              ? `HOTEL ARCHITECTURAL MAP (YOU: ${mapZone})`
              : docTitle}
          </h2>
          {activeModal === 'doc' ? (
            <div className="max-h-[340px] overflow-y-auto whitespace-pre-wrap border border-[#2e2a30] bg-[#121116] p-4 text-xs leading-relaxed text-[#ddd6c7]">
              {docContent}
            </div>
          ) : (
            <canvas
              ref={mapCanvasRef}
              width={520}
              height={420}
              className="mx-auto block w-full max-w-[520px] border border-[#2e2a30]"
            />
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border border-[#9c2626] bg-[#691418] px-5 py-2 text-xs font-semibold tracking-[0.2em] text-white uppercase"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {activeModal === 'pause' && (
        <div className="w-full max-w-[380px] border border-[#3d2326] bg-[#0d0d12] p-7 shadow-2xl">
          <h2 className="mb-4 text-xl tracking-[0.22em] text-[#f0ece1]">
            PAUSED
          </h2>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResumeGame}
              className="cursor-pointer border border-[#9c2626] bg-[#691418] px-4 py-2.5 text-xs font-semibold tracking-[0.22em] text-white uppercase hover:bg-[#8c1b20]"
            >
              RESUME
            </button>
            <button
              type="button"
              onClick={onOpenSettingsFromPause}
              className="cursor-pointer border border-[#423d42] bg-[#16161d] px-4 py-2.5 text-xs tracking-[0.2em] text-[#dcd7cc] uppercase"
            >
              SETTINGS
            </button>
            <button
              type="button"
              onClick={onLeaveHotel}
              className="cursor-pointer border border-[#2d2b30] px-4 py-2.5 text-xs tracking-[0.2em] text-[#8e8a82] uppercase hover:text-white"
            >
              LEAVE HOTEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
