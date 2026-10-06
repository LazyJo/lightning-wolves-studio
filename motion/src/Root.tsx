import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, WIDTH } from "./lib/brand";
import { MYSELF_DURATION, MyselfLyricReel } from "./compositions/MyselfLyricReel";
import { ArtistPromo, PROMO_DURATION } from "./compositions/ArtistPromo";
import { INTRO_DURATION, LazyJoIntro } from "./compositions/LazyJoIntro";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="MyselfLyricReel"
      component={MyselfLyricReel}
      durationInFrames={MYSELF_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition
      id="LazyJoArtistPromo"
      component={ArtistPromo}
      durationInFrames={PROMO_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition
      id="LazyJoIntro"
      component={LazyJoIntro}
      durationInFrames={INTRO_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);
