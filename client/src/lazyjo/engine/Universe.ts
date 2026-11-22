import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Single } from "../catalog";
import {
  CinematicShader,
  atmoFrag,
  holoFrag,
  holoVert,
  lanesFrag,
  lanesVert,
  planetFrag,
  planetVert,
  skyFrag,
  skyVert,
  starsFrag,
  starsVert,
  streakFrag,
  streakVert,
} from "./shaders";
import {
  canvasTexture,
  drawGlowSprite,
  drawPlaceholderCover,
  drawPlayIcon,
  drawVinylTexture,
} from "./textures";
import { createUfo, type Ufo } from "./ufo";

/**
 * LAZY JO UNIVERSE — the three.js engine.
 *
 * The visitor flies straight down -Z. Nothing is ever "reached": the sky,
 * planets and UFO travel with the camera (so they read as infinitely far),
 * while stars, dust, energy lanes and the singles gallery wrap around the
 * camera so the corridor is endless in both directions.
 */

export interface UniverseCallbacks {
  onHover?(single: Single | null): void;
  onSelect?(single: Single): void;
  onNearest?(single: Single | null): void;
  onFrame?(speed: number): void;
  onTelemetry?(t: { speed: number; distance: number }): void;
  onFirstMove?(): void;
}

interface Slot {
  single: Single;
  group: THREE.Group;
  cover: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  frameMat: THREE.ShaderMaterial;
  playMat: THREE.MeshBasicMaterial;
  pedestalMat: THREE.MeshBasicMaterial;
  vinyl: THREE.Group | null;
  side: -1 | 1;
  row: number;
  jitterY: number;
  jitterX: number;
  seed: number;
  z: number;
  hover: number;
  focus: number; // 0 → in slot, 1 → presented to camera
}

const COLORS = {
  deep: new THREE.Color("#030712"),
  blue: new THREE.Color("#00BFFF"),
  cyan: new THREE.Color("#00F5FF"),
  purple: new THREE.Color("#7B2CFF"),
};

const ROW_SPACING = 9;
const MIN_SLOTS = 24;
const COVER_SIZE = 3.4;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export class Universe {
  private container: HTMLElement;
  private singles: Single[];
  private cb: UniverseCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private cinematic: ShaderPass;
  private timer = new THREE.Timer();
  private raf = 0;
  private disposed = false;
  private lowPower: boolean;
  private reducedMotion: boolean;
  private pixelRatio: number;
  private frameTimes: number[] = [];

  // flight state
  private camZ = 0;
  private targetZ = 0;
  private speed = 0;
  private smoothSpeed = 0;
  private inputEnabled = false;
  private idleDrift = 0.9;
  private moved = false;
  private flash = 0;

  // pointer
  private pointer = new THREE.Vector2(9, 9);
  private pointerInside = false;
  private parallax = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private down: { x: number; y: number; t: number; id: number; lastY: number; vy: number } | null = null;

  // world
  private slots: Slot[] = [];
  private loopLength = 0;
  private hovered: Slot | null = null;
  private focused: Slot | null = null;
  private dim = 0;
  private nearest: Single | null = null;
  private lastTelemetry = 0;
  private layout = { x: 5.6, scale: 1, portrait: false };
  private baseFov = 62;

  private sky!: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private stars!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private dust!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private streaks!: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private lanes!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private planets = new THREE.Group();
  private planetSpin: THREE.Mesh[] = [];
  private asteroids!: THREE.InstancedMesh;
  private asteroidData: { pos: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; scale: number }[] = [];
  private ufo!: Ufo;
  private glowTex: THREE.Texture;
  private coverTextures = new Map<string, THREE.Texture>();
  private coverImages = new Map<string, string>();
  private coverCanvases = new Map<string, HTMLCanvasElement>();
  private disposables: { dispose(): void }[] = [];
  private resizeObs: ResizeObserver;

  constructor(container: HTMLElement, singles: Single[], cb: UniverseCallbacks = {}) {
    this.container = container;
    this.singles = singles;
    this.cb = cb;
    this.lowPower =
      window.matchMedia("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 600;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 1.75);
    if (this.reducedMotion) this.idleDrift = 0.25;

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setClearColor(COLORS.deep, 1);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.className = "lj-canvas";
    container.appendChild(this.renderer.domElement);

    const { clientWidth: w, clientHeight: h } = container;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, w / h, 0.1, 2000);
    this.scene.add(this.camera);

    this.glowTex = this.track(canvasTexture(drawGlowSprite()));
    this.glowTex.colorSpace = THREE.NoColorSpace;

    this.buildEnvironment();
    this.buildSky();
    this.buildStars();
    this.buildStreaks();
    this.buildLanes();
    this.buildPlanets();
    this.buildAsteroids();
    this.ufo = createUfo(this.glowTex);
    this.scene.add(this.ufo.group);
    this.buildGallery();

    // Post-processing: bloom → cinematic (motion blur / CA / vignette) → tone map.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.45, 0.9);
    this.composer.addPass(this.bloom);
    this.cinematic = new ShaderPass(CinematicShader);
    this.composer.addPass(this.cinematic);
    this.composer.addPass(new OutputPass());

    this.resize();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.bindInput();
    this.loop();
  }

  // ───────────────────────── public API ─────────────────────────

  setInputEnabled(v: boolean) {
    this.inputEnabled = v;
  }

  /** Cinematic burst forward when the visitor enters. */
  warpIn() {
    this.targetZ -= this.reducedMotion ? 12 : 58;
    this.flash = this.reducedMotion ? 0 : 0.35;
  }

  getCoverImage(single: Single): string {
    const raw = this.coverImages.get(single.id);
    if (raw) return raw;
    const c = this.coverCanvases.get(single.id);
    if (!c) return "";
    const url = c.toDataURL("image/jpeg", 0.88);
    this.coverImages.set(single.id, url);
    return url;
  }

  /** Fly to the nearest instance of a single, then present it. */
  async open(singleId: string) {
    const candidates = this.slots.filter((s) => s.single.id === singleId);
    if (!candidates.length) return;
    let best: { slot: Slot; camTarget: number } | null = null;
    for (const s of candidates) {
      for (const k of [-1, 0, 1]) {
        const z = s.z + k * this.loopLength;
        const camTarget = z + 9;
        if (!best || Math.abs(camTarget - this.camZ) < Math.abs(best.camTarget - this.camZ)) {
          best = { slot: s, camTarget };
        }
      }
    }
    if (!best) return;
    this.targetZ = best.camTarget;
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const check = () => {
        if (this.disposed) return resolve();
        if (Math.abs(this.camZ - this.targetZ) < 0.35 || performance.now() - t0 > 4500) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });
    this.select(best.slot);
  }

  /** Open whichever single is closest ahead. */
  openNearest() {
    const s = this.nearestSlot();
    if (s) this.select(s);
  }

  /** Send the presented cover back to its place in the gallery. */
  unfocus() {
    this.focused = null;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.unbindInput();
    this.ufo.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ───────────────────────── building ─────────────────────────

  private track<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  private buildEnvironment() {
    // A tiny neon "room" baked into a PMREM so the UFO's metal has something
    // blue/purple to reflect.
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color("#02040a");
    const panel = (color: THREE.Color, k: number, pos: [number, number, number], size: [number, number]) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size[0], size[1]),
        new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(k), side: THREE.DoubleSide }),
      );
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };
    panel(COLORS.cyan, 2.5, [0, 8, 0], [10, 10]);
    panel(COLORS.purple, 2.0, [-8, 2, -4], [6, 10]);
    panel(COLORS.blue, 2.2, [8, 1, 4], [6, 10]);
    panel(new THREE.Color("#ffffff"), 0.6, [0, -6, 6], [14, 4]);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const rt = pmrem.fromScene(envScene, 0.04);
    this.scene.environment = rt.texture;
    this.track(rt);
    pmrem.dispose();
    envScene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });

    this.scene.add(new THREE.AmbientLight(new THREE.Color("#3a4a8a"), 0.6));
    const key = new THREE.DirectionalLight(new THREE.Color("#9fd8ff"), 1.4);
    key.position.set(-1, 1.5, 1);
    this.scene.add(key);
  }

  private buildSky() {
    const mat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: {
        uTime: { value: 0 },
        uTravel: { value: 0 },
        uBlue: { value: COLORS.blue.clone() },
        uCyan: { value: COLORS.cyan.clone() },
        uPurple: { value: COLORS.purple.clone() },
        uDeep: { value: COLORS.deep.clone() },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 32), mat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  private makePoints(
    count: number,
    depth: number,
    spread: [number, number],
    clear: [number, number],
    palette: THREE.Color[],
    size: number,
  ) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      do {
        x = (Math.random() * 2 - 1) * spread[0];
        y = (Math.random() * 2 - 1) * spread[1];
      } while (Math.abs(x) < clear[0] && Math.abs(y) < clear[1]);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = -Math.random() * depth;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: starsVert,
      fragmentShader: starsFrag,
      uniforms: {
        uCamZ: { value: 0 },
        uDepth: { value: depth },
        uTime: { value: 0 },
        uPixelRatio: { value: this.pixelRatio },
        uSize: { value: size },
        uMap: { value: this.glowTex },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  private buildStars() {
    const white = new THREE.Color("#ffffff").multiplyScalar(1.4);
    const ice = new THREE.Color("#bfe9ff").multiplyScalar(1.4);
    this.stars = this.makePoints(
      this.lowPower ? 2600 : 6000,
      520,
      [220, 130],
      [9, 6],
      [white, white, ice, COLORS.cyan.clone().multiplyScalar(1.2), COLORS.purple.clone().multiplyScalar(1.6)],
      2.2,
    );
    this.scene.add(this.stars);
    this.dust = this.makePoints(
      this.lowPower ? 450 : 1000,
      150,
      [16, 9],
      [1.6, 1.2],
      [COLORS.cyan.clone().multiplyScalar(0.55), COLORS.blue.clone().multiplyScalar(0.6), COLORS.purple.clone().multiplyScalar(0.9)],
      0.42,
    );
    this.scene.add(this.dust);
  }

  private buildStreaks() {
    const n = this.lowPower ? 200 : 420;
    const pos = new Float32Array(n * 6);
    const tail = new Float32Array(n * 2);
    const seed = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 5 + Math.pow(Math.random(), 0.7) * 50;
      const x = Math.cos(a) * r * 1.4;
      const y = Math.sin(a) * r * 0.75;
      const z = -Math.random() * 280;
      pos.set([x, y, z, x, y, z], i * 6);
      tail.set([0, 1], i * 2);
      const s = Math.random();
      seed.set([s, s], i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aTail", new THREE.BufferAttribute(tail, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: streakVert,
      fragmentShader: streakFrag,
      uniforms: {
        uCamZ: { value: 0 },
        uDepth: { value: 280 },
        uStretch: { value: 0 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color("#bff6ff") },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.streaks = new THREE.LineSegments(geo, mat);
    this.streaks.frustumCulled = false;
    this.scene.add(this.streaks);
  }

  private buildLanes() {
    const mat = new THREE.ShaderMaterial({
      vertexShader: lanesVert,
      fragmentShader: lanesFrag,
      uniforms: {
        uCamZ: { value: 0 },
        uTime: { value: 0 },
        uSpeed: { value: 0 },
        uCyan: { value: COLORS.cyan.clone() },
        uBlue: { value: COLORS.blue.clone() },
        uPurple: { value: COLORS.purple.clone() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lanes = new THREE.Mesh(new THREE.PlaneGeometry(34, 440, 1, 1), mat);
    this.lanes.rotation.x = -Math.PI / 2;
    this.lanes.position.y = -3.4;
    this.lanes.frustumCulled = false;
    this.scene.add(this.lanes);
  }

  private buildPlanets() {
    const lightDir = new THREE.Vector3(-0.8, 0.4, 0.5).normalize();
    const mk = (
      r: number,
      pos: [number, number, number],
      a: string,
      b: string,
      rim: string,
      seed: number,
      city: number,
    ) => {
      const geo = new THREE.SphereGeometry(r, this.lowPower ? 40 : 64, this.lowPower ? 28 : 48);
      const mat = new THREE.ShaderMaterial({
        vertexShader: planetVert,
        fragmentShader: planetFrag,
        uniforms: {
          uA: { value: new THREE.Color(a) },
          uB: { value: new THREE.Color(b) },
          uRim: { value: new THREE.Color(rim) },
          uLight: { value: lightDir },
          uSeed: { value: seed },
          uCity: { value: city },
        },
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      m.rotation.z = 0.35;
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.06, 48, 32),
        new THREE.ShaderMaterial({
          vertexShader: planetVert,
          fragmentShader: atmoFrag,
          uniforms: { uRim: { value: new THREE.Color(rim) } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
        }),
      );
      atmo.position.copy(m.position);
      this.planets.add(m, atmo);
      this.planetSpin.push(m);
    };
    mk(34, [92, 46, -170], "#1b2a4a", "#3b5d8f", "#00BFFF", 1.7, 1);
    mk(7, [-70, 38, -180], "#3a3f4d", "#8a90a0", "#9fb8ff", 4.2, 0);
    mk(3.2, [30, 40, -190], "#2a1f4d", "#6a4fb0", "#7B2CFF", 8.1, 0);
    this.planets.renderOrder = -5;
    this.scene.add(this.planets);
  }

  private buildAsteroids() {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const p = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 0.75 + Math.sin(v.x * 3.1) * 0.12 + Math.cos(v.y * 4.3) * 0.1 + Math.sin(v.z * 5.7) * 0.08;
      v.multiplyScalar(n);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#2a2d38"),
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });
    const count = this.lowPower ? 22 : 44;
    this.asteroids = new THREE.InstancedMesh(geo, mat, count);
    this.asteroids.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      do {
        x = (Math.random() * 2 - 1) * 55;
        y = (Math.random() * 2 - 1) * 28;
      } while (Math.abs(x) < 12 && Math.abs(y) < 9);
      this.asteroidData.push({
        pos: new THREE.Vector3(x, y, -Math.random() * 240),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.4),
        scale: 0.4 + Math.pow(Math.random(), 2.5) * 2.6,
      });
    }
    this.scene.add(this.asteroids);
  }

  private buildGallery() {
    const n = this.singles.length;
    if (!n) return;
    const reps = Math.ceil(MIN_SLOTS / n);
    let total = n * reps;
    if (total % 2) total += n; // keep rows paired
    const rows = total / 2;
    this.loopLength = rows * ROW_SPACING;

    const vinylTex = this.track(canvasTexture(drawVinylTexture()));
    const playTex = this.track(canvasTexture(drawPlayIcon()));
    const coverGeo = this.track(new THREE.PlaneGeometry(COVER_SIZE, COVER_SIZE));
    const frameGeo = this.track(new THREE.PlaneGeometry(COVER_SIZE * 1.16, COVER_SIZE * 1.16));
    const vinylGeo = this.track(new THREE.CircleGeometry(COVER_SIZE * 0.47, 64));
    const labelGeo = this.track(new THREE.CircleGeometry(COVER_SIZE * 0.15, 32));
    const holeGeo = this.track(new THREE.CircleGeometry(COVER_SIZE * 0.015, 12));
    const playGeo = this.track(new THREE.PlaneGeometry(0.62, 0.62));
    const pedestalGeo = this.track(new THREE.PlaneGeometry(COVER_SIZE * 1.15, 0.07));

    // One texture per single (shared by every slot that shows it).
    for (const s of this.singles) {
      const canvas = drawPlaceholderCover(s, this.lowPower ? 512 : 768);
      this.coverCanvases.set(s.id, canvas);
      const tex = this.track(canvasTexture(canvas));
      this.coverTextures.set(s.id, tex);
      if (s.cover) this.loadRealCover(s);
    }

    for (let i = 0; i < total; i++) {
      const single = this.singles[i % n];
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const group = new THREE.Group();

      const coverMat = new THREE.MeshBasicMaterial({
        map: this.coverTextures.get(single.id)!,
        transparent: true,
        color: new THREE.Color(0.9, 0.9, 0.9),
      });
      const cover = new THREE.Mesh(coverGeo, coverMat);
      cover.userData.slotIndex = i;
      group.add(cover);

      const frameMat = new THREE.ShaderMaterial({
        vertexShader: holoVert,
        fragmentShader: holoFrag,
        uniforms: {
          uTime: { value: 0 },
          uGlow: { value: 0.6 },
          uOpacity: { value: 1 },
          uInner: { value: 1 / 1.16 },
          uColorA: { value: COLORS.cyan.clone() },
          uColorB: { value: i % 3 === 0 ? COLORS.purple.clone() : COLORS.blue.clone() },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.z = -0.03;
      group.add(frame);

      let vinyl: THREE.Group | null = null;
      if (single.vinyl) {
        vinyl = new THREE.Group();
        const disc = new THREE.Mesh(vinylGeo, new THREE.MeshBasicMaterial({ map: vinylTex, transparent: true }));
        const label = new THREE.Mesh(
          labelGeo,
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(single.palette[2]).multiplyScalar(1.1),
            transparent: true,
          }),
        );
        label.position.z = 0.002;
        const hole = new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true }));
        hole.position.z = 0.004;
        vinyl.add(disc, label, hole);
        vinyl.position.z = -0.09;
        group.add(vinyl);
      }

      const playMat = new THREE.MeshBasicMaterial({ map: playTex, transparent: true, opacity: 0.75 });
      const play = new THREE.Mesh(playGeo, playMat);
      play.position.set(0, -COVER_SIZE * 0.34, 0.02);
      group.add(play);

      const pedestalMat = new THREE.MeshBasicMaterial({
        color: COLORS.cyan.clone(),
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
      pedestal.position.set(0, -COVER_SIZE * 0.66, 0.1);
      pedestal.rotation.x = -1.1;
      group.add(pedestal);

      this.scene.add(group);
      this.slots.push({
        single,
        group,
        cover,
        frameMat,
        playMat,
        pedestalMat,
        vinyl,
        side,
        row,
        jitterY: (Math.sin(i * 12.9898) * 0.5) * 0.7,
        jitterX: (Math.cos(i * 4.1414) * 0.5) * 0.5,
        seed: (i * 0.618) % 1,
        z: 0,
        hover: 0,
        focus: 0,
      });
    }
  }

  private loadRealCover(s: Single) {
    if (!s.cover) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (this.disposed) return;
      // Centre-crop to square and (unless it's finished art) apply the
      // house treatment: cool B&W grade + grunge + LAZY JO wordmark.
      const size = this.lowPower ? 512 : 768;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d")!;
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) * 0.3;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      if (s.placeholder || s.motif === "portrait") {
        ctx.globalCompositeOperation = "saturation";
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = "soft-light";
        ctx.fillStyle = s.palette[2];
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        const overlay = drawPlaceholderCover({ ...s, motif: "bolt", palette: ["#000000", "#000000", "#000000"] }, size);
        // borrow only the wordmark band from the placeholder art
        ctx.drawImage(overlay, 0, 0, size, size * 0.26, 0, 0, size, size * 0.26);
      }
      this.coverCanvases.set(s.id, c);
      this.coverImages.delete(s.id);
      const tex = this.track(canvasTexture(c));
      this.coverTextures.set(s.id, tex);
      for (const slot of this.slots) if (slot.single.id === s.id) slot.cover.material.map = tex;
    };
    img.src = encodeURI(s.cover);
  }

  // ───────────────────────── input ─────────────────────────

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (!this.inputEnabled || this.focused) return;
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= 400;
    d = clamp(d, -240, 240);
    this.nudge(-d * 0.032);
  };

  private nudge(dz: number) {
    // dz < 0 → forward. Keep the target within reach so a hard flick
    // feels like a burst, not a runaway.
    this.targetZ = clamp(this.targetZ + dz, this.camZ - 85, this.camZ + 85);
    if (!this.moved && Math.abs(dz) > 0.01) {
      this.moved = true;
      this.cb.onFirstMove?.();
    }
  }

  private updatePointer(e: PointerEvent) {
    const r = this.container.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.updatePointer(e);
    this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, lastY: e.clientY, vy: 0 };
  };

  private onPointerMove = (e: PointerEvent) => {
    this.updatePointer(e);
    this.pointerInside = e.pointerType === "mouse";
    if (this.down && e.pointerId === this.down.id && e.pointerType !== "mouse") {
      const dy = e.clientY - this.down.lastY;
      this.down.vy = dy;
      this.down.lastY = e.clientY;
      if (this.inputEnabled && !this.focused) this.nudge(dy * 0.07);
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || e.pointerId !== d.id) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (e.pointerType !== "mouse" && this.inputEnabled && !this.focused && moved > 10) {
      this.nudge(d.vy * 0.9); // fling
    }
    if (moved < 10 && performance.now() - d.t < 450 && this.inputEnabled && !this.focused) {
      this.updatePointer(e);
      const slot = this.pick();
      if (slot) this.select(slot);
    }
    if (e.pointerType !== "mouse") this.pointer.set(9, 9);
  };

  private onPointerLeave = () => {
    this.pointerInside = false;
    this.pointer.set(9, 9);
  };

  private onKey = (e: KeyboardEvent) => {
    if (!this.inputEnabled || this.focused) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const onControl = tag === "BUTTON" || tag === "A";
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "PageDown":
        this.nudge(-ROW_SPACING);
        e.preventDefault();
        break;
      case "ArrowDown":
      case "s":
      case "PageUp":
        this.nudge(ROW_SPACING);
        e.preventDefault();
        break;
      case " ":
        if (onControl) return;
        this.nudge(e.shiftKey ? ROW_SPACING * 2 : -ROW_SPACING * 2);
        e.preventDefault();
        break;
      case "Enter":
        if (onControl) return;
        this.openNearest();
        break;
    }
  };

  private bindInput() {
    const el = this.container;
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("keydown", this.onKey);
  }

  private unbindInput() {
    const el = this.container;
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("keydown", this.onKey);
  }

  private pick(): Slot | null {
    if (Math.abs(this.pointer.x) > 1 || Math.abs(this.pointer.y) > 1) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = this.slots.filter((s) => s.cover.material.opacity > 0.3).map((s) => s.cover);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    return hit ? this.slots[hit.object.userData.slotIndex as number] : null;
  }

  private select(slot: Slot) {
    this.focused = slot;
    this.hovered = null;
    this.cb.onHover?.(null);
    this.container.style.cursor = "";
    this.targetZ = this.camZ; // stop exactly here
    this.cb.onSelect?.(slot.single);
  }

  private nearestSlot(): Slot | null {
    let best: Slot | null = null;
    let bestD = Infinity;
    for (const s of this.slots) {
      const d = this.camZ - s.z;
      if (d > 2.5 && d < 32 && d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  // ───────────────────────── frame loop ─────────────────────────

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const aspect = w / h;
    const portrait = aspect < 0.95;
    this.layout = portrait ? { x: 3.05, scale: 0.74, portrait } : { x: 5.6, scale: 1, portrait };
    // Keep a sensible horizontal FOV on tall phones so both rows stay visible.
    if (portrait) {
      const hfov = THREE.MathUtils.degToRad(64);
      this.baseFov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect)), 62, 92);
    } else this.baseFov = 62;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * 0.5, h * 0.5);
    this.stars.material.uniforms.uPixelRatio.value = this.pixelRatio;
    this.dust.material.uniforms.uPixelRatio.value = this.pixelRatio;
  }

  private adaptQuality(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 1 / 40 && this.pixelRatio > 0.8) {
      this.pixelRatio = Math.max(0.8, this.pixelRatio - 0.25);
      this.resize();
    } else if (avg < 1 / 58 && this.pixelRatio < Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 1.75)) {
      this.pixelRatio = Math.min(this.pixelRatio + 0.125, 2);
      this.resize();
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();
    this.adaptQuality(dt);
    this.step(dt, t);
    this.composer.render(dt);
  };

  private step(dt: number, t: number) {
    // ── flight ──
    if (!this.focused && (!this.hovered || !this.inputEnabled)) {
      this.targetZ -= this.idleDrift * (this.inputEnabled ? 1 : 2.2) * dt;
    }
    const prev = this.camZ;
    this.camZ = damp(this.camZ, this.targetZ, this.focused ? 6 : 2.4, dt);
    this.speed = (prev - this.camZ) / Math.max(dt, 1e-4);
    this.smoothSpeed = damp(this.smoothSpeed, this.speed, 6, dt);
    const absSpeed = Math.abs(this.smoothSpeed);
    const speedK = smoothstep(2, 45, absSpeed);

    // ── camera ──
    const look = this.focused ? 0 : 1;
    if (this.pointerInside) this.parallax.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    else this.parallax.multiplyScalar(Math.exp(-dt * 2));
    const bob = this.reducedMotion ? 0 : Math.sin(t * 0.8) * 0.06;
    this.camera.position.set(0, 0.2 + bob, this.camZ);
    this.camera.rotation.set(
      this.parallax.y * 0.035 * look,
      -this.parallax.x * 0.055 * look,
      (-this.parallax.x * 0.015 + (this.reducedMotion ? 0 : Math.sin(t * 0.37) * 0.006)) * look,
    );
    const fov = this.baseFov + (this.reducedMotion ? 0 : speedK * 9);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, fov, 4, dt);
      this.camera.updateProjectionMatrix();
    }

    // ── far field travels with the camera ──
    this.sky.position.copy(this.camera.position);
    this.sky.material.uniforms.uTime.value = t;
    this.sky.material.uniforms.uTravel.value = this.camZ;
    this.planets.position.set(0, 0, this.camZ);
    for (const p of this.planetSpin) p.rotation.y = t * 0.01;
    this.ufo.group.position.z = this.camZ - 125;
    this.ufo.update(t, speedK);

    for (const pts of [this.stars, this.dust]) {
      pts.material.uniforms.uCamZ.value = this.camZ;
      pts.material.uniforms.uTime.value = t;
    }
    this.streaks.material.uniforms.uCamZ.value = this.camZ;
    this.streaks.material.uniforms.uStretch.value = Math.min(absSpeed * 0.28, 14) * Math.sign(this.smoothSpeed || 1);
    this.streaks.material.uniforms.uOpacity.value = smoothstep(5, 30, absSpeed) * 0.6;
    this.lanes.position.z = this.camZ - 210;
    this.lanes.material.uniforms.uCamZ.value = this.camZ;
    this.lanes.material.uniforms.uTime.value = t;
    this.lanes.material.uniforms.uSpeed.value = speedK;

    // asteroids
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const D = 240;
    this.asteroidData.forEach((a, i) => {
      a.rot.x += a.spin.x * dt;
      a.rot.y += a.spin.y * dt;
      a.rot.z += a.spin.z * dt;
      const rel = (((a.pos.z - this.camZ - 10) % D) + D) % D - D;
      p.set(a.pos.x + Math.sin(t * 0.05 + i) * 1.5, a.pos.y, this.camZ + 10 + rel);
      q.setFromEuler(a.rot);
      sc.setScalar(a.scale * smoothstep(D, D * 0.75, -rel));
      m4.compose(p, q, sc);
      this.asteroids.setMatrixAt(i, m4);
    });
    this.asteroids.instanceMatrix.needsUpdate = true;

    // ── gallery ──
    this.updateHover();
    this.dim = damp(this.dim, this.focused ? 1 : 0, 5, dt);
    this.updateSlots(dt, t);
    this.updateNearest();

    // ── post ──
    this.flash = damp(this.flash, 0, 2.5, dt);
    const u = this.cinematic.uniforms;
    u.uBlur.value = this.reducedMotion ? 0 : speedK * 0.9;
    u.uTime.value = t;
    u.uFlash.value = this.flash;
    u.uAberration.value = 0.0012 + speedK * 0.002;
    this.bloom.strength = 0.55 + speedK * 0.3;

    this.cb.onFrame?.(absSpeed);
    if (t - this.lastTelemetry > 0.12) {
      this.lastTelemetry = t;
      this.cb.onTelemetry?.({ speed: absSpeed, distance: -this.camZ });
    }
  }

  private updateHover() {
    if (!this.inputEnabled || this.focused || !this.pointerInside) {
      if (this.hovered) {
        this.hovered = null;
        this.cb.onHover?.(null);
        this.container.style.cursor = "";
      }
      return;
    }
    const slot = this.pick();
    if (slot !== this.hovered) {
      this.hovered = slot;
      this.cb.onHover?.(slot ? slot.single : null);
      this.container.style.cursor = slot ? "pointer" : "";
    }
  }

  private updateNearest() {
    const s = this.nearestSlot();
    const single = s ? s.single : null;
    if (single !== this.nearest) {
      this.nearest = single;
      this.cb.onNearest?.(single);
    }
  }

  private focusPose(out: THREE.Vector3): number {
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const portrait = this.layout.portrait;
    const frac = portrait ? 0.27 : 0.56;
    const d = COVER_SIZE / (frac * 2 * Math.tan(vfov / 2));
    const visH = 2 * d * Math.tan(vfov / 2);
    const visW = visH * this.camera.aspect;
    out.set(portrait ? 0 : -visW * 0.21, this.camera.position.y + (portrait ? visH * 0.22 : visH * 0.01), this.camZ - d);
    return 1;
  }

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private qA = new THREE.Quaternion();
  private qB = new THREE.Quaternion();
  private eul = new THREE.Euler();

  private updateSlots(dt: number, t: number) {
    const L = this.loopLength;
    const { x: corridorX, scale } = this.layout;
    for (const s of this.slots) {
      const baseZ = -s.row * ROW_SPACING - 6;
      if (s.focus < 0.001) {
        const k = Math.floor((this.camZ + 12 - baseZ) / L);
        s.z = baseZ + k * L;
      }
      const dist = this.camZ - s.z;
      const isHover = s === this.hovered;
      const isFocus = s === this.focused;
      s.hover = damp(s.hover, isHover ? 1 : 0, 9, dt);
      s.focus = damp(s.focus, isFocus ? 1 : 0, isFocus ? 4.2 : 5, dt);
      if (!isFocus && s.focus < 0.002) s.focus = 0;

      // gallery pose
      const rotY = -s.side * 0.42;
      const bob = this.reducedMotion ? 0 : Math.sin(t * 0.6 + s.seed * 10) * 0.12;
      const fwd = s.hover * 0.75;
      this.tmpA.set(
        s.side * corridorX + s.jitterX * scale + Math.sin(rotY) * fwd,
        s.jitterY * scale + bob + 0.3,
        s.z + Math.cos(rotY) * fwd,
      );
      this.eul.set(0, rotY, Math.sin(t * 0.4 + s.seed * 6) * 0.015);
      this.qA.setFromEuler(this.eul);
      let sc = scale * (1 + s.hover * 0.06);

      if (s.focus > 0) {
        const e = easeInOut(clamp(s.focus, 0, 1));
        this.focusPose(this.tmpB);
        this.tmpB.y += Math.sin(t * 1.1) * 0.04;
        this.tmpA.lerp(this.tmpB, e);
        this.eul.set(Math.sin(t * 0.7) * 0.02, (this.layout.portrait ? 0 : 0.16) + Math.sin(t * 0.5) * 0.03, 0);
        this.qB.setFromEuler(this.eul);
        this.qA.slerp(this.qB, e);
        sc = THREE.MathUtils.lerp(sc, 1, e);
      }
      s.group.position.copy(this.tmpA);
      s.group.quaternion.copy(this.qA);
      s.group.scale.setScalar(sc);

      // fades: far fog-in, and dim the others while one is presented
      const far = smoothstep(L - 10, L - 34, dist);
      const dimK = isFocus ? 0 : this.dim * 0.8;
      const opacity = far * (1 - dimK);
      s.cover.material.opacity = opacity;
      s.group.visible = opacity > 0.01;
      const shade = 0.8 + s.hover * 0.12;
      s.cover.material.color.setScalar(shade);

      const glow = 0.4 + s.hover * 0.9 + s.focus * 0.5 + Math.sin(t * 1.3 + s.seed * 9) * 0.08;
      s.frameMat.uniforms.uGlow.value = glow;
      s.frameMat.uniforms.uOpacity.value = opacity;
      s.frameMat.uniforms.uTime.value = t + s.seed * 5;
      s.playMat.opacity = (0.55 + s.hover * 0.45) * opacity * (1 - s.focus);
      s.pedestalMat.opacity = (0.3 + s.hover * 0.5) * opacity * (1 - s.focus);
      s.playMat.visible = s.pedestalMat.visible = s.focus < 0.05;

      if (s.vinyl) {
        const out = Math.max(s.hover, s.focus);
        const dir = s.focus > 0.5 ? 1 : -s.side;
        s.vinyl.position.x = dir * COVER_SIZE * (0.26 + out * 0.2);
        s.vinyl.rotation.z -= dt * (0.25 + out * 2.6);
        for (const c of s.vinyl.children) {
          const mm = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mm.opacity = opacity;
        }
      }
    }
  }
}
