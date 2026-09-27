import { UsersThreeIcon } from "phosphor-react-native";
import { View } from "react-native";

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
        <Text className="text-[14.5px] leading-5 text-muted-foreground">{labels.body}</Text>
      </View>
      <Button
        testID="no-groups-open-web"
        label={labels.open}
        onPress={() => void openWebPage(WEB_PATHS.groups)}
        className="h-12"
      />
    </View>
  );
}
