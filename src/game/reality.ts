import * as THREE from 'three';
import type { RealityClue } from '../shared/types';
import type { HotelTextures } from './textures';

/**
 * Different Realities System:
 * Each player receives realityId (0, 1, or 2) and perceives a unique layer of the hotel
 * featuring 12 distinct visual & clue anomalies across the 7 hotel zones + fear hallucinations.
 */
export class RealitySystem {
  private scene: THREE.Scene;
  private textures: HotelTextures;
  public realityId = 0;
  private realityGroup = new THREE.Group();
  private fearGroup = new THREE.Group();
  private falseDoorMesh: THREE.Group | null = null;
  private fearSign: THREE.Mesh | null = null;
  private floatingChairs: THREE.Group[] = [];

  constructor(scene: THREE.Scene, textures: HotelTextures) {
    this.scene = scene;
    this.textures = textures;
    this.scene.add(this.realityGroup);
    this.scene.add(this.fearGroup);
  }

  private clearGroup(g: THREE.Group): void {
    while (g.children.length) {
      g.remove(g.children[0]);
    }
  }

  buildForReality(realityId: number, realityClue?: RealityClue): void {
    this.realityId = realityId;
    this.clearGroup(this.realityGroup);
    this.clearGroup(this.fearGroup);
    this.floatingChairs = [];

    const addSign = (
      text: string,
      x: number,
      y: number,
      z: number,
      rotY: number,
      color = '#c92e2e'
    ) => {
      const mat = new THREE.MeshBasicMaterial({
        map: this.textures.wallSign(text, color, '#181414', 26),
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.05), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      this.realityGroup.add(mesh);
      return mesh;
    };

    // ANOMALY 1: Reality-split Wall Code Digits (core cooperative puzzle)
    if (realityClue && realityClue.wallCodeText) {
      if (realityId === 0) {
        addSign(realityClue.wallCodeText, -5.5, 2.0, -7.75, 0, '#e33b3b');
      } else if (realityId === 1) {
        addSign(realityClue.wallCodeText, 12.75, 2.0, -26, -Math.PI / 2, '#e33b3b');
      } else {
        addSign(realityClue.wallCodeText, -12.75, -7.0, -64, Math.PI / 2, '#e33b3b');
      }
    }

    // ANOMALY 2: Different bloody wall inscriptions per reality
    const phrases = [
      'DO NOT TRUST YOUR OWN EYES',
      'THEY ARE STANDING BEHIND YOU',
      'ROOM 0 BURNED IN 1973',
    ];
    addSign(phrases[realityId % 3], -2.78, 1.9, -22, Math.PI / 2, '#9e2020');

    // ANOMALY 3: Composite Phantom Silhouette in Bedroom 101 (Reality 0)
    if (realityId === 0) {
      const fig = new THREE.Group();
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x060609, roughness: 0.92 });
      const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 1.55, 10), darkMat);
      cloak.position.y = 0.78;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), darkMat);
      head.position.y = 1.72;
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.24), darkMat);
      shoulder.position.y = 1.48;
      fig.add(cloak, head, shoulder);
      fig.position.set(-11.5, 0, -18.5);
      this.realityGroup.add(fig);
    }

    // ANOMALY 4: Blood Trail leading into Basement (Reality 1)
    if (realityId === 1) {
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0x6b0b0b,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      for (let i = 0; i < 6; i++) {
        const stain = new THREE.Mesh(
          new THREE.CircleGeometry(0.26 + (i % 2) * 0.1, 12),
          trailMat
        );
        stain.rotation.x = -Math.PI / 2;
        stain.position.set(2.4 + i * 0.65, 0.025, -13.5);
        this.realityGroup.add(stain);
      }
    }

    // ANOMALY 5: Composite Upside-down floating chairs on Floor 0 (Reality 2)
    if (realityId === 2) {
      const chairWood = new THREE.MeshStandardMaterial({ color: 0x452c1b, roughness: 0.78 });
      const cushionMat = new THREE.MeshStandardMaterial({ color: 0x5c1f22, roughness: 0.92 });
      for (let i = 0; i < 3; i++) {
        const chair = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), cushionMat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.58, 0.07), chairWood);
        back.position.set(0, 0.3, -0.24);
        const legGeo = new THREE.BoxGeometry(0.06, 0.45, 0.06);
        [
          [-0.22, -0.24, -0.22],
          [0.22, -0.24, -0.22],
          [-0.22, -0.24, 0.22],
          [0.22, -0.24, 0.22],
        ].forEach(([lx, ly, lz]) => {
          const leg = new THREE.Mesh(legGeo, chairWood);
          leg.position.set(lx, ly, lz);
          chair.add(leg);
        });
        chair.add(seat, back);
        chair.position.set(-6 + i * 6, -5.8, -60 - i * 4);
        chair.rotation.x = Math.PI;
        this.realityGroup.add(chair);
        this.floatingChairs.push(chair);
      }
    }

    // ANOMALY 6: Clock face discrepancy (03:33 vs 00:00 vs 33:03)
    const clockTimes = ['03:33', '00:00', '33:03'];
    addSign(`TIME: ${clockTimes[realityId % 3]}`, -6.8, 2.2, -12.2, 0, '#dfc77e');

    // ANOMALY 7: Phantom iron bars illusion in corridor (Reality 0)
    if (realityId === 0) {
      const barMat = new THREE.MeshStandardMaterial({
        color: 0x1d1d24,
        metalness: 0.65,
        roughness: 0.35,
        transparent: true,
        opacity: 0.65,
      });
      for (let x = -1.2; x <= 1.2; x += 0.6) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 8), barMat);
        bar.position.set(x, 1.6, -29);
        this.realityGroup.add(bar);
      }
    }

    // ANOMALY 8: Painting Cipher Hint specific to player's reality
    const cipherHints = [
      'PAINTING I = 03:33 (2x)',
      'PAINTING II = KEY (1x)',
      'PAINTING III = FLAME (3x)',
    ];
    addSign(cipherHints[realityId % 3], 0, 2.2, -39.5, 0, '#d19843');

    // ANOMALY 9: Bleeding Portrait in Reception (Reality 1)
    if (realityId === 1) {
      addSign('WE HEAR YOU BREATHING', 6.8, 2.0, 0, -Math.PI / 2, '#a31717');
    }

    // ANOMALY 10: Truth Glyphs inside Room 0 (split across realities)
    const loreLines = [
      '1973: LOCKED FROM OUTSIDE',
      '12 GUESTS NEVER CHECKED OUT',
      'SPEAK THE 4 FRAGMENTS AT ALTAR',
    ];
    addSign(loreLines[realityId % 3], -7.8, -7.0, -92, Math.PI / 2, '#d4b572');

    // ANOMALY 11: Fear-induced false door (composite group: panel + frame + knob)
    const falseDoor = new THREE.Group();
    const fdPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.4, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x3b1f14, roughness: 0.85 })
    );
    fdPanel.position.y = 1.2;
    const fdFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 2.52, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x21120c, roughness: 0.9 })
    );
    fdFrame.position.y = 1.26;
    const fdKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xc29e4a, metalness: 0.8, roughness: 0.25 })
    );
    fdKnob.position.set(0.5, 1.15, 0.08);
    falseDoor.add(fdFrame, fdPanel, fdKnob);
    falseDoor.position.set(-2.78, 0, -30);
    falseDoor.rotation.y = Math.PI / 2;
    falseDoor.visible = false;
    this.fearGroup.add(falseDoor);
    this.falseDoorMesh = falseDoor;

    // ANOMALY 12: Fear-induced shifting wall sign
    const fearSign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.9),
      new THREE.MeshBasicMaterial({
        map: this.textures.wallSign('TURN AROUND NOW', '#ff2929', '#0c0808', 26),
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    fearSign.position.set(2.76, 1.9, -24);
    fearSign.rotation.y = -Math.PI / 2;
    fearSign.visible = false;
    this.fearGroup.add(fearSign);
    this.fearSign = fearSign;
  }

  update(dt: number, timeSec: number, fearLevel: number): void {
    this.floatingChairs.forEach((c, i) => {
      c.position.y = -5.8 + Math.sin(timeSec * 1.4 + i) * 0.2;
      c.rotation.z += dt * 0.25;
    });

    if (this.falseDoorMesh) {
      this.falseDoorMesh.visible = fearLevel > 62;
    }
    if (this.fearSign) {
      this.fearSign.visible = fearLevel > 72 && Math.sin(timeSec * 5) > 0;
    }
  }
}
