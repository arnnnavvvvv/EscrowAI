// Vite config for the landing page — React plugin, and filesystem access to the repo-root demo-data capture.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // The recorded run lives at <repo>/demo-data, one level above this app.
      allow: [fileURLToPath(new URL("..", import.meta.url))]
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false
  }
});
