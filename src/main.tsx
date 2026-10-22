import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@vexflow-fonts/bravura/index.css";
import { initPersistence } from "./model/persist";
import { unlockAudioOnFirstTap } from "./model/playback";
import { App } from "./ui/App";
import "./styles.css";

unlockAudioOnFirstTap();

// The score is drawn with Bravura; wait for it so nothing renders with a fallback font first.
Promise.all([initPersistence(), document.fonts.load('40px "Bravura"', "").catch(() => {})]).then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
