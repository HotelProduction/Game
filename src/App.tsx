import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameModals, type ActiveModalType } from './components/GameModals';
import { LobbyScreen } from './components/LobbyScreen';
import { TitleScreen } from './components/TitleScreen';
import { Room0Engine, type HudSnapshot } from './game/engine';
import { MultiplayerClient } from './game/multiplayer';
import { SoundEngine } from './game/sound';
import type {
  EndingPayload,
  GameSettings,
  ProgressionStep,
  PublicPlayer,
  RoomLobbySnapshot,
} from './shared/types';

type AppView = 'title' | 'lobby' | 'playing' | 'paused' | 'gameover';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Room0Engine | null>(null);
  const mpRef = useRef<MultiplayerClient | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);

  const [view, setView] = useState<AppView>('title');
  const [playerName, setPlayerName] = useState('Guest');
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [lobby, setLobby] = useState<RoomLobbySnapshot | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [lobbyError, setLobbyError] = useState('');
  const [joinError, setJoinError] = useState('');

  const [hud, setHud] = useState<HudSnapshot>({
    zone: 'RECEPTION',
    battery: 100,
    fear: 0,
    stamina: 100,
    flashlightOn: true,
    realityIndex: 1,
    soloMode: false,
    interactLabel: null,
    slots: [{ id: 'flashlight', label: 'Flashlight', key: '1' }],
    selectedSlot: 0,
  });
  const [tasks, setTasks] = useState<ProgressionStep[]>([]);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const [cameraFlash, setCameraFlash] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatValue, setChatValue] = useState('');

  const [docTitle, setDocTitle] = useState('DOCUMENT');
  const [docContent, setDocContent] = useState('');
  const [mapZone, setMapZone] = useState('RECEPTION');
  const [ending, setEnding] = useState<EndingPayload | null>(null);

  const [settings, setSettings] = useState<GameSettings>({
    sensitivity: 1.0,
    masterVol: 0.8,
    musicVol: 0.7,
    sfxVol: 0.9,
    quality: 'medium',
    resScale: 1.0,
    muted: false,
  });

  const toastIdRef = useRef(0);
  const pushToast = useCallback((text: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-3), { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  // Mirror state machine to document.body.dataset.state
  useEffect(() => {
    const mapped =
      view === 'lobby'
        ? 'title'
        : view;
    document.body.dataset.state = mapped;
  }, [view]);

  // Initialize Three.js engine, SoundEngine, and MultiplayerClient once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const sound = new SoundEngine();
    const mp = new MultiplayerClient();
    soundRef.current = sound;
    mpRef.current = mp;

    const engine = new Room0Engine(container, mp, sound, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onTasksUpdate: (t) => setTasks(t),
      onPlayersUpdate: (p) => setPlayers(p),
      onToast: (msg) => pushToast(msg),
      onOpenKeypad: () => setActiveModal('keypad'),
      onOpenDocument: (title, text) => {
        setDocTitle(title);
        setDocContent(text);
        setActiveModal('doc');
      },
      onOpenMap: (zone) => {
        setMapZone(zone);
        setActiveModal('map');
      },
      onPauseRequest: () => {
        setView('paused');
        setActiveModal('pause');
      },
      onToggleChat: () => setChatOpen((prev) => !prev),
      onCameraFlash: () => {
        setCameraFlash(true);
        window.setTimeout(() => setCameraFlash(false), 180);
      },
      onEnding: (data) => {
        setEnding(data);
        setActiveModal(null);
        setView('gameover');
      },
      onGameStarted: () => {
        setActiveModal(null);
        setEnding(null);
        setView('playing');
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      },
    });
    engineRef.current = engine;

    const unsubLobby = mp.on('room:lobby_update', (nextLobby) => {
      setLobby(nextLobby);
      if (engine.mode === 'playing') {
        setPlayers(
          nextLobby.players.map((lp) => ({
            id: lp.id,
            name: lp.name,
            connected: lp.connected,
            pos: { x: 0, y: 1.7, z: 0 },
            rotY: 0,
            rotX: 0,
            crouching: false,
            flashlight: true,
            alive: true,
            inRoom0: false,
            escaped: false,
          }))
        );
      }
    });

    const onPointerDown = () => sound.init();
    window.addEventListener('pointerdown', onPointerDown, { once: true });

    // ?autostart=1 skips straight into Solo Exploration gameplay
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const startSolo = async () => {
        try {
          const res = await mp.createRoom('Guest', true);
          setSelfId(res.selfId);
          setLobby(res.lobby);
          await mp.startGame();
        } catch (err) {
          pushToast(err instanceof Error ? err.message : 'Autostart failed.');
        }
      };
      if (mp.socket.connected) {
        void startSolo();
      } else {
        mp.socket.once('connect', () => {
          void startSolo();
        });
      }
    }

    return () => {
      unsubLobby();
      window.removeEventListener('pointerdown', onPointerDown);
      engine.dispose();
      mp.dispose();
    };
  }, [pushToast]);

  const handleCreatePrivateRoom = useCallback(async () => {
    const mp = mpRef.current;
    if (!mp) return;
    soundRef.current?.playClick();
    try {
      const res = await mp.createRoom(playerName.trim() || 'Guest', false);
      setSelfId(res.selfId);
      setLobby(res.lobby);
      setLobbyError('');
      setActiveModal(null);
      setView('lobby');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to create room.');
    }
  }, [playerName, pushToast]);

  const handleCreateSoloRoom = useCallback(async () => {
    const mp = mpRef.current;
    if (!mp) return;
    soundRef.current?.init();
    soundRef.current?.playClick();
    try {
      const res = await mp.createRoom(playerName.trim() || 'Guest', true);
      setSelfId(res.selfId);
      setLobby(res.lobby);
      setActiveModal(null);
      await mp.startGame();
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to start solo run.');
    }
  }, [playerName, pushToast]);

  const handleSubmitJoin = useCallback(
    async (rawCode: string) => {
      const mp = mpRef.current;
      if (!mp) return;
      soundRef.current?.playClick();
      const code = rawCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) {
        setJoinError('Room code must be exactly 6 letters/numbers.');
        return;
      }
      setJoinError('');
      try {
        const res = await mp.joinRoom(code, playerName.trim() || 'Guest');
        setSelfId(res.selfId);
        setLobby(res.lobby);
        setActiveModal(null);
        if (res.status === 'lobby') {
          setView('lobby');
        }
      } catch (err) {
        setJoinError(err instanceof Error ? err.message : 'Failed to join room.');
      }
    },
    [playerName]
  );

  const handleToggleMute = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, muted: !prev.muted };
      engineRef.current?.applySettings(next);
      return next;
    });
  }, []);

  // Global keyboard shortcuts for Title handshake (Enter/Space) & Mute (N)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'KeyN') {
        handleToggleMute();
        return;
      }

      if (view === 'title' && !activeModal && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        soundRef.current?.init();
        setActiveModal('play');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, activeModal, handleToggleMute]);

  const handleLeaveHotel = useCallback(() => {
    mpRef.current?.clearSession();
    window.location.href = window.location.pathname;
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050508]">
      {/* Isolated WebGL Canvas Mount Container */}
      <div ref={mountRef} className="fixed inset-0 z-0 h-full w-full" />

      {view === 'title' && (
        <TitleScreen
          playerName={playerName}
          onNameChange={setPlayerName}
          onPlayClick={() => {
            soundRef.current?.playClick();
            setActiveModal('play');
          }}
          onCreateRoom={() => {
            void handleCreatePrivateRoom();
          }}
          onJoinRoom={() => {
            soundRef.current?.playClick();
            setJoinError('');
            setActiveModal('join');
          }}
          onOpenSettings={() => {
            soundRef.current?.playClick();
            setActiveModal('settings');
          }}
          onOpenCredits={() => {
            soundRef.current?.playClick();
            setActiveModal('credits');
          }}
        />
      )}

      {view === 'lobby' && lobby && (
        <LobbyScreen
          lobby={lobby}
          selfId={selfId}
          error={lobbyError}
          onCopyCode={() => {
            navigator.clipboard?.writeText(lobby.code).catch(() => {});
            pushToast(`Copied room code: ${lobby.code}`);
          }}
          onToggleReady={() => {
            soundRef.current?.playClick();
            mpRef.current?.toggleReady();
          }}
          onStartGame={async () => {
            soundRef.current?.playClick();
            setLobbyError('');
            try {
              await mpRef.current?.startGame();
            } catch (err) {
              setLobbyError(
                err instanceof Error ? err.message : 'Cannot start game.'
              );
            }
          }}
          onLeave={handleLeaveHotel}
        />
      )}

      {(view === 'playing' || view === 'paused') && (
        <GameHud
          hud={hud}
          tasks={tasks}
          players={players}
          toasts={toasts}
          muted={settings.muted}
          cameraFlash={cameraFlash}
          chatOpen={chatOpen}
          chatValue={chatValue}
          onChatChange={setChatValue}
          onChatSubmit={(e) => {
            e.preventDefault();
            if (chatValue.trim()) {
              mpRef.current?.sendChat(chatValue.trim());
            }
            setChatValue('');
            setChatOpen(false);
            engineRef.current?.requestPointerLock();
          }}
          onChatClose={() => {
            setChatOpen(false);
            engineRef.current?.requestPointerLock();
          }}
          onToggleMute={handleToggleMute}
          onOpenPause={() => {
            engineRef.current?.setMode('paused');
            setView('paused');
            setActiveModal('pause');
          }}
          onSelectSlot={(idx) => {
            engineRef.current?.useSlot(idx);
          }}
        />
      )}

      <GameModals
        activeModal={activeModal}
        settings={settings}
        joinError={joinError}
        docTitle={docTitle}
        docContent={docContent}
        mapZone={mapZone}
        ending={ending}
        onClose={() => {
          soundRef.current?.playClick();
          if (view === 'paused' && activeModal === 'settings') {
            setActiveModal('pause');
            return;
          }
          setActiveModal(null);
          if (view === 'playing') {
            engineRef.current?.requestPointerLock();
          }
        }}
        onCreatePrivateRoom={() => void handleCreatePrivateRoom()}
        onCreateSoloRoom={() => void handleCreateSoloRoom()}
        onOpenJoinModal={() => {
          soundRef.current?.playClick();
          setJoinError('');
          setActiveModal('join');
        }}
        onSubmitJoin={(code) => void handleSubmitJoin(code)}
        onUpdateSettings={(next) => {
          setSettings(next);
          engineRef.current?.applySettings(next);
        }}
        onSubmitKeypad={async (code) => {
          const res = await mpRef.current?.submitKeypad(code);
          return res || { ok: false, error: 'Connection lost' };
        }}
        onResumeGame={() => {
          soundRef.current?.playClick();
          setActiveModal(null);
          setView('playing');
          engineRef.current?.setMode('playing');
          engineRef.current?.requestPointerLock();
        }}
        onOpenSettingsFromPause={() => {
          soundRef.current?.playClick();
          setActiveModal('settings');
        }}
        onLeaveHotel={handleLeaveHotel}
      />
    </div>
  );
}
