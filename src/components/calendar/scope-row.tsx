import { CaretDownIcon, FunnelSimpleIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { showGroupPicker } from "@/components/ui/group-picker";
import { LEAVE_TYPE_ORDER } from "@/components/ui/leave-classes";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { CalendarRecordType, RequestListScope, RequestScopeGroup } from "@/lib/local-store";

/** Mine | Group shows only when the viewer sees some group in full, the picker only for two or more. */
export function ScopeRow({
  scope,
  groupId,
  groups,
  filter,
  onScope,
  onFilter,
}: {
  scope: RequestListScope;
  groupId: string | null;
  groups: readonly RequestScopeGroup[];
  filter: ReadonlySet<CalendarRecordType>;
  onScope: (scope: RequestListScope) => void;
  onFilter: () => void;
}) {
  const { t } = useTranslation();
  const labels = t.dashboard.calendar;
  const group = groups.find((candidate) => candidate.groupId === groupId);

  const pickGroup = () =>
    showGroupPicker({ title: labels.pickGroup, groups, cancelLabel: t.account.cancel }, onScope);

  const filterLabel =
    filter.size === LEAVE_TYPE_ORDER.length
      ? labels.allTypes
      : filter.size === 0
        ? labels.noTypes
        : labels.typeCount(filter.size);

  return (
    <View className="flex-row items-center gap-2">
      {group ? (
        <View className="flex-row rounded-full bg-muted p-0.5">
          {(["mine", "group"] as const).map((kind) => {
            const on = scope.kind === kind;
            return (
              <Pressable
                key={kind}
                testID={`calendar-scope-${kind}`}
                onPress={() =>
                  onScope(
                    kind === "mine" ? { kind: "mine" } : { kind: "group", groupId: group.groupId }
                  )
                }
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className={cn("rounded-full px-3.5 py-1.5", on && "bg-primary")}
              >
                <Text
                  className={cn(
                    "text-[13px] font-semibold",
                    on ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {kind === "mine" ? labels.mine : labels.group}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {group && scope.kind === "group" && groups.length > 1 ? (
        <Pressable
          testID="calendar-group-picker"
          onPress={pickGroup}
          accessibilityRole="button"
          accessibilityLabel={`${labels.pickGroup}: ${group.groupName}`}
          className="shrink flex-row items-center gap-1 rounded-full border border-input bg-card px-3 py-1.5 active:opacity-70"
        >
          <Text className="shrink text-[13px] font-semibold text-foreground" numberOfLines={1}>
            {group.groupName}
          </Text>
          <Icon icon={CaretDownIcon} tone="faint" size={12} weight="bold" />
        </Pressable>
      ) : null}
      <View className="flex-1" />
      <Pressable
        testID="calendar-filter"
        onPress={onFilter}
        accessibilityRole="button"
        accessibilityLabel={`${labels.filterTitle}: ${filterLabel}`}
        className="flex-row items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5 active:opacity-70"
      >
        <Icon icon={FunnelSimpleIcon} tone="faint" size={14} weight="bold" />
        <Text className="text-[13px] font-semibold text-foreground">{filterLabel}</Text>
      </Pressable>
    </View>
  );
}
