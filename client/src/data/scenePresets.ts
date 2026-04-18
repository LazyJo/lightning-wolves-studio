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

  /* ─── Cinematic (extras) ─── */
  {
    id: "alleyway-rain",
    name: "Alleyway Rain",
    category: "cinematic",
    prompt: "Narrow urban alley, heavy rainfall, single overhead lamp casting warm pool of light on a lone figure in a long coat, steam from vents, noir palette.",
    gradient: ["#1a1a2e", "#e9a347"],
  },
  {
    id: "wolf-moonlight",
    name: "Wolf Moonlight",
    category: "cinematic",
    trending: true,
    prompt: "Silhouette of a lone wolf on a ridge against a huge moon, lightning cracking in the distance, mist drifting through pine trees, Lightning Wolves brand energy.",
    gradient: ["#06101f", "#f5c518"],
  },
  {
    id: "elevator-doors",
    name: "Elevator Doors",
    category: "cinematic",
    prompt: "Cinematic slow-motion shot of steel elevator doors sliding open, reflections of city lights on polished metal, a backlit figure stepping through, moody score energy.",
    gradient: ["#2a2520", "#c09855"],
  },

  /* ─── Visualizers (extras) ─── */
  {
    id: "oscilloscope",
    name: "Oscilloscope",
    category: "visualizers",
    prompt: "Clean oscilloscope waveform on deep black, audio-reactive green glow, CRT scan lines, vintage lab equipment aesthetic, slow camera drift.",
    gradient: ["#001a0d", "#00ff88"],
  },
  {
    id: "shattered-glass",
    name: "Shattered Glass",
    category: "visualizers",
    prompt: "Slow-motion glass shattering against black background, each shard catching colored light, frozen moment of impact, macro lens, crystalline detail.",
    gradient: ["#0a0a18", "#b4e0ff"],
  },
  {
    id: "vhs-grain",
    name: "VHS Grain",
    category: "visualizers",
    prompt: "Heavy VHS tape aesthetic, tracking errors, chromatic aberration, scan lines, analog warmth, 80s TV commercial feel, saturated reds and blues.",
    gradient: ["#2a0040", "#ff5577"],
  },
  {
    id: "holographic-foil",
    name: "Holographic Foil",
    category: "visualizers",
    prompt: "Rippling holographic foil sheet, rainbow iridescence, slow wave motion, macro lens, catching studio lights, luxury product photography feel.",
    gradient: ["#4a0080", "#ffafff"],
  },

  /* ─── Lifestyle (extras) ─── */
  {
    id: "night-market",
    name: "Night Market",
    category: "lifestyle",
    prompt: "Asian night market alley, dangling string lights, steaming food stalls, people browsing, warm amber palette, handheld documentary feel.",
    gradient: ["#2a1a10", "#ffb347"],
  },
  {
    id: "highrise-balcony",
    name: "Highrise Balcony",
    category: "lifestyle",
    prompt: "Modern apartment balcony at sunset, city spread out below, figure leaning on railing with drink in hand, golden hour reflections in glass, lifestyle magazine feel.",
    gradient: ["#ff6a88", "#ffc38b"],
  },
  {
    id: "basement-studio",
    name: "Basement Studio",
    category: "lifestyle",
    trending: true,
    prompt: "Home recording studio at 3am, LED strip glow on acoustic foam, MPC and keyboards lit by monitor light, coffee cup, hoodie, focused late-night creation.",
    gradient: ["#1a0033", "#ff3ecb"],
  },

  /* ─── Performance (extras) ─── */
  {
    id: "festival-mainstage",
    name: "Festival Mainstage",
    category: "performance",
    prompt: "Massive festival main stage, pyrotechnics erupting, lasers cutting through fog, silhouetted artist at mic, ocean of hands in the crowd, epic wide shot.",
    gradient: ["#1a0033", "#ff3cac"],
  },
  {
    id: "acoustic-circle",
    name: "Acoustic Circle",
    category: "performance",
    prompt: "Intimate living room session, candlelight, artist with acoustic guitar, small attentive audience sitting on the floor, warm honey palette, hand-held camera.",
    gradient: ["#3a2418", "#ffb87a"],
  },
  {
    id: "backstage-moment",
    name: "Backstage Moment",
    category: "performance",
    prompt: "Backstage corridor before a show, artist pacing with headphones, ambient hum of crowd in distance, single work light, documentary black-and-white grade.",
    gradient: ["#111111", "#808080"],
  },

  /* ─── Action (extras) ─── */
  {
    id: "rooftop-sprint",
    name: "Rooftop Sprint",
    category: "action",
    prompt: "Parkour rooftop sprint at sunset, silhouetted figure leaping across buildings, city skyline behind, cinematic side tracking shot, orange and purple sky.",
    gradient: ["#ff5733", "#6a0dad"],
  },
  {
    id: "subway-showdown",
    name: "Subway Showdown",
    category: "action",
    prompt: "Empty subway platform at night, fluorescent flicker, two figures facing off from opposite ends, steam rising from the tracks, wide cinematic framing.",
    gradient: ["#1a1a2e", "#ff4757"],
  },
  {
    id: "sand-storm",
    name: "Sand Storm",
    category: "action",
    prompt: "Figure pushing forward through a violent sandstorm, goggles glinting, fabric whipping, low-angle hero shot, dramatic desert palette.",
    gradient: ["#7a4a1a", "#f4c85a"],
  },
  {
    id: "street-race",
    name: "Street Race",
    category: "action",
    trending: true,
    prompt: "Illegal street racing scene at night, neon-lit cars revving, spectators lining the sidewalks, smoke from tires, Tokyo-Drift aesthetic, cinematic low angle.",
    gradient: ["#0a0a1a", "#ff0055"],
  },

  /* ─── Landscapes (extras) ─── */
  {
    id: "northern-lights",
    name: "Northern Lights",
    category: "landscapes",
    prompt: "Aurora borealis dancing over a frozen lake, figure standing alone on the ice, reflections in still water, ethereal green and purple sky, cinematic wide shot.",
    gradient: ["#001a33", "#00ff88"],
  },
  {
    id: "volcanic-ridge",
    name: "Volcanic Ridge",
    category: "landscapes",
    prompt: "Black volcanic rock ridge, distant lava glow, ash drifting through the air, figure silhouetted against a red sky, apocalyptic landscape.",
    gradient: ["#1a0a0a", "#ff4500"],
  },
  {
    id: "mountain-sunrise",
    name: "Mountain Sunrise",
    category: "landscapes",
    prompt: "Alpine peak at dawn, first light hitting snowy summits, deep valley in shadow below, figure in climbing gear looking out, cinematic vastness.",
    gradient: ["#1a2a4a", "#ffc87a"],
  },
  {
    id: "lagos-sunset",
    name: "Lagos Sunset",
    category: "landscapes",
    prompt: "West African coastline at sunset, silhouetted palm trees against orange and pink sky, waves breaking on the beach, warm diasporic palette.",
    gradient: ["#4a1a33", "#ffa500"],
  },
];
