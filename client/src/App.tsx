import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import PackMomentum from "./components/PackMomentum";
import WolfGrid from "./components/WolfGrid";
import Features from "./components/Features";
import FeaturedArtists from "./components/FeaturedArtists";
import CTA from "./components/CTA";
import Footer from "./components/Footer";
import LightningCanvas from "./components/LightningCanvas";
import WolfProfilePage from "./components/WolfProfilePage";
import PricingPage from "./components/PricingPage";
import WolfMapPage from "./components/WolfMapPage";
import WolfHubPage from "./components/WolfHubPage";
import StudioPage from "./components/StudioPage";
import AuthPage from "./components/AuthPage";
import JoinPackPage from "./components/JoinPackPage";
import CreateProfilePage from "./components/CreateProfilePage";
import VersusPage from "./components/VersusPage";
import ExplorePage from "./components/ExplorePage";
import GoldenBoardPage from "./components/GoldenBoardPage";
import PromoterPricingPage from "./components/PromoterPricingPage";
import PromoterCheckoutPage from "./components/PromoterCheckoutPage";
import OrganizerInboxPage from "./components/OrganizerInboxPage";
import { useCredits } from "./lib/useCredits";
import { useSession } from "./lib/useSession";
import { startCheckout, type TierSlug, type BillingInterval } from "./lib/checkout";
import { wolfBySlug } from "./data/wolves";
import type { Wolf, WolfRole } from "./data/wolves";

type Page =
  | { type: "home" }
  | { type: "wolf-profile"; wolf: Wolf }
  | { type: "pricing" }
  | { type: "wolf-map" }
  | { type: "wolf-hub" }
  | { type: "studio"; wolf: Wolf | null }
  | { type: "auth" }
  | { type: "join-pack" }
  | { type: "create-profile"; pendingApplyGigId?: string }
  | { type: "versus"; territory?: string; challengeWolf?: Wolf; roleFilter?: WolfRole }
  | { type: "explore" }
  | { type: "golden-board"; initialGigId?: string }
  | { type: "promoter-pricing" }
  | { type: "promoter-checkout"; tierId: string }
  | { type: "organizer-inbox" };

interface UserProfile {
  name: string;
  photo: string;
  genre: string;
  country: string;
}

export default function App() {
  const [page, setPage] = useState<Page>({ type: "home" });
  const [wolfColor, setWolfColor] = useState("#f5c518");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [studioView, setStudioView] = useState("dashboard");
  const { plan } = useCredits();
  const { accessToken } = useSession();

  // Post-checkout banner. Set when ?checkout=success|cancelled hits the URL,
  // cleared on tap-to-dismiss or after ~6 seconds.
  const [checkoutBanner, setCheckoutBanner] = useState<
    | { kind: "success"; tier: string }
    | { kind: "cancelled" }
    | null
  >(null);

  // A pending checkout remembers what tier/interval the user clicked before
  // we bounced them to sign-in. After auth, we pick it back up.
  const [pendingCheckout, setPendingCheckout] = useState<{
    tier: TierSlug;
    interval: BillingInterval;
  } | null>(null);

  // Handle Stripe redirect returns: ?checkout=success&tier=pro or =cancelled.
  // Runs once on mount; cleans the URL so refreshes don't re-fire the toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("checkout");
    if (outcome === "success") {
      const tier = params.get("tier") || "studio";
      setCheckoutBanner({ kind: "success", tier });
    } else if (outcome === "cancelled") {
      setCheckoutBanner({ kind: "cancelled" });
    }
    if (outcome) {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("tier");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Auto-dismiss the checkout banner after a beat.
  useEffect(() => {
    if (!checkoutBanner) return;
    const t = setTimeout(() => setCheckoutBanner(null), 6000);
    return () => clearTimeout(t);
  }, [checkoutBanner]);

  // Resume a checkout that was blocked by the sign-in gate. When the user
  // finally has an access token, fire the Stripe redirect they originally
  // asked for and clear the pending intent.
  useEffect(() => {
    if (!pendingCheckout || !accessToken) return;
    const intent = pendingCheckout;
    setPendingCheckout(null);
    startCheckout({ ...intent, accessToken }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Checkout resume failed:", err);
      setCheckoutBanner({ kind: "cancelled" });
    });
  }, [pendingCheckout, accessToken]);

  // Deep-link: ?challenge=<artist-slug> opens Versus with that wolf's card
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("challenge");
    if (slug) {
      const wolf = wolfBySlug.get(slug);
      if (wolf && wolf.status === "active" && wolf.profile?.versus) {
        setPage({ type: "versus", challengeWolf: wolf });
        setWolfColor(wolf.color);
      }
      // Clean the URL so refreshes don't loop-open (only once on mount)
      const url = new URL(window.location.href);
      url.searchParams.delete("challenge");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const goHome = useCallback(() => {
    setPage({ type: "home" });
    setWolfColor("#f5c518");
    window.scrollTo(0, 0);
  }, []);

  const goToProfile = useCallback((wolf: Wolf) => {
    if (wolf.status !== "active" || !wolf.profile) return;
    setPage({ type: "wolf-profile", wolf });
    setWolfColor(wolf.color);
    window.scrollTo(0, 0);
  }, []);

  const goToPricing = useCallback(() => {
    setPage({ type: "pricing" });
    window.scrollTo(0, 0);
  }, []);

  const goToWolfMap = useCallback(() => {
    setPage({ type: "wolf-map" });
    window.scrollTo(0, 0);
  }, []);

  const goToWolfHub = useCallback(() => {
    setPage({ type: "wolf-hub" });
    window.scrollTo(0, 0);
  }, []);

  const goToStudio = useCallback((wolf?: Wolf) => {
    setPage({ type: "studio", wolf: wolf || null });
    setStudioView("dashboard");
    if (wolf) setWolfColor(wolf.color);
    window.scrollTo(0, 0);
  }, []);

  const goToAuth = useCallback(() => {
    setPage({ type: "auth" });
    window.scrollTo(0, 0);
  }, []);

  const goToJoinPack = useCallback(() => {
    setPage({ type: "join-pack" });
    window.scrollTo(0, 0);
  }, []);

  const goToVersus = useCallback((territory?: string) => {
    setPage({ type: "versus", territory });
    window.scrollTo(0, 0);
  }, []);

  const goToExplore = useCallback(() => {
    setPage({ type: "explore" });
    window.scrollTo(0, 0);
  }, []);

  const goToGoldenBoard = useCallback(() => {
    setPage({ type: "golden-board" });
    window.scrollTo(0, 0);
  }, []);

  const goToPromoterPricing = useCallback(() => {
    setPage({ type: "promoter-pricing" });
    window.scrollTo(0, 0);
  }, []);

  const goToOrganizerInbox = useCallback(() => {
    setPage({ type: "organizer-inbox" });
    window.scrollTo(0, 0);
  }, []);

  const goToVersusByRole = useCallback((role: WolfRole) => {
    setPage({ type: "versus", roleFilter: role });
    window.scrollTo(0, 0);
  }, []);

  const goToChallenge = useCallback((wolf: Wolf) => {
    setPage({ type: "versus", challengeWolf: wolf });
    setWolfColor(wolf.color);
    window.scrollTo(0, 0);
  }, []);

  const handleWolfSelect = useCallback(
    (wolf: Wolf) => {
      if (wolf.status === "cta") {
        goToJoinPack();
      } else if (wolf.status === "special") {
        goToStudio(wolf);
      } else if (wolf.status === "active" && wolf.profile) {
        goToProfile(wolf);
      }
    },
    [goToJoinPack, goToStudio, goToProfile]
  );

  return (
    <>
      <LightningCanvas color={wolfColor} />
      <div className="relative z-10">
        <Navbar
          onPricing={goToPricing}
          onWolfMap={goToWolfMap}
          onWolfHub={goToWolfHub}
          onHome={goHome}
          onStudio={() => goToStudio()}
          onAuth={goToAuth}
          onGoldenBoard={goToGoldenBoard}
          isInStudio={page.type === "studio"}
          studioView={studioView}
          onStudioNav={(view) => {
            if (view === "pricing") { goToPricing(); return; }
            setStudioView(view); window.scrollTo(0, 0);
          }}
          credits={plan.credits}
          tier={plan.tier}
          wolfColor={wolfColor}
        />

        {/* Post-checkout banner — renders above the page content */}
        <AnimatePresence>
          {checkoutBanner && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed inset-x-0 top-20 z-40 mx-auto max-w-lg rounded-xl border px-5 py-3 text-sm font-medium shadow-xl backdrop-blur ${
                checkoutBanner.kind === "success"
                  ? "border-green-400/40 bg-green-400/15 text-green-200"
                  : "border-wolf-border/40 bg-wolf-card/80 text-wolf-muted"
              }`}
              role="status"
              onClick={() => setCheckoutBanner(null)}
            >
              {checkoutBanner.kind === "success"
                ? `⚡ You're on ${checkoutBanner.tier.charAt(0).toUpperCase() + checkoutBanner.tier.slice(1)} — credits are landing in your studio now.`
                : "Checkout cancelled — your cart is empty. Pick a tier whenever you're ready."}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={
              page.type +
              (page.type === "wolf-profile" ? page.wolf.id : "") +
              (page.type === "versus"
                ? (page.territory ?? "") +
                  (page.challengeWolf?.id ?? "") +
                  (page.roleFilter ?? "")
                : "")
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {page.type === "home" && (
              <>
                <Hero onStudio={() => goToStudio()} />
                <PackMomentum />
                <WolfGrid onSelectWolf={handleWolfSelect} />
                <Features onGoldenBoard={goToGoldenBoard} />
                <FeaturedArtists
                  onSelectWolf={handleWolfSelect}
                  onJoinPack={goToJoinPack}
                />
                <CTA onStudio={() => goToStudio()} onWolfMap={goToWolfMap} />
              </>
            )}

            {page.type === "wolf-profile" && (
              <WolfProfilePage
                wolf={page.wolf}
                onBack={goHome}
                onStudio={() => goToStudio(page.wolf)}
                onChallenge={() => goToChallenge(page.wolf)}
              />
            )}

            {page.type === "pricing" && (
              <PricingPage
                onBack={goHome}
                onGetStarted={async ({ tier, interval }) => {
                  // No session yet — stash the intent and send to sign-in;
                  // the useEffect above picks it up once accessToken lands.
                  if (!accessToken) {
                    setPendingCheckout({ tier, interval });
                    goToAuth();
                    return;
                  }
                  try {
                    await startCheckout({ tier, interval, accessToken });
                  } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error("Checkout failed:", err);
                    setCheckoutBanner({ kind: "cancelled" });
                  }
                }}
              />
            )}

            {page.type === "wolf-map" && (
              <WolfMapPage
                onBack={goHome}
                onSelectWolf={goToProfile}
                onVersus={goToVersus}
                onExplore={goToExplore}
                onGoldenBoard={goToGoldenBoard}
              />
            )}

            {page.type === "wolf-hub" && (
              <WolfHubPage onBack={goHome} onAuth={goToAuth} />
            )}

            {page.type === "studio" && (
              <StudioPage
                wolf={page.wolf}
                onBack={goHome}
                onWolfMap={goToWolfMap}
                studioView={studioView}
                onStudioNav={(v) => {
                  if (v === "pricing") { goToPricing(); return; }
                  setStudioView(v); window.scrollTo(0, 0);
                }}
              />
            )}

            {page.type === "auth" && (
              <AuthPage onBack={goHome} onSuccess={goHome} />
            )}

            {page.type === "join-pack" && (
              <JoinPackPage onBack={goHome} />
            )}

            {page.type === "create-profile" && (
              <CreateProfilePage
                onBack={goHome}
                onComplete={(profile) => {
                  setUserProfile(profile);
                  // If the user got here mid-apply, send them straight back
                  // to the gig detail so they can finish applying.
                  if (page.pendingApplyGigId) {
                    setPage({ type: "golden-board", initialGigId: page.pendingApplyGigId });
                  } else {
                    setPage({ type: "wolf-map" });
                  }
                  window.scrollTo(0, 0);
                }}
              />
            )}

            {page.type === "versus" && (
              <VersusPage
                onBack={() => {
                  if (page.challengeWolf) {
                    setPage({ type: "wolf-profile", wolf: page.challengeWolf });
                  } else if (page.roleFilter) {
                    setPage({ type: "explore" });
                  } else {
                    setPage({ type: "wolf-map" });
                  }
                }}
                territory={page.territory}
                challengeWolf={page.challengeWolf}
                roleFilter={page.roleFilter}
                userProfile={userProfile || undefined}
              />
            )}

            {page.type === "explore" && (
              <ExplorePage
                onBack={goHome}
                onPickRole={goToVersusByRole}
                onSelectWolf={goToProfile}
              />
            )}

            {page.type === "golden-board" && (
              <GoldenBoardPage
                onBack={goHome}
                onPost={goToPromoterPricing}
                onApplyGate={(gigId) =>
                  setPage({ type: "create-profile", pendingApplyGigId: gigId })
                }
                onInbox={goToOrganizerInbox}
                hasProfile={!!userProfile}
                initialGigId={page.initialGigId}
              />
            )}

            {page.type === "promoter-pricing" && (
              <PromoterPricingPage
                onBack={goToGoldenBoard}
                onPickTier={(tierId) => {
                  setPage({ type: "promoter-checkout", tierId });
                  window.scrollTo(0, 0);
                }}
              />
            )}

            {page.type === "promoter-checkout" && (
              <PromoterCheckoutPage
                tierId={page.tierId}
                onBack={goToPromoterPricing}
                onDone={goToGoldenBoard}
                onViewInbox={goToOrganizerInbox}
              />
            )}

            {page.type === "organizer-inbox" && (
              <OrganizerInboxPage onBack={goToGoldenBoard} />
            )}
          </motion.div>
        </AnimatePresence>

        <Footer
          onWolfMap={goToWolfMap}
          onStudio={() => goToStudio()}
          onPricing={goToPricing}
          onJoinPack={goToJoinPack}
          onGoldenBoard={goToGoldenBoard}
        />
      </div>
    </>
  );
}
