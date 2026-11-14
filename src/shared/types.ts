export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ProgressionStep {
  id: number;
  text: string;
  done: boolean;
}

export interface ProgressionFlags {
  keysFound: number;
  generatorStarted: boolean;
  floor0Unlocked: boolean;
  notesFound: number;
  codeSolved: boolean;
  room0Opened: boolean;
  finalSequenceDone: boolean;
}

export interface DoorState {
  locked: boolean;
  open: boolean;
  keyNeeded: string | null;
  requiresPower?: boolean;
}

export interface WorldItem {
  id: string;
  type: 'map' | 'battery' | 'key' | 'radio' | 'camera' | 'note' | 'reliquary';
  keyId?: string;
  noteIndex?: number;
  name: string;
  pos: Vec3;
  collectedBy: string | null;
  hidden?: boolean;
}

export interface RealityClue {
  wallCodeText: string;
  paintingSymbols: number[];
}

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  pos: Vec3;
  rotY: number;
  rotX: number;
  crouching: boolean;
  flashlight: boolean;
  alive: boolean;
  inRoom0: boolean;
  escaped: boolean;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
}

export interface RoomLobbySnapshot {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'ended';
  soloAllowed: boolean;
  players: LobbyPlayer[];
}

export interface MonstersState {
  shadow: {
    pos: Vec3;
    rotY: number;
    active: boolean;
    targetPlayerId: string | null;
    teleportCooldown: number;
  };
  double: {
    pos: Vec3;
    rotY: number;
    mimicPlayerId: string | null;
    active: boolean;
    hostile: boolean;
  };
  watcher: {
    pos: Vec3;
    rotY: number;
    realityOnly: number;
    active: boolean;
  };
}

export interface PublicGameState {
  code: string;
  hostId: string;
  phase: 'playing' | 'ending';
  ending: EndingType | null;
  soloMode: boolean;
  players: PublicPlayer[];
  progression: ProgressionStep[];
  progressionFlags: ProgressionFlags;
  doors: Record<string, DoorState>;
  elevator: {
    floor: number;
    moving: boolean;
    targetFloor: number;
  };
  puzzles: {
    breakers: Record<'A' | 'B' | 'C', boolean>;
    generatorOnline: boolean;
    paintings: number[];
    paintingsSolved: boolean;
    truthReliquaryUnlocked: boolean;
    keypadSolved: boolean;
    finalSwitches: Record<string, boolean>;
    truthAltarActivated: boolean;
  };
  items: Record<string, WorldItem>;
  sharedInventory: {
    keys: string[];
    notes: number[];
    hasReliquary: boolean;
  };
  monsters: MonstersState;
  radioFrequency: number;
  breakerSequence: Array<'A' | 'B' | 'C'>;
}

export type EndingType = 'ESCAPE' | 'FORGOTTEN' | 'LEFT_BEHIND' | 'TRUE_ROOM_0';

export interface EndingPayload {
  ending: EndingType;
  title: string;
  subtitle: string;
  text: string;
  sacrificedName?: string;
  progression: ProgressionStep[];
}

export interface GameStartedPayload {
  selfId: string;
  realityId: number;
  realityClue: RealityClue;
  allRealityClues?: Record<number, RealityClue>;
  state: PublicGameState;
}

export interface GameSettings {
  sensitivity: number;
  masterVol: number;
  musicVol: number;
  sfxVol: number;
  quality: 'low' | 'medium' | 'high';
  resScale: number;
  muted: boolean;
}
