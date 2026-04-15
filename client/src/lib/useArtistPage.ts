import { useState, useCallback } from "react";

export interface ArtistPageData {
  displayName: string;
  bio: string;
  photoUrl: string;
  wolfId: string;
  themeColor: string;
  socialLinks: { platform: string; url: string }[];
  featuredTracks: { title: string; embedUrl: string }[];
  featuredVideos: { title: string; youtubeUrl: string }[];
}

const STORAGE_KEY = "lw-artist-page";

const DEFAULT_DATA: ArtistPageData = {
  displayName: "",
  bio: "",
  photoUrl: "",
  wolfId: "",
  themeColor: "#f5c518",
  socialLinks: [],
  featuredTracks: [],
  featuredVideos: [],
};

function load(): ArtistPageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_DATA, ...JSON.parse(raw) } : DEFAULT_DATA;
  } catch {
    return DEFAULT_DATA;
  }
}

export function useArtistPage() {
  const [data, setData] = useState<ArtistPageData>(load);

  const update = useCallback((partial: Partial<ArtistPageData>) => {
    setData((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addSocialLink = useCallback((platform: string, url: string) => {
    setData((prev) => {
      const next = { ...prev, socialLinks: [...prev.socialLinks, { platform, url }] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeSocialLink = useCallback((index: number) => {
    setData((prev) => {
      const next = { ...prev, socialLinks: prev.socialLinks.filter((_, i) => i !== index) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addTrack = useCallback((title: string, embedUrl: string) => {
    setData((prev) => {
      const next = { ...prev, featuredTracks: [...prev.featuredTracks.slice(0, 4), { title, embedUrl }] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeTrack = useCallback((index: number) => {
    setData((prev) => {
      const next = { ...prev, featuredTracks: prev.featuredTracks.filter((_, i) => i !== index) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addVideo = useCallback((title: string, youtubeUrl: string) => {
    setData((prev) => {
      const next = { ...prev, featuredVideos: [...prev.featuredVideos.slice(0, 2), { title, youtubeUrl }] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeVideo = useCallback((index: number) => {
    setData((prev) => {
      const next = { ...prev, featuredVideos: prev.featuredVideos.filter((_, i) => i !== index) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { data, update, addSocialLink, removeSocialLink, addTrack, removeTrack, addVideo, removeVideo };
}
