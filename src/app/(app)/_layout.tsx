import { Redirect, router, type Href } from "expo-router";
import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui";
import { ListIcon } from "phosphor-react-native";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Toaster } from "sonner-native";

import { ClockDisc } from "@/components/clock/clock-disc";
import { ClockReminders } from "@/components/reminders/clock-reminders";
import { MoreSheet } from "@/components/shell/more-sheet";
import { TabButton } from "@/components/shell/tab-button";
import { useTranslation } from "@/i18n/use-translation";
import { useClockRead } from "@/lib/attendance";
import { openStore } from "@/lib/local-store";
import {
  attendanceLinkShown,
  buildSections,
  buildUtilityLinks,
  splitForTabBar,
  type NavLink,
} from "@/lib/navigation/shell-links";
import { QueryLayer } from "@/lib/query";
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
  const onUnauthorized = useCallback(() => void wipe(), [wipe]);

  // The session and the sync pull revalidate on the same foreground event, neither waiting for
  // the other, so a session revoked while the app slept is caught on the way back in.
  useSessionRevalidation(wipe, { enabled: signedIn });

  // Nothing of the signed-in user's is opened for a visitor the guard below is about to send
  // to welcome; the store would be created and wiped for nobody.
  useEffect(() => {
    if (!viewerId || !signedIn) return;
    let current = true;
    openStore(viewerId, { onUnauthorized }).then(
      () => current && setStoreOpen(true),
      (error: unknown) => console.error("The local store did not open.", error)
    );
    return () => {
      current = false;
    };
  }, [viewerId, signedIn, onUnauthorized]);

  // A deep link into the shell without a session goes back to welcome. The root layout has read
  // the session cache before any of this mounts, so the answer here is never a guess.
  if (rootRoute === "welcome") return <Redirect href="/welcome" />;

  const utility = buildUtilityLinks(t);

  const go = (link: NavLink) => {
    setMoreOpen(false);
    router.push(link.href as Href);
  };

  return (
    // sonner-native's toasts need a gesture handler root above them and expo-router mounts none.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryLayer onUnauthorized={onUnauthorized}>
        {storeOpen ? <ClockReminders /> : null}
        <View className="flex-1 bg-background">
          <ShellLinks>
            {({ bar, sheet, hiddenTabs }) => (
              <>
                {storeOpen ? (
                  <Tabs>
                    <TabSlot />
                    <TabList asChild>
                      <View className="flex-row border-t border-border bg-card pb-safe">
                        {bar.slice(0, 2).map((link) => barSlot(link, go))}

                        <ClockDisc onPress={() => router.push("/clock")} />

                        {bar.slice(2).map((link) => barSlot(link, go))}

                        <TabButton
                          label={t.nav.more}
                          icon={ListIcon}
                          onPress={() => setMoreOpen(true)}
                        />

                        {/* A tab kept off the bar stays a route, so a link still reaches it. */}
                        {hiddenTabs.map((link) => (
                          <TabTrigger
                            key={link.key}
                            name={link.key}
                            href={link.href as Href}
                            style={{ display: "none" }}
                          />
                        ))}
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
              </>
            )}
          </ShellLinks>
        </View>
      </QueryLayer>
      <Toaster />
    </GestureHandlerRootView>
  );
}

/** An element rather than a component: `Tabs` finds its triggers by their element type. */
function barSlot(link: NavLink, onNavigate: (link: NavLink) => void) {
  if (!link.tab) {
    return (
      <TabButton
        key={link.key}
        label={link.label}
        icon={link.icon}
        onPress={() => onNavigate(link)}
      />
    );
  }
  return (
    <TabTrigger key={link.key} name={link.key} href={link.href as Href} asChild>
      <TabButton label={link.label} icon={link.icon} />
    </TabTrigger>
  );
}

// The bar follows the clock's read, which needs the query layer above it.
function ShellLinks({
  children,
}: {
  children: (links: ReturnType<typeof splitForTabBar>) => ReactNode;
}) {
  const { t } = useTranslation();
  const { view } = useClockRead();
  return children(splitForTabBar(buildSections(t, { attendanceLink: attendanceLinkShown(view) })));
}
