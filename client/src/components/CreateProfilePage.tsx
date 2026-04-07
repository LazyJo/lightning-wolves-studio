import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  User,
  Music,
  Mic,
  Zap,
  CheckCircle,
  Globe,
  Sparkles,
} from "lucide-react";

interface ProfileData {
  photo: string;
  name: string;
  genre: string;
  country: string;
  flowLike: string;
  lookingFor: string;
  howl: string;
}

interface Props {
  onBack: () => void;
  onComplete: (profile: ProfileData) => void;
}

export default function CreateProfilePage({ onBack, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<ProfileData>({
    photo: "",
    name: "",
    genre: "",
    country: "",
    flowLike: "",
    lookingFor: "",
    howl: "",
  });
  const [unlocking, setUnlocking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (field: keyof ProfileData, value: string) =>
    setProfile((p) => ({ ...p, [field]: value }));

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) update("photo", URL.createObjectURL(f));
  };

  const canProceed = () => {
    if (step === 0) return !!profile.photo && !!profile.name && !!profile.genre && !!profile.country;
    if (step === 1) return !!profile.flowLike && !!profile.lookingFor;
    if (step === 2) return !!profile.howl;
    return false;
  };

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
    else {
      // Unlock animation
      setUnlocking(true);
      setTimeout(() => onComplete(profile), 2500);
    }
  };

  const steps = [
    { label: "Profile", icon: User },
    { label: "Prompts", icon: Mic },
    { label: "The Howl", icon: Music },
  ];

  if (unlocking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-wolf-bg">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.5, 1], opacity: 1 }}
          transition={{ duration: 1.5, times: [0, 0.6, 1] }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 1, ease: "easeInOut" }}
          >
            <Zap size={80} className="mx-auto text-wolf-gold" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-3xl font-bold tracking-wider text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            YOU&apos;RE IN THE{" "}
            <span className="text-wolf-gold">PACK</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-3 text-wolf-muted"
          >
            Welcome, {profile.name}. Time to find your match.
          </motion.p>
        </motion.div>

        {/* Lightning flash */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="absolute inset-0 bg-wolf-gold/20"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center pt-20 pb-20">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_30%,_rgba(245,197,24,0.04),_transparent_60%)]" />

      <div className="relative z-10 w-full max-w-lg px-6">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={step > 0 ? () => setStep(step - 1) : onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          {step > 0 ? "Back" : "Cancel"}
        </motion.button>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm transition-all ${
                  i < step
                    ? "border-transparent bg-wolf-gold text-black"
                    : i === step
                      ? "border-wolf-gold bg-wolf-gold/10 text-wolf-gold"
                      : "border-wolf-border/30 text-wolf-muted"
                }`}
              >
                {i < step ? <CheckCircle size={16} /> : <s.icon size={16} />}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-8 rounded ${
                    i < step ? "bg-wolf-gold" : "bg-wolf-border/20"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Photo + Name */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="rounded-2xl border border-wolf-border/30 bg-wolf-card p-8"
            >
              <h2
                className="mb-2 text-center text-2xl font-bold tracking-wider text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                CREATE YOUR{" "}
                <span className="text-wolf-gold">PROFILE</span>
              </h2>
              <p className="mb-8 text-center text-sm text-wolf-muted">
                Show the pack who you are
              </p>

              {/* Photo upload */}
              <div className="mb-6 flex justify-center">
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="group relative h-28 w-28 overflow-hidden rounded-full border-2 border-dashed border-wolf-border/40 transition-all hover:border-wolf-gold/50"
                >
                  {profile.photo ? (
                    <img src={profile.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-wolf-surface">
                      <Camera size={24} className="text-wolf-muted group-hover:text-wolf-gold" />
                      <span className="mt-1 text-[10px] text-wolf-muted">Add Photo</span>
                    </div>
                  )}
                </button>
              </div>

              {/* Name */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  Artist Name *
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-muted" />
                  <input
                    value={profile.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Your stage name"
                    className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                  />
                </div>
              </div>

              {/* Genre */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  Genre *
                </label>
                <select
                  value={profile.genre}
                  onChange={(e) => update("genre", e.target.value)}
                  className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface px-4 py-3 text-white focus:border-wolf-gold/40 focus:outline-none"
                >
                  <option value="">Select genre</option>
                  {["Hip-Hop", "R&B", "Pop", "French Hip-Hop", "Afrobeats", "Drill", "Trap", "Lo-Fi", "Rock", "Electronic", "Producer"].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Country */}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  Country *
                </label>
                <div className="relative">
                  <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-muted" />
                  <input
                    value={profile.country}
                    onChange={(e) => update("country", e.target.value)}
                    placeholder="Belgium, France, Ghana..."
                    className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Hinge-style Prompts */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="rounded-2xl border border-wolf-border/30 bg-wolf-card p-8"
            >
              <h2
                className="mb-2 text-center text-2xl font-bold tracking-wider text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                WOLF{" "}
                <span className="text-wolf-gold">PROMPTS</span>
              </h2>
              <p className="mb-8 text-center text-sm text-wolf-muted">
                Let other wolves know your vibe
              </p>

              {/* Flow prompt */}
              <div className="mb-6">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="text-lg">🎤</span> My flow is like...
                </label>
                <textarea
                  value={profile.flowLike}
                  onChange={(e) => update("flowLike", e.target.value)}
                  placeholder="Drake meets Burna Boy with a Brussels twist..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-wolf-border/30 bg-wolf-surface p-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                />
              </div>

              {/* Looking for prompt */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="text-lg">🐺</span> I&apos;m looking for a wolf who...
                </label>
                <textarea
                  value={profile.lookingFor}
                  onChange={(e) => update("lookingFor", e.target.value)}
                  placeholder="Can bring hard-hitting beats and isn't afraid to experiment..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-wolf-border/30 bg-wolf-surface p-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                />
              </div>
            </motion.div>
          )}

          {/* Step 3: The Howl */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="rounded-2xl border border-wolf-border/30 bg-wolf-card p-8"
            >
              <h2
                className="mb-2 text-center text-2xl font-bold tracking-wider text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                THE{" "}
                <span className="text-wolf-gold">HOWL</span>
              </h2>
              <p className="mb-8 text-center text-sm text-wolf-muted">
                Drop your hardest bar. This is what other wolves hear first.
              </p>

              <div className="mb-4 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-wolf-gold/30 bg-wolf-gold/5">
                  <Sparkles size={32} className="text-wolf-gold" />
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <span>▶️</span> Your best lyric snippet
                </label>
                <textarea
                  value={profile.howl}
                  onChange={(e) => update("howl", e.target.value)}
                  placeholder="Lightning in my veins, wolves don't run in vain / Every mic I touch turns into gold and flame..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-wolf-gold/20 bg-wolf-gold/5 p-4 text-wolf-gold placeholder:text-wolf-gold/30 focus:border-wolf-gold/40 focus:outline-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handleNext}
          disabled={!canProceed()}
          className={`mt-6 w-full rounded-xl py-3.5 font-bold tracking-wider transition-all ${
            canProceed()
              ? "bg-wolf-gold text-black hover:bg-wolf-amber"
              : "cursor-not-allowed bg-wolf-border/30 text-wolf-muted"
          }`}
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {step === 2 ? (
            <><Zap size={16} className="mr-2 inline" />ENTER THE PACK</>
          ) : (
            <>CONTINUE <ArrowRight size={16} className="ml-2 inline" /></>
          )}
        </motion.button>
      </div>
    </div>
  );
}
