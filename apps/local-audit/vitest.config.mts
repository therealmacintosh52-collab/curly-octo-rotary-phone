import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    // Tests never reach a real provider: fixtures only, no keys required.
    env: { PROVIDER_MODE: "mock" },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Server modules import "server-only" to guard against client bundling; a no-op in tests.
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only-stub.ts"),
    },
  },
});
