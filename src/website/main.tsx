import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import WebsiteShell from "./WebsiteShell";
import { OfflineProvider } from "../OfflineProvider";
import { registerServiceWorker } from "../register-sw";
import { PriceProvider } from "../PriceContext";

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OfflineProvider>
      <PriceProvider>
        <WebsiteShell />
      </PriceProvider>
    </OfflineProvider>
  </StrictMode>
);
