import { Redirect, router, type Href } from "expo-router";
import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui";
import { ListIcon } from "phosphor-react-native";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Toaster } from "sonner-native";

import { ClockButton } from "@/components/shell/clock-button";
import { MoreSheet } from "@/components/shell/more-sheet";
import { TabButton } from "@/components/shell/tab-button";
import { useTranslation } from "@/i18n/use-translation";
import { openStore } from "@/lib/local-store";
import {
  buildSections,
  buildUtilityLinks,
  splitForTabBar,
  type NavLink,
} from "@/lib/navigation/shell-links";
import { useSessionRevalidation } from "@/lib/session/revalidate-session";
import { useRootRoute } from "@/lib/session/root-route-context";
import { signOut } from "@/lib/session/sign-out";
import { useSignedOutWipe } from "@/lib/session/signed-out-wipe";
import { useViewer } from "@/lib/viewer/use-viewer";

export default function AppLayout() {
  const { t } = useTranslation();
  const viewer = useViewer();
  const rootRoute = useRootRoute();
  const [moreOpen, setMoreOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);

  const viewerId = viewer?.id;
  const signedIn = Boolean(viewerId) && rootRoute !== "welcome";
  const signedOutWipe = useSignedOutWipe();

  // The shell's half of the wipe: the screens it is showing go before the phone lets go of what
  // they were showing. A 401, a session the server no longer knows, and sign-out all end here.
  const wipe = useCallback(async () => {
    setMoreOpen(false);
    setStoreOpen(false);
    await signedOutWipe();
  }, [signedOutWipe]);

  // The session and the sync pull revalidate on the same foreground event, neither waiting for
  // the other, so a session revoked while the app slept is caught on the way back in.
  useSessionRevalidation(wipe, { enabled: signedIn });

  // Nothing of the signed-in user's is opened for a visitor the guard below is about to send
  // to welcome; the store would be created and wiped for nobody.
  useEffect(() => {
    if (!viewerId || !signedIn) return;
    let current = true;
    openStore(viewerId, { onUnauthorized: () => void wipe() }).then(
      () => current && setStoreOpen(true),
      (error: unknown) => console.error("The local store did not open.", error)
    );
    return () => {
      current = false;
    };
  }, [viewerId, signedIn, wipe]);

  // A deep link into the shell without a session goes back to welcome. The root layout has read
  // the session cache before any of this mounts, so the answer here is never a guess.
  if (rootRoute === "welcome") return <Redirect href="/welcome" />;

  // Nobody administers anything until the viewer's roles are read from the backend, so the
  // admin sections stay out of the tree rather than rendering empty.
  const sections = buildSections(t, { administersSomething: false });
  const utility = buildUtilityLinks(t);
  const { bar, sheet } = splitForTabBar(sections);

  const go = (link: NavLink) => {
    setMoreOpen(false);
    router.push(link.href as Href);
  };

  return (
    // sonner-native's toasts need a gesture handler root above them and expo-router mounts none.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-background">
        {storeOpen ? (
          <Tabs>
            <TabSlot />
            <TabList asChild>
              <View className="flex-row border-t border-border bg-card pb-safe">
                {bar.slice(0, 2).map((link) => (
                  <TabTrigger key={link.key} name={link.key} href={link.href as Href} asChild>
                    <TabButton label={link.label} icon={link.icon} />
                  </TabTrigger>
                ))}

                <ClockButton label={t.nav.clock} onPress={() => router.push("/my-attendance")} />

                {bar.slice(2).map((link) => (
                  <TabTrigger key={link.key} name={link.key} href={link.href as Href} asChild>
                    <TabButton label={link.label} icon={link.icon} />
                  </TabTrigger>
                ))}

                <TabButton label={t.nav.more} icon={ListIcon} onPress={() => setMoreOpen(true)} />
              </View>
            </TabList>
          </Tabs>
        ) : null}

        <MoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          sections={sheet}
          utility={utility}
          viewer={viewer}
          onNavigate={go}
          onSignOut={() => void signOut(wipe)}
        />
      </View>
      <Toaster />
    </GestureHandlerRootView>
  );
}
