import crypto from 'crypto';
import type { RoomLobbySnapshot } from '../src/shared/types';
import {
  createInitialGameState,
  type AuthoritativeGameState,
  type ServerPlayer,
} from './gameState';

export interface GameRoom {
  code: string;
  hostId: string;
  status: 'lobby' | 'playing' | 'ended';
  soloAllowed: boolean;
  players: Map<string, ServerPlayer>;
  tokens: Map<string, string>;
  gameState: AuthoritativeGameState | null;
  createdAt: number;
}

export const rooms = new Map<string, GameRoom>();
const RECONNECT_GRACE_MS = 45000;

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function generateToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function sanitizeName(name: string): string {
  const cleaned = String(name || 'Guest')
    .trim()
    .replace(/[^a-zA-Z0-9_\- ]/g, '');
  return cleaned.slice(0, 16) || 'Guest';
}

export function createRoom(
  hostSocketId: string,
  hostName: string,
  options: { soloAllowed?: boolean } = {}
): { room: GameRoom; player: ServerPlayer } {
  const code = generateRoomCode();
  const token = generateToken();
  const player: ServerPlayer = {
    id: hostSocketId,
    token,
    name: sanitizeName(hostName),
    isHost: true,
    ready: true,
    connected: true,
    disconnectedAt: null,
    pos: { x: 0, y: 1.7, z: 4.2 },
    rotY: 0,
    rotX: 0,
    crouching: false,
    flashlight: true,
    alive: true,
    inRoom0: false,
    escaped: false,
  };

  const room: GameRoom = {
    code,
    hostId: hostSocketId,
    status: 'lobby',
    soloAllowed: Boolean(options.soloAllowed),
    players: new Map([[hostSocketId, player]]),
    tokens: new Map([[token, hostSocketId]]),
    gameState: null,
    createdAt: Date.now(),
  };

  rooms.set(code, room);
  return { room, player };
}

export function joinRoom(
  code: string,
  socketId: string,
  playerName: string,
  reconnectToken?: string | null
):
  | { error: string }
  | { room: GameRoom; player: ServerPlayer; reconnected: boolean } {
  const normalized = String(code || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized)) {
    return { error: 'Invalid room code format. Must be 6 characters.' };
  }

  const room = rooms.get(normalized);
  if (!room) {
    return { error: 'Room not found. Check the 6-character code.' };
  }

  if (reconnectToken && room.tokens.has(reconnectToken)) {
    const oldId = room.tokens.get(reconnectToken)!;
    const existing = room.players.get(oldId);
    if (existing) {
      room.players.delete(oldId);
      existing.id = socketId;
      existing.connected = true;
      existing.disconnectedAt = null;
      room.players.set(socketId, existing);
      room.tokens.set(reconnectToken, socketId);
      if (room.hostId === oldId) {
        room.hostId = socketId;
      }
      if (room.gameState && room.gameState.realities[oldId] !== undefined) {
        room.gameState.realities[socketId] = room.gameState.realities[oldId];
        delete room.gameState.realities[oldId];
      }
      return { room, player: existing, reconnected: true };
    }
  }

  if (room.status !== 'lobby') {
    return { error: 'Game has already started in this room.' };
  }

  const connectedCount = Array.from(room.players.values()).length;
  if (connectedCount >= 3) {
    return { error: 'Room is full (maximum 3 players).' };
  }

  const token = generateToken();
  const spawnOffset = (connectedCount - 1) * 1.8;
  const player: ServerPlayer = {
    id: socketId,
    token,
    name: sanitizeName(playerName),
    isHost: false,
    ready: false,
    connected: true,
    disconnectedAt: null,
    pos: { x: spawnOffset, y: 1.7, z: 4.5 },
    rotY: 0,
    rotX: 0,
    crouching: false,
    flashlight: true,
    alive: true,
    inRoom0: false,
    escaped: false,
  };

  room.players.set(socketId, player);
  room.tokens.set(token, socketId);
  return { room, player, reconnected: false };
}

export function getLobbySnapshot(room: GameRoom): RoomLobbySnapshot {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    soloAllowed: room.soloAllowed,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.id === room.hostId,
      ready: p.ready,
      connected: p.connected,
    })),
  };
}

export function toggleReady(room: GameRoom, socketId: string): boolean {
  const player = room.players.get(socketId);
  if (!player || room.status !== 'lobby') return false;
  if (player.id === room.hostId) {
    player.ready = true;
  } else {
    player.ready = !player.ready;
  }
  return true;
}

export function canStartGame(
  room: GameRoom,
  socketId: string
): { ok: true } | { ok: false; error: string } {
  if (room.hostId !== socketId) {
    return { ok: false, error: 'Only the room host can start the game.' };
  }
  const players = Array.from(room.players.values()).filter((p) => p.connected);
  if (!room.soloAllowed && players.length < 2) {
    return { ok: false, error: 'At least 2 players are required to start ROOM 0.' };
  }
  const unready = players.filter((p) => p.id !== room.hostId && !p.ready);
  if (unready.length > 0) {
    return { ok: false, error: 'All players must be READY before starting.' };
  }
  return { ok: true };
}

export function startGame(room: GameRoom): AuthoritativeGameState {
  room.status = 'playing';
  const players = Array.from(room.players.values());
  players.forEach((p, idx) => {
    const offset = players.length === 1 ? 0 : (idx - 1) * 1.6;
    p.pos = { x: offset, y: 1.7, z: 4.2 };
    p.rotY = 0;
    p.rotX = 0;
    p.crouching = false;
    p.flashlight = true;
    p.alive = true;
    p.inRoom0 = false;
    p.escaped = false;
  });
  room.gameState = createInitialGameState(players, {
    soloMode: room.soloAllowed || players.length === 1,
  });
  return room.gameState;
}

export function handleDisconnect(socketId: string): {
  room: GameRoom | null;
  code?: string;
  removed: boolean;
  player?: ServerPlayer;
} | null {
  for (const [code, room] of rooms.entries()) {
    const player = room.players.get(socketId);
    if (!player) continue;

    if (room.status === 'lobby') {
      room.players.delete(socketId);
      room.tokens.delete(player.token);
      if (room.players.size === 0) {
        rooms.delete(code);
        return { room: null, removed: true };
      }
      if (room.hostId === socketId) {
        const nextHost = room.players.values().next().value as ServerPlayer;
        room.hostId = nextHost.id;
        nextHost.isHost = true;
        nextHost.ready = true;
      }
      return { room, code, removed: true };
    } else {
      player.connected = false;
      player.disconnectedAt = Date.now();
      return { room, code, removed: false, player };
    }
  }
  return null;
}

export function cleanupExpiredPlayers(): GameRoom[] {
  const now = Date.now();
  const updates: GameRoom[] = [];
  for (const [code, room] of rooms.entries()) {
    let changed = false;
    for (const [pid, p] of room.players.entries()) {
      if (!p.connected && p.disconnectedAt && now - p.disconnectedAt > RECONNECT_GRACE_MS) {
        room.players.delete(pid);
        room.tokens.delete(p.token);
        changed = true;
      }
    }
    if (room.players.size === 0) {
      rooms.delete(code);
      continue;
    }
    if (changed) {
      if (!room.players.has(room.hostId)) {
        const nextHost = room.players.values().next().value as ServerPlayer;
        room.hostId = nextHost.id;
        nextHost.isHost = true;
      }
      updates.push(room);
    }
  }
  return updates;
}

export function getRoomBySocket(socketId: string): GameRoom | null {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return null;
}
