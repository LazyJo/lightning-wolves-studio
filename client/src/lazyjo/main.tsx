import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LazyJoUniverse from "./LazyJoUniverse";
import "./lazyjo.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyJoUniverse />
  </StrictMode>,
);
