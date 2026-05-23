import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { installBrowserMonitoring } from "./src/lib/foundry-monitoring.ts";
import { App } from "./src/pages/App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
installBrowserMonitoring();
createRoot(root).render(<StrictMode><App /></StrictMode>);
