import type {
  DoorState,
  MonstersState,
  ProgressionFlags,
  ProgressionStep,
  RealityClue,
  WorldItem,
  EndingType,
} from '../src/shared/types';

export interface ServerPlayer {
  id: string;
  token: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  pos: { x: number; y: number; z: number };
  rotY: number;
  rotX: number;
  crouching: boolean;
  flashlight: boolean;
  alive: boolean;
  inRoom0: boolean;
  escaped: boolean;
}

export interface AuthoritativeGameState {
  startedAt: number;
  phase: 'playing' | 'ending';
  ending: EndingType | null;
  soloMode: boolean;
  keypadCode: string;
  radioFrequency: number;
  breakerSequence: Array<'A' | 'B' | 'C'>;
  realities: Record<string, number>;
  realityClues: Record<number, RealityClue>;
  progression: ProgressionFlags;
  doors: Record<string, DoorState>;
  elevator: {
    floor: number;
    moving: boolean;
    targetFloor: number;
  };
  puzzles: {
    breakers: Record<'A' | 'B' | 'C', boolean>;
    breakerOrder: Array<'A' | 'B' | 'C'>;
    generatorOnline: boolean;
    paintings: number[];
    paintingsSolved: boolean;
    truthReliquaryUnlocked: boolean;
    keypadEntered: string;
    keypadSolved: boolean;
    finalSwitches: Record<string, boolean>;
    truthAltarActivated: boolean;
    sacrificedPlayerId: string | null;
  };
  items: Record<string, WorldItem>;
  sharedInventory: {
    keys: string[];
    notes: number[];
    hasReliquary: boolean;
  };
  monsters: MonstersState;
  locks: Set<string>;
}

export function createRandomCode(rng: () => number = Math.random): string {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += digits[Math.floor(rng() * digits.length)];
  }
  return code;
}

export function createInitialGameState(
  players: ServerPlayer[],
  options: { soloMode?: boolean; keypadCode?: string } = {}
): AuthoritativeGameState {
  const keypadCode = options.keypadCode || createRandomCode();
  const radioFrequency = [104.3, 98.7, 107.9][Math.floor(Math.random() * 3)];
  const breakerSequence: Array<'A' | 'B' | 'C'> = ['A', 'C', 'B'];
  const soloMode = Boolean(options.soloMode || players.length === 1);

  const realities: Record<string, number> = {};
  players.forEach((p, idx) => {
    realities[p.id] = idx % 3;
  });

  const realityClues: Record<number, RealityClue> = {
    0: {
      wallCodeText:
        players.length === 2
          ? `CODE PART I: ${keypadCode[0]} ${keypadCode[1]} _ _`
          : `CODE DIGIT #1: ${keypadCode[0]}`,
      paintingSymbols: [2, 0, 1],
    },
    1: {
      wallCodeText:
        players.length === 2
          ? `CODE PART II: _ _ ${keypadCode[2]} ${keypadCode[3]}`
          : `CODE DIGIT #2-3: _ ${keypadCode[1]} ${keypadCode[2]} _`,
      paintingSymbols: [0, 3, 2],
    },
    2: {
      wallCodeText: `CODE DIGIT #4: _ _ _ ${keypadCode[3]}`,
      paintingSymbols: [1, 2, 0],
    },
  };

  return {
    startedAt: Date.now(),
    phase: 'playing',
    ending: null,
    soloMode,
    keypadCode,
    radioFrequency,
    breakerSequence,
    realities,
    realityClues,

    progression: {
      keysFound: 0,
      generatorStarted: false,
      floor0Unlocked: false,
      notesFound: 0,
      codeSolved: false,
      room0Opened: false,
      finalSequenceDone: false,
    },

    doors: {
      reception_hall: { locked: false, open: true, keyNeeded: null },
      bedroom_101: { locked: false, open: false, keyNeeded: null },
      bedroom_102: { locked: true, open: false, keyNeeded: 'brass_key' },
      bedroom_103: { locked: true, open: false, keyNeeded: 'iron_key' },
      basement_door: { locked: false, open: false, keyNeeded: null },
      elevator_door: {
        locked: true,
        open: false,
        keyNeeded: 'master_key',
        requiresPower: true,
      },
      floor0_vault: { locked: true, open: false, keyNeeded: 'keypad' },
      room0_door: { locked: true, open: false, keyNeeded: 'keypad' },
      secret_exit: { locked: true, open: false, keyNeeded: 'final' },
    },

    elevator: {
      floor: 1,
      moving: false,
      targetFloor: 1,
    },

    puzzles: {
      breakers: { A: false, B: false, C: false },
      breakerOrder: [],
      generatorOnline: false,
      paintings: [0, 0, 0],
      paintingsSolved: false,
      truthReliquaryUnlocked: false,
      keypadEntered: '',
      keypadSolved: false,
      finalSwitches: {},
      truthAltarActivated: false,
      sacrificedPlayerId: null,
    },

    items: {
      hotel_map: {
        id: 'hotel_map',
        type: 'map',
        name: 'Hotel Map',
        pos: { x: 2.2, y: 1.16, z: -2.0 },
        collectedBy: null,
      },
      flashlight_spare: {
        id: 'flashlight_spare',
        type: 'battery',
        name: 'Battery Pack',
        pos: { x: -4.5, y: 0.9, z: 3.5 },
        collectedBy: null,
      },
      brass_key: {
        id: 'brass_key',
        type: 'key',
        keyId: 'brass_key',
        name: 'Brass Key (102)',
        pos: { x: -9.5, y: 0.95, z: -16.5 },
        collectedBy: null,
      },
      radio_item: {
        id: 'radio_item',
        type: 'radio',
        name: 'Old Radio',
        pos: { x: -7.5, y: 0.95, z: -13.5 },
        collectedBy: null,
      },
      note_1: {
        id: 'note_1',
        type: 'note',
        noteIndex: 1,
        name: 'Note Fragment 1/4',
        pos: { x: 4.5, y: 1.16, z: -2.6 },
        collectedBy: null,
      },
      iron_key: {
        id: 'iron_key',
        type: 'key',
        keyId: 'iron_key',
        name: 'Iron Key (103)',
        pos: { x: 9.2, y: 0.95, z: -26.5 },
        collectedBy: null,
      },
      camera_item: {
        id: 'camera_item',
        type: 'camera',
        name: 'Polaroid Camera',
        pos: { x: 7.5, y: 0.95, z: -23.5 },
        collectedBy: null,
      },
      note_2: {
        id: 'note_2',
        type: 'note',
        noteIndex: 2,
        name: 'Note Fragment 2/4',
        pos: { x: -8.5, y: 0.95, z: -36.0 },
        collectedBy: null,
      },
      battery_basement: {
        id: 'battery_basement',
        type: 'battery',
        name: 'Heavy Battery',
        pos: { x: 7.5, y: -3.6, z: -13.0 },
        collectedBy: null,
      },
      master_key: {
        id: 'master_key',
        type: 'key',
        keyId: 'master_key',
        name: 'Elevator Master Key',
        pos: { x: 14.5, y: -3.6, z: -4.5 },
        collectedBy: null,
      },
      note_3: {
        id: 'note_3',
        type: 'note',
        noteIndex: 3,
        name: 'Note Fragment 3/4',
        pos: { x: -10.0, y: -8.0, z: -61.0 },
        collectedBy: null,
      },
      note_4: {
        id: 'note_4',
        type: 'note',
        noteIndex: 4,
        name: 'Note Fragment 4/4',
        pos: { x: 10.0, y: -8.0, z: -72.0 },
        collectedBy: null,
      },
      battery_floor0: {
        id: 'battery_floor0',
        type: 'battery',
        name: 'Spare Battery',
        pos: { x: 0.0, y: -8.0, z: -56.0 },
        collectedBy: null,
      },
      truth_reliquary: {
        id: 'truth_reliquary',
        type: 'reliquary',
        name: 'Truth Reliquary',
        pos: { x: -9.5, y: 0.95, z: -38.0 },
        hidden: true,
        collectedBy: null,
      },
    },

    sharedInventory: {
      keys: [],
      notes: [],
      hasReliquary: false,
    },

    monsters: {
      shadow: {
        pos: { x: 0, y: 0, z: -32 },
        rotY: 0,
        active: true,
        targetPlayerId: null,
        teleportCooldown: 0,
      },
      double: {
        pos: { x: 0, y: 0, z: -22 },
        rotY: 0,
        mimicPlayerId: players[0] ? players[0].id : null,
        active: true,
        hostile: false,
      },
      watcher: {
        pos: { x: -10, y: -9, z: -65 },
        rotY: 0,
        realityOnly: 0,
        active: true,
      },
    },

    locks: new Set<string>(),
  };
}

export function getProgressionSummary(gs: AuthoritativeGameState): ProgressionStep[] {
  const p = gs.progression;
  return [
    { id: 1, text: `Find 3 Hotel Keys (${p.keysFound}/3)`, done: p.keysFound >= 3 },
    { id: 2, text: 'Start Basement Generator', done: p.generatorStarted },
    { id: 3, text: 'Unlock & Descend to Floor 0', done: p.floor0Unlocked },
    { id: 4, text: `Find 4 Note Fragments (${p.notesFound}/4)`, done: p.notesFound >= 4 },
    { id: 5, text: 'Solve Floor 0 Keypad Code', done: p.codeSolved },
    { id: 6, text: 'Open ROOM 0', done: p.room0Opened },
    { id: 7, text: 'Complete Final Sequence in ROOM 0', done: p.finalSequenceDone },
  ];
}

export function pickupItemAction(
  gs: AuthoritativeGameState,
  playerId: string,
  itemId: string
): { ok: true; item: WorldItem } | { ok: false; error: string } {
  const lockKey = `item:${itemId}`;
  if (gs.locks.has(lockKey)) {
    return { ok: false, error: 'Item busy.' };
  }
  gs.locks.add(lockKey);
  try {
    const item = gs.items[itemId];
    if (!item || item.collectedBy || item.hidden) {
      return { ok: false, error: 'Item already taken.' };
    }
    item.collectedBy = playerId;
    if (item.type === 'key' && item.keyId) {
      gs.sharedInventory.keys.push(item.keyId);
      gs.progression.keysFound = gs.sharedInventory.keys.length;
    } else if (item.type === 'note' && item.noteIndex !== undefined) {
      gs.sharedInventory.notes.push(item.noteIndex);
      gs.progression.notesFound = gs.sharedInventory.notes.length;
    } else if (item.type === 'reliquary') {
      gs.sharedInventory.hasReliquary = true;
    }
    return { ok: true, item };
  } finally {
    gs.locks.delete(lockKey);
  }
}

export function toggleDoorAction(
  gs: AuthoritativeGameState,
  doorId: string
): { ok: true; door: DoorState } | { ok: false; reason: string } {
  const lockKey = `door:${doorId}`;
  if (gs.locks.has(lockKey)) return { ok: false, reason: 'Door busy.' };
  gs.locks.add(lockKey);
  try {
    const door = gs.doors[doorId];
    if (!door) return { ok: false, reason: 'Door not found.' };

    if (door.locked) {
      if (door.requiresPower && !gs.puzzles.generatorOnline) {
        return { ok: false, reason: 'No power. Start the Basement Generator first!' };
      }
      if (door.keyNeeded === 'keypad') {
        return { ok: false, reason: 'Locked by electronic keypad. Enter the 4-digit code.' };
      }
      if (door.keyNeeded === 'final') {
        return { ok: false, reason: 'Complete the Room 0 sequence first.' };
      }
      if (door.keyNeeded && !gs.sharedInventory.keys.includes(door.keyNeeded)) {
        return {
          ok: false,
          reason: `Requires ${door.keyNeeded.replace('_', ' ').toUpperCase()}.`,
        };
      }
      door.locked = false;
      door.open = true;
      if (doorId === 'elevator_door') {
        gs.progression.floor0Unlocked = true;
      }
    } else {
      door.open = !door.open;
    }
    return { ok: true, door };
  } finally {
    gs.locks.delete(lockKey);
  }
}

export function toggleBreakerAction(
  gs: AuthoritativeGameState,
  breakerId: string
): { ok: boolean; alreadyOnline?: boolean; reset?: boolean; generatorOnline: boolean } {
  const lockKey = 'puzzle:breakers';
  if (gs.locks.has(lockKey)) {
    return { ok: false, generatorOnline: gs.puzzles.generatorOnline };
  }
  gs.locks.add(lockKey);
  try {
    if (gs.puzzles.generatorOnline) {
      return { ok: true, alreadyOnline: true, generatorOnline: true };
    }
    if (breakerId !== 'A' && breakerId !== 'B' && breakerId !== 'C') {
      return { ok: false, generatorOnline: false };
    }
    if (!gs.puzzles.breakers[breakerId]) {
      gs.puzzles.breakers[breakerId] = true;
      gs.puzzles.breakerOrder.push(breakerId);
    }

    const idx = gs.puzzles.breakerOrder.length - 1;
    if (gs.puzzles.breakerOrder[idx] !== gs.breakerSequence[idx]) {
      gs.puzzles.breakers = { A: false, B: false, C: false };
      gs.puzzles.breakerOrder = [];
      return { ok: false, reset: true, generatorOnline: false };
    }

    if (gs.puzzles.breakerOrder.length === 3) {
      gs.puzzles.generatorOnline = true;
      gs.progression.generatorStarted = true;
    }
    return { ok: true, reset: false, generatorOnline: gs.puzzles.generatorOnline };
  } finally {
    gs.locks.delete(lockKey);
  }
}

export function rotatePaintingAction(
  gs: AuthoritativeGameState,
  index: number
): { ok: boolean; solved: boolean } {
  const lockKey = `painting:${index}`;
  if (gs.locks.has(lockKey)) return { ok: false, solved: gs.puzzles.paintingsSolved };
  gs.locks.add(lockKey);
  try {
    if (index < 0 || index > 2 || gs.puzzles.paintingsSolved) {
      return { ok: false, solved: gs.puzzles.paintingsSolved };
    }
    gs.puzzles.paintings[index] = (gs.puzzles.paintings[index] + 1) % 4;
    const target = [2, 1, 3];
    const solved = gs.puzzles.paintings.every((v, i) => v === target[i]);
    if (solved) {
      gs.puzzles.paintingsSolved = true;
      gs.puzzles.truthReliquaryUnlocked = true;
      gs.items.truth_reliquary.hidden = false;
    }
    return { ok: true, solved };
  } finally {
    gs.locks.delete(lockKey);
  }
}

export function submitKeypadAction(
  gs: AuthoritativeGameState,
  code: string
): { ok: true } | { ok: false; error: string } {
  const lockKey = 'puzzle:keypad';
  if (gs.locks.has(lockKey)) return { ok: false, error: 'Keypad busy.' };
  gs.locks.add(lockKey);
  try {
    const cleaned = String(code || '').trim();
    if (cleaned === gs.keypadCode) {
      gs.puzzles.keypadSolved = true;
      gs.progression.codeSolved = true;
      gs.progression.room0Opened = true;
      gs.doors.floor0_vault.locked = false;
      gs.doors.floor0_vault.open = true;
      gs.doors.room0_door.locked = false;
      gs.doors.room0_door.open = true;
      return { ok: true };
    }
    return { ok: false, error: 'ACCESS DENIED — INCORRECT CODE' };
  } finally {
    gs.locks.delete(lockKey);
  }
}
