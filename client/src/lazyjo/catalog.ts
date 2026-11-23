import raw from "./singles.json";

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
  title: string;
  year: number;
  priceCents: number;
  cover: string | null;
  previewUrl: string | null;
  palette: [string, string, string];
  motif: CoverMotif;
  vinyl: boolean;
  placeholder: boolean;
}

export const ARTIST = raw.artist;
export const CURRENCY = raw.currency;
export const SINGLES: Single[] = raw.singles.map((s) => ({
  id: s.id,
  title: s.title,
  year: s.year,
  priceCents: s.priceCents,
  cover: s.cover,
  previewUrl: s.previewUrl,
  palette: s.palette as [string, string, string],
  motif: s.motif as CoverMotif,
  vinyl: s.vinyl,
  placeholder: s.placeholder,
}));

export const singleById = new Map(SINGLES.map((s) => [s.id, s]));

const fmt = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: CURRENCY.toUpperCase(),
});

export function formatPrice(cents: number): string {
  return fmt.format(cents / 100);
}

/** Fallback when Stripe checkout isn't configured yet: Jo's existing fan-support page. */
export const FAN_SUPPORT_URL = "https://www.even.biz/l/lazyjomusic";
export const PREVIEW_SECONDS = 30;

/** The Lazy Jo card that opens from the spiral galaxy. Facts mirror
 *  client/src/data/wolves.ts (Lazy Jo's Lightning Wolves profile). */
export const ARTIST_PROFILE = {
  name: "Lazy Jo",
  photo: "/LazyJo - StayUp pictures from videoshoot (CS)_-86.JPG.jpeg",
  tagline: "Melodic hip-hop · Brussels",
  bio: "Belgian-Ghanaian artist, born in Lomé, based in Brussels. Melodic flows, emotional hooks — “Stay Up” passed 100K views.",
  coSigns: [
    { name: "Timbaland", photo: "/Timbaland.jpeg", quote: "This could be the best song" },
    { name: "Symba", photo: "/Symba.jpeg", quote: "International" },
    { name: "DDG", photo: "/DDG.jpeg", quote: "Next up" },
    { name: "Kelvyn Colt", photo: "/Kelvyn Colt.jpeg", quote: "Go get it" },
    { name: "Zaytoven", photo: "/Zaytoven.jpeg", quote: "Liked the post" },
    { name: "Kid Hazel", photo: "/Kid Hazel.jpeg", quote: "Them songs was hard" },
  ],
  storyUrl: "/?wolf=lazy-jo",
  merchUrl: "https://www.even.biz/l/lightningwolves",
  instagramUrl: "https://instagram.com/lazyjoo_",
};
