/**
 * StellarFlow frontend entry point.
 *
 * Mounts the app shell (`App`) into `#root` (see `index.html`). The shell owns
 * state-driven navigation between pages; each page keeps its own `SidebarNav`
 * and receives an `onNavigate` callback so nav clicks work app-wide.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
