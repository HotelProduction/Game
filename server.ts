import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import express from 'express';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import type { PublicGameState, EndingPayload } from './src/shared/types';
import {
  rooms,
  createRoom,
  joinRoom,
  getLobbySnapshot,
  toggleReady,
  canStartGame,
  startGame,
  handleDisconnect,
  cleanupExpiredPlayers,
  getRoomBySocket,
  type GameRoom,
} from './server/rooms';
import {
  getProgressionSummary,
  pickupItemAction,
  toggleDoorAction,
  toggleBreakerAction,
  rotatePaintingAction,
  submitKeypadAction,
} from './server/gameState';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

function serializePublicState(room: GameRoom): PublicGameState {
  const gs = room.gameState!;
  const players = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    connected: p.connected,
    pos: p.pos,
    rotY: p.rotY,
    rotX: p.rotX,
    crouching: p.crouching,
    flashlight: p.flashlight,
    alive: p.alive,
    inRoom0: p.inRoom0,
    escaped: p.escaped,
  }));

  return {
    code: room.code,
    hostId: room.hostId,
    phase: gs.phase,
    ending: gs.ending,
    soloMode: gs.soloMode,
    players,
    progression: getProgressionSummary(gs),
    progressionFlags: gs.progression,
    doors: gs.doors,
    elevator: gs.elevator,
    puzzles: {
      breakers: gs.puzzles.breakers,
      generatorOnline: gs.puzzles.generatorOnline,
      paintings: gs.puzzles.paintings,
      paintingsSolved: gs.puzzles.paintingsSolved,
      truthReliquaryUnlocked: gs.puzzles.truthReliquaryUnlocked,
      keypadSolved: gs.puzzles.keypadSolved,
      finalSwitches: gs.puzzles.finalSwitches,
      truthAltarActivated: gs.puzzles.truthAltarActivated,
    },
    items: gs.items,
    sharedInventory: gs.sharedInventory,
    monsters: gs.monsters,
    radioFrequency: gs.radioFrequency,
    breakerSequence: gs.breakerSequence,
  };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    pingInterval: 5000,
    pingTimeout: 12000,
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  function sendGameStartToPlayers(room: GameRoom) {
    const gs = room.gameState!;
    const baseState = serializePublicState(room);
    for (const player of room.players.values()) {
      const realityId = gs.realities[player.id] ?? 0;
      io.to(player.id).emit('game:started', {
        selfId: player.id,
        realityId,
        realityClue: gs.realityClues[realityId],
        allRealityClues: gs.soloMode ? gs.realityClues : undefined,
        state: baseState,
      });
    }
  }

  io.on('connection', (socket) => {
    socket.on(
      'room:create',
      (
        payload: { name?: string; soloAllowed?: boolean },
        callback?: (res: Record<string, unknown>) => void
      ) => {
        try {
          const { room, player } = createRoom(socket.id, payload?.name || 'Guest', {
            soloAllowed: Boolean(payload?.soloAllowed),
          });
          socket.join(room.code);
          const lobby = getLobbySnapshot(room);
          if (typeof callback === 'function') {
            callback({
              ok: true,
              code: room.code,
              token: player.token,
              selfId: player.id,
              lobby,
            });
          }
          io.to(room.code).emit('room:lobby_update', lobby);
        } catch {
          if (typeof callback === 'function') {
            callback({ ok: false, error: 'Failed to create room.' });
          }
        }
      }
    );

    socket.on(
      'room:join',
      (
        payload: { code?: string; name?: string; token?: string | null },
        callback?: (res: Record<string, unknown>) => void
      ) => {
        try {
          const res = joinRoom(
            payload?.code || '',
            socket.id,
            payload?.name || 'Guest',
            payload?.token
          );
          if ('error' in res) {
            if (typeof callback === 'function') callback({ ok: false, error: res.error });
            return;
          }

          const { room, player, reconnected } = res;
          socket.join(room.code);
          const lobby = getLobbySnapshot(room);

          if (typeof callback === 'function') {
            callback({
              ok: true,
              code: room.code,
              token: player.token,
              selfId: player.id,
              reconnected,
              status: room.status,
              lobby,
            });
          }

          io.to(room.code).emit('room:lobby_update', lobby);

          if (reconnected && room.status === 'playing' && room.gameState) {
            const realityId = room.gameState.realities[player.id] ?? 0;
            socket.emit('game:started', {
              selfId: player.id,
              realityId,
              realityClue: room.gameState.realityClues[realityId],
              allRealityClues: room.gameState.soloMode ? room.gameState.realityClues : undefined,
              state: serializePublicState(room),
            });
            socket.to(room.code).emit('game:system_msg', `${player.name} reconnected.`);
          }
        } catch {
          if (typeof callback === 'function') {
            callback({ ok: false, error: 'Error joining room.' });
          }
        }
      }
    );

    socket.on('room:ready', () => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      if (toggleReady(room, socket.id)) {
        io.to(room.code).emit('room:lobby_update', getLobbySnapshot(room));
      }
    });

    socket.on('room:start', (callback?: (res: Record<string, unknown>) => void) => {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Room not found.' });
        return;
      }
      const check = canStartGame(room, socket.id);
      if (!check.ok) {
        if (typeof callback === 'function') callback({ ok: false, error: check.error });
        return;
      }
      startGame(room);
      sendGameStartToPlayers(room);
      if (typeof callback === 'function') callback({ ok: true });
    });

    socket.on('player:update', (data) => {
      const room = getRoomBySocket(socket.id);
      if (!room || room.status !== 'playing') return;
      const player = room.players.get(socket.id);
      if (!player) return;

      if (data && data.pos) {
        player.pos = {
          x: Number(data.pos.x) || 0,
          y: Number(data.pos.y) || 0,
          z: Number(data.pos.z) || 0,
        };
      }
      player.rotY = Number(data?.rotY) || 0;
      player.rotX = Number(data?.rotX) || 0;
      player.crouching = Boolean(data?.crouching);
      player.flashlight = Boolean(data?.flashlight);
      player.inRoom0 = player.pos.y < -6 && player.pos.z < -80;

      socket.to(room.code).emit('player:moved', {
        id: player.id,
        pos: player.pos,
        rotY: player.rotY,
        rotX: player.rotX,
        crouching: player.crouching,
        flashlight: player.flashlight,
        inRoom0: player.inRoom0,
      });
    });

    socket.on('game:pickup_item', ({ itemId }, callback) => {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || room.gameState.phase !== 'playing') return;
      const gs = room.gameState;
      const res = pickupItemAction(gs, socket.id, itemId);
      if (!res.ok) {
        if (typeof callback === 'function') callback(res);
        return;
      }
      const player = room.players.get(socket.id);
      io.to(room.code).emit('game:item_collected', {
        itemId,
        item: res.item,
        byPlayerId: socket.id,
        byPlayerName: player ? player.name : 'Someone',
        sharedInventory: gs.sharedInventory,
        progression: getProgressionSummary(gs),
        progressionFlags: gs.progression,
      });
      if (typeof callback === 'function') callback(res);
    });

    socket.on('game:toggle_door', ({ doorId }, callback) => {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || room.gameState.phase !== 'playing') return;
      const gs = room.gameState;
      const res = toggleDoorAction(gs, doorId);
      if (!res.ok) {
        if (typeof callback === 'function') callback(res);
        return;
      }
      io.to(room.code).emit('game:door_updated', {
        doorId,
        door: res.door,
        progression: getProgressionSummary(gs),
        progressionFlags: gs.progression,
      });
      if (typeof callback === 'function') callback(res);
    });

    socket.on('game:toggle_breaker', ({ breakerId }, callback) => {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || room.gameState.phase !== 'playing') return;
      const gs = room.gameState;
      const res = toggleBreakerAction(gs, breakerId);
      if (res.alreadyOnline) {
        if (typeof callback === 'function') callback(res);
        return;
      }
      io.to(room.code).emit('game:breaker_updated', {
        breakers: gs.puzzles.breakers,
        generatorOnline: res.generatorOnline,
        reset: Boolean(res.reset),
        message: res.reset ? 'Wrong breaker sequence! Breakers tripped.' : undefined,
        progression: getProgressionSummary(gs),
        progressionFlags: gs.progression,
      });
      if (typeof callback === 'function') callback(res);
    });

    socket.on('game:use_elevator', (callback) => {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || room.gameState.phase !== 'playing') return;
      const gs = room.gameState;
      const lockKey = 'elevator';
      if (gs.locks.has(lockKey) || gs.elevator.moving) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Elevator is moving.' });
        return;
      }
      if (!gs.puzzles.generatorOnline) {
        if (typeof callback === 'function') callback({ ok: false, error: 'Elevator has no power.' });
        return;
      }
      if (!gs.sharedInventory.keys.includes('master_key')) {
        if (typeof callback === 'function') {
          callback({ ok: false, error: 'Requires Elevator Master Key from Basement.' });
        }
        return;
      }

      gs.locks.add(lockKey);
      gs.elevator.moving = true;
      const targetFloor = gs.elevator.floor === 1 ? 0 : 1;
      gs.elevator.targetFloor = targetFloor;
      gs.progression.floor0Unlocked = true;

      io.to(room.code).emit('game:elevator_moving', {
        from: gs.elevator.floor,
        to: targetFloor,
      });

      setTimeout(() => {
        if (!room.gameState) return;
        gs.elevator.floor = targetFloor;
        gs.elevator.moving = false;
        gs.doors.elevator_door.locked = false;
        gs.doors.elevator_door.open = true;
        gs.locks.delete(lockKey);

        io.to(room.code).emit('game:elevator_arrived', {
          floor: targetFloor,
          progression: getProgressionSummary(gs),
          progressionFlags: gs.progression,
        });
      }, 3200);

      if (typeof callback === 'function') callback({ ok: true });
    });

    socket.on('game:rotate_painting', ({ index }, callback) => {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || room.gameState.phase !== 'playing') return;
      const gs = room.gameState;
      const res = rotatePaintingAction(gs, index);
      if (!res.ok) return;
      io.to(room.code).emit('game:paintings_updated', {
        paintings: gs.puzzles.paintings,
        solved: res.solved,
        reliquaryItem: res.solved ? gs.items.truth_reliquary : null,
      });
      if (typeof callback === 'function') callback(res);
    });

    socket.on('game:submit_keypad', ({ code }, callback) => {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || room.gameState.phase !== 'playing') return;
      const gs = room.gameState;
      const res = submitKeypadAction(gs, code);
      if (res.ok) {
        io.to(room.code).emit('game:keypad_solved', {
          doors: gs.doors,
          progression: getProgressionSummary(gs),
          progressionFlags: gs.progression,
        });
      }
      if (typeof callback === 'function') callback(res);
    });

    socket.on('game:room0_action', ({ action }, callback) => {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || room.gameState.phase !== 'playing') return;
      const gs = room.gameState;
      const lockKey = 'room0:final';
      if (gs.locks.has(lockKey)) return;
      gs.locks.add(lockKey);

      try {
        const activePlayers = Array.from(room.players.values()).filter((p) => p.connected);

        if (action === 'toggle_switch') {
          gs.puzzles.finalSwitches[socket.id] = !gs.puzzles.finalSwitches[socket.id];
          const activatedCount = activePlayers.filter(
            (p) => gs.puzzles.finalSwitches[p.id]
          ).length;
          io.to(room.code).emit('game:final_switches_updated', {
            finalSwitches: gs.puzzles.finalSwitches,
            activatedCount,
            requiredCount: activePlayers.length,
          });

          if (activatedCount >= activePlayers.length) {
            gs.progression.finalSequenceDone = true;
            gs.doors.secret_exit.locked = false;
            gs.doors.secret_exit.open = true;
            gs.phase = 'ending';
            gs.ending = 'ESCAPE';
            room.status = 'ended';
            const payload: EndingPayload = {
              ending: 'ESCAPE',
              title: 'ENDING 1 — ESCAPE',
              subtitle: 'THE CORRIDOR RELEASES YOU',
              text: 'All switches aligned at 03:34. The heavy blast doors behind the altar groaned open into cold dawn air. You stumbled out onto the empty street — when you looked back, the hotel was nothing more than a charred ruin.',
              progression: getProgressionSummary(gs),
            };
            io.to(room.code).emit('game:ending', payload);
          }
          if (typeof callback === 'function') callback({ ok: true });
          return;
        }

        if (action === 'truth_altar') {
          if (!gs.sharedInventory.hasReliquary || gs.progression.notesFound < 4) {
            if (typeof callback === 'function') {
              callback({
                ok: false,
                error:
                  'Requires all 4 Note Fragments and the Truth Reliquary from the Bedroom 103 Painting Puzzle!',
              });
            }
            return;
          }
          gs.puzzles.truthAltarActivated = true;
          gs.progression.finalSequenceDone = true;
          gs.phase = 'ending';
          gs.ending = 'TRUE_ROOM_0';
          room.status = 'ended';
          const payload: EndingPayload = {
            ending: 'TRUE_ROOM_0',
            title: 'ENDING 4 — TRUE ROOM 0',
            subtitle: 'THE 1973 FIRE UNRAVELED',
            text: 'Placing the Truth Reliquary upon the 03:33 altar shattered the fractured realities into one. You witnessed the truth: Room 0 was never a hotel suite — it was the sealed furnace room where guests perished in 1973. By speaking their names from the 4 fragments, the endless loop finally broke into peace.',
            progression: getProgressionSummary(gs),
          };
          io.to(room.code).emit('game:ending', payload);
          if (typeof callback === 'function') callback({ ok: true });
          return;
        }

        if (action === 'seal_sacrifice') {
          const selfPlayer = room.players.get(socket.id);
          gs.puzzles.sacrificedPlayerId = socket.id;
          gs.progression.finalSequenceDone = true;
          gs.phase = 'ending';
          gs.ending = 'LEFT_BEHIND';
          room.status = 'ended';
          const payload: EndingPayload = {
            ending: 'LEFT_BEHIND',
            title: 'ENDING 3 — LEFT BEHIND',
            subtitle: `${selfPlayer ? selfPlayer.name.toUpperCase() : 'ONE SOUL'} REMAINED IN ROOM 0`,
            text: `${selfPlayer ? selfPlayer.name : 'One survivor'} held down the manual override lever inside Room 0 while the steel bulkhead slammed shut. The others escaped into the night — leaving one voice forever trapped behind the static of 03:33.`,
            sacrificedName: selfPlayer ? selfPlayer.name : 'Unknown',
            progression: getProgressionSummary(gs),
          };
          io.to(room.code).emit('game:ending', payload);
          if (typeof callback === 'function') callback({ ok: true });
        }
      } finally {
        gs.locks.delete(lockKey);
      }
    });

    socket.on('game:curse_succumb', () => {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || room.gameState.phase !== 'playing') return;
      const gs = room.gameState;
      if (gs.locks.has('ending')) return;
      gs.locks.add('ending');

      gs.phase = 'ending';
      gs.ending = 'FORGOTTEN';
      room.status = 'ended';
      const payload: EndingPayload = {
        ending: 'FORGOTTEN',
        title: 'ENDING 2 — FORGOTTEN',
        subtitle: 'SWALLOWED BY 03:33',
        text: 'The lights died permanently. Footsteps echoed from every corner of the endless corridor until even your friends’ voices turned into static. The hotel erased your names from the guestbook — you were never supposed to return.',
        progression: getProgressionSummary(gs),
      };
      io.to(room.code).emit('game:ending', payload);
    });

    socket.on('game:chat_ping', ({ text }) => {
      const room = getRoomBySocket(socket.id);
      if (!room) return;
      const player = room.players.get(socket.id);
      if (!player) return;
      const clean = String(text || '').trim().slice(0, 120);
      if (!clean) return;
      io.to(room.code).emit('game:chat_msg', {
        sender: player.name,
        text: clean,
      });
    });

    socket.on('disconnect', () => {
      const info = handleDisconnect(socket.id);
      if (info && info.room && info.code) {
        io.to(info.code).emit('room:lobby_update', getLobbySnapshot(info.room));
        if (info.player && info.room.status === 'playing') {
          io.to(info.code).emit(
            'game:system_msg',
            `${info.player.name} lost connection (45s reconnect window)...`
          );
        }
      }
    });
  });

  const shadowNodes = [
    { x: 0, y: 0, z: -38 },
    { x: 0, y: 0, z: -18 },
    { x: -8, y: 0, z: -16 },
    { x: 8, y: 0, z: -26 },
    { x: 10, y: -4.5, z: -12 },
    { x: 0, y: -9.0, z: -64 },
    { x: -8, y: -9.0, z: -70 },
  ];

  setInterval(() => {
    const updatedRooms = cleanupExpiredPlayers();
    updatedRooms.forEach((r) => io.to(r.code).emit('room:lobby_update', getLobbySnapshot(r)));

    for (const room of rooms.values()) {
      if (room.status !== 'playing' || !room.gameState || room.gameState.phase !== 'playing') {
        continue;
      }
      const gs = room.gameState;
      const players = Array.from(room.players.values()).filter((p) => p.connected);
      if (players.length === 0) continue;

      gs.monsters.shadow.teleportCooldown -= 1;
      if (gs.monsters.shadow.teleportCooldown <= 0) {
        const p = players[Math.floor(Math.random() * players.length)];
        const sameFloorNodes = shadowNodes.filter((n) => Math.abs(n.y - (p.pos.y - 1.7)) < 2.5);
        const pool = sameFloorNodes.length ? sameFloorNodes : shadowNodes;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        gs.monsters.shadow.pos = { ...chosen };
        gs.monsters.shadow.targetPlayerId = p.id;
        gs.monsters.shadow.teleportCooldown = 12 + Math.floor(Math.random() * 10);
      }

      const mimicTarget = players[Math.floor(Math.random() * players.length)];
      gs.monsters.double.mimicPlayerId = mimicTarget.id;
      const angle = (Date.now() * 0.0005) % (Math.PI * 2);
      gs.monsters.double.pos = {
        x: Math.sin(angle) * 2.1,
        y: gs.progression.floor0Unlocked ? -9.0 : 0.0,
        z: gs.progression.floor0Unlocked
          ? -62 + Math.cos(angle) * 6
          : -24 + Math.cos(angle) * 8,
      };
      gs.monsters.double.rotY = angle + Math.PI;

      if (Math.random() < 0.08) {
        gs.monsters.watcher.realityOnly = Math.floor(Math.random() * 3);
        const rp = players[Math.floor(Math.random() * players.length)];
        gs.monsters.watcher.pos = {
          x: rp.pos.x + (Math.random() > 0.5 ? 5 : -5),
          y: Math.max(-9, rp.pos.y - 1.7),
          z: rp.pos.z - 5,
        };
      }

      io.to(room.code).emit('game:monsters_sync', gs.monsters);
    }
  }, 1200);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`ROOM 0 server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ROOM 0 server:', err);
  process.exit(1);
});
