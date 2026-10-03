import { router } from "expo-router";
import { UsersThreeIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { openWebPage, WEB_PATHS } from "@/lib/web";

/** Joining and creating a group live on the web only, so the phone points there. */
export function NoGroupsCard() {
  const { t } = useTranslation();
  const labels = t.dashboard.noGroups;
  return (
    <View testID="no-groups-card" className="gap-4 rounded-[24px] border border-border bg-card p-5">
      <View className="h-11 w-11 items-center justify-center rounded-[16px] bg-accent">
        <Icon icon={UsersThreeIcon} tone="primary" size={22} weight="bold" />
      </View>
      <View className="gap-1.5">
        <Text className="font-display text-[19px] font-semibold text-foreground">
          {labels.title}
        </Text>
        <Text className="text-[14.5px] leading-5 text-muted-foreground">
          Join your team with the link or code from your invite. Creating a group happens on the
          web.
        </Text>
      </View>
      {/* PROTOTYPE (T-144): joins on the phone, creating stays on the web. */}
      <Button
        testID="no-groups-join"
        label="Join a group"
        onPress={() => router.push("/groups/join")}
        className="h-12"
      />
      <Pressable
        testID="no-groups-open-web"
        onPress={() => void openWebPage(WEB_PATHS.groups)}
        accessibilityRole="link"
        className="items-center py-1 active:opacity-70"
      >
        <Text className="text-[14.5px] font-semibold text-primary">Create a group on the web</Text>
      </Pressable>
    </View>
  );
}
