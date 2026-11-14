import React from 'react';

interface TitleScreenProps {
  playerName: string;
  onNameChange: (name: string) => void;
  onPlayClick: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onOpenSettings: () => void;
  onOpenCredits: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  playerName,
  onNameChange,
  onPlayClick,
  onCreateRoom,
  onJoinRoom,
  onOpenSettings,
  onOpenCredits,
}) => {
  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between p-6 md:p-10 pointer-events-none">
      {/* Subtle atmospheric dark vignette over live 3D hotel corridor */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 65% 45%, rgba(6,6,10,0.18) 0%, rgba(4,4,7,0.88) 100%)',
        }}
      />

      {/* Left-third negative space composition leaving center-right corridor visible */}
      <div className="relative z-10 my-auto w-full max-w-[430px] border border-[#6e2426]/60 bg-[#09090d]/90 p-7 shadow-2xl pointer-events-auto">
        <div className="mb-1 flex items-center justify-between text-[11px] tracking-[0.35em] text-[#c73c3c]">
          <span className="tabular-nums">03:33</span>
          <span>FLOOR 0 ARCHIVE</span>
        </div>

        {/* Bespoke inline SVG architectural title lockup */}
        <div className="mb-2 title-flicker">
          <svg
            viewBox="0 0 360 68"
            className="w-full h-auto"
            role="img"
            aria-label="ROOM 0"
          >
            <rect
              x="2"
              y="6"
              width="356"
              height="56"
              fill="none"
              stroke="#5c1f21"
              strokeWidth="1.5"
            />
            <line x1="12" y1="6" x2="12" y2="62" stroke="#8f292b" strokeWidth="2" />
            <text
              x="30"
              y="47"
              fill="#f2ede3"
              fontFamily="'Courier New', monospace"
              fontWeight="800"
              fontSize="42"
              letterSpacing="10"
            >
              ROOM 0
            </text>
            <circle cx="332" cy="34" r="10" fill="none" stroke="#c73c3c" strokeWidth="2" />
            <line x1="332" y1="34" x2="332" y2="27" stroke="#c73c3c" strokeWidth="1.8" />
            <line x1="332" y1="34" x2="337" y2="37" stroke="#c73c3c" strokeWidth="1.8" />
          </svg>
        </div>

        <p className="mb-5 text-xs italic tracking-[0.14em] text-[#a39d92]">
          "YOU WERE NEVER SUPPOSED TO RETURN."
        </p>

        <div className="mb-5">
          <label
            htmlFor="player-name-input"
            className="mb-1.5 block text-[11px] tracking-[0.22em] text-[#969086]"
          >
            SURVIVOR NAME
          </label>
          <input
            id="player-name-input"
            type="text"
            maxLength={16}
            value={playerName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Enter survivor name..."
            className="w-full border border-[#3a363c] bg-[#131319] px-3 py-2.5 text-sm text-[#f0ece1] outline-none focus:border-[#b33232]"
          />
        </div>

        <nav className="flex flex-col gap-2.5" aria-label="Main Menu">
          <button
            type="button"
            data-start="true"
            onClick={onPlayClick}
            className="cursor-pointer border border-[#a82c2c] bg-[#691418]/85 px-4 py-3 text-sm font-semibold tracking-[0.25em] text-[#f5efe6] uppercase transition-colors hover:bg-[#8c1b20]"
          >
            PLAY
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onCreateRoom}
              className="cursor-pointer border border-[#423d42] bg-[#16161d] px-3 py-2.5 text-xs tracking-[0.2em] text-[#dcd7cc] uppercase transition-colors hover:border-[#b83232] hover:text-white"
            >
              CREATE ROOM
            </button>
            <button
              type="button"
              onClick={onJoinRoom}
              className="cursor-pointer border border-[#423d42] bg-[#16161d] px-3 py-2.5 text-xs tracking-[0.2em] text-[#dcd7cc] uppercase transition-colors hover:border-[#b83232] hover:text-white"
            >
              JOIN ROOM
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenSettings}
              className="cursor-pointer border border-[#322f35] bg-[#111117] px-3 py-2 text-xs tracking-[0.2em] text-[#bfb9ad] uppercase transition-colors hover:border-[#8c2a2a] hover:text-white"
            >
              SETTINGS
            </button>
            <button
              type="button"
              onClick={onOpenCredits}
              className="cursor-pointer border border-[#322f35] bg-[#111117] px-3 py-2 text-xs tracking-[0.2em] text-[#bfb9ad] uppercase transition-colors hover:border-[#8c2a2a] hover:text-white"
            >
              CREDITS
            </button>
          </div>
        </nav>
      </div>

      {/* Single flat bottom control-hint line */}
      <div className="relative z-10 text-center text-[11px] tracking-[0.18em] text-[#9c968b]/80">
        WASD Move · Shift Run · Ctrl Crouch · E Interact · F Light · M Map · Esc Pause
      </div>
    </div>
  );
};
