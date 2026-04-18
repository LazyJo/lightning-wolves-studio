import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  Sparkles,
  Mail,
  Building2,
  User,
  FileText,
  Shield,
} from "lucide-react";
import { promoterTiers } from "../data/events";

interface Props {
  tierId: string;
  onBack: () => void;
  onDone: () => void;
  onViewInbox?: () => void;
}

interface CheckoutDraft {
  contactName: string;
  email: string;
  orgName: string;
  notes: string;
}

const DRAFT_KEY = "lw-promoter-checkout-draft";
const SUBMITTED_KEY = "lw-promoter-checkout-submissions";

function readDraft(): CheckoutDraft {
  const empty: CheckoutDraft = { contactName: "", email: "", orgName: "", notes: "" };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}

/**
 * Promoter checkout — the next step after a promoter picks a Golden
 * Board tier. Stripe isn't wired yet, so this page captures the
 * contact details we need to send a real Stripe invoice/link and
 * confirms receipt. The intent is persisted locally so organizers
 * don't lose the draft if they navigate away mid-form.
 */
export default function PromoterCheckoutPage({ tierId, onBack, onDone, onViewInbox }: Props) {
  const tier = useMemo(() => promoterTiers.find((t) => t.id === tierId), [tierId]);
  const [draft, setDraft] = useState<CheckoutDraft>(() => readDraft());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: keyof CheckoutDraft, value: string) => {
    const next = { ...draft, [field]: value };
    setDraft(next);
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      // localStorage denied — in-memory draft still works for this session.
    }
  };

  const canSubmit =
    draft.contactName.trim().length > 1 &&
    /^\S+@\S+\.\S+$/.test(draft.email) &&
    draft.orgName.trim().length > 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !tier) return;
    setSubmitting(true);

    // Record the pending intent locally. When Stripe is live, this
    // same submission will POST to /api/promoter-checkout and return
    // a Stripe session URL to redirect into.
    try {
      const existing = JSON.parse(
        window.localStorage.getItem(SUBMITTED_KEY) || "[]"
      );
      const record = {
        tierId: tier.id,
        tierName: tier.name,
        price: tier.price,
        period: tier.period,
        ...draft,
        submittedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(
        SUBMITTED_KEY,
        JSON.stringify([record, ...existing].slice(0, 20))
      );
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignore — we'll still show the confirmation.
    }

    // Fake-network beat so the button spinner reads as real work.
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);
    setSubmitted(true);
  };

  if (!tier) {
    // Defensive fallback — bad tierId slug, just route back.
    return (
      <div className="flex min-h-screen items-center justify-center pt-20">
        <div className="text-center">
          <p className="text-wolf-muted">Tier not found.</p>
          <button
            onClick={onBack}
            className="mt-4 rounded-xl bg-wolf-gold px-6 py-2 text-sm font-bold text-black"
          >
            Back to pricing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20">
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0d0b06] via-wolf-bg to-[#0d0b06]" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_15%,_rgba(245,197,24,0.12),_transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-2xl px-6 pb-24">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-sm text-wolf-muted transition-colors hover:text-wolf-gold"
        >
          <ArrowLeft size={16} />
          Back to tiers
        </motion.button>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-wolf-gold/30 bg-gradient-to-br from-[#1a1608] to-wolf-card p-10 text-center"
          >
            <div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2"
              style={{ borderColor: `${tier.color}60`, backgroundColor: `${tier.color}20` }}
            >
              <Check size={28} style={{ color: tier.color }} />
            </div>
            <h1
              className="mb-3 text-3xl font-bold tracking-wider text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              YOU'RE ON THE LIST
            </h1>
            <p className="mx-auto mb-6 max-w-md text-sm text-wolf-muted">
              We'll send a Stripe invoice for{" "}
              <span className="font-semibold text-white">
                {tier.name} — {tier.price}
                {tier.period}
              </span>{" "}
              to <span className="font-semibold text-wolf-gold">{draft.email || "your email"}</span>{" "}
              within 24 hours. Once paid, your organizer badge is live and you can post your first gig.
            </p>

            <div className="mb-6 rounded-xl border border-white/[0.06] bg-black/30 p-4 text-left text-xs text-wolf-muted">
              <p className="mb-1 flex items-center gap-2">
                <Shield size={12} className="text-wolf-gold" />
                <span className="font-bold uppercase tracking-wider text-wolf-gold">What happens next</span>
              </p>
              <ol className="mt-2 space-y-1.5 pl-4">
                <li>1. We manually vet new organizers to keep the board premium.</li>
                <li>2. You'll get a Stripe payment link in your inbox.</li>
                <li>3. After payment, your Lightning Wolves dashboard unlocks.</li>
              </ol>
            </div>

            <button
              onClick={onDone}
              className="w-full rounded-xl bg-gradient-to-r from-wolf-amber to-wolf-gold py-3.5 text-sm font-bold text-black shadow-lg shadow-wolf-gold/20 transition-all hover:opacity-90"
            >
              Back to the Golden Board
            </button>
            {onViewInbox && (
              <button
                onClick={onViewInbox}
                className="mt-3 w-full text-center text-[11px] font-semibold uppercase tracking-wider text-wolf-muted transition-colors hover:text-wolf-gold"
              >
                Preview your organizer inbox →
              </button>
            )}
          </motion.div>
        ) : (
          <>
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-wolf-gold/30 bg-wolf-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-wolf-gold">
                <Sparkles size={10} /> Reserve your tier
              </p>
              <h1
                className="text-3xl font-bold tracking-wider text-white sm:text-5xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                CHECKOUT
              </h1>
              <p className="mt-3 text-sm text-wolf-muted">
                Stripe-powered billing is rolling out in the next drop. In the meantime drop
                your details and we'll hand-send your invoice within 24 hours — keeps the
                board tight and lets us vet new organizers personally.
              </p>
            </motion.div>

            {/* Selected tier summary */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6 overflow-hidden rounded-2xl border p-5"
              style={{
                borderColor: `${tier.color}40`,
                backgroundColor: `${tier.color}10`,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: tier.color }}>
                    <span>{tier.icon}</span>
                    {tier.name}
                  </div>
                  <p className="mt-1 text-sm text-wolf-muted">{tier.tagline}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
                    {tier.price}
                  </div>
                  <div className="text-[11px] text-wolf-muted">{tier.period}</div>
                </div>
              </div>
            </motion.div>

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              onSubmit={handleSubmit}
              className="rounded-2xl border border-wolf-border/30 bg-wolf-card/60 p-6 backdrop-blur"
            >
              <Field
                label="Your name"
                icon={<User size={14} />}
                placeholder="Lazy Jo"
                value={draft.contactName}
                onChange={(v) => update("contactName", v)}
                required
              />
              <Field
                label="Email"
                icon={<Mail size={14} />}
                type="email"
                placeholder="wolf@example.com"
                value={draft.email}
                onChange={(v) => update("email", v)}
                required
              />
              <Field
                label="Venue / label / agency"
                icon={<Building2 size={14} />}
                placeholder="Lightning Wolves Live"
                value={draft.orgName}
                onChange={(v) => update("orgName", v)}
                required
              />
              <TextAreaField
                label="Tell us about your first gig (optional)"
                icon={<FileText size={14} />}
                placeholder="When, where, budget, what you're looking for…"
                value={draft.notes}
                onChange={(v) => update("notes", v)}
              />

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wolf-amber to-wolf-gold py-3.5 text-sm font-bold text-black shadow-lg shadow-wolf-gold/20 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting…" : `Reserve ${tier.name} — ${tier.price}${tier.period}`}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[10px] text-wolf-muted">
                <Shield size={10} /> No charge today. Invoice sent by email.
              </p>
            </motion.form>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Form primitives ─── */

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-wolf-muted">
        {label}
        {required && <span className="ml-1 text-wolf-gold">*</span>}
      </span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-wolf-muted">
          {icon}
        </span>
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-wolf-border/30 bg-black/30 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-wolf-muted/60 focus:border-wolf-gold/60 focus:outline-none focus:ring-2 focus:ring-wolf-gold/20"
        />
      </span>
    </label>
  );
}

function TextAreaField({
  label,
  icon,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="mb-5 block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-wolf-muted">
        {label}
      </span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-3 text-wolf-muted">{icon}</span>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-none rounded-xl border border-wolf-border/30 bg-black/30 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-wolf-muted/60 focus:border-wolf-gold/60 focus:outline-none focus:ring-2 focus:ring-wolf-gold/20"
        />
      </span>
    </label>
  );
}
