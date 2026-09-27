import { CheckIcon } from "phosphor-react-native";
import { Pressable, ScrollView, View } from "react-native";

import { BottomSheet } from "@/components/calendar/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { LEAVE_CLASSES, LEAVE_TYPE_ORDER } from "@/components/ui/leave-classes";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { CalendarRecordType } from "@/lib/local-store";

export function FilterSheet({
  open,
  onClose,
  filter,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  filter: ReadonlySet<CalendarRecordType>;
  onChange: (filter: Set<CalendarRecordType>) => void;
}) {
  const { t } = useTranslation();
  const labels = t.dashboard.calendar;
  const all = filter.size === LEAVE_TYPE_ORDER.length;

  const toggle = (type: CalendarRecordType) => {
    const next = new Set(filter);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange(next);
  };

  return (
    <BottomSheet open={open} onClose={onClose} closeLabel={t.account.cancel} testID="filter-sheet">
      <View className="flex-row items-center justify-between px-5 pt-1 pb-2">
        <Text className="font-display text-[18px] font-semibold text-foreground">
          {labels.filterTitle}
        </Text>
        <Pressable
          testID="filter-sheet-all"
          onPress={() => onChange(new Set(all ? [] : LEAVE_TYPE_ORDER))}
          hitSlop={8}
        >
          <Text className="text-[14px] font-semibold text-primary">
            {all ? labels.clearAll : labels.selectAll}
          </Text>
        </Pressable>
      </View>
      <ScrollView className="px-3" contentContainerStyle={{ paddingBottom: 12 }}>
        {LEAVE_TYPE_ORDER.map((type) => {
          const on = filter.has(type);
          return (
            <Pressable
              key={type}
              testID={`filter-sheet-${type}`}
              onPress={() => toggle(type)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              className="flex-row items-center gap-3 rounded-[16px] px-2 py-3 active:bg-muted"
            >
              <View
                className={cn("h-[11px] w-[11px] rounded-full", LEAVE_CLASSES[type].fill)}
                style={{ opacity: on ? 1 : 0.35 }}
              />
              <Text className={cn("flex-1 text-[15px]", on ? "text-foreground" : "text-faint")}>
                {t.recordTypes[type]}
              </Text>
              {on ? <Icon icon={CheckIcon} tone="primary" size={18} weight="bold" /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
