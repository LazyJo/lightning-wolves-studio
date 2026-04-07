export interface Acknowledgement {
  name: string;
  quote: string;
  photo: string;
  link: string;
  platform: string;
}

export interface WolfProfile {
  bio: string;
  fullBio?: string;
  lang?: "en" | "fr";
  spotify?: string;
  instagram?: string;
  youtube?: string;
  booking?: string;
  merch?: string;
  fanSupport?: string;
  email?: string;
  photo?: string;
  performanceVideo?: string;
  acknowledgements?: Acknowledgement[];
}

export interface Wolf {
  id: string;
  artist: string;
  genre: string;
  color: string;
  video?: string;
  image?: string;
  status: "active" | "coming-soon" | "locked" | "special" | "cta";
  profile?: WolfProfile;
}

export const wolves: Wolf[] = [
  {
    id: "yellow",
    artist: "Lazy Jo",
    genre: "Melodic Hip-Hop",
    color: "#f5c518",
    video: "/Lazy Jo Wolf Card Animation.mp4",
    image: "/wolf-yellow.svg",
    status: "active",
    profile: {
      bio: "Belgian-Ghanaian artist from Brussels. Melodic flows, emotional hooks, unforgettable sound.",
      fullBio:
        "Born 1999 in Lome, Togo. Based in Brussels. Launched Feb 2018 with 'I'm Lost.' Known for melodic flows, emotionally driven delivery, and unforgettable hooks. Track 'Stay Up' surpassed 100K views. Co-signed by Timbaland, Symba, DDG & more.",
      spotify: "https://open.spotify.com/embed/artist/1gxwDVgOKYnTA3iq2CjLtM",
      instagram: "https://instagram.com/lazyjoo_",
      youtube: "https://youtube.com/@lightningwolves",
      booking: "https://www.gigstarter.be/artists/lazy-jo",
      merch: "https://www.even.biz/l/lightningwolves",
      fanSupport: "https://www.even.biz/l/lazyjomusic",
      email: "Lazyjo.official@gmail.com",
      photo: "/LazyJo - StayUp pictures from videoshoot (CS)_-86.JPG.jpeg",
      performanceVideo: "/Lazy Jo Performance Video.mp4",
      acknowledgements: [
        {
          name: "Timbaland",
          quote: "This could be the best song",
          photo: "/Timbaland.jpeg",
          link: "https://www.youtube.com/watch?v=u-MHafxpqhw",
          platform: "YouTube",
        },
        {
          name: "Symba",
          quote: "International as a M*****f*****r",
          photo: "/Symba.jpeg",
          link: "https://www.youtube.com/shorts/mKTSI8Wqw5A",
          platform: "YouTube",
        },
        {
          name: "DDG",
          quote: "Next Up",
          photo: "/DDG.jpeg",
          link: "https://www.instagram.com/p/Cxf_nEFo4v5/",
          platform: "Instagram",
        },
        {
          name: "Kelvyn Colt",
          quote: "Go get it my g!!",
          photo: "/Kelvyn Colt.jpeg",
          link: "",
          platform: "DM on Instagram",
        },
        {
          name: "Zaytoven",
          quote: "Liked the post",
          photo: "/Zaytoven.jpeg",
          link: "https://www.instagram.com/p/Cxf_nEFo4v5/",
          platform: "Instagram",
        },
        {
          name: "Kid Hazel",
          quote: "Them songs was hard on ya page fam",
          photo: "/Kid Hazel.jpeg",
          link: "",
          platform: "DM on Instagram",
        },
      ],
    },
  },
  {
    id: "purple",
    artist: "Zirka",
    genre: "French Hip-Hop",
    color: "#9b6dff",
    video: "/Wolf-Purple.mp4",
    image: "/wolf-purple.svg",
    status: "active",
    profile: {
      bio: "French hip-hop energy with melodic punch. Raw energy and authentic flow from the streets of France.",
      spotify:
        "https://open.spotify.com/embed/artist/1OqzWGPZDe0jUkwS5ubUbF",
    },
  },
  {
    id: "orange",
    artist: "Rosakay",
    genre: "Pop / French Pop",
    color: "#ff9500",
    video: "/Wolf-Orange.mp4",
    image: "/wolf-orange.svg",
    status: "active",
    profile: {
      bio: "Nee a Kinshasa, elevee entre Kigali et la Belgique, Rosakay mele folk rock, pop, R&B et variete francaise dans un univers intime et sincere.",
      fullBio:
        "Nee a Kinshasa (racines rwando-congolaises). A demenage a Kigali a 11 ans, puis en Belgique. Inspiree par Mumford & Sons. Influences: folk rock, pop rock, R&B, variete francaise. Themes: l'amour sous toutes ses formes.",
      lang: "fr",
      spotify:
        "https://open.spotify.com/embed/artist/5DaB9HZOXF1kOqxLiS2d4B",
      instagram: "https://www.instagram.com/rosakay_officiel",
      photo: "/Rosakay Profile.jpeg",
    },
  },
  {
    id: "blue",
    artist: "Drippydesigns",
    genre: "Covers & Trailers",
    color: "#82b1ff",
    video: "/wolf-white-blue.mp4",
    image: "/wolf-blue.svg",
    status: "active",
    profile: {
      bio: "The visual identity behind the pack. Drippydesigns crafts the aesthetic world of Lightning Wolves — from logos to merch to the digital presence.",
    },
  },
  {
    id: "lone-wolf",
    artist: "Lone Wolf",
    genre: "3 Free Generations",
    color: "#f5c518",
    image: "/wolf-hub.png",
    status: "special",
  },
  {
    id: "green",
    artist: "Shiteux",
    genre: "Photos & Videos",
    color: "#69f0ae",
    video: "/Wolf-Green.mp4",
    image: "/wolf-green.svg",
    status: "active",
    profile: {
      bio: "Pierre Van der Heyde — the one behind the camera and behind the beat. Documents the Lightning Wolves world through photos, video, and sound.",
      fullBio:
        "Born in Belgium in 1997. Projects: 'Sin[e]' and 'Doubt Clouds' lo-fi meditations, and 'Behind this Luck' chillout project.",
      spotify:
        "https://open.spotify.com/embed/artist/4Uagbm0Dkl6hpM96LEYCo9",
    },
  },
  {
    id: "red",
    artist: "Hendrik Vits",
    genre: "Coming Soon",
    color: "#E53935",
    video: "/Wolf - Red.mp4",
    image: "/wolf-red.svg",
    status: "coming-soon",
  },
  {
    id: "white",
    artist: "DR. MKY",
    genre: "Coming Soon",
    color: "#e8e8e8",
    video: "/White Wolf Animation.mp4",
    image: "/wolf-white.svg",
    status: "coming-soon",
  },
  {
    id: "pink",
    artist: "Kathy Korasak",
    genre: "Coming Soon",
    color: "#E040FB",
    video: "/Pink Wolf Animation.mp4",
    image: "/wolf-pink.svg",
    status: "coming-soon",
  },
  {
    id: "lock-1",
    artist: "???",
    genre: "Coming Soon",
    color: "#333333",
    image: "/wolf-black.svg",
    status: "locked",
  },
  {
    id: "join-pack",
    artist: "Join the Pack",
    genre: "Apply to Join",
    color: "#f5c518",
    image: "/LightningWolfYellowTransparentBG.png",
    status: "cta",
  },
  {
    id: "lock-2",
    artist: "???",
    genre: "Coming Soon",
    color: "#333333",
    image: "/wolf-black.svg",
    status: "locked",
  },
];

export const activeWolves = wolves.filter((w) => w.status === "active");

export interface Territory {
  id: string;
  name: string;
  flag: string;
  top: string;
  left: string;
  artists: string[]; // wolf IDs
}

export const territories: Territory[] = [
  { id: "ghana", name: "Ghana", flag: "\u{1F1EC}\u{1F1ED}", top: "20%", left: "48%", artists: ["yellow"] },
  { id: "usa", name: "USA", flag: "\u{1F1FA}\u{1F1F8}", top: "35%", left: "33%", artists: [] },
  { id: "uk", name: "UK", flag: "\u{1F1EC}\u{1F1E7}", top: "35%", left: "63%", artists: [] },
  { id: "belgium", name: "Belgium", flag: "\u{1F1E7}\u{1F1EA}", top: "48%", left: "33%", artists: ["yellow", "purple", "orange"] },
  { id: "france", name: "France", flag: "\u{1F1EB}\u{1F1F7}", top: "48%", left: "63%", artists: [] },
  { id: "nigeria", name: "Nigeria", flag: "\u{1F1F3}\u{1F1EC}", top: "58%", left: "48%", artists: [] },
];

export interface PricingTier {
  name: string;
  price: string;
  period: string;
  generations: string;
  credits: string;
  features: string[];
  popular?: boolean;
  bestValue?: boolean;
  status: "active" | "coming-soon";
}

export const pricingTiers: PricingTier[] = [
  {
    name: "Lone Wolf",
    price: "Free",
    period: "forever",
    generations: "3 lifetime",
    credits: "10",
    features: ["Subtitle & Minimal styles", "Basic lyric overlay", "10 Lightning Credits on signup"],
    status: "active",
  },
  {
    name: "Starter",
    price: "$9",
    period: "/month",
    generations: "50/month",
    credits: "100/month",
    features: ["No watermark", "All styles + animations", "Basic beat detection", "100 Credits/month"],
    status: "coming-soon",
  },
  {
    name: "Wolf Pro",
    price: "$24",
    period: "/month",
    generations: "Unlimited",
    credits: "350/month",
    features: ["Full timeline editor", "All styles + beat drop effects", "AI model access", "Priority processing", "350 Credits/month"],
    popular: true,
    status: "coming-soon",
  },
  {
    name: "Pack Leader",
    price: "$49",
    period: "/month",
    generations: "Unlimited",
    credits: "Unlimited",
    features: ["Everything in Wolf Pro", "4K export", "Early access to new AI models", "Dedicated support", "Unlimited Credits"],
    bestValue: true,
    status: "coming-soon",
  },
];

export interface CreditPack {
  credits: number;
  price: string;
  gens: string;
}

export const creditPacks: CreditPack[] = [
  { credits: 100, price: "\u20AC3", gens: "~10 gens" },
  { credits: 300, price: "\u20AC8", gens: "~30 gens" },
  { credits: 750, price: "\u20AC18", gens: "~75 gens" },
  { credits: 2000, price: "\u20AC39", gens: "~200 gens" },
];
