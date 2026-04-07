import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Zap, Mail, Lock, User, Eye, EyeOff } from "lucide-react";

interface Props {
  onBack: () => void;
  onSuccess: () => void;
}

export default function AuthPage({ onBack, onSuccess }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Simulate auth
    await new Promise((r) => setTimeout(r, 1200));

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    if (mode === "signup" && !name) {
      setError("Please enter your name");
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
  };

  return (
    <div className="flex min-h-screen items-center justify-center pt-20 pb-20">
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(245,197,24,0.04), transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md px-6">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-8 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-wolf-border/30 bg-wolf-card p-8"
        >
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <img
              src="/LightningWolvesLogoTransparentBG.png"
              alt="Lightning Wolves"
              className="h-12 w-12"
            />
          </div>

          <h1
            className="mb-1 text-center text-2xl font-bold tracking-wider text-white"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {mode === "signin" ? "WELCOME BACK" : "JOIN THE PACK"}
          </h1>
          <p className="mb-8 text-center text-sm text-wolf-muted">
            {mode === "signin"
              ? "Sign in to your account"
              : "Create your Lightning Wolves account"}
          </p>

          {/* Mode toggle */}
          <div className="mb-6 flex rounded-xl bg-wolf-surface p-1">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                mode === "signin"
                  ? "bg-wolf-gold text-black"
                  : "text-wolf-muted"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                mode === "signup"
                  ? "bg-wolf-gold text-black"
                  : "text-wolf-muted"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name (signup only) */}
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  Wolf Name
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-muted"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your artist name"
                    className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                  />
                </div>
              </motion.div>
            )}

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-muted"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="wolf@example.com"
                  className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-muted"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-10 text-white placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-wolf-muted hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Promo code (signup only) */}
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  Promo Code{" "}
                  <span className="normal-case text-wolf-muted/50">
                    (optional)
                  </span>
                </label>
                <div className="relative">
                  <Zap
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-wolf-gold/50"
                  />
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="WOLFPACK"
                    className="w-full rounded-lg border border-wolf-border/30 bg-wolf-surface py-3 pl-10 pr-4 text-wolf-gold uppercase placeholder:text-wolf-muted/40 focus:border-wolf-gold/40 focus:outline-none"
                  />
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <p className="text-center text-sm text-red-400">{error}</p>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full rounded-lg bg-wolf-gold py-3.5 font-semibold text-black transition-all hover:bg-wolf-amber disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Zap size={16} className="animate-spin fill-black" />
                  {mode === "signin" ? "Signing in..." : "Creating account..."}
                </span>
              ) : mode === "signin" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </motion.button>
          </form>

          {/* Footer */}
          {mode === "signin" && (
            <p className="mt-6 text-center text-xs text-wolf-muted">
              <button className="text-wolf-gold hover:underline">
                Forgot password?
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
