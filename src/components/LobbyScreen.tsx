import React from 'react';
import type { RoomLobbySnapshot } from '../shared/types';

interface LobbyScreenProps {
  lobby: RoomLobbySnapshot;
  selfId: string | null;
  error: string;
  onCopyCode: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeave: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  lobby,
  selfId,
  error,
  onCopyCode,
  onToggleReady,
  onStartGame,
  onLeave,
}) => {
  const isHost = lobby.hostId === selfId;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#040407]/80 p-4">
      <div className="w-full max-w-[520px] border border-[#5c2628] bg-[#0c0c11] p-7 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-[#28252c] pb-4">
          <div>
            <span className="block text-[11px] tracking-[0.22em] text-[#8f8980]">
              PRIVATE ROOM CODE
            </span>
            <div
              data-testid="lobby-code"
              className="tabular-nums text-3xl font-bold tracking-[0.3em] text-[#d94a4a]"
            >
              {lobby.code}
            </div>
          </div>
          <button
            type="button"
            onClick={onCopyCode}
            className="cursor-pointer border border-[#4a4448] bg-[#17171f] px-3 py-2 text-xs tracking-[0.18em] text-[#e0dbd0] uppercase hover:border-[#b83232]"
          >
            COPY CODE
          </button>
        </div>

        <div className="mb-2.5 flex items-center justify-between text-xs tracking-[0.15em] text-[#a6a095]">
          <span>
            {lobby.soloAllowed ? 'SOLO EXPLORATION' : 'SURVIVORS (2–3 REQUIRED)'}
          </span>
          <span className="tabular-nums">{lobby.players.length} / 3</span>
        </div>

        <ul className="mb-4 flex flex-col gap-2">
          {lobby.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between border border-[#2a2830] bg-[#14141b] px-3.5 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2 text-[#e6e1d8]">
                {p.name}
                {p.id === selfId && (
                  <span className="text-xs text-[#9c968b]">(You)</span>
                )}
                {p.isHost && (
                  <span className="bg-[#4a1c1c] px-2 py-0.5 text-[10px] tracking-[0.15em] text-[#f29494]">
                    HOST
                  </span>
                )}
              </span>
              <span
                className={`px-2 py-0.5 text-[11px] tracking-[0.12em] ${
                  p.ready
                    ? 'bg-[#1c4728] text-[#8ff0a4]'
                    : 'bg-[#3b2a1c] text-[#e8b36b]'
                }`}
              >
                {p.ready ? 'READY' : 'NOT READY'}
              </span>
            </li>
          ))}
        </ul>

        {!lobby.soloAllowed && lobby.players.length < 2 && (
          <p className="mb-2 text-xs text-[#9c968b]">
            Share the 6-character code with 1–2 friends to start cooperative play.
          </p>
        )}

        <div className="mb-3 min-h-[18px] text-xs text-[#e05252]" role="alert">
          {error}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onLeave}
            className="cursor-pointer border border-[#302d34] bg-transparent px-4 py-2.5 text-xs tracking-[0.2em] text-[#969086] uppercase hover:border-[#6e2a2a] hover:text-white"
          >
            LEAVE
          </button>

          {!isHost ? (
            <button
              type="button"
              onClick={onToggleReady}
              className="cursor-pointer border border-[#4a454a] bg-[#1a1a22] px-5 py-2.5 text-xs font-semibold tracking-[0.2em] text-[#f0ece1] uppercase hover:border-[#b83232]"
            >
              TOGGLE READY
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onStartGame}
              className="cursor-pointer border border-[#9c2626] bg-[#6e161a] px-6 py-2.5 text-xs font-semibold tracking-[0.22em] text-white uppercase hover:bg-[#911d22]"
            >
              START GAME
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
