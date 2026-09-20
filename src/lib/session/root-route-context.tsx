import { createContext, use, useMemo, useState, type ReactNode } from "react";

import type { RootRoute } from "./root-route";

type RootRouteState = { route: RootRoute; setRoute: (route: RootRoute) => void };

// Before the root layout has decided, nothing is signed out yet: a guard reading this default
// leaves the screen where it is.
const RootRouteContext = createContext<RootRouteState>({ route: "wait", setRoute: () => {} });

export function RootRouteProvider({
  route: initialRoute,
  children,
}: {
  route: RootRoute;
  children: ReactNode;
}) {
  // The launch decision only seeds it. Signing in and the signed-out wipe move it afterwards,
  // and the shell's guard has to see that rather than the answer the launch gave.
  const [route, setRoute] = useState(initialRoute);
  const value = useMemo(() => ({ route, setRoute }), [route]);
  return <RootRouteContext value={value}>{children}</RootRouteContext>;
}

export function useRootRoute(): RootRoute {
  return use(RootRouteContext).route;
}

export function useSetRootRoute(): (route: RootRoute) => void {
  return use(RootRouteContext).setRoute;
}
