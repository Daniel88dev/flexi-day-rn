import { CalendarDotsIcon, CaretUpDownIcon, UsersIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Divider, Row, Section } from "@/components/settings/grouped-list";
import { showGroupPicker } from "@/components/ui/group-picker";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { dashboardScope } from "@/lib/calendar/scope";
import { cn } from "@/lib/cn";
import type { RequestScopeGroup } from "@/lib/local-store";
import type { MySettings, MySettingsChange } from "@/lib/query";

/**
 * The scope and group the dashboard calendar opens on. It shows what the dashboard would open
 * with, so a stored group the viewer no longer sees reads as the first one they do. Group always
 * saves its group along, because the backend refuses group scope without one.
 */
export function DashboardDefaultSection({
  settings,
  groups,
  onChange,
}: {
  settings: Pick<MySettings, "dashboardScope" | "dashboardGroupId"> | undefined;
  groups: readonly RequestScopeGroup[];
  onChange: (change: MySettingsChange) => void;
}) {
  const { t } = useTranslation();
  const { scope, groupId } = dashboardScope({
    settings,
    scopeChoice: null,
    groupChoice: null,
    groups,
  });
  const group = groups.find((candidate) => candidate.groupId === groupId);
  const loaded = settings !== undefined;

  const choose = (kind: "mine" | "group") => {
    if (kind === scope.kind) return;
    onChange(
      kind === "mine"
        ? { dashboardScope: "MINE" }
        : { dashboardScope: "GROUP", dashboardGroupId: groupId }
    );
  };

  const pickGroup = () =>
    showGroupPicker(
      { title: t.settings.dashboardGroup, groups, cancelLabel: t.account.cancel },
      (picked) => {
        if (picked.kind === "group") {
          onChange({ dashboardScope: "GROUP", dashboardGroupId: picked.groupId });
        }
      }
    );

  const segmented = (
    <View className="flex-row rounded-full bg-muted p-0.5">
      {(["mine", "group"] as const).map((kind) => {
        const on = loaded && scope.kind === kind;
        const disabled = !loaded || (kind === "group" && !group);
        return (
          <Pressable
            key={kind}
            testID={`settings-scope-${kind}`}
            onPress={() => choose(kind)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled }}
            className={cn("rounded-full px-3.5 py-1.5", on && "bg-primary")}
            style={disabled ? { opacity: 0.45 } : undefined}
          >
            <Text
              className={cn(
                "text-[13px] font-semibold",
                on ? "text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {kind === "mine" ? t.dashboard.calendar.mine : t.dashboard.calendar.group}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const canPick = groups.length > 1;
  const showGroup = loaded && scope.kind === "group" && group;

  return (
    <Section
      label={t.settings.dashboardCalendar}
      footer={group ? t.settings.dashboardScopeHint : t.settings.noViewableGroups}
      testID="settings-dashboard"
    >
      <Row icon={CalendarDotsIcon} label={t.settings.dashboardScope} accessory={segmented} />
      {showGroup ? <Divider /> : null}
      {showGroup ? (
        <Row
          testID="settings-group-picker"
          icon={UsersIcon}
          label={t.settings.dashboardGroup}
          value={group.groupName}
          onPress={canPick ? pickGroup : undefined}
          accessory={canPick ? <Icon icon={CaretUpDownIcon} tone="faint" size={16} /> : null}
        />
      ) : null}
    </Section>
  );
}
