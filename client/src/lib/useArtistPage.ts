import { useState, useCallback } from "react";

export type LayoutStyle = "stack" | "card" | "hero";
export type LinkStyle = "solid" | "glass" | "outline";
export type ColorMode = "uniform" | "alternating";
export type CardShape = "rounded" | "pill" | "square";
export type IconShape = "rounded" | "circle" | "square";
export type ReleaseStyle = "glassmorphic" | "editorial";

export interface ArtistPageData {
  /** URL slug — e.g. "lazyjo" renders as lightningwolves.studio/u/lazyjo */
  handle: string;
  /** true once the user has claimed a handle and moved into the builder */
  claimed: boolean;
  /** Has the page been published publicly (vs. draft-only) */
  published: boolean;

  /* ── Identity ────────────────────────────────────────────────────── */
  displayName: string;
  bio: string;
  photoUrl: string;
  wolfId: string;
  location: string;
  /** What you do — multi-select up to 3 from a fixed list */
  roles: string[];

  /* ── Content ─────────────────────────────────────────────────────── */
  socialLinks: { platform: string; url: string }[];
  featuredTracks: { title: string; embedUrl: string }[];
  featuredVideos: { title: string; youtubeUrl: string }[];
  customLinks: { label: string; url: string }[];

  /* ── Design — LYRC-parity styling controls ───────────────────────── */
  themeColor: string;
  backgroundColor: string;
  headingFont: string;
  bodyFont: string;
  layoutStyle: LayoutStyle;
  linkStyle: LinkStyle;
  colorMode: ColorMode;
  cardShape: CardShape;
  iconShape: IconShape;
  releaseStyle: ReleaseStyle;
  showBranding: boolean;
}

const STORAGE_KEY = "lw-artist-page";

const DEFAULT_DATA: ArtistPageData = {
  handle: "",
  claimed: false,
  published: false,

  displayName: "",
  bio: "",
  photoUrl: "",
  wolfId: "",
  location: "",
  roles: [],

  socialLinks: [],
  featuredTracks: [],
  featuredVideos: [],
  customLinks: [],

  themeColor: "#f5c518",
  backgroundColor: "#0a0a0c",
  headingFont: "Bebas Neue",
  bodyFont: "Inter",
  layoutStyle: "stack",
  linkStyle: "outline",
  colorMode: "alternating",
  cardShape: "rounded",
  iconShape: "circle",
  releaseStyle: "glassmorphic",
  showBranding: true,
};

function load(): ArtistPageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_DATA, ...JSON.parse(raw) } : DEFAULT_DATA;
  } catch {
    return DEFAULT_DATA;
  }
}

function persist(data: ArtistPageData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // swallow — in-memory state still works
  }
}

export function useArtistPage() {
  const [data, setData] = useState<ArtistPageData>(load);

  const update = useCallback((partial: Partial<ArtistPageData>) => {
    setData((prev) => {
      const next = { ...prev, ...partial };
      persist(next);
      return next;
    });
  }, []);

  const claim = useCallback((handle: string, displayName: string) => {
    setData((prev) => {
      const next = { ...prev, handle, displayName, claimed: true };
      persist(next);
      return next;
    });
  }, []);

  const addSocialLink = useCallback((platform: string, url: string) => {
    setData((prev) => {
      const next = { ...prev, socialLinks: [...prev.socialLinks, { platform, url }] };
      persist(next);
      return next;
    });
  }, []);

  const removeSocialLink = useCallback((index: number) => {
    setData((prev) => {
      const next = { ...prev, socialLinks: prev.socialLinks.filter((_, i) => i !== index) };
      persist(next);
      return next;
    });
  }, []);

  const moveSocialLink = useCallback((fromIndex: number, toIndex: number) => {
    setData((prev) => {
      const arr = [...prev.socialLinks];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      const next = { ...prev, socialLinks: arr };
      persist(next);
      return next;
    });
  }, []);

  const addTrack = useCallback((title: string, embedUrl: string) => {
    setData((prev) => {
      const next = { ...prev, featuredTracks: [...prev.featuredTracks.slice(0, 4), { title, embedUrl }] };
      persist(next);
      return next;
    });
  }, []);

  const removeTrack = useCallback((index: number) => {
    setData((prev) => {
      const next = { ...prev, featuredTracks: prev.featuredTracks.filter((_, i) => i !== index) };
      persist(next);
      return next;
    });
  }, []);

  const addVideo = useCallback((title: string, youtubeUrl: string) => {
    setData((prev) => {
      const next = { ...prev, featuredVideos: [...prev.featuredVideos.slice(0, 2), { title, youtubeUrl }] };
      persist(next);
      return next;
    });
  }, []);

  const removeVideo = useCallback((index: number) => {
    setData((prev) => {
      const next = { ...prev, featuredVideos: prev.featuredVideos.filter((_, i) => i !== index) };
      persist(next);
      return next;
    });
  }, []);

  const addCustomLink = useCallback((label: string, url: string) => {
    setData((prev) => {
      const next = { ...prev, customLinks: [...prev.customLinks, { label, url }] };
      persist(next);
      return next;
    });
  }, []);

  const removeCustomLink = useCallback((index: number) => {
    setData((prev) => {
      const next = { ...prev, customLinks: prev.customLinks.filter((_, i) => i !== index) };
      persist(next);
      return next;
    });
  }, []);

  return {
    data,
    update,
    claim,
    addSocialLink,
    removeSocialLink,
    moveSocialLink,
    addTrack,
    removeTrack,
    addVideo,
    removeVideo,
    addCustomLink,
    removeCustomLink,
  };
}
