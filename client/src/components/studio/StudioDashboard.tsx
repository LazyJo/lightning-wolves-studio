import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  Music,
  Shuffle,
  Film,
  Video,
  Image,
  Sparkles,
  LayoutGrid,
  Zap,
  Globe,
  Bell,
  Settings,
  Clock,
  X,
  Check,
  Loader2,
  LogOut,
  Eye,
} from "lucide-react";
import type { Wolf } from "../../data/wolves";
import { tierLabel, tierColor } from "../../lib/useCredits";
import { useRecentActivity, formatTimeAgo } from "../../lib/useRecentActivity";
import { useProfile } from "../../lib/useProfile";
import { getSupabase } from "../../lib/supabaseClient";
import { useReducedMotion, setReducedMotion } from "../../lib/useReducedMotion";
import { useSession } from "../../lib/useSession";
import TemplatesList from "./TemplatesList";

type View = "dashboard" | "remix" | "template" | "scenes" | "performance" | "cover-art" | "artist-page";

interface Plan {
  tier: string;
  credits: number;
  maxCredits: number;
  creditsPerMonth: number;
  templates: string;
  concurrent: number;
  isGuest: boolean;
}

interface Props {
  wolf: Wolf | null;
  accentColor: string;
  plan: Plan;
  onSelectTool: (view: View) => void;
  onBack: () => void;
  onWolfMap?: () => void;
  onWolfHub?: () => void;
  t: (key: string) => string;
  /** Jump straight to the TemplateEditor (new template) */
  onNewTemplate?: () => void;
  /** Open a saved template's mode picker */
  onOpenTemplate?: (id: string) => void;
}

const toolDefs: {
  id: View;
  titleKey: string;
  descKey: string;
  icon: typeof Shuffle;
  color: string;
  popular?: boolean;
  badge?: string;
  tags?: string[];
  credits: number;
}[] = [
  { id: "remix", titleKey: "studio.remix", descKey: "studio.remixDesc", icon: Shuffle, color: "#f5c518", popular: true, tags: ["YouTube import", "Auto scene detect", "Shuffle clips"], credits: 15 },
  { id: "scenes", titleKey: "studio.scenes", descKey: "studio.scenesDesc", icon: Film, color: "#69f0ae", badge: "AI", credits: 60 },
  { id: "performance", titleKey: "studio.performance", descKey: "studio.performanceDesc", icon: Video, color: "#E040FB", badge: "AI", credits: 15 },
  { id: "cover-art", titleKey: "studio.coverArt", descKey: "studio.coverArtDesc", icon: Image, color: "#82b1ff", credits: 12 },
];

const stepDefs = [
  { num: 1, titleKey: "studio.step1", descKey: "studio.step1Desc", color: "#69f0ae", icon: Music },
  { num: 2, titleKey: "studio.step2", descKey: "studio.step2Desc", color: "#f5c518", icon: Shuffle },
  { num: 3, titleKey: "studio.step3", descKey: "studio.step3Desc", color: "#E040FB", icon: Sparkles },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const TOOL_ICONS: Record<string, string> = {
  remix: "Shuffle",
  template: "Music",
  scenes: "Film",
  performance: "Video",
  "cover-art": "Image",
};

export default function StudioDashboard({ wolf, accentColor, plan, onSelectTool, onBack, onWolfMap, onWolfHub, t, onNewTemplate, onOpenTemplate }: Props) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { activities } = useRecentActivity();
  const { profile } = useProfile();
  const [showWolfPicker, setShowWolfPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // First-visit wolf picker: signed-in user without a wolf_id chooses
  // their accent wolf so the studio themes itself.
  useEffect(() => {
    if (profile && !profile.wolf_id) setShowWolfPicker(true);
  }, [profile?.id, profile?.wolf_id]);

  const tColor = tierColor(plan.tier);
  const creditPercent = plan.maxCredits > 0 ? Math.min((plan.credits / plan.maxCredits) * 100, 100) : 0;

  return (
    <>
      {/* Greeting Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {wolf && (
              <div
                className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2"
                style={{ borderColor: `${accentColor}50` }}
              >
                {wolf.video ? (
                  <video src={wolf.video} autoPlay loop muted playsInline className="h-full w-full object-cover" />
                ) : wolf.image ? (
                  <img src={wolf.image} alt={wolf.artist} className="h-full w-full p-1" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">🐺</div>
                )}
              </div>
            )}
            <div>
              <h1
                className="text-2xl font-bold tracking-wider text-white sm:text-3xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {getGreeting()},{" "}
                <span style={{ color: accentColor }}>
                  {wolf?.artist ||
                    profile?.display_name ||
                    profile?.email?.split("@")[0] ||
                    "Wolf"}
                </span>
              </h1>
              <p className="mt-0.5 text-sm text-wolf-muted">
                Create AI-powered music videos from your songs
              </p>
            </div>
          </div>

          {/* Right side: plan + credits + icons */}
          <div className="hidden items-center gap-4 md:flex">
            <div className="flex items-center gap-3">
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: `${tColor}15`, color: tColor }}
              >
                {tierLabel(plan.tier)}
              </span>

              {/* Credits progress */}
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-28 overflow-hidden rounded-full bg-wolf-surface">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${creditPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${accentColor}, #69f0ae)` }}
                  />
                </div>
                <span className="text-sm font-medium text-wolf-muted">
                  <span className="font-bold text-white">{plan.credits}</span>
                  {" / "}
                  {plan.maxCredits}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(true)}
                aria-label="Settings"
                title="Settings"
                className="rounded-lg p-2 text-wolf-muted transition-colors hover:bg-wolf-surface hover:text-white"
              >
                <Settings size={16} />
              </button>
              <button
                aria-label="Notifications"
                title="Notifications — coming soon"
                className="rounded-lg p-2 text-wolf-muted transition-colors hover:bg-wolf-surface hover:text-white"
              >
                <Bell size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile credits bar */}
        <div className="mt-4 flex items-center gap-3 md:hidden">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ backgroundColor: `${tColor}15`, color: tColor }}
          >
            {tierLabel(plan.tier)}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-wolf-surface">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${creditPercent}%`, background: `linear-gradient(90deg, ${accentColor}, #69f0ae)` }}
            />
          </div>
          <span className="text-xs text-wolf-muted">
            <span className="font-bold text-white">{plan.credits}</span>/{plan.maxCredits}
          </span>
        </div>
      </motion.div>

      {/* Artist Page Banner */}
      {!bannerDismissed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative mb-6 overflow-hidden rounded-2xl border p-6"
          style={{ borderColor: `${accentColor}25`, background: `linear-gradient(135deg, ${accentColor}08, #9b6dff08, ${accentColor}04)` }}
        >
          <button
            onClick={() => setBannerDismissed(true)}
            className="absolute top-3 right-3 rounded-lg p-1 text-wolf-muted transition-colors hover:bg-wolf-surface hover:text-white"
          >
            <X size={14} />
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                <Globe size={22} style={{ color: accentColor }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                    Artist Page
                  </h3>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black"
                    style={{ backgroundColor: accentColor }}
                  >
                    NEW FEATURE
                  </span>
                </div>
                <p className="text-sm text-wolf-muted">
                  Build your own link-in-bio page with music embeds, smart release links, social profiles, and custom designs. Share one link for everything.
                </p>
              </div>
            </div>
            <button
              onClick={() => onSelectTool("artist-page")}
              className="hidden shrink-0 items-center gap-1.5 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all hover:gap-2.5 md:inline-flex"
              style={{ borderColor: `${accentColor}40`, color: accentColor }}
            >
              Build Your Page <ArrowRight size={14} />
            </button>
          </div>
          {/* Mobile CTA */}
          <button
            onClick={() => onSelectTool("artist-page")}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold md:hidden"
            style={{ color: accentColor }}
          >
            Build Your Page <ArrowRight size={14} />
          </button>
        </motion.div>
      )}

      {/* Templates — the spine of the Studio. Appears above the
          legacy tool tiles because everything-lyric-video flows
          through a template now. */}
      {(onNewTemplate || onOpenTemplate) && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mb-8"
        >
          <TemplatesList
            onNew={() => onNewTemplate?.()}
            onOpen={(id) => onOpenTemplate?.(id)}
            accentColor={accentColor}
          />
        </motion.div>
      )}

      {/* Secondary tools — Cover Art, Artist Page, and quick-jump
          Remix/Scenes/Performance tiles that still bounce through the
          Templates list when clicked (the App router handles it). */}
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-wolf-muted">
        More tools
      </p>
      <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr]">
        {/* Remix — large featured card (cyan to match RemixView) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          whileHover={{ y: -4 }}
          onClick={() => onSelectTool("remix")}
          className="group cursor-pointer rounded-2xl border p-7 lg:row-span-2"
          style={{
            borderColor: "rgba(245,197,24,0.25)",
            background: "linear-gradient(135deg, rgba(245,197,24,0.08) 0%, transparent 60%)",
          }}
        >
          <span
            className="mb-4 inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black"
            style={{ backgroundColor: "#f5c518" }}
          >
            {t("studio.mostPopular")}
          </span>
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "rgba(245,197,24,0.15)" }}
          >
            <Shuffle size={24} style={{ color: "#f5c518" }} />
          </div>
          <h3 className="mb-2 text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Remix
          </h3>
          <p className="mb-5 text-sm leading-relaxed text-wolf-muted">
            {t("studio.remixDesc")}
          </p>
          <div className="mb-5 flex flex-wrap gap-2">
            {["YouTube import", "Auto scene detect", "Shuffle clips"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border px-3 py-1 text-xs"
                style={{
                  borderColor: "rgba(245,197,24,0.25)",
                  backgroundColor: "rgba(245,197,24,0.05)",
                  color: "#f5c518",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all group-hover:gap-2.5"
              style={{ color: "#f5c518" }}
            >
              {t("studio.tryRemix")} <ArrowRight size={14} />
            </span>
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{ backgroundColor: "rgba(245,197,24,0.12)", color: "#f5c518" }}
            >
              <Zap size={10} /> 15
            </span>
          </div>
        </motion.div>

        {/* Other tools — 2x2 grid */}
        {toolDefs.slice(1).map((td, i) => (
          <motion.div
            key={td.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            whileHover={{ y: -4 }}
            onClick={() => onSelectTool(td.id)}
            className="group cursor-pointer rounded-2xl border border-wolf-border/20 bg-wolf-card p-6 transition-all hover:border-wolf-border/40"
            style={{ ["--tool-color" as string]: td.color }}
          >
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${td.color}12` }}
              >
                <td.icon size={18} style={{ color: td.color }} />
              </div>
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                {t(td.titleKey)}
              </h3>
              {td.badge && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                  style={{ backgroundColor: `${td.color}15`, color: td.color }}
                >
                  {td.badge}
                </span>
              )}
            </div>
            <p className="mb-4 text-sm text-wolf-muted">{t(td.descKey)}</p>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-wolf-muted transition-all group-hover:gap-2.5 group-hover:text-white">
                {t("studio.open")} <ArrowRight size={13} />
              </span>
              {td.credits > 0 && (
                <span
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
                  style={{ backgroundColor: `${td.color}10`, color: td.color }}
                >
                  <Zap size={10} /> {td.credits}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* How It Works + Side Cards */}
      <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-wolf-border/20 bg-wolf-card/50 p-7"
        >
          <div className="mb-5 flex items-center gap-2">
            <Sparkles size={16} className="text-wolf-gold" />
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-wolf-muted">
              {t("studio.howItWorks")}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {stepDefs.map((s, i) => (
              <motion.div
                key={s.num}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-wolf-border/15 bg-wolf-surface/50 p-4"
              >
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-black"
                    style={{ backgroundColor: s.color }}
                  >
                    {s.num}
                  </span>
                  <s.icon size={14} style={{ color: s.color }} />
                  <h4 className="text-sm font-bold text-white">{t(s.titleKey)}</h4>
                </div>
                <p className="text-xs leading-relaxed text-wolf-muted">{t(s.descKey)}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Side Cards — Templates used to live here but now appears
            above the tool grid as the primary Studio surface. */}
        <div className="flex flex-col gap-4">
          {onWolfMap && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              onClick={onWolfMap}
              className="group cursor-pointer rounded-xl border border-wolf-border/20 bg-wolf-card/50 p-5 transition-all hover:border-wolf-border/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${accentColor}12` }}
                  >
                    <span className="text-lg">🗺️</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Wolf Map</p>
                    <p className="text-xs text-wolf-muted">Explore territories worldwide</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-wolf-muted transition-transform group-hover:translate-x-1" />
              </div>
            </motion.div>
          )}
          {onWolfHub && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              onClick={onWolfHub}
              className="group cursor-pointer rounded-xl border border-wolf-border/20 bg-wolf-card/50 p-5 transition-all hover:border-wolf-border/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${accentColor}12` }}
                  >
                    <span className="text-lg">🐺</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Wolf Hub</p>
                    <p className="text-xs text-wolf-muted">Connect with artists worldwide</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-wolf-muted transition-transform group-hover:translate-x-1" />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Recent Activity + Updates */}
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-xl border border-wolf-border/20 bg-wolf-card/50 p-5"
        >
          <div className="mb-4 flex items-center gap-2">
            <Clock size={14} className="text-wolf-muted" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-wolf-muted">
              Recent Activity
            </span>
          </div>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.slice(0, 4).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-wolf-surface/40 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-wolf-gold/10">
                      <Zap size={12} className="text-wolf-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{a.title}</p>
                      <p className="text-[10px] text-wolf-muted capitalize">{a.tool.replace("-", " ")}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-wolf-muted">{formatTimeAgo(a.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-wolf-surface/30 py-8 text-center">
              <Sparkles size={20} className="mx-auto mb-2 text-wolf-muted/50" />
              <p className="text-sm text-wolf-muted">No activity yet</p>
              <p className="text-xs text-wolf-muted/60">Start creating to see your history here</p>
            </div>
          )}
        </motion.div>

        {/* Recent Updates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-wolf-border/20 bg-wolf-card/50 p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-wolf-muted">
              Recent Updates
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-lg bg-wolf-surface/40 px-3 py-2.5">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#69f0ae]/10">
                <Globe size={12} className="text-[#69f0ae]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Artist Page is here</p>
                <p className="text-[10px] text-wolf-muted">Build your link-in-bio with wolf identity</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg bg-wolf-surface/40 px-3 py-2.5">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-wolf-gold/10">
                <Sparkles size={12} className="text-wolf-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">New AI models available</p>
                <p className="text-[10px] text-wolf-muted">Grok Imagine, Kling Motion Control</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg bg-wolf-surface/40 px-3 py-2.5">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#E040FB]/10">
                <Video size={12} className="text-[#E040FB]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Remix tool upgraded</p>
                <p className="text-[10px] text-wolf-muted">Lyrics sync + 9:16 vertical video</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showWolfPicker && profile && (
          <WolfColorPickerModal
            profileId={profile.id}
            onSaved={() => setShowWolfPicker(false)}
          />
        )}
        {showSettings && (
          <SettingsModal
            profileId={profile?.id || null}
            currentWolfId={profile?.wolf_id || null}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── First-visit wolf-color (theme) picker ─── */

// All theme colors a wolf can pick. Ids are stored in profiles.wolf_id.
// Keep ids in sync with the WOLF_COLOR maps in WolfHubPage + AdminMembersPage.
const THEME_COLORS: { id: string; color: string }[] = [
  { id: "yellow", color: "#f5c518" },
  { id: "orange", color: "#ff8a3d" },
  { id: "red",    color: "#ef4444" },
  { id: "pink",   color: "#ec4899" },
  { id: "purple", color: "#E040FB" },
  { id: "blue",   color: "#3b82f6" },
  { id: "white",  color: "#e5e7eb" },
  { id: "green",  color: "#10b981" },
];

function WolfColorPickerModal({
  profileId,
  onSaved,
}: {
  profileId: string;
  onSaved: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!picked) return;
    setSaving(true);
    try {
      const sb = getSupabase();
      if (!sb) {
        onSaved();
        return;
      }
      await sb.from("profiles").update({ wolf_id: picked }).eq("id", profileId);
      // Reload so the accent color applies everywhere (App's wolfColor state
      // doesn't watch the profile row directly).
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  const pickedColor = THEME_COLORS.find((c) => c.id === picked)?.color;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-wolf-card"
      >
        <div className="px-6 py-5 text-center">
          <div className="mb-1 text-3xl">🐺</div>
          <h3
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Pick your theme
          </h3>
          <p className="mt-1 text-sm text-wolf-muted">
            Tap a colour to theme your studio. You can change it later in your
            profile.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-5 px-6 pb-6">
          {THEME_COLORS.map((c, i) => {
            const isPicked = picked === c.id;
            return (
              <motion.button
                key={c.id}
                onClick={() => setPicked(c.id)}
                aria-label={`${c.id} theme`}
                aria-pressed={isPicked}
                className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full"
                animate={
                  isPicked
                    ? { scale: 1.15, y: 0 }
                    : { scale: 1, y: [0, -4, 0] }
                }
                transition={
                  isPicked
                    ? { type: "spring", stiffness: 380, damping: 18 }
                    : {
                        duration: 2.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.18,
                      }
                }
                whileHover={{ scale: isPicked ? 1.18 : 1.12 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  backgroundColor: c.color,
                  boxShadow: isPicked
                    ? `0 0 0 3px ${c.color}, 0 0 30px ${c.color}aa, 0 0 60px ${c.color}66`
                    : `0 6px 22px ${c.color}55`,
                }}
              >
                {isPicked && (
                  <motion.div
                    layoutId="picked-ring"
                    className="absolute -inset-1 rounded-full border-2 border-white/80"
                    transition={{ type: "spring", stiffness: 320, damping: 25 }}
                  />
                )}
                {isPicked && (
                  <Check
                    size={20}
                    className="relative z-10 text-black drop-shadow-sm"
                    strokeWidth={3}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
        <div className="border-t border-white/10 px-6 py-4">
          <button
            onClick={save}
            disabled={!picked || saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-black transition-all disabled:opacity-40"
            style={{
              backgroundColor: pickedColor || "#f5c518",
              boxShadow: pickedColor ? `0 8px 30px ${pickedColor}40` : undefined,
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Set my theme
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Settings modal — accent color, motion, sign out ─── */

function SettingsModal({
  profileId,
  currentWolfId,
  onClose,
}: {
  profileId: string | null;
  currentWolfId: string | null;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const { signOut } = useSession();
  const [savingWolf, setSavingWolf] = useState<string | null>(null);

  async function pickWolf(wolfId: string) {
    if (!profileId || savingWolf) return;
    setSavingWolf(wolfId);
    try {
      const sb = getSupabase();
      if (!sb) return;
      await sb.from("profiles").update({ wolf_id: wolfId }).eq("id", profileId);
      window.location.reload();
    } finally {
      setSavingWolf(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-wolf-card"
      >
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-wolf-muted transition-colors hover:bg-white/5 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-6 pb-4">
          <h3
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Settings
          </h3>
          <p className="mt-0.5 text-xs text-wolf-muted">
            Theme, motion, and account.
          </p>
        </div>

        {/* Accent color (wolf swatches) */}
        <div className="border-t border-white/5 px-6 py-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-wolf-muted">
            Accent color
          </p>
          {profileId ? (
            <div className="flex flex-wrap gap-3">
              {THEME_COLORS.map((c) => {
                const isCurrent = currentWolfId === c.id;
                const isSaving = savingWolf === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => pickWolf(c.id)}
                    disabled={!!savingWolf}
                    aria-label={`${c.id} theme`}
                    aria-pressed={isCurrent}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-110 disabled:opacity-50"
                    style={{
                      backgroundColor: c.color,
                      boxShadow: isCurrent
                        ? `0 0 0 2px ${c.color}, 0 0 18px ${c.color}aa`
                        : `0 4px 12px ${c.color}40`,
                    }}
                  >
                    {isSaving ? (
                      <Loader2 size={14} className="animate-spin text-black" />
                    ) : isCurrent ? (
                      <Check size={14} className="text-black" strokeWidth={3} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-wolf-muted">
              Sign in to save your theme across devices.
            </p>
          )}
        </div>

        {/* Reduce motion */}
        <div className="flex items-center justify-between border-t border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <Eye size={15} className="text-wolf-muted" />
            <div>
              <p className="text-sm font-semibold text-white">Reduce motion</p>
              <p className="text-[11px] text-wolf-muted">
                Calms the louder animations.
              </p>
            </div>
          </div>
          <button
            onClick={() => setReducedMotion(!reducedMotion)}
            role="switch"
            aria-checked={reducedMotion}
            className="relative h-6 w-11 rounded-full transition-colors"
            style={{
              backgroundColor: reducedMotion ? "#f5c518" : "rgba(255,255,255,0.12)",
            }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
              style={{
                transform: reducedMotion ? "translateX(22px)" : "translateX(2px)",
              }}
            />
          </button>
        </div>

        {/* Sign out */}
        {profileId && (
          <div className="border-t border-white/5 px-6 py-4">
            <button
              onClick={async () => {
                await signOut();
                window.location.reload();
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/10"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
