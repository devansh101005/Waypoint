/**
 * Remembers, in this browser, which routes you have plotted.
 *
 * Identity here is a capability URL: finishing an intake mints an unguessable
 * learner id and that URL is the only way back to your dashboard. Nothing was
 * holding onto it, so closing the tab stranded the route — the data stayed in
 * the database, but nobody could reach it again.
 *
 * This is a pointer list, not a store. It records ids the browser has already
 * been given so they can be offered back; it never writes learner data, and
 * removing an entry here deletes nothing on the server — the route, its history
 * and its events all remain, reachable by URL as they always were.
 *
 * Every call is wrapped: localStorage throws outright in some privacy modes,
 * and a remembered convenience must never take a page down with it.
 */

const KEY = "waypoint.routes.v1";

/**
 * Fired when a route is recorded. The `storage` event only reaches *other*
 * tabs, so anything in this one that shows a remembered route — the DASHBOARD
 * link especially — has no way to know a route was just plotted, and would go
 * on offering the worked example until the next full page load.
 */
export const ROUTES_CHANGED = "waypoint:routes-changed";

/**
 * Generous on purpose. The cap exists so one browser cannot grow an unbounded
 * list, not to tidy anything away — losing a pointer is the only harm it can
 * do, and at this size a normal user will never reach it.
 */
const LIMIT = 25;

export interface RememberedRoute {
  id: string;
  /** What the learner was aiming at, so the entry is recognisable later. */
  label: string;
  /** ISO timestamp of the most recent time this route was touched. */
  at: string;
}

export function recentRoutes(): RememberedRoute[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is RememberedRoute =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as RememberedRoute).id === "string",
    );
  } catch {
    return [];
  }
}

export function mostRecentRoute(): RememberedRoute | null {
  return recentRoutes()[0] ?? null;
}

/**
 * Record a route, most recent first. Re-plotting an existing learner moves it
 * to the top and refreshes its label rather than adding a duplicate.
 */
export function rememberRoute(id: string, label: string): void {
  if (!id) return;
  try {
    const existing = recentRoutes();
    const previous = existing.find((r) => r.id === id);
    const next: RememberedRoute[] = [
      { id, label: label || previous?.label || "Your route", at: new Date().toISOString() },
      ...existing.filter((r) => r.id !== id),
    ].slice(0, LIMIT);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(ROUTES_CHANGED));
  } catch {
    /* A browser that refuses storage still gets a working route this session. */
  }
}
