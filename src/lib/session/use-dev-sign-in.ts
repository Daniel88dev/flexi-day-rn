import { router, useNavigation, type NativeStackNavigationProp } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { authClient } from "./auth-client";
import {
  DASHBOARD,
  devSignIn,
  setDevSignInLanding,
  type AuthAnswer,
  type DevSignInLink,
} from "./dev-sign-in";
import { useSetRootRoute } from "./root-route-context";
import { clearSignedOutNotice } from "./signed-out-notice";
import { signedOutWipe } from "./signed-out-wipe";

const redeemThroughAuthClient = (ticket: string): Promise<AuthAnswer> =>
  authClient.$fetch("/dev/redeem-sign-in-ticket", { method: "POST", body: { ticket } });

/** The dev sign-in as the route runs it, once per ticket; `error` is null while it is busy. */
export function useDevSignIn(ticket: unknown, to: unknown): { error: string | null } {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const setRootRoute = useSetRootRoute();
  const [link, setLink] = useState<DevSignInLink | null>(null);
  const [failure, setFailure] = useState<{ ticket: unknown; message: string } | null>(null);
  const seenRef = useRef<unknown>(undefined);

  // The signed-in shell below this screen reads the Local store as it renders, and the wipe
  // closes it. The stack drops to this one screen first, and the wipe waits for that commit.
  useEffect(() => {
    // A new link opened over this screen arrives as new params on the same mount.
    if (seenRef.current === ticket && ticket !== undefined) return;
    seenRef.current = ticket;

    const state = navigation.getState();
    if (state && state.routes.length > 1) {
      navigation.reset({ ...state, index: 0, routes: [state.routes[state.index]] });
    }
    setLink({ ticket, to });
  }, [navigation, ticket, to]);

  useEffect(() => {
    if (!link) return;
    void devSignIn(link, {
      wipe: () => {
        setDevSignInLanding(null);
        return signedOutWipe({ setRootRoute, showNotice: () => {}, replace: () => {} });
      },
      redeem: redeemThroughAuthClient,
      readSession: () => authClient.getSession(),
      signedIn: () => {
        clearSignedOutNotice();
        setRootRoute("signed-in");
      },
      land: (landing) => {
        setDevSignInLanding(landing);
        router.replace(DASHBOARD);
      },
    }).then((message) => {
      if (message) setFailure({ ticket: link.ticket, message });
    });
  }, [link, setRootRoute]);

  return { error: failure && failure.ticket === ticket ? failure.message : null };
}
