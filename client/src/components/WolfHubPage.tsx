import { useState, useEffect, useRef, useCallback, useMemo, useReducer } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, MapPin, X, Search, UserPlus, Music, Zap, Flame, Globe2 } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import gsap from "gsap";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import {
  territories,
  wolves,
  recentActivity,
  isoAlpha2ToNumeric,
} from "../data/wolves";
import type { Territory, Wolf } from "../data/wolves";

const GEO_URL = "/countries-110m.json";

// Default map view (lng, lat, zoom)
const DEFAULT_VIEW = { lng: 10, lat: 20, zoom: 1 };

// Approximate centroids (lng, lat) for our active territories — used to animate zoom on select
const TERRITORY_CENTROIDS: Record<string, [number, number]> = {
  GH: [-1.0, 7.9],
  US: [-98.0, 39.0],
  GB: [-2.0, 54.0],
  BE: [4.5, 50.5],
  FR: [2.5, 46.2],
  NG: [8.0, 9.0],
};

// Zoom level per territory — larger countries need less zoom
const TERRITORY_ZOOM: Record<string, number> = {
  US: 2.2,
  NG: 3.5,
  GH: 4,
  FR: 4,
  GB: 3.5,
  BE: 6,
};

// Build a set of numeric ISO codes that have active artists
const activeNumericCodes = new Set(
  territories
    .filter((t) => t.artists.length > 0)
    .map((t) => isoAlpha2ToNumeric[t.iso])
    .filter(Boolean)
);

// Numeric ISO → Territory lookup
const numericToTerritory = new Map<string, Territory>();
territories.forEach((t) => {
  const num = isoAlpha2ToNumeric[t.iso];
  if (num) numericToTerritory.set(num, t);
});

interface Props {
  onBack: () => void;
  onSelectWolf: (wolf: Wolf) => void;
  onVersus?: (territory?: string) => void;
}

/* ─── 3D Wolf Scene (simplified — no maw zoom) ─── */

function WolfScene({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      30,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.2, 7);
    camera.lookAt(0, 0.7, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    // Cinematic lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const rim1 = new THREE.DirectionalLight(0xf5c518, 2.0);
    rim1.position.set(4, 3, -3);
    scene.add(rim1);
    const rim2 = new THREE.DirectionalLight(0xf5c518, 1.2);
    rim2.position.set(-4, 3, -3);
    scene.add(rim2);
    const front = new THREE.DirectionalLight(0xffeedd, 0.5);
    front.position.set(0, 1, 6);
    scene.add(front);
    const bottom = new THREE.DirectionalLight(0xf5c518, 0.4);
    bottom.position.set(0, -3, 3);
    scene.add(bottom);
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

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (model) {
        model.rotation.x += (targetRotation.x - model.rotation.x) * 0.03;
        model.rotation.y += (targetRotation.y - model.rotation.y) * 0.03;
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
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
  }, [containerRef]);

  return null;
}

/* ─── Interactive World Map ─── */

function WorldMap({
  onSelectTerritory,
  onResetView,
  selectedIso,
  hoveredIso,
  onHover,
}: {
  onSelectTerritory: (territory: Territory) => void;
  onResetView: () => void;
  selectedIso: string | null;
  hoveredIso: string | null;
  onHover: (iso: string | null) => void;
}) {
  // Animated map view — mutated by GSAP, re-rendered via forceUpdate
  const viewRef = useRef({ ...DEFAULT_VIEW });
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  // Animate the map view whenever the selected territory changes
  useEffect(() => {
    const target = selectedIso
      ? {
          lng: TERRITORY_CENTROIDS[selectedIso]?.[0] ?? DEFAULT_VIEW.lng,
          lat: TERRITORY_CENTROIDS[selectedIso]?.[1] ?? DEFAULT_VIEW.lat,
          zoom: TERRITORY_ZOOM[selectedIso] ?? 3,
        }
      : DEFAULT_VIEW;

    tweenRef.current?.kill();
    tweenRef.current = gsap.to(viewRef.current, {
      lng: target.lng,
      lat: target.lat,
      zoom: target.zoom,
      duration: 1.1,
      ease: "power3.inOut",
      onUpdate: forceUpdate,
    });

    return () => {
      tweenRef.current?.kill();
    };
  }, [selectedIso]);

  const isZoomed = viewRef.current.zoom > 1.05;

  return (
    <div className="relative rounded-2xl border border-wolf-border/30 bg-wolf-surface/50 p-2 backdrop-blur-sm sm:p-4">
      {/* Reset view pill — only when zoomed */}
      <AnimatePresence>
        {isZoomed && (
          <motion.button
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            onClick={onResetView}
            className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-wolf-gold/30 bg-wolf-bg/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-wolf-gold backdrop-blur-md transition-colors hover:border-wolf-gold/60 hover:text-white"
          >
            <Globe2 size={12} />
            Reset view
          </motion.button>
        )}
      </AnimatePresence>

      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 140 }}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup
          center={[viewRef.current.lng, viewRef.current.lat]}
          zoom={viewRef.current.zoom}
          minZoom={1}
          maxZoom={8}
          disablePanning
          disableZooming
        >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const geoId = geo.id as string;
              const isActive = activeNumericCodes.has(geoId);
              const territory = numericToTerritory.get(geoId);
              const isSelected =
                isActive && territory?.iso === selectedIso;
              const isHovered =
                isActive && territory?.iso === hoveredIso;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => {
                    if (isActive && territory) onSelectTerritory(territory);
                  }}
                  onMouseEnter={() => {
                    if (isActive && territory) onHover(territory.iso);
                  }}
                  onMouseLeave={() => onHover(null)}
                  style={{
                    default: {
                      fill: isSelected
                        ? "rgba(245,197,24,0.55)"
                        : isActive
                        ? "rgba(245,197,24,0.3)"
                        : "#15151c",
                      stroke: isActive
                        ? "rgba(245,197,24,0.6)"
                        : "#222230",
                      strokeWidth: isActive ? 1 : 0.4,
                      outline: "none",
                      cursor: isActive ? "pointer" : "default",
                      filter: isActive
                        ? "drop-shadow(0 0 8px rgba(245,197,24,0.5))"
                        : "none",
                      transition: "all 200ms ease",
                    },
                    hover: {
                      fill: isActive
                        ? "rgba(245,197,24,0.45)"
                        : "#1a1a24",
                      stroke: isActive
                        ? "rgba(245,197,24,0.8)"
                        : "#222230",
                      strokeWidth: isActive ? 1.2 : 0.4,
                      outline: "none",
                      cursor: isActive ? "pointer" : "default",
                      filter: isActive
                        ? "drop-shadow(0 0 16px rgba(245,197,24,0.6))"
                        : "none",
                    },
                    pressed: {
                      fill: isActive
                        ? "rgba(245,197,24,0.6)"
                        : "#15151c",
                      outline: "none",
                    },
                  }}
                />
              );
            })
          }
        </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredIso && (() => {
          const t = territories.find((t) => t.iso === hoveredIso);
          if (!t) return null;
          const wolfCount = t.artists
            .map((id) => wolves.find((w) => w.id === id))
            .filter(Boolean).length;
          return (
            <motion.div
              key={hoveredIso}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg border border-wolf-gold/20 bg-wolf-bg/90 px-4 py-2 text-sm backdrop-blur-md"
            >
              <span className="mr-2 text-base">{t.flag}</span>
              <span className="font-bold tracking-wider text-white" style={{ fontFamily: "var(--font-heading)" }}>
                {t.name.toUpperCase()}
              </span>
              <span className="ml-3 text-wolf-gold">
                {wolfCount} {wolfCount === 1 ? "artist" : "artists"}
              </span>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

/* ─── Territory Detail Panel ─── */

function TerritoryPanel({
  territory,
  onClose,
  onSelectWolf,
  onVersus,
}: {
  territory: Territory | null;
  onClose: () => void;
  onSelectWolf: (wolf: Wolf) => void;
  onVersus?: (territory?: string) => void;
}) {
  const territoryWolves = useCallback(
    (t: Territory) =>
      t.artists
        .map((id) => wolves.find((w) => w.id === id))
        .filter(Boolean) as Wolf[],
    []
  );

  return (
    <AnimatePresence>
      {territory && (
        <motion.div
          key={territory.id}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 100 }}
          className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 backdrop-blur-lg"
        >
          <div className="mb-6 flex items-center gap-4">
            <span className="text-4xl">{territory.flag}</span>
            <div>
              <h2
                className="text-2xl font-bold tracking-wider text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {territory.name.toUpperCase()}
              </h2>
              <p className="text-xs uppercase tracking-wider text-wolf-muted">
                {territoryWolves(territory).length} {territoryWolves(territory).length === 1 ? "artist" : "artists"} in territory
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-auto rounded-full border border-wolf-border/30 p-2 text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {territoryWolves(territory).length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {territoryWolves(territory).map((wolf, i) => (
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
                        <h3 className="font-bold text-white">{wolf.artist}</h3>
                        <span className="text-xs" style={{ color: wolf.color }}>
                          {wolf.genre}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              {onVersus && (
                <button
                  onClick={() => onVersus(territory?.name)}
                  className="group relative mt-5 w-full overflow-hidden rounded-xl py-3 font-bold tracking-wider text-black transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/20"
                  style={{
                    fontFamily: "var(--font-heading)",
                    background:
                      "linear-gradient(135deg, #9b6dff 0%, #f5c518 50%, #E040FB 100%)",
                  }}
                >
                  <span className="relative z-10">
                    🐺 START VERSUS SWIPE
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <MapPin size={32} className="mx-auto mb-3 text-wolf-muted/40" />
              <p className="text-wolf-muted">
                No artists in this territory yet.
              </p>
              <p className="mt-1 text-sm text-wolf-muted/50">
                Scouts are on the ground. Coming soon.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Discovery Section ─── */

const ACTIVITY_ICONS = {
  joined: UserPlus,
  collab: Music,
  release: Zap,
} as const;

function DiscoverySection({
  searchTerm,
  onSearchChange,
  onSelectTerritory,
  onSelectWolf,
}: {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelectTerritory: (territory: Territory) => void;
  onSelectWolf: (wolf: Wolf) => void;
}) {
  const hotTerritories = useMemo(
    () =>
      [...territories]
        .filter((t) => t.artists.length > 0)
        .sort((a, b) => b.artists.length - a.artists.length)
        .slice(0, 3),
    []
  );

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const term = searchTerm.toLowerCase();
    return {
      territories: territories.filter((t) =>
        t.name.toLowerCase().includes(term)
      ),
      wolves: wolves.filter(
        (w) =>
          w.status === "active" &&
          (w.artist.toLowerCase().includes(term) ||
            w.genre.toLowerCase().includes(term))
      ),
    };
  }, [searchTerm]);

  return (
    <div className="mt-16 space-y-12">
      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-wolf-muted"
          />
          <input
            type="text"
            placeholder="Search artists, genres, or countries..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-wolf-border/30 bg-wolf-card/50 py-3 pl-11 pr-4 text-white placeholder-wolf-muted/50 outline-none backdrop-blur transition-colors focus:border-wolf-gold/40"
          />
        </div>

        {/* Search results dropdown */}
        <AnimatePresence>
          {searchResults &&
            (searchResults.territories.length > 0 ||
              searchResults.wolves.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-2 rounded-xl border border-wolf-border/30 bg-wolf-card/90 p-3 backdrop-blur-lg"
              >
                {searchResults.territories.length > 0 && (
                  <div className="mb-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-wolf-muted">
                      Territories
                    </p>
                    {searchResults.territories.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          onSelectTerritory(t);
                          onSearchChange("");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white transition-colors hover:bg-wolf-gold/10"
                      >
                        <span>{t.flag}</span>
                        <span>{t.name}</span>
                        <span className="ml-auto text-xs text-wolf-muted">
                          {t.artists.length} wolves
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.wolves.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-wolf-muted">
                      Artists
                    </p>
                    {searchResults.wolves.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => {
                          onSelectWolf(w);
                          onSearchChange("");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white transition-colors hover:bg-wolf-gold/10"
                      >
                        <div
                          className="h-6 w-6 rounded-full"
                          style={{
                            background: `radial-gradient(circle, ${w.color}40, #0a0a0c)`,
                          }}
                        />
                        <span>{w.artist}</span>
                        <span
                          className="ml-auto text-xs"
                          style={{ color: w.color }}
                        >
                          {w.genre}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
        </AnimatePresence>
      </motion.div>

      {/* Hot Territories */}
      <div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-6 flex items-center gap-3"
        >
          <Flame size={20} className="text-wolf-gold" />
          <h3
            className="text-lg font-bold tracking-wider text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            HOT TERRITORIES
          </h3>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotTerritories.map((t, i) => {
            const wolfCount = t.artists
              .map((id) => wolves.find((w) => w.id === id))
              .filter(Boolean).length;
            return (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                onClick={() => onSelectTerritory(t)}
                className="group rounded-2xl border border-wolf-gold/20 bg-wolf-card/50 p-5 text-left backdrop-blur transition-all hover:border-wolf-gold/40 hover:shadow-lg hover:shadow-wolf-gold/10"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-3xl">{t.flag}</span>
                  <div>
                    <h4
                      className="font-bold tracking-wider text-white"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {t.name.toUpperCase()}
                    </h4>
                    <p className="text-xs text-wolf-gold">
                      {wolfCount} {wolfCount === 1 ? "artist" : "artists"} active
                    </p>
                  </div>
                </div>
                <div className="flex -space-x-2">
                  {t.artists
                    .map((id) => wolves.find((w) => w.id === id))
                    .filter(Boolean)
                    .map((w) => (
                      <div
                        key={w!.id}
                        className="h-8 w-8 overflow-hidden rounded-full border-2 border-wolf-bg"
                        style={{
                          background: `radial-gradient(circle, ${w!.color}30, #0a0a0c)`,
                        }}
                      >
                        {w!.video ? (
                          <video
                            src={w!.video}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <img
                            src={w!.image}
                            alt={w!.artist}
                            className="h-full w-full p-1"
                          />
                        )}
                      </div>
                    ))}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Activity Feed */}
      <div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-6 flex items-center gap-3"
        >
          <Zap size={20} className="text-wolf-gold" />
          <h3
            className="text-lg font-bold tracking-wider text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            RECENT ACTIVITY
          </h3>
        </motion.div>

        <div className="space-y-3">
          {recentActivity.map((event, i) => {
            const Icon = ACTIVITY_ICONS[event.type];
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-4 rounded-xl border border-wolf-border/20 bg-wolf-card/30 px-5 py-3 backdrop-blur"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wolf-gold/10">
                  <Icon size={14} className="text-wolf-gold" />
                </div>
                <p className="text-sm text-wolf-text">{event.text}</p>
                <span className="ml-auto shrink-0 text-xs text-wolf-muted">
                  {event.timestamp}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function WolfHubPage({
  onBack,
  onSelectWolf,
  onVersus,
}: Props) {
  const [selectedTerritory, setSelectedTerritory] =
    useState<Territory | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen pt-20">
      {/* Cinematic bg */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-wolf-bg via-wolf-bg to-[#0d0d14]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_40%,_rgba(245,197,24,0.05),_transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>

        {/* Title */}
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
          <p className="mt-3 text-sm uppercase tracking-[0.3em] text-wolf-muted">
            Scout the globe. Join the pack.
          </p>
        </motion.div>

        {/* === SECTION 1: 3D Wolf Hero (smaller) === */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, type: "spring", stiffness: 60 }}
          className="relative mx-auto max-w-lg"
        >
          <div className="absolute inset-4 rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm" />
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              boxShadow:
                "0 0 80px rgba(245,197,24,0.06), 0 0 160px rgba(245,197,24,0.03), inset 0 0 60px rgba(245,197,24,0.02)",
            }}
          />
          <div
            ref={containerRef}
            className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl"
          >
            <WolfScene containerRef={containerRef} />
          </div>
        </motion.div>

        {/* === SECTION 2: Interactive World Map === */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12"
        >
          <WorldMap
            onSelectTerritory={setSelectedTerritory}
            onResetView={() => setSelectedTerritory(null)}
            selectedIso={selectedTerritory?.iso ?? null}
            hoveredIso={hoveredIso}
            onHover={setHoveredIso}
          />
        </motion.div>

        {/* Territory Detail Panel */}
        <TerritoryPanel
          territory={selectedTerritory}
          onClose={() => setSelectedTerritory(null)}
          onSelectWolf={onSelectWolf}
          onVersus={onVersus}
        />

        {/* === SECTION 3: Discovery === */}
        <DiscoverySection
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSelectTerritory={setSelectedTerritory}
          onSelectWolf={onSelectWolf}
        />
      </div>
    </div>
  );
}
