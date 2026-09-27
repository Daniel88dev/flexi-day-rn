import { router, useNavigation, type Href } from "expo-router";
import { useEffect, useEffectEvent } from "react";

import { useRootRoute } from "@/lib/session/root-route-context";

/**
 * For a root-stack screen a cold deep link can open with nothing beneath: the shell goes under it
 * first, since the shell opens the Local store and mounts the query layer the screen relies on,
 * and the screen comes back on top at `href`. True while the screen is on its own; render nothing.
 */
export function useShellUnderneath(href: Href): boolean {
  const route = useRootRoute();
  const orphaned = !useNavigation().canGoBack();

  const reopen = useEffectEvent(() => {
    router.replace("/dashboard");
    router.push(href);
  });

  useEffect(() => {
    if (route === "signed-in" && orphaned) reopen();
  }, [route, orphaned]);

  return orphaned;
}
