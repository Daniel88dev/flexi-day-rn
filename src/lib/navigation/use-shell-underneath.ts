import { router, useNavigation, type Href } from "expo-router";
import { useEffect, useEffectEvent } from "react";

import { useRootRoute } from "@/lib/session/root-route-context";

/**
 * For a root-stack screen a cold deep link can open with nothing beneath: the shell goes under it
 * first, since the shell opens the Local store and mounts the query layer the screen relies on,
 * and the screen comes back on top at `href`. True while the screen is on its own; render nothing.
 * The screen can come back before the shell has opened the store, so a screen that reads the store
 * also renders nothing until `useStoreOpen()` is true.
 * The shell opens on the dashboard unless the screen names a tab of its own.
 */
export function useShellUnderneath(href: Href, underneath: Href = "/dashboard"): boolean {
  const route = useRootRoute();
  const orphaned = !useNavigation().canGoBack();

  const reopen = useEffectEvent(() => {
    router.replace(underneath);
    router.push(href);
  });

  useEffect(() => {
    if (route === "signed-in" && orphaned) reopen();
  }, [route, orphaned]);

  return orphaned;
}
