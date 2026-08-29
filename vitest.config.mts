import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    /**
     * Forks, not the default worker threads.
     *
     * Under some parent environments on Windows the threaded pool loaded a
     * second copy of the runner's modules, and every suite then died at its
     * first `describe()` with "Cannot read properties of undefined (reading
     * 'config')" — zero tests collected, nothing wrong with the code. A forked
     * child gets its own module registry and cannot hit that. It costs nothing
     * measurable at this suite size.
     */
    pool: "forks",
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
