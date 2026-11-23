// Music-video loops. scripts/upload-video-loops.js (run on Jo's PC) cuts a 30 s
// square clip per music video into the public Supabase bucket `media` and lists
// them in lazyjo/videos/index.json. A song in that list plays its clip on the 3D
// cover while its player is open, and its preview is the clip's own sound.
import { media } from "../lib/media";

type VideoIndex = Record<string, { file: string; start?: number }>;

let index: Promise<VideoIndex> | null = null;

function load(): Promise<VideoIndex> {
  if (!index) {
    // the index is cached for 60 s by the bucket; bust it every 10 minutes on our side
    const bust = Math.floor(Date.now() / 600_000);
    index = fetch(media(`lazyjo/videos/index.json?t=${bust}`))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return index;
}

/** Public URL of this song's 30 s clip, or null if it has no music video. */
export async function videoFor(id: string): Promise<string | null> {
  const entry = (await load())[id];
  return entry?.file ? media(`lazyjo/videos/${entry.file}`) : null;
}

/** Start fetching the list early (e.g. while the intro screen shows). */
export function preloadVideoIndex(): void {
  void load();
}
