import * as THREE from "three";
import { beamFrag, beamVert } from "./shaders";

/**
 * The electric-blue mothership: the visual anchor of the LAZY JO universe.
 * Built entirely from primitives so it ships with zero model downloads.
 */
export interface Ufo {
  group: THREE.Group;
  /** music/bass 0..1 from the preview player, surge 0..1 after a "beam" click */
  update(t: number, speed: number, music?: number, bass?: number, surge?: number): void;
  /** meshes a click/hover can hit */
  hitTargets: THREE.Object3D[];
  dispose(): void;
}

export function createUfo(glowTex: THREE.Texture): Ufo {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const CYAN = new THREE.Color("#00F5FF");
  const BLUE = new THREE.Color("#00BFFF");

  // ── Hull: lathe profile (top dome shoulder → wide rim → underside) ──
  const profile = [
    [0, 5.2],
    [5.5, 5.0],
    [9.5, 4.0],
    [16, 2.2],
    [24, 0.7],
    [30, 0.0],
    [29.6, -0.6],
    [22, -1.8],
    [14, -2.8],
    [8, -3.4],
    [0, -3.6],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const hullGeo = track(new THREE.LatheGeometry(profile, 128));
  const hullMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#c9d6e6"),
      metalness: 0.92,
      roughness: 0.24,
      emissive: new THREE.Color("#0f3a6e"),
      emissiveIntensity: 0.35,
      envMapIntensity: 1.6,
    }),
  );
  const hull = new THREE.Mesh(hullGeo, hullMat);
  group.add(hull);

  // ── Dome (glass, glowing from within) ──
  const domeGeo = track(new THREE.SphereGeometry(7.6, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2));
  const domeMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0b3550"),
      emissive: BLUE,
      emissiveIntensity: 0.9,
      metalness: 0.1,
      roughness: 0.04,
      envMapIntensity: 2.2,
      transparent: true,
      opacity: 0.9,
    }),
  );
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.position.y = 4.6;
  dome.scale.y = 0.8;
  group.add(dome);

  // ── Neon rings ──
  const ringMat = (c: THREE.Color, k: number) =>
    track(new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(k), toneMapped: false }));
  const rimRing = new THREE.Mesh(track(new THREE.TorusGeometry(29.9, 0.35, 12, 200)), ringMat(CYAN, 2.2));
  rimRing.rotation.x = Math.PI / 2;
  group.add(rimRing);

  const midRing = new THREE.Mesh(track(new THREE.TorusGeometry(17, 0.18, 8, 160)), ringMat(BLUE, 2.4));
  midRing.rotation.x = Math.PI / 2;
  midRing.position.y = 1.95;
  group.add(midRing);

  const shoulderRing = new THREE.Mesh(track(new THREE.TorusGeometry(9.6, 0.16, 8, 120)), ringMat(CYAN, 2.6));
  shoulderRing.rotation.x = Math.PI / 2;
  shoulderRing.position.y = 3.95;
  group.add(shoulderRing);

  // Underside engine ring made of segments that spin.
  const engine = new THREE.Group();
  const segGeo = track(new THREE.BoxGeometry(2.4, 0.25, 0.6));
  const segMat = ringMat(CYAN, 3.5);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const m = new THREE.Mesh(segGeo, segMat);
    m.position.set(Math.cos(a) * 11, 0, Math.sin(a) * 11);
    m.rotation.y = -a + Math.PI / 2;
    engine.add(m);
  }
  engine.position.y = -2.95;
  group.add(engine);

  // Underside glowing core disc
  const coreMat = track(
    new THREE.MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(2.2), toneMapped: false }),
  );
  const core = new THREE.Mesh(track(new THREE.CircleGeometry(6.5, 64)), coreMat);
  core.rotation.x = Math.PI / 2;
  core.position.y = -3.62;
  group.add(core);

  // Rim beacons — instanced, chase-animated.
  const BEACONS = 48;
  const beaconGeo = track(new THREE.SphereGeometry(0.42, 10, 8));
  const beaconMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const beacons = new THREE.InstancedMesh(beaconGeo, beaconMat, BEACONS);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < BEACONS; i++) {
    const a = (i / BEACONS) * Math.PI * 2;
    m4.makeTranslation(Math.cos(a) * 26.5, 0.15, Math.sin(a) * 26.5);
    beacons.setMatrixAt(i, m4);
    beacons.setColorAt(i, CYAN);
  }
  group.add(beacons);

  // Lit cabin windows around the base of the dome
  const winGeo = track(new THREE.BoxGeometry(1.1, 0.45, 0.2));
  const winMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color("#bff6ff").multiplyScalar(2.2), toneMapped: false }));
  const windows = new THREE.InstancedMesh(winGeo, winMat, 28);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    m4.makeRotationY(-a + Math.PI / 2);
    m4.setPosition(Math.cos(a) * 8.15, 4.55, Math.sin(a) * 8.15);
    windows.setMatrixAt(i, m4);
  }
  group.add(windows);

  // Panel seams on the top hull
  for (const [r, y] of [
    [21, 1.3],
    [13, 2.85],
  ]) {
    const seam = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.07, 6, 160)), ringMat(BLUE, 1.2));
    seam.rotation.x = Math.PI / 2;
    seam.position.y = y;
    group.add(seam);
  }

  // ── Tractor beam ──
  const beamGeo = track(new THREE.CylinderGeometry(6.2, 30, 60, 64, 1, true));
  const beamMat = track(
    new THREE.ShaderMaterial({
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: BLUE.clone() },
        uCore: { value: new THREE.Color("#e6ffff") },
        uBoost: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = -33.5;
  group.add(beam);

  // ── Halo glow sprites ──
  const halo = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: new THREE.Color("#1a8cff").multiplyScalar(0.18),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  halo.scale.set(120, 55, 1);
  halo.position.set(0, -2, -8);
  group.add(halo);

  const underGlow = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: CYAN.clone().multiplyScalar(0.45),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  underGlow.scale.set(40, 14, 1);
  underGlow.position.y = -4.5;
  group.add(underGlow);

  // Lights so the hull + nearby asteroids catch the blue.
  const under = new THREE.PointLight(CYAN, 500, 200, 1.6);
  under.position.y = -8;
  group.add(under);
  const top = new THREE.PointLight(new THREE.Color("#7B2CFF"), 300, 120, 1.6);
  top.position.y = 18;
  group.add(top);

  group.rotation.x = 0.24; // tilt toward the viewer so the top + rings read

  const col = new THREE.Color();
  const rimMat = rimRing.material as THREE.MeshBasicMaterial;
  const haloMat = halo.material as THREE.SpriteMaterial;
  const haloBase = haloMat.color.clone();
  function update(t: number, speed: number, music = 0, bass = 0, surge = 0) {
    group.position.y = 12.5 + Math.sin(t * 0.45) * 0.8 + surge * 1.2;
    group.rotation.z = Math.sin(t * 0.3) * 0.025;
    hull.rotation.y = t * 0.05;
    engine.rotation.y = -t * (0.6 + speed * 0.4);
    midRing.rotation.z = t * 0.2;
    beamMat.uniforms.uTime.value = t;
    beamMat.uniforms.uBoost.value = music * 0.22 + bass * 0.2 + surge * 0.7;
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
    coreMat.color.copy(CYAN).multiplyScalar(1.5 * pulse + speed * 0.5 + bass * 1.6 + surge * 3);
    rimMat.color.copy(CYAN).multiplyScalar(2.2 + bass * 2.6 + surge * 4);
    rimRing.scale.setScalar(1 + bass * 0.018);
    under.intensity = 500 * (1 + bass * 1.3 + surge * 2.5);
    haloMat.color.copy(haloBase).multiplyScalar(1 + music * 0.8 + surge * 2);
    for (let i = 0; i < BEACONS; i++) {
      const phase = (i / BEACONS + t * 0.35) % 1;
      const k = Math.pow(1 - phase, 6) * (3 + bass * 4) + 0.35 + surge * 2;
      col.copy(i % 2 ? CYAN : BLUE).multiplyScalar(k);
      beacons.setColorAt(i, col);
    }
    if (beacons.instanceColor) beacons.instanceColor.needsUpdate = true;
  }

  return {
    group,
    update,
    hitTargets: [hull, dome],
    dispose() {
      disposables.forEach((d) => d.dispose());
      beacons.dispose();
      windows.dispose();
    },
  };
}
