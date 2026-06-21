import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n";
import App from "./App";
import { OfflineProvider } from "./OfflineProvider";
import { registerServiceWorker } from "./register-sw";

registerServiceWorker();

const hash = window.location.hash;
if (hash && hash.startsWith('#r=')) {
  const path = atob(hash.slice(3));
  window.history.replaceState(null, '', path);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OfflineProvider>
      <App />
    </OfflineProvider>
  </StrictMode>
);
