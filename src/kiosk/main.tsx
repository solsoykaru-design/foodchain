import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { AppProvider } from "../context";
import KioskApp from "./KioskApp";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <KioskApp />
    </AppProvider>
  </StrictMode>
);
