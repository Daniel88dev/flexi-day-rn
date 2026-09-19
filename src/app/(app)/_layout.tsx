import { router, type Href } from "expo-router";
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
import { destroyStore, openStore } from "@/lib/local-store";
import {
  buildSections,
  buildUtilityLinks,
  splitForTabBar,
  type NavLink,
} from "@/lib/navigation/shell-links";
import { useViewer } from "@/lib/viewer/use-viewer";

export default function AppLayout() {
  const { t } = useTranslation();
  const viewer = useViewer();
  const [moreOpen, setMoreOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);

  const viewerId = viewer?.id;

  // Signing out wipes the cookie jar, the caches and the local store. Only the store exists so
  // far; the rest waits for the session work, which is also what a 401 from the pull will mean.
  const signOut = useCallback(() => {
    setMoreOpen(false);
    setStoreOpen(false);
    void destroyStore();
  }, []);

  useEffect(() => {
    if (!viewerId) return;
    let current = true;
    openStore(viewerId, { onUnauthorized: signOut }).then(
      () => current && setStoreOpen(true),
      (error: unknown) => console.error("The local store did not open.", error)
    );
    return () => {
      current = false;
    };
  }, [viewerId, signOut]);

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
          onSignOut={signOut}
        />
      </View>
      <Toaster />
    </GestureHandlerRootView>
  );
}
