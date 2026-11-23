import raw from "./singles.json";
import { media } from "../lib/media";

export type CoverMotif =
  | "portrait"
  | "city"
  | "orb"
  | "crown"
  | "moon"
  | "road"
  | "silhouette"
  | "bolt";

export interface Single {
  id: string;
  /** position on the album JAVEDA (the catalogue is in album order) */
  track: number | null;
  title: string;
  /** featured artist, shown as "feat. X" */
  feat: string | null;
  year: number | null;
  /** minimum price (the server enforces it) */
  priceCents: number;
  /** the amount the player preselects ("Suggested") */
  suggestedCents: number;
  cover: string | null;
  previewUrl: string | null;
  palette: [string, string, string];
  motif: CoverMotif;
  vinyl: boolean;
  placeholder: boolean;
  /** false until the WAV is uploaded: no checkout, "WAV coming soon" instead */
  forSale: boolean;
  /** music video on YouTube: a 30 s loop plays on the cover, the preview is its sound */
  youtube: { id: string; start: number; zoom: number } | null;
}

export const ARTIST = raw.artist;
export const CURRENCY = raw.currency;
export const SINGLES: Single[] = raw.singles.map((s) => ({
  id: s.id,
  track: "track" in s && typeof s.track === "number" ? s.track : null,
  title: s.title,
  feat: "feat" in s && typeof s.feat === "string" ? s.feat : null,
  year: s.year ?? null,
  priceCents: s.priceCents,
  suggestedCents: "suggestedCents" in s && typeof s.suggestedCents === "number" ? Math.max(s.suggestedCents, s.priceCents) : s.priceCents,
  cover: s.cover,
  previewUrl: s.previewUrl,
  palette: s.palette as [string, string, string],
  motif: s.motif as CoverMotif,
  vinyl: s.vinyl,
  placeholder: s.placeholder,
  forSale: !("forSale" in s && s.forSale === false),
  youtube:
    "youtube" in s && s.youtube && typeof s.youtube.id === "string"
      ? { id: s.youtube.id, start: Number(s.youtube.start) || 0, zoom: Number(s.youtube.zoom) || 1 }
      : null,
}));

export const singleById = new Map(SINGLES.map((s) => [s.id, s]));

/* ─── per-song colours: the player takes its accents from the cover ─── */
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** CSS variables that recolour the player (border, corners, play, prices, Buy) to the song. */
export function themeStyle(s: Single): Record<string, string> {
  const [, a, b] = s.palette;
  // text on the accent buttons: dark or white, whichever reads better on BOTH accents
  const la = luminance(a);
  const lb = luminance(b);
  const dark = Math.min(contrast(la, 0.005), contrast(lb, 0.005));
  const light = Math.min(contrast(la, 1), contrast(lb, 1));
  return {
    "--lj-cyan": a,
    "--lj-blue": `color-mix(in srgb, ${a} 55%, ${b})`,
    "--lj-purple": b,
    "--lj-accent-end": b,
    "--lj-accent-deep": `color-mix(in srgb, ${b} 70%, black)`,
    "--lj-line": `color-mix(in srgb, ${a} 30%, transparent)`,
    "--lj-on-accent": dark >= light ? "#05070d" : "#ffffff",
  };
}

export const ALBUM: string | null = "album" in raw && typeof raw.album === "string" ? raw.album : null;

/** "Somebody (feat. Zirka)" */
export function fullTitle(s: Single): string {
  return s.feat ? `${s.title} (feat. ${s.feat})` : s.title;
}

/** "JAVEDA · Track 02" for album songs, else the year ("2023"). */
export function releaseLabel(s: Single): string {
  if (s.track && ALBUM) return `${ALBUM} \u00b7 Track ${String(s.track).padStart(2, "0")}`;
  return s.year ? `Single \u00b7 ${s.year}` : "Single";
}

const fmt = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: CURRENCY.toUpperCase(),
});

export function formatPrice(cents: number): string {
  return fmt.format(cents / 100);
}

export const PREVIEW_SECONDS = 30;

/** server.js caps "pay what you want" at the same amount (LAZYJO_MAX_CENTS) */
export const MAX_CENTS = 50000;

export const currencySymbol = fmt.formatToParts(0).find((p) => p.type === "currency")?.value ?? "\u20ac";

/** The Lazy Jo card that opens from the spiral galaxy. Facts mirror
 *  client/src/data/wolves.ts (Lazy Jo's Lightning Wolves profile). */
export interface CoSign {
  name: string;
  photo: string;
  quote: string;
  /** where it happened: "YouTube", "Instagram", "DM on Instagram", "In person" */
  context: string;
  link?: string;
  linkLabel?: string;
  /** photos / a video that prove it, shown under the quote */
  proof?: ProofMedia[];
}

export interface ProofMedia {
  type: "image" | "video";
  src: string;
  alt: string;
  /** still frame for videos (also the fallback if the video isn't uploaded yet) */
  poster?: string;
}

export const ARTIST_PROFILE = {
  name: "Lazy Jo",
  photo: "/LazyJo - StayUp pictures from videoshoot (CS)_-86.JPG.jpeg",
  tagline: "Melodic hip-hop · Brussels",
  bio: "Belgian-Ghanaian artist, born in Lomé, based in Brussels. Melodic flows, emotional hooks \u2014 \u201cStay Up\u201d passed 100K views.",
  /** shown at the top of "My story" */
  storyImage: { src: "/lazyjo/proof/stayup-100k-plaque.webp", alt: "Lazy Jo with his Spotify 100,000 streams plaque", caption: "100,000 streams on Spotify" },
  /** "My story": the full bio, shown inside the card */
  story: [
    "Born in 1999 in Lomé, Togo. Belgian-Ghanaian, based in Brussels.",
    "Lazy Jo launched in February 2018 with \u201cI\u2019m Lost.\u201d Since then he\u2019s been known for melodic flows, emotionally driven delivery and hooks that stay with you.",
    "\u201cStay Up\u201d went past 100K views, and the music has been co-signed by Timbaland, Symba, DDG and more.",
  ],
  coSigns: [
    { name: "Timbaland", photo: "/Timbaland.jpeg", quote: "This could be the best song", context: "YouTube", link: "https://www.youtube.com/watch?v=u-MHafxpqhw", linkLabel: "Watch on YouTube" },
    { name: "Symba", photo: "/Symba.jpeg", quote: "International as a M*****f*****r", context: "YouTube", link: "https://www.youtube.com/shorts/mKTSI8Wqw5A", linkLabel: "Watch on YouTube" },
    {
      name: "DDG", photo: "/DDG.jpeg", quote: "Next Up", context: "Instagram", link: "https://www.instagram.com/p/Cxf_nEFo4v5/", linkLabel: "Watch on Instagram",
      // the crowd video lives in Supabase Storage (media bucket), not in the deploy
      proof: [{ type: "video", src: media("lazyjo/ddg-crowd.mp4"), poster: "/lazyjo/proof/ddg-crowd-poster.jpg", alt: "Lazy Jo performing in Brussels, surrounded by a packed room" }],
    },
    { name: "Kelvyn Colt", photo: "/Kelvyn Colt.jpeg", quote: "Go get it my g!!", context: "DM on Instagram" },
    { name: "Zaytoven", photo: "/Zaytoven.jpeg", quote: "Liked the post", context: "Instagram", link: "https://www.instagram.com/p/Cxf_nEFo4v5/", linkLabel: "See it on Instagram" },
    {
      name: "6ix9ine", photo: "/6ix9ine.jpeg", quote: "Met in real life", context: "In person",
      proof: [
        { type: "image", src: "/lazyjo/proof/6ix9ine-1.webp", alt: "Lazy Jo and 6ix9ine together" },
        { type: "image", src: "/lazyjo/proof/6ix9ine-2.webp", alt: "Selfie of 6ix9ine and Lazy Jo" },
      ],
    },
    { name: "Kid Hazel", photo: "/Kid Hazel.jpeg", quote: "Them songs was hard on ya page fam", context: "DM on Instagram" },
  ] as CoSign[],
  merchUrl: "https://www.even.biz/l/lightningwolves",
  instagramHandle: "@lazyjo_",
  instagramUrl: "https://instagram.com/lazyjo_",
};

/** The exact sentence fans agree to. server.js stores its own copy
 *  (LAZYJO_CONSENT_TEXT) with every sign-up — keep the two identical. */
export const JOIN_CONSENT_TEXT =
  "Yes, send me news from Lazy Jo: new music, drops and shows. I can unsubscribe anytime.";
