import { CheckIcon, CircleIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { BottomSheet } from "@/components/calendar/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";

const ALL = "__all__";

export type SheetOption = { value: string; label: string; hint?: string; leading?: ReactNode };
type Row = SheetOption & { all: boolean };

/**
 * A filter's sheet: radios for one pick, checks for several under an "All" row. A pick applies at
 * once, so the screen behind it follows while the sheet stays open until Done.
 */
export function OptionSheet({
  testID,
  open,
  onClose,
  title,
  options,
  picked,
  onPick,
  allLabel,
}: {
  testID: string;
  open: boolean;
  onClose: () => void;
  title: string;
  options: SheetOption[];
  picked: string[];
  onPick: (value: string | null) => void;
  /** Several picks with an "All" row when set, one pick otherwise. */
  allLabel?: string;
}) {
  const { t } = useTranslation();
  const allRow: Row | null =
    allLabel === undefined ? null : { value: ALL, label: allLabel, all: true };
  const multiple = allRow !== null;
  const optionRows: Row[] = options.map((option) => ({ ...option, all: false }));
  const rows = allRow ? [allRow, ...optionRows] : optionRows;

  return (
    <BottomSheet open={open} onClose={onClose} closeLabel={t.report.filters.close} testID={testID}>
      <View className="flex-row items-center justify-between px-5 pt-1 pb-2">
        <Text className="font-display text-[18px] font-semibold text-foreground">{title}</Text>
        <Pressable
          testID={`${testID}-done`}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t.report.filters.done}
          hitSlop={8}
          className="active:opacity-60"
        >
          <Text className="text-[15px] font-semibold text-primary">{t.report.filters.done}</Text>
        </Pressable>
      </View>
      <ScrollView className="px-3" contentContainerStyle={{ paddingBottom: 16 }}>
        {rows.map((row) => {
          const on = row.all ? picked.length === 0 : picked.includes(row.value);
          const { hint } = row;
          return (
            <Pressable
              key={row.value}
              testID={`${testID}-${row.all ? "all" : row.value}`}
              onPress={() => onPick(row.all ? null : row.value)}
              accessibilityRole={multiple ? "checkbox" : "radio"}
              accessibilityLabel={hint ? `${row.label}, ${hint}` : row.label}
              accessibilityState={{ checked: on }}
              className="min-h-[52px] flex-row items-center gap-3 rounded-[16px] px-2 py-2.5 active:bg-muted"
            >
              {row.leading}
              <View className="flex-1">
                <Text className={cn("text-[15.5px] text-foreground", row.all && "font-semibold")}>
                  {row.label}
                </Text>
                {hint ? <Text className="text-[12.5px] text-faint">{hint}</Text> : null}
              </View>
              {on ? (
                <Icon icon={CheckIcon} tone="primary" size={19} weight="bold" />
              ) : multiple ? null : (
                <Icon icon={CircleIcon} tone="faint" size={19} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
