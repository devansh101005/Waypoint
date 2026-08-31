"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { mostRecentRoute } from "@/lib/learner-memory";

/**
 * The DASHBOARD link, pointed at your own route when this browser has plotted
 * one and at the worked example otherwise.
 *
 * It renders the example href on the server and swaps after mount: the stored
 * id is only knowable in the browser, and reading it during render would make
 * the server and client markup disagree. The link is therefore always valid —
 * never disabled, never empty — it just gets more specific once mounted.
 */
export function DashboardLink({ className }: { className?: string }) {
  const [href, setHref] = useState("/dashboard/demo");

  useEffect(() => {
    const mine = mostRecentRoute();
    if (mine) setHref(`/dashboard/${mine.id}`);
  }, []);

  return (
    <Link href={href} className={className}>
      DASHBOARD
    </Link>
  );
}
