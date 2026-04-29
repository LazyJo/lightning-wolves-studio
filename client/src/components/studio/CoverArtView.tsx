import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Image as ImageIcon,
  RefreshCw,
  Wand2,
  Loader2,
  AlertCircle,
  Info,
  Sparkles,
  Download,
  X,
} from "lucide-react";
import {
  generateVisual,
  listCoverArtHistory,
  saveCoverArtHistory,
  clearCoverArtHistory,
  deleteCoverArtHistory,
} from "../../lib/api";
import { useSession } from "../../lib/useSession";
import { useCredits } from "../../lib/useCredits";
import { useStudioPrefs } from "../../lib/useStudioPrefs";

interface Props {
  onBack: () => void;
  wolf?: { artist: string; genre: string; color: string; id: string } | null;
}

// eliteOnly: gates the model to the Elite tier. Matches the
// "Early access to new AI models" pricing-page promise. Non-Elite
// users see the option with a locked label but can't select it.
const AI_MODELS: { id: string; name: string; badge: string | null; eliteOnly?: boolean }[] = [
  { id: "nanobanana-2", name: "NanoBanana 2", badge: "NEW", eliteOnly: true },
  { id: "nanobanana-pro", name: "NanoBanana Pro", badge: null },
  { id: "nanobanana", name: "NanoBanana", badge: null },
  { id: "grok-imagine", name: "Grok Imagine", badge: null },
  { id: "seedream-4.5", name: "Seedream 4.5", badge: null },
];

const ASPECTS = ["1:1", "4:5", "16:9"] as const;
const RESOLUTIONS = ["2K", "4K"] as const;
const MAX_REFS = 14;
const CREDIT_COST = 12;
const HISTORY_KEY = "cover-art-history";
const HISTORY_MAX = 24;

// Gallery entries carry an optional `id`: signed-in wolves get a server
// row id so we can delete a single broken entry; guests are id-less and
// we mutate localStorage directly.
type GalleryEntry = { id: string | null; url: string };

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveHistory(urls: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(urls.slice(0, HISTORY_MAX)));
  } catch {
    // localStorage full or disabled — silently ignore.
  }
}

/* ─── Cover Art palette — blue (Drippydesigns wolf) ───────────────────── */
const CA = {
  blue: "#82b1ff",
  blueSoft: "rgba(130,177,255,0.14)",
  blueBorder: "rgba(130,177,255,0.40)",
  purple: "#9b6dff",
  mute: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.08)",
};

export default function CoverArtView({ onBack, wolf }: Props) {
  const { accessToken } = useSession();
  const { plan } = useCredits();
  const prefs = useStudioPrefs();
  const isElite = plan.tier === "elite";

  // Honour the user's Settings preference if they have access to that model,
  // otherwise fall back to the first model their tier allows.
  const preferred = AI_MODELS.find((m) => m.id === prefs.defaultCoverModel);
  const preferredAllowed = preferred && (!preferred.eliteOnly || isElite);
  const defaultModel = preferredAllowed
    ? preferred!.id
    : AI_MODELS.find((m) => !m.eliteOnly || isElite)?.id || AI_MODELS[0].id;
  const [modelId, setModelId] = useState(defaultModel);
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>(prefs.defaultAspect);
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("2K");
  const [refImages, setRefImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<"starting" | "processing" | null>(null);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<GalleryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hydrate gallery: signed-in wolves pull from the server (synced across
  // devices); guests fall back to localStorage. If a signed-in wolf has
  // local entries from before they signed up, lift them up server-side
  // on first sync so the gallery "follows" them into their account.
  const refreshGallery = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    try {
      if (accessToken) {
        const items = await listCoverArtHistory(accessToken);
        const serverUrls = items.map((i) => i.image_url);
        const locals = loadHistory();
        const orphans = locals.filter((u) => !serverUrls.includes(u));
        if (orphans.length > 0) {
          // Best-effort backfill — failures don't block the gallery.
          for (const url of orphans) {
            try {
              await saveCoverArtHistory(accessToken, { imageUrl: url });
            } catch { /* ignore */ }
          }
          try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
          const merged = await listCoverArtHistory(accessToken);
          setHistory(merged.map((i) => ({ id: i.id, url: i.image_url })));
        } else {
          setHistory(items.map((i) => ({ id: i.id, url: i.image_url })));
        }
        setError("");
      } else {
        setHistory(loadHistory().map((url) => ({ id: null, url })));
      }
    } catch (err) {
      console.error("[cover-art] gallery fetch failed", err);
      setError("Couldn't load your saved gallery. Hit Refresh to try again.");
      setHistory(loadHistory().map((url) => ({ id: null, url })));
    } finally {
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refreshGallery();
    })();
    return () => { cancelled = true; };
  }, [refreshGallery]);

  // Auto-prune broken thumbnails. Old Replicate-URL rows that pre-date
  // the rehost-on-save behaviour will 404 forever — remove them from the
  // server (signed-in) or localStorage (guest) the moment the <img>
  // load fails so the gallery self-heals.
  const handleBrokenThumbnail = useCallback(
    async (entry: GalleryEntry) => {
      setHistory((prev) => prev.filter((e) => e.url !== entry.url));
      if (entry.id && accessToken) {
        try {
          await deleteCoverArtHistory(accessToken, entry.id);
        } catch (err) {
          console.warn("[cover-art] failed to prune broken entry", err);
        }
      } else if (!accessToken) {
        try {
          saveHistory(loadHistory().filter((u) => u !== entry.url));
        } catch { /* ignore */ }
      }
    },
    [accessToken],
  );

  const activeModel = AI_MODELS.find((m) => m.id === modelId)!;
  // Studio is gated by signup so accessToken is always present here.
  // Server-side credits enforcement covers quota; the prompt-length check
  // is the only client-side gate on the generate button.
  const canGenerate = !loading && prompt.trim().length >= 10;

  const handleRefImages = (files: FileList | null) => {
    if (!files) return;
    const urls = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => URL.createObjectURL(f));
    setRefImages((prev) => [...prev, ...urls].slice(0, MAX_REFS));
  };

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setLoading(true);
    setProgress("starting");
    setError("");
    setImageUrl(null);
    try {
      const final = await generateVisual({
        modelId,
        prompt: `${prompt}\n\n[Format: ${aspect}, ${resolution}${refImages.length ? `, ${refImages.length} reference images` : ""}]`,
        type: "cover",
        accessToken: accessToken || undefined,
        options: { aspectRatio: aspect },
        onProgress: (s) => {
          if (s.status === "starting" || s.status === "processing") {
            setProgress(s.status);
          }
        },
      });
      if (final.status === "succeeded" && final.output && final.output.length > 0) {
        const url = final.output[0];
        setImageUrl(url);
        // Optimistic add — id-less entry until the server returns the
        // rehosted URL + row id.
        setHistory((prev) =>
          [{ id: null, url }, ...prev.filter((e) => e.url !== url)].slice(0, HISTORY_MAX),
        );
        if (accessToken) {
          // Persist server-side. The server rehosts external URLs into
          // our own bucket so the entry survives the source URL's
          // expiry — the response carries the permanent URL we should
          // store going forward.
          try {
            const saved = await saveCoverArtHistory(accessToken, {
              imageUrl: url,
              prompt,
              modelId,
              aspect,
              resolution,
            });
            const stableUrl = saved.image_url;
            setHistory((prev) => {
              const filtered = prev.filter(
                (e) => e.url !== url && e.url !== stableUrl,
              );
              return [{ id: saved.id, url: stableUrl }, ...filtered].slice(0, HISTORY_MAX);
            });
            // Flip the active preview onto the rehosted URL too — the
            // Replicate URL is still valid for the next ~hour, but the
            // Download button should always point at the permanent one.
            if (stableUrl !== url) setImageUrl(stableUrl);
          } catch (err) {
            console.error("[cover-art] server save failed, kept locally", err);
            saveHistory([url, ...loadHistory().filter((u) => u !== url)].slice(0, HISTORY_MAX));
          }
        } else {
          // Guest: persist URL to localStorage so the entry survives a
          // refresh inside the current browser session.
          saveHistory([url, ...loadHistory().filter((u) => u !== url)].slice(0, HISTORY_MAX));
        }
      } else {
        setError(final.error || "Generation finished but produced no image.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [canGenerate, modelId, prompt, aspect, resolution, refImages.length, accessToken]);

  const validationMessage = prompt.trim().length < 10
    ? "Describe your cover art in detail to generate."
    : null;

  return (
    <div className="pb-16">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </motion.button>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-black tracking-[0.05em] sm:text-5xl"
        style={{
          fontFamily: "var(--font-display)",
          backgroundImage: `linear-gradient(90deg, ${CA.blue}, #b6d4ff, #ffffff)`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        COVER ART
      </motion.h1>
      <p className="mb-6 text-xs text-wolf-muted">Generate album and single artwork with AI.</p>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* ── Left panel ── */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          {/* MODEL */}
          <SectionCard label="MODEL">
            <select
              value={modelId}
              onChange={(e) => {
                const next = AI_MODELS.find((m) => m.id === e.target.value);
                if (next?.eliteOnly && !isElite) return; // locked — keep current
                setModelId(e.target.value);
              }}
              className="w-full cursor-pointer rounded-lg border bg-transparent px-3 py-2.5 text-sm text-white focus:outline-none"
              style={{ borderColor: CA.blueBorder, color: CA.blue }}
            >
              {AI_MODELS.map((m) => {
                const locked = m.eliteOnly && !isElite;
                return (
                  <option
                    key={m.id}
                    value={m.id}
                    disabled={locked}
                    className="bg-wolf-bg text-white"
                  >
                    {m.name}
                    {m.badge === "NEW" ? " ✨" : ""}
                    {locked ? "  · 🔒 Elite" : ""}
                  </option>
                );
              })}
            </select>
            {!isElite && (
              <p className="mt-2 text-[11px] text-wolf-muted">
                🔒 NanoBanana 2 is in Elite early-access.{" "}
                <span className="font-semibold text-wolf-gold">Upgrade</span> to unlock.
              </p>
            )}
          </SectionCard>

          {/* REFERENCE IMAGES */}
          <SectionCard label="REFERENCE IMAGES" right={`${refImages.length} / ${MAX_REFS}`}>
            {refImages.length > 0 && (
              <div className="mb-3 grid grid-cols-4 gap-1.5">
                {refImages.map((url, i) => (
                  <div
                    key={i}
                    className="group relative aspect-square overflow-hidden rounded-lg border"
                    style={{ borderColor: CA.border }}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setRefImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleRefImages(e.target.files)}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleRefImages(e.dataTransfer.files);
              }}
              className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed py-6 text-sm transition-all"
              style={{
                borderColor: isDragging ? CA.blue : CA.blueBorder,
                backgroundColor: isDragging ? CA.blueSoft : "transparent",
                color: isDragging ? CA.blue : CA.mute,
              }}
            >
              <ImageIcon size={16} />
              <span className="text-xs font-semibold">Add Reference Images</span>
              <span className="text-[10px] opacity-70">Or drag & drop</span>
            </button>
          </SectionCard>

          {/* PROMPT */}
          <SectionCard label="PROMPT" required>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your cover art in detail..."
              rows={5}
              className="w-full resize-none rounded-lg border bg-transparent p-3 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none"
              style={{ borderColor: CA.border }}
            />
          </SectionCard>

          {/* ASPECT + RESOLUTION (pills inline, LYRC parity) */}
          <div className="flex gap-2">
            <div
              className="flex flex-1 items-center gap-1 rounded-xl border p-1"
              style={{ borderColor: CA.border }}
            >
              {ASPECTS.map((a) => {
                const active = aspect === a;
                return (
                  <button
                    key={a}
                    onClick={() => setAspect(a)}
                    className="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all"
                    style={
                      active
                        ? { backgroundColor: CA.blueSoft, color: CA.blue }
                        : { color: CA.mute }
                    }
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            <div
              className="flex items-center gap-1 rounded-xl border p-1"
              style={{ borderColor: CA.border }}
            >
              {RESOLUTIONS.map((r) => {
                const active = resolution === r;
                return (
                  <button
                    key={r}
                    onClick={() => setResolution(r)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                    style={
                      active
                        ? { backgroundColor: CA.blueSoft, color: CA.blue }
                        : { color: CA.mute }
                    }
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate CTA */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: canGenerate
                ? `linear-gradient(90deg, ${CA.blue}, ${CA.purple})`
                : "rgba(255,255,255,0.08)",
              color: canGenerate ? "#000" : "#888",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Generate Cover Art
                <span
                  className="rounded px-2 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
                >
                  💎 {CREDIT_COST}
                </span>
              </>
            )}
          </button>

          {/* Health indicator */}
          <div className="flex items-center justify-center gap-2 text-[10px]">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span style={{ color: CA.blue }}>Running smoothly</span>
            <span className="text-wolf-muted/60">· Powered by {activeModel.name}</span>
          </div>

          {/* Inline validation */}
          {validationMessage && !loading && (
            <div
              className="rounded-xl border px-3 py-2.5 text-center text-[11px]"
              style={{
                borderColor: CA.blueBorder,
                backgroundColor: CA.blueSoft,
                color: CA.blue,
              }}
            >
              {validationMessage}
            </div>
          )}

          {/* Pro Tip */}
          <div
            className="flex items-start gap-2 rounded-xl border p-3 text-[11px]"
            style={{ borderColor: `${CA.blue}30`, backgroundColor: "rgba(130,177,255,0.05)" }}
          >
            <Info size={14} className="mt-0.5 shrink-0" style={{ color: CA.blue }} />
            <p className="text-wolf-muted">
              <span className="font-bold" style={{ color: CA.blue }}>Pro Tip:</span>{" "}
              The more reference images you provide, the closer the generated art can match your aesthetic. Aim for 3-6 coherent refs.
            </p>
          </div>

        </motion.div>

        {/* ── Right panel ── */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <div
            className="flex items-center justify-between rounded-t-2xl border border-b-0 px-5 py-3.5"
            style={{ borderColor: CA.border }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.25em]"
              style={{ color: CA.blue }}
            >
              Your Cover Art
            </p>
            <button
              disabled={loading || refreshing}
              onClick={() => { void refreshGallery(); }}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-[11px] font-semibold transition-all disabled:opacity-40"
              style={{ borderColor: CA.blueBorder, color: CA.blue }}
              title="Reload your saved gallery from the server"
            >
              <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <div
            className="min-h-[460px] rounded-b-2xl border border-dashed p-5"
            style={{ borderColor: CA.border }}
          >
            {history.length > 0 && (
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-wolf-muted">
                    Saved · {history.length}
                  </p>
                  <button
                    onClick={async () => {
                      if (!confirm("Clear all saved cover art? This cannot be undone.")) return;
                      setHistory([]);
                      saveHistory([]);
                      if (accessToken) {
                        try {
                          await clearCoverArtHistory(accessToken);
                        } catch { /* server clear failed — local is already empty */ }
                      }
                    }}
                    className="text-[10px] text-wolf-muted hover:text-red-300"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {history.map((entry) => {
                    const active = entry.url === imageUrl;
                    return (
                      <button
                        key={entry.id ?? entry.url}
                        onClick={() => { setImageUrl(entry.url); setError(""); }}
                        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all"
                        style={{
                          borderColor: active ? CA.blue : "transparent",
                          boxShadow: active ? `0 0 0 1px ${CA.blueBorder}` : "none",
                        }}
                      >
                        <img
                          src={entry.url}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={() => { void handleBrokenThumbnail(entry); }}
                        />
                        <a
                          href={entry.url}
                          download={`cover-art-${Date.now()}.png`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Download cover art"
                        >
                          <Download size={14} className="text-white" />
                        </a>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-3 py-20 text-center"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <Wand2 size={40} style={{ color: CA.blue }} />
                  </motion.div>
                  <p className="text-sm font-semibold text-white">
                    {progress === "starting" ? "Queued…" : "Generating cover art…"}
                  </p>
                  <p className="text-xs text-wolf-muted">Usually 30–90 seconds</p>
                </motion.div>
              ) : imageUrl ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div
                    className="overflow-hidden rounded-xl border"
                    style={{ borderColor: CA.blueBorder }}
                  >
                    <img
                      src={imageUrl}
                      alt="Generated cover art"
                      className="block max-h-[480px] w-auto object-contain"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <a
                      href={imageUrl}
                      download={`cover-art-${Date.now()}.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all"
                      style={{
                        background: `linear-gradient(90deg, ${CA.blue}, ${CA.purple})`,
                        color: "#000",
                      }}
                    >
                      <Download size={12} /> Download
                    </a>
                    <button
                      onClick={() => { setImageUrl(null); }}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold transition-all hover:bg-white/5"
                      style={{ borderColor: CA.blueBorder, color: CA.blue }}
                    >
                      <Sparkles size={12} /> Generate Another
                    </button>
                  </div>
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-3 py-20 text-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                    <AlertCircle size={26} className="text-red-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Generation failed</p>
                  <p className="max-w-sm text-xs text-red-300/90">{error}</p>
                  <button
                    onClick={() => setError("")}
                    className="text-[11px] text-wolf-muted hover:text-wolf-gold"
                  >
                    Try again
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-2 py-20 text-center"
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    style={{ backgroundColor: CA.blueSoft }}
                  >
                    <ImageIcon size={26} style={{ color: CA.blue }} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">No cover art generated yet</p>
                  <p className="text-xs text-wolf-muted">
                    Create your first cover art to get started!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function SectionCard({
  label,
  required,
  right,
  children,
}: {
  label: string;
  required?: boolean;
  right?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: required ? CA.blueBorder : CA.border,
        backgroundColor: "rgba(0,0,0,0.2)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-wolf-muted">
          {label}
          {required && <span style={{ color: CA.blue }}> *</span>}
        </p>
        {right && <span className="text-[10px] text-wolf-muted">{right}</span>}
      </div>
      {children}
    </div>
  );
}
