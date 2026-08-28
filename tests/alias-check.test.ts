import { describe, expect, it } from "vitest";
import { findCycles } from "@/lib/corpus";

/**
 * Guards the "@/..." path alias in vitest.config.mts. The alias is easy to
 * break silently (an ESM config where __dirname is undefined resolves it to
 * garbage), and the failure shows up as confusing import errors in unrelated
 * tests rather than as a config error.
 */
describe("path alias", () => {
  it("resolves @/ imports to src/", () => {
    expect(typeof findCycles).toBe("function");
  });
});
