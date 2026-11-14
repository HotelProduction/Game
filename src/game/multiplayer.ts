import { io, type Socket } from 'socket.io-client';
import type {
  DoorState,
  EndingPayload,
  GameStartedPayload,
  MonstersState,
  ProgressionStep,
  RoomLobbySnapshot,
  Vec3,
  WorldItem,
} from '../shared/types';

export type ServerEventMap = {
  'room:lobby_update': RoomLobbySnapshot;
  'game:started': GameStartedPayload;
  'player:moved': {
    id: string;
    pos: Vec3;
    rotY: number;
    rotX: number;
    crouching: boolean;
    flashlight: boolean;
    inRoom0: boolean;
  };
  'game:item_collected': {
    itemId: string;
    item: WorldItem;
    byPlayerId: string;
    byPlayerName: string;
    sharedInventory: { keys: string[]; notes: number[]; hasReliquary: boolean };
    progression: ProgressionStep[];
  };
  'game:door_updated': {
    doorId: string;
    door: DoorState;
    progression: ProgressionStep[];
  };
  'game:breaker_updated': {
    breakers: Record<'A' | 'B' | 'C', boolean>;
    generatorOnline: boolean;
    reset: boolean;
    message?: string;
    progression: ProgressionStep[];
  };
  'game:elevator_moving': { from: number; to: number };
  'game:elevator_arrived': { floor: number; progression: ProgressionStep[] };
  'game:paintings_updated': {
    paintings: number[];
    solved: boolean;
    reliquaryItem: WorldItem | null;
  };
  'game:keypad_solved': {
    doors: Record<string, DoorState>;
    progression: ProgressionStep[];
  };
  'game:final_switches_updated': {
    finalSwitches: Record<string, boolean>;
    activatedCount: number;
    requiredCount: number;
  };
  'game:ending': EndingPayload;
  'game:monsters_sync': MonstersState;
  'game:chat_msg': { sender: string; text: string };
  'game:system_msg': string;
};

type Handler<T> = (payload: T) => void;

export class MultiplayerClient {
  public socket: Socket;
  public selfId: string | null = null;
  public roomCode: string | null = null;
  public token: string | null = sessionStorage.getItem('room0_token');
  private handlers = new Map<string, Array<Handler<unknown>>>();

  constructor() {
    this.socket = io({ transports: ['websocket', 'polling'] });
    this.bindCoreEvents();
  }

  on<K extends keyof ServerEventMap>(event: K, fn: Handler<ServerEventMap[K]>): () => void {
    const list = this.handlers.get(event) || [];
    list.push(fn as Handler<unknown>);
    this.handlers.set(event, list);
    return () => {
      const cur = this.handlers.get(event) || [];
      this.handlers.set(
        event,
        cur.filter((h) => h !== fn)
      );
    };
  }

  private emitLocal(event: string, payload: unknown): void {
    const list = this.handlers.get(event) || [];
    list.forEach((fn) => fn(payload));
  }

  private bindCoreEvents(): void {
    const events: Array<keyof ServerEventMap> = [
      'room:lobby_update',
      'game:started',
      'player:moved',
      'game:item_collected',
      'game:door_updated',
      'game:breaker_updated',
      'game:elevator_moving',
      'game:elevator_arrived',
      'game:paintings_updated',
      'game:keypad_solved',
      'game:final_switches_updated',
      'game:ending',
      'game:monsters_sync',
      'game:chat_msg',
      'game:system_msg',
    ];
    events.forEach((ev) => {
      this.socket.on(ev, (data: unknown) => this.emitLocal(ev, data));
    });

    this.socket.on('connect', () => {
      const savedCode = sessionStorage.getItem('room0_code');
      const savedName = sessionStorage.getItem('room0_name');
      const savedToken = sessionStorage.getItem('room0_token');
      if (savedCode && savedToken && this.roomCode === savedCode) {
        this.joinRoom(savedCode, savedName || 'Guest', savedToken).catch(() => {});
      }
    });
  }

  createRoom(
    name: string,
    soloAllowed = false
  ): Promise<{
    ok: boolean;
    code: string;
    token: string;
    selfId: string;
    lobby: RoomLobbySnapshot;
  }> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'room:create',
        { name, soloAllowed },
        (res: {
          ok: boolean;
          code: string;
          token: string;
          selfId: string;
          lobby: RoomLobbySnapshot;
          error?: string;
        }) => {
          if (res && res.ok) {
            this.selfId = res.selfId;
            this.roomCode = res.code;
            this.token = res.token;
            sessionStorage.setItem('room0_code', res.code);
            sessionStorage.setItem('room0_token', res.token);
            sessionStorage.setItem('room0_name', name);
            resolve(res);
          } else {
            reject(new Error(res?.error || 'Failed to create room.'));
          }
        }
      );
    });
  }

  joinRoom(
    code: string,
    name: string,
    token: string | null = null
  ): Promise<{
    ok: boolean;
    code: string;
    token: string;
    selfId: string;
    reconnected: boolean;
    status: string;
    lobby: RoomLobbySnapshot;
  }> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'room:join',
        { code, name, token },
        (res: {
          ok: boolean;
          code: string;
          token: string;
          selfId: string;
          reconnected: boolean;
          status: string;
          lobby: RoomLobbySnapshot;
          error?: string;
        }) => {
          if (res && res.ok) {
            this.selfId = res.selfId;
            this.roomCode = res.code;
            this.token = res.token;
            sessionStorage.setItem('room0_code', res.code);
            sessionStorage.setItem('room0_token', res.token);
            sessionStorage.setItem('room0_name', name);
            resolve(res);
          } else {
            reject(new Error(res?.error || 'Failed to join room.'));
          }
        }
      );
    });
  }

  toggleReady(): void {
    this.socket.emit('room:ready');
  }

  startGame(): Promise<{ ok: boolean }> {
    return new Promise((resolve, reject) => {
      this.socket.emit('room:start', (res: { ok: boolean; error?: string }) => {
        if (res && res.ok) resolve(res);
        else reject(new Error(res?.error || 'Cannot start game'));
      });
    });
  }

  sendPlayerUpdate(state: {
    pos: Vec3;
    rotY: number;
    rotX: number;
    crouching: boolean;
    flashlight: boolean;
  }): void {
    this.socket.emit('player:update', state);
  }

  pickupItem(itemId: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('game:pickup_item', { itemId }, resolve);
    });
  }

  toggleDoor(doorId: string): Promise<{ ok: boolean; reason?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('game:toggle_door', { doorId }, resolve);
    });
  }

  toggleBreaker(breakerId: 'A' | 'B' | 'C'): Promise<{ ok: boolean; reset?: boolean }> {
    return new Promise((resolve) => {
      this.socket.emit('game:toggle_breaker', { breakerId }, resolve);
    });
  }

  useElevator(): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('game:use_elevator', resolve);
    });
  }

  rotatePainting(index: number): Promise<{ ok: boolean; solved: boolean }> {
    return new Promise((resolve) => {
      this.socket.emit('game:rotate_painting', { index }, resolve);
    });
  }

  submitKeypad(code: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('game:submit_keypad', { code }, resolve);
    });
  }

  room0Action(
    action: 'toggle_switch' | 'truth_altar' | 'seal_sacrifice'
  ): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('game:room0_action', { action }, resolve);
    });
  }

  triggerCurseSuccumb(): void {
    this.socket.emit('game:curse_succumb');
  }

  sendChat(text: string): void {
    this.socket.emit('game:chat_ping', { text });
  }

  clearSession(): void {
    this.roomCode = null;
    sessionStorage.removeItem('room0_code');
    sessionStorage.removeItem('room0_token');
  }

  dispose(): void {
    this.socket.disconnect();
  }
}
