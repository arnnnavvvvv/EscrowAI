// Vite config for the local dashboard — React plugin, proxy the agent server so the app is same-origin in dev.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const agent = process.env.ESCROWAI_AGENT ?? "http://localhost:4600";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4610,
    proxy: {
      "/api": { target: agent, changeOrigin: true }
    }
  },
  build: { outDir: "dist" }
});
