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
