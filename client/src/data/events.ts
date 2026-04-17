// Gig-type roles that the Golden Board supports. Only the three "booking"
// roles — artists to perform, photographers and videographers to document —
// make sense for events. Songwriters, producers, and designers are
// collaboration roles and live only in Versus / Explore.
export type GigRole = "artist" | "photographer" | "videographer";

export interface GigEvent {
  id: string;
  title: string;
  host: string;          // Event organizer / promoter
  hostVerified?: boolean; // Paid ⭐ listing vs. a regular one
  country: string;       // Full country name
  flag: string;          // Emoji flag
  city: string;
  date: string;          // Human-readable date e.g. "May 24, 2026"
  heroImage?: string;    // Optional image/video — falls back to a gradient
  lookingFor: GigRole[];
  budget: string;        // e.g. "€500–1000" / "Paid" / "Exposure + travel"
  description: string;
}

// Mock events — spread across current + near-future territories so the
// Board feels lived-in on launch day.
export const gigEvents: GigEvent[] = [
  {
    id: "brussels-bloodmoon",
    title: "BLOODMOON WOLF NIGHT",
    host: "Lightning Wolves Live",
    hostVerified: true,
    country: "Belgium",
    flag: "\u{1F1E7}\u{1F1EA}",
    city: "Brussels",
    date: "May 24, 2026",
    lookingFor: ["artist", "videographer", "photographer"],
    budget: "€800 + travel",
    description:
      "400-cap warehouse show in the Brussels canal district. Headliner slot + 2 openers. Pro sound, full lighting rig. Looking for a videographer to cut a 3-minute aftermovie and a photographer for press shots. Drinks on the house.",
  },
  {
    id: "accra-sankofa",
    title: "SANKOFA BEATS FESTIVAL",
    host: "Afro Frequency Accra",
    hostVerified: true,
    country: "Ghana",
    flag: "\u{1F1EC}\u{1F1ED}",
    city: "Accra",
    date: "Jun 14–16, 2026",
    lookingFor: ["artist", "photographer"],
    budget: "€1500 + flights",
    description:
      "3-day Afrobeats + diaspora hip-hop festival, 2,000 tickets sold. 20-min festival slot for an international guest artist. Photographer brief: capture performances, crowd, and behind-the-scenes for the 2027 campaign.",
  },
  {
    id: "paris-rooftop",
    title: "ROOFTOP SESSIONS PARIS",
    host: "La Meute Studio",
    country: "France",
    flag: "\u{1F1EB}\u{1F1F7}",
    city: "Paris",
    date: "May 30, 2026",
    lookingFor: ["artist", "videographer"],
    budget: "€400",
    description:
      "Sunset rooftop show, 80-cap intimate crowd. Looking for a French-speaking melodic artist (20-min set) and a videographer who can deliver a cinematic live recording within 72h. Full PA provided.",
  },
  {
    id: "london-basement",
    title: "BASEMENT UK UNDERGROUND",
    host: "Lower East Collective",
    country: "UK",
    flag: "\u{1F1EC}\u{1F1E7}",
    city: "London",
    date: "Jul 4, 2026",
    lookingFor: ["artist", "photographer"],
    budget: "£600 + accom",
    description:
      "Sweaty 250-cap basement, peak-time slot (01:30). Drill / UK rap flavour, but open to hard melodic. Photographer: grainy, high-contrast, capture the whole night incl. green room.",
  },
  {
    id: "nyc-loft",
    title: "LOFT #27 — AFRO/R&B",
    host: "Loft 27 NYC",
    hostVerified: true,
    country: "USA",
    flag: "\u{1F1FA}\u{1F1F8}",
    city: "Brooklyn",
    date: "Aug 2, 2026",
    lookingFor: ["artist", "videographer", "photographer"],
    budget: "$1200 + flights",
    description:
      "Invite-only loft session, ~120 tastemakers + industry. 25-min live set, 2 songs pre-approved by curation team. We need a Loft 27 recap reel (videographer) and the full photo package for the series.",
  },
  {
    id: "lagos-beats",
    title: "LAGOS AFTERPARTY",
    host: "Island FM Lagos",
    country: "Nigeria",
    flag: "\u{1F1F3}\u{1F1EC}",
    city: "Lagos",
    date: "Jun 22, 2026",
    lookingFor: ["videographer"],
    budget: "₦350,000",
    description:
      "Closing set afterparty following the Island FM live broadcast. Need one videographer embedded with the talent from soundcheck to last drink. Final edit brief: 90-second vertical cut-down for IG/TikTok.",
  },
];

// Helper maps for filtering / display
export interface GigRoleMeta {
  id: GigRole;
  label: string;
  icon: string;
  color: string;
}

export const GIG_ROLES: GigRoleMeta[] = [
  { id: "artist",       label: "Artists",       icon: "\u{1F3A4}", color: "#f5c518" },
  { id: "videographer", label: "Videographers", icon: "\u{1F3AC}", color: "#82b1ff" },
  { id: "photographer", label: "Photographers", icon: "\u{1F4F8}", color: "#69f0ae" },
];

export const gigRoleMeta = (r: GigRole) => GIG_ROLES.find((m) => m.id === r);
