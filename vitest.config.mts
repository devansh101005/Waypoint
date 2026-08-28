import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // import.meta.dirname, not __dirname: this config is ESM, and __dirname
      // becomes undefined once Vite's native config loader is the default,
      // which would silently break every "@/..." import in a test.
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
