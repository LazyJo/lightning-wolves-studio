// Gig-type roles that the Golden Board supports. Only the three "booking"
// roles — artists to perform, photographers and videographers to document —
// make sense for events. Songwriters, producers, and designers are
// collaboration roles and live only in Versus / Explore.
export type GigRole = "artist" | "photographer" | "videographer";

// Which promoter plan was used to post the listing. Single Gig is the
// €49 one-shot; Venue + Label are the monthly plans that unlock the
// outbound website link on the listing.
export type PromoterTierId = "single-gig" | "venue" | "label-agency";

// Tiers that get an outbound website link on their listing.
export const TIERS_WITH_WEBSITE: PromoterTierId[] = ["venue", "label-agency"];

export interface GigApplication {
  id: string;            // Stable per gig+applicant so shortlist state can key on it
  name: string;          // Applicant display name
  handle?: string;       // @handle / artist tag
  country: string;       // Short label (e.g. "Belgium" / "UK")
  flag?: string;         // Optional emoji flag
  avatar?: string;       // Path or URL — falls back to initials if absent
  role: GigRole;         // The role they're pitching for
  note: string;          // Short pitch written by the applicant
  // Socials / links the applicant dropped so the organizer can vet quickly.
  links?: Array<{ label: string; href: string }>;
  submittedAt: string;   // ISO datetime (used for sort + "2h ago" relative labels)
  // If the applicant is a wolf already in the pack, link back to their profile.
  wolfId?: string;
}

export interface GigEvent {
  id: string;
  title: string;
  host: string;          // Event organizer / promoter
  hostVerified?: boolean; // Paid ⭐ listing vs. a regular one
  country: string;       // Full country name
  flag: string;          // Emoji flag
  city: string;
  date: string;          // Human-readable date e.g. "May 24, 2026"
  isoDate: string;       // Machine-sortable ISO date (used for past/upcoming split)
  heroImage?: string;    // Optional image/video — falls back to a gradient
  lookingFor: GigRole[];
  budget: string;        // e.g. "€500–1000" / "Paid" / "Exposure + travel"
  description: string;
  // Wolves that have been confirmed / booked for this gig, keyed by the
  // role they're filling. Used for wolf-profile social proof and the
  // "confirmed pack" section on the event detail.
  booked?: Array<{ wolfId: string; role: GigRole }>;
  // Applications received for this gig. Seeded with realistic mock
  // talent so the organizer inbox has shape before Supabase is wired.
  applications?: GigApplication[];
  // Promoter plan the listing was posted under. Drives the outbound
  // website-link gate: only Venue + Label/Agency tiers can attach a
  // `websiteUrl`, which is the upsell pull for Single Gig posters.
  tier?: PromoterTierId;
  // Optional outbound link to the organizer's site / event page. Only
  // rendered for tiers in TIERS_WITH_WEBSITE, even if set on others.
  websiteUrl?: string;
}

// Mock events — spread across current + near-future territories so the
// Board feels lived-in on launch day.
export const gigEvents: GigEvent[] = [
  // ─── Upcoming ───
  {
    id: "brussels-bloodmoon",
    title: "BLOODMOON WOLF NIGHT",
    host: "Lightning Wolves Live",
    hostVerified: true,
    country: "Belgium",
    flag: "\u{1F1E7}\u{1F1EA}",
    city: "Brussels",
    date: "May 24, 2026",
    isoDate: "2026-05-24",
    lookingFor: ["artist", "videographer", "photographer"],
    budget: "€800 + travel",
    tier: "label-agency",
    websiteUrl: "https://lightningwolves.live/bloodmoon",
    description:
      "400-cap warehouse show in the Brussels canal district. Headliner slot + 2 openers. Pro sound, full lighting rig. Looking for a videographer to cut a 3-minute aftermovie and a photographer for press shots. Drinks on the house.",
    booked: [
      { wolfId: "yellow", role: "artist" },       // Lazy Jo
      { wolfId: "green",  role: "photographer" }, // Shiteux
    ],
    applications: [
      {
        id: "brussels-bloodmoon-app-zirka",
        name: "Zirka",
        handle: "@zirka_official",
        country: "Belgium",
        flag: "\u{1F1E7}\u{1F1EA}",
        role: "artist",
        note: "Brussels-based, French HH. Can open the night with a 20-min set — my crowd is exactly your demo. Supporting Lazy Jo's energy, not competing.",
        submittedAt: "2026-04-17T14:21:00Z",
        wolfId: "purple",
        links: [
          { label: "Spotify", href: "https://open.spotify.com/artist/1OqzWGPZDe0jUkwS5ubUbF" },
        ],
      },
      {
        id: "brussels-bloodmoon-app-frost",
        name: "Frost",
        handle: "@frost.mc",
        country: "Belgium",
        flag: "\u{1F1E7}\u{1F1EA}",
        role: "artist",
        note: "Conscious hip-hop from Antwerp, 15-min set ready to run. Bilingual FR/NL so I can warm up the Brussels mix.",
        submittedAt: "2026-04-16T09:47:00Z",
      },
      {
        id: "brussels-bloodmoon-app-drippy",
        name: "Drippydesigns",
        handle: "@drippydesigns",
        country: "Belgium",
        flag: "\u{1F1E7}\u{1F1EA}",
        role: "videographer",
        note: "I can run solo — 3-min aftermovie delivered 72h post-show. Portfolio on the pack page.",
        submittedAt: "2026-04-15T21:10:00Z",
        wolfId: "blue",
      },
      {
        id: "brussels-bloodmoon-app-mira",
        name: "Mira Lens",
        handle: "@mira.lens",
        country: "Netherlands",
        flag: "\u{1F1F3}\u{1F1F1}",
        role: "photographer",
        note: "Amsterdam-based concert photographer — grainy, high-contrast, show + behind-the-scenes combo. Train to Brussels is an hour.",
        submittedAt: "2026-04-17T19:03:00Z",
        links: [
          { label: "Portfolio", href: "https://miralens.example" },
        ],
      },
    ],
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
    isoDate: "2026-06-14",
    lookingFor: ["artist", "photographer"],
    budget: "€1500 + flights",
    tier: "venue",
    websiteUrl: "https://afrofrequency.com/sankofa",
    description:
      "3-day Afrobeats + diaspora hip-hop festival, 2,000 tickets sold. 20-min festival slot for an international guest artist. Photographer brief: capture performances, crowd, and behind-the-scenes for the 2027 campaign.",
    booked: [{ wolfId: "yellow", role: "artist" }], // Lazy Jo (Ghanaian roots)
    applications: [
      {
        id: "accra-sankofa-app-amara",
        name: "Amara Gold",
        handle: "@amaragold",
        country: "Nigeria",
        flag: "\u{1F1F3}\u{1F1EC}",
        role: "artist",
        note: "Afrobeats + R&B, 4-song set tested at 3 festivals this year. Would love to represent the Lagos wave in Accra.",
        submittedAt: "2026-04-14T10:32:00Z",
      },
      {
        id: "accra-sankofa-app-kojo",
        name: "Kojo Frame",
        handle: "@kojoframe",
        country: "Ghana",
        flag: "\u{1F1EC}\u{1F1ED}",
        role: "photographer",
        note: "Accra-based photojournalist, covered Afrochella 2024. Can deliver full edit within 48h of close.",
        submittedAt: "2026-04-12T16:05:00Z",
        links: [{ label: "Instagram", href: "https://instagram.com/kojoframe" }],
      },
      {
        id: "accra-sankofa-app-shiteux",
        name: "Shiteux",
        handle: "@shiteux",
        country: "Belgium",
        flag: "\u{1F1E7}\u{1F1EA}",
        role: "photographer",
        note: "Pack photographer — happy to fly in if you cover the flight. Three-day full coverage, delivery in 5.",
        submittedAt: "2026-04-10T08:20:00Z",
        wolfId: "green",
      },
    ],
  },
  {
    id: "paris-rooftop",
    title: "ROOFTOP SESSIONS PARIS",
    host: "La Meute Studio",
    country: "France",
    flag: "\u{1F1EB}\u{1F1F7}",
    city: "Paris",
    date: "May 30, 2026",
    isoDate: "2026-05-30",
    lookingFor: ["artist", "videographer"],
    budget: "€400",
    tier: "single-gig",
    description:
      "Sunset rooftop show, 80-cap intimate crowd. Looking for a French-speaking melodic artist (20-min set) and a videographer who can deliver a cinematic live recording within 72h. Full PA provided.",
    booked: [{ wolfId: "purple", role: "artist" }], // Zirka (French HH)
    applications: [
      {
        id: "paris-rooftop-app-luna",
        name: "Luna Beats",
        handle: "@lunabeats",
        country: "France",
        flag: "\u{1F1EB}\u{1F1F7}",
        role: "artist",
        note: "Lo-fi French melodic — fits a sunset rooftop more than a club. 20 min no problem, all-original.",
        submittedAt: "2026-04-15T11:11:00Z",
      },
      {
        id: "paris-rooftop-app-rosakay",
        name: "Rosakay",
        handle: "@rosakay",
        country: "Belgium",
        flag: "\u{1F1E7}\u{1F1EA}",
        role: "artist",
        note: "French pop, Paris is my second home. Already have translation rights for my last 3 singles.",
        submittedAt: "2026-04-13T18:44:00Z",
        wolfId: "orange",
      },
      {
        id: "paris-rooftop-app-theo",
        name: "Theo Duval",
        handle: "@theo.duval.films",
        country: "France",
        flag: "\u{1F1EB}\u{1F1F7}",
        role: "videographer",
        note: "Paris-based, specialized in intimate live captures. 72h delivery is my default.",
        submittedAt: "2026-04-17T07:55:00Z",
      },
    ],
  },
  {
    id: "london-basement",
    title: "BASEMENT UK UNDERGROUND",
    host: "Lower East Collective",
    country: "UK",
    flag: "\u{1F1EC}\u{1F1E7}",
    city: "London",
    date: "Jul 4, 2026",
    isoDate: "2026-07-04",
    lookingFor: ["artist", "photographer"],
    budget: "£600 + accom",
    tier: "single-gig",
    description:
      "Sweaty 250-cap basement, peak-time slot (01:30). Drill / UK rap flavour, but open to hard melodic. Photographer: grainy, high-contrast, capture the whole night incl. green room.",
    applications: [
      {
        id: "london-basement-app-shadow",
        name: "Shadow MC",
        handle: "@shadow.mc",
        country: "UK",
        flag: "\u{1F1EC}\u{1F1E7}",
        role: "artist",
        note: "Drill out of Tottenham, slot-perfect for a 01:30 basement. I've run this room before under a different name.",
        submittedAt: "2026-04-16T23:58:00Z",
      },
      {
        id: "london-basement-app-blaze",
        name: "Blaze",
        handle: "@blaze.1800",
        country: "UK",
        flag: "\u{1F1EC}\u{1F1E7}",
        role: "artist",
        note: "Hard melodic — Future x UK meets. Can come with 2 hypemen or solo, your call.",
        submittedAt: "2026-04-14T15:22:00Z",
      },
    ],
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
    isoDate: "2026-08-02",
    lookingFor: ["artist", "videographer", "photographer"],
    budget: "$1200 + flights",
    tier: "venue",
    websiteUrl: "https://loft27.nyc",
    description:
      "Invite-only loft session, ~120 tastemakers + industry. 25-min live set, 2 songs pre-approved by curation team. We need a Loft 27 recap reel (videographer) and the full photo package for the series.",
    booked: [{ wolfId: "orange", role: "artist" }], // Rosakay
    applications: [
      {
        id: "nyc-loft-app-jai",
        name: "Jai Monroe",
        handle: "@jaimonroe",
        country: "USA",
        flag: "\u{1F1FA}\u{1F1F8}",
        role: "videographer",
        note: "Brooklyn-based, shot the last 4 Loft 27 sessions. Have the house lighting preset dialed.",
        submittedAt: "2026-04-17T03:11:00Z",
        links: [{ label: "Reel", href: "https://jaimonroe.example/reel" }],
      },
      {
        id: "nyc-loft-app-zoe",
        name: "Zoe Harada",
        handle: "@zoeharada",
        country: "USA",
        flag: "\u{1F1FA}\u{1F1F8}",
        role: "photographer",
        note: "Intimate venue specialist — loft rooms are my jam. Full photo package + same-day selects.",
        submittedAt: "2026-04-16T20:42:00Z",
      },
      {
        id: "nyc-loft-app-zirka",
        name: "Zirka",
        handle: "@zirka_official",
        country: "Belgium",
        flag: "\u{1F1E7}\u{1F1EA}",
        role: "artist",
        note: "NYC tastemaker room is the exact listener I want. Flying in regardless for a showcase week.",
        submittedAt: "2026-04-13T12:08:00Z",
        wolfId: "purple",
      },
    ],
  },
  {
    id: "lagos-beats",
    title: "LAGOS AFTERPARTY",
    host: "Island FM Lagos",
    country: "Nigeria",
    flag: "\u{1F1F3}\u{1F1EC}",
    city: "Lagos",
    date: "Jun 22, 2026",
    isoDate: "2026-06-22",
    lookingFor: ["videographer"],
    budget: "₦350,000",
    tier: "single-gig",
    description:
      "Closing set afterparty following the Island FM live broadcast. Need one videographer embedded with the talent from soundcheck to last drink. Final edit brief: 90-second vertical cut-down for IG/TikTok.",
    applications: [
      {
        id: "lagos-beats-app-tunde",
        name: "Tunde Ade",
        handle: "@tunde.ade.visuals",
        country: "Nigeria",
        flag: "\u{1F1F3}\u{1F1EC}",
        role: "videographer",
        note: "Vertical-first videographer. Island FM regulars already have my edits in rotation.",
        submittedAt: "2026-04-15T06:33:00Z",
      },
    ],
  },

  // ─── Past (for profile history / social proof) ───
  {
    id: "brussels-lightning-launch",
    title: "LIGHTNING WOLVES LAUNCH",
    host: "Lightning Wolves Live",
    hostVerified: true,
    country: "Belgium",
    flag: "\u{1F1E7}\u{1F1EA}",
    city: "Brussels",
    date: "Feb 14, 2026",
    isoDate: "2026-02-14",
    lookingFor: ["artist", "videographer", "photographer"],
    budget: "€500",
    description:
      "The night it all kicked off. Three-act launch show at Ancienne Belgique. Full pack on the bill, aftermovie still in rotation on socials.",
    booked: [
      { wolfId: "yellow", role: "artist" },
      { wolfId: "purple", role: "artist" },
      { wolfId: "orange", role: "artist" },
      { wolfId: "green",  role: "photographer" },
      { wolfId: "blue",   role: "videographer" }, // Drippydesigns doubled as vid on launch
    ],
  },
  {
    id: "brussels-stay-up-release",
    title: "'STAY UP' RELEASE PARTY",
    host: "Lazy Jo / Lightning Wolves",
    hostVerified: true,
    country: "Belgium",
    flag: "\u{1F1E7}\u{1F1EA}",
    city: "Brussels",
    date: "Mar 8, 2026",
    isoDate: "2026-03-08",
    lookingFor: ["photographer", "videographer"],
    budget: "€300",
    description:
      "Intimate release party for Lazy Jo's single 'Stay Up'. Documented end-to-end by the pack for the 100K-view campaign.",
    booked: [
      { wolfId: "yellow", role: "artist" },
      { wolfId: "green",  role: "photographer" },
    ],
  },
  {
    id: "paris-hiver-showcase",
    title: "HIVER SHOWCASE",
    host: "Radar Paris",
    country: "France",
    flag: "\u{1F1EB}\u{1F1F7}",
    city: "Paris",
    date: "Jan 28, 2026",
    isoDate: "2026-01-28",
    lookingFor: ["artist"],
    budget: "€350",
    description:
      "Winter tastemaker showcase. French-language melodic sets curated for industry ears.",
    booked: [
      { wolfId: "purple", role: "artist" },
      { wolfId: "orange", role: "artist" },
    ],
  },
];

/* ─── Helpers for wolf-profile booking history ─── */

// NOTE: kept module-local so App code doesn't rely on Date parsing of the
// human `date` field. `isoDate` is the sortable source of truth.
const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const gigsForWolf = (wolfId: string): GigEvent[] =>
  gigEvents.filter((e) => e.booked?.some((b) => b.wolfId === wolfId));

export interface SplitBookings {
  upcoming: Array<{ event: GigEvent; role: GigRole }>;
  past: Array<{ event: GigEvent; role: GigRole }>;
}

export function bookingsForWolf(wolfId: string): SplitBookings {
  const today = todayIso();
  const upcoming: SplitBookings["upcoming"] = [];
  const past: SplitBookings["past"] = [];
  gigEvents.forEach((event) => {
    const b = event.booked?.find((x) => x.wolfId === wolfId);
    if (!b) return;
    const bucket = event.isoDate >= today ? upcoming : past;
    bucket.push({ event, role: b.role });
  });
  // Upcoming: earliest first. Past: most recent first.
  upcoming.sort((a, b) => a.event.isoDate.localeCompare(b.event.isoDate));
  past.sort((a, b) => b.event.isoDate.localeCompare(a.event.isoDate));
  return { upcoming, past };
}

/* ─── Helpers for the organizer inbox ─── */

// Upcoming gigs that have received at least one application.
export function gigsWithApplications(): GigEvent[] {
  const today = todayIso();
  return gigEvents
    .filter((e) => e.isoDate >= today && (e.applications?.length ?? 0) > 0)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

// Total seeded applications across upcoming gigs.
export function totalApplicationsCount(): number {
  return gigsWithApplications().reduce(
    (sum, e) => sum + (e.applications?.length ?? 0),
    0
  );
}

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

/* ─── Promoter pricing (who pays to post on the Golden Board) ─── */

export interface PromoterTier {
  id: string;
  name: string;
  tagline: string;          // One-line positioning
  price: string;            // Shown prominently
  period: string;           // "/month", "one-time", etc.
  icon: string;             // Emoji
  color: string;            // Accent color
  popular?: boolean;
  cta: string;
  features: string[];
}

export const promoterTiers: PromoterTier[] = [
  {
    id: "single-gig",
    name: "Single Gig",
    tagline: "One show, one listing, no commitment.",
    price: "€49",
    period: "one-time",
    icon: "\u{1F39F}\u{FE0F}",
    color: "#82b1ff",
    cta: "Post a single gig",
    features: [
      "1 event listing",
      "Visible for 30 days",
      "Receive applications in-app",
      "Country + role filtering",
      "No subscription — pay once",
      "In-app applications only — no outbound link",
    ],
  },
  {
    id: "venue",
    name: "Venue",
    tagline: "For active promoters running regular shows.",
    price: "€99",
    period: "/month",
    icon: "\u{1F3DF}\u{FE0F}",
    color: "#f5c518",
    popular: true,
    cta: "Start posting",
    features: [
      "Unlimited event listings",
      "60-day visibility per listing",
      "Verified organizer badge \u2714",
      "\u{1F310} Outbound website link on every listing",
      "Direct message with applicants",
      "Basic analytics (views, applies)",
      "Cancel anytime",
    ],
  },
  {
    id: "label-agency",
    name: "Label / Agency",
    tagline: "For labels, festivals, booking agencies.",
    price: "€299",
    period: "/month",
    icon: "\u{1F3C6}",
    color: "#E040FB",
    cta: "Talk to sales",
    features: [
      "Everything in Venue",
      "Priority placement on the board",
      "Featured hero slot rotation",
      "\u{1F310} Featured website link + custom organizer page",
      "Full analytics + export",
      "Multi-seat team access",
      "Priority support",
    ],
  },
];

export const promoterFAQ: { q: string; a: string }[] = [
  {
    q: "How long does my listing stay on the board?",
    a: "Single Gig listings stay visible for 30 days. Venue and Label plans extend that to 60 days per listing, and you can refresh or re-post any time.",
  },
  {
    q: "Do I pay per applicant?",
    a: "No. You pay for the listing. Applications come through the app — message the ones you like directly.",
  },
  {
    q: "Can I upgrade or cancel?",
    a: "Monthly plans cancel at the end of the billing period, no questions asked. Upgrades are prorated and take effect immediately.",
  },
  {
    q: "What if my event is free / exposure-only?",
    a: "You can still post it — just set the budget field to \u201CExposure + perks\u201D. The pack knows what they\u2019re signing up for.",
  },
];
