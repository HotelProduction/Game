import * as THREE from 'three';
import type { PublicPlayer, Vec3 } from '../shared/types';
import type { SoundEngine } from './sound';
import type { HotelTextures } from './textures';
import type { HotelWorld, InteractableTarget } from './world';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _toObj = new THREE.Vector3();

export class PlayerController {
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private world: HotelWorld;
  private sound: SoundEngine;
  private textures: HotelTextures;

  public pos = new THREE.Vector3(0, 1.7, 4.2);
  public yaw = 0;
  public pitch = 0;
  public sensitivity = 1.0;

  private keysHeld = new Set<string>();
  private justPressed = new Set<string>();
  public isLocked = false;
  private dragLooking = false;
  public crouching = false;
  public flashlightOn = true;
  public stamina = 100;
  public fear = 0;
  private stepTimer = 0;
  private heartbeatTimer = 0;
  private distanceMoved = 0;

  public flashlight: THREE.SpotLight;
  private flashlightTarget: THREE.Object3D;

  private remoteAvatars = new Map<
    string,
    { group: THREE.Group; targetPos: THREE.Vector3; light: THREE.PointLight; rotY: number; name: string }
  >();

  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onBlurBound: () => void;
  private onMouseMoveBound: (e: MouseEvent) => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    world: HotelWorld,
    sound: SoundEngine,
    textures: HotelTextures
  ) {
    this.camera = camera;
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.textures = textures;

    this.flashlight = new THREE.SpotLight(0xfff1d6, 4.2, 28, Math.PI / 5.2, 0.45, 1.3);
    this.flashlightTarget = new THREE.Object3D();
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlightTarget);
    this.flashlight.position.set(0.15, -0.1, 0);
    this.flashlightTarget.position.set(0, 0, -5);
    this.flashlight.target = this.flashlightTarget;

    this.onKeyDownBound = (e: KeyboardEvent) => {
      if (!this.keysHeld.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keysHeld.add(e.code);
    };
    this.onKeyUpBound = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
    };
    this.onBlurBound = () => {
      this.clearInputs();
    };
    this.onMouseMoveBound = (e: MouseEvent) => {
      if (!this.isLocked && !this.dragLooking) return;
      const mult = 0.0021 * this.sensitivity;
      this.yaw -= e.movementX * mult;
      this.pitch -= e.movementY * mult;
      this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
    };

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('blur', this.onBlurBound);
    document.addEventListener('visibilitychange', this.onBlurBound);
    document.addEventListener('mousemove', this.onMouseMoveBound);
  }

  clearInputs(): void {
    this.keysHeld.clear();
    this.justPressed.clear();
    this.dragLooking = false;
  }

  setDragLooking(active: boolean): void {
    this.dragLooking = active;
  }

  consumeJustPressed(code: string): boolean {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }

  private buildSurvivorAvatar(): { group: THREE.Group; light: THREE.PointLight } {
    const g = new THREE.Group();
    const coat = new THREE.MeshStandardMaterial({ color: 0x35475e, roughness: 0.78 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.88 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd1b39e, roughness: 0.62 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc29e4a, metalness: 0.7, roughness: 0.3 });

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.74, 0.2), pants);
    legL.position.set(-0.12, 0.37, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.74, 0.2), pants);
    legR.position.set(0.12, 0.37, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.88, 0.28), coat);
    torso.position.y = 1.15;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.68, 0.16), coat);
    armL.position.set(-0.35, 1.16, 0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.68, 0.16), coat);
    armR.position.set(0.35, 1.16, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 12), skin);
    head.position.y = 1.8;
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 8), brass);
    torch.rotation.x = Math.PI / 2;
    torch.position.set(0.35, 1.0, -0.18);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 16),
      new THREE.MeshBasicMaterial({
        map: this.textures.contactShadow,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.015;

    const light = new THREE.PointLight(0xffe6b3, 1.2, 9);
    light.position.set(0, 1.5, -0.4);
    g.add(legL, legR, torso, armL, armR, head, torch, disc, light);
    return { group: g, light };
  }

  syncRemotePlayers(playersList: PublicPlayer[], selfId: string): void {
    const activeIds = new Set<string>();
    for (const p of playersList) {
      if (p.id === selfId) continue;
      activeIds.add(p.id);
      if (!this.remoteAvatars.has(p.id)) {
        const { group, light } = this.buildSurvivorAvatar();
        this.scene.add(group);
        this.remoteAvatars.set(p.id, {
          group,
          light,
          targetPos: new THREE.Vector3(p.pos.x, p.pos.y - 1.7, p.pos.z),
          rotY: p.rotY || 0,
          name: p.name,
        });
      }
    }
    for (const [id, av] of this.remoteAvatars.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(av.group);
        this.remoteAvatars.delete(id);
      }
    }
  }

  applyRemoteMove(data: {
    id: string;
    pos: Vec3;
    rotY: number;
    crouching: boolean;
    flashlight: boolean;
  }): void {
    const av = this.remoteAvatars.get(data.id);
    if (!av) return;
    const hOffset = data.crouching ? 1.05 : 1.7;
    av.targetPos.set(data.pos.x, data.pos.y - hOffset, data.pos.z);
    av.rotY = data.rotY;
    av.light.intensity = data.flashlight ? 1.2 : 0;
  }

  getNearestInteractable(): InteractableTarget | null {
    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    _dir.set(0, 0, -1).applyEuler(_euler);
    let best: InteractableTarget | null = null;
    let bestScore = Infinity;

    for (const it of this.world.interactables) {
      const dist = this.pos.distanceTo(it.worldPos);
      if (dist > 3.2) continue;
      _toObj.subVectors(it.worldPos, this.pos).normalize();
      const dot = _dir.dot(_toObj);
      if (dot > 0.55 && dist < bestScore) {
        bestScore = dist;
        best = it;
      }
    }
    return best;
  }

  update(dt: number, timeSec: number, monsterFearGain: number, canMove: boolean): THREE.Vector3 {
    this.crouching = this.keysHeld.has('ControlLeft') || this.keysHeld.has('ControlRight');
    const wantSprint =
      (this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight')) &&
      !this.crouching &&
      this.stamina > 5;

    let speed = 3.6;
    if (this.crouching) speed = 2.0;
    else if (wantSprint) {
      speed = 6.1;
      this.stamina = Math.max(0, this.stamina - dt * 22);
    } else {
      this.stamina = Math.min(100, this.stamina + dt * 16);
    }

    _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    _move.set(0, 0, 0);

    if (canMove) {
      if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) _move.add(_forward);
      if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) _move.sub(_forward);
      if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) _move.add(_right);
      if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) _move.sub(_right);
    }

    if (_move.lengthSq() > 0) {
      _move.normalize().multiplyScalar(speed * dt);
      this.pos.x += _move.x;
      this.pos.z += _move.z;
      const stepDist = _move.length();
      this.distanceMoved += stepDist;
      this.stepTimer += dt * (wantSprint ? 2.4 : 1.5);
      if (this.stepTimer > 0.65) {
        this.stepTimer = 0;
        this.sound.playFootstep(wantSprint, false);
      }
    }

    const floorY = this.world.resolveCollision(this.pos);
    const eyeHeight = this.crouching ? 1.05 : 1.7;
    const bob = _move.lengthSq() > 0 ? Math.sin(this.distanceMoved * 3.8) * 0.042 : 0;
    this.pos.y = floorY + eyeHeight + bob;

    this.camera.position.copy(this.pos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.fov = 74 + (this.fear > 65 ? Math.sin(timeSec * 6) * 2.5 : 0);
    this.camera.updateProjectionMatrix();

    this.flashlight.intensity = this.flashlightOn ? 4.2 : 0;

    for (const av of this.remoteAvatars.values()) {
      av.group.position.lerp(av.targetPos, Math.min(1, dt * 10));
      av.group.rotation.y = av.rotY;
    }

    let nearestMateDist = Infinity;
    for (const av of this.remoteAvatars.values()) {
      const d = this.pos.distanceTo(av.group.position);
      if (d < nearestMateDist) nearestMateDist = d;
    }
    const alone = this.remoteAvatars.size > 0 && nearestMateDist > 12;
    let fearDelta = monsterFearGain;
    if (!this.flashlightOn) fearDelta += dt * 3.0;
    if (alone) fearDelta += dt * 2.0;
    if (this.flashlightOn && !alone && monsterFearGain === 0) fearDelta -= dt * 4.0;

    this.fear = Math.max(0, Math.min(100, this.fear + fearDelta));

    this.heartbeatTimer += dt;
    if (this.heartbeatTimer > 1.1) {
      this.heartbeatTimer = 0;
      this.sound.playHeartbeat(this.fear);
    }

    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    _dir.set(0, 0, -1).applyEuler(_euler);
    return _dir;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('blur', this.onBlurBound);
    document.removeEventListener('visibilitychange', this.onBlurBound);
    document.removeEventListener('mousemove', this.onMouseMoveBound);
  }
}
