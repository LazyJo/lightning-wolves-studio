// Copies the source media the motion pieces use out of the main app
// (client/public + repo root) into motion/public/assets, and the brand
// fonts out of @fontsource into motion/public/fonts. Both targets are
// gitignored — the originals stay the single source of truth.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const motionRoot = resolve(here, "..");
const repoRoot = resolve(motionRoot, "..");
const clientPublic = join(repoRoot, "client", "public");

const assets = {
  "assets/lazyjo-photo.jpg": join(repoRoot, "LazyJo - StayUp pictures from videoshoot (CS)_-86.JPG.jpeg"),
  "assets/myself.mp3": join(clientPublic, "demo", "lazyjo-myself.mp3"),
  "assets/wolf-card.mp4": join(clientPublic, "Lazy Jo Wolf Card Animation.mp4"),
  "assets/live.mp4": join(clientPublic, "Lazy Jo Performance Video.mp4"),
  "assets/fire-wolf.mp4": join(clientPublic, "WhatsApp Video 2026-03-31 at 1.55.35 PM.mp4"),
  "assets/logo-wordmark.png": join(clientPublic, "LightningWolvesLogoTransparentBG.png"),
  "assets/wolf-yellow.png": join(clientPublic, "LightningWolfYellowTransparentBG.png"),
  "assets/cosigns/timbaland.jpg": join(clientPublic, "Timbaland.jpeg"),
  "assets/cosigns/symba.jpg": join(clientPublic, "Symba.jpeg"),
  "assets/cosigns/ddg.jpg": join(clientPublic, "DDG.jpeg"),
  "assets/cosigns/kelvyn-colt.jpg": join(clientPublic, "Kelvyn Colt.jpeg"),
  "assets/cosigns/zaytoven.jpg": join(clientPublic, "Zaytoven.jpeg"),
  "assets/cosigns/kid-hazel.jpg": join(clientPublic, "Kid Hazel.jpeg"),
};

const fontsource = join(motionRoot, "node_modules", "@fontsource");
const fonts = {
  "fonts/bebas-neue-400.woff2": join(fontsource, "bebas-neue", "files", "bebas-neue-latin-400-normal.woff2"),
  "fonts/anton-400.woff2": join(fontsource, "anton", "files", "anton-latin-400-normal.woff2"),
  "fonts/syncopate-400.woff2": join(fontsource, "syncopate", "files", "syncopate-latin-400-normal.woff2"),
  "fonts/syncopate-700.woff2": join(fontsource, "syncopate", "files", "syncopate-latin-700-normal.woff2"),
  "fonts/inter-400.woff2": join(fontsource, "inter", "files", "inter-latin-400-normal.woff2"),
  "fonts/inter-600.woff2": join(fontsource, "inter", "files", "inter-latin-600-normal.woff2"),
  "fonts/inter-800.woff2": join(fontsource, "inter", "files", "inter-latin-800-normal.woff2"),
};

let copied = 0;
let missing = 0;
for (const [target, source] of Object.entries({ ...assets, ...fonts })) {
  const dest = join(motionRoot, "public", target);
  if (!existsSync(source)) {
    console.warn(`  missing: ${source}`);
    missing++;
    continue;
  }
  if (existsSync(dest) && statSync(dest).size === statSync(source).size) continue;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(source, dest);
  copied++;
}
console.log(`sync-assets: ${copied} copied, ${missing} missing`);
if (missing) process.exit(1);
