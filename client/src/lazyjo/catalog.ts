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
export interface CoSign {
  name: string;
  photo: string;
  quote: string;
  /** where it happened: "YouTube", "Instagram", "DM on Instagram", "In person" */
  context: string;
  link?: string;
  linkLabel?: string;
}

export const ARTIST_PROFILE = {
  name: "Lazy Jo",
  photo: "/LazyJo - StayUp pictures from videoshoot (CS)_-86.JPG.jpeg",
  tagline: "Melodic hip-hop · Brussels",
  bio: "Belgian-Ghanaian artist, born in Lomé, based in Brussels. Melodic flows, emotional hooks \u2014 \u201cStay Up\u201d passed 100K views.",
  /** "My story": the full bio, shown inside the card */
  story: [
    "Born in 1999 in Lomé, Togo. Belgian-Ghanaian, based in Brussels.",
    "Lazy Jo launched in February 2018 with \u201cI\u2019m Lost.\u201d Since then he\u2019s been known for melodic flows, emotionally driven delivery and hooks that stay with you.",
    "\u201cStay Up\u201d went past 100K views, and the music has been co-signed by Timbaland, Symba, DDG and more.",
  ],
  coSigns: [
    { name: "Timbaland", photo: "/Timbaland.jpeg", quote: "This could be the best song", context: "YouTube", link: "https://www.youtube.com/watch?v=u-MHafxpqhw", linkLabel: "Watch on YouTube" },
    { name: "Symba", photo: "/Symba.jpeg", quote: "International as a M*****f*****r", context: "YouTube", link: "https://www.youtube.com/shorts/mKTSI8Wqw5A", linkLabel: "Watch on YouTube" },
    { name: "DDG", photo: "/DDG.jpeg", quote: "Next Up", context: "Instagram", link: "https://www.instagram.com/p/Cxf_nEFo4v5/", linkLabel: "Watch on Instagram" },
    { name: "6ix9ine", photo: "/6ix9ine.jpeg", quote: "Met in real life", context: "In person" },
    { name: "Kelvyn Colt", photo: "/Kelvyn Colt.jpeg", quote: "Go get it my g!!", context: "DM on Instagram" },
    { name: "Zaytoven", photo: "/Zaytoven.jpeg", quote: "Liked the post", context: "Instagram", link: "https://www.instagram.com/p/Cxf_nEFo4v5/", linkLabel: "See it on Instagram" },
    { name: "Kid Hazel", photo: "/Kid Hazel.jpeg", quote: "Them songs was hard on ya page fam", context: "DM on Instagram" },
  ] as CoSign[],
  merchUrl: "https://www.even.biz/l/lightningwolves",
  instagramHandle: "@lazyjo_",
  instagramUrl: "https://instagram.com/lazyjo_",
};
