import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  X,
  Globe,
  Music,
  Instagram,
  Youtube,
  Lock,
  CheckCircle,
  Camera,
  Link2,
  Palette,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Eye,
  ExternalLink,
  Music2,
  MapPin,
  Smartphone,
  Monitor,
} from "lucide-react";
import { useArtistPage, type ArtistPageData, type LayoutStyle, type LinkStyle, type ColorMode, type CardShape, type IconShape, type ReleaseStyle } from "../../lib/useArtistPage";

/* ─── Artist Page palette — gold (Lightning Wolves brand primary) ────── */
// Artist Page IS the artist's home — it should feel like the Lightning
// Wolves brand itself, not a tool-specific color. Gold matches the logo,
// the navbar, and the default theme color chosen for new pages.
const A = {
  blue: "#f5c518",
  blueSoft: "rgba(245,197,24,0.14)",
  blueBorder: "rgba(245,197,24,0.40)",
  green: "#69f0ae",
  amber: "#f5b14a",
  amberSoft: "rgba(245,177,74,0.10)",
  purple: "#b794f6",
  red: "#ef4444",
  mute: "rgba(255,255,255,0.55)",
  border: "rgba(255,255,255,0.08)",
};

const SOCIAL_PLATFORMS = [
  { id: "Spotify", icon: Music, color: "#1DB954" },
  { id: "Apple Music", icon: Music2, color: "#FA233B" },
  { id: "YouTube", icon: Youtube, color: "#FF0000" },
  { id: "Instagram", icon: Instagram, color: "#E4405F" },
  { id: "TikTok", icon: Music, color: "#ffffff" },
  { id: "SoundCloud", icon: Music, color: "#FF5500" },
  { id: "Twitter", icon: Globe, color: "#1DA1F2" },
] as const;

const HEADING_FONTS = ["Bebas Neue", "Space Grotesk", "Syncopate", "Inter"];
const BODY_FONTS = ["Inter", "Space Grotesk", "Bebas Neue"];

const WHAT_YOU_DO = [
  "Artist", "Producer", "Engineer", "Songwriter", "DJ",
  "Singer", "Rapper", "Vocalist", "Beatmaker", "Band",
] as const;
const MAX_ROLES = 3;
const BIO_MAX = 150;

const THEME_COLORS = [
  { id: "gold", color: "#f5c518" },
  { id: "purple", color: "#9b6dff" },
  { id: "orange", color: "#ff9500" },
  { id: "green", color: "#69f0ae" },
  { id: "pink", color: "#E040FB" },
  { id: "blue", color: "#82b1ff" },
  { id: "red", color: "#E53935" },
  { id: "cyan", color: "#22d3ee" },
];

interface Props {
  onBack: () => void;
  wolf?: { artist: string; color: string; image?: string } | null;
}

export default function ArtistPageBuilder({ onBack, wolf }: Props) {
  const {
    data,
    update,
    claim,
    addSocialLink,
    removeSocialLink,
    moveSocialLink,
    addCustomLink,
    removeCustomLink,
  } = useArtistPage();

  // Pre-claim state → onboarding; post-claim → builder
  if (!data.claimed) {
    return (
      <ClaimView
        onBack={onBack}
        defaultName={wolf?.artist || data.displayName}
        onClaim={(handle, displayName) => claim(handle, displayName)}
      />
    );
  }

  return (
    <BuilderView
      onBack={onBack}
      data={data}
      wolf={wolf}
      update={update}
      addSocialLink={addSocialLink}
      removeSocialLink={removeSocialLink}
      moveSocialLink={moveSocialLink}
      addCustomLink={addCustomLink}
      removeCustomLink={removeCustomLink}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* ── Claim screen ───────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────── */

function ClaimView({
  onBack,
  defaultName,
  onClaim,
}: {
  onBack: () => void;
  defaultName: string;
  onClaim: (handle: string, name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [handle, setHandle] = useState("");

  // Auto-sanitize: lowercase, strip anything that isn't [a-z0-9-]
  const cleanHandle = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const sanitized = cleanHandle(handle);
  const isValid = sanitized.length >= 3 && sanitized.length <= 30;

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border p-7"
        style={{ borderColor: A.border, backgroundColor: "rgba(15,15,20,0.6)" }}
      >
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-xs text-wolf-muted hover:text-white"
        >
          <ArrowLeft size={13} /> Back
        </button>

        <div className="mb-4 flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: A.blueSoft }}
          >
            <Globe size={17} style={{ color: A.blue }} />
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: A.blue }}>
            Artist Page
          </span>
        </div>

        <h1
          className="mb-2 text-3xl font-black"
          style={{ fontFamily: "var(--font-display)" }}
        >
          CLAIM YOUR PAGE
        </h1>
        <p className="mb-6 text-xs text-wolf-muted">
          Choose your permanent URL. This is your artist home — pick a name you love.
        </p>

        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-wolf-muted">
          Artist name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your artist name"
          className="mb-4 w-full rounded-xl border bg-transparent px-4 py-3 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none"
          style={{ borderColor: A.border }}
        />

        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-wolf-muted">
          Your URL
        </label>
        <div
          className="mb-1 flex items-center rounded-xl border overflow-hidden"
          style={{ borderColor: isValid ? A.blueBorder : A.border }}
        >
          <span
            className="px-3 py-3 text-sm font-semibold"
            style={{ color: A.blue, backgroundColor: A.blueSoft }}
          >
            lightningwolves.studio/u/
          </span>
          <input
            value={handle}
            onChange={(e) => setHandle(cleanHandle(e.target.value))}
            placeholder="your-name"
            className="flex-1 bg-transparent px-3 py-3 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none"
          />
          {isValid && (
            <CheckCircle size={18} className="mr-3 shrink-0" style={{ color: A.green }} />
          )}
        </div>
        <p className="mb-3 text-[10px] text-wolf-muted">
          Lowercase letters, numbers, and hyphens. 3-30 characters.
        </p>
        {isValid && (
          <p className="mb-3 text-[11px]" style={{ color: A.green }}>
            ✓ lightningwolves.studio/u/{sanitized} is yours!
          </p>
        )}

        <div
          className="mb-5 flex items-start gap-2 rounded-xl border p-3 text-[11px]"
          style={{ borderColor: `${A.amber}40`, backgroundColor: A.amberSoft, color: A.amber }}
        >
          <Lock size={13} className="mt-0.5 shrink-0" />
          <p>
            Choose carefully — your URL is permanent. You&rsquo;ll get <b>one</b> chance to change it later.
          </p>
        </div>

        <button
          onClick={() => isValid && name.trim() && onClaim(sanitized, name.trim())}
          disabled={!isValid || !name.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: isValid && name.trim()
              ? `linear-gradient(90deg, ${A.blue}, #e8870a)`
              : "rgba(255,255,255,0.08)",
            color: isValid && name.trim() ? "#000" : "#888",
          }}
        >
          Claim Your Page <ArrowRight size={14} />
        </button>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* ── Builder view ───────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────── */

type Tab = "artist" | "links" | "design";

interface BuilderProps {
  onBack: () => void;
  data: ArtistPageData;
  wolf?: { artist: string; color: string; image?: string } | null;
  update: (partial: Partial<ArtistPageData>) => void;
  addSocialLink: (platform: string, url: string) => void;
  removeSocialLink: (index: number) => void;
  moveSocialLink: (from: number, to: number) => void;
  addCustomLink: (label: string, url: string) => void;
  removeCustomLink: (index: number) => void;
}

function BuilderView(props: BuilderProps) {
  const [tab, setTab] = useState<Tab>("artist");
  const [saved, setSaved] = useState(false);

  const handleGoLive = () => {
    props.update({ published: !props.data.published });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="pb-16">
      {/* Top bar */}
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
        style={{ borderColor: A.border, backgroundColor: "rgba(0,0,0,0.25)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={props.onBack}
            className="inline-flex items-center gap-1.5 text-xs text-wolf-muted hover:text-white"
          >
            <ArrowLeft size={13} /> Dashboard
          </button>
          <div className="h-4 w-px bg-white/10" />
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: A.blueSoft }}
          >
            <Globe size={14} style={{ color: A.blue }} />
          </div>
          <span className="text-sm font-bold text-white">Artist Page</span>
          <span className="hidden text-[11px] text-wolf-muted sm:inline">
            lightningwolves.studio/u/{props.data.handle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Publish status */}
          <span
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={
              props.data.published
                ? { borderColor: `${A.green}40`, backgroundColor: `${A.green}10`, color: A.green }
                : { borderColor: `${A.amber}40`, backgroundColor: A.amberSoft, color: A.amber }
            }
          >
            {props.data.published ? (
              <>
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> LIVE
              </>
            ) : (
              <>
                <Lock size={10} /> Not published
              </>
            )}
          </span>
          <button
            onClick={handleGoLive}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
            style={{
              background: props.data.published
                ? "rgba(255,255,255,0.08)"
                : `linear-gradient(90deg, ${A.blue}, #e8870a)`,
              color: props.data.published ? "#ddd" : "#000",
            }}
          >
            {saved ? <CheckCircle size={13} /> : <Globe size={13} />}
            {props.data.published ? "Unpublish" : "Go Live"}
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          {/* Tabs */}
          <div
            className="mb-3 flex gap-1 rounded-xl border p-1"
            style={{ borderColor: A.border, backgroundColor: "rgba(0,0,0,0.3)" }}
          >
            <TabButton active={tab === "artist"} onClick={() => setTab("artist")} icon={<Music size={13} />} label="Artist" />
            <TabButton active={tab === "links"} onClick={() => setTab("links")} icon={<Link2 size={13} />} label="Links" />
            <TabButton active={tab === "design"} onClick={() => setTab("design")} icon={<Palette size={13} />} label="Design" />
          </div>

          <AnimatePresence mode="wait">
            {tab === "artist" && <ArtistTab key="artist" data={props.data} update={props.update} />}
            {tab === "links" && (
              <LinksTab
                key="links"
                data={props.data}
                addSocialLink={props.addSocialLink}
                removeSocialLink={props.removeSocialLink}
                moveSocialLink={props.moveSocialLink}
                addCustomLink={props.addCustomLink}
                removeCustomLink={props.removeCustomLink}
              />
            )}
            {tab === "design" && <DesignTab key="design" data={props.data} update={props.update} />}
          </AnimatePresence>
        </motion.div>

        {/* Preview */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-start justify-center"
        >
          <PreviewPane data={props.data} />
        </motion.div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all"
      style={
        active
          ? { backgroundColor: A.blueSoft, color: A.blue }
          : { color: A.mute }
      }
    >
      {icon}
      {label}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* ── Artist tab ────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────── */

function ArtistTab({ data, update }: { data: ArtistPageData; update: (p: Partial<ArtistPageData>) => void }) {
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") update({ photoUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-3"
    >
      {/* Photo */}
      <SectionCard label="Photo" dotColor={A.blue}>
        <div className="flex items-center gap-3">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border"
            style={{ borderColor: A.blueBorder, backgroundColor: A.blueSoft }}
          >
            {data.photoUrl ? (
              <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera size={22} style={{ color: A.blue }} />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <button
              onClick={() => photoInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all"
              style={{ borderColor: A.blueBorder, color: A.blue, backgroundColor: A.blueSoft }}
            >
              <Camera size={11} /> {data.photoUrl ? "Replace" : "Upload"}
            </button>
            {data.photoUrl && (
              <button
                onClick={() => update({ photoUrl: "" })}
                className="text-[10px] text-wolf-muted hover:text-red-300"
              >
                Remove
              </button>
            )}
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </div>
        </div>
      </SectionCard>

      {/* Display name */}
      <SectionCard label="Artist name" dotColor={A.blue}>
        <input
          value={data.displayName}
          onChange={(e) => update({ displayName: e.target.value })}
          placeholder="Your artist name"
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none"
          style={{ borderColor: A.border }}
        />
      </SectionCard>

      {/* Bio with 150-char counter */}
      <SectionCard label="Bio" dotColor={A.blue}>
        <div className="relative">
          <textarea
            value={data.bio}
            onChange={(e) => update({ bio: e.target.value.slice(0, BIO_MAX) })}
            placeholder="A short bio for fans visiting your page"
            rows={3}
            className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none"
            style={{ borderColor: A.border }}
          />
          <span
            className="absolute bottom-1.5 right-2 text-[10px]"
            style={{ color: data.bio.length >= BIO_MAX ? A.amber : A.mute }}
          >
            {data.bio.length}/{BIO_MAX}
          </span>
        </div>
      </SectionCard>

      {/* Location */}
      <SectionCard label="Location" dotColor={A.blue}>
        <div
          className="flex items-center gap-2 rounded-lg border px-3"
          style={{ borderColor: A.border }}
        >
          <MapPin size={13} className="shrink-0" style={{ color: A.blue }} />
          <input
            value={data.location}
            onChange={(e) => update({ location: e.target.value })}
            placeholder="Atlanta, GA"
            className="flex-1 bg-transparent py-2 text-sm text-white placeholder:text-wolf-muted/40 focus:outline-none"
          />
        </div>
      </SectionCard>

      {/* What you do */}
      <SectionCard label="What you do" dotColor={A.purple} count={data.roles.length}>
        <div className="mb-1 text-right text-[10px] text-wolf-muted">
          {data.roles.length}/{MAX_ROLES} selected
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WHAT_YOU_DO.map((role) => {
            const active = data.roles.includes(role);
            const disabled = !active && data.roles.length >= MAX_ROLES;
            return (
              <button
                key={role}
                disabled={disabled}
                onClick={() => {
                  const next = active
                    ? data.roles.filter((r) => r !== role)
                    : [...data.roles, role];
                  update({ roles: next });
                }}
                className="rounded-full border px-3 py-1 text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-30"
                style={
                  active
                    ? { borderColor: A.blue, backgroundColor: A.blueSoft, color: A.blue }
                    : { borderColor: A.border, color: A.mute }
                }
              >
                {role}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Page URL display + change-remaining note */}
      <SectionCard label="Page URL" dotColor={A.amber}>
        <div
          className="mb-2 flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{ borderColor: A.border, backgroundColor: "rgba(0,0,0,0.3)" }}
        >
          <Globe size={12} style={{ color: A.blue }} />
          <span className="truncate text-xs text-wolf-muted">lightningwolves.studio/u/</span>
          <span className="flex-1 truncate text-xs font-bold text-white">{data.handle}</span>
          <button
            onClick={() => navigator.clipboard?.writeText(`https://lightningwolves.studio/u/${data.handle}`)}
            className="text-[10px] text-wolf-muted hover:text-white"
            title="Copy URL"
          >
            Copy
          </button>
        </div>
        <div
          className="flex items-center gap-1.5 text-[11px]"
          style={{ color: A.amber }}
        >
          <Lock size={11} />
          <span>1 change remaining — use wisely.</span>
        </div>
      </SectionCard>

      {/* Coming soon note about Spotify/Apple Music integration */}
      <div
        className="flex items-start gap-2 rounded-xl border p-3 text-[11px]"
        style={{ borderColor: `${A.blue}30`, backgroundColor: `${A.blue}05` }}
      >
        <Sparkles size={13} className="mt-0.5 shrink-0" style={{ color: A.blue }} />
        <p className="text-wolf-muted">
          <span className="font-bold" style={{ color: A.blue }}>Coming soon:</span>{" "}
          Auto-fill from Spotify / Apple Music. For now, enter your music links in the Links tab.
        </p>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* ── Links tab ─────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────── */

function LinksTab(props: {
  data: ArtistPageData;
  addSocialLink: (platform: string, url: string) => void;
  removeSocialLink: (i: number) => void;
  moveSocialLink: (from: number, to: number) => void;
  addCustomLink: (label: string, url: string) => void;
  removeCustomLink: (i: number) => void;
}) {
  const [newSocialPlatform, setNewSocialPlatform] = useState("Instagram");
  const [newSocialUrl, setNewSocialUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const handleAddSocial = () => {
    if (!newSocialUrl.trim()) return;
    props.addSocialLink(newSocialPlatform, newSocialUrl.trim());
    setNewSocialUrl("");
  };

  const handleAddLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
    props.addCustomLink(newLinkLabel.trim(), newLinkUrl.trim());
    setNewLinkLabel("");
    setNewLinkUrl("");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-3"
    >
      {/* Socials */}
      <SectionCard label="Socials" dotColor={A.purple} count={props.data.socialLinks.length}>
        {props.data.socialLinks.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {props.data.socialLinks.map((s, i) => {
              const platform = SOCIAL_PLATFORMS.find((p) => p.id === s.platform);
              const Icon = platform?.icon || Globe;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border p-2"
                  style={{ borderColor: A.border, backgroundColor: "rgba(0,0,0,0.3)" }}
                >
                  <div className="flex flex-col">
                    <button
                      disabled={i === 0}
                      onClick={() => props.moveSocialLink(i, i - 1)}
                      className="text-wolf-muted/40 hover:text-white disabled:opacity-20"
                      aria-label="Move up"
                    >
                      <ChevronUp size={11} />
                    </button>
                    <button
                      disabled={i === props.data.socialLinks.length - 1}
                      onClick={() => props.moveSocialLink(i, i + 1)}
                      className="text-wolf-muted/40 hover:text-white disabled:opacity-20"
                      aria-label="Move down"
                    >
                      <ChevronDown size={11} />
                    </button>
                  </div>
                  <Icon size={14} style={{ color: platform?.color || A.mute }} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-semibold text-white">{s.platform}</p>
                    <p className="truncate text-[10px] text-wolf-muted">{s.url}</p>
                  </div>
                  <button
                    onClick={() => props.removeSocialLink(i)}
                    className="rounded p-1 text-wolf-muted hover:text-red-300"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-1.5">
          <select
            value={newSocialPlatform}
            onChange={(e) => setNewSocialPlatform(e.target.value)}
            className="rounded-lg border bg-transparent px-2 py-2 text-xs text-white focus:outline-none"
            style={{ borderColor: A.border }}
          >
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p.id} value={p.id} className="bg-wolf-bg">
                {p.id}
              </option>
            ))}
          </select>
          <input
            value={newSocialUrl}
            onChange={(e) => setNewSocialUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddSocial()}
            placeholder="https://..."
            className="flex-1 rounded-lg border bg-transparent px-2 py-2 text-xs text-white placeholder:text-wolf-muted/40 focus:outline-none"
            style={{ borderColor: A.border }}
          />
          <button
            onClick={handleAddSocial}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-semibold"
            style={{ borderColor: A.blueBorder, color: A.blue }}
          >
            <Plus size={11} />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-wolf-muted">
          Social links show as compact icons on your page.
        </p>
      </SectionCard>

      {/* Music links */}
      <SectionCard label="Music" dotColor={A.green}>
        <div className="rounded-lg border border-dashed px-3 py-4 text-center text-[11px] text-wolf-muted"
          style={{ borderColor: A.border }}
        >
          Music links auto-populate from your Socials entries for Spotify / Apple Music / SoundCloud.
        </div>
      </SectionCard>

      {/* Custom links */}
      <SectionCard label="Links" dotColor={A.amber} count={props.data.customLinks.length}>
        {props.data.customLinks.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {props.data.customLinks.map((l, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border p-2"
                style={{ borderColor: A.border, backgroundColor: "rgba(0,0,0,0.3)" }}
              >
                <Link2 size={12} style={{ color: A.amber }} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-semibold text-white">{l.label}</p>
                  <p className="truncate text-[10px] text-wolf-muted">{l.url}</p>
                </div>
                <button
                  onClick={() => props.removeCustomLink(i)}
                  className="rounded p-1 text-wolf-muted hover:text-red-300"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-1.5">
          <input
            value={newLinkLabel}
            onChange={(e) => setNewLinkLabel(e.target.value)}
            placeholder="Label"
            className="w-full rounded-lg border bg-transparent px-2 py-2 text-xs text-white placeholder:text-wolf-muted/40 focus:outline-none"
            style={{ borderColor: A.border }}
          />
          <div className="flex gap-1.5">
            <input
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
              placeholder="https://..."
              className="flex-1 rounded-lg border bg-transparent px-2 py-2 text-xs text-white placeholder:text-wolf-muted/40 focus:outline-none"
              style={{ borderColor: A.border }}
            />
            <button
              onClick={handleAddLink}
              disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all disabled:opacity-40"
              style={{ borderColor: A.blueBorder, color: A.blue }}
            >
              <Plus size={11} /> Add
            </button>
          </div>
        </div>
      </SectionCard>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* ── Design tab ────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────── */

function DesignTab({ data, update }: { data: ArtistPageData; update: (p: Partial<ArtistPageData>) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-3"
    >
      {/* Layout */}
      <SectionCard label="Layout" dotColor={A.blue}>
        <div className="grid grid-cols-3 gap-2">
          {(["stack", "card", "hero"] as LayoutStyle[]).map((layout) => {
            const active = data.layoutStyle === layout;
            return (
              <button
                key={layout}
                onClick={() => update({ layoutStyle: layout })}
                className="rounded-lg border p-2 text-center transition-all"
                style={
                  active
                    ? { borderColor: A.blue, backgroundColor: A.blueSoft, color: A.blue }
                    : { borderColor: A.border, color: A.mute }
                }
              >
                <LayoutPreviewIcon layout={layout} color={active ? A.blue : A.mute} />
                <p className="mt-1 text-[10px] font-semibold capitalize">{layout}</p>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Typography */}
      <SectionCard label="Typography" dotColor={A.purple}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-wolf-muted">
              Heading
            </label>
            <select
              value={data.headingFont}
              onChange={(e) => update({ headingFont: e.target.value })}
              className="w-full rounded-lg border bg-transparent px-2 py-2 text-xs text-white focus:outline-none"
              style={{ borderColor: A.border }}
            >
              {HEADING_FONTS.map((f) => (
                <option key={f} value={f} className="bg-wolf-bg">
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-wolf-muted">
              Body
            </label>
            <select
              value={data.bodyFont}
              onChange={(e) => update({ bodyFont: e.target.value })}
              className="w-full rounded-lg border bg-transparent px-2 py-2 text-xs text-white focus:outline-none"
              style={{ borderColor: A.border }}
            >
              {BODY_FONTS.map((f) => (
                <option key={f} value={f} className="bg-wolf-bg">
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Colors */}
      <SectionCard label="Theme color" dotColor={A.green}>
        <div className="grid grid-cols-8 gap-1.5">
          {THEME_COLORS.map((t) => {
            const active = data.themeColor === t.color;
            return (
              <button
                key={t.id}
                onClick={() => update({ themeColor: t.color })}
                className="aspect-square rounded-full border-2 transition-all"
                style={{
                  backgroundColor: t.color,
                  borderColor: active ? "#fff" : "transparent",
                  boxShadow: active ? `0 0 0 2px ${t.color}60` : undefined,
                }}
                aria-label={t.id}
              />
            );
          })}
        </div>
      </SectionCard>

      {/* Background */}
      <SectionCard label="Background" dotColor={A.amber}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={data.backgroundColor}
            onChange={(e) => update({ backgroundColor: e.target.value })}
            className="h-8 w-12 cursor-pointer rounded-lg border bg-transparent"
            style={{ borderColor: A.border }}
          />
          <input
            value={data.backgroundColor}
            onChange={(e) => update({ backgroundColor: e.target.value })}
            className="flex-1 rounded-lg border bg-transparent px-2 py-1.5 text-xs font-mono text-white focus:outline-none"
            style={{ borderColor: A.border }}
          />
        </div>
      </SectionCard>

      {/* Link style */}
      <SectionCard label="Link style" dotColor={A.blue}>
        <div className="flex gap-1.5">
          {(["solid", "glass", "outline"] as LinkStyle[]).map((ls) => {
            const active = data.linkStyle === ls;
            return (
              <button
                key={ls}
                onClick={() => update({ linkStyle: ls })}
                className="flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition-all"
                style={
                  active
                    ? { borderColor: A.blue, backgroundColor: A.blueSoft, color: A.blue }
                    : { borderColor: A.border, color: A.mute }
                }
              >
                {ls}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Color mode */}
      <SectionCard label="Color mode" dotColor={A.purple}>
        <div className="flex gap-1.5">
          {(["uniform", "alternating"] as ColorMode[]).map((mode) => {
            const active = data.colorMode === mode;
            return (
              <button
                key={mode}
                onClick={() => update({ colorMode: mode })}
                className="flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition-all"
                style={
                  active
                    ? { borderColor: A.blue, backgroundColor: A.blueSoft, color: A.blue }
                    : { borderColor: A.border, color: A.mute }
                }
              >
                {mode}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Shapes (2-col) */}
      <div className="grid grid-cols-2 gap-3">
        <SectionCard label="Card" dotColor={A.green} compact>
          <div className="flex flex-col gap-1">
            {(["rounded", "pill", "square"] as CardShape[]).map((shape) => {
              const active = data.cardShape === shape;
              return (
                <button
                  key={shape}
                  onClick={() => update({ cardShape: shape })}
                  className="rounded-lg border py-1.5 text-[11px] font-semibold capitalize"
                  style={
                    active
                      ? { borderColor: A.blue, backgroundColor: A.blueSoft, color: A.blue }
                      : { borderColor: A.border, color: A.mute }
                  }
                >
                  {shape}
                </button>
              );
            })}
          </div>
        </SectionCard>
        <SectionCard label="Icon" dotColor={A.amber} compact>
          <div className="flex flex-col gap-1">
            {(["rounded", "circle", "square"] as IconShape[]).map((shape) => {
              const active = data.iconShape === shape;
              return (
                <button
                  key={shape}
                  onClick={() => update({ iconShape: shape })}
                  className="rounded-lg border py-1.5 text-[11px] font-semibold capitalize"
                  style={
                    active
                      ? { borderColor: A.blue, backgroundColor: A.blueSoft, color: A.blue }
                      : { borderColor: A.border, color: A.mute }
                  }
                >
                  {shape}
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Release style */}
      <SectionCard label="Release style" dotColor={A.blue}>
        <div className="flex gap-1.5">
          {(["glassmorphic", "editorial"] as ReleaseStyle[]).map((style) => {
            const active = data.releaseStyle === style;
            return (
              <button
                key={style}
                onClick={() => update({ releaseStyle: style })}
                className="flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition-all"
                style={
                  active
                    ? { borderColor: A.blue, backgroundColor: A.blueSoft, color: A.blue }
                    : { borderColor: A.border, color: A.mute }
                }
              >
                {style === "glassmorphic" ? "Glass" : "Bold"}
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Branding */}
      <SectionCard label="Branding" dotColor={A.purple}>
        <label className="flex items-center justify-between">
          <span className="text-xs text-white">Show Lightning Wolves branding</span>
          <Toggle
            value={data.showBranding}
            onChange={(v) => update({ showBranding: v })}
            accent={A.blue}
          />
        </label>
      </SectionCard>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* ── Preview pane — Mobile / Desktop with 13"/15"/24" sizes ────── */
/* ──────────────────────────────────────────────────────────────────── */

type PreviewMode = "mobile" | "desktop";
type DesktopSize = "13" | "15" | "24";

const DESKTOP_SIZES: Record<DesktopSize, { w: number; h: number; label: string }> = {
  "13": { w: 480, h: 300, label: "13-inch" },
  "15": { w: 560, h: 350, label: "15-inch" },
  "24": { w: 720, h: 405, label: "24-inch" },
};

function PreviewPane({ data }: { data: ArtistPageData }) {
  const [mode, setMode] = useState<PreviewMode>("mobile");
  const [size, setSize] = useState<DesktopSize>("15");

  return (
    <div className="sticky top-4 flex flex-col items-center">
      {/* Mode toggle */}
      <div
        className="mb-3 inline-flex rounded-lg border p-0.5"
        style={{ borderColor: A.border, backgroundColor: "rgba(0,0,0,0.3)" }}
      >
        <PreviewModeButton
          active={mode === "mobile"}
          onClick={() => setMode("mobile")}
          icon={<Smartphone size={12} />}
          label="Mobile"
        />
        <PreviewModeButton
          active={mode === "desktop"}
          onClick={() => setMode("desktop")}
          icon={<Monitor size={12} />}
          label="Desktop"
        />
      </div>

      {/* Desktop size sub-selector */}
      {mode === "desktop" && (
        <div
          className="mb-3 inline-flex rounded-lg border p-0.5 text-[10px]"
          style={{ borderColor: A.border, backgroundColor: "rgba(0,0,0,0.3)" }}
        >
          {(Object.keys(DESKTOP_SIZES) as DesktopSize[]).map((s) => {
            const active = size === s;
            return (
              <button
                key={s}
                onClick={() => setSize(s)}
                className="rounded-md px-2.5 py-1 font-bold uppercase tracking-wider transition-all"
                style={
                  active
                    ? { backgroundColor: A.blueSoft, color: A.blue }
                    : { color: A.mute }
                }
              >
                {DESKTOP_SIZES[s].label}
              </button>
            );
          })}
        </div>
      )}

      {/* Frame */}
      {mode === "mobile" ? (
        <PhonePreview data={data} />
      ) : (
        <DesktopPreview data={data} size={size} />
      )}

      <p className="mt-3 text-center text-[10px] text-wolf-muted">
        <Eye size={10} className="mr-1 inline" />
        Live preview · updates as you edit
      </p>
    </div>
  );
}

function PreviewModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all"
      style={
        active
          ? { backgroundColor: A.blueSoft, color: A.blue }
          : { color: A.mute }
      }
    >
      {icon}
      {label}
    </button>
  );
}

/* Desktop preview — browser chrome wrapping the artist page in a centered card */
function DesktopPreview({ data, size }: { data: ArtistPageData; size: DesktopSize }) {
  const { w, h } = DESKTOP_SIZES[size];
  const url = `lightningwolves.studio/${data.handle || "your-handle"}`;

  return (
    <div
      className="relative overflow-hidden rounded-xl border-2 shadow-2xl"
      style={{
        width: w,
        height: h,
        borderColor: "#1a1a1f",
        backgroundColor: "#0c0c10",
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex h-7 items-center gap-2 border-b px-3"
        style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#15151b" }}
      >
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#ff5f57" }} />
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#febc2e" }} />
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#28c840" }} />
        </div>
        <div
          className="flex-1 truncate rounded-md px-2 py-0.5 text-center text-[9px] text-white/50"
          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          {url}
        </div>
      </div>

      {/* Page viewport — artist page sits in a centered max-w-sm column */}
      <div
        className="h-[calc(100%-1.75rem)] overflow-y-auto"
        style={{ backgroundColor: data.backgroundColor }}
      >
        <div className="mx-auto max-w-sm p-4">
          <ArtistPageBody data={data} compact />
        </div>
      </div>
    </div>
  );
}

function PhonePreview({ data }: { data: ArtistPageData }) {
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-[40px] border-4 shadow-2xl"
      style={{
        width: 320,
        height: 650,
        borderColor: "#1a1a1f",
        backgroundColor: data.backgroundColor,
      }}
    >
      {/* Notch */}
      <div
        className="absolute left-1/2 top-1 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl"
        style={{ backgroundColor: "#000" }}
      />

      {/* Page content */}
      <div className="h-full overflow-y-auto p-5 pt-10">
        <ArtistPageBody data={data} />
      </div>

      {/* Home indicator */}
      <div
        className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full"
        style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
      />
    </div>
  );
}

/* Reusable artist page body — shared between phone + desktop preview frames */
function ArtistPageBody({ data, compact = false }: { data: ArtistPageData; compact?: boolean }) {
  const cardRadius = data.cardShape === "pill" ? "9999px" : data.cardShape === "square" ? "4px" : "16px";
  const iconRadius = data.iconShape === "circle" ? "9999px" : data.iconShape === "square" ? "4px" : "10px";

  const linkStyleClass = (active = true) => {
    switch (data.linkStyle) {
      case "solid":
        return { backgroundColor: active ? data.themeColor : "rgba(255,255,255,0.1)", color: "#000" };
      case "glass":
        return { backgroundColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(10px)", color: "#fff", border: `1px solid rgba(255,255,255,0.1)` };
      case "outline":
        return { backgroundColor: "transparent", color: "#fff", border: `1px solid ${data.themeColor}50` };
    }
  };

  const avatarSize = compact ? "h-14 w-14" : "h-20 w-20";

  return (
    <div className="flex flex-col items-center">
      {/* Avatar */}
      <div
        className={`${avatarSize} flex items-center justify-center overflow-hidden border-2`}
        style={{
          borderRadius: iconRadius,
          borderColor: data.themeColor,
          backgroundColor: `${data.themeColor}20`,
        }}
      >
        {data.photoUrl ? (
          <img src={data.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            className={compact ? "text-lg font-bold" : "text-2xl font-bold"}
            style={{ color: data.themeColor }}
          >
            {data.displayName.charAt(0).toUpperCase() || "?"}
          </span>
        )}
      </div>

      {/* Name */}
      <h1
        className={`mt-3 text-center font-bold text-white ${compact ? "text-base" : "text-xl"}`}
        style={{ fontFamily: data.headingFont }}
      >
        {data.displayName || "Your Name"}
      </h1>

      {/* Roles */}
      {data.roles.length > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-1">
          {data.roles.map((r) => (
            <span
              key={r}
              className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
              style={{
                backgroundColor: `${data.themeColor}18`,
                color: data.themeColor,
              }}
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {/* Location */}
      {data.location && (
        <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-white/60">
          <MapPin size={9} /> {data.location}
        </p>
      )}

      {/* Bio */}
      {data.bio && (
        <p
          className="mt-1 text-center text-[11px] text-white/70"
          style={{ fontFamily: data.bodyFont }}
        >
          {data.bio}
        </p>
      )}

      {/* Social icons row */}
      {data.socialLinks.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {data.socialLinks.map((s, i) => {
            const platform = SOCIAL_PLATFORMS.find((p) => p.id === s.platform);
            const Icon = platform?.icon || Globe;
            return (
              <div
                key={i}
                className="flex h-8 w-8 items-center justify-center border"
                style={{
                  borderRadius: iconRadius,
                  borderColor: `${data.themeColor}40`,
                  backgroundColor: `${data.themeColor}15`,
                }}
              >
                <Icon size={13} style={{ color: platform?.color || data.themeColor }} />
              </div>
            );
          })}
        </div>
      )}

      {/* Custom links */}
      {data.customLinks.length > 0 && (
        <div className="mt-5 w-full space-y-2">
          {data.customLinks.map((l, i) => {
            const isAlt = data.colorMode === "alternating" && i % 2 === 1;
            const style = linkStyleClass(!isAlt);
            return (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 text-[12px] font-semibold"
                style={{ ...style, borderRadius: cardRadius }}
              >
                <span>{l.label}</span>
                <ExternalLink size={11} />
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state when nothing yet */}
      {data.socialLinks.length === 0 && data.customLinks.length === 0 && (
        <p className="mt-10 text-center text-[11px] text-white/40">
          Add some links on the Links tab to bring your page to life.
        </p>
      )}

      {/* Branding */}
      {data.showBranding && (
        <div className="mt-auto pt-12 text-center">
          <p className="text-[9px] text-white/30">
            Made with{" "}
            <span className="font-bold" style={{ color: data.themeColor }}>
              ⚡ Lightning Wolves
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* ── Primitives ────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────── */

function SectionCard({
  label,
  dotColor,
  count,
  compact,
  children,
}: {
  label: string;
  dotColor?: string;
  count?: number;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border ${compact ? "p-3" : "p-4"}`}
      style={{ borderColor: A.border, backgroundColor: "rgba(0,0,0,0.2)" }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        {dotColor && (
          <span className="inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
        )}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-wolf-muted">{label}</p>
        {typeof count === "number" && count > 0 && (
          <span className="text-[10px] text-wolf-muted">· {count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  value,
  onChange,
  accent,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  accent: string;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative h-5 w-10 rounded-full transition-colors"
      style={{ backgroundColor: value ? accent : "rgba(255,255,255,0.15)" }}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
        style={{ left: value ? "calc(100% - 18px)" : "2px" }}
      />
    </button>
  );
}

function LayoutPreviewIcon({ layout, color }: { layout: LayoutStyle; color: string }) {
  // Mini visual previews of the 3 layout options.
  const stroke = color;
  if (layout === "stack") {
    return (
      <svg viewBox="0 0 40 50" className="mx-auto h-9 w-7">
        <circle cx="20" cy="12" r="5" fill={stroke} opacity="0.7" />
        <rect x="6" y="22" width="28" height="4" rx="2" fill={stroke} opacity="0.5" />
        <rect x="6" y="30" width="28" height="4" rx="2" fill={stroke} opacity="0.5" />
        <rect x="6" y="38" width="28" height="4" rx="2" fill={stroke} opacity="0.5" />
      </svg>
    );
  }
  if (layout === "card") {
    return (
      <svg viewBox="0 0 40 50" className="mx-auto h-9 w-7">
        <rect x="4" y="6" width="14" height="18" rx="2" fill={stroke} opacity="0.7" />
        <rect x="22" y="6" width="14" height="18" rx="2" fill={stroke} opacity="0.5" />
        <rect x="4" y="28" width="14" height="18" rx="2" fill={stroke} opacity="0.5" />
        <rect x="22" y="28" width="14" height="18" rx="2" fill={stroke} opacity="0.5" />
      </svg>
    );
  }
  // hero
  return (
    <svg viewBox="0 0 40 50" className="mx-auto h-9 w-7">
      <rect x="4" y="4" width="32" height="20" rx="2" fill={stroke} opacity="0.7" />
      <rect x="4" y="28" width="32" height="4" rx="2" fill={stroke} opacity="0.5" />
      <rect x="4" y="36" width="32" height="4" rx="2" fill={stroke} opacity="0.5" />
    </svg>
  );
}
