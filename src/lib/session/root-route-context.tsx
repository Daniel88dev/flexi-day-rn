import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { RootRoute } from "./root-route";

type RootRouteState = { route: RootRoute; setRoute: (route: RootRoute) => void };

// Before the root layout has decided, nothing is signed out yet: a guard reading this default
// leaves the screen where it is.
const RootRouteContext = createContext<RootRouteState>({ route: "wait", setRoute: () => {} });

export function RootRouteProvider({ route, children }: { route: RootRoute; children: ReactNode }) {
  // The launch decision only seeds it. Signing in and the signed-out wipe move it afterwards,
  // and the shell's guard has to see that rather than the answer the launch gave.
  const [current, setRoute] = useState(route);
  const value = useMemo(() => ({ route: current, setRoute }), [current]);
  return <RootRouteContext.Provider value={value}>{children}</RootRouteContext.Provider>;
}

export function useRootRoute(): RootRoute {
  return useContext(RootRouteContext).route;
}

export function useSetRootRoute(): (route: RootRoute) => void {
  return useContext(RootRouteContext).setRoute;
}
