import { useState, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { ArrowLeft, X, Heart, Zap, MessageSquare, Send, Users, Trash2, ChevronRight } from "lucide-react";

interface SwipeProfile {
  id: number;
  name: string;
  genre: string;
  country: string;
  avatar: string;
  color: string;
  flowLike: string;
  lookingFor: string;
  howl: string;
}

interface Match {
  profile: SwipeProfile;
  messages: { from: string; text: string; time: string }[];
  matchedAt: string;
}

const opponents: SwipeProfile[] = [
  {
    id: 1, name: "Shadow MC", genre: "Drill", country: "UK",
    avatar: "/wolf-black.svg", color: "#888",
    flowLike: "UK drill meets dark storytelling, think Headie One with a twist",
    lookingFor: "A melodic hook writer who can ride any beat",
    howl: "Shadows in the city, we move like ghosts / Every bar I spit hits harder than most",
  },
  {
    id: 2, name: "Luna Beats", genre: "Lo-Fi", country: "France",
    avatar: "/wolf-purple.svg", color: "#9b6dff",
    flowLike: "Chill vibes with deep lyrics, like a midnight conversation",
    lookingFor: "Someone who can sing over lo-fi beats with real emotion",
    howl: "Sous la lune on se retrouve / Les etoiles guident nos preuves",
  },
  {
    id: 3, name: "Blaze", genre: "Trap", country: "USA",
    avatar: "/wolf-red.svg", color: "#E53935",
    flowLike: "Hard-hitting trap with melodic switches, Future meets Travis",
    lookingFor: "A wolf who can produce fire beats and isn't afraid to go crazy",
    howl: "Set the track on fire, watch the whole world burn / Every lesson in the struggle, every dollar that I earn",
  },
  {
    id: 4, name: "Amara Gold", genre: "Afrobeats", country: "Nigeria",
    avatar: "/wolf-orange.svg", color: "#ff9500",
    flowLike: "Afrobeats energy with soulful melodies, Wizkid vibes",
    lookingFor: "Someone to create a cross-continental hit with",
    howl: "From Lagos to Brussels, the rhythm connects / Golden wolves united, earning respect",
  },
  {
    id: 5, name: "Frost", genre: "Hip-Hop", country: "Belgium",
    avatar: "/wolf-blue.svg", color: "#82b1ff",
    flowLike: "Conscious hip-hop with hard-hitting punchlines",
    lookingFor: "A producer who understands the European sound",
    howl: "Ice in my veins but fire in my soul / Lightning Wolves forever, that's the goal",
  },
  {
    id: 6, name: "Neon Vox", genre: "Electronic", country: "Germany",
    avatar: "/wolf-green.svg", color: "#69f0ae",
    flowLike: "Electronic beats with live vocals, think Flume meets The Weeknd",
    lookingFor: "A vocalist who isn't afraid to experiment with sound design",
    howl: "Neon lights flash, bass drops low / Every frequency hitting, stealing the show",
  },
  {
    id: 7, name: "Queenie", genre: "R&B", country: "Ghana",
    avatar: "/wolf-pink.svg", color: "#E040FB",
    flowLike: "Smooth R&B with Afro fusion, Tems meets SZA energy",
    lookingFor: "A rapper to feature on my next single, someone with real bars",
    howl: "Crown on my head, melody in my soul / Every note I sing making hearts feel whole",
  },
];

interface Props {
  onBack: () => void;
  territory?: string;
  userProfile?: { name: string; photo: string; genre: string };
}

export default function VersusPage({ onBack, territory, userProfile }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const [showMatchAnim, setShowMatchAnim] = useState<SwipeProfile | null>(null);
  const [superHowled, setSuperHowled] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [confirmUnmatch, setConfirmUnmatch] = useState<number | null>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const howlOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);

  const current = opponents[currentIndex % opponents.length];
  const isOutOfCards = currentIndex >= opponents.length;

  const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleSwipe = useCallback(
    (dir: "left" | "right") => {
      setDirection(dir);
      setTimeout(() => {
        if (dir === "right" && Math.random() > 0.35) {
          // Match!
          setShowMatchAnim(current);
        }
        setCurrentIndex((i) => i + 1);
        setDirection(null);
        setSuperHowled(false);
        x.set(0);
      }, 400);
    },
    [current, x]
  );

  const handleMatchAction = useCallback(
    (action: "chat" | "keep") => {
      if (!showMatchAnim) return;
      const newMatch: Match = {
        profile: showMatchAnim,
        matchedAt: new Date().toLocaleDateString(),
        messages: [
          { from: "system", text: `You and ${showMatchAnim.name} are now connected!`, time: now() },
          { from: showMatchAnim.name, text: `Yo ${userProfile?.name || "Wolf"}! Love your sound. Let's create something 🐺⚡`, time: now() },
        ],
      };
      setMatches((prev) => [newMatch, ...prev]);

      if (action === "chat") {
        setActiveMatch(newMatch);
        setShowMatches(true);
      }
      setShowMatchAnim(null);
    },
    [showMatchAnim, userProfile]
  );

  const handleSuperHowl = () => {
    setSuperHowled(true);
    setTimeout(() => handleSwipe("right"), 600);
  };

  const sendChat = () => {
    if (!chatInput.trim() || !activeMatch) return;
    const msg = { from: "You", text: chatInput, time: now() };
    setActiveMatch((m) => m ? { ...m, messages: [...m.messages, msg] } : m);
    setMatches((prev) =>
      prev.map((m) =>
        m.profile.id === activeMatch.profile.id
          ? { ...m, messages: [...m.messages, msg] }
          : m
      )
    );
    setChatInput("");

    // Simulate reply
    setTimeout(() => {
      const reply = { from: activeMatch.profile.name, text: getAutoReply(), time: now() };
      setActiveMatch((m) => m ? { ...m, messages: [...m.messages, reply] } : m);
      setMatches((prev) =>
        prev.map((m) =>
          m.profile.id === activeMatch.profile.id
            ? { ...m, messages: [...m.messages, reply] }
            : m
        )
      );
    }, 1500);
  };

  const getAutoReply = () => {
    const replies = [
      "That sounds fire! When do you want to link up? 🔥",
      "I'm down! Let me send you some beats to check out 🎵",
      "Yo this could be something special fr 🐺",
      "Let's set up a session this week! 💪",
      "I've been working on something that would fit your style perfectly",
      "Say less! I'll send you a demo tonight 🎤",
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  };

  const handleUnmatch = (profileId: number) => {
    setMatches((prev) => prev.filter((m) => m.profile.id !== profileId));
    if (activeMatch?.profile.id === profileId) setActiveMatch(null);
    setConfirmUnmatch(null);
  };

  // ── Match Animation ──
  if (showMatchAnim) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-wolf-bg">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0, 1, 0] }}
          transition={{ duration: 0.8, times: [0, 0.1, 0.2, 0.3, 1] }}
          className="pointer-events-none absolute inset-0 bg-wolf-gold/10"
        />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="relative z-10 text-center px-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.8 }}>
            <Zap size={60} className="mx-auto text-wolf-gold" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="mt-4 text-3xl font-bold tracking-wider text-white sm:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            PACK <span className="bg-gradient-to-r from-purple-400 via-wolf-gold to-pink-400 bg-clip-text text-transparent">UNITED!</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-3 text-wolf-muted">
            You and <span className="font-semibold text-white">{showMatchAnim.name}</span> are now connected
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="mt-8 flex flex-col items-center gap-3">
            <button onClick={() => handleMatchAction("chat")} className="rounded-xl bg-gradient-to-r from-purple-500 via-wolf-gold to-pink-500 px-8 py-3 font-bold text-black">
              <MessageSquare size={16} className="mr-2 inline" />Start Collaboration
            </button>
            <button onClick={() => handleMatchAction("keep")} className="text-sm text-wolf-muted hover:text-white">
              Keep Swiping
            </button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Matches List / Chat View ──
  if (showMatches) {
    return (
      <div className="min-h-screen pt-20">
        <div className="mx-auto max-w-lg px-6 pb-24">
          <button onClick={() => { setShowMatches(false); setActiveMatch(null); }}
            className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted hover:text-wolf-gold">
            <ArrowLeft size={16} /> Back to Swiping
          </button>

          {activeMatch ? (
            /* ── Chat View ── */
            <div>
              {/* Chat header */}
              <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-lg">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2"
                      style={{ borderColor: `${activeMatch.profile.color}40`, background: `${activeMatch.profile.color}10` }}>
                      <img src={activeMatch.profile.avatar} alt="" className="h-7 w-7" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-wolf-card bg-green-500" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>{activeMatch.profile.name}</h2>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: `${activeMatch.profile.color}15`, color: activeMatch.profile.color }}>
                        {activeMatch.profile.genre}
                      </span>
                      <span className="text-[10px] text-wolf-muted">{activeMatch.profile.country}</span>
                    </div>
                  </div>
                  <button onClick={() => setConfirmUnmatch(activeMatch.profile.id)}
                    className="rounded-lg p-2 text-wolf-muted/40 transition-all hover:bg-red-500/10 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                  <button onClick={() => setActiveMatch(null)}
                    className="rounded-lg p-2 text-wolf-muted/40 transition-all hover:bg-white/5 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Unmatch confirmation */}
              {confirmUnmatch === activeMatch.profile.id && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
                  <p className="mb-3 text-sm text-red-400">Unmatch {activeMatch.profile.name}? This can't be undone.</p>
                  <div className="flex justify-center gap-3">
                    <button onClick={() => handleUnmatch(activeMatch.profile.id)}
                      className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white">Unmatch</button>
                    <button onClick={() => setConfirmUnmatch(null)}
                      className="rounded-lg border border-wolf-border/30 px-4 py-2 text-sm text-wolf-muted">Cancel</button>
                  </div>
                </motion.div>
              )}

              {/* Messages */}
              <div className="mb-4 flex h-[400px] flex-col gap-3 overflow-y-auto rounded-2xl border border-white/[0.04] bg-wolf-surface/30 p-5">
                {activeMatch.messages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.from === "You" ? "justify-end" : msg.from === "system" ? "justify-center" : "justify-start"}`}>
                    {msg.from === "system" ? (
                      <span className="rounded-full bg-wolf-gold/10 px-4 py-1.5 text-[10px] font-medium text-wolf-gold">{msg.text}</span>
                    ) : (
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        msg.from === "You"
                          ? "rounded-br-md bg-wolf-gold text-black"
                          : "rounded-bl-md border border-white/[0.06] bg-white/[0.04] text-white"
                      }`}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        <p className={`mt-1 text-[9px] ${msg.from === "You" ? "text-black/40" : "text-wolf-muted/50"}`}>{msg.time}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Chat input */}
              <div className="flex gap-2">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-2xl border border-purple-500/15 bg-white/[0.03] px-5 py-3.5 text-sm text-white placeholder:text-wolf-muted/40 focus:border-purple-500/30 focus:outline-none" />
                <button onClick={sendChat}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-purple-500 to-wolf-gold text-black transition-all hover:opacity-90">
                  <Send size={16} />
                </button>
              </div>
            </div>
          ) : (
            /* ── Matches List ── */
            <div>
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold tracking-wider text-white" style={{ fontFamily: "var(--font-heading)" }}>
                  YOUR <span className="bg-gradient-to-r from-purple-400 via-wolf-gold to-pink-400 bg-clip-text text-transparent">MATCHES</span>
                </h2>
                <p className="mt-1 text-sm text-wolf-muted">{matches.length} {matches.length === 1 ? "connection" : "connections"}</p>
              </div>

              {matches.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-16 text-center backdrop-blur-lg">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-wolf-gold/5">
                    <Users size={28} className="text-wolf-muted/30" />
                  </div>
                  <p className="text-lg font-semibold text-white">No matches yet</p>
                  <p className="mt-2 text-sm text-wolf-muted">Keep swiping to find your pack!</p>
                  <button onClick={() => setShowMatches(false)}
                    className="mt-6 rounded-xl bg-wolf-gold px-6 py-2.5 text-sm font-bold text-black">
                    Start Swiping
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {matches.map((match, i) => (
                    <motion.div
                      key={match.profile.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <button
                        onClick={() => setActiveMatch(match)}
                        className="group flex w-full items-center gap-4 rounded-2xl border border-purple-500/10 bg-gradient-to-r from-purple-500/[0.03] to-transparent p-4 text-left transition-all hover:border-purple-500/25 hover:from-purple-500/[0.06]"
                      >
                        {/* Avatar with online dot */}
                        <div className="relative">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2"
                            style={{ borderColor: `${match.profile.color}30`, background: `${match.profile.color}10` }}>
                            <img src={match.profile.avatar} alt="" className="h-8 w-8" />
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-wolf-bg bg-green-500" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                              {match.profile.name}
                            </h3>
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-medium"
                              style={{ backgroundColor: `${match.profile.color}12`, color: match.profile.color }}>
                              {match.profile.genre}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-wolf-muted">
                            {match.messages[match.messages.length - 1]?.text}
                          </p>
                        </div>

                        {/* Right side */}
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-wolf-muted/50">{match.matchedAt}</span>
                          <div className="flex items-center gap-1">
                            <Zap size={10} className="text-wolf-gold" />
                            <span className="text-[10px] text-wolf-gold">Matched</span>
                          </div>
                        </div>

                        {/* Hover arrow */}
                        <ChevronRight size={16} className="text-wolf-muted/20 transition-all group-hover:text-wolf-gold" />
                      </button>

                      {/* Long press / swipe unmatch */}
                      <div className="mt-1 flex justify-end px-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmUnmatch(match.profile.id); }}
                          className="text-[10px] text-wolf-muted/30 transition-all hover:text-red-400"
                        >
                          Unmatch
                        </button>
                      </div>

                      {confirmUnmatch === match.profile.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                          className="mt-1 overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
                          <p className="mb-3 text-sm text-red-400">Unmatch {match.profile.name}?</p>
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleUnmatch(match.profile.id)}
                              className="rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white">Unmatch</button>
                            <button onClick={() => setConfirmUnmatch(null)}
                              className="rounded-lg border border-wolf-border/30 px-4 py-2 text-xs text-wolf-muted">Cancel</button>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main Swipe View ──
  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-lg px-6 pb-24">
        <div className="mb-4 flex items-center justify-between">
          <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            onClick={onBack} className="inline-flex items-center gap-2 text-sm text-wolf-muted hover:text-wolf-gold">
            <ArrowLeft size={16} /> Back
          </motion.button>

          {/* Matches button */}
          <motion.button
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            onClick={() => setShowMatches(true)}
            className="relative inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/5 px-4 py-2 text-sm text-purple-300 transition-all hover:border-purple-400/50 hover:text-purple-200"
          >
            <MessageSquare size={14} />
            Matches
            {matches.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-wolf-gold text-[10px] font-bold text-black">
                {matches.length}
              </span>
            )}
          </motion.button>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-wider text-white sm:text-3xl" style={{ fontFamily: "var(--font-heading)" }}>
            VERSUS <span className="bg-gradient-to-r from-purple-400 via-wolf-gold to-pink-400 bg-clip-text text-transparent">SWIPE</span>
          </h1>
          {territory && <p className="mt-1 text-xs uppercase tracking-wider text-wolf-muted">Scouting in {territory}</p>}
        </motion.div>

        {isOutOfCards ? (
          /* Out of cards */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-wolf-border/20 bg-wolf-card p-12 text-center">
            <Users size={40} className="mx-auto mb-4 text-wolf-muted/30" />
            <h3 className="text-lg font-bold text-white">No more wolves nearby</h3>
            <p className="mt-2 text-sm text-wolf-muted">Check back later or explore other territories</p>
            {matches.length > 0 && (
              <button onClick={() => setShowMatches(true)}
                className="mt-6 rounded-xl bg-wolf-gold px-6 py-3 font-bold text-black">
                View Your Matches ({matches.length})
              </button>
            )}
            <button onClick={() => setCurrentIndex(0)} className="mt-3 block w-full text-sm text-wolf-muted hover:text-wolf-gold">
              Reset & Swipe Again
            </button>
          </motion.div>
        ) : (
          <>
            {/* Swipe card */}
            <div className="relative mx-auto h-[460px] sm:h-[500px]">
              <AnimatePresence>
                <motion.div
                  key={current.id + currentIndex}
                  style={{ x, rotate }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 100) handleSwipe("right");
                    else if (info.offset.x < -100) handleSwipe("left");
                    else x.set(0);
                  }}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{
                    scale: 1, opacity: 1,
                    x: direction === "left" ? -300 : direction === "right" ? 300 : 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: direction ? 0.3 : 0.5 }}
                  className="absolute inset-0 cursor-grab overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-b from-purple-500/5 to-wolf-card active:cursor-grabbing"
                >
                  {/* HOWL / PASS overlays */}
                  <motion.div style={{ opacity: howlOpacity }}
                    className="absolute top-6 left-6 z-10 rotate-[-15deg] rounded-lg border-2 border-green-400 px-4 py-2 text-2xl font-black text-green-400">
                    HOWL 🐺
                  </motion.div>
                  <motion.div style={{ opacity: passOpacity }}
                    className="absolute top-6 right-6 z-10 rotate-[15deg] rounded-lg border-2 border-red-400 px-4 py-2 text-2xl font-black text-red-400">
                    PASS
                  </motion.div>

                  {superHowled && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }}
                      className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-wolf-gold/20">
                      <span className="text-3xl font-black text-wolf-gold">⚡ SUPER HOWL ⚡</span>
                    </motion.div>
                  )}

                  <div className="flex h-full flex-col p-6">
                    {/* Top: avatar + info */}
                    <div className="flex flex-col items-center">
                      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full"
                        style={{ background: `radial-gradient(circle, ${current.color}20, transparent)` }}>
                        <img src={current.avatar} alt="" className="h-10 w-10" />
                      </div>
                      <h3 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                        {current.name}
                      </h3>
                      <span className="mt-1 rounded-full px-3 py-0.5 text-xs"
                        style={{ backgroundColor: `${current.color}15`, color: current.color }}>
                        {current.genre} · {current.country}
                      </span>
                    </div>

                    {/* Prompts */}
                    <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
                      <div className="rounded-xl border border-wolf-border/15 bg-wolf-surface/50 p-3">
                        <p className="mb-0.5 text-[10px] font-semibold text-wolf-muted">🎤 My flow is like...</p>
                        <p className="text-sm text-white">{current.flowLike}</p>
                      </div>
                      <div className="rounded-xl border border-wolf-border/15 bg-wolf-surface/50 p-3">
                        <p className="mb-0.5 text-[10px] font-semibold text-wolf-muted">🐺 Looking for a wolf who...</p>
                        <p className="text-sm text-white">{current.lookingFor}</p>
                      </div>
                      <div className="rounded-xl border border-wolf-gold/15 bg-wolf-gold/5 p-3">
                        <p className="mb-0.5 text-[10px] font-semibold text-wolf-gold">▶️ The Howl</p>
                        <p className="text-sm italic text-wolf-gold/80">&ldquo;{current.howl}&rdquo;</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex items-center justify-center gap-5">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => handleSwipe("left")}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20">
                <X size={24} />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={handleSuperHowl}
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/10 to-wolf-gold/10 text-wolf-gold hover:from-purple-500/20 hover:to-wolf-gold/20">
                <Zap size={28} className="fill-wolf-gold" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => handleSwipe("right")}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20">
                <Heart size={24} />
              </motion.button>
            </div>
            <div className="mt-3 flex justify-center gap-8 text-[10px] uppercase tracking-wider text-wolf-muted">
              <span>Pass</span>
              <span className="text-wolf-gold">Super Howl</span>
              <span>Howl</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
