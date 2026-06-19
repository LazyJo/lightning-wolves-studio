import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Download,
  Trash2,
  Loader2,
  RefreshCw,
  Film,
  Clapperboard,
} from "lucide-react";
import {
  listStudioVideos,
  deleteStudioVideo,
  type StudioVideo,
} from "../../lib/api";

interface Props {
  onBack: () => void;
}

// Per-mode accent so a glance tells you which tool made each clip — matches
// the studio's per-surface colours (Remix yellow, Scenes green, Performance pink).
const MODE_META: Record<string, { label: string; color: string }> = {
  remix: { label: "Remix", color: "#f5c518" },
  scenes: { label: "Scenes", color: "#69f0ae" },
  performance: { label: "Performance", color: "#E040FB" },
  video: { label: "Video", color: "#82b1ff" },
};

function relativeDate(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ms).toLocaleDateString();
}

function prettySize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function VideoLibraryView({ onBack }: Props) {
  const [videos, setVideos] = useState<StudioVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVideos(await listStudioVideos());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(
    async (v: StudioVideo) => {
      if (!window.confirm(`Delete "${v.title}"? This can't be undone.`)) return;
      setDeleting(v.path);
      try {
        await deleteStudioVideo(v.path);
        setVideos((prev) => prev.filter((x) => x.path !== v.path));
      } finally {
        setDeleting(null);
      }
    },
    [],
  );

  return (
    <div className="pb-16">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
      >
        <ArrowLeft size={16} />
        Back to dashboard
      </motion.button>

      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black tracking-[0.05em] sm:text-5xl"
            style={{
              fontFamily: "var(--font-display)",
              backgroundImage: "linear-gradient(90deg, #f5c518, #ffd95c, #ffffff)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            MY VIDEOS
          </motion.h1>
          <p className="mt-1 text-sm text-wolf-muted">
            Every video you export lands here automatically. Replay, re-download, or delete.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-wolf-muted transition-colors hover:text-white disabled:opacity-50"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-wolf-muted">
          <Loader2 size={26} className="animate-spin" />
          <p className="text-sm">Loading your videos…</p>
        </div>
      ) : videos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-24 text-center"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
        >
          <Clapperboard size={34} className="text-wolf-muted" />
          <p className="text-base font-semibold text-white">No videos yet</p>
          <p className="max-w-sm text-sm text-wolf-muted">
            Finish a render in Remix, Scenes, or Performance and it'll show up here
            automatically. (You need to be signed in for videos to save.)
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v, i) => {
            const meta = MODE_META[v.mode] || MODE_META.video;
            return (
              <motion.div
                key={v.path}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="group overflow-hidden rounded-2xl border bg-black/30"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}
              >
                <div className="relative bg-black">
                  <video
                    src={v.url}
                    controls
                    preload="metadata"
                    playsInline
                    className="aspect-video w-full bg-black object-contain"
                  />
                  <span
                    className="pointer-events-none absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white" title={v.title}>
                      {v.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-wolf-muted">
                      {relativeDate(v.createdAt)}
                      {v.size ? ` · ${prettySize(v.size)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={v.url}
                      download={`${v.title || "video"}.mp4`}
                      className="rounded-lg border p-2 text-wolf-muted transition-colors hover:text-white"
                      style={{ borderColor: "rgba(255,255,255,0.1)" }}
                      title="Download"
                    >
                      <Download size={14} />
                    </a>
                    <button
                      onClick={() => handleDelete(v)}
                      disabled={deleting === v.path}
                      className="rounded-lg border p-2 text-wolf-muted transition-colors hover:text-red-400 disabled:opacity-50"
                      style={{ borderColor: "rgba(255,255,255,0.1)" }}
                      title="Delete"
                    >
                      {deleting === v.path ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && videos.length > 0 && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-wolf-muted">
          <Film size={12} /> {videos.length} video{videos.length === 1 ? "" : "s"} saved
        </p>
      )}
    </div>
  );
}
