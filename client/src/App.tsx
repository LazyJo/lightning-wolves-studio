import { useState, useCallback } from "react";
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
import type { Wolf } from "./data/wolves";

type Page =
  | { type: "home" }
  | { type: "wolf-profile"; wolf: Wolf }
  | { type: "pricing" }
  | { type: "wolf-hub" }
  | { type: "studio"; wolf: Wolf | null }
  | { type: "auth" }
  | { type: "join-pack" };

export default function App() {
  const [page, setPage] = useState<Page>({ type: "home" });
  const [wolfColor, setWolfColor] = useState("#f5c518");

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
    setPage({ type: "wolf-hub" });
    window.scrollTo(0, 0);
  }, []);

  const goToStudio = useCallback((wolf?: Wolf) => {
    setPage({ type: "studio", wolf: wolf || null });
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

  // Handle wolf card clicks - active go to profile, special (Lone Wolf) go to studio, CTA go to join
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
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={
              page.type +
              (page.type === "wolf-profile" ? page.wolf.id : "")
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
                <FeaturedArtists />
                <CTA onStudio={() => goToStudio()} />
              </>
            )}

            {page.type === "wolf-profile" && (
              <WolfProfilePage
                wolf={page.wolf}
                onBack={goHome}
                onStudio={() => goToStudio(page.wolf)}
              />
            )}

            {page.type === "pricing" && <PricingPage onBack={goHome} />}

            {page.type === "wolf-hub" && (
              <WolfHubPage onBack={goHome} onSelectWolf={goToProfile} />
            )}

            {page.type === "studio" && (
              <StudioPage wolf={page.wolf} onBack={goHome} />
            )}

            {page.type === "auth" && (
              <AuthPage onBack={goHome} onSuccess={goHome} />
            )}

            {page.type === "join-pack" && (
              <JoinPackPage onBack={goHome} />
            )}
          </motion.div>
        </AnimatePresence>

        <Footer onWolfHub={goToWolfHub} />
      </div>
    </>
  );
}
