import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Zap, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { initSupabase } from "../lib/supabaseClient";

interface Props {
  onBack: () => void;
  onSuccess: () => void;
}

export default function AuthPage({ onBack, onSuccess }: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (mode === "forgot") {
      if (!email) {
        setError("Enter your email so we can send the reset link.");
        return;
      }
      setLoading(true);
      const sb = await initSupabase();
      if (!sb) {
        setLoading(false);
        setError("Auth isn't configured yet — check back soon.");
        return;
      }
      try {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/?reset=1`,
        });
        if (error) throw error;
        setInfo("Check your inbox for a reset link.");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Reset failed";
        setError(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (mode === "signup" && !name) {
      setError("Please enter your name");
      return;
    }

    setLoading(true);
    const sb = await initSupabase();
    if (!sb) {
      setLoading(false);
      setError("Auth isn't configured yet — check back soon.");
      return;
    }

    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
      }
      setLoading(false);
      onSuccess();
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : "Auth failed";
      setError(msg);
    }
  };

  const handleGoogle = async () => {
    setError("");
    const sb = await initSupabase();
    if (!sb) {
      setError("Auth isn't configured yet — check back soon.");
      return;
    }
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setError(
        error.message.includes("provider is not enabled")
          ? "Google sign-in isn't switched on yet — try email for now."
          : error.message
      );
    }
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
            {mode === "signin"
              ? t("auth.welcomeBack")
              : mode === "signup"
              ? t("auth.joinPack")
              : "Reset password"}
          </h1>
          <p className="mb-8 text-center text-sm text-wolf-muted">
            {mode === "signin"
              ? t("auth.signInSubtitle")
              : mode === "signup"
              ? t("auth.signUpSubtitle")
              : "Enter your email and we'll send a reset link."}
          </p>

          {/* Mode toggle (hidden in forgot mode) */}
          {mode !== "forgot" && (
            <div className="mb-6 flex rounded-xl bg-wolf-surface p-1">
              <button
                onClick={() => { setMode("signin"); setError(""); setInfo(""); }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                  mode === "signin"
                    ? "bg-wolf-gold text-black"
                    : "text-wolf-muted"
                }`}
              >
                {t("auth.signIn")}
              </button>
              <button
                onClick={() => { setMode("signup"); setError(""); setInfo(""); }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                  mode === "signup"
                    ? "bg-wolf-gold text-black"
                    : "text-wolf-muted"
                }`}
              >
                {t("auth.signUp")}
              </button>
            </div>
          )}

          {/* Continue with Google (only in signin/signup, not forgot) */}
          {mode !== "forgot" && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                className="mb-4 flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.05] py-3 text-sm font-semibold text-white transition-all hover:border-white/20 hover:bg-white/[0.08]"
              >
                <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
              <div className="mb-4 flex items-center gap-3 text-xs text-wolf-muted/60">
                <div className="h-px flex-1 bg-white/10" />
                <span>or with email</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name (signup only) */}
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  {t("auth.wolfName")}
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
                {t("auth.email")}
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

            {/* Password (hidden in forgot mode) */}
            {mode !== "forgot" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                {t("auth.password")}
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
            )}

            {/* Promo code (signup only) */}
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-wolf-muted">
                  {t("auth.promoCode")}{" "}
                  <span className="normal-case text-wolf-muted/50">
                    ({t("auth.optional")})
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

            {/* Error / Info */}
            {error && (
              <p className="text-center text-sm text-red-400">{error}</p>
            )}
            {info && (
              <p className="text-center text-sm text-green-300">{info}</p>
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
                  {mode === "signin"
                    ? `${t("auth.signIn")}...`
                    : mode === "signup"
                    ? `${t("auth.createAccount")}...`
                    : "Sending..."}
                </span>
              ) : mode === "signin" ? (
                t("auth.signIn")
              ) : mode === "signup" ? (
                t("auth.createAccount")
              ) : (
                "Send reset link"
              )}
            </motion.button>
          </form>

          {/* Footer */}
          {mode === "signin" && (
            <p className="mt-6 text-center text-xs text-wolf-muted">
              <button
                onClick={() => { setMode("forgot"); setError(""); setInfo(""); }}
                className="text-wolf-gold hover:underline"
              >
                {t("auth.forgotPassword")}
              </button>
            </p>
          )}
          {mode === "forgot" && (
            <p className="mt-6 text-center text-xs text-wolf-muted">
              <button
                onClick={() => { setMode("signin"); setError(""); setInfo(""); }}
                className="text-wolf-gold hover:underline"
              >
                Back to sign in
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
