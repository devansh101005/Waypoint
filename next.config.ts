import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The corpus and the evaluation results are read from disk at runtime with
   * paths built from process.cwd(), which the build's dependency tracing cannot
   * follow. Without this they are missing from the serverless bundle and every
   * route that touches the corpus fails in production while working locally.
   */
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*.csv"],
    "/plan": ["./data/**/*.csv"],
    "/eval": ["./eval-results/*.json"],
  },
};

export default nextConfig;
