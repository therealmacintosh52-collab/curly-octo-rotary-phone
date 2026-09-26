import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Renderers import "server-only" to guard against client bundling; a no-op in tests.
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
});
