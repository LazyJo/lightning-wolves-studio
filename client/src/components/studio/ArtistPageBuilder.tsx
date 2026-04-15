import { useState, useRef } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft, Plus, X, Globe, Music, Video, Instagram, Youtube,
  ExternalLink, Save, Smartphone, CheckCircle, Camera,
} from "lucide-react";
import { useArtistPage } from "../../lib/useArtistPage";

const WOLF_COLORS = [
  { id: "gold", color: "#f5c518", label: "Gold" },
  { id: "purple", color: "#9b6dff", label: "Purple" },
  { id: "orange", color: "#ff9500", label: "Orange" },
  { id: "green", color: "#69f0ae", label: "Green" },
  { id: "pink", color: "#E040FB", label: "Pink" },
  { id: "blue", color: "#82b1ff", label: "Blue" },
  { id: "red", color: "#E53935", label: "Red" },
];

const SOCIAL_PLATFORMS = ["Spotify", "Instagram", "YouTube", "TikTok", "SoundCloud", "Apple Music", "Twitter"];

interface Props {
  onBack: () => void;
  wolf?: { artist: string; color: string; image?: string } | null;
}

export default function ArtistPageBuilder({ onBack, wolf }: Props) {
  const { data, update, addSocialLink, removeSocialLink, addTrack, removeTrack, addVideo, removeVideo } = useArtistPage();
  const [newSocialPlatform, setNewSocialPlatform] = useState("Spotify");
  const [newSocialUrl, setNewSocialUrl] = useState("");
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newTrackUrl, setNewTrackUrl] = useState("");
  const [newVideoTitle, setNewVideoTitle] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        update({ photoUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const themeColor = data.themeColor || wolf?.color || "#f5c518";
  const displayName = data.displayName || wolf?.artist || "Your Name";

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm text-wolf-muted hover:text-wolf-gold">
        <ArrowLeft size={16} /> Back to Dashboard
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl" style={{ color: themeColor, fontFamily: "var(--font-display)" }}>Artist Page</h2>
          <span className="rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black" style={{ backgroundColor: themeColor }}>
            NEW
          </span>
        </div>
        <p className="text-xs text-wolf-muted">Build your link-in-bio page. Share one link for everything.</p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* LEFT: Editor Form */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">

          {/* Display Name + Bio */}
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Display Name</label>
            <input value={data.displayName} onChange={(e) => update({ displayName: e.target.value })}
              placeholder={wolf?.artist || "Your artist name"}
              className="mb-4 w-full rounded-lg border border-wolf-border/20 bg-wolf-surface px-4 py-3 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none"
              style={{ borderColor: `${themeColor}30` }} />

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Bio</label>
            <textarea value={data.bio} onChange={(e) => update({ bio: e.target.value })}
              placeholder="Tell the world who you are..." rows={3}
              className="w-full resize-none rounded-lg border border-wolf-border/20 bg-wolf-surface p-3 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none" />
          </div>

          {/* Profile Photo */}
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Profile Photo</label>
            <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            <div className="flex items-center gap-4">
              <div
                onClick={() => photoRef.current?.click()}
                className="group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 transition-all hover:opacity-80"
                style={{ borderColor: `${themeColor}50` }}
              >
                {data.photoUrl ? (
                  <img src={data.photoUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : wolf?.image ? (
                  <img src={wolf.image} alt="" className="h-full w-full p-2" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-wolf-surface">
                    <span className="text-2xl">🐺</span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera size={18} className="text-white" />
                </div>
              </div>
              <div className="flex-1">
                <button onClick={() => photoRef.current?.click()}
                  className="rounded-lg border border-wolf-border/30 px-4 py-2 text-xs font-medium text-white transition-all hover:border-wolf-gold/30">
                  Upload Photo
                </button>
                {data.photoUrl && (
                  <button onClick={() => update({ photoUrl: "" })}
                    className="ml-2 text-xs text-wolf-muted hover:text-red-400">
                    Remove
                  </button>
                )}
                <p className="mt-1 text-[10px] text-wolf-muted">JPG, PNG or GIF. Recommended 400x400px.</p>
              </div>
            </div>
          </div>

          {/* Wolf Color Theme */}
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">Wolf Color</label>
            <div className="flex gap-2">
              {WOLF_COLORS.map((c) => (
                <button key={c.id} onClick={() => update({ themeColor: c.color })}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${data.themeColor === c.color ? "scale-110 border-white" : "border-transparent hover:scale-105"}`}
                  style={{ backgroundColor: c.color }}
                  title={c.label} />
              ))}
            </div>
          </div>

          {/* Social Links */}
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Social Links <span className="text-wolf-muted/40">({data.socialLinks.length})</span>
            </label>
            {data.socialLinks.length > 0 && (
              <div className="mb-3 space-y-2">
                {data.socialLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-wolf-surface/50 px-3 py-2">
                    <span className="text-xs font-semibold" style={{ color: themeColor }}>{link.platform}</span>
                    <span className="flex-1 truncate text-xs text-wolf-muted">{link.url}</span>
                    <button onClick={() => removeSocialLink(i)} className="text-wolf-muted hover:text-red-400"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <select value={newSocialPlatform} onChange={(e) => setNewSocialPlatform(e.target.value)}
                className="rounded-lg border border-wolf-border/20 bg-wolf-surface px-2 py-2 text-xs text-white focus:outline-none">
                {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
              <input value={newSocialUrl} onChange={(e) => setNewSocialUrl(e.target.value)}
                placeholder="https://..." className="flex-1 rounded-lg border border-wolf-border/20 bg-wolf-surface px-3 py-2 text-xs text-white placeholder:text-wolf-muted/40 focus:outline-none" />
              <button onClick={() => {
                if (newSocialUrl) { addSocialLink(newSocialPlatform, newSocialUrl); setNewSocialUrl(""); }
              }} className="rounded-lg px-2 py-2 transition-all hover:bg-wolf-surface" style={{ color: themeColor }}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Featured Tracks */}
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Featured Tracks <span className="text-wolf-muted/40">({data.featuredTracks.length}/5)</span>
            </label>
            {data.featuredTracks.length > 0 && (
              <div className="mb-3 space-y-2">
                {data.featuredTracks.map((track, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-wolf-surface/50 px-3 py-2">
                    <Music size={12} style={{ color: themeColor }} />
                    <span className="flex-1 truncate text-xs text-white">{track.title}</span>
                    <button onClick={() => removeTrack(i)} className="text-wolf-muted hover:text-red-400"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            {data.featuredTracks.length < 5 && (
              <div className="space-y-2">
                <input value={newTrackTitle} onChange={(e) => setNewTrackTitle(e.target.value)}
                  placeholder="Track name" className="w-full rounded-lg border border-wolf-border/20 bg-wolf-surface px-3 py-2 text-xs text-white placeholder:text-wolf-muted/40 focus:outline-none" />
                <div className="flex gap-2">
                  <input value={newTrackUrl} onChange={(e) => setNewTrackUrl(e.target.value)}
                    placeholder="Spotify or YouTube URL" className="flex-1 rounded-lg border border-wolf-border/20 bg-wolf-surface px-3 py-2 text-xs text-white placeholder:text-wolf-muted/40 focus:outline-none" />
                  <button onClick={() => {
                    if (newTrackTitle && newTrackUrl) { addTrack(newTrackTitle, newTrackUrl); setNewTrackTitle(""); setNewTrackUrl(""); }
                  }} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Featured Videos */}
          <div className="rounded-xl border border-wolf-border/20 bg-wolf-card p-5">
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-wolf-muted">
              Featured Videos <span className="text-wolf-muted/40">({data.featuredVideos.length}/3)</span>
            </label>
            {data.featuredVideos.length > 0 && (
              <div className="mb-3 space-y-2">
                {data.featuredVideos.map((vid, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-wolf-surface/50 px-3 py-2">
                    <Video size={12} style={{ color: themeColor }} />
                    <span className="flex-1 truncate text-xs text-white">{vid.title}</span>
                    <button onClick={() => removeVideo(i)} className="text-wolf-muted hover:text-red-400"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            {data.featuredVideos.length < 3 && (
              <div className="space-y-2">
                <input value={newVideoTitle} onChange={(e) => setNewVideoTitle(e.target.value)}
                  placeholder="Video title" className="w-full rounded-lg border border-wolf-border/20 bg-wolf-surface px-3 py-2 text-xs text-white placeholder:text-wolf-muted/40 focus:outline-none" />
                <div className="flex gap-2">
                  <input value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)}
                    placeholder="YouTube URL" className="flex-1 rounded-lg border border-wolf-border/20 bg-wolf-surface px-3 py-2 text-xs text-white placeholder:text-wolf-muted/40 focus:outline-none" />
                  <button onClick={() => {
                    if (newVideoTitle && newVideoUrl) { addVideo(newVideoTitle, newVideoUrl); setNewVideoTitle(""); setNewVideoUrl(""); }
                  }} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          <button onClick={handleSave}
            className="w-full rounded-xl py-3.5 font-bold text-black transition-all hover:opacity-90"
            style={{ backgroundColor: themeColor }}>
            {saved ? (
              <span className="inline-flex items-center gap-2"><CheckCircle size={16} /> Saved!</span>
            ) : (
              <span className="inline-flex items-center gap-2"><Save size={16} /> Save Artist Page</span>
            )}
          </button>
        </motion.div>

        {/* RIGHT: Live Phone Preview */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:sticky lg:top-24">
          <div className="mb-3 flex items-center gap-2">
            <Smartphone size={14} className="text-wolf-muted" />
            <span className="text-xs font-semibold uppercase tracking-wider text-wolf-muted">Live Preview</span>
          </div>

          {/* Phone frame */}
          <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[2rem] border-2 border-wolf-border/30 bg-black shadow-2xl">
            {/* Status bar */}
            <div className="flex items-center justify-between px-6 py-2 text-[9px] text-white/60">
              <span>9:41</span>
              <div className="flex gap-1">
                <span>●●●●</span>
                <span>WiFi</span>
                <span>100%</span>
              </div>
            </div>

            {/* Page content */}
            <div className="px-5 pb-8">
              {/* Header with gradient */}
              <div className="mb-5 rounded-2xl p-5 text-center" style={{ background: `linear-gradient(135deg, ${themeColor}20, ${themeColor}05)` }}>
                {/* Avatar */}
                <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2"
                  style={{ borderColor: themeColor }}>
                  {data.photoUrl ? (
                    <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : wolf?.image ? (
                    <img src={wolf.image} alt="" className="h-full w-full p-1" />
                  ) : (
                    <span className="text-3xl">🐺</span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                  {displayName.toUpperCase()}
                </h3>
                {data.bio && <p className="mt-1 text-[10px] leading-relaxed text-wolf-muted">{data.bio}</p>}

                {/* Wolf badge */}
                <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold"
                  style={{ backgroundColor: `${themeColor}20`, color: themeColor }}>
                  ⚡ Lightning Wolf
                </div>
              </div>

              {/* Social links */}
              {data.socialLinks.length > 0 && (
                <div className="mb-4 flex flex-wrap justify-center gap-2">
                  {data.socialLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: `${themeColor}15`, border: `1px solid ${themeColor}30` }}>
                      {link.platform === "Instagram" && <Instagram size={10} />}
                      {link.platform === "YouTube" && <Youtube size={10} />}
                      {link.platform === "Spotify" && <Music size={10} />}
                      {!["Instagram", "YouTube", "Spotify"].includes(link.platform) && <Globe size={10} />}
                      {link.platform}
                    </div>
                  ))}
                </div>
              )}

              {/* Featured tracks */}
              {data.featuredTracks.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-wolf-muted">Featured Tracks</p>
                  <div className="space-y-1.5">
                    {data.featuredTracks.map((track, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg p-2"
                        style={{ backgroundColor: `${themeColor}08`, border: `1px solid ${themeColor}15` }}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ backgroundColor: `${themeColor}20` }}>
                          <Music size={12} style={{ color: themeColor }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-medium text-white">{track.title}</p>
                          <p className="text-[8px] text-wolf-muted">Play on Spotify</p>
                        </div>
                        <ExternalLink size={10} className="text-wolf-muted" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Featured videos */}
              {data.featuredVideos.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-wolf-muted">Videos</p>
                  <div className="space-y-1.5">
                    {data.featuredVideos.map((vid, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg p-2"
                        style={{ backgroundColor: `${themeColor}08`, border: `1px solid ${themeColor}15` }}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500/20">
                          <Youtube size={12} className="text-red-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-medium text-white">{vid.title}</p>
                          <p className="text-[8px] text-wolf-muted">Watch on YouTube</p>
                        </div>
                        <ExternalLink size={10} className="text-wolf-muted" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {data.socialLinks.length === 0 && data.featuredTracks.length === 0 && data.featuredVideos.length === 0 && (
                <div className="rounded-xl border border-dashed border-wolf-border/20 p-6 text-center">
                  <Globe size={20} className="mx-auto mb-2 text-wolf-muted/30" />
                  <p className="text-[10px] text-wolf-muted">Add social links, tracks, and videos to see them here</p>
                </div>
              )}

              {/* Footer */}
              <div className="mt-6 text-center">
                <div className="flex items-center justify-center gap-1 text-[8px] text-wolf-muted/40">
                  <span>⚡</span>
                  <span>Powered by Lightning Wolves</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
