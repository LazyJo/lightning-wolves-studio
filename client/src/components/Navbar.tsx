import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, Zap, Globe, Music, Shuffle, Film, Video, Image, LayoutDashboard, Bell, Shield, Sparkles } from "lucide-react";
import { useI18n, LANGUAGES } from "../lib/i18n";
import { useHubNotifications } from "../lib/useHubNotifications";
import { initSupabase } from "../lib/supabaseClient";
import { useReducedMotion, setReducedMotion } from "../lib/useReducedMotion";

const STUDIO_TOOLS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "template", label: "Templates", icon: Music },
  { id: "remix", label: "Remix", icon: Shuffle },
  { id: "scenes", label: "Scenes", icon: Film },
  { id: "performance", label: "Performance", icon: Video },
  { id: "cover-art", label: "Cover Art", icon: Image },
  { id: "pricing", label: "Pricing", icon: Zap },
];

interface Props {
  onPricing: () => void;
  onWolfMap: () => void;
  onWolfHub: () => void;
  onHome: () => void;
  onStudio: () => void;
  onAuth: () => void;
  onGoldenBoard?: () => void;
  onAdminMembers?: () => void;
  isInStudio?: boolean;
  studioView?: string;
  onStudioNav?: (view: string) => void;
  credits?: number;
  tier?: string;
  wolfColor?: string;
  /** Optional: unread notification count for the bell badge (LYRC parity) */
  notifications?: number;
  onNotifications?: () => void;
}

export default function Navbar({
  onPricing, onWolfMap, onWolfHub, onHome, onStudio, onAuth, onGoldenBoard,
  onAdminMembers,
  isInStudio, studioView, onStudioNav, credits, tier, wolfColor,
  notifications = 0, onNotifications,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { lang, setLang, t } = useI18n();
  const accent = wolfColor || "#f5c518";
  const { count: hubUnread } = useHubNotifications();
  const [hubPulseKey, setHubPulseKey] = useState(0);
  const reducedMotion = useReducedMotion();

  // Subscribe to ⚡⚡ inserts anywhere in the Hub. Each new strike pulses
  // the navbar Wolf Hub button — ambient signal that the community is
  // alive, even when the user is on the homepage / studio / wolf map.
  // Skipped when reducedMotion is on (saves the realtime channel too).
  useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;
    let sub: { unsubscribe: () => void } | null = null;
    (async () => {
      const sb = await initSupabase();
      if (!sb || cancelled) return;
      sub = sb
        .channel("navbar-lightning-pulse")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "hub_reactions" },
          (payload) => {
            const r = payload.new as { emoji?: string };
            if (r.emoji !== "⚡⚡") return;
            setHubPulseKey((k) => k + 1);
          }
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      sub?.unsubscribe();
    };
  }, [reducedMotion]);

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="fixed top-0 right-0 left-0 z-50 border-b border-wolf-border/20 bg-wolf-bg/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <button onClick={isInStudio ? () => onStudioNav?.("dashboard") : onHome} className="flex items-center gap-3">
          <img
            src="/LightningWolvesLogoTransparentBG.png"
            alt="Lightning Wolves"
            className="h-8 w-8"
          />
          <span
            className="hidden text-sm font-bold tracking-[0.15em] text-white sm:block md:text-base"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            LIGHTNING{" "}
            <span className="text-wolf-gold">WOLVES</span>
          </span>
        </button>

        {/* Center Nav — switches between site links and studio tool links */}
        <div className="hidden items-center gap-1 md:flex">
          {isInStudio && onStudioNav ? (
            /* Studio tool navigation */
            STUDIO_TOOLS.map((tool) => {
              const isActive = studioView === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => onStudioNav(tool.id)}
                  className="relative rounded-lg px-3 py-2 text-sm font-medium transition-all"
                  style={{
                    color: isActive ? accent : undefined,
                    backgroundColor: isActive ? `${accent}10` : undefined,
                  }}
                >
                  <span className={`flex items-center gap-1.5 ${isActive ? "" : "text-wolf-muted hover:text-white"}`}>
                    <tool.icon size={14} />
                    {tool.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="studio-nav-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                  )}
                </button>
              );
            })
          ) : (
            /* Regular site navigation */
            <>
              <button
                onClick={onHome}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white transition-all hover:border-wolf-gold/30 hover:bg-wolf-gold/5 hover:text-wolf-gold"
              >
                {t("nav.home")}
              </button>
              <button
                onClick={onWolfMap}
                className="group relative overflow-hidden rounded-lg px-4 py-2 text-sm font-bold text-white transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20"
                style={{ background: "linear-gradient(135deg, #9b6dff 0%, #f5c518 50%, #E040FB 100%)", padding: "1px" }}
              >
                <span className="relative z-10 flex items-center gap-1.5 rounded-[7px] bg-wolf-bg/90 px-4 py-[7px] backdrop-blur-sm transition-all group-hover:bg-wolf-bg/70">
                  <span className="animate-pulse-glow text-base">🐺</span>
                  <span className="bg-gradient-to-r from-[#9b6dff] via-[#f5c518] to-[#E040FB] bg-clip-text text-transparent">
                    Wolf Map
                  </span>
                </span>
              </button>
              <button
                onClick={onWolfHub}
                className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg border border-[#9b6dff]/40 bg-gradient-to-r from-[#9b6dff]/15 via-[#E040FB]/10 to-[#9b6dff]/15 px-4 py-2 text-sm font-bold text-white transition-all hover:border-[#9b6dff]/70 hover:shadow-lg hover:shadow-[#9b6dff]/20"
                title="Wolf Hub — community chat & media"
              >
                {/* Lightning pulse overlay — re-fires on each ⚡⚡ INSERT via hubPulseKey. */}
                <AnimatePresence>
                  {hubPulseKey > 0 && !reducedMotion && (
                    <motion.span
                      key={hubPulseKey}
                      initial={{ opacity: 0.55, scale: 0.85 }}
                      animate={{ opacity: 0, scale: 1.4 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-lg"
                      style={{
                        background:
                          "radial-gradient(circle at center, rgba(245,197,24,0.8) 0%, rgba(245,197,24,0) 70%)",
                      }}
                    />
                  )}
                </AnimatePresence>
                <span className="relative text-sm">🐺</span>
                <span className="relative bg-gradient-to-r from-[#c8a4ff] to-[#f0a4ff] bg-clip-text text-transparent">
                  Wolf Hub
                </span>
                {hubUnread > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-lg"
                    style={{ backgroundColor: "#ef4444" }}
                    aria-label={`${hubUnread} unread Wolf Hub notifications`}
                  >
                    {hubUnread > 99 ? "99+" : hubUnread}
                  </span>
                )}
              </button>
              {onGoldenBoard && (
                <button
                  onClick={onGoldenBoard}
                  className="group inline-flex items-center gap-1.5 rounded-lg border border-wolf-gold/40 bg-gradient-to-r from-wolf-gold/15 via-wolf-amber/10 to-wolf-gold/15 px-4 py-2 text-sm font-bold text-wolf-gold transition-all hover:border-wolf-gold/70 hover:shadow-lg hover:shadow-wolf-gold/20"
                >
                  <span className="text-sm">🏆</span>
                  Golden Board
                </button>
              )}
              <button
                onClick={onPricing}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white transition-all hover:border-wolf-gold/30 hover:bg-wolf-gold/5 hover:text-wolf-gold"
              >
                {t("nav.pricing")}
              </button>
              <button
                onClick={onAuth}
                className="rounded-lg border border-wolf-gold/30 bg-wolf-gold/5 px-4 py-2 text-sm font-semibold text-wolf-gold transition-all hover:bg-wolf-gold/15"
              >
                {t("nav.signIn")}
              </button>
              {onAdminMembers && (
                <button
                  onClick={onAdminMembers}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-gold/30 bg-gradient-to-r from-wolf-gold/15 to-wolf-amber/10 px-3 py-2 text-sm font-semibold text-wolf-gold transition-all hover:border-wolf-gold/60"
                  title="Pack Members (admin)"
                >
                  <Shield size={13} />
                  Admin
                </button>
              )}
            </>
          )}
        </div>

        {/* Right side */}
        <div className="hidden items-center gap-2 md:flex">
          {isInStudio ? (
            /* Studio right side: credits + notifications + wolf hub + home */
            <>
              {/* Credits pill — LYRC-style gold with Zap diamond icon */}
              <button
                onClick={onPricing}
                className="group flex items-center gap-1.5 rounded-full border bg-wolf-gold/5 px-3 py-1.5 transition-all hover:bg-wolf-gold/10"
                style={{ borderColor: "rgba(245,197,24,0.35)" }}
                title="Manage credits"
              >
                <Zap size={12} className="text-wolf-gold fill-wolf-gold" />
                <span className="text-sm font-bold text-wolf-gold">{credits ?? 0}</span>
                <span className="text-[10px] text-wolf-muted group-hover:text-wolf-gold/80">credits</span>
              </button>
              {/* Notification bell with LYRC-style red badge */}
              <button
                onClick={onNotifications}
                className="relative rounded-lg border border-white/10 bg-white/[0.03] p-2 text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
                title="Notifications"
              >
                <Bell size={14} />
                {notifications > 0 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                    style={{ backgroundColor: "#ef4444" }}
                  >
                    {notifications > 99 ? "99+" : notifications}
                  </span>
                )}
              </button>
              <button
                onClick={onWolfMap}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm transition-all hover:border-wolf-gold/30"
                title="Wolf Map"
              >
                <span>🐺</span>
              </button>
              <button
                onClick={onHome}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-wolf-muted transition-all hover:border-wolf-gold/30 hover:text-wolf-gold"
              >
                Exit
              </button>
            </>
          ) : (
            /* Regular right side: language + enter studio */
            <>
              <button
                onClick={() => setReducedMotion(!reducedMotion)}
                title={
                  reducedMotion
                    ? "Animations off — click to turn on"
                    : "Animations on — click to calm them down"
                }
                aria-label={
                  reducedMotion ? "Turn animations on" : "Turn animations off"
                }
                aria-pressed={reducedMotion}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm transition-all ${
                  reducedMotion
                    ? "border-white/10 bg-white/[0.03] text-wolf-muted hover:border-wolf-gold/30"
                    : "border-[#f5c518]/30 bg-[#f5c518]/10 text-[#f5c518] hover:border-[#f5c518]/60"
                }`}
              >
                <Sparkles size={13} />
              </button>
              <div className="relative">
                <button
                  onClick={() => setLangOpen(!langOpen)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm transition-all hover:border-wolf-gold/30"
                >
                  <span>{LANGUAGES.find((l) => l.code === lang)?.flag}</span>
                  <Globe size={13} className="text-wolf-muted" />
                </button>
                <AnimatePresence>
                  {langOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-xl border border-white/[0.06] bg-wolf-card/95 py-1 shadow-xl backdrop-blur-xl"
                    >
                      {LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => { setLang(l.code); setLangOpen(false); }}
                          className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-all hover:bg-wolf-gold/10 ${lang === l.code ? "text-wolf-gold" : "text-white"}`}
                        >
                          <span>{l.flag}</span>
                          <span>{l.label}</span>
                          {lang === l.code && <span className="ml-auto text-wolf-gold">✓</span>}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                onClick={onStudio}
                className="inline-flex items-center gap-2 rounded-lg bg-wolf-gold px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-wolf-amber hover:shadow-lg hover:shadow-wolf-gold/20"
              >
                <Zap size={14} className="fill-black" />
                {t("nav.enterStudio")}
              </button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-wolf-border/20 md:hidden"
          >
            <div className="flex flex-col gap-3 px-6 py-5">
              {isInStudio && onStudioNav ? (
                <>
                  {STUDIO_TOOLS.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => { onStudioNav(tool.id); setMobileOpen(false); }}
                      className="flex items-center gap-2.5 text-left transition-colors"
                      style={{ color: studioView === tool.id ? accent : undefined }}
                    >
                      <tool.icon size={16} className={studioView === tool.id ? "" : "text-wolf-muted"} />
                      <span className={studioView === tool.id ? "font-semibold" : "text-wolf-muted hover:text-white"}>
                        {tool.label}
                      </span>
                    </button>
                  ))}
                  <div className="mt-2 flex items-center gap-3 border-t border-wolf-border/20 pt-3">
                    <Zap size={14} className="text-wolf-gold fill-wolf-gold" />
                    <span className="text-sm font-bold text-wolf-gold">{credits ?? 0} credits</span>
                  </div>
                  <button
                    onClick={() => { onWolfMap(); setMobileOpen(false); }}
                    className="text-left text-wolf-muted transition-colors hover:text-wolf-gold"
                  >
                    🐺 Wolf Hub
                  </button>
                  <button
                    onClick={() => { onHome(); setMobileOpen(false); }}
                    className="text-left text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
                  >
                    ← Exit Studio
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { onHome(); setMobileOpen(false); }} className="text-left text-wolf-muted transition-colors hover:text-wolf-gold">Home</button>
                  <button onClick={() => { onWolfMap(); setMobileOpen(false); }} className="text-left text-wolf-muted transition-colors hover:text-wolf-gold">Wolf Map</button>
                  <button onClick={() => { onWolfHub(); setMobileOpen(false); }} className="text-left font-semibold text-[#c8a4ff] transition-colors hover:text-[#f0a4ff]">🐺 Wolf Hub</button>
                  {onGoldenBoard && (
                    <button onClick={() => { onGoldenBoard(); setMobileOpen(false); }} className="text-left text-wolf-gold transition-colors hover:text-wolf-amber">🏆 Golden Board</button>
                  )}
                  <button onClick={() => { onPricing(); setMobileOpen(false); }} className="text-left text-wolf-muted transition-colors hover:text-wolf-gold">Pricing</button>
                  <button onClick={() => { onAuth(); setMobileOpen(false); }} className="text-left text-wolf-muted transition-colors hover:text-wolf-gold">Sign In</button>
                  {onAdminMembers && (
                    <button onClick={() => { onAdminMembers(); setMobileOpen(false); }} className="text-left font-semibold text-wolf-gold transition-colors hover:text-wolf-amber">🛡️ Admin · Pack Members</button>
                  )}
                  <button
                    onClick={() => { onStudio(); setMobileOpen(false); }}
                    className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-wolf-gold px-5 py-2.5 font-semibold text-black"
                  >
                    <Zap size={14} className="fill-black" />
                    Enter Studio
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
