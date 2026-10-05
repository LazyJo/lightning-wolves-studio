import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

const FACES: { family: string; file: string; weight: string }[] = [
  { family: "Bebas Neue", file: "fonts/bebas-neue-400.woff2", weight: "400" },
  { family: "Syncopate", file: "fonts/syncopate-400.woff2", weight: "400" },
  { family: "Syncopate", file: "fonts/syncopate-700.woff2", weight: "700" },
  { family: "Inter", file: "fonts/inter-400.woff2", weight: "400" },
  { family: "Inter", file: "fonts/inter-600.woff2", weight: "600" },
  { family: "Inter", file: "fonts/inter-800.woff2", weight: "800" },
];

let loading: Promise<void> | null = null;

const loadAll = () => {
  if (!loading) {
    loading = Promise.all(
      FACES.map(async ({ family, file, weight }) => {
        const face = new FontFace(family, `url(${staticFile(file)}) format('woff2')`, { weight });
        document.fonts.add(await face.load());
      }),
    ).then(() => undefined);
  }
  return loading;
};

// Text is measured (fitText) during render, so nothing may mount before the
// faces are in — otherwise sizes are computed against the fallback font.
export const useFontsReady = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading brand fonts"));
  useEffect(() => {
    loadAll()
      .catch((err) => console.error(err))
      .finally(() => setReady(true));
  }, []);
  // Release the render only after the measured tree has committed.
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return ready;
};
