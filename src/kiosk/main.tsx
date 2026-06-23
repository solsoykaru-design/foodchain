import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { AppProvider } from "../context";
import KioskApp from "./KioskApp";
import { PriceProvider } from "../PriceContext";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <PriceProvider>
        <KioskApp />
      </PriceProvider>
    </AppProvider>
  </StrictMode>
);
