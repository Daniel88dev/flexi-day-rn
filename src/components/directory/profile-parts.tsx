import { CaretRightIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { Dictionary } from "@/i18n";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { directoryDate } from "@/lib/directory";

export type Fact = {
  label: string;
  value: string | null;
  /** A tappable value: an action sheet, or the Reports to profile. */
  onPress?: () => void;
  testID?: string;
};

export function Facts({ facts, t }: { facts: Fact[]; t: Dictionary }) {
  return (
    <View className="overflow-hidden rounded-[16px] bg-card">
      {facts.map((fact, index) => {
        const value = fact.value ?? t.directory.profile.notSet;
        const body = (
          <View className="flex-1">
            <Text className="text-[12.5px] text-muted-foreground">{fact.label}</Text>
            <Text
              className={cn(
                "text-[15.5px] font-semibold",
                fact.value === null
                  ? "text-faint"
                  : fact.onPress
                    ? "text-primary"
                    : "text-foreground"
              )}
            >
              {value}
            </Text>
          </View>
        );
        const row = cn(
          "flex-row items-center gap-3 px-4 py-2.5",
          index > 0 && "border-t border-border"
        );
        if (!fact.onPress || fact.value === null) {
          return (
            <View key={fact.label} className={row}>
              {body}
            </View>
          );
        }
        return (
          <Pressable
            key={fact.label}
            testID={fact.testID}
            onPress={fact.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${fact.label}, ${value}`}
            className={cn(row, "active:opacity-70")}
          >
            {body}
            <Icon icon={CaretRightIcon} tone="faint" size={16} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function Section({
  testID,
  title,
  removesOn,
  removedOn,
  children,
}: {
  testID: string;
  title: string;
  removesOn?: string | null;
  removedOn?: string | null;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { locale } = t.common;
  const copy = t.directory.profile;
  return (
    <View testID={testID} className="mt-5">
      <View className="flex-row items-baseline justify-between gap-3 px-1 pb-1.5">
        <Text
          accessibilityRole="header"
          className="text-[11px] font-bold tracking-[1px] text-faint uppercase"
        >
          {title}
        </Text>
        {removesOn ? (
          <Text className="text-[12px] font-semibold text-warm">
            {copy.removesOn(directoryDate(locale, removesOn))}
          </Text>
        ) : null}
      </View>
      {removedOn ? (
        <View className="rounded-[16px] bg-card px-4 py-3">
          <Text className="text-[14.5px] text-muted-foreground">
            {copy.removedOn(directoryDate(locale, removedOn))}
          </Text>
        </View>
      ) : (
        children
      )}
    </View>
  );
}
