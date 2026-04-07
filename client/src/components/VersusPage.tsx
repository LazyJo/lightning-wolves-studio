import { useState, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { ArrowLeft, X, Heart, Zap, MessageSquare, Send } from "lucide-react";

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

// Demo opponents for swiping
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
];

interface Props {
  onBack: () => void;
  territory?: string;
  userProfile?: { name: string; photo: string; genre: string };
}

export default function VersusPage({ onBack, territory, userProfile }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matched, setMatched] = useState<SwipeProfile | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [superHowled, setSuperHowled] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const howlOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);

  const current = opponents[currentIndex % opponents.length];

  const handleSwipe = useCallback(
    (dir: "left" | "right") => {
      setDirection(dir);
      setTimeout(() => {
        if (dir === "right" && Math.random() > 0.4) {
          setMatched(current);
          setChatMessages([
            { from: "system", text: `You and ${current.name} are now connected! Start collaborating.` },
            { from: current.name, text: `Yo ${userProfile?.name || "Wolf"}! Love your sound. Let's create something together 🐺⚡` },
          ]);
        }
        setCurrentIndex((i) => i + 1);
        setDirection(null);
        setSuperHowled(false);
      }, 400);
    },
    [current, userProfile]
  );

  const handleSuperHowl = () => {
    setSuperHowled(true);
    setTimeout(() => handleSwipe("right"), 600);
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [...prev, { from: "You", text: chatInput }]);
    setChatInput("");
    // Simulate reply
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        { from: matched?.name || "Wolf", text: "That sounds fire! When do you want to link up? 🔥" },
      ]);
    }, 1500);
  };

  // Match animation
  if (matched && !showChat) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-wolf-bg">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center px-6"
        >
          {/* Lightning flash */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0, 1, 0] }}
            transition={{ duration: 1, times: [0, 0.1, 0.2, 0.3, 1] }}
            className="absolute inset-0 bg-wolf-gold/10"
          />

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ duration: 0.8 }}
          >
            <Zap size={60} className="mx-auto text-wolf-gold" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-3xl font-bold tracking-wider text-white sm:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            PACK{" "}
            <span className="text-wolf-gold">UNITED!</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-3 text-wolf-muted"
          >
            You and <span className="text-white font-semibold">{matched.name}</span> are now connected
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-8 flex flex-col items-center gap-3"
          >
            <button
              onClick={() => setShowChat(true)}
              className="rounded-xl bg-wolf-gold px-8 py-3 font-bold text-black"
            >
              <MessageSquare size={16} className="mr-2 inline" />
              Start Collaboration
            </button>
            <button
              onClick={() => { setMatched(null); }}
              className="text-sm text-wolf-muted hover:text-white"
            >
              Keep Swiping
            </button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Pack Chat
  if (showChat && matched) {
    return (
      <div className="min-h-screen pt-20">
        <div className="mx-auto max-w-lg px-6 pb-24">
          <button
            onClick={() => { setShowChat(false); setMatched(null); }}
            className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted hover:text-wolf-gold"
          >
            <ArrowLeft size={16} /> Back to Swiping
          </button>

          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-wolf-surface">
              <img src={matched.avatar} alt="" className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-bold text-white">{matched.name}</h2>
              <span className="text-xs text-wolf-muted">{matched.genre} · {matched.country}</span>
            </div>
          </div>

          {/* Chat window */}
          <div className="mb-4 h-[400px] overflow-y-auto rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-lg">
            {chatMessages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-3 ${msg.from === "You" ? "text-right" : msg.from === "system" ? "text-center" : "text-left"}`}
              >
                {msg.from === "system" ? (
                  <span className="inline-block rounded-full bg-wolf-gold/10 px-3 py-1 text-xs text-wolf-gold">{msg.text}</span>
                ) : (
                  <div className={`inline-block max-w-[80%] rounded-2xl px-4 py-2.5 ${msg.from === "You" ? "bg-wolf-gold text-black" : "bg-wolf-surface text-white"}`}>
                    <p className="text-[10px] font-semibold opacity-60 mb-0.5">{msg.from}</p>
                    <p className="text-sm">{msg.text}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Chat input */}
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Start the collab..."
              className="flex-1 rounded-xl border border-wolf-border/30 bg-wolf-card px-4 py-3 text-sm text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
            />
            <button
              onClick={sendChat}
              className="rounded-xl bg-wolf-gold px-4 py-3 text-black"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main swipe view
  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-lg px-6 pb-24">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm text-wolf-muted hover:text-wolf-gold"
        >
          <ArrowLeft size={16} /> Back to Wolf Map
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <h1
            className="text-2xl font-bold tracking-wider text-white sm:text-3xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            VERSUS{" "}
            <span className="text-wolf-gold">SWIPE</span>
          </h1>
          {territory && (
            <p className="mt-1 text-xs uppercase tracking-wider text-wolf-muted">
              Scouting in {territory}
            </p>
          )}
        </motion.div>

        {/* Swipe card */}
        <div className="relative mx-auto h-[480px] sm:h-[520px]">
          <AnimatePresence>
            <motion.div
              key={current.id + currentIndex}
              style={{ x, rotate }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 100) handleSwipe("right");
                else if (info.offset.x < -100) handleSwipe("left");
              }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                x: direction === "left" ? -300 : direction === "right" ? 300 : 0,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: direction ? 0.3 : 0.5 }}
              className="absolute inset-0 cursor-grab rounded-3xl border border-wolf-border/20 bg-wolf-card p-6 active:cursor-grabbing"
            >
              {/* HOWL / PASS overlays */}
              <motion.div
                style={{ opacity: howlOpacity }}
                className="absolute top-6 left-6 z-10 rotate-[-15deg] rounded-lg border-3 border-green-400 px-4 py-2 text-2xl font-black text-green-400"
              >
                HOWL 🐺
              </motion.div>
              <motion.div
                style={{ opacity: passOpacity }}
                className="absolute top-6 right-6 z-10 rotate-[15deg] rounded-lg border-3 border-red-400 px-4 py-2 text-2xl font-black text-red-400"
              >
                PASS
              </motion.div>

              {/* Super Howl flash */}
              {superHowled && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-wolf-gold/20"
                >
                  <span className="text-3xl font-black text-wolf-gold">⚡ SUPER HOWL ⚡</span>
                </motion.div>
              )}

              {/* Card content */}
              <div className="flex flex-col items-center">
                {/* Avatar */}
                <div
                  className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ background: `radial-gradient(circle, ${current.color}20, transparent)` }}
                >
                  <img src={current.avatar} alt="" className="h-12 w-12" />
                </div>

                <h3
                  className="text-xl font-bold text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {current.name}
                </h3>
                <span className="mt-1 rounded-full px-3 py-0.5 text-xs" style={{ backgroundColor: `${current.color}15`, color: current.color }}>
                  {current.genre} · {current.country}
                </span>
              </div>

              {/* Prompts */}
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-wolf-border/15 bg-wolf-surface/50 p-4">
                  <p className="mb-1 text-xs font-semibold text-wolf-muted">🎤 My flow is like...</p>
                  <p className="text-sm text-white">{current.flowLike}</p>
                </div>
                <div className="rounded-xl border border-wolf-border/15 bg-wolf-surface/50 p-4">
                  <p className="mb-1 text-xs font-semibold text-wolf-muted">🐺 Looking for a wolf who...</p>
                  <p className="text-sm text-white">{current.lookingFor}</p>
                </div>
                <div className="rounded-xl border border-wolf-gold/15 bg-wolf-gold/5 p-4">
                  <p className="mb-1 text-xs font-semibold text-wolf-gold">▶️ The Howl</p>
                  <p className="text-sm italic text-wolf-gold/80">&ldquo;{current.howl}&rdquo;</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex items-center justify-center gap-5">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSwipe("left")}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-500/30 bg-red-500/10 text-red-400 transition-all hover:bg-red-500/20"
          >
            <X size={24} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSuperHowl}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-wolf-gold/40 bg-wolf-gold/10 text-wolf-gold transition-all hover:bg-wolf-gold/20"
          >
            <Zap size={28} className="fill-wolf-gold" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSwipe("right")}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-500/30 bg-green-500/10 text-green-400 transition-all hover:bg-green-500/20"
          >
            <Heart size={24} />
          </motion.button>
        </div>

        <div className="mt-3 flex justify-center gap-8 text-[10px] uppercase tracking-wider text-wolf-muted">
          <span>Pass</span>
          <span className="text-wolf-gold">Super Howl</span>
          <span>Howl</span>
        </div>
      </div>
    </div>
  );
}
