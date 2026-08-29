// Dashboard entry.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "@escrowai/ui/styles";
import "./dashboard.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
