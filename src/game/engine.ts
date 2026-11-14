import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {
  EndingPayload,
  GameSettings,
  GameStartedPayload,
  ProgressionStep,
  PublicGameState,
  PublicPlayer,
  RealityClue,
} from '../shared/types';
import type { MultiplayerClient } from './multiplayer';
import { MonsterSystem } from './monsters';
import { PlayerController } from './player';
import { RealitySystem } from './reality';
import type { SoundEngine } from './sound';
import { createHotelTextures, type HotelTextures } from './textures';
import { HotelWorld, type InteractableTarget } from './world';

export interface InventorySlot {
  id: string;
  label: string;
  key: string;
}

export interface HudSnapshot {
  zone: string;
  battery: number;
  fear: number;
  stamina: number;
  flashlightOn: boolean;
  realityIndex: number;
  soloMode: boolean;
  interactLabel: string | null;
  slots: InventorySlot[];
  selectedSlot: number;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onTasksUpdate: (tasks: ProgressionStep[]) => void;
  onPlayersUpdate: (players: PublicPlayer[]) => void;
  onToast: (msg: string) => void;
  onOpenKeypad: () => void;
  onOpenDocument: (title: string, text: string) => void;
  onOpenMap: (zone: string) => void;
  onPauseRequest: () => void;
  onToggleChat: () => void;
  onCameraFlash: () => void;
  onEnding: (data: EndingPayload) => void;
  onGameStarted: () => void;
}

function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class Room0Engine {
  public readonly isSoftwareGl: boolean;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public textures: HotelTextures;
  public world: HotelWorld;
  public reality: RealitySystem;
  public monsters: MonsterSystem;
  public player: PlayerController;

  private mp: MultiplayerClient;
  private sound: SoundEngine;
  private callbacks: EngineCallbacks;

  public mode: 'title' | 'playing' | 'paused' | 'ended' = 'title';
  private selfId: string | null = null;
  private gameState: PublicGameState | null = null;
  private allRealityClues: Record<number, RealityClue> | null = null;
  private assignedRealityId = 0;
  private assignedClue: RealityClue | undefined;

  // Inventory state
  private battery = 100;
  private batteryPacks = 0;
  private hasRadio = false;
  private hasCamera = false;
  private hasMap = false;
  private keys: string[] = [];
  private notes: number[] = [];
  private hasReliquary = false;
  private selectedSlot = 0;
  private cameraCooldown = 0;

  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private netSyncAccum = 0;
  private hudSyncAccum = 0;
  private resizeObserver: ResizeObserver;
  private container: HTMLElement;
  private unsubscribers: Array<() => void> = [];

  constructor(
    container: HTMLElement,
    mp: MultiplayerClient,
    sound: SoundEngine,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.mp = mp;
    this.sound = sound;
    this.callbacks = callbacks;

    this.isSoftwareGl = detectSoftwareGl();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('data-testid', 'game-canvas');
    container.appendChild(this.renderer.domElement);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.FogExp2(0x050508, 0.052);

    this.camera = new THREE.PerspectiveCamera(74, width / height, 0.1, 80);
    this.renderer.setSize(width, height, false);

    // Studio PBR environment reflection
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const envScene = new RoomEnvironment();
    this.scene.environment = pmremGenerator.fromScene(envScene, 0.04).texture;
    envScene.dispose();
    pmremGenerator.dispose();

    // Cool sky/ground hemisphere fill contrasting with warm corridor tungsten lights
    const hemi = new THREE.HemisphereLight(0x3a4a66, 0x1a120f, 0.7);
    this.scene.add(hemi);

    const maxAniso = this.isSoftwareGl
      ? 1
      : this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createHotelTextures(maxAniso);
    this.world = new HotelWorld(this.scene, this.textures);
    this.reality = new RealitySystem(this.scene, this.textures);
    this.monsters = new MonsterSystem(this.scene, this.sound, this.textures);
    this.player = new PlayerController(
      this.camera,
      this.scene,
      this.world,
      this.sound,
      this.textures
    );

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindNetworkEvents();
    this.bindCanvasEvents();

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    this.startLoop();
  }

  private onResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  applySettings(settings: GameSettings): void {
    this.player.sensitivity = settings.sensitivity;
    this.sound.setVolumes({
      master: settings.masterVol,
      music: settings.musicVol,
      sfx: settings.sfxVol,
    });
    this.sound.setMuted(settings.muted);
    if (!this.isSoftwareGl) {
      const dpr = Math.min(window.devicePixelRatio, 2) * settings.resScale;
      this.renderer.setPixelRatio(dpr);
      this.renderer.shadowMap.enabled = settings.quality === 'high';
    }
    this.scene.fog = new THREE.FogExp2(
      0x050508,
      settings.quality === 'low' ? 0.068 : 0.052
    );
  }

  private bindCanvasEvents(): void {
    const canvas = this.renderer.domElement;

    const onClick = () => {
      this.sound.init();
      if (this.mode === 'playing') {
        try {
          canvas.requestPointerLock?.();
        } catch {
          // Ignore pointer lock rejection in automated browsers
        }
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (this.mode === 'playing' && e.button === 0) {
        this.player.setDragLooking(true);
      }
    };
    const onMouseUp = () => {
      this.player.setDragLooking(false);
    };
    const onPointerLockChange = () => {
      this.player.isLocked = document.pointerLockElement === canvas;
    };

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    this.unsubscribers.push(() => {
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    });
  }

  private bindNetworkEvents(): void {
    this.unsubscribers.push(
      this.mp.on('game:started', (payload: GameStartedPayload) => {
        const { selfId, realityId, realityClue, allRealityClues, state } = payload;
        this.selfId = selfId;
        this.gameState = state;
        this.assignedRealityId = realityId;
        this.assignedClue = realityClue;
        this.allRealityClues = allRealityClues || null;
        this.mode = 'playing';

        this.battery = 100;
        this.batteryPacks = 0;
        this.hasRadio = false;
        this.hasCamera = false;
        this.hasMap = false;
        this.keys = [];
        this.notes = [];
        this.hasReliquary = false;
        this.selectedSlot = 0;
        this.cameraCooldown = 0;

        this.reality.buildForReality(realityId, realityClue);
        this.world.spawnWorldItems(state.items);
        Object.entries(state.doors).forEach(([id, d]) =>
          this.world.updateDoorVisual(id, d)
        );
        this.world.updateBreakersVisual(state.puzzles.breakers);
        this.world.updatePaintingsVisual(state.puzzles.paintings);
        this.world.setElevatorTarget(state.elevator.floor);

        // Spawn on open Reception floor facing -Z (down the lit corridor toward Hallway)
        this.player.pos.set(0, 1.7, 4.2);
        this.player.yaw = 0;
        this.player.pitch = 0;
        this.camera.position.copy(this.player.pos);
        this.camera.rotation.set(0, 0, 0);
        this.player.fear = 0;
        this.player.flashlightOn = true;
        this.player.clearInputs();
        this.player.syncRemotePlayers(state.players, selfId);

        this.callbacks.onGameStarted();
        this.callbacks.onTasksUpdate(state.progression);
        this.callbacks.onPlayersUpdate(state.players);
        this.emitHudSnapshot(true);

        const realityMsg = state.soloMode
          ? `Entered ROOM 0 (Solo Mode · Press [R] to shift Reality Layer ${realityId + 1}/3).`
          : `Entered ROOM 0 (Reality Layer #${realityId + 1}). Click viewport to lock mouse!`;
        this.callbacks.onToast(realityMsg);
      }),

      this.mp.on('player:moved', (data) => {
        this.player.applyRemoteMove(data);
      }),

      this.mp.on('game:item_collected', ({ itemId, item, byPlayerId, byPlayerName, sharedInventory, progression }) => {
        this.world.removeItem(itemId);
        this.keys = [...(sharedInventory.keys || [])];
        this.notes = [...(sharedInventory.notes || [])];
        this.hasReliquary = Boolean(sharedInventory.hasReliquary);

        if (byPlayerId === this.selfId) {
          if (item.type === 'battery') this.batteryPacks += 1;
          if (item.type === 'radio') this.hasRadio = true;
          if (item.type === 'camera') this.hasCamera = true;
          if (item.type === 'map') this.hasMap = true;
        }
        this.sound.playPickup();
        this.callbacks.onTasksUpdate(progression);
        this.callbacks.onToast(`${byPlayerName} collected ${item.name}`);
        this.emitHudSnapshot(true);
      }),

      this.mp.on('game:door_updated', ({ doorId, door, progression }) => {
        this.world.updateDoorVisual(doorId, door);
        this.sound.playDoorCreak();
        this.callbacks.onTasksUpdate(progression);
      }),

      this.mp.on('game:breaker_updated', ({ breakers, generatorOnline, reset, message, progression }) => {
        this.world.updateBreakersVisual(breakers);
        this.sound.playClick();
        if (reset && message) this.callbacks.onToast(message);
        if (generatorOnline) {
          this.callbacks.onToast('BASEMENT GENERATOR ONLINE! Elevator powered.');
          this.callbacks.onTasksUpdate(progression);
        }
      }),

      this.mp.on('game:elevator_moving', ({ to }) => {
        this.world.setElevatorTarget(to);
        this.callbacks.onToast(`Elevator moving to Floor ${to}...`);
      }),

      this.mp.on('game:elevator_arrived', ({ floor, progression }) => {
        this.callbacks.onToast(`Elevator arrived at Floor ${floor}.`);
        this.callbacks.onTasksUpdate(progression);
      }),

      this.mp.on('game:paintings_updated', ({ paintings, solved, reliquaryItem }) => {
        this.world.updatePaintingsVisual(paintings);
        this.sound.playClick();
        if (solved && reliquaryItem && this.gameState) {
          this.gameState.items.truth_reliquary = reliquaryItem;
          this.world.spawnWorldItems(this.gameState.items);
          this.callbacks.onToast('PAINTINGS ALIGNED! Truth Reliquary appeared in Bedroom 103.');
        }
      }),

      this.mp.on('game:keypad_solved', ({ doors, progression }) => {
        Object.entries(doors).forEach(([id, d]) => this.world.updateDoorVisual(id, d));
        this.sound.playDoorCreak();
        this.callbacks.onTasksUpdate(progression);
        this.callbacks.onToast('ROOM 0 VAULT UNLOCKED!');
      }),

      this.mp.on('game:final_switches_updated', ({ activatedCount, requiredCount }) => {
        this.sound.playClick();
        this.callbacks.onToast(`Room 0 Escape Switches: ${activatedCount} / ${requiredCount}`);
      }),

      this.mp.on('game:monsters_sync', (m) => {
        this.monsters.syncFromServer(m);
      }),

      this.mp.on('game:chat_msg', ({ sender, text }) => {
        this.callbacks.onToast(`[${sender}]: ${text}`);
      }),

      this.mp.on('game:system_msg', (msg) => {
        this.callbacks.onToast(msg);
      }),

      this.mp.on('game:ending', (data) => {
        this.mode = 'ended';
        document.exitPointerLock?.();
        this.player.clearInputs();
        this.callbacks.onEnding(data);
      })
    );
  }

  getInventorySlots(): InventorySlot[] {
    const list: InventorySlot[] = [{ id: 'flashlight', label: 'Flashlight', key: '1' }];
    if (this.batteryPacks > 0)
      list.push({ id: 'battery', label: `Battery x${this.batteryPacks}`, key: String(list.length + 1) });
    if (this.keys.length > 0)
      list.push({ id: 'keys', label: `Keys (${this.keys.length}/3)`, key: String(list.length + 1) });
    if (this.hasRadio)
      list.push({ id: 'radio', label: 'Radio', key: String(list.length + 1) });
    if (this.hasCamera)
      list.push({ id: 'camera', label: 'Camera', key: String(list.length + 1) });
    if (this.notes.length > 0)
      list.push({ id: 'notes', label: `Notes (${this.notes.length}/4)`, key: String(list.length + 1) });
    if (this.hasMap)
      list.push({ id: 'map', label: 'Hotel Map', key: 'M' });
    return list;
  }

  toggleFlashlight(): void {
    if (this.battery <= 0) {
      this.player.flashlightOn = false;
      this.callbacks.onToast('Flashlight battery depleted! Find Batteries.');
      return;
    }
    this.player.flashlightOn = !this.player.flashlightOn;
    this.sound.playClick();
    this.emitHudSnapshot(true);
  }

  useSlot(slotIndex: number): void {
    const slots = this.getInventorySlots();
    const slot = slots[slotIndex];
    if (!slot) return;
    this.selectedSlot = slotIndex;

    if (slot.id === 'flashlight') {
      this.toggleFlashlight();
    } else if (slot.id === 'battery') {
      if (this.batteryPacks > 0) {
        this.batteryPacks -= 1;
        this.battery = 100;
        this.player.flashlightOn = true;
        this.sound.playPickup();
        this.callbacks.onToast('Battery replaced (100%).');
      }
    } else if (slot.id === 'radio' && this.gameState) {
      this.sound.playRadioClue(this.gameState.breakerSequence);
      this.callbacks.onToast(
        `Radio (${this.gameState.radioFrequency} MHz): "Breaker order: ${this.gameState.breakerSequence.join(' → ')}"`
      );
    } else if (slot.id === 'camera') {
      if (this.cameraCooldown > 0) {
        this.callbacks.onToast('Camera flash recharging...');
        return;
      }
      this.cameraCooldown = 4.0;
      this.sound.playCameraShutter();
      this.callbacks.onCameraFlash();
      this.monsters.stunShadow();
      this.callbacks.onToast(`Photo captured in Reality #${this.reality.realityId + 1}!`);
    } else if (slot.id === 'notes') {
      this.openNotesDocument();
    } else if (slot.id === 'map') {
      this.callbacks.onOpenMap(this.world.getZoneName(this.player.pos));
    }
    this.emitHudSnapshot(true);
  }

  openNotesDocument(): void {
    const texts: Record<number, string> = {
      1: 'FRAGMENT 1/4 (1973 Ledger):\n"The fire started in the boiler room at 03:33. Manager Vance chained the lobby exit so no one could blame the hotel."',
      2: 'FRAGMENT 2/4 (Maid Diary):\n"Twelve guests ran down to Room 0 thinking it was a shelter. None of us had the master key."',
      3: 'FRAGMENT 3/4 (Inspector Note):\n"The floor plan lies. Three survivors see three fractured halves of the truth. Speak together to unlock the vault."',
      4: 'FRAGMENT 4/4 (Final Epitaph):\n"Place the Truth Reliquary from Bedroom 103 upon the Altar in Room 0 to break 03:33 forever."',
    };
    const owned = [...this.notes]
      .sort((a, b) => a - b)
      .map((n) => texts[n] || `Fragment ${n}`);
    const content = owned.length
      ? owned.join('\n\n────────────────────────\n\n')
      : 'No Note Fragments collected yet.';
    this.callbacks.onOpenDocument(`COLLECTED NOTES (${this.notes.length}/4)`, content);
  }

  async interactWithTarget(target: InteractableTarget): Promise<void> {
    if (target.type === 'item' && target.itemId) {
      const res = await this.mp.pickupItem(target.itemId);
      if (!res.ok && res.error) this.callbacks.onToast(res.error);
    } else if (target.type === 'door' && target.doorId) {
      const res = await this.mp.toggleDoor(target.doorId);
      if (!res.ok && res.reason) this.callbacks.onToast(res.reason);
    } else if (target.type === 'breaker' && target.breakerId) {
      await this.mp.toggleBreaker(target.breakerId);
    } else if (target.type === 'elevator') {
      const res = await this.mp.useElevator();
      if (!res.ok && res.error) this.callbacks.onToast(res.error);
    } else if (target.type === 'painting' && target.index !== undefined) {
      await this.mp.rotatePainting(target.index);
    } else if (target.type === 'keypad') {
      document.exitPointerLock?.();
      this.callbacks.onOpenKeypad();
    } else if (target.type === 'room0_action' && target.action) {
      const res = await this.mp.room0Action(target.action);
      if (!res.ok && res.error) this.callbacks.onToast(res.error);
    }
  }

  setMode(newMode: 'title' | 'playing' | 'paused' | 'ended'): void {
    this.mode = newMode;
    if (newMode !== 'playing') {
      this.player.clearInputs();
      document.exitPointerLock?.();
    }
    if (newMode === 'paused') {
      this.sound.pauseLoops();
    } else if (newMode === 'playing') {
      this.sound.resumeLoops();
    }
  }

  requestPointerLock(): void {
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Ignore in headless environments
    }
  }

  private emitHudSnapshot(force = false): void {
    if (!force && this.hudSyncAccum < 0.1) return;
    this.hudSyncAccum = 0;
    const nearest = this.mode === 'playing' ? this.player.getNearestInteractable() : null;
    this.callbacks.onHudUpdate({
      zone: this.world.getZoneName(this.player.pos),
      battery: Math.round(this.battery),
      fear: Math.round(this.player.fear),
      stamina: Math.round(this.player.stamina),
      flashlightOn: this.player.flashlightOn,
      realityIndex: this.reality.realityId + 1,
      soloMode: Boolean(this.gameState?.soloMode),
      interactLabel: nearest ? nearest.label : null,
      slots: this.getInventorySlots(),
      selectedSlot: this.selectedSlot,
    });
  }

  private handleGameplayEdgeKeys(): void {
    if (this.mode !== 'playing') return;
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

    if (this.player.consumeJustPressed('Escape') || this.player.consumeJustPressed('KeyP')) {
      this.setMode('paused');
      this.callbacks.onPauseRequest();
      return;
    }
    if (this.player.consumeJustPressed('KeyT')) {
      this.player.clearInputs();
      document.exitPointerLock?.();
      this.callbacks.onToggleChat();
      return;
    }
    if (this.player.consumeJustPressed('KeyF')) {
      this.toggleFlashlight();
    }
    if (this.player.consumeJustPressed('KeyM')) {
      if (this.hasMap) {
        document.exitPointerLock?.();
        this.callbacks.onOpenMap(this.world.getZoneName(this.player.pos));
      } else {
        this.callbacks.onToast('Find the Hotel Map on the Reception desk first.');
      }
    }
    if (this.player.consumeJustPressed('KeyR') && this.gameState?.soloMode && this.allRealityClues) {
      const nextId = (this.reality.realityId + 1) % 3;
      this.reality.buildForReality(nextId, this.allRealityClues[nextId]);
      this.sound.playClick();
      this.callbacks.onToast(`Reality Lens shifted to Layer #${nextId + 1}`);
      this.emitHudSnapshot(true);
    }
    if (this.player.consumeJustPressed('KeyE')) {
      const target = this.player.getNearestInteractable();
      if (target) {
        void this.interactWithTarget(target);
      }
    }
    for (let i = 1; i <= 6; i++) {
      if (this.player.consumeJustPressed(`Digit${i}`)) {
        this.useSlot(i - 1);
      }
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      const totalDt = Math.min(rawDt, 0.2);
      const dt = Math.min(totalDt, 0.05);
      this.lastTime = now;
      const timeSec = now / 1000;

      this.world.update(dt, timeSec);

      if (this.mode === 'title' || this.mode === 'ended') {
        // Atmospheric slow live camera tour along Reception & Endless Hallway
        this.camera.position.set(
          Math.sin(timeSec * 0.32) * 0.45,
          1.68,
          -11 + Math.sin(timeSec * 0.14) * 5
        );
        this.camera.rotation.set(0, Math.sin(timeSec * 0.18) * 0.1, 0);
        this.player.flashlight.intensity = 2.2;
      } else if (this.mode === 'playing') {
        this.handleGameplayEdgeKeys();

        if (this.cameraCooldown > 0) {
          this.cameraCooldown = Math.max(0, this.cameraCooldown - totalDt);
        }
        if (this.player.flashlightOn) {
          this.battery = Math.max(0, this.battery - totalDt * 1.1);
          if (this.battery <= 0) {
            this.player.flashlightOn = false;
            this.callbacks.onToast('Flashlight died!');
          }
        }

        const activeTag = document.activeElement?.tagName;
        const canMove = activeTag !== 'INPUT' && activeTag !== 'TEXTAREA';

        let rem = totalDt;
        let camDir = this.player.update(0, timeSec, 0, false);
        while (rem > 0.0001) {
          const stepDt = Math.min(rem, 0.05);
          camDir = this.player.update(stepDt, timeSec, 0, canMove);
          rem -= stepDt;
        }
        const monsterFear = this.monsters.update(
          totalDt,
          timeSec,
          this.player.pos,
          camDir,
          this.reality.realityId
        );
        if (monsterFear > 0) {
          this.player.fear = Math.min(100, this.player.fear + monsterFear);
        }

        this.reality.update(dt, timeSec, this.player.fear);
        this.sound.updateAmbientHorror(now, this.player.fear);

        if (this.player.fear >= 99.8) {
          this.mp.triggerCurseSuccumb();
        }

        this.hudSyncAccum += dt;
        this.emitHudSnapshot(false);

        this.netSyncAccum += dt;
        if (this.netSyncAccum > 0.05) {
          this.netSyncAccum = 0;
          this.mp.sendPlayerUpdate({
            pos: {
              x: this.player.pos.x,
              y: this.player.pos.y,
              z: this.player.pos.z,
            },
            rotY: this.player.yaw,
            rotX: this.player.pitch,
            crouching: this.player.crouching,
            flashlight: this.player.flashlightOn,
          });
        }
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.unsubscribers.forEach((u) => u());
    this.player.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
