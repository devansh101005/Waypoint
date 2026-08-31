"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { recentRoutes, type RememberedRoute } from "@/lib/learner-memory";
import { INK } from "./theme";

/**
 * Every other route this browser has plotted.
 *
 * Without this, each new plan silently replaced the last one as far as the
 * learner was concerned — the earlier routes still existed, but the only way
 * back was a URL nobody had written down. Nothing here deletes anything; it
 * lists ids the browser already holds so previous work stays reachable.
 */
export function OtherRoutes({ currentId }: { currentId: string }) {
  const [routes, setRoutes] = useState<RememberedRoute[]>([]);

  // localStorage is browser-only, so this cannot run during render.
  useEffect(() => {
    setRoutes(recentRoutes().filter((r) => r.id !== currentId));
  }, [currentId]);

  if (routes.length === 0) return null;

  return (
    <section aria-labelledby="other-routes">
      <h2
        id="other-routes"
        className="wp-display mb-4 text-[clamp(1.3rem,3vw,1.9rem)] font-extrabold tracking-[-0.01em]"
      >
        YOUR OTHER ROUTES
      </h2>
      <ul className="divide-y" style={{ borderColor: "rgba(22,22,26,0.14)" }}>
        {routes.map((route) => (
          <li key={route.id}>
            <Link
              href={`/dashboard/${route.id}`}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 hover:opacity-70"
            >
              <span className="min-w-0 text-sm font-semibold">
                {route.label}
              </span>
              <span className="ml-auto font-mono text-[0.72rem] tabular-nums opacity-65">
                {new Date(route.at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <span
                aria-hidden="true"
                className="font-mono text-[0.72rem]"
                style={{ color: INK }}
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-[0.68rem] opacity-65">
        REMEMBERED BY THIS BROWSER · YOUR ROUTES ARE NEVER DELETED FROM THE
        SERVER
      </p>
    </section>
  );
}
