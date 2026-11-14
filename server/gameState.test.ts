import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rooms,
  createRoom,
  joinRoom,
  toggleReady,
  canStartGame,
  startGame,
  handleDisconnect,
} from './rooms';
import {
  getProgressionSummary,
  pickupItemAction,
  toggleBreakerAction,
  toggleDoorAction,
  rotatePaintingAction,
  submitKeypadAction,
} from './gameState';

test('room lifecycle: create, validate code, join 2-3 players, reject 4th, ready/host gating', () => {
  rooms.clear();

  const { room, player: host } = createRoom('sock1', 'Alex');
  assert.equal(room.code.length, 6);
  assert.equal(host.isHost, true);

  const badJoin = joinRoom('123', 'sock2', 'Sam');
  assert.ok('error' in badJoin);

  const j2 = joinRoom(room.code, 'sock2', 'Sam');
  assert.ok(!('error' in j2));
  const j3 = joinRoom(room.code, 'sock3', 'Mia');
  assert.ok(!('error' in j3));

  const j4 = joinRoom(room.code, 'sock4', 'Extra');
  assert.ok('error' in j4);

  // Host cannot start until players are ready
  assert.equal(canStartGame(room, 'sock1').ok, false);

  toggleReady(room, 'sock2');
  toggleReady(room, 'sock3');
  assert.equal(canStartGame(room, 'sock1').ok, true);

  // Non-host cannot start
  assert.equal(canStartGame(room, 'sock2').ok, false);

  const gs = startGame(room);
  assert.equal(gs.realities.sock1, 0);
  assert.equal(gs.realities.sock2, 1);
  assert.equal(gs.realities.sock3, 2);
  assert.equal(gs.keypadCode.length, 4);
  assert.equal(getProgressionSummary(gs).length, 7);

  // Reconnect preserves token and reality assignment
  handleDisconnect('sock2');
  const reconn = joinRoom(room.code, 'sock2_new', 'Sam', j2.player.token);
  assert.ok(!('error' in reconn));
  assert.equal(reconn.reconnected, true);
  assert.equal(gs.realities.sock2_new, 1);
});

test('solo mode room allows 1-player immediate start', () => {
  rooms.clear();
  const { room } = createRoom('solo1', 'Explorer', { soloAllowed: true });
  assert.equal(canStartGame(room, 'solo1').ok, true);
  const gs = startGame(room);
  assert.equal(gs.soloMode, true);
});

test('puzzles, atomic item pickups, doors, paintings, and keypad code', () => {
  rooms.clear();
  const { room } = createRoom('p1', 'Alex', { soloAllowed: true });
  const gs = startGame(room);

  // Item pickup cannot be collected twice
  const firstPickup = pickupItemAction(gs, 'p1', 'brass_key');
  assert.equal(firstPickup.ok, true);
  const secondPickup = pickupItemAction(gs, 'p1', 'brass_key');
  assert.equal(secondPickup.ok, false);
  assert.equal(gs.progression.keysFound, 1);

  // Door requires key, unlocks once key is found
  const locked103 = toggleDoorAction(gs, 'bedroom_103');
  assert.equal(locked103.ok, false);
  const open102 = toggleDoorAction(gs, 'bedroom_102');
  assert.equal(open102.ok, true);
  assert.equal(gs.doors.bedroom_102.open, true);

  // Generator breaker sequence A -> C -> B; wrong sequence resets
  const wrongB = toggleBreakerAction(gs, 'B');
  assert.equal(wrongB.ok, false);
  assert.equal(wrongB.reset, true);
  assert.equal(gs.puzzles.generatorOnline, false);

  assert.equal(toggleBreakerAction(gs, 'A').ok, true);
  assert.equal(toggleBreakerAction(gs, 'C').ok, true);
  const finalB = toggleBreakerAction(gs, 'B');
  assert.equal(finalB.ok, true);
  assert.equal(finalB.generatorOnline, true);
  assert.equal(gs.progression.generatorStarted, true);

  // Painting alignment puzzle [2, 1, 3] reveals Truth Reliquary
  assert.equal(gs.items.truth_reliquary.hidden, true);
  rotatePaintingAction(gs, 0);
  rotatePaintingAction(gs, 0);
  rotatePaintingAction(gs, 1);
  rotatePaintingAction(gs, 2);
  rotatePaintingAction(gs, 2);
  const p3 = rotatePaintingAction(gs, 2);
  assert.equal(p3.solved, true);
  assert.equal(gs.items.truth_reliquary.hidden, false);

  // Keypad code validation
  const badCode = submitKeypadAction(gs, '0000');
  assert.equal(badCode.ok, false);
  const goodCode = submitKeypadAction(gs, gs.keypadCode);
  assert.equal(goodCode.ok, true);
  assert.equal(gs.progression.codeSolved, true);
  assert.equal(gs.progression.room0Opened, true);
  assert.equal(gs.doors.room0_door.open, true);
});
