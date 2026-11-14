import * as THREE from 'three';
import type { MonstersState } from '../shared/types';
import type { SoundEngine } from './sound';
import type { HotelTextures } from './textures';

const _toShadow = new THREE.Vector3();
const _dirToShadow = new THREE.Vector3();
const _shadowTarget = new THREE.Vector3();
const _doubleTarget = new THREE.Vector3();

/**
 * 3 Composite 3D Monsters with distinct AI/rendering behaviors:
 * 1. THE SHADOW: Tall dark entity, freezes when looked at, creeps when unobserved.
 * 2. THE DOUBLE: Copies a teammate's silhouette, patrols & induces paranoia.
 * 3. THE WATCHER: Appears only in targeted player's reality, spikes fear & whispers.
 */
export class MonsterSystem {
  private scene: THREE.Scene;
  private sound: SoundEngine;
  private textures: HotelTextures;

  private shadowMesh: THREE.Group;
  private doubleMesh: THREE.Group;
  private watcherMesh: THREE.Group;

  private serverState: MonstersState | null = null;
  public shadowLocalPos = new THREE.Vector3(0, 0, -32);
  private lastStingerAt = 0;

  constructor(scene: THREE.Scene, sound: SoundEngine, textures: HotelTextures) {
    this.scene = scene;
    this.sound = sound;
    this.textures = textures;

    this.shadowMesh = this.buildShadowMesh();
    this.doubleMesh = this.buildDoubleMesh();
    this.watcherMesh = this.buildWatcherMesh();

    this.scene.add(this.shadowMesh);
    this.scene.add(this.doubleMesh);
    this.scene.add(this.watcherMesh);
  }

  private addContactShadow(parent: THREE.Group, radius = 0.7): void {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 18),
      new THREE.MeshBasicMaterial({
        map: this.textures.contactShadow,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.015;
    parent.add(disc);
  }

  private buildShadowMesh(): THREE.Group {
    const g = new THREE.Group();
    const cloakMat = new THREE.MeshStandardMaterial({
      color: 0x050508,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0x16161d,
      roughness: 0.55,
      metalness: 0.25,
    });

    // Primary silhouette: elongated ragged torso + shoulders
    const lowerCloak = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.45, 1.55, 10),
      cloakMat
    );
    lowerCloak.position.y = 0.78;
    const upperTorso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.3), cloakMat);
    upperTorso.position.y = 1.78;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 14), ribMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 2.16;

    // Secondary read: hunched limbs + head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 12), cloakMat);
    head.position.set(0, 2.38, 0.05);
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.15, 8), cloakMat);
    armL.position.set(-0.36, 1.55, 0.08);
    armL.rotation.z = 0.12;
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.15, 8), cloakMat);
    armR.position.set(0.36, 1.55, 0.08);
    armR.rotation.z = -0.12;

    // Accent detail: glowing pale eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xebeef8 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), eyeMat);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), eyeMat);
    eyeL.position.set(-0.075, 2.41, 0.24);
    eyeR.position.set(0.075, 2.41, 0.24);

    g.add(lowerCloak, upperTorso, collar, head, armL, armR, eyeL, eyeR);
    this.addContactShadow(g, 0.75);
    return g;
  }

  private buildDoubleMesh(): THREE.Group {
    const g = new THREE.Group();
    const coat = new THREE.MeshStandardMaterial({ color: 0x2c3747, roughness: 0.78 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x16171d, roughness: 0.88 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc2aa97, roughness: 0.65 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x8b6e42, metalness: 0.6, roughness: 0.35 });

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.22), pants);
    legL.position.set(-0.13, 0.39, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.22), pants);
    legR.position.set(0.13, 0.39, 0);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.84, 0.28), coat);
    torso.position.y = 1.18;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.3), trim);
    belt.position.y = 0.82;

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.16), coat);
    armL.position.set(-0.36, 1.18, 0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.16), coat);
    armR.position.set(0.36, 1.18, 0);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 12), skin);
    head.position.y = 1.82;

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a0808 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeMat);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeMat);
    eyeL.position.set(-0.07, 1.84, 0.19);
    eyeR.position.set(0.07, 1.84, 0.19);

    g.add(legL, legR, torso, belt, armL, armR, head, eyeL, eyeR);
    this.addContactShadow(g, 0.6);
    return g;
  }

  private buildWatcherMesh(): THREE.Group {
    const g = new THREE.Group();
    const cloakMat = new THREE.MeshStandardMaterial({
      color: 0x1b090c,
      emissive: 0x3b050a,
      emissiveIntensity: 0.75,
      roughness: 0.85,
      transparent: true,
      opacity: 0.9,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x6b2828,
      metalness: 0.7,
      roughness: 0.25,
    });

    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.46, 2.0, 12), cloakMat);
    cloak.position.y = 1.05;
    const cowl = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 16), cloakMat);
    cowl.position.y = 2.05;
    const sigilRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.025, 8, 24), metalMat);
    sigilRing.position.set(0, 2.05, -0.05);
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff3b3b })
    );
    eye.position.set(0, 2.05, 0.14);

    g.add(cloak, cowl, sigilRing, eye);
    this.addContactShadow(g, 0.65);
    return g;
  }

  syncFromServer(monstersState: MonstersState): void {
    this.serverState = monstersState;
    if (monstersState.shadow) {
      const sp = monstersState.shadow.pos;
      _shadowTarget.set(sp.x, sp.y, sp.z);
      if (this.shadowLocalPos.distanceTo(_shadowTarget) > 7) {
        this.shadowLocalPos.copy(_shadowTarget);
      }
    }
  }

  stunShadow(): void {
    this.shadowLocalPos.z -= 6;
    this.sound.playMonsterStinger();
  }

  update(
    dt: number,
    timeSec: number,
    playerPos: THREE.Vector3,
    cameraDir: THREE.Vector3,
    realityId: number
  ): number {
    let fearGain = 0;

    // 1. THE SHADOW — freezes when looked at, creeps closer when unseen
    _toShadow.subVectors(this.shadowLocalPos, playerPos);
    const distShadow = _toShadow.length();
    const sameFloorShadow = Math.abs(this.shadowLocalPos.y - (playerPos.y - 1.7)) < 2.2;
    _dirToShadow.copy(_toShadow).normalize();
    const lookingAtShadow = cameraDir.dot(_dirToShadow) > 0.68;

    if (sameFloorShadow && distShadow < 26) {
      if (!lookingAtShadow && distShadow > 2.4) {
        this.shadowLocalPos.x -= _dirToShadow.x * 1.45 * dt;
        this.shadowLocalPos.z -= _dirToShadow.z * 1.45 * dt;
      } else if (lookingAtShadow && distShadow < 11) {
        fearGain += dt * 11;
        if (timeSec - this.lastStingerAt > 9) {
          this.lastStingerAt = timeSec;
          this.sound.playMonsterStinger();
        }
      }
    }
    this.shadowMesh.position.copy(this.shadowLocalPos);
    this.shadowMesh.lookAt(playerPos.x, this.shadowLocalPos.y, playerPos.z);

    // 2. THE DOUBLE — mimics teammate movement with eerie twitching
    if (this.serverState?.double) {
      const dp = this.serverState.double.pos;
      _doubleTarget.set(dp.x, dp.y, dp.z);
      this.doubleMesh.position.lerp(_doubleTarget, Math.min(1, dt * 4));
      this.doubleMesh.rotation.y =
        this.serverState.double.rotY + Math.sin(timeSec * 14) * 0.08;
      if (this.doubleMesh.position.distanceTo(playerPos) < 6.5) {
        fearGain += dt * 6;
      }
    }

    // 3. THE WATCHER — only visible in the targeted player's reality
    if (this.serverState?.watcher) {
      const w = this.serverState.watcher;
      this.watcherMesh.visible = w.realityOnly === realityId;
      if (this.watcherMesh.visible) {
        this.watcherMesh.position.set(
          w.pos.x,
          w.pos.y + Math.sin(timeSec * 2) * 0.12,
          w.pos.z
        );
        this.watcherMesh.lookAt(playerPos.x, this.watcherMesh.position.y, playerPos.z);
        if (this.watcherMesh.position.distanceTo(playerPos) < 10) {
          fearGain += dt * 13;
        }
      }
    }

    return fearGain;
  }
}
