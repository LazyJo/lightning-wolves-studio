import { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Zap,
  User,
  Mail,
  Music,
  Globe,
  Instagram,
  Link,
  MessageSquare,
  CheckCircle,
} from "lucide-react";

interface Props {
  onBack: () => void;
}

export default function JoinPackPage({ onBack }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    artistName: "",
    genre: "",
    country: "",
    instagram: "",
    spotify: "",
    youtube: "",
    bio: "",
    whyJoin: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 2000));
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md px-6 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-wolf-gold/10"
          >
            <CheckCircle size={40} className="text-wolf-gold" />
          </motion.div>
          <h1
            className="mb-4 text-3xl font-bold tracking-wider text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            APPLICATION{" "}
            <span className="text-wolf-gold">RECEIVED</span>
          </h1>
          <p className="mb-8 text-wolf-muted">
            Thanks {form.artistName || form.name}! We&apos;ll review your
            application and get back to you soon. Keep creating.
          </p>
          <button
            onClick={onBack}
            className="rounded-lg bg-wolf-gold px-8 py-3 font-semibold text-black transition-all hover:bg-wolf-amber"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20">
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(245,197,24,0.04), transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-2xl px-6 pb-24">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <img
            src="/LightningWolfYellowTransparentBG.png"
            alt="Lightning Wolves"
            className="mx-auto mb-4 h-20 w-20"
          />
          <h1
            className="text-3xl font-bold tracking-wider text-white md:text-4xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            JOIN THE{" "}
            <span className="text-wolf-gold">PACK</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-wolf-muted">
            Apply to become a Lightning Wolf. Show us who you are, what you
            create, and why you belong in the pack.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-wolf-border/30 bg-wolf-card p-8"
        >
          {/* Personal info */}
          <div>
            <h3
              className="mb-4 text-lg text-wolf-gold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              About You
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  Full Name *
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-muted"
                  />
                  <input
                    required
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  Artist Name *
                </label>
                <div className="relative">
                  <Music
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-muted"
                  />
                  <input
                    required
                    value={form.artistName}
                    onChange={(e) => update("artistName", e.target.value)}
                    placeholder="Your stage name"
                    className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                Email *
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-muted"
                />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                Country *
              </label>
              <div className="relative">
                <Globe
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-muted"
                />
                <input
                  required
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  placeholder="Belgium, France, Ghana..."
                  className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
              Genre *
            </label>
            <select
              required
              value={form.genre}
              onChange={(e) => update("genre", e.target.value)}
              className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 px-4 text-white focus:border-wolf-gold/40 focus:outline-none"
            >
              <option value="">Select your genre</option>
              <option>Hip-Hop</option>
              <option>R&B</option>
              <option>Pop</option>
              <option>French Hip-Hop</option>
              <option>Afrobeats</option>
              <option>Drill</option>
              <option>Trap</option>
              <option>Lo-Fi</option>
              <option>Rock</option>
              <option>Electronic</option>
              <option>Producer / Beatmaker</option>
              <option>Visual Artist / Designer</option>
              <option>Videographer / Photographer</option>
              <option>Other</option>
            </select>
          </div>

          {/* Socials */}
          <div>
            <h3
              className="mb-4 text-lg text-wolf-gold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Your Music
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  Instagram
                </label>
                <div className="relative">
                  <Instagram
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-muted"
                  />
                  <input
                    value={form.instagram}
                    onChange={(e) => update("instagram", e.target.value)}
                    placeholder="@yourhandle"
                    className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  Spotify
                </label>
                <div className="relative">
                  <Link
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-muted"
                  />
                  <input
                    value={form.spotify}
                    onChange={(e) => update("spotify", e.target.value)}
                    placeholder="Spotify artist link"
                    className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
              About You *
            </label>
            <textarea
              required
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Tell us about yourself as an artist. Your story, your sound, your vision..."
              rows={4}
              className="w-full resize-none rounded-lg border border-wolf-border/30 bg-wolf-surface p-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
              Why Join Lightning Wolves? *
            </label>
            <div className="relative">
              <MessageSquare
                size={16}
                className="absolute left-3.5 top-4 text-wolf-muted"
              />
              <textarea
                required
                value={form.whyJoin}
                onChange={(e) => update("whyJoin", e.target.value)}
                placeholder="What makes you want to be part of the pack?"
                rows={3}
                className="w-full resize-none rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full rounded-xl bg-wolf-gold py-4 text-lg font-bold tracking-wider text-black transition-all hover:bg-wolf-amber disabled:opacity-50"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Zap size={18} className="animate-spin fill-black" />
                SUBMITTING...
              </span>
            ) : (
              <>
                <Zap size={16} className="mr-2 inline fill-black" />
                SUBMIT APPLICATION
              </>
            )}
          </motion.button>
        </motion.form>
      </div>
    </div>
  );
}
