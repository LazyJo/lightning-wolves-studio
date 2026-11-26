import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Room from "./Room";
import "../lazyjo.css";
import "./room.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Room />
  </StrictMode>,
);
