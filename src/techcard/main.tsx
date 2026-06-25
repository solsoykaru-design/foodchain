import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { ToastProvider } from "../ToastContext";
import TechCardStandaloneApp from "./TechCardStandaloneApp";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <TechCardStandaloneApp />
    </ToastProvider>
  </StrictMode>
);