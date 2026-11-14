import * as THREE from 'three';
import type { DoorState, WorldItem } from '../shared/types';
import type { HotelTextures } from './textures';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface InteractableTarget {
  id: string;
  type: 'door' | 'item' | 'breaker' | 'elevator' | 'painting' | 'keypad' | 'room0_action';
  doorId?: string;
  itemId?: string;
  breakerId?: 'A' | 'B' | 'C';
  index?: number;
  action?: 'toggle_switch' | 'truth_altar' | 'seal_sacrifice';
  mesh: THREE.Object3D;
  worldPos: THREE.Vector3;
  label: string;
}

export class HotelWorld {
  private scene: THREE.Scene;
  private textures: HotelTextures;
  public colliders: ColliderBox[] = [];
  public interactables: InteractableTarget[] = [];
  private doorMeshes: Record<
    string,
    { pivot: THREE.Group; panel: THREE.Mesh; open: boolean; baseRotY: number }
  > = {};
  private flickerLights: Array<{
    light: THREE.PointLight;
    baseIntensity: number;
    phase: number;
  }> = [];
  private itemMeshes: Record<string, THREE.Group> = {};
  private breakerMeshes: Record<string, THREE.Mesh> = {};
  private paintingMeshes: THREE.Group[] = [];
  private elevatorGroup = new THREE.Group();
  public elevatorCurrentY = 0;
  public elevatorTargetY = 0;

  constructor(scene: THREE.Scene, textures: HotelTextures) {
    this.scene = scene;
    this.textures = textures;
    this.buildArchitecture();
  }

  private addBox(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    solid = true
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = solid;
    this.scene.add(mesh);
    if (solid) {
      this.colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: y - h / 2,
        maxY: y + h / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
      });
    }
    return mesh;
  }

  private addLight(
    x: number,
    y: number,
    z: number,
    color = 0xffcfa0,
    intensity = 2.4,
    distance = 18,
    flicker = true
  ): THREE.PointLight {
    const light = new THREE.PointLight(color, intensity, distance, 1.4);
    light.position.set(x, y, z);
    this.scene.add(light);
    if (flicker) {
      this.flickerLights.push({
        light,
        baseIntensity: intensity,
        phase: Math.random() * 100,
      });
    }
    // Emissive sconce globe fixture grounded at ceiling
    const fixture = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 0.14, 12),
      new THREE.MeshStandardMaterial({
        color: 0x3a2d24,
        emissive: color,
        emissiveIntensity: 0.8,
        roughness: 0.4,
      })
    );
    fixture.position.set(x, y + 0.25, z);
    this.scene.add(fixture);
    return light;
  }

  private addDoor(doorId: string, x: number, y: number, z: number, rotY: number, label: string): void {
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.wood,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.02,
      roughness: 0.68,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x22160f,
      roughness: 0.85,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4aa4f,
      metalness: 0.85,
      roughness: 0.22,
    });

    // Door jamb frame (grounded on floor at y)
    const frameGroup = new THREE.Group();
    frameGroup.position.set(x, y, z);
    frameGroup.rotation.y = rotY;
    const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.95, 0.28), frameMat);
    jambL.position.set(-0.07, 1.475, 0);
    const jambR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.95, 0.28), frameMat);
    jambR.position.set(1.87, 1.475, 0);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.18, 0.3), frameMat);
    lintel.position.set(0.9, 2.9, 0);
    frameGroup.add(jambL, jambR, lintel);
    this.scene.add(frameGroup);

    // Hinged door panel pivot
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.rotation.y = rotY;

    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 0.14), woodMat);
    panel.position.set(0.9, 1.4, 0);
    panel.castShadow = true;

    const trimInset = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 2.3, 0.17),
      new THREE.MeshStandardMaterial({ color: 0x331f14, roughness: 0.78 })
    );
    trimInset.position.set(0.9, 1.42, 0);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.18), brassMat);
    plate.position.set(1.6, 1.28, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), brassMat);
    knob.position.set(1.6, 1.28, 0.11);

    pivot.add(panel, trimInset, plate, knob);
    this.scene.add(pivot);

    this.doorMeshes[doorId] = { pivot, panel, open: false, baseRotY: rotY };
    this.interactables.push({
      id: `door_${doorId}`,
      type: 'door',
      doorId,
      mesh: panel,
      worldPos: new THREE.Vector3(
        x + Math.cos(rotY) * 0.9,
        y + 1.4,
        z - Math.sin(rotY) * 0.9
      ),
      label,
    });
  }

  private buildReceptionDesk(x: number, z: number, woodMat: THREE.Material): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 1.3), woodMat);
    body.position.y = 0.5;
    const topMat = new THREE.MeshStandardMaterial({ color: 0x1c1816, roughness: 0.35, metalness: 0.2 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.1, 1.5), topMat);
    counter.position.y = 1.03;
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd6b054, metalness: 0.85, roughness: 0.22 });
    const bellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 12), brassMat);
    bellBase.position.set(-1.3, 1.1, 0.2);
    const bellDome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), brassMat);
    bellDome.position.set(-1.3, 1.12, 0.2);
    const ledger = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.06, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x5c1f1f, roughness: 0.85 })
    );
    ledger.position.set(0.3, 1.11, 0.1);
    ledger.rotation.y = 0.15;

    g.add(body, counter, bellBase, bellDome, ledger);
    this.scene.add(g);
    this.colliders.push({
      minX: x - 2.1,
      maxX: x + 2.1,
      minY: 0,
      maxY: 1.2,
      minZ: z - 0.7,
      maxZ: z + 0.7,
    });
  }

  private buildBed(x: number, z: number, woodMat: THREE.Material): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 1.5), woodMat);
    frame.position.y = 0.22;
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 1.54), woodMat);
    headboard.position.set(-1.05, 0.55, 0);
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 0.28, 1.38),
      new THREE.MeshStandardMaterial({ color: 0xbcb5a6, roughness: 0.92 })
    );
    mattress.position.y = 0.52;
    const blanket = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.3, 1.42),
      new THREE.MeshStandardMaterial({ color: 0x471a1d, roughness: 0.95 })
    );
    blanket.position.set(0.35, 0.54, 0);
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.14, 0.72),
      new THREE.MeshStandardMaterial({ color: 0xd9d2c5, roughness: 0.9 })
    );
    pillow.position.set(-0.72, 0.72, 0);

    g.add(frame, headboard, mattress, blanket, pillow);
    this.scene.add(g);
    this.colliders.push({
      minX: x - 1.1,
      maxX: x + 1.1,
      minY: 0,
      maxY: 1.0,
      minZ: z - 0.75,
      maxZ: z + 0.75,
    });
  }

  private buildWardrobe(x: number, z: number, woodMat: THREE.Material): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.35, 1.75), woodMat);
    body.position.y = 1.175;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 1.85), woodMat);
    crown.position.y = 2.38;
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a349, metalness: 0.85, roughness: 0.25 });
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), brassMat);
    h1.position.set(0.55, 1.2, -0.15);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), brassMat);
    h2.position.set(0.55, 1.2, 0.15);
    g.add(body, crown, h1, h2);
    this.scene.add(g);
    this.colliders.push({
      minX: x - 0.55,
      maxX: x + 0.55,
      minY: 0,
      maxY: 2.4,
      minZ: z - 0.9,
      maxZ: z + 0.9,
    });
  }

  private buildArchitecture(): void {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.wallpaper,
      bumpMap: this.textures.wallpaperBump,
      bumpScale: 0.025,
      roughness: 0.88,
    });
    const carpetMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.carpet,
      bumpMap: this.textures.carpetBump,
      bumpScale: 0.02,
      roughness: 0.92,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.wood,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.02,
      roughness: 0.72,
    });
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.concrete,
      bumpMap: this.textures.concreteBump,
      bumpScale: 0.03,
      roughness: 0.9,
    });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x181518, roughness: 0.95 });

    // ==================== ZONE 1: RECEPTION (x:-8..8, z:-8..8, y:0) ====================
    this.addBox(0, -0.1, 0, 16, 0.2, 16, carpetMat);
    this.addBox(0, 3.6, 0, 16, 0.2, 16, ceilingMat, false);
    this.addBox(0, 1.8, 8, 16, 3.6, 0.4, wallMat);
    const introSign = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 1.8),
      new THREE.MeshBasicMaterial({
        map: this.textures.wallSign(
          'YOU WERE NEVER\nSUPPOSED TO RETURN.',
          '#b52121',
          '#221c18',
          30
        ),
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    introSign.position.set(0, 2.0, 7.75);
    introSign.rotation.y = Math.PI;
    this.scene.add(introSign);

    this.addBox(-8, 1.8, 0, 0.4, 3.6, 16, wallMat);
    this.addBox(8, 1.8, 0, 0.4, 3.6, 16, wallMat);
    this.addBox(-5.5, 1.8, -8, 5, 3.6, 0.4, wallMat);
    this.addBox(5.5, 1.8, -8, 5, 3.6, 0.4, wallMat);

    this.buildReceptionDesk(3.5, -2.5, woodMat);
    this.addLight(0, 3.2, 0, 0xffd299, 2.8, 20, true);

    // ==================== ZONE 2: ENDLESS HALLWAY (x:-3..3, z:-44..-8, y:0) ====================
    this.addBox(0, -0.1, -26, 6, 0.2, 36, carpetMat);
    this.addBox(0, 3.6, -26, 6, 0.2, 36, ceilingMat, false);

    this.addBox(-3, 1.8, -11.5, 0.4, 3.6, 7, wallMat);
    this.addBox(-3, 1.8, -25.5, 0.4, 3.6, 17, wallMat);
    this.addBox(-3, 1.8, -40.5, 0.4, 3.6, 7, wallMat);

    this.addBox(3, 1.8, -10, 0.4, 3.6, 4, wallMat);
    this.addBox(3, 1.8, -19.5, 0.4, 3.6, 9, wallMat);
    this.addBox(3, 1.8, -36, 0.4, 3.6, 16, wallMat);

    this.addLight(0, 3.2, -22, 0xffbe7d, 2.2, 22, true);

    // ==================== ZONE 3: BEDROOMS 101, 102, 103 ====================
    // Bedroom 101 (x:-13..-3, z:-20..-12)
    this.addBox(-8, -0.1, -16, 10, 0.2, 8, woodMat);
    this.addBox(-8, 3.6, -16, 10, 0.2, 8, ceilingMat, false);
    this.addBox(-13, 1.8, -16, 0.4, 3.6, 8, wallMat);
    this.addBox(-8, 1.8, -12, 10, 3.6, 0.4, wallMat);
    this.addBox(-8, 1.8, -20, 10, 3.6, 0.4, wallMat);
    this.buildBed(-10.5, -18, woodMat);
    this.buildWardrobe(-11.8, -14, woodMat);
    this.addDoor('bedroom_101', -3, 0, -17, Math.PI / 2, 'Room 101 Door');

    // Bedroom 102 (x:3..13, z:-30..-22)
    this.addBox(8, -0.1, -26, 10, 0.2, 8, woodMat);
    this.addBox(8, 3.6, -26, 10, 0.2, 8, ceilingMat, false);
    this.addBox(13, 1.8, -26, 0.4, 3.6, 8, wallMat);
    this.addBox(8, 1.8, -22, 10, 3.6, 0.4, wallMat);
    this.addBox(8, 1.8, -30, 10, 3.6, 0.4, wallMat);
    this.buildBed(10.5, -27.5, woodMat);
    this.addDoor('bedroom_102', 3, 0, -25, -Math.PI / 2, 'Room 102 Door [Brass Key]');

    // Bedroom 103 (x:-13..-3, z:-40..-32) + 3-Painting Puzzle
    this.addBox(-8, -0.1, -36, 10, 0.2, 8, woodMat);
    this.addBox(-8, 3.6, -36, 10, 0.2, 8, ceilingMat, false);
    this.addBox(-13, 1.8, -36, 0.4, 3.6, 8, wallMat);
    this.addBox(-8, 1.8, -32, 10, 3.6, 0.4, wallMat);
    this.addBox(-8, 1.8, -40, 10, 3.6, 0.4, wallMat);
    this.buildBed(-10.5, -34.5, woodMat);
    this.addDoor('bedroom_103', -3, 0, -37, Math.PI / 2, 'Room 103 Door [Iron Key]');

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4f3b21, metalness: 0.45, roughness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const pGroup = new THREE.Group();
      pGroup.position.set(-12.7, 1.9, -34 - i * 2);
      const canvasMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.15, 1.15),
        new THREE.MeshStandardMaterial({ map: this.textures.paintingTexture(i) })
      );
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.28, 1.28), frameMat);
      pGroup.add(frame, canvasMesh);
      this.scene.add(pGroup);
      this.paintingMeshes.push(pGroup);
      this.interactables.push({
        id: `painting_${i}`,
        type: 'painting',
        index: i,
        mesh: canvasMesh,
        worldPos: pGroup.position.clone(),
        label: `Rotate Painting ${i + 1} (Puzzle)`,
      });
    }

    // ==================== ZONE 4: BASEMENT & STAIRWELL (Y=0 -> Y=-4.5) ====================
    this.addDoor('basement_door', 3, 0, -12, -Math.PI / 2, 'Basement Stairs');
    // Doorway header above basement door so hallway has no void gap
    this.addBox(3, 3.25, -13, 0.4, 0.7, 4.0, wallMat);
    // Stairwell enclosure walls & ceiling along x=3..11, z=-15..-11
    this.addBox(7.0, -0.5, -11, 8.2, 8.2, 0.4, concreteMat);
    this.addBox(7.0, -0.5, -15, 8.2, 8.2, 0.4, concreteMat);
    this.addBox(7.0, 3.6, -13, 8.2, 0.2, 4.4, ceilingMat, false);

    const ramp = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.3, 3.6), concreteMat);
    ramp.position.set(7.5, -2.25, -13);
    ramp.rotation.z = -Math.atan2(4.5, 8.0);
    this.scene.add(ramp);

    this.addBox(10.5, -4.6, -8, 15, 0.2, 18, concreteMat);
    this.addBox(10.5, -0.9, -8, 15, 0.2, 18, ceilingMat, false);
    this.addBox(3, -2.7, -5.5, 0.4, 3.6, 13, concreteMat);
    this.addBox(18, -2.7, -8, 0.4, 3.6, 18, concreteMat);
    this.addBox(10.5, -2.7, 1, 15, 3.6, 0.4, concreteMat);
    this.addBox(10.5, -2.7, -17, 15, 3.6, 0.4, concreteMat);
    this.addLight(11, -1.6, -8, 0xd45050, 2.3, 18, true);

    // Composite Generator Unit + 3 Breakers (A, B, C)
    const genGroup = new THREE.Group();
    genGroup.position.set(14.5, -4.5, -10.5);
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x3b444b, metalness: 0.7, roughness: 0.32 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1c2024, metalness: 0.85, roughness: 0.25 });
    const genBase = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 3.4), darkMetal);
    genBase.position.y = 0.125;
    const genBody = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.8, 2.8), steelMat);
    genBody.position.y = 1.15;
    const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.2, 16), darkMetal);
    flywheel.rotation.z = Math.PI / 2;
    flywheel.position.set(-1.05, 1.1, 0.8);
    const pipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 10), darkMetal);
    pipe1.position.set(0.5, 2.6, -0.7);
    const pipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 10), darkMetal);
    pipe2.position.set(0.5, 2.6, 0.4);
    genGroup.add(genBase, genBody, flywheel, pipe1, pipe2);
    this.scene.add(genGroup);
    this.colliders.push({
      minX: 13.3,
      maxX: 15.7,
      minY: -4.5,
      maxY: -2.0,
      minZ: -12.2,
      maxZ: -8.8,
    });

    (['A', 'B', 'C'] as const).forEach((bId, idx) => {
      const sw = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.45, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xb52b2b, metalness: 0.4, roughness: 0.4 })
      );
      sw.position.set(13.3, -3.1, -9.5 - idx * 0.9);
      this.scene.add(sw);
      this.breakerMeshes[bId] = sw;
      this.interactables.push({
        id: `breaker_${bId}`,
        type: 'breaker',
        breakerId: bId,
        mesh: sw,
        worldPos: sw.position.clone(),
        label: `Flip Generator Breaker ${bId}`,
      });
    });

    // ==================== ZONE 5: ELEVATOR (x:-2.5..2.5, z:-50..-44) ====================
    this.addDoor('elevator_door', -0.9, 0, -44, 0, 'Elevator Door [Master Key + Power]');
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4aa4f, metalness: 0.85, roughness: 0.25 });
    const cabFloor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 6), woodMat);
    const cabBack = new THREE.Mesh(new THREE.BoxGeometry(5, 3.6, 0.3), woodMat);
    cabBack.position.set(0, 1.8, -3);
    const cabL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 6), woodMat);
    cabL.position.set(-2.5, 1.8, 0);
    const cabR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 6), woodMat);
    cabR.position.set(2.5, 1.8, 0);
    const railBack = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.4, 8), brassMat);
    railBack.rotation.z = Math.PI / 2;
    railBack.position.set(0, 1.0, -2.75);
    const cabBtn = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.34, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xd9a03b, emissive: 0x6b3e00 })
    );
    cabBtn.position.set(2.1, 1.4, -1.2);
    this.elevatorGroup.add(cabFloor, cabBack, cabL, cabR, railBack, cabBtn);
    this.elevatorGroup.position.set(0, 0, -47);
    this.scene.add(this.elevatorGroup);

    this.interactables.push({
      id: 'elevator_btn',
      type: 'elevator',
      mesh: cabBtn,
      worldPos: new THREE.Vector3(2.1, 1.4, -48.2),
      label: 'Press Elevator Call Button (Floor 1 ↔ Floor 0)',
    });

    // ==================== ZONE 6: FLOOR 0 (x:-14..14, z:-80..-50, y:-9.0) ====================
    this.addBox(0, -9.1, -65, 28, 0.2, 30, concreteMat);
    this.addBox(0, -5.2, -65, 28, 0.2, 30, ceilingMat, false);
    this.addBox(-14, -7.1, -65, 0.4, 3.8, 30, concreteMat);
    this.addBox(14, -7.1, -65, 0.4, 3.8, 30, concreteMat);
    this.addBox(-8.5, -7.1, -50, 11, 3.8, 0.4, concreteMat);
    this.addBox(8.5, -7.1, -50, 11, 3.8, 0.4, concreteMat);
    this.addBox(-7.5, -7.1, -80, 13, 3.8, 0.5, concreteMat);
    this.addBox(7.5, -7.1, -80, 13, 3.8, 0.5, concreteMat);

    this.addLight(0, -5.8, -64, 0x99b8d4, 2.4, 24, true);

    this.addDoor('room0_door', -0.9, -9.0, -80, 0, 'ROOM 0 Vault Door [Keypad]');
    const keypadBox = this.addBox(
      1.8,
      -7.5,
      -79.6,
      0.35,
      0.45,
      0.15,
      new THREE.MeshStandardMaterial({ color: 0x264a32, emissive: 0x10401d })
    );
    this.interactables.push({
      id: 'floor0_keypad',
      type: 'keypad',
      mesh: keypadBox,
      worldPos: keypadBox.position.clone(),
      label: 'Enter Security Keypad Code',
    });

    // ==================== ZONE 7: ROOM 0 (x:-10..10, z:-102..-80, y:-9.0) ====================
    this.addBox(0, -9.1, -91, 20, 0.2, 22, carpetMat);
    this.addBox(0, -5.2, -91, 20, 0.2, 22, ceilingMat, false);
    this.addBox(-10, -7.1, -91, 0.4, 3.8, 22, wallMat);
    this.addBox(10, -7.1, -91, 0.4, 3.8, 22, wallMat);
    this.addBox(0, -7.1, -102, 20, 3.8, 0.4, wallMat);

    const room0Sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 1.5),
      new THREE.MeshBasicMaterial({
        map: this.textures.wallSign('ROOM 0 — 03:33', '#d93232', '#120c0c', 36),
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    room0Sign.position.set(0, -6.5, -101.6);
    this.scene.add(room0Sign);
    this.addLight(0, -5.6, -91, 0xff4545, 2.6, 24, true);

    // 1. Escape Switch (Ending 1)
    const escLever = this.addBox(
      -4,
      -7.7,
      -95,
      0.6,
      1.4,
      0.6,
      new THREE.MeshStandardMaterial({ color: 0x2e6e3e, roughness: 0.45 })
    );
    this.interactables.push({
      id: 'room0_escape_switch',
      type: 'room0_action',
      action: 'toggle_switch',
      mesh: escLever,
      worldPos: escLever.position.clone(),
      label: 'Toggle Escape Override Switch (All Players Must Pull)',
    });

    // 2. Composite Truth Altar (Ending 4)
    const altarGroup = new THREE.Group();
    altarGroup.position.set(0, -9.0, -97);
    const altarMat = new THREE.MeshStandardMaterial({
      color: 0x5c4a28,
      emissive: 0x211808,
      roughness: 0.55,
      metalness: 0.35,
    });
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 2.0), altarMat);
    step1.position.y = 0.125;
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.1), altarMat);
    pedestal.position.y = 0.8;
    const sigilRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.04, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xe6b855, emissive: 0x6b450a, metalness: 0.85, roughness: 0.2 })
    );
    sigilRing.rotation.x = Math.PI / 2;
    sigilRing.position.y = 1.38;
    altarGroup.add(step1, pedestal, sigilRing);
    this.scene.add(altarGroup);
    this.interactables.push({
      id: 'room0_truth_altar',
      type: 'room0_action',
      action: 'truth_altar',
      mesh: pedestal,
      worldPos: new THREE.Vector3(0, -7.8, -97),
      label: 'Activate Truth Altar (4 Notes + Reliquary)',
    });

    // 3. Manual Seal Lever (Ending 3)
    const sealLever = this.addBox(
      4,
      -7.7,
      -95,
      0.6,
      1.4,
      0.6,
      new THREE.MeshStandardMaterial({ color: 0x8c2424, roughness: 0.45 })
    );
    this.interactables.push({
      id: 'room0_seal_lever',
      type: 'room0_action',
      action: 'seal_sacrifice',
      mesh: sealLever,
      worldPos: sealLever.position.clone(),
      label: 'Pull Sacrifice Bulkhead Lever (Stay Behind So Others Live)',
    });
  }

  private buildCompositePickup(item: WorldItem): THREE.Group {
    const g = new THREE.Group();
    g.position.set(item.pos.x, item.pos.y, item.pos.z);

    if (item.type === 'key') {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xe8c456,
        emissive: 0x5c4308,
        emissiveIntensity: 0.4,
        metalness: 0.85,
        roughness: 0.22,
      });
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 16), mat);
      bow.rotation.x = Math.PI / 2;
      bow.position.x = -0.14;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), mat);
      shaft.rotation.z = Math.PI / 2;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.07), mat);
      tooth.position.set(0.1, 0, 0.04);
      g.add(bow, shaft, tooth);
    } else if (item.type === 'battery') {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.24, 12),
        new THREE.MeshStandardMaterial({ color: 0x2c6bc4, roughness: 0.4, metalness: 0.3 })
      );
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.082, 0.082, 0.06, 12),
        new THREE.MeshStandardMaterial({ color: 0xd9a83b, metalness: 0.8, roughness: 0.25 })
      );
      cap.position.y = 0.14;
      const nub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8),
        new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.9, roughness: 0.2 })
      );
      nub.position.y = 0.18;
      g.add(body, cap, nub);
    } else if (item.type === 'radio') {
      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.22, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x3b4d3f, roughness: 0.7 })
      );
      const speaker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12),
        new THREE.MeshStandardMaterial({ color: 0x161817, metalness: 0.5, roughness: 0.4 })
      );
      speaker.rotation.x = Math.PI / 2;
      speaker.position.set(-0.06, 0, 0.07);
      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6),
        new THREE.MeshStandardMaterial({ color: 0xc2c8cc, metalness: 0.9, roughness: 0.2 })
      );
      antenna.position.set(0.12, 0.24, 0);
      g.add(chassis, speaker, antenna);
    } else if (item.type === 'camera') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.2, 0.22),
        new THREE.MeshStandardMaterial({ color: 0xc4bfb6, roughness: 0.55 })
      );
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.075, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: 0x191b22, metalness: 0.85, roughness: 0.15 })
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, -0.01, 0.13);
      const flash = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.06, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x555566 })
      );
      flash.position.set(0.07, 0.08, 0.11);
      g.add(body, lens, flash);
    } else {
      // Map / Note / Reliquary
      const isRelic = item.type === 'reliquary';
      const base = new THREE.Mesh(
        isRelic ? new THREE.OctahedronGeometry(0.18, 0) : new THREE.BoxGeometry(0.42, 0.04, 0.52),
        new THREE.MeshStandardMaterial({
          color: isRelic ? 0xff5959 : item.type === 'map' ? 0xd4a96a : 0xf2ead3,
          emissive: isRelic ? 0x661010 : 0x383020,
          emissiveIntensity: 0.45,
          roughness: isRelic ? 0.25 : 0.85,
          metalness: isRelic ? 0.65 : 0.05,
        })
      );
      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.05, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x991f1f, roughness: 0.7 })
      );
      accent.position.y = 0.02;
      const seal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10),
        new THREE.MeshStandardMaterial({ color: 0x8f1a1a, roughness: 0.4 })
      );
      seal.position.set(0.1, 0.03, 0.14);
      g.add(base, accent, seal);
    }

    return g;
  }

  spawnWorldItems(itemsMap: Record<string, WorldItem>): void {
    Object.values(this.itemMeshes).forEach((m) => this.scene.remove(m));
    this.itemMeshes = {};
    this.interactables = this.interactables.filter((it) => it.type !== 'item');

    Object.values(itemsMap).forEach((item) => {
      if (item.collectedBy || item.hidden) return;
      const group = this.buildCompositePickup(item);
      this.scene.add(group);
      this.itemMeshes[item.id] = group;

      this.interactables.push({
        id: `item_${item.id}`,
        type: 'item',
        itemId: item.id,
        mesh: group,
        worldPos: group.position.clone(),
        label: `Pick up ${item.name}`,
      });
    });
  }

  removeItem(itemId: string): void {
    const m = this.itemMeshes[itemId];
    if (m) {
      this.scene.remove(m);
      delete this.itemMeshes[itemId];
    }
    this.interactables = this.interactables.filter((it) => it.itemId !== itemId);
  }

  updateDoorVisual(doorId: string, doorState: DoorState): void {
    const d = this.doorMeshes[doorId];
    if (!d) return;
    d.open = doorState.open;
    d.pivot.rotation.y = d.baseRotY + (doorState.open ? Math.PI * 0.48 : 0);
  }

  updateBreakersVisual(breakers: Record<'A' | 'B' | 'C', boolean>): void {
    Object.entries(breakers).forEach(([id, on]) => {
      const m = this.breakerMeshes[id];
      if (m) {
        (m.material as THREE.MeshStandardMaterial).color.setHex(on ? 0x3bd15a : 0xb52b2b);
      }
    });
  }

  updatePaintingsVisual(rotations: number[]): void {
    rotations.forEach((rotIdx, i) => {
      const p = this.paintingMeshes[i];
      if (p) {
        p.rotation.x = rotIdx * (Math.PI / 2);
      }
    });
  }

  setElevatorTarget(floor: number): void {
    this.elevatorTargetY = floor === 0 ? -9.0 : 0.0;
  }

  getZoneName(pos: THREE.Vector3): string {
    if (pos.y < -6.5) {
      return pos.z < -80 ? 'ROOM 0' : 'FLOOR 0';
    }
    if (pos.y < -2.2) return 'BASEMENT';
    if (pos.z > -8) return 'RECEPTION';
    if (pos.z < -43.5) return 'ELEVATOR';
    if (pos.x < -3.2) return 'BEDROOMS (WEST)';
    if (pos.x > 3.2) return 'BEDROOMS (EAST)';
    return 'ENDLESS HALLWAY';
  }

  resolveCollision(pos: THREE.Vector3, radius = 0.42): number {
    let floorY = 0;
    if (pos.y < -6.5) floorY = -9.0;
    else if (pos.x > 3 && pos.x < 12 && pos.z > -15 && pos.z < -11 && pos.y > -4.6) {
      const t = Math.max(0, Math.min(1, (pos.x - 3) / 8.0));
      floorY = -t * 4.5;
    } else if (pos.y < -2.2) {
      floorY = -4.5;
    } else if (pos.z < -44 && pos.z > -50) {
      floorY = this.elevatorCurrentY;
    }

    pos.x = Math.max(-13.4, Math.min(17.4, pos.x));
    pos.z = Math.max(-101.3, Math.min(7.3, pos.z));

    for (const c of this.colliders) {
      if (pos.y + 0.5 < c.minY || pos.y - 1.6 > c.maxY) continue;
      const closestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const closestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      }
    }

    return floorY;
  }

  update(dt: number, timeSec: number): void {
    for (const f of this.flickerLights) {
      const n = Math.sin(timeSec * 7 + f.phase) * Math.sin(timeSec * 19 + f.phase);
      f.light.intensity = n > 0.72 ? f.baseIntensity * 0.25 : f.baseIntensity;
    }

    // Subtle idle rotation on pickups so they remain readable
    for (const item of Object.values(this.itemMeshes)) {
      item.rotation.y += dt * 0.9;
    }

    if (Math.abs(this.elevatorCurrentY - this.elevatorTargetY) > 0.02) {
      const dir = Math.sign(this.elevatorTargetY - this.elevatorCurrentY);
      this.elevatorCurrentY += dir * dt * 2.8;
      if (
        (dir > 0 && this.elevatorCurrentY > this.elevatorTargetY) ||
        (dir < 0 && this.elevatorCurrentY < this.elevatorTargetY)
      ) {
        this.elevatorCurrentY = this.elevatorTargetY;
      }
      this.elevatorGroup.position.y = this.elevatorCurrentY;
      const btnIt = this.interactables.find((i) => i.id === 'elevator_btn');
      if (btnIt) btnIt.worldPos.y = this.elevatorCurrentY + 1.4;
    }
  }
}
