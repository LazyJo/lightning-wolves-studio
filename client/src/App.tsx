import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import WolfGrid from "./components/WolfGrid";
import Features from "./components/Features";
import FeaturedArtists from "./components/FeaturedArtists";
import CTA from "./components/CTA";
import Footer from "./components/Footer";
import LightningCanvas from "./components/LightningCanvas";
import WolfProfilePage from "./components/WolfProfilePage";
import PricingPage from "./components/PricingPage";
import WolfHubPage from "./components/WolfHubPage";
import StudioPage from "./components/StudioPage";
import AuthPage from "./components/AuthPage";
import JoinPackPage from "./components/JoinPackPage";
import CreateProfilePage from "./components/CreateProfilePage";
import VersusPage from "./components/VersusPage";
import ExplorePage from "./components/ExplorePage";
import { useCredits } from "./lib/useCredits";
import { wolfBySlug } from "./data/wolves";
import type { Wolf, WolfRole } from "./data/wolves";

type Page =
  | { type: "home" }
  | { type: "wolf-profile"; wolf: Wolf }
  | { type: "pricing" }
  | { type: "wolf-hub" }
  | { type: "studio"; wolf: Wolf | null }
  | { type: "auth" }
  | { type: "join-pack" }
  | { type: "create-profile" }
  | { type: "versus"; territory?: string; challengeWolf?: Wolf; roleFilter?: WolfRole }
  | { type: "explore" };

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

  const goToWolfHub = useCallback(() => {
    // Wolf Map is open to everyone — profile is optional and can be
    // completed later when the user actually wants to appear on the
    // other side of a swipe.
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

  const goToVersusByRole = useCallback((role: WolfRole) => {
    setPage({ type: "versus", roleFilter: role });
    window.scrollTo(0, 0);
  }, []);

  const goToChallenge = useCallback((wolf: Wolf) => {
    setPage({ type: "versus", challengeWolf: wolf });
    setWolfColor(wolf.color);
    window.scrollTo(0, 0);
  }, []);

  const handleProfileComplete = useCallback(
    (profile: { photo: string; name: string; genre: string; country: string }) => {
      setUserProfile(profile);
      setPage({ type: "wolf-hub" });
      window.scrollTo(0, 0);
    },
    []
  );

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
          onWolfHub={goToWolfHub}
          onHome={goHome}
          onStudio={() => goToStudio()}
          onAuth={goToAuth}
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
                <WolfGrid onSelectWolf={handleWolfSelect} />
                <Features />
                <FeaturedArtists
                  onSelectWolf={handleWolfSelect}
                  onJoinPack={goToJoinPack}
                />
                <CTA onStudio={() => goToStudio()} onWolfMap={goToWolfHub} />
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
              <PricingPage onBack={goHome} onGetStarted={() => goToAuth()} />
            )}

            {page.type === "wolf-hub" && (
              <WolfHubPage
                onBack={goHome}
                onSelectWolf={goToProfile}
                onVersus={goToVersus}
                onExplore={goToExplore}
              />
            )}

            {page.type === "studio" && (
              <StudioPage
                wolf={page.wolf}
                onBack={goHome}
                onWolfHub={goToWolfHub}
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
                onComplete={handleProfileComplete}
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
                    setPage({ type: "wolf-hub" });
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
              />
            )}
          </motion.div>
        </AnimatePresence>

        <Footer
          onWolfHub={goToWolfHub}
          onStudio={() => goToStudio()}
          onPricing={goToPricing}
          onJoinPack={goToJoinPack}
        />
      </div>
    </>
  );
}
