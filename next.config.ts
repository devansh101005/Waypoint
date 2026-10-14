import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The corpus and the evaluation results are read from disk at runtime with
   * paths built from process.cwd(), which the build's dependency tracing cannot
   * follow. Without this they are missing from the serverless bundle and every
   * route that touches the corpus fails in production while working locally.
   *
   * The corpus is included for EVERY route, not just the ones that read it
   * directly. Since the store falls back to the CSVs whenever Postgres is
   * unreachable, any route can need them — listing routes individually meant
   * /dashboard/demo kept failing in production after the database went away,
   * while every local test passed because the files were simply on disk.
   */
  outputFileTracingIncludes: {
    "/**": ["./data/**/*.csv"],
    "/eval": ["./eval-results/*.json"],
  },
};

export default nextConfig;
