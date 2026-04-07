import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, MapPin, X } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import gsap from "gsap";
import { territories, wolves } from "../data/wolves";
import type { Territory, Wolf } from "../data/wolves";

interface Props {
  onBack: () => void;
  onSelectWolf: (wolf: Wolf) => void;
  onVersus?: (territory?: string) => void;
}

function WolfScene({
  containerRef,
  onMawZoom,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onMawZoom: React.MutableRefObject<((cb: () => void) => void) | null>;
}) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();

    // Camera — positioned to show full wolf head centered
    const camera = new THREE.PerspectiveCamera(
      30,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.2, 7);
    camera.lookAt(0, 0.7, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    // Cinematic lighting — gold rim + cool fills
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambient);

    // Gold rim lights
    const rim1 = new THREE.DirectionalLight(0xf5c518, 2.0);
    rim1.position.set(4, 3, -3);
    scene.add(rim1);

    const rim2 = new THREE.DirectionalLight(0xf5c518, 1.2);
    rim2.position.set(-4, 3, -3);
    scene.add(rim2);

    // Front key light
    const front = new THREE.DirectionalLight(0xffeedd, 0.5);
    front.position.set(0, 1, 6);
    scene.add(front);

    // Bottom fill — warm gold
    const bottom = new THREE.DirectionalLight(0xf5c518, 0.4);
    bottom.position.set(0, -3, 3);
    scene.add(bottom);

    // Top accent
    const top = new THREE.DirectionalLight(0x9b6dff, 0.3);
    top.position.set(0, 5, 0);
    scene.add(top);

    // Load wolf model
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
    );
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    let model: THREE.Object3D | null = null;
    const targetRotation = { x: 0, y: 0 };

    loader.load("/Optimized_Wolf.glb", (gltf) => {
      model = gltf.scene;
      model.scale.setScalar(1.6);
      model.position.set(0, 0.75, 0);
      scene.add(model);

      // Expose the Maw Zoom function
      onMawZoom.current = (callback: () => void) => {
        // Zoom camera into wolf's mouth (mouth is at ~model y + 0.75)
        gsap.to(camera.position, {
          x: 0,
          y: 0.85,
          z: 2.0,
          duration: 1.4,
          ease: "power3.inOut",
        });
        gsap.to(camera.rotation, {
          x: -0.05,
          duration: 1.4,
          ease: "power3.inOut",
        });
        // Flash effect
        gsap.to(renderer.domElement, {
          opacity: 0,
          duration: 0.6,
          delay: 1.0,
          onComplete: () => {
            callback();
            // Reset camera for next time
            gsap.set(camera.position, { x: 0, y: 1.2, z: 7 });
            gsap.set(camera.rotation, { x: 0 });
            gsap.set(renderer.domElement, { opacity: 1 });
          },
        });
      };
    });

    // Mouse tracking for tilt
    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetRotation.x = -y * 0.12;
      targetRotation.y = x * 0.12;
    };
    container.addEventListener("mousemove", onMouseMove);

    // Animate
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (model) {
        model.rotation.x +=
          (targetRotation.x - model.rotation.x) * 0.03;
        model.rotation.y +=
          (targetRotation.y - model.rotation.y) * 0.03;
      }
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      camera.aspect =
        container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        container.clientWidth,
        container.clientHeight
      );
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [containerRef, onMawZoom]);

  return null;
}

export default function WolfHubPage({ onBack, onSelectWolf, onVersus }: Props) {
  const [selectedTerritory, setSelectedTerritory] =
    useState<Territory | null>(null);
  const [zooming, setZooming] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mawZoomRef = useRef<((cb: () => void) => void) | null>(null);

  const territoryWolves = useCallback(
    (t: Territory) =>
      t.artists
        .map((id) => wolves.find((w) => w.id === id))
        .filter(Boolean) as Wolf[],
    []
  );

  const handleTerritoryClick = useCallback(
    (t: Territory) => {
      if (zooming) return;
      setZooming(true);

      if (mawZoomRef.current) {
        mawZoomRef.current(() => {
          setSelectedTerritory(t);
          setZooming(false);
        });
      } else {
        setSelectedTerritory(t);
        setZooming(false);
      }
    },
    [zooming]
  );

  return (
    <div className="min-h-screen pt-20">
      {/* Cinematic bg */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-wolf-bg via-wolf-bg to-[#0d0d14]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_40%,_rgba(245,197,24,0.05),_transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.4em] text-wolf-gold">
            Territory Map
          </p>
          <h1
            className="text-3xl font-bold tracking-wider text-white sm:text-5xl md:text-6xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            WOLF MAP
          </h1>
          <p
            className="mt-3 text-sm uppercase tracking-[0.3em] text-wolf-muted"
          >
            Scout the globe. Join the pack.
          </p>
        </motion.div>

        {/* 3D Wolf Scene with Glassmorphism Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, type: "spring", stiffness: 60 }}
          className="relative mx-auto"
          style={{ maxWidth: "700px" }}
        >
          {/* Glassmorphism backdrop */}
          <div className="absolute inset-4 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm" />

          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              boxShadow:
                "0 0 80px rgba(245,197,24,0.06), 0 0 160px rgba(245,197,24,0.03), inset 0 0 60px rgba(245,197,24,0.02)",
            }}
          />

          {/* 3D Canvas */}
          <div
            ref={containerRef}
            className="relative aspect-square w-full overflow-hidden rounded-3xl"
          >
            <WolfScene
              containerRef={containerRef}
              onMawZoom={mawZoomRef}
            />

            {/* Territory dots overlaid on wolf */}
            <AnimatePresence>
              {!selectedTerritory &&
                !zooming &&
                territories.map((t, i) => (
                  <motion.button
                    key={t.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{
                      delay: 1.2 + i * 0.12,
                      type: "spring",
                      stiffness: 200,
                    }}
                    whileHover={{ scale: 1.4 }}
                    onClick={() => handleTerritoryClick(t)}
                    className="group absolute"
                    style={{
                      top: t.top,
                      left: t.left,
                      transform: "translate(-50%, -50%)",
                    }}
                    title={t.name}
                  >
                    {/* Pulse ring for territories with artists */}
                    {t.artists.length > 0 && (
                      <span className="absolute -inset-3 animate-ping rounded-full bg-wolf-gold/15" />
                    )}

                    {/* Orb */}
                    <span
                      className="relative flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-all sm:h-10 sm:w-10 sm:text-xs"
                      style={{
                        backgroundColor:
                          t.artists.length > 0
                            ? "rgba(245,197,24,0.15)"
                            : "rgba(40,40,50,0.6)",
                        borderColor:
                          t.artists.length > 0
                            ? "rgba(245,197,24,0.4)"
                            : "rgba(80,80,90,0.3)",
                        color:
                          t.artists.length > 0 ? "#f5c518" : "#666",
                        backdropFilter: "blur(8px)",
                        boxShadow:
                          t.artists.length > 0
                            ? "0 0 20px rgba(245,197,24,0.2)"
                            : "none",
                      }}
                    >
                      {t.flag}
                    </span>

                    {/* Label on hover */}
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                      {t.name.toUpperCase()}
                    </span>
                  </motion.button>
                ))}
            </AnimatePresence>

            {/* Zoom overlay flash */}
            <AnimatePresence>
              {zooming && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.8 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-wolf-gold/10"
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Territory detail panel */}
        <AnimatePresence>
          {selectedTerritory && (
            <motion.div
              key={selectedTerritory.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 backdrop-blur-lg"
            >
              <div className="mb-6 flex items-center gap-4">
                <span className="text-4xl">
                  {selectedTerritory.flag}
                </span>
                <div>
                  <h2
                    className="text-2xl font-bold tracking-wider text-white"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {selectedTerritory.name.toUpperCase()}
                  </h2>
                  <p className="text-xs uppercase tracking-wider text-wolf-muted">
                    {territoryWolves(selectedTerritory).length} wolves
                    in territory
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTerritory(null)}
                  className="ml-auto rounded-full border border-wolf-border/30 p-2 text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {territoryWolves(selectedTerritory).length > 0 ? (
                <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {territoryWolves(selectedTerritory).map(
                    (wolf, i) => (
                      <motion.div
                        key={wolf.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ y: -4 }}
                        onClick={() => onSelectWolf(wolf)}
                        className="cursor-pointer rounded-xl border border-wolf-border/20 bg-wolf-surface/50 p-4 transition-all hover:border-wolf-gold/30 hover:shadow-lg hover:shadow-wolf-gold/5"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="h-14 w-14 shrink-0 overflow-hidden rounded-full"
                            style={{
                              background: `radial-gradient(circle, ${wolf.color}20, #0a0a0c)`,
                            }}
                          >
                            {wolf.video ? (
                              <video
                                src={wolf.video}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <img
                                src={wolf.image}
                                alt={wolf.artist}
                                className="h-full w-full p-2"
                              />
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-white">
                              {wolf.artist}
                            </h3>
                            <span
                              className="text-xs"
                              style={{ color: wolf.color }}
                            >
                              {wolf.genre}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  )}
                </div>
                {/* Versus button */}
                {onVersus && (
                  <button
                    onClick={() => onVersus(selectedTerritory?.name)}
                    className="mt-5 w-full rounded-xl bg-wolf-gold py-3 font-bold tracking-wider text-black transition-all hover:bg-wolf-amber"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    ⚡ START VERSUS SWIPE
                  </button>
                )}
                </>
              ) : (
                <div className="py-12 text-center">
                  <MapPin
                    size={32}
                    className="mx-auto mb-3 text-wolf-muted/40"
                  />
                  <p className="text-wolf-muted">
                    No wolves in this territory yet.
                  </p>
                  <p className="mt-1 text-sm text-wolf-muted/50">
                    Scouts are on the ground. Coming soon.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
