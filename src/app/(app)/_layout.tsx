import { router, type Href } from "expo-router";
import { TabList, TabSlot, TabTrigger, Tabs } from "expo-router/ui";
import { ListIcon } from "phosphor-react-native";
import { useState } from "react";
import { View } from "react-native";

import { ClockButton } from "@/components/shell/clock-button";
import { MoreSheet } from "@/components/shell/more-sheet";
import { TabButton } from "@/components/shell/tab-button";
import { useTranslation } from "@/i18n/use-translation";
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
    <View className="flex-1 bg-background">
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

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        sections={sheet}
        utility={utility}
        viewer={viewer}
        onNavigate={go}
        // Signing out wipes the cookie jar, the caches and the local store. None of the three
        // exists yet, so this closes the sheet and waits for the session work.
        onSignOut={() => setMoreOpen(false)}
      />
    </View>
  );
}
