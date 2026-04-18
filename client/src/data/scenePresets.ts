/**
 * Scene preset library — the "CHOOSE SCENE" grid in the Scenes view.
 *
 * Each preset pairs a short recognizable name with a carefully-tuned
 * prompt that will be sent to the AI video model at generation time.
 * The thumbnail is a teaser of the vibe — not what the user actually
 * gets, which is always freshly generated.
 *
 * Thumbnail strategy: we reference `/scenes/<id>.jpg` so Joeri (or any
 * deployer) can drop real AI-generated thumbnails into
 * `client/public/scenes/` without touching code. Until those exist the
 * UI falls back to a gradient + category icon so nothing looks broken.
 * See SETUP-SCENES.md for a one-shot script that generates them all
 * via Replicate.
 */

export type SceneCategory =
  | "cinematic"
  | "visualizers"
  | "lifestyle"
  | "performance"
  | "action"
  | "landscapes";

export interface ScenePreset {
  id: string;             // Slug used for the image filename
  name: string;
  category: SceneCategory;
  prompt: string;         // Full prompt sent to the video model
  trending?: boolean;
  /** Hex pair used for the gradient fallback when no thumbnail exists */
  gradient: [string, string];
}

export const SCENE_CATEGORIES: Array<{ id: SceneCategory | "all" | "trending"; label: string }> = [
  { id: "all",          label: "All" },
  { id: "trending",     label: "Trending" },
  { id: "cinematic",    label: "Cinematic" },
  { id: "visualizers",  label: "Visualizers" },
  { id: "lifestyle",    label: "Lifestyle" },
  { id: "performance",  label: "Performance" },
  { id: "action",       label: "Action" },
  { id: "landscapes",   label: "Landscapes" },
];

export const scenePresets: ScenePreset[] = [
  /* ─── Cinematic ─── */
  {
    id: "cinematic-music-video",
    name: "Cinematic Music Video",
    category: "cinematic",
    trending: true,
    prompt: "Cinematic music video shot, moody warm lighting, rain on glass, neon reflections, shallow depth of field, 35mm film grain, slow dolly-in on a hooded figure.",
    gradient: ["#3a1e1e", "#d4a86a"],
  },
  {
    id: "golden-hour-romance",
    name: "Golden Hour Romance",
    category: "cinematic",
    prompt: "Golden hour backlight, warm tones, lens flare, soft focus, an intimate slow-motion embrace against a sunset skyline, anamorphic lens feel.",
    gradient: ["#f5a623", "#d4431a"],
  },
  {
    id: "late-night-drive",
    name: "Late Night Drive",
    category: "cinematic",
    prompt: "POV late-night highway drive, neon signs streaking past, wet asphalt, synthwave mood, dashboard glow, rain on the windshield.",
    gradient: ["#0a0e27", "#8b3aff"],
  },
  {
    id: "penthouse-view",
    name: "Penthouse View",
    category: "cinematic",
    prompt: "Floor-to-ceiling window, city skyline at night, silhouetted figure holding a drink, amber whiskey glow, cinematic framing, soft jazz atmosphere.",
    gradient: ["#1a1f3a", "#e8a554"],
  },

  /* ─── Visualizers ─── */
  {
    id: "liquid-ink",
    name: "Liquid Ink",
    category: "visualizers",
    prompt: "Abstract liquid ink swirling in water, high contrast black on white, slow-motion tendrils forming and dissolving, macro lens, studio lighting.",
    gradient: ["#0a0a0a", "#7c4dff"],
  },
  {
    id: "neon-pulse",
    name: "Neon Pulse",
    category: "visualizers",
    trending: true,
    prompt: "Abstract pulsing neon lines, geometric audio-reactive shapes, deep black background, synthwave palette magenta and cyan, glowing grid perspective.",
    gradient: ["#0f0f1a", "#ff3cac"],
  },
  {
    id: "crystal-prism",
    name: "Crystal Prism",
    category: "visualizers",
    prompt: "Refracted light through crystal prism, rainbow spectrum dispersing across a matte black surface, slow camera rotation, high-end commercial look.",
    gradient: ["#1a0033", "#00f2ff"],
  },
  {
    id: "smoke-and-light",
    name: "Smoke & Light",
    category: "visualizers",
    prompt: "Volumetric smoke catching shafts of colored spotlight, slow drift, dark stage background, cinematic fog, music-video lighting rig.",
    gradient: ["#111111", "#ff6b6b"],
  },

  /* ─── Lifestyle ─── */
  {
    id: "vintage-americana",
    name: "Vintage Americana",
    category: "lifestyle",
    trending: true,
    prompt: "Retro diner at dusk, red vinyl booths, neon OPEN sign, vintage jukebox glow, 1970s film grain, warm nostalgic palette.",
    gradient: ["#c94a3f", "#f4c85a"],
  },
  {
    id: "rooftop-isolation",
    name: "Rooftop Isolation",
    category: "lifestyle",
    prompt: "Urban rooftop at night, solitary figure on the edge, city lights below, moody blue and amber color grade, gentle wind on clothing.",
    gradient: ["#1e2a4a", "#c97fff"],
  },
  {
    id: "coffee-morning",
    name: "Coffee Morning",
    category: "lifestyle",
    prompt: "Soft morning light through apartment window, steaming coffee cup, vinyl record spinning, lo-fi cozy tones, hands-only framing.",
    gradient: ["#3a2a1e", "#e8c08f"],
  },
  {
    id: "studio-session",
    name: "Studio Session",
    category: "lifestyle",
    prompt: "Recording studio at night, warm lamp lighting on a vintage microphone, mixing board glow, producer in silhouette adjusting faders.",
    gradient: ["#2a1a3a", "#ffd700"],
  },

  /* ─── Performance ─── */
  {
    id: "stage-lights",
    name: "Stage Lights",
    category: "performance",
    prompt: "Concert stage from behind the artist, moving spotlights piercing through haze, thousands of phone lights in the crowd, cinematic wide shot.",
    gradient: ["#0a0a0a", "#ff3cac"],
  },
  {
    id: "intimate-piano",
    name: "Intimate Piano",
    category: "performance",
    prompt: "Dimly lit grand piano, single overhead spotlight, hands in motion on keys, black background, cinematic close-up, slow tracking shot.",
    gradient: ["#0f0f0f", "#d4af37"],
  },
  {
    id: "crowd-energy",
    name: "Crowd Energy",
    category: "performance",
    trending: true,
    prompt: "Festival crowd from stage POV, hands up, confetti falling, lens flares, pyro sparks, ultra-wide anamorphic framing, massive energy.",
    gradient: ["#1a0033", "#ffa500"],
  },
  {
    id: "street-cypher",
    name: "Street Cypher",
    category: "performance",
    prompt: "Night-time street corner, circle of friends, one MC center stage, hand-held camera energy, steam from a manhole, urban documentary feel.",
    gradient: ["#1e1e1e", "#00d4ff"],
  },

  /* ─── Action ─── */
  {
    id: "desert-wanderer",
    name: "Desert Wanderer",
    category: "action",
    prompt: "Lone hooded figure walking across endless golden dunes, sun beating down, heat haze, long shadows, wide cinematic framing, dust kicking up.",
    gradient: ["#c47a3d", "#f4c85a"],
  },
  {
    id: "city-chase",
    name: "City Chase",
    category: "action",
    prompt: "Motion-blurred city running shot, first-person perspective, neon signs flashing past, wet streets, parkour rooftops, cinematic urgency.",
    gradient: ["#0d1a2f", "#ff4757"],
  },
  {
    id: "boxing-ring",
    name: "Boxing Ring",
    category: "action",
    prompt: "Dim boxing gym, heavy bag swinging, sweat in the spotlight, slow motion on wrapped hands, black-and-white high-contrast grade with red blood accents.",
    gradient: ["#0a0a0a", "#c9302c"],
  },
  {
    id: "motorcycle-night",
    name: "Motorcycle Night",
    category: "action",
    prompt: "Night-time motorcycle rider speeding down empty highway, headlight cones cutting through fog, cinematic side tracking shot, wind-whipped jacket.",
    gradient: ["#050510", "#9b59b6"],
  },

  /* ─── Landscapes ─── */
  {
    id: "frozen-journey",
    name: "Frozen Journey",
    category: "landscapes",
    prompt: "Figure trudging through a blizzard, heavy snow, hood up, footprints trailing behind, muted palette with only a single warm scarf color, cinematic wide.",
    gradient: ["#2c3e50", "#bdc3c7"],
  },
  {
    id: "misty-forest",
    name: "Misty Forest",
    category: "landscapes",
    prompt: "Dense fog between tall pine trees at dawn, shafts of golden light breaking through, slow drone push-in, mystical atmosphere, fern-covered forest floor.",
    gradient: ["#0f3d2e", "#f4c85a"],
  },
  {
    id: "coastal-storm",
    name: "Coastal Storm",
    category: "landscapes",
    prompt: "Cliffside overlooking a stormy ocean, crashing waves, dark clouds, figure in coat watching the sea, moody blue and grey palette.",
    gradient: ["#1a3a4a", "#7ab8c7"],
  },
  {
    id: "neon-tokyo",
    name: "Neon Tokyo",
    category: "landscapes",
    trending: true,
    prompt: "Shibuya crossing at night, rain-slicked streets, neon billboards reflecting in puddles, umbrellas, cinematic long lens, crowd blur in background.",
    gradient: ["#0f0f1a", "#ff00aa"],
  },
];
