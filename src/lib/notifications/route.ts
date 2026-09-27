import type { Href } from "expo-router";

export type NotificationRoute =
  | { kind: "request"; vacationId: string; href: Href }
  | { kind: "attendance"; date: string; href: Href }
  | { kind: "list"; href: Href };

const LIST: NotificationRoute = { kind: "list", href: "/notifications" };

const ORIGIN = /^[a-z][a-z\d+.-]*:\/\/[^/?#]*/i;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

type WebLink = { path: string; params: Map<string, string> };

/**
 * The backend writes request links absolute against the web app's URL and attendance links
 * relative, so the origin is dropped either way. Parsed by hand: the phone's `URL` is not the
 * browser's, and a malformed escape has to land on the list rather than throw.
 */
function parseWebLink(href: string): WebLink | null {
  const [beforeFragment = ""] = href.replace(ORIGIN, "").split("#");
  const queryStart = beforeFragment.indexOf("?");
  const rawPath = queryStart === -1 ? beforeFragment : beforeFragment.slice(0, queryStart);
  const query = queryStart === -1 ? "" : beforeFragment.slice(queryStart + 1);

  const params = new Map<string, string>();
  try {
    for (const pair of query.split("&")) {
      if (!pair) continue;
      const split = pair.indexOf("=");
      const key = decodeURIComponent(split === -1 ? pair : pair.slice(0, split));
      const value = split === -1 ? "" : decodeURIComponent(pair.slice(split + 1));
      if (!params.has(key)) params.set(key, value);
    }
  } catch {
    return null;
  }
  return { path: rawPath.replace(/\/+$/, ""), params };
}

/**
 * Where a notification's web link opens on the phone: a request link opens its detail, a My
 * attendance link opens that day, and anything else stays on the notification list.
 */
export function notificationRoute(href: string | null | undefined): NotificationRoute {
  const link = href ? parseWebLink(href) : null;
  if (!link) return LIST;

  const vacationId = link.params.get("vacationId");
  if (link.path === "/requests" && vacationId) {
    return {
      kind: "request",
      vacationId,
      href: { pathname: "/requests/[vacationId]", params: { vacationId } },
    };
  }

  const date = link.params.get("date");
  if (link.path === "/my-attendance" && date && ISO_DAY.test(date)) {
    return { kind: "attendance", date, href: { pathname: "/my-attendance", params: { date } } };
  }

  return LIST;
}
