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
  farStarsFrag,
  farStarsVert,
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
  drawStarSpike,
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
  /** pointer is over the UFO (click = beam me a song) */
  onUfoHover?(over: boolean): void;
  /** the UFO picked a random single and is flying there */
  onBeam?(single: Single): void;
  /** pointer is over the purple JAVEDA planet */
  onJavedaHover?(over: boolean): void;
  /** the warp toward the JAVEDA planet started / finished (navigate on done) */
  onTravelStart?(): void;
  /** the dive into the planet is about to finish (fade the page out now) */
  onTravelArrive?(): void;
  onTravelDone?(): void;
  /** where the JAVEDA planet is on screen (px), for the HTML "JAVEDA" button */
  onJavedaScreen?(p: { x: number; y: number; r: number; visible: boolean }): void;
  /** pointer over the spiral galaxy / galaxy clicked (open the Lazy Jo card) */
  onGalaxyHover?(over: boolean): void;
  /** where the galaxy is on screen (px), for the glowing dot */
  onGalaxyScreen?(p: { x: number; y: number; visible: boolean }): void;
  /** Screen rect (px) of the presented cover's artwork, ~30 fps; null when nothing is presented. */
  onFocusScreen?(r: { x: number; y: number; w: number; h: number } | null): void;
  onGalaxy?(): void;
}

interface Slot {
  single: Single;
  group: THREE.Group;
  cover: THREE.Mesh; // the sleeve (box) — raycast target
  front: THREE.MeshPhysicalMaterial; // artwork face
  shell: THREE.MeshStandardMaterial; // edges + back
  frameMat: THREE.ShaderMaterial;
  playMat: THREE.MeshBasicMaterial;
  /** glowing release year under the cover (null when the single has no year) */
  yearMat: THREE.MeshBasicMaterial | null;
  vinyl: THREE.Group | null;
  vinylMats: THREE.Material[];
  /** the record's centre label, printed with the song's artwork */
  labelMat: THREE.MeshStandardMaterial | null;
  side: -1 | 1;
  row: number;
  jitterY: number;
  jitterX: number;
  seed: number;
  z: number;
  hover: number;
  focus: number; // 0 → in slot, 1 → presented to camera
  tilt: THREE.Vector2; // eased lean toward the cursor while hovered
}

const COLORS = {
  deep: new THREE.Color("#030712"),
  blue: new THREE.Color("#00BFFF"),
  cyan: new THREE.Color("#00F5FF"),
  purple: new THREE.Color("#7B2CFF"),
};

const ROW_SPACING = 9;
const MIN_SLOTS = 24;
/** Glowing release year under each cover, in the song's colour (approved by Jo 2026-11-24). */
const YEAR_LABELS = true;
const COVER_SIZE = 3.4;
const SLEEVE_DEPTH = 0.06;
/** One sun for the whole system: planets, asteroids, sleeves and the UFO agree on it. */
const SUN = new THREE.Vector3(-0.55, 0.38, 0.74).normalize();

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
  /** an eased flight through the songs to one picked from the list */
  private journey: { from: number; to: number; t: number; dur: number } | null = null;

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

  // music + interaction
  private music = 0;
  private bass = 0;
  private surge = 0;
  private lastBeamId: string | null = null;
  private hoverUv = new THREE.Vector2(0.5, 0.5);
  private ufoHovered = false;
  private cursorLight!: THREE.PointLight;
  private cursorLightK = 0;
  private gyro = new THREE.Vector2();
  private gyroBase: { b: number; g: number } | null = null;
  private shooting: { line: THREE.Line; t: number; dur: number; from: THREE.Vector3; dir: THREE.Vector3; len: number }[] = [];
  private nextShoot = 4;
  // the purple planet = gateway to JAVEDA (a separate product: we only link to it)
  private javeda!: { planet: THREE.Mesh; ringMat: THREE.ShaderMaterial; hit: THREE.Mesh; group: THREE.Group; r: number };
  private galaxy!: { hit: THREE.Mesh; glow: THREE.Sprite; dir: THREE.Vector3 };
  private galaxyHovered = false;
  private galaxyHover = 0;
  private gazing = false;
  private gaze = 0;
  private lastJavedaScreen = 0;
  private javedaHovered = false;
  private javedaHover = 0;
  private travel: { t: number; fromPos: THREE.Vector3; fromQuat: THREE.Quaternion; target: THREE.Vector3; done: boolean; arrived: boolean } | null = null;
  private farStars = new THREE.Group();
  private farStarMats: THREE.ShaderMaterial[] = [];
  private planetMats: THREE.ShaderMaterial[] = [];
  private stars!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private dust!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private streaks!: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private lanes!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private planets = new THREE.Group();
  private planetSpin: THREE.Mesh[] = [];
  private asteroids!: THREE.InstancedMesh;
  private asteroidData: { pos: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; scale: number; stretch: THREE.Vector3 }[] = [];
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
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.className = "lj-canvas";
    container.appendChild(this.renderer.domElement);

    const { clientWidth: w, clientHeight: h } = container;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, w / h, 0.1, 2000);
    this.scene.add(this.camera);

    this.glowTex = this.track(canvasTexture(drawGlowSprite()));
    this.glowTex.colorSpace = THREE.NoColorSpace;

    this.buildSky();
    this.buildLights();
    this.buildStars();
    this.buildStreaks();
    this.buildLanes();
    this.buildPlanets();
    this.buildAsteroids();
    this.ufo = createUfo(this.glowTex);
    this.scene.add(this.ufo.group);
    this.buildGallery();
    this.buildInteraction();

    // Post-processing: bloom → cinematic (motion blur / CA / vignette) → tone map.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    // tone map first, then grade/blur in display space
    this.composer.addPass(new OutputPass());
    this.cinematic = new ShaderPass(CinematicShader);
    this.composer.addPass(this.cinematic);

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
    // land at the start of the road, just before the first single (the newest), however
    // far the camera drifted while the entrance screen was up
    const minJump = this.reducedMotion ? 12 : 40;
    const L = this.loopLength || 1;
    const firstRow = -6 + 9; // camera stop in front of row 0 (slot z = -row * ROW_SPACING - 6, cam = z + 9)
    let target = firstRow + Math.floor((this.camZ - minJump - firstRow) / L) * L;
    if (!Number.isFinite(target)) target = this.targetZ - 58;
    this.targetZ = target;
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

  private yearTextures = new Map<string, THREE.CanvasTexture>();
  /** "2024" in Syne, white core with a glow in the song's accent colour. */
  private yearTexture(s: Single): THREE.CanvasTexture {
    const key = `${s.year}|${s.palette[1]}`;
    const hit = this.yearTextures.get(key);
    if (hit) return hit;
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 192;
    const ctx = c.getContext("2d")!;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 104px Syne, Manrope, sans-serif";
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "10px";
    const text = String(s.year);
    // wide soft glow, then a tighter one, then the bright core
    ctx.shadowColor = s.palette[1];
    ctx.fillStyle = s.palette[1];
    ctx.shadowBlur = 46;
    ctx.globalAlpha = 0.9;
    ctx.fillText(text, 256, 100);
    ctx.shadowBlur = 18;
    ctx.fillText(text, 256, 100);
    ctx.shadowBlur = 6;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, 256, 100);
    const tex = this.track(canvasTexture(c));
    this.yearTextures.set(key, tex);
    return tex;
  }

  /** Fly to the nearest instance of a single, then present it. */
  async open(singleId: string) {
    const candidates = this.slots.filter((s) => s.single.id === singleId);
    if (!candidates.length) return;
    // Stay on the current pass of the road (never cut across the loop seam), so picking an
    // older song really flies through every song in between: newest → oldest is back in time.
    const L = this.loopLength;
    const firstRow = -6 + 9;
    const lap = Math.floor((firstRow + ROW_SPACING / 2 - this.camZ) / L);
    let best: { slot: Slot; camTarget: number } | null = null;
    for (const s of candidates) {
      const camTarget = -s.row * ROW_SPACING - 6 - lap * L + 9;
      if (!best || Math.abs(camTarget - this.camZ) < Math.abs(best.camTarget - this.camZ)) best = { slot: s, camTarget };
    }
    if (!best) return;
    const dist = Math.abs(best.camTarget - this.camZ);
    const t0 = performance.now();
    if (dist > 12 && !this.reducedMotion) {
      // a real journey through the catalogue: accelerate, fly past the covers, brake at the song
      const dur = Math.min(Math.max(0.9 + dist / 70, 1.0), 3.2);
      this.journey = { from: this.camZ, to: best.camTarget, t: 0, dur };
      this.flash = 0.18;
      await new Promise<void>((resolve) => {
        const check = () => {
          if (this.disposed || !this.journey || performance.now() - t0 > (dur + 1.5) * 1000) return resolve();
          requestAnimationFrame(check);
        };
        check();
      });
      this.journey = null;
    } else {
      this.targetZ = best.camTarget;
      await new Promise<void>((resolve) => {
        const check = () => {
          if (this.disposed) return resolve();
          if (Math.abs(this.camZ - this.targetZ) < 0.35 || performance.now() - t0 > 4500) resolve();
          else requestAnimationFrame(check);
        };
        check();
      });
    }
    this.select(best.slot);
  }

  /** Preview audio levels (0..1), fed every frame while a song plays. */
  setMusic(level: number, bass: number) {
    this.music = level;
    this.bass = bass;
  }

  /** The UFO picks a random single (not the last one) and flies you to it. */
  beamRandom() {
    if (this.focused || !this.singles.length) return;
    const pool = this.singles.filter((s) => s.id !== this.lastBeamId);
    const pick = pool[Math.floor(Math.random() * pool.length)] || this.singles[0];
    this.lastBeamId = pick.id;
    this.surge = 1;
    this.flash = this.reducedMotion ? 0 : 0.22;
    this.cb.onBeam?.(pick);
    void this.open(pick.id);
  }

  /** After a purchase: the UFO surges and beams the bought record down to the visitor. */
  deliver(singleId: string) {
    this.surge = 1.6;
    this.flash = this.reducedMotion ? 0 : 0.45;
    void this.open(singleId);
  }

  /** Warp toward the purple planet, then hand over to JAVEDA (onTravelDone). */
  travelToJaveda() {
    if (this.travel || this.focused) return;
    this.planets.updateMatrixWorld(true);
    const target = new THREE.Vector3();
    this.javeda.planet.getWorldPosition(target);
    this.travel = { t: 0, fromPos: this.camera.position.clone(), fromQuat: this.camera.quaternion.clone(), target, done: false, arrived: false };
    this.inputEnabled = false;
    if (this.javedaHovered) {
      this.javedaHovered = false;
      this.cb.onJavedaHover?.(false);
    }
    this.container.style.cursor = "";
    this.cb.onTravelStart?.();
  }

  /** Zoom into the galaxy (the Lazy Jo card opens on top). */
  openGalaxy() {
    if (this.travel || this.focused) return;
    this.gazing = true;
    this.inputEnabled = false;
    this.targetZ = this.camZ;
    if (this.galaxyHovered) {
      this.galaxyHovered = false;
      this.cb.onGalaxyHover?.(false);
    }
    this.container.style.cursor = "";
    this.cb.onGalaxy?.();
  }

  closeGalaxy() {
    if (!this.gazing) return;
    this.gazing = false;
    this.inputEnabled = true;
  }

  /** Back from JAVEDA via the browser's back button: put everything back. */
  resetTravel() {
    const tr = this.travel;
    if (!tr) return;
    this.travel = null;
    this.camZ = this.targetZ = tr.fromPos.z;
    this.camera.position.copy(tr.fromPos);
    this.camera.quaternion.copy(tr.fromQuat);
    this.flash = 0;
    this.inputEnabled = true;
  }

  /** Open whichever single is closest ahead. */
  openNearest() {
    const s = this.nearestSlot();
    if (s) this.select(s);
  }

  /** Send the presented cover back to its place in the gallery. */
  unfocus() {
    this.setCoverVideo(null, null);
    this.focused = null;
  }

  private videoTex: THREE.VideoTexture | null = null;

  /** Play a music-video loop on the presented cover (null puts the artwork back). */
  setCoverVideo(id: string | null, el: HTMLVideoElement | null) {
    if (this.videoTex) {
      for (const slot of this.slots) {
        if (slot.front.map !== this.videoTex) continue;
        const tex = this.coverTextures.get(slot.single.id)!;
        slot.front.map = tex;
        slot.front.emissiveMap = tex;
        slot.front.needsUpdate = true;
      }
      this.videoTex.dispose();
      this.videoTex = null;
    }
    const slot = this.focused;
    if (!el || !id || !slot || slot.single.id !== id) return;
    const tex = new THREE.VideoTexture(el);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.videoTex = tex;
    slot.front.map = tex;
    slot.front.emissiveMap = tex;
    slot.front.needsUpdate = true;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.unbindInput();
    window.removeEventListener("deviceorientation", this.onOrient);
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

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(new THREE.Color("#1b2140"), 0.35));
    const sun = new THREE.DirectionalLight(new THREE.Color("#fff3e6"), 2.4);
    sun.position.copy(SUN).multiplyScalar(100);
    this.scene.add(sun);
    // cool bounce from the UFO / nebula side so shadows aren't dead black
    const fill = new THREE.DirectionalLight(new THREE.Color("#5aa8ff"), 0.6);
    fill.position.set(0.4, -0.2, -1).multiplyScalar(100);
    this.scene.add(fill);
  }

  private buildSky() {
    // The nebula shader is heavy (domain-warped noise), so it runs once at
    // start-up into an HDR cubemap. That cubemap is the background AND, via
    // PMREM, the environment every glossy surface reflects.
    const size = this.lowPower ? 512 : 1024;
    const cubeRT = this.track(
      new THREE.WebGLCubeRenderTarget(size, {
        type: THREE.HalfFloatType,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
      }),
    );
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: {
        uBlue: { value: new THREE.Color("#1f5fff") },
        uCyan: { value: COLORS.cyan.clone() },
        uPurple: { value: COLORS.purple.clone() },
        uMagenta: { value: new THREE.Color("#c03cff") },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    const skyScene = new THREE.Scene();
    const skyGeo = new THREE.SphereGeometry(40, 64, 32);
    skyScene.add(new THREE.Mesh(skyGeo, skyMat));
    const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
    cubeCam.update(this.renderer, skyScene);
    this.scene.background = cubeRT.texture;

    // Reflections: the sky plus a few bright "light cards" (UFO glow, sun) so
    // gloss reads as gloss.
    const card = (dir: THREE.Vector3, color: THREE.Color, k: number, r: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(k) }));
      m.position.copy(dir).normalize().multiplyScalar(30);
      skyScene.add(m);
    };
    card(new THREE.Vector3(0, 0.1, -1), COLORS.cyan, 6, 4);
    card(SUN, new THREE.Color("#fff1dd"), 14, 2.2);
    card(new THREE.Vector3(-1, 0.2, 0.3), COLORS.purple, 3, 6);
    card(new THREE.Vector3(1, -0.1, 0.2), COLORS.blue, 2.5, 6);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(skyScene, 0.02, 0.1, 100);
    this.scene.environment = env.texture;
    this.track(env);
    pmrem.dispose();
    skyScene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
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
    // Near stars: these parallax past you and sell the speed.
    const white = new THREE.Color("#ffffff");
    const ice = new THREE.Color("#cfe6ff");
    this.stars = this.makePoints(
      this.lowPower ? 1800 : 4200,
      520,
      [220, 130],
      [9, 6],
      [white, white, ice, new THREE.Color("#ffe2c4")],
      1.5,
    );
    this.scene.add(this.stars);
    // Fine dust drifting through the corridor — barely there.
    this.dust = this.makePoints(
      this.lowPower ? 300 : 700,
      150,
      [16, 9],
      [1.6, 1.2],
      [new THREE.Color("#9fc4ff").multiplyScalar(0.35), new THREE.Color("#b9a6ff").multiplyScalar(0.3)],
      0.3,
    );
    this.scene.add(this.dust);

    // Far stars: infinitely distant (travel with the camera), crisp, with
    // real colour temperatures and a power-law brightness spread.
    const temp = (k: number) =>
      k < 0.1 ? new THREE.Color("#9bb5ff") : k < 0.35 ? new THREE.Color("#cad8ff") : k < 0.75 ? new THREE.Color("#fff4ea") : k < 0.93 ? new THREE.Color("#ffd9b0") : new THREE.Color("#ffb78a");
    const mkLayer = (count: number, minSize: number, maxSize: number, bright: number, tex: THREE.Texture) => {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const size = new Float32Array(count);
      const seed = new Float32Array(count);
      const v = new THREE.Vector3();
      const bandN = new THREE.Vector3(0.22, 1, 0.18).normalize();
      for (let i = 0; i < count; i++) {
        // more stars toward the galactic band, like the real sky
        do {
          v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        } while (v.lengthSq() > 1 || v.lengthSq() < 0.01 || Math.random() > 0.35 + 0.65 * Math.exp(-Math.pow(v.clone().normalize().dot(bandN), 2) / 0.08));
        v.normalize().multiplyScalar(900);
        pos.set([v.x, v.y, v.z], i * 3);
        const m = Math.pow(Math.random(), 3.2);
        const c = temp(Math.random()).multiplyScalar(bright * (0.35 + 1.4 * m));
        col.set([c.r, c.g, c.b], i * 3);
        size[i] = minSize + (maxSize - minSize) * m;
        seed[i] = Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
      geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      const mat = new THREE.ShaderMaterial({
        vertexShader: farStarsVert,
        fragmentShader: farStarsFrag,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: this.pixelRatio }, uMap: { value: tex } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      this.farStarMats.push(mat);
      this.farStars.add(pts);
    };
    const spikeTex = this.track(canvasTexture(drawStarSpike()));
    spikeTex.colorSpace = THREE.NoColorSpace;
    mkLayer(this.lowPower ? 2500 : 6000, 1.2, 4.5, 1.0, this.glowTex);
    mkLayer(this.lowPower ? 25 : 55, 14, 34, 1.6, spikeTex);
    this.farStars.renderOrder = -8;
    this.scene.add(this.farStars);

    // The spiral galaxy is painted into the sky; this is its clickable twin.
    const gdir = new THREE.Vector3(0, 0.5, -1).normalize();
    const ghit = new THREE.Mesh(new THREE.SphereGeometry(75, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    ghit.position.copy(gdir).multiplyScalar(800);
    const gglow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color("#c9b2ff"), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    gglow.position.copy(ghit.position);
    gglow.scale.set(330, 200, 1);
    this.farStars.add(ghit, gglow);
    this.galaxy = { hit: ghit, glow: gglow, dir: gdir };
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
    this.lanes.position.y = -4.4;
    this.lanes.frustumCulled = false;
    this.scene.add(this.lanes);
  }

  private buildPlanets() {
    let created: THREE.Mesh | null = null;
    const mk = (r: number, pos: [number, number, number], type: number, atmo: string, seed: number, tilt: number, parent: THREE.Object3D = this.planets) => {
      const seg = this.lowPower ? 48 : 96;
      const uniforms = {
        uSun: { value: SUN },
        uAtmo: { value: new THREE.Color(atmo) },
        uSeed: { value: seed },
        uType: { value: type },
        uTime: { value: 0 },
      };
      const mat = new THREE.ShaderMaterial({ vertexShader: planetVert, fragmentShader: planetFrag, uniforms });
      this.planetMats.push(mat);
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), mat);
      m.position.set(...pos);
      m.rotation.z = tilt;
      parent.add(m);
      this.planetSpin.push(m);
      created = m;
      if (type !== 1) {
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(r * 1.035, seg, seg / 2),
          new THREE.ShaderMaterial({
            vertexShader: planetVert,
            fragmentShader: atmoFrag,
            uniforms: { uAtmo: uniforms.uAtmo, uSun: uniforms.uSun },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
          }),
        );
        halo.position.copy(m.position);
        parent.add(halo);
      }
    };
    mk(6.5, [-70, 36, -185], 1, "#000000", 4.2, 0.1); // moon
    mk(5.2, [24, 30, -170], 0, "#4aa8ff", 1.7, 0.4); // small ocean world
    // JAVEDA: the big ringed purple world. Click it to warp into Lazy Jo's
    // playable album. Its position depends on the screen shape (see resize).
    const jr = 30;
    const jg = new THREE.Group();
    this.planets.add(jg);
    mk(jr, [0, 0, 0], 2, "#b98bff", 8.1, 0.25, jg);
    const planet = created as unknown as THREE.Mesh;
    const ringMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying float vR;
        void main(){ vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uInner; uniform float uOuter; uniform float uGlow; uniform float uTime;
        uniform vec3 uA; uniform vec3 uB;
        varying float vR;
        void main(){
          float k = (vR - uInner) / (uOuter - uInner);
          float bands = 0.55 + 0.45 * sin(k * 46.0) * sin(k * 13.0 + 1.3);
          float edge = smoothstep(0.0, 0.07, k) * smoothstep(1.0, 0.72, k);
          float sweep = 0.75 + 0.25 * sin(uTime * 1.6 - k * 6.0);
          vec3 col = mix(uA, uB, k);
          gl_FragColor = vec4(col * (1.2 + uGlow), edge * bands * sweep * (0.35 + 0.45 * uGlow));
        }
      `,
      uniforms: {
        uInner: { value: jr * 1.45 },
        uOuter: { value: jr * 2.5 },
        uGlow: { value: 0.4 },
        uTime: { value: 0 },
        uA: { value: new THREE.Color("#c9a6ff") },
        uB: { value: new THREE.Color("#7B2CFF") },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(jr * 1.45, jr * 2.5, 160, 1), ringMat);
    ring.rotation.set(1.18, 0.25, 0.32);
    jg.add(ring);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(jr * 1.2, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
    jg.add(hit);
    this.javeda = { planet, ringMat, hit, group: jg, r: jr };
    this.scene.add(this.planets);
  }

  private buildAsteroids() {
    // Lumpy rock: random-direction ridges + craters on a dense sphere.
    const geo = new THREE.IcosahedronGeometry(1, this.lowPower ? 3 : 4);
    const p = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const waves = Array.from({ length: 9 }, (_, i) => ({
      d: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      f: 1.5 + i * 1.3,
      a: 0.16 / (1 + i * 0.6),
      ph: Math.random() * 6,
    }));
    const craters = Array.from({ length: 7 }, () => ({
      c: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      r: 0.2 + Math.random() * 0.3,
    }));
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      let h = 1;
      for (const w of waves) h += Math.sin(v.dot(w.d) * w.f * 3 + w.ph) * w.a;
      for (const c of craters) {
        const d = v.distanceTo(c.c) / c.r;
        if (d < 1) h -= (1 - d * d) * 0.09 - (d > 0.75 ? (d - 0.75) * 0.12 : 0);
      }
      v.multiplyScalar(h);
      p.setXYZ(i, v.x, v.y * 0.82, v.z);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#6b655f"),
      roughness: 0.93,
      metalness: 0.02,
      envMapIntensity: 0.4,
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
        scale: 0.35 + Math.pow(Math.random(), 2.5) * 2.4,
        stretch: new THREE.Vector3(0.8 + Math.random() * 0.5, 0.7 + Math.random() * 0.4, 0.8 + Math.random() * 0.5),
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
    // Sleeve = a thin box: artwork on the front, dark card on edges/back.
    const sleeveGeo = this.track(new THREE.BoxGeometry(COVER_SIZE, COVER_SIZE, SLEEVE_DEPTH));
    const frameGeo = this.track(new THREE.PlaneGeometry(COVER_SIZE * 1.12, COVER_SIZE * 1.12));
    // Record: a real disc (cylinder) with grooved faces + a paper label.
    const discGeo = this.track(new THREE.CylinderGeometry(COVER_SIZE * 0.47, COVER_SIZE * 0.47, 0.022, 96, 1));
    discGeo.rotateX(Math.PI / 2);
    const labelGeo = this.track(new THREE.CircleGeometry(COVER_SIZE * 0.2, 64));
    const holeGeo = this.track(new THREE.CircleGeometry(COVER_SIZE * 0.014, 16));
    const playGeo = this.track(new THREE.PlaneGeometry(0.62, 0.62));
    const yearGeo = this.track(new THREE.PlaneGeometry(1.6, 0.6));

    // One texture per single (shared by every slot that shows it).
    for (const s of this.singles) {
      const canvas = drawPlaceholderCover(s, this.lowPower ? 512 : 1024);
      this.coverCanvases.set(s.id, canvas);
      const tex = this.track(canvasTexture(canvas));
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.coverTextures.set(s.id, tex);
      if (s.cover) this.loadRealCover(s);
    }

    for (let i = 0; i < total; i++) {
      const single = this.singles[i % n];
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const group = new THREE.Group();
      const tex = this.coverTextures.get(single.id)!;

      // Glossy printed card: lit by the sun + environment, with a clear-coat
      // that catches the nebula and UFO glow as you fly past. A little
      // emissive keeps the art readable on the shadow side.
      const front = new THREE.MeshPhysicalMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(1, 1, 1),
        emissiveIntensity: 0.42,
        roughness: 0.48,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.14,
        envMapIntensity: 0.9,
        transparent: true,
      });
      const shell = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0c0e13"),
        roughness: 0.55,
        metalness: 0.15,
        transparent: true,
      });
      // BoxGeometry groups: +x, -x, +y, -y, +z (front), -z (back)
      const cover = new THREE.Mesh(sleeveGeo, [shell, shell, shell, shell, front, shell]);
      cover.userData.slotIndex = i;
      group.add(cover);

      // the frame glows in the song's own colours (picked from its cover)
      const accent = new THREE.Color(single.palette[2]);
      const accentMain = new THREE.Color(single.palette[1]);
      const frameMat = new THREE.ShaderMaterial({
        vertexShader: holoVert,
        fragmentShader: holoFrag,
        uniforms: {
          uTime: { value: 0 },
          uGlow: { value: 0.2 },
          uOpacity: { value: 1 },
          uInner: { value: 1 / 1.12 },
          uColorA: { value: accentMain.clone().lerp(COLORS.cyan, 0.15) },
          uColorB: { value: accent.clone() },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.z = -SLEEVE_DEPTH;
      group.add(frame);

      let vinyl: THREE.Group | null = null;
      const vinylMats: THREE.Material[] = [];
      let labelMat: THREE.MeshStandardMaterial | null = null;
      {
        // every single comes on a record; its label is printed with the artwork, so it spins with the music
        vinyl = new THREE.Group();
        const grooves = new THREE.MeshPhysicalMaterial({
          map: vinylTex,
          color: new THREE.Color("#2a2a2e"),
          roughness: 0.32,
          metalness: 0.0,
          clearcoat: 1,
          clearcoatRoughness: 0.18,
          envMapIntensity: 1.3,
          transparent: true,
        });
        const edge = new THREE.MeshStandardMaterial({ color: "#050506", roughness: 0.4, transparent: true });
        const disc = new THREE.Mesh(discGeo, [edge, grooves, grooves]);
        labelMat = new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: new THREE.Color(1, 1, 1),
          emissiveIntensity: 0.32,
          roughness: 0.6,
          transparent: true,
        });
        const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true });
        for (const z of [0.0115, -0.0115]) {
          const label = new THREE.Mesh(labelGeo, labelMat);
          label.position.z = z;
          if (z < 0) label.rotation.y = Math.PI;
          const hole = new THREE.Mesh(holeGeo, holeMat);
          hole.position.z = z * 1.05;
          if (z < 0) hole.rotation.y = Math.PI;
          vinyl.add(label, hole);
        }
        vinyl.add(disc);
        vinyl.position.z = -SLEEVE_DEPTH * 0.5 - 0.03;
        group.add(vinyl);
        vinylMats.push(grooves, edge, labelMat, holeMat);
      }

      // the release year, glowing in the song's own colour, floating under the cover
      let yearMat: THREE.MeshBasicMaterial | null = null;
      if (YEAR_LABELS && single.year) {
        yearMat = new THREE.MeshBasicMaterial({
          map: this.yearTexture(single),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const year = new THREE.Mesh(yearGeo, yearMat);
        year.position.set(0, -COVER_SIZE / 2 - 0.5, 0.03);
        group.add(year);
      }
      const playMat = new THREE.MeshBasicMaterial({ map: playTex, transparent: true, opacity: 0, depthWrite: false });
      const play = new THREE.Mesh(playGeo, playMat);
      play.position.set(0, -COVER_SIZE * 0.34, SLEEVE_DEPTH / 2 + 0.01);
      group.add(play);

      this.scene.add(group);
      this.slots.push({
        single,
        group,
        cover,
        front,
        shell,
        frameMat,
        playMat,
        yearMat,
        vinyl,
        vinylMats,
        labelMat,
        side,
        row,
        jitterY: (Math.sin(i * 12.9898) * 0.5) * 0.7,
        jitterX: (Math.cos(i * 4.1414) * 0.5) * 0.5,
        seed: (i * 0.618) % 1,
        z: 0,
        hover: 0,
        focus: 0,
        tilt: new THREE.Vector2(),
      });
    }
  }

  private buildInteraction() {
    // A soft light that follows the cursor through space: glints across the
    // clear-coated sleeves and the vinyl as you move the mouse.
    this.cursorLight = new THREE.PointLight(new THREE.Color("#cfeeff"), 0, 16, 2);
    this.scene.add(this.cursorLight);

    // Shooting stars: a small pool of additive lines, bright head → dark tail.
    if (!this.reducedMotion) {
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
        geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array([1.6, 1.8, 2.0, 0, 0, 0]), 3));
        const line = new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
        );
        line.visible = false;
        line.frustumCulled = false;
        this.scene.add(line);
        this.shooting.push({ line, t: 0, dur: 1, from: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0 });
      }
    }

    // Phones: tilt the device to look around (permission is asked on Enter).
    if (this.lowPower && !this.reducedMotion) window.addEventListener("deviceorientation", this.onOrient);
  }

  private onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    if (!this.gyroBase) this.gyroBase = { b: e.beta, g: e.gamma };
    this.gyro.set(clamp((e.gamma - this.gyroBase.g) / 25, -1, 1), clamp(-(e.beta - this.gyroBase.b) / 25, -1, 1));
  };

  private updateShootingStars(dt: number) {
    if (!this.shooting.length) return;
    this.nextShoot -= dt;
    if (this.nextShoot <= 0) {
      this.nextShoot = 5 + Math.random() * 9;
      const free = this.shooting.find((s) => !s.line.visible);
      if (free) {
        // somewhere in the upper sky ahead, crossing diagonally
        // from.z is relative to the camera, so the streak stays in the far sky
        free.from.set((Math.random() * 2 - 1) * 220, 60 + Math.random() * 90, -260 - Math.random() * 120);
        free.dir.set(Math.random() < 0.5 ? -1 : 1, -0.35 - Math.random() * 0.3, 0.1).normalize();
        free.len = 30 + Math.random() * 30;
        free.dur = 0.7 + Math.random() * 0.6;
        free.t = 0;
        free.line.visible = true;
      }
    }
    for (const s of this.shooting) {
      if (!s.line.visible) continue;
      s.t += dt / s.dur;
      if (s.t >= 1) {
        s.line.visible = false;
        continue;
      }
      const travel = s.t * 260;
      const fade = Math.sin(s.t * Math.PI);
      const pos = s.line.geometry.attributes.position as THREE.BufferAttribute;
      const head = s.from.clone().addScaledVector(s.dir, travel);
      head.z += this.camZ;
      const tail = head.clone().addScaledVector(s.dir, -s.len * (0.4 + 0.6 * fade));
      pos.setXYZ(0, head.x, head.y, head.z);
      pos.setXYZ(1, tail.x, tail.y, tail.z);
      pos.needsUpdate = true;
      (s.line.material as THREE.LineBasicMaterial).opacity = fade;
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
      const size = this.lowPower ? 512 : 1024;
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
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      for (const slot of this.slots) {
        if (slot.single.id !== s.id || (this.videoTex && slot.front.map === this.videoTex)) continue;
        slot.front.map = tex;
        slot.front.emissiveMap = tex;
        slot.front.needsUpdate = true;
        if (slot.labelMat) {
          slot.labelMat.map = tex;
          slot.labelMat.emissiveMap = tex;
          slot.labelMat.needsUpdate = true;
        }
      }
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
      else if (this.pickJaveda()) this.travelToJaveda();
      else if (this.pickGalaxy()) this.openGalaxy();
      else if (this.pickUfo()) this.beamRandom();
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
    const meshes = this.slots.filter((s) => s.front.opacity > 0.3).map((s) => s.cover);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (hit?.uv && hit.face && hit.face.materialIndex === 4) this.hoverUv.copy(hit.uv);
    return hit ? this.slots[hit.object.userData.slotIndex as number] : null;
  }

  private pickJaveda(): boolean {
    if (Math.abs(this.pointer.x) > 1 || Math.abs(this.pointer.y) > 1) return false;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObject(this.javeda.hit, false).length > 0;
  }

  private pickGalaxy(): boolean {
    if (Math.abs(this.pointer.x) > 1 || Math.abs(this.pointer.y) > 1) return false;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObject(this.galaxy.hit, false).length > 0;
  }

  private pickUfo(): boolean {
    if (Math.abs(this.pointer.x) > 1 || Math.abs(this.pointer.y) > 1) return false;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.ufo.hitTargets, false).length > 0;
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
    // JAVEDA must be on screen on phones too: tuck it in closer to the centre.
    if (this.javeda) {
      if (portrait) {
        this.javeda.group.position.set(40, 34, -175);
        this.javeda.group.scale.setScalar(0.62);
      } else {
        this.javeda.group.position.set(92, 44, -175);
        this.javeda.group.scale.setScalar(1);
      }
    }
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
    for (const m of this.farStarMats) m.uniforms.uPixelRatio.value = this.pixelRatio;
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
    if (!this.focused && !this.gazing && !this.journey && (!this.hovered || !this.inputEnabled)) {
      this.targetZ -= this.idleDrift * (this.inputEnabled ? 1 : 2.2) * dt;
    }
    const prev = this.camZ;
    if (this.journey) {
      const j = this.journey;
      j.t = Math.min(j.t + dt / j.dur, 1);
      const k = j.t < 0.5 ? 4 * j.t * j.t * j.t : 1 - Math.pow(-2 * j.t + 2, 3) / 2; // ease in-out
      this.targetZ = this.camZ = j.from + (j.to - j.from) * k;
      if (j.t >= 1) this.journey = null;
    } else if (this.travel) this.camZ = this.camera.position.z; // the warp moves the camera itself
    else this.camZ = damp(this.camZ, this.targetZ, this.focused ? 6 : 2.4, dt);
    this.speed = (prev - this.camZ) / Math.max(dt, 1e-4);
    this.smoothSpeed = damp(this.smoothSpeed, this.speed, 6, dt);
    const absSpeed = Math.abs(this.smoothSpeed);
    const speedK = smoothstep(2, 45, absSpeed);

    // ── camera ──
    const look = this.focused ? 0 : 1;
    if (this.pointerInside) this.parallax.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    else if (this.gyroBase) this.parallax.lerp(this.gyro, 1 - Math.exp(-dt * 4));
    else this.parallax.multiplyScalar(Math.exp(-dt * 2));
    const bob = this.reducedMotion ? 0 : Math.sin(t * 0.8) * 0.06;
    if (this.travel) this.stepTravel(dt);
    else {
      this.camera.position.set(0, 0.2 + bob, this.camZ);
      this.camera.rotation.set(
        this.parallax.y * 0.035 * look,
        -this.parallax.x * 0.055 * look,
        (-this.parallax.x * 0.015 + (this.reducedMotion ? 0 : Math.sin(t * 0.37) * 0.006)) * look,
      );
      // gaze: turn toward the galaxy and zoom in while the Lazy Jo card is open
      this.gaze = damp(this.gaze, this.gazing ? 1 : 0, this.reducedMotion ? 8 : 2.6, dt);
      const eg = easeInOut(clamp(this.gaze, 0, 1));
      if (eg > 0.001) {
        const at = this.camera.position.clone().add(this.galaxy.dir);
        const qG = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(this.camera.position, at, new THREE.Vector3(0, 1, 0)));
        this.camera.quaternion.slerp(qG, eg);
      }
      const fov = THREE.MathUtils.lerp(this.baseFov + (this.reducedMotion ? 0 : speedK * 9), this.layout.portrait ? 52 : 36, eg);
      if (Math.abs(this.camera.fov - fov) > 0.01) {
        this.camera.fov = damp(this.camera.fov, fov, 4, dt);
        this.camera.updateProjectionMatrix();
      }
    }

    // ── far field travels with the camera ──
    this.farStars.position.copy(this.camera.position);
    for (const m of this.farStarMats) m.uniforms.uTime.value = t;
    if (!this.travel) this.planets.position.set(0, 0, this.camZ);
    // the JAVEDA ring breathes, and lights up when you point at it
    this.javedaHover = damp(this.javedaHover, this.javedaHovered ? 1 : 0, 6, dt);
    this.javeda.ringMat.uniforms.uGlow.value = 0.35 + 0.2 * Math.sin(t * 2.0) + this.javedaHover * 1.1;
    this.javeda.ringMat.uniforms.uTime.value = t;
    this.javeda.planet.scale.setScalar(1 + this.javedaHover * 0.04);
    this.galaxyHover = damp(this.galaxyHover, this.galaxyHovered ? 1 : 0, 6, dt);
    (this.galaxy.glow.material as THREE.SpriteMaterial).opacity = 0.05 + 0.04 * Math.sin(t * 1.4) + this.galaxyHover * 0.4;
    this.feedJavedaScreen(t);
    for (const p of this.planetSpin) p.rotation.y = t * 0.008;
    for (const m of this.planetMats) m.uniforms.uTime.value = t;
    this.ufo.group.position.z = this.camZ - 125;
    this.surge = damp(this.surge, 0, 1.6, dt);
    const m = this.reducedMotion ? this.music * 0.4 : this.music;
    const b = this.reducedMotion ? this.bass * 0.4 : this.bass;
    this.ufo.update(t, speedK, m, b, this.surge);

    for (const pts of [this.stars, this.dust]) {
      pts.material.uniforms.uCamZ.value = this.camZ;
      pts.material.uniforms.uTime.value = t;
    }
    this.streaks.material.uniforms.uCamZ.value = this.camZ;
    this.streaks.material.uniforms.uStretch.value = Math.min(absSpeed * 0.28, 14) * Math.sign(this.smoothSpeed || 1);
    this.streaks.material.uniforms.uOpacity.value = smoothstep(5, 30, absSpeed) * 0.6;
    this.lanes.position.z = this.camZ - 215;
    this.lanes.material.uniforms.uCamZ.value = this.camZ;
    this.lanes.material.uniforms.uTime.value = t;
    this.lanes.material.uniforms.uSpeed.value = speedK + b * 1.2 + this.surge;

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
      sc.copy(a.stretch).multiplyScalar(a.scale * smoothstep(D, D * 0.75, -rel));
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
    if (!this.travel) this.flash = damp(this.flash, 0, 2.5, dt);
    const u = this.cinematic.uniforms;
    u.uBlur.value = this.reducedMotion ? 0 : speedK * 0.9;
    u.uTime.value = t;
    u.uFlash.value = this.flash;
    u.uAberration.value = 0.0012 + speedK * 0.002;
    this.bloom.strength = 0.5 + speedK * 0.3 + m * 0.25 + this.surge * 0.4;

    // cursor light: sits ~6 units into the scene along the pointer ray
    const lightOn = this.pointerInside && this.inputEnabled && !this.lowPower ? 1 : 0;
    this.cursorLightK = damp(this.cursorLightK, lightOn, 4, dt);
    if (this.cursorLightK > 0.01) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      this.cursorLight.position.copy(this.raycaster.ray.origin).addScaledVector(this.raycaster.ray.direction, 6.5);
    }
    this.cursorLight.intensity = 11 * this.cursorLightK;
    this.updateShootingStars(dt);

    this.cb.onFrame?.(absSpeed);
    if (t - this.lastTelemetry > 0.12) {
      this.lastTelemetry = t;
      this.cb.onTelemetry?.({ speed: absSpeed, distance: -this.camZ });
    }
  }

  private tmpJ = new THREE.Vector3();
  private focusRectOn = false;
  /** Project the presented cover's 4 corners to screen px (for the music-video screen). */
  private feedFocusScreen() {
    if (!this.cb.onFocusScreen) return;
    const s = this.focused;
    if (!s || s.focus < 0.94) {
      if (this.focusRectOn) { this.focusRectOn = false; this.cb.onFocusScreen(null); }
      return;
    }
    s.cover.updateWorldMatrix(true, false);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = this.tmpJ.set((cx * COVER_SIZE) / 2, (cy * COVER_SIZE) / 2, SLEEVE_DEPTH / 2).applyMatrix4(s.cover.matrixWorld).project(this.camera);
      const px = (p.x * 0.5 + 0.5) * w;
      const py = (-p.y * 0.5 + 0.5) * h;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    this.focusRectOn = true;
    this.cb.onFocusScreen({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }

  /** Project the JAVEDA planet to screen px for the HTML button (~30 fps). */
  private feedJavedaScreen(t: number) {
    if (!this.cb.onJavedaScreen || t - this.lastJavedaScreen < 0.033) return;
    this.lastJavedaScreen = t;
    this.feedFocusScreen();
    this.javeda.group.updateWorldMatrix(true, false);
    const p = this.javeda.group.getWorldPosition(this.tmpJ);
    const dist = p.distanceTo(this.camera.position);
    p.project(this.camera);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const r = ((this.javeda.r * this.javeda.group.scale.x) / dist / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) * (h / 2);
    const visible = p.z < 1 && Math.abs(p.x) < 1.15 && Math.abs(p.y) < 1.15 && !this.travel && !this.gazing;
    this.cb.onJavedaScreen({ x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, r, visible });
    if (this.cb.onGalaxyScreen) {
      const g = this.galaxy.hit.getWorldPosition(this.tmpJ).project(this.camera);
      const gv = g.z < 1 && Math.abs(g.x) < 1.05 && Math.abs(g.y) < 1.05 && !this.travel && !this.gazing;
      this.cb.onGalaxyScreen({ x: (g.x * 0.5 + 0.5) * w, y: (-g.y * 0.5 + 0.5) * h, visible: gv });
    }
  }

  private stepTravel(dt: number) {
    const tr = this.travel!;
    const dur = this.reducedMotion ? 0.7 : 2.7;
    tr.t = Math.min(tr.t + dt / dur, 1);
    const k = tr.t;
    // 1. turn to face the planet
    const look = new THREE.Matrix4().lookAt(this.camera.position, tr.target, new THREE.Vector3(0, 1, 0));
    const qLook = new THREE.Quaternion().setFromRotationMatrix(look);
    this.camera.quaternion.slerpQuaternions(tr.fromQuat, qLook, easeInOut(clamp(k / 0.32, 0, 1)));
    // 2. accelerate into it (ease-in = the jump to light speed)
    const dir = tr.target.clone().sub(tr.fromPos).normalize();
    const stop = tr.target.clone().addScaledVector(dir, -this.javeda.r * this.javeda.group.scale.x * 1.45);
    const fly = clamp((k - 0.22) / 0.78, 0, 1);
    // punch into warp, then the planet rushes up and fills the view before the fade
    const e = (1 - Math.pow(1 - fly, 3)) * smoothstep(0, 0.12, fly);
    this.camera.position.lerpVectors(tr.fromPos, stop, this.reducedMotion ? fly : e);
    // 3. the lens stretches mid-warp and relaxes on arrival, then white-out into JAVEDA
    if (!this.reducedMotion) {
      this.camera.fov = this.baseFov + 30 * Math.sin(Math.PI * fly);
      this.camera.updateProjectionMatrix();
    }
    this.flash = smoothstep(0.8, 1.0, k) * 1.1;
    if (k >= 0.8 && !tr.arrived) {
      tr.arrived = true;
      this.cb.onTravelArrive?.();
    }
    if (k >= 1 && !tr.done) {
      tr.done = true;
      this.cb.onTravelDone?.();
    }
  }

  private updateHover() {
    if (!this.inputEnabled || this.focused || !this.pointerInside) {
      if (this.hovered) {
        this.hovered = null;
        this.cb.onHover?.(null);
        this.container.style.cursor = "";
      }
      if (this.ufoHovered) {
        this.ufoHovered = false;
        this.cb.onUfoHover?.(false);
      }
      if (this.javedaHovered) {
        this.javedaHovered = false;
        this.cb.onJavedaHover?.(false);
      }
      if (this.galaxyHovered) {
        this.galaxyHovered = false;
        this.cb.onGalaxyHover?.(false);
      }
      return;
    }
    const slot = this.pick();
    if (slot !== this.hovered) {
      this.hovered = slot;
      this.cb.onHover?.(slot ? slot.single : null);
    }
    const jav = !slot && this.pickJaveda();
    if (jav !== this.javedaHovered) {
      this.javedaHovered = jav;
      this.cb.onJavedaHover?.(jav);
    }
    const gal = !slot && !jav && this.pickGalaxy();
    if (gal !== this.galaxyHovered) {
      this.galaxyHovered = gal;
      this.cb.onGalaxyHover?.(gal);
    }
    const ufo = !slot && !jav && !gal && this.pickUfo();
    if (ufo !== this.ufoHovered) {
      this.ufoHovered = ufo;
      this.cb.onUfoHover?.(ufo);
    }
    this.container.style.cursor = slot || ufo || jav || gal ? "pointer" : "";
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
      // lean toward the cursor while hovered (like holding a real sleeve)
      const tx = isHover ? (this.hoverUv.y - 0.5) * -0.32 : 0;
      const ty = isHover ? (this.hoverUv.x - 0.5) * 0.4 : 0;
      s.tilt.x = damp(s.tilt.x, tx, 7, dt);
      s.tilt.y = damp(s.tilt.y, ty, 7, dt);
      this.eul.set(s.tilt.x, rotY + s.tilt.y, Math.sin(t * 0.4 + s.seed * 6) * 0.015);
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
      // fade out as a sleeve slides past the camera (no giant black blobs at the edge)
      const near = isFocus ? 1 : smoothstep(1.5, 6.5, dist);
      const dimK = isFocus ? 0 : this.dim * 0.8;
      const opacity = far * near * (1 - dimK);
      s.front.opacity = opacity;
      s.shell.opacity = opacity;
      s.group.visible = opacity > 0.01;
      s.front.emissiveIntensity = 0.42 + s.hover * 0.22 + s.focus * 0.18;

      const glow = 0.18 + s.hover * 0.85 + s.focus * (0.55 + this.bass * 1.4);
      s.frameMat.uniforms.uGlow.value = glow;
      s.frameMat.uniforms.uOpacity.value = opacity;
      s.frameMat.uniforms.uTime.value = t + s.seed * 5;
      if (s.yearMat) {
        // shows on the road, brightens on hover, hides when the cover is presented (the player has it)
        s.yearMat.opacity = opacity * (0.78 + s.hover * 0.22) * (1 - s.focus);
        s.yearMat.visible = s.yearMat.opacity > 0.01;
      }
      s.playMat.opacity = s.hover * 0.85 * opacity * (1 - s.focus);
      s.playMat.visible = s.playMat.opacity > 0.01;

      if (s.vinyl) {
        const out = Math.max(s.hover, s.focus);
        const dir = s.focus > 0.5 ? 1 : -s.side;
        s.vinyl.position.x = dir * COVER_SIZE * (0.24 + out * 0.22);
        s.vinyl.rotation.z -= dt * (0.2 + out * 2.4 + (isFocus ? this.music * 5 : 0));
        for (const m of s.vinylMats) m.opacity = opacity;
      }
    }
  }
}
