// Vitest root config — picks up *.test.ts across the workspaces, Node environment.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.js"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Materialised base/PR checkouts — they contain copies of the target's own tests.
      ".escrowai-work/**"
    ]
  }
});
