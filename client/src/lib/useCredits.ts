import { useState, useEffect, useCallback } from "react";
import { useSession } from "./useSession";

export interface UserPlan {
  tier: "free" | "starter" | "creator" | "pro" | "elite";
  credits: number;
  maxCredits: number;
  creditsPerMonth: number;
  templates: string;
  concurrent: number;
  isGuest: boolean;
}

const PLANS: Record<string, Omit<UserPlan, "credits" | "isGuest">> = {
  free: {
    tier: "free",
    maxCredits: 100,
    creditsPerMonth: 0,
    templates: "3 lifetime",
    concurrent: 1,
  },
  starter: {
    tier: "starter",
    maxCredits: 3600,
    creditsPerMonth: 300,
    templates: "3/month",
    concurrent: 1,
  },
  creator: {
    tier: "creator",
    maxCredits: 15540,
    creditsPerMonth: 1295,
    templates: "8/month",
    concurrent: 3,
  },
  pro: {
    tier: "pro",
    maxCredits: 31500,
    creditsPerMonth: 2625,
    templates: "12/month",
    concurrent: 5,
  },
  elite: {
    tier: "elite",
    maxCredits: 54600,
    creditsPerMonth: 4550,
    templates: "Unlimited",
    concurrent: 999,
  },
};

export function useCredits() {
  const { accessToken, loading: sessionLoading } = useSession();
  const [plan, setPlan] = useState<UserPlan>({
    tier: "free",
    credits: 100,
    maxCredits: 100,
    creditsPerMonth: 0,
    templates: "3 lifetime",
    concurrent: 1,
    isGuest: true,
  });
  const [loading, setLoading] = useState(true);

  // Pull the live balance from the server. The endpoint switches on the
  // Authorization header — without it the server returns the guest fallback
  // (100 credits, free tier) which is why the navbar used to show a stale
  // "100 credits" for everyone. Refetch whenever the access token changes
  // so a sign-in/out flips to the real balance immediately.
  const refreshCredits = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch("/api/credits", { headers });
      const data = await res.json();
      const tier = data.tier || "free";
      const planInfo = PLANS[tier] || PLANS.free;
      setPlan({
        ...planInfo,
        credits: data.credits ?? 100,
        isGuest: data.isGuest ?? true,
      });
    } catch {
      // Fallback to whatever is in local state.
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (sessionLoading) return;
    void refreshCredits();
  }, [sessionLoading, refreshCredits]);

  const deductCredits = useCallback((amount: number) => {
    setPlan((p) => ({ ...p, credits: Math.max(0, p.credits - amount) }));
  }, []);

  const hasEnoughCredits = useCallback(
    (amount: number) => plan.credits >= amount,
    [plan.credits]
  );

  return { plan, loading, deductCredits, hasEnoughCredits, refreshCredits };
}

export function tierLabel(tier: string): string {
  switch (tier) {
    case "starter": return "Starter";
    case "creator": return "Creator";
    case "pro": return "Pro";
    case "elite": return "Elite";
    default: return "Free";
  }
}

export function tierColor(tier: string): string {
  switch (tier) {
    case "starter": return "#f5c518";
    case "creator": return "#69f0ae";
    case "pro": return "#E040FB";
    case "elite": return "#ff6b9d";
    default: return "#888";
  }
}
