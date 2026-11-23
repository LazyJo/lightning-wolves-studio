import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Multi-page: the main studio app at / and the standalone LAZY JO
    // UNIVERSE experience at /lazyjo/ (own bundle — no studio code).
    rollupOptions: {
      input: {
        main: here("./index.html"),
        lazyjo: here("./lazyjo/index.html"),
      },
    },
  },
  server: {
    // Lightning Wolves Express backend runs on 3001 to avoid clashing with
    // the consulting-landing project that sits on 3000 in local dev.
    proxy: {
      "/api": "http://localhost:3001",
      "/health": "http://localhost:3001",
    },
  },
});
