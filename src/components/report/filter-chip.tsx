import { CaretDownIcon } from "phosphor-react-native";
import { Pressable } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";

/** A chip off its default turns violet, so a filtered report shows what narrows it. */
export function FilterChip({
  testID,
  name,
  label,
  active,
  onPress,
}: {
  testID: string;
  name: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.report.filters.chipLabel(name, label)}
      className={cn(
        "h-9 flex-row items-center gap-1.5 rounded-full border pr-3 pl-3.5 active:opacity-70",
        active ? "border-transparent bg-accent" : "border-border bg-card"
      )}
    >
      <Text
        numberOfLines={1}
        className={cn("text-[14px] font-medium", active ? "text-primary" : "text-foreground")}
      >
        {label}
      </Text>
      <Icon icon={CaretDownIcon} tone={active ? "primary" : "muted"} size={13} weight="bold" />
    </Pressable>
  );
}
